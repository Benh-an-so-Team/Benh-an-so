package com.benhsoan.application.ucservice.prescription;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

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
import com.benhsoan.domain.medicine.exception.MedicineNotFoundException;
import com.benhsoan.domain.medicine.Medicine;
import com.benhsoan.domain.prescription.Prescription;
import com.benhsoan.domain.prescription.PrescriptionDispenseItem;
import com.benhsoan.domain.prescription.PrescriptionItem;
import com.benhsoan.domain.prescription.exception.PrescriptionAllocationInsufficientStockException;
import com.benhsoan.domain.prescription.exception.PrescriptionInsufficientStockException;
import com.benhsoan.domain.prescription.exception.PrescriptionNotFoundException;
import com.benhsoan.domain.prescription.exception.ControlledMedicineConfirmationRequiredException;
import com.benhsoan.domain.shared.exception.ValidationException;
import com.benhsoan.application.ucservice.controlledmedicine.ControlledMedicineRegisterRecorder;
import com.benhsoan.port.dto.command.prescription.DispensePrescriptionCommand;
import com.benhsoan.port.dto.result.DispenseAllocationResult;
import com.benhsoan.port.dto.result.DispensePrescriptionResult;
import com.benhsoan.port.outbound.repository.inventory.MedicineBatchRepository;
import com.benhsoan.port.outbound.repository.inventory.StockMovementRepository;
import com.benhsoan.port.outbound.repository.medicine.MedicineRepository;
import com.benhsoan.port.outbound.repository.prescription.PrescriptionDispenseItemRepository;
import com.benhsoan.port.outbound.repository.prescription.PrescriptionItemRepository;
import com.benhsoan.port.inbound.prescription.DispensePrescriptionUseCase;
import com.benhsoan.port.outbound.repository.audit.AuditLogRepository;
import com.benhsoan.port.outbound.repository.prescription.PrescriptionRepository;
import com.benhsoan.port.outbound.repository.prescription.PrescriptionWarningLogRepository;
import com.benhsoan.port.outbound.security.CurrentUserPort;
import com.benhsoan.port.outbound.time.ClockPort;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
@Transactional
public class DispensePrescriptionService implements DispensePrescriptionUseCase {

    private final PrescriptionRepository prescriptionRepository;
    private final PrescriptionItemRepository prescriptionItemRepository;
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
    private final DispensePrescriptionResultMapper resultMapper;
    private final ControlledMedicineRegisterRecorder controlledMedicineRegisterRecorder;
    private final PrescriptionDisplayContextResolver displayContextResolver;

    @Override
    public DispensePrescriptionResult dispense(DispensePrescriptionCommand command) {
        if (command == null || command.prescriptionId() == null) {
            throw new ValidationException("Prescription id is required.");
        }
        if (!currentUserPort.hasRole("PHARMACIST")
                && !currentUserPort.hasRole("ADMIN")) {
            throw new AccessDeniedException("Only pharmacists can dispense prescriptions.");
        }
        UUID actorId = currentUserPort.getCurrentUserId();
        Instant now = clockPort.now();
        LocalDate today = LocalDate.ofInstant(now, ZoneOffset.UTC);
        UUID prescriptionId = command.prescriptionId();
        var prescription = prescriptionRepository.findByIdForUpdate(prescriptionId)
                .orElseThrow(() -> new PrescriptionNotFoundException(prescriptionId));
        if (prescription.getStatus() == com.benhsoan.domain.prescription.enums.PrescriptionStatus.CANCELLED) {
            throw new com.benhsoan.domain.prescription.exception.PrescriptionInvalidStatusException("Cancelled prescriptions cannot be dispensed.");
        }
        if (prescription.getStatus() == com.benhsoan.domain.prescription.enums.PrescriptionStatus.DISPENSED) {
            throw new com.benhsoan.domain.prescription.exception.PrescriptionAlreadyDispensedException();
        }
        if (prescription.getStatus() == com.benhsoan.domain.prescription.enums.PrescriptionStatus.PARTIALLY_DISPENSED) {
            throw new com.benhsoan.domain.prescription.exception.PrescriptionInvalidStatusException(
                    "Partially dispensed prescriptions must be completed via partial dispensing.");
        }
        if (prescription.getStatus() == com.benhsoan.domain.prescription.enums.PrescriptionStatus.REPLACED) {
            throw new com.benhsoan.domain.prescription.exception.PrescriptionInvalidStatusException(
                    "Replaced prescriptions cannot be dispensed.");
        }
        List<PrescriptionItem> prescriptionItems = prescriptionItemRepository.findByPrescriptionId(prescriptionId);
        List<UUID> medicineIds = prescriptionItems.stream()
                .map(PrescriptionItem::getMedicineId)
                .distinct()
                .toList();

        Map<UUID, Medicine> medicines = loadMedicines(medicineIds);
        requireControlledMedicineConfirmation(medicines, command.controlledMedicineConfirmed());

        AllocationComputation computation = computeAllocations(
                prescription.getId(),
                prescriptionItems,
                medicineIds,
                now,
                today
        );

        List<DispenseAllocationResult> allocations = applyAllocations(computation, actorId, now);
        for (PrescriptionItem item : prescription.getItems()) {
            item.recordDispense(item.getQuantity());
        }
        prescription.markDispensed(actorId, now);
        var saved = prescriptionRepository.save(prescription);

        recordControlledRegisterEntries(
                saved,
                prescriptionItems,
                medicines,
                actorId,
                now
        );

        auditLogRepository.save(AuditLog.create(
                actorId,
                ActionType.DISPENSE,
                ResourceType.PRESCRIPTION,
                saved.getId(),
                "{\"prescriptionCode\":\"%s\"}".formatted(saved.getPrescriptionCode()),
                null,
                now
        ));
        return resultMapper.toResult(
                saved,
                warningLogRepository.findByPrescriptionId(saved.getId()),
                actorId,
                now,
                allocations
        );
    }

    private Map<UUID, Medicine> loadMedicines(List<UUID> medicineIds) {
        return medicineRepository.findAllById(medicineIds).stream()
                .collect(java.util.stream.Collectors.toMap(
                        Medicine::getId,
                        medicine -> medicine
                ));
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
            List<PrescriptionItem> prescriptionItems,
            Map<UUID, Medicine> medicines,
            UUID dispensedBy,
            Instant dispensedAt
    ) {
        List<ControlledMedicineRegisterRecorder.Entry> entries = prescriptionItems.stream()
                .filter(item -> {
                    Medicine medicine = medicines.get(item.getMedicineId());
                    return medicine != null && medicine.isControlled();
                })
                .map(item -> new ControlledMedicineRegisterRecorder.Entry(
                        item.getId(),
                        item.getMedicineId(),
                        item.getMedicineName(),
                        item.getQuantity()
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

    private AllocationComputation computeAllocations(
            UUID prescriptionId,
            List<PrescriptionItem> prescriptionItems,
            List<UUID> medicineIds,
            Instant now,
            LocalDate today
    ) {
        List<AllocationPlan> allocationPlans = new ArrayList<>();
        List<PrescriptionInsufficientStockException.StockShortageDetail> shortages = new ArrayList<>();
        Map<UUID, Integer> beforeEligibleQuantities = new HashMap<>(
                eligibleStockSnapshotService.snapshotEligibleStockQuantities(medicineIds, today)
        );

        for (PrescriptionItem item : prescriptionItems) {
            var medicine = medicineRepository.findById(item.getMedicineId())
                    .orElseThrow(() -> new MedicineNotFoundException(item.getMedicineId()));

            List<MedicineBatch> availableBatches = medicineBatchRepository
                    .findAvailableByMedicineIdForUpdate(item.getMedicineId(), today);

            int availableQuantity = availableBatches.stream()
                    .mapToInt(MedicineBatch::getQuantity)
                    .sum();

            if (availableQuantity < item.getQuantity()) {
                shortages.add(new PrescriptionInsufficientStockException.StockShortageDetail(
                        item.getId(),
                        item.getMedicineId(),
                        medicine.getMedicineCode(),
                        item.getMedicineName(),
                        item.getQuantity(),
                        availableQuantity,
                        item.getQuantity() - availableQuantity
                ));
                continue;
            }

            int remaining = item.getQuantity();
            for (MedicineBatch batch : availableBatches) {
                if (remaining == 0) {
                    break;
                }
                int allocatedQuantity = Math.min(remaining, batch.getQuantity());
                allocationPlans.add(new AllocationPlan(
                        item,
                        batch,
                        medicine.getMedicineCode(),
                        allocatedQuantity
                ));
                remaining -= allocatedQuantity;
            }
        }

        if (!shortages.isEmpty()) {
            throw new PrescriptionInsufficientStockException(prescriptionId, shortages);
        }

        return new AllocationComputation(allocationPlans, beforeEligibleQuantities);
    }

    private List<DispenseAllocationResult> applyAllocations(
            AllocationComputation computation,
            UUID actorId,
            Instant now
    ) {
        List<PrescriptionDispenseItem> dispenseItems = new ArrayList<>();
        List<StockMovement> stockMovements = new ArrayList<>();
        Map<UUID, Integer> medicineDeltas = new HashMap<>();
        List<DispenseAllocationResult> allocations = new ArrayList<>();

        for (AllocationPlan plan : computation.allocationPlans()) {
            MedicineBatch batch = plan.batch();
            int quantityBefore = batch.getQuantity();
            batch.deductStock(plan.allocatedQuantity(), now);
            try {
                medicineBatchRepository.deductStockQuantity(
                        batch.getId(),
                        plan.allocatedQuantity(),
                        batch.getStatus(),
                        now
                );
            } catch (ValidationException ex) {
                throw new PrescriptionAllocationInsufficientStockException(
                        plan.item().getPrescriptionId(),
                        plan.item(),
                        plan.medicineCode(),
                        quantityBefore
                );
            }

            dispenseItems.add(PrescriptionDispenseItem.create(
                    UUID.randomUUID(),
                    plan.item().getPrescriptionId(),
                    plan.item().getId(),
                    plan.item().getMedicineId(),
                    batch.getId(),
                    plan.allocatedQuantity(),
                    actorId,
                    now
            ));

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
                    "Dispensed for prescription item " + plan.item().getId()
            ));

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
                    batch.getQuantity()
            ));
        }

        prescriptionDispenseItemRepository.saveAll(dispenseItems);
        stockMovementRepository.saveAll(stockMovements);
        medicineDeltas.forEach(medicineRepository::updateStockQuantity);
        lowStockAlertTransitionService.handleEligibleStockTransitions(
                computation.beforeEligibleQuantities().keySet(),
                computation.beforeEligibleQuantities(),
                LocalDate.ofInstant(now, ZoneOffset.UTC),
                now
        );
        return allocations;
    }

    private record AllocationPlan(
            PrescriptionItem item,
            MedicineBatch batch,
            String medicineCode,
            int allocatedQuantity
    ) {
    }

    private record AllocationComputation(
            List<AllocationPlan> allocationPlans,
            Map<UUID, Integer> beforeEligibleQuantities
    ) {
    }
}
