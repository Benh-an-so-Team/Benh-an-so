package com.benhsoan.application.ucservice.prescription;

import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.benhsoan.application.ucservice.inventory.EligibleStockSnapshotService;
import com.benhsoan.application.ucservice.inventory.LowStockAlertTransitionService;
import com.benhsoan.domain.auditlog.AuditLog;
import com.benhsoan.domain.auditlog.enums.ActionType;
import com.benhsoan.domain.auditlog.enums.ResourceType;
import com.benhsoan.domain.inventory.MedicineBatch;
import com.benhsoan.domain.inventory.StockMovement;
import com.benhsoan.domain.inventory.enums.StockMovementReferenceType;
import com.benhsoan.domain.inventory.enums.StockMovementType;
import com.benhsoan.domain.medicine.Medicine;
import com.benhsoan.domain.medicine.exception.MedicineNotFoundException;
import com.benhsoan.domain.patient.PatientMinorPolicy;
import com.benhsoan.domain.prescription.Prescription;
import com.benhsoan.domain.prescription.PrescriptionDispenseItem;
import com.benhsoan.domain.prescription.PrescriptionItem;
import com.benhsoan.domain.prescription.enums.PrescriptionStatus;
import com.benhsoan.application.ucservice.controlledmedicine.ControlledMedicineRegisterRecorder;
import com.benhsoan.domain.prescription.exception.PrescriptionAlreadyDispensedException;
import com.benhsoan.domain.prescription.exception.PrescriptionAllocationInsufficientStockException;
import com.benhsoan.domain.prescription.exception.PrescriptionInsufficientStockException;
import com.benhsoan.domain.prescription.exception.PrescriptionInvalidStatusException;
import com.benhsoan.domain.prescription.exception.PrescriptionNotFoundException;
import com.benhsoan.domain.prescription.exception.ControlledMedicineConfirmationRequiredException;
import com.benhsoan.domain.shared.exception.ValidationException;
import com.benhsoan.port.dto.command.prescription.DispenseItemCommand;
import com.benhsoan.port.dto.command.prescription.DispensePrescriptionItemsCommand;
import com.benhsoan.port.dto.result.DispenseAllocationResult;
import com.benhsoan.port.dto.result.PartialDispensePrescriptionResult;
import com.benhsoan.port.inbound.prescription.DispensePrescriptionItemsUseCase;
import com.benhsoan.port.outbound.repository.audit.AuditLogRepository;
import com.benhsoan.port.outbound.repository.inventory.MedicineBatchRepository;
import com.benhsoan.port.outbound.repository.inventory.StockMovementRepository;
import com.benhsoan.port.outbound.repository.medicine.MedicineRepository;
import com.benhsoan.port.outbound.repository.prescription.PrescriptionDispenseItemRepository;
import com.benhsoan.port.outbound.repository.prescription.PrescriptionRepository;
import com.benhsoan.port.outbound.repository.prescription.PrescriptionWarningLogRepository;
import com.benhsoan.port.outbound.security.CurrentUserPort;
import com.benhsoan.port.outbound.time.ClockPort;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
@Transactional
public class PartialDispensePrescriptionService implements DispensePrescriptionItemsUseCase {

    private final PrescriptionRepository prescriptionRepository;
    private final PrescriptionDispenseItemRepository prescriptionDispenseItemRepository;
    private final PrescriptionWarningLogRepository warningLogRepository;
    private final MedicineRepository medicineRepository;
    private final MedicineBatchRepository medicineBatchRepository;
    private final StockMovementRepository stockMovementRepository;
    private final EligibleStockSnapshotService eligibleStockSnapshotService;
    private final LowStockAlertTransitionService lowStockAlertTransitionService;
    private final CurrentUserPort currentUserPort;
    private final ClockPort clockPort;
    private final AuditLogRepository auditLogRepository;
    private final PartialDispensePrescriptionResultMapper resultMapper;
    private final ControlledMedicineRegisterRecorder controlledMedicineRegisterRecorder;
    private final PrescriptionDisplayContextResolver displayContextResolver;

    @Override
    public PartialDispensePrescriptionResult dispense(DispensePrescriptionItemsCommand command) {
        if (command == null || command.prescriptionId() == null) {
            throw new ValidationException("Prescription id is required.");
        }
        ensureAuthorized();

        UUID actorId = currentUserPort.getCurrentUserId();
        Instant now = clockPort.now();
        LocalDate today = now.atZone(PatientMinorPolicy.CLINICAL_TIMEZONE).toLocalDate();

        Prescription prescription = prescriptionRepository.findByIdForUpdate(command.prescriptionId())
                .orElseThrow(() -> new PrescriptionNotFoundException(command.prescriptionId()));
        validateStatus(prescription);

        List<PrescriptionItem> items = prescription.getItems();
        Map<UUID, Integer> requestedByItem = resolveRequestedQuantities(command, items);
        Map<UUID, Medicine> medicines = loadMedicines(items);
        Map<UUID, Medicine> dispensedMedicines = resolveDispensedMedicines(items, requestedByItem, medicines);
        requireControlledMedicineConfirmation(dispensedMedicines, command.controlledMedicineConfirmed());
        Map<UUID, DispenseItemCommand> commandByItemId = command.items().stream()
                .collect(Collectors.toMap(DispenseItemCommand::prescriptionItemId, Function.identity()));

        List<PrescriptionInsufficientStockException.StockShortageDetail> shortages = new ArrayList<>();
        List<AllocationPlan> plans = new ArrayList<>();
        List<BatchOverride> overrides = new ArrayList<>();
        Map<UUID, Integer> beforeEligibleQuantities = new HashMap<>(
                eligibleStockSnapshotService.snapshotEligibleStockQuantities(
                        items.stream().map(PrescriptionItem::getMedicineId).distinct().toList(), today));

        for (PrescriptionItem item : items) {
            Integer requested = requestedByItem.get(item.getId());
            if (requested == null) {
                continue;
            }
            Medicine medicine = medicines.get(item.getMedicineId());
            List<MedicineBatch> batches = medicineBatchRepository
                    .findAvailableByMedicineIdForUpdate(item.getMedicineId(), today);
            int available = batches.stream().mapToInt(MedicineBatch::getQuantity).sum();

            if (available < requested) {
                shortages.add(new PrescriptionInsufficientStockException.StockShortageDetail(
                        item.getId(),
                        item.getMedicineId(),
                        medicine.getMedicineCode(),
                        item.getMedicineName(),
                        requested,
                        available,
                        requested - available));
                continue;
            }

            DispenseItemCommand commandItem = commandByItemId.get(item.getId());
            UUID overrideBatchId = commandItem == null ? null : commandItem.batchId();
            String overrideReason = commandItem == null ? null : commandItem.batchChangeReason();

            if (overrideBatchId == null) {
                int remaining = requested;
                for (MedicineBatch batch : batches) {
                    if (remaining == 0) {
                        break;
                    }
                    int allocated = Math.min(remaining, batch.getQuantity());
                    plans.add(new AllocationPlan(item, batch, medicine.getMedicineCode(), allocated));
                    remaining -= allocated;
                }
                continue;
            }

            MedicineBatch selected = null;
            for (MedicineBatch batch : batches) {
                if (batch.getId().equals(overrideBatchId)) {
                    selected = batch;
                    break;
                }
            }
            if (selected == null) {
                throw new ValidationException(
                        "Selected batch is not eligible for dispensing: " + overrideBatchId);
            }

            MedicineBatch fefoFirst = batches.getFirst();
            if (!selected.getId().equals(fefoFirst.getId())) {
                if (overrideReason == null || overrideReason.isBlank()) {
                    throw new ValidationException(
                            "Batch change reason is required when overriding the FEFO-selected batch.");
                }
                overrides.add(new BatchOverride(
                        item.getId(), fefoFirst.getId(), selected.getId(), overrideReason.trim()));
            }

            int remaining = requested;
            int allocatedFromSelected = Math.min(remaining, selected.getQuantity());
            plans.add(new AllocationPlan(item, selected, medicine.getMedicineCode(), allocatedFromSelected));
            remaining -= allocatedFromSelected;

            for (MedicineBatch batch : batches) {
                if (remaining == 0) {
                    break;
                }
                if (batch.getId().equals(selected.getId())) {
                    continue;
                }
                int allocated = Math.min(remaining, batch.getQuantity());
                plans.add(new AllocationPlan(item, batch, medicine.getMedicineCode(), allocated));
                remaining -= allocated;
            }
        }

        if (!shortages.isEmpty()) {
            throw new PrescriptionInsufficientStockException(command.prescriptionId(), shortages);
        }

        List<DispenseAllocationResult> allocations = applyAllocations(
                plans, items, actorId, now, beforeEligibleQuantities, today);

        boolean fullyDispensed = items.stream().allMatch(PrescriptionItem::isFullyDispensed);
        if (fullyDispensed) {
            prescription.markDispensed(actorId, now);
        } else {
            prescription.markPartiallyDispensed(actorId, now);
        }
        Prescription saved = prescriptionRepository.save(prescription);

        recordControlledRegisterEntries(
                saved,
                items,
                requestedByItem,
                medicines,
                actorId,
                now
        );

        auditLogRepository.save(AuditLog.create(
                actorId,
                ActionType.DISPENSE,
                ResourceType.PRESCRIPTION,
                saved.getId(),
                "{\"prescriptionCode\":\"%s\",\"status\":\"%s\"}"
                        .formatted(saved.getPrescriptionCode(), saved.getStatus()),
                null,
                now));

        for (BatchOverride override : overrides) {
            auditLogRepository.save(AuditLog.create(
                    actorId,
                    ActionType.OVERRIDE_BATCH_SELECTION,
                    ResourceType.PRESCRIPTION,
                    saved.getId(),
                    "{\"prescriptionItemId\":\"%s\",\"fefoBatchId\":\"%s\",\"selectedBatchId\":\"%s\",\"reason\":\"%s\"}"
                            .formatted(override.prescriptionItemId(), override.fefoBatchId(),
                                    override.selectedBatchId(), override.reason()),
                    null,
                    now));
        }

        return resultMapper.toResult(
                saved,
                warningLogRepository.findByPrescriptionId(saved.getId()),
                actorId,
                now,
                items,
                medicines,
                allocations);
    }

    private void ensureAuthorized() {
        if (!currentUserPort.hasRole("PHARMACIST")
                && !currentUserPort.hasRole("ADMIN")) {
            throw new AccessDeniedException("Only pharmacists can dispense prescriptions.");
        }
    }

    private void requireControlledMedicineConfirmation(
            Map<UUID, Medicine> medicines,
            boolean confirmed
    ) {
        boolean hasControlled = medicines.values().stream()
                .anyMatch(Medicine::isControlled);
        if (hasControlled && !confirmed) {
            throw new ControlledMedicineConfirmationRequiredException();
        }
    }

    private void recordControlledRegisterEntries(
            Prescription prescription,
            List<PrescriptionItem> items,
            Map<UUID, Integer> requestedByItem,
            Map<UUID, Medicine> medicines,
            UUID dispensedBy,
            Instant dispensedAt
    ) {
        List<ControlledMedicineRegisterRecorder.Entry> entries = items.stream()
                .filter(item -> {
                    Medicine medicine = medicines.get(item.getMedicineId());
                    Integer requested = requestedByItem.get(item.getId());
                    return medicine != null
                            && medicine.isControlled()
                            && requested != null
                            && requested > 0;
                })
                .map(item -> new ControlledMedicineRegisterRecorder.Entry(
                        item.getId(),
                        item.getMedicineId(),
                        item.getMedicineName(),
                        requestedByItem.get(item.getId())
                ))
                .toList();

        if (entries.isEmpty()) {
            return;
        }

        UUID patientId = displayContextResolver.resolve(
                prescription.getMedicalRecordId(),
                prescription.getPrescribedBy()
        ).patientId();

        controlledMedicineRegisterRecorder.record(
                prescription.getId(),
                prescription.getPrescribedBy(),
                patientId,
                dispensedBy,
                dispensedAt,
                entries
        );
    }

    private void validateStatus(Prescription prescription) {
        if (prescription.getStatus() == PrescriptionStatus.CANCELLED) {
            throw new PrescriptionInvalidStatusException("Cancelled prescriptions cannot be dispensed.");
        }
        if (prescription.getStatus() == PrescriptionStatus.DISPENSED) {
            throw new PrescriptionAlreadyDispensedException();
        }
        if (prescription.getStatus() == PrescriptionStatus.REPLACED) {
            throw new PrescriptionInvalidStatusException("Replaced prescriptions cannot be dispensed.");
        }
    }

    private Map<UUID, Integer> resolveRequestedQuantities(
            DispensePrescriptionItemsCommand command,
            List<PrescriptionItem> items
    ) {
        Map<UUID, Integer> requested = new LinkedHashMap<>();

        if (command.items().isEmpty()) {
            for (PrescriptionItem item : items) {
                int remaining = item.getRemainingQuantity();
                if (remaining > 0) {
                    requested.put(item.getId(), remaining);
                }
            }
            if (requested.isEmpty()) {
                throw new ValidationException("Nothing left to dispense for this prescription.");
            }
            return requested;
        }

        for (DispenseItemCommand commandItem : command.items()) {
            if (commandItem.prescriptionItemId() == null) {
                throw new ValidationException("Prescription item id is required.");
            }
            if (commandItem.quantity() <= 0) {
                throw new ValidationException("Dispensed quantity must be greater than zero.");
            }
            PrescriptionItem item = items.stream()
                    .filter(candidate -> candidate.getId().equals(commandItem.prescriptionItemId()))
                    .findFirst()
                    .orElseThrow(() -> new ValidationException(
                            "Prescription item does not belong to prescription: "
                                    + commandItem.prescriptionItemId()));
            int remaining = item.getRemainingQuantity();
            if (commandItem.quantity() > remaining) {
                throw new ValidationException(
                        "Dispensed quantity exceeds the remaining prescribed quantity for item "
                                + commandItem.prescriptionItemId() + ".");
            }
            if (requested.putIfAbsent(item.getId(), commandItem.quantity()) != null) {
                throw new ValidationException(
                        "Duplicate prescription item in request: " + item.getId());
            }
        }
        return requested;
    }

    private Map<UUID, Medicine> loadMedicines(List<PrescriptionItem> items) {
        List<UUID> medicineIds = items.stream()
                .map(PrescriptionItem::getMedicineId)
                .distinct()
                .toList();
        Map<UUID, Medicine> byId = medicineRepository.findAllById(medicineIds).stream()
                .collect(Collectors.toMap(Medicine::getId, Function.identity()));
        for (UUID medicineId : medicineIds) {
            if (!byId.containsKey(medicineId)) {
                throw new MedicineNotFoundException(medicineId);
            }
        }
        return byId;
    }

    /**
     * Narrows the medicine map to only the medicines that are actually dispensed
     * in this partial-dispense operation (requested quantity &gt; 0). This keeps the
     * controlled-medicine confirmation guard in the same business scope as the
     * register-writing logic ({@link #recordControlledRegisterEntries}).
     */
    private Map<UUID, Medicine> resolveDispensedMedicines(
            List<PrescriptionItem> items,
            Map<UUID, Integer> requestedByItem,
            Map<UUID, Medicine> medicines
    ) {
        Set<UUID> dispensedMedicineIds = items.stream()
                .filter(item -> requestedByItem.containsKey(item.getId()))
                .map(PrescriptionItem::getMedicineId)
                .collect(Collectors.toSet());
        return medicines.entrySet().stream()
                .filter(entry -> dispensedMedicineIds.contains(entry.getKey()))
                .collect(Collectors.toMap(Map.Entry::getKey, Map.Entry::getValue));
    }

    private List<DispenseAllocationResult> applyAllocations(
            List<AllocationPlan> plans,
            List<PrescriptionItem> items,
            UUID actorId,
            Instant now,
            Map<UUID, Integer> beforeEligibleQuantities,
            LocalDate today
    ) {
        List<PrescriptionDispenseItem> dispenseItems = new ArrayList<>();
        List<StockMovement> stockMovements = new ArrayList<>();
        Map<UUID, Integer> medicineDeltas = new HashMap<>();
        List<DispenseAllocationResult> allocations = new ArrayList<>();

        for (AllocationPlan plan : plans) {
            MedicineBatch batch = plan.batch();
            int quantityBefore = batch.getQuantity();
            batch.deductStock(plan.allocatedQuantity(), now);
            try {
                medicineBatchRepository.deductStockQuantity(
                        batch.getId(),
                        plan.allocatedQuantity(),
                        batch.getStatus(),
                        now);
            } catch (ValidationException ex) {
                throw new PrescriptionAllocationInsufficientStockException(
                        plan.item().getPrescriptionId(),
                        plan.item(),
                        plan.medicineCode(),
                        quantityBefore);
            }

            dispenseItems.add(PrescriptionDispenseItem.create(
                    UUID.randomUUID(),
                    plan.item().getPrescriptionId(),
                    plan.item().getId(),
                    plan.item().getMedicineId(),
                    batch.getId(),
                    plan.allocatedQuantity(),
                    actorId,
                    now));

            stockMovements.add(StockMovement.create(
                    UUID.randomUUID(),
                    plan.item().getMedicineId(),
                    batch.getId(),
                    StockMovementType.DISPENSE,
                    StockMovementReferenceType.PRESCRIPTION_ITEM,
                    plan.item().getId(),
                    -plan.allocatedQuantity(),
                    quantityBefore,
                    batch.getQuantity(),
                    actorId,
                    now,
                    "Partially dispensed for prescription item " + plan.item().getId()));

            medicineDeltas.merge(plan.item().getMedicineId(), -plan.allocatedQuantity(), Integer::sum);

            allocations.add(new DispenseAllocationResult(
                    dispenseItems.get(dispenseItems.size() - 1).getId(),
                    plan.item().getId(),
                    plan.item().getMedicineId(),
                    plan.medicineCode(),
                    plan.item().getMedicineName(),
                    batch.getId(),
                    batch.getBatchNumber(),
                    batch.getExpiryDate(),
                    plan.allocatedQuantity(),
                    batch.getQuantity()));
        }

        prescriptionDispenseItemRepository.saveAll(dispenseItems);
        stockMovementRepository.saveAll(stockMovements);
        medicineDeltas.forEach(medicineRepository::updateStockQuantity);

        Map<UUID, PrescriptionItem> itemById = items.stream()
                .collect(Collectors.toMap(PrescriptionItem::getId, Function.identity()));
        for (AllocationPlan plan : plans) {
            itemById.get(plan.item().getId()).recordDispense(plan.allocatedQuantity());
        }

        lowStockAlertTransitionService.handleEligibleStockTransitions(
                beforeEligibleQuantities.keySet(),
                beforeEligibleQuantities,
                today,
                now);

        return allocations;
    }

    private record AllocationPlan(
            PrescriptionItem item,
            MedicineBatch batch,
            String medicineCode,
            int allocatedQuantity
    ) {
    }

    private record BatchOverride(
            UUID prescriptionItemId,
            UUID fefoBatchId,
            UUID selectedBatchId,
            String reason
    ) {
    }
}
