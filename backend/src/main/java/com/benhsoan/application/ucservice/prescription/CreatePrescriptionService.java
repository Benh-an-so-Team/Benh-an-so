package com.benhsoan.application.ucservice.prescription;

import java.time.Instant;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.benhsoan.domain.auditlog.AuditLog;
import com.benhsoan.domain.auditlog.enums.ActionType;
import com.benhsoan.domain.auditlog.enums.ResourceType;
import com.benhsoan.domain.medicine.Medicine;
import com.benhsoan.domain.medicine.MedicineMaxDailyDoseMissingData;
import com.benhsoan.domain.prescription.Prescription;
import com.benhsoan.domain.prescription.PrescriptionItem;
import com.benhsoan.domain.prescription.PrescriptionWarningLog;
import com.benhsoan.domain.prescription.enums.WarningAction;
import com.benhsoan.domain.prescription.PrescriptionAllergyWarningLog;
import com.benhsoan.domain.prescription.PrescriptionContraindicationWarningLog;
import com.benhsoan.domain.prescription.MaxDailyDoseCalculator;
import com.benhsoan.domain.prescription.MaxDailyDoseEvaluationResult;
import com.benhsoan.domain.prescription.MaxDailyDoseMissingData;
import com.benhsoan.domain.prescription.MaxDailyDoseWarning;
import com.benhsoan.domain.prescription.PrescriptionMaxDailyDoseWarningLog;
import com.benhsoan.domain.prescription.exception.PrescriptionAllergyConfirmationRequiredException;
import com.benhsoan.domain.prescription.exception.PrescriptionContraindicationConfirmationRequiredException;
import com.benhsoan.domain.prescription.exception.PrescriptionContraindicationMissingDataException;
import com.benhsoan.domain.prescription.exception.ControlledMedicineConfirmationRequiredException;
import com.benhsoan.domain.prescription.exception.PrescriptionInteractionConfirmationRequiredException;
import com.benhsoan.domain.prescription.exception.PrescriptionInteractionConfirmationRequiredException.InteractionWarning;
import com.benhsoan.domain.prescription.exception.PrescriptionMaxDailyDoseConfirmationRequiredException;
import com.benhsoan.domain.shared.exception.ValidationException;
import com.benhsoan.port.dto.command.prescription.CheckDrugInteractionCommand;
import com.benhsoan.port.dto.command.prescription.CreatePrescriptionCommand;
import com.benhsoan.port.dto.command.prescription.CreatePrescriptionItemCommand;
import com.benhsoan.port.dto.command.prescription.PrescriptionCreationContext;
import com.benhsoan.port.dto.command.prescription.PrescriptionAllergyOverrideCommand;
import com.benhsoan.port.dto.command.prescription.PrescriptionContraindicationOverrideCommand;
import com.benhsoan.port.dto.command.prescription.PrescriptionInteractionOverrideCommand;
import com.benhsoan.port.dto.command.prescription.PrescriptionMaxDailyDoseOverrideCommand;
import com.benhsoan.port.dto.result.ContraindicationCheckResult;
import com.benhsoan.port.dto.result.ContraindicationWarningResult;
import com.benhsoan.port.dto.result.DrugInteractionWarningResult;
import com.benhsoan.port.dto.result.PatientAllergyWarningResult;
import com.benhsoan.port.dto.result.MaxDailyDoseMissingDataResult;
import com.benhsoan.port.dto.result.PrescriptionResult;
import com.benhsoan.port.inbound.prescription.CheckContraindicationUseCase;
import com.benhsoan.port.inbound.prescription.CheckDrugInteractionUseCase;
import com.benhsoan.port.inbound.prescription.CheckPatientDrugAllergyUseCase;
import com.benhsoan.port.inbound.prescription.CreatePrescriptionUseCase;
import com.benhsoan.port.outbound.generator.PrescriptionCodeGenerator;
import com.benhsoan.port.outbound.repository.audit.AuditLogRepository;
import com.benhsoan.port.outbound.repository.prescription.PrescriptionAllergyWarningLogRepository;
import com.benhsoan.port.outbound.repository.prescription.PrescriptionContraindicationWarningLogRepository;
import com.benhsoan.port.outbound.repository.prescription.PrescriptionMaxDailyDoseWarningLogRepository;
import com.benhsoan.port.outbound.repository.prescription.PrescriptionWarningLogRepository;
import com.benhsoan.port.outbound.repository.medicalrecord.MedicalRecordDiagnosisRepository;
import com.benhsoan.port.outbound.repository.medicine.MedicineMaxDailyDoseMissingDataRepository;
import com.benhsoan.port.outbound.repository.medicine.MedicineRepository;
import com.benhsoan.port.outbound.repository.prescription.PrescriptionRepository;
import com.benhsoan.port.outbound.security.CurrentUserPort;
import com.benhsoan.port.outbound.time.ClockPort;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
@Transactional
public class CreatePrescriptionService
        implements CreatePrescriptionUseCase {

    private final PrescriptionRepository prescriptionRepository;

    private final MedicineRepository medicineRepository;

    private final CheckDrugInteractionUseCase checkDrugInteractionUseCase;

    private final CheckPatientDrugAllergyUseCase checkPatientDrugAllergyUseCase;

    private final CheckContraindicationUseCase checkContraindicationUseCase;

    private final MedicalRecordDiagnosisRepository medicalRecordDiagnosisRepository;

    private final PrescriptionWarningLogRepository warningLogRepository;

    private final PrescriptionAllergyWarningLogRepository allergyWarningLogRepository;

    private final PrescriptionContraindicationWarningLogRepository contraindicationWarningLogRepository;

    private final PrescriptionMaxDailyDoseWarningLogRepository maxDailyDoseWarningLogRepository;

    private final MedicineMaxDailyDoseMissingDataRepository medicineMaxDailyDoseMissingDataRepository;

    private final PrescriptionCodeGenerator prescriptionCodeGenerator;

    private final CurrentUserPort currentUserPort;

    private final PrescriptionResultMapper resultMapper;

    private final PrescriptionDisplayContextResolver displayContextResolver;

    private final AuditLogRepository auditLogRepository;

    private final ClockPort clockPort;

    private final PrescriptionClinicalContextValidator clinicalContextValidator;

    @Override
    public PrescriptionResult create(
            CreatePrescriptionCommand command
    ) {
        requireCommand(command);
        authorizeDoctor();

        UUID currentUserId = currentUserPort.getCurrentUserId();
        Instant now = clockPort.now();

        validateMedicalRecord(command.medicalRecordId(), currentUserId, command.creationContext());
        List<CreatePrescriptionItemCommand> itemCommands
                = validateItemCommands(command.items());
        Map<UUID, Medicine> medicines = loadActiveMedicines(itemCommands);
        requireControlledMedicineConfirmation(medicines, command.controlledMedicineConfirmed());

        UUID prescriptionId = UUID.randomUUID();
        List<PrescriptionItem> items = createItems(
                prescriptionId,
                itemCommands,
                medicines,
                now
        );

        // Detect interactions with the V17 active-ingredient rule engine so the
        // save flow produces the same warnings as the real-time
        // POST /prescriptions/check-interactions endpoint.
        List<DrugInteractionWarningResult> interactions = checkDrugInteractionUseCase
                .check(new CheckDrugInteractionCommand(
                        List.copyOf(medicines.keySet())
                ));
        Map<UUID, String> overrideReasons = validateInteractionOverrides(
                interactions,
                command.interactionOverrides()
        );

        // Detect patient medication allergies (QTN-26, NCL-05-CN-004)
        List<PatientAllergyWarningResult> allergyWarnings = checkPatientDrugAllergyUseCase
                .check(command.medicalRecordId(), List.copyOf(medicines.keySet()));
        Map<AllergyKey, String> allergyOverrideReasons = validateAllergyOverrides(
                allergyWarnings,
                command.allergyOverrides()
        );

        // Detect contraindication warnings by age, pregnancy and chronic disease
        // (QTN-34, NCL-05-CN-006). Block completion unless every warning is overridden,
        // and reject creation when required patient data is missing (TC-05).
        ContraindicationCheckResult contraindicationCheck = checkContraindicationUseCase
                .check(command.medicalRecordId(), List.copyOf(medicines.keySet()));
        List<ContraindicationWarningResult> contraindicationWarnings = contraindicationCheck.warnings();
        if (!contraindicationCheck.missingData().isEmpty()) {
            throw new PrescriptionContraindicationMissingDataException();
        }
        Map<ContraKey, String> contraindicationOverrideReasons = validateContraindicationOverrides(
                contraindicationWarnings,
                command.contraindicationOverrides()
        );

        // NCL-05-CN-007: total daily active-ingredient dose check (mg/day). Missing
        // configuration is reported as missing data (never zero, never a block);
        // exceedances must be confirmed with an override reason.
        MaxDailyDoseEvaluationResult maxDoseCheck = MaxDailyDoseCalculator.evaluate(
                itemCommands.stream()
                        .map(cmd -> toDoseItem(cmd, medicines.get(cmd.medicineId())))
                        .toList()
        );
        Map<String, String> maxDoseOverrideReasons = validateMaxDailyDoseOverrides(
                maxDoseCheck.warnings(),
                command.maxDailyDoseOverrides()
        );

        // Resolve the display context once so the save flow and the result mapping do
        // not trigger duplicate database lookups.
        PrescriptionDisplayContextResolver.PrescriptionDisplayContext displayContext =
                displayContextResolver.resolve(command.medicalRecordId(), currentUserId);

        Prescription prescription = Prescription.create(
                prescriptionId,
                prescriptionCodeGenerator.generate(),
                command.medicalRecordId(),
                command.note(),
                currentUserId,
                now,
                items
        );

        Prescription saved = prescriptionRepository.save(prescription);
        List<PrescriptionWarningLog> warningLogs = saveWarningLogs(
                saved.getId(),
                interactions,
                overrideReasons,
                currentUserId,
                now
        );
        List<PrescriptionAllergyWarningLog> allergyLogs = saveAllergyWarningLogs(
                saved.getId(),
                allergyWarnings,
                allergyOverrideReasons,
                currentUserId,
                now
        );

        saveContraindicationWarningLogs(
                saved.getId(),
                contraindicationWarnings,
                contraindicationOverrideReasons,
                currentUserId,
                now
        );

        saveMaxDailyDoseWarningLogs(
                saved.getId(),
                displayContext.patientId(),
                maxDoseCheck.warnings(),
                maxDoseOverrideReasons,
                currentUserId,
                now
        );

        recordMissingMaxDailyDoseData(medicines, now);

        saveAuditLog(saved,
                warningLogs.size()
                        + allergyLogs.size()
                        + contraindicationWarnings.size()
                        + maxDoseCheck.warnings().size(),
                currentUserId,
                now);

        return resultMapper.toResult(
                saved,
                warningLogs,
                toMissingDataResults(maxDoseCheck.missingData()),
                displayContext
        );
    }

    private void authorizeDoctor() {
        if (!currentUserPort.hasRole("DOCTOR")) {
            throw new AccessDeniedException(
                    "Only doctors are allowed to create prescriptions."
            );
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

    private void validateMedicalRecord(
            UUID medicalRecordId,
            UUID doctorId,
            PrescriptionCreationContext creationContext
    ) {
        if (creationContext == PrescriptionCreationContext.REPLACEMENT) {
            clinicalContextValidator.requireRecordForPrescriptionReplacement(
                    medicalRecordId,
                    doctorId
            );
        } else {
            clinicalContextValidator.requireEditableRecordForDoctor(
                    medicalRecordId,
                    doctorId
            );
        }

        if (!medicalRecordDiagnosisRepository
                .existsByMedicalRecordId(medicalRecordId)) {
            throw new ValidationException(
                    "A diagnosis is required before creating a prescription."
            );
        }
    }

    private List<CreatePrescriptionItemCommand> validateItemCommands(
            List<CreatePrescriptionItemCommand> itemCommands
    ) {
        if (itemCommands == null || itemCommands.isEmpty()) {
            throw new ValidationException(
                    "A prescription must contain at least one medicine."
            );
        }

        Set<UUID> medicineIds = new HashSet<>();
        for (CreatePrescriptionItemCommand item : itemCommands) {
            if (item == null || item.medicineId() == null) {
                throw new ValidationException("Medicine id is required.");
            }
            if (!medicineIds.add(item.medicineId())) {
                throw new ValidationException(
                        "Duplicate medicine in prescription: "
                                + item.medicineId()
                );
            }
        }

        return List.copyOf(itemCommands);
    }

    private Map<UUID, Medicine> loadActiveMedicines(
            List<CreatePrescriptionItemCommand> itemCommands
    ) {
        Map<UUID, Medicine> foundById = medicineRepository
                .findAllById(itemCommands.stream()
                        .map(CreatePrescriptionItemCommand::medicineId)
                        .toList())
                .stream()
                .collect(Collectors.toMap(
                        Medicine::getId,
                        medicine -> medicine
                ));

        Map<UUID, Medicine> medicines = new LinkedHashMap<>();
        for (CreatePrescriptionItemCommand item : itemCommands) {
            Medicine medicine = foundById.get(item.medicineId());
            if (medicine == null) {
                throw new ValidationException(
                        "Medicine not found: " + item.medicineId()
                );
            }

            if (!medicine.isActive()) {
                throw new ValidationException(
                        "Inactive medicine cannot be prescribed: "
                                + medicine.getId()
                );
            }

            medicines.put(medicine.getId(), medicine);
        }

        return medicines;
    }

    private List<PrescriptionItem> createItems(
            UUID prescriptionId,
            List<CreatePrescriptionItemCommand> itemCommands,
            Map<UUID, Medicine> medicines,
            Instant createdAt
    ) {
        return itemCommands.stream()
                .map(command -> {
                    Medicine medicine = medicines.get(command.medicineId());

                    return PrescriptionItem.create(
                            UUID.randomUUID(),
                            prescriptionId,
                            medicine.getId(),
                            medicine.getMedicineName(),
                            medicine.getActiveIngredient(),
                            medicine.getStrength(),
                            medicine.getUnit(),
                            command.dosage(),
                            command.frequency(),
                            command.route(),
                            command.durationDays(),
                            command.quantity(),
                            command.instructions(),
                            command.singleDoseQuantity(),
                            createdAt
                    );
                })
                .toList();
    }

    private Map<UUID, String> validateInteractionOverrides(
            List<DrugInteractionWarningResult> interactions,
            List<PrescriptionInteractionOverrideCommand> overrideCommands
    ) {
        List<PrescriptionInteractionOverrideCommand> safeOverrideCommands
                = overrideCommands == null ? List.of() : overrideCommands;
        Map<UUID, String> reasonsByRuleId = new HashMap<>();

        for (PrescriptionInteractionOverrideCommand override : safeOverrideCommands) {
            if (override == null || override.ruleId() == null) {
                throw new ValidationException(
                        "Interaction rule id is required for an override."
                );
            }
            if (override.overrideReason() == null
                    || override.overrideReason().isBlank()) {
                throw new ValidationException(
                        "Override reason is required for interaction rule: "
                                + override.ruleId()
                );
            }
            if (reasonsByRuleId.put(
                    override.ruleId(),
                    override.overrideReason().trim()
            ) != null) {
                throw new ValidationException(
                        "Duplicate override for interaction rule: "
                                + override.ruleId()
                );
            }
        }

        Set<UUID> detectedRuleIds = interactions.stream()
                .map(DrugInteractionWarningResult::ruleId)
                .collect(java.util.stream.Collectors.toSet());

        for (UUID suppliedRuleId : reasonsByRuleId.keySet()) {
            if (!detectedRuleIds.contains(suppliedRuleId)) {
                throw new ValidationException(
                        "Override does not belong to a detected interaction: "
                                + suppliedRuleId
                );
            }
        }

        List<DrugInteractionWarningResult> unconfirmed = interactions.stream()
                .filter(warning -> !reasonsByRuleId
                        .containsKey(warning.ruleId()))
                .toList();

        if (!unconfirmed.isEmpty()) {
            throw new PrescriptionInteractionConfirmationRequiredException(
                    unconfirmed.stream()
                            .map(this::toInteractionWarning)
                            .toList()
            );
        }

        return Map.copyOf(reasonsByRuleId);
    }

    private InteractionWarning toInteractionWarning(
            DrugInteractionWarningResult warning
    ) {
        return new InteractionWarning(
                warning.ruleId(),
                warning.drugIdA(),
                warning.drugIdB(),
                warning.severity(),
                warning.description(),
                warning.clinicalRecommendation()
        );
    }

    private List<PrescriptionWarningLog> saveWarningLogs(
            UUID prescriptionId,
            List<DrugInteractionWarningResult> interactions,
            Map<UUID, String> overrideReasons,
            UUID handledBy,
            Instant handledAt
    ) {
        return interactions.stream()
                .map(warning -> warningLogRepository.save(
                        PrescriptionWarningLog.create(
                                UUID.randomUUID(),
                                prescriptionId,
                                warning.ruleId(),
                                warning.drugIdA(),
                                warning.drugIdB(),
                                warning.severity(),
                                warning.description(),
                                WarningAction.OVERRIDDEN,
                                overrideReasons.get(warning.ruleId()),
                                handledBy,
                                handledAt,
                                handledAt
                        )
                ))
                .toList();
    }

    private void saveAuditLog(
            Prescription prescription,
            int warningOverrideCount,
            UUID currentUserId,
            Instant issuedAt
    ) {
        auditLogRepository.save(
                AuditLog.create(
                        currentUserId,
                        ActionType.CREATE,
                        ResourceType.PRESCRIPTION,
                        prescription.getId(),
                        """
                        {
                        "prescriptionCode":"%s",
                        "medicalRecordId":"%s",
                        "itemCount":%d,
                        "warningOverrideCount":%d
                        }
                        """.formatted(
                                prescription.getPrescriptionCode(),
                                prescription.getMedicalRecordId(),
                                prescription.getItems().size(),
                                warningOverrideCount
                        ),
                        null,
                        issuedAt
                )
        );
    }

    private Map<AllergyKey, String> validateAllergyOverrides(
            List<PatientAllergyWarningResult> allergyWarnings,
            List<PrescriptionAllergyOverrideCommand> overrideCommands
    ) {
        List<PrescriptionAllergyOverrideCommand> safeOverrideCommands
                = overrideCommands == null ? List.of() : overrideCommands;
        Map<AllergyKey, String> reasonsByKey = new HashMap<>();

        for (PrescriptionAllergyOverrideCommand override : safeOverrideCommands) {
            if (override == null || override.allergyId() == null || override.medicineId() == null) {
                throw new ValidationException(
                        "Allergy ID and medicine ID are required for an allergy override."
                );
            }
            if (override.overrideReason() == null || override.overrideReason().isBlank()) {
                throw new ValidationException(
                        "Override reason is required for medication allergy: " + override.allergyId()
                );
            }
            AllergyKey key = new AllergyKey(override.allergyId(), override.medicineId());
            if (reasonsByKey.put(key, override.overrideReason().trim()) != null) {
                throw new ValidationException(
                        "Duplicate override for medication allergy: " + override.allergyId()
                );
            }
        }

        Set<AllergyKey> detectedKeys = allergyWarnings.stream()
                .map(w -> new AllergyKey(w.allergyId(), w.medicineId()))
                .collect(Collectors.toSet());

        for (AllergyKey suppliedKey : reasonsByKey.keySet()) {
            if (!detectedKeys.contains(suppliedKey)) {
                throw new ValidationException(
                        "Override does not belong to a detected medication allergy: "
                                + suppliedKey.allergyId()
                );
            }
        }

        List<PatientAllergyWarningResult> unconfirmed = allergyWarnings.stream()
                .filter(warning -> !reasonsByKey.containsKey(new AllergyKey(warning.allergyId(), warning.medicineId())))
                .toList();

        if (!unconfirmed.isEmpty()) {
            throw new PrescriptionAllergyConfirmationRequiredException(
                    unconfirmed.stream()
                            .map(this::toAllergyWarning)
                            .toList()
            );
        }

        return Map.copyOf(reasonsByKey);
    }

    private PrescriptionAllergyConfirmationRequiredException.AllergyWarning toAllergyWarning(
            PatientAllergyWarningResult warning
    ) {
        return new PrescriptionAllergyConfirmationRequiredException.AllergyWarning(
                warning.allergyId(),
                warning.patientId(),
                warning.medicineId(),
                warning.medicineName(),
                warning.activeIngredient(),
                warning.allergenName(),
                warning.severity(),
                warning.reaction()
        );
    }

    private List<PrescriptionAllergyWarningLog> saveAllergyWarningLogs(
            UUID prescriptionId,
            List<PatientAllergyWarningResult> allergyWarnings,
            Map<AllergyKey, String> overrideReasons,
            UUID handledBy,
            Instant handledAt
    ) {
        return allergyWarnings.stream()
                .map(warning -> allergyWarningLogRepository.save(
                        PrescriptionAllergyWarningLog.create(
                                UUID.randomUUID(),
                                prescriptionId,
                                warning.patientId(),
                                warning.allergyId(),
                                warning.medicineId(),
                                warning.activeIngredient(),
                                warning.allergenName(),
                                warning.severity(),
                                warning.reaction(),
                                overrideReasons.get(new AllergyKey(warning.allergyId(), warning.medicineId())),
                                handledBy,
                                handledAt,
                                handledAt
                        )
                ))
                .toList();
    }

    private record AllergyKey(UUID allergyId, UUID medicineId) {
    }

    private Map<ContraKey, String> validateContraindicationOverrides(
            List<ContraindicationWarningResult> warnings,
            List<PrescriptionContraindicationOverrideCommand> overrides
    ) {
        List<PrescriptionContraindicationOverrideCommand> cleanOverrides =
                overrides == null ? List.of() : overrides;

        Map<ContraKey, String> reasonsByKey = new LinkedHashMap<>();
        for (PrescriptionContraindicationOverrideCommand override : cleanOverrides) {
            if (override == null || override.ruleId() == null || override.medicineId() == null) {
                throw new ValidationException(
                        "Contraindication override must reference a rule and a medicine.");
            }
            if (override.overrideReason() == null || override.overrideReason().isBlank()) {
                throw new ValidationException("Contraindication override reason is required.");
            }
            ContraKey key = new ContraKey(override.ruleId(), override.medicineId());
            if (reasonsByKey.put(key, override.overrideReason().trim()) != null) {
                throw new ValidationException("Duplicate contraindication override.");
            }
        }

        Set<ContraKey> detectedKeys = warnings.stream()
                .map(w -> new ContraKey(w.ruleId(), w.medicineId()))
                .collect(Collectors.toSet());

        for (ContraKey suppliedKey : reasonsByKey.keySet()) {
            if (!detectedKeys.contains(suppliedKey)) {
                throw new ValidationException(
                        "Override does not belong to a detected contraindication: " + suppliedKey.ruleId());
            }
        }

        List<ContraindicationWarningResult> unconfirmed = warnings.stream()
                .filter(w -> !reasonsByKey.containsKey(new ContraKey(w.ruleId(), w.medicineId())))
                .toList();

        if (!unconfirmed.isEmpty()) {
            throw new PrescriptionContraindicationConfirmationRequiredException();
        }

        return Map.copyOf(reasonsByKey);
    }

    private void saveContraindicationWarningLogs(
            UUID prescriptionId,
            List<ContraindicationWarningResult> warnings,
            Map<ContraKey, String> overrideReasons,
            UUID handledBy,
            Instant handledAt
    ) {
        for (ContraindicationWarningResult warning : warnings) {
            contraindicationWarningLogRepository.save(PrescriptionContraindicationWarningLog.create(
                    UUID.randomUUID(),
                    prescriptionId,
                    warning.patientId(),
                    warning.ruleId(),
                    warning.medicineId(),
                    warning.type(),
                    warning.severity(),
                    warning.message(),
                    warning.recommendation(),
                    overrideReasons.get(new ContraKey(warning.ruleId(), warning.medicineId())),
                    handledBy,
                    handledAt
            ));
        }
    }

    private record ContraKey(UUID ruleId, UUID medicineId) {
    }

    private MaxDailyDoseCalculator.Item toDoseItem(
            CreatePrescriptionItemCommand command,
            Medicine medicine
    ) {
        return new MaxDailyDoseCalculator.Item(
                medicine.getActiveIngredient(),
                medicine.getStrengthValueMg(),
                command.singleDoseQuantity(),
                command.frequency() == null ? 0 : command.frequency(),
                medicine.getMaxDailyDoseMg()
        );
    }

    private Map<String, String> validateMaxDailyDoseOverrides(
            List<MaxDailyDoseWarning> warnings,
            List<PrescriptionMaxDailyDoseOverrideCommand> overrides
    ) {
        List<PrescriptionMaxDailyDoseOverrideCommand> cleanOverrides =
                overrides == null ? List.of() : overrides;

        Map<String, String> reasonsByIngredient = new LinkedHashMap<>();
        for (PrescriptionMaxDailyDoseOverrideCommand override : cleanOverrides) {
            if (override == null
                    || override.activeIngredient() == null
                    || override.activeIngredient().isBlank()) {
                throw new ValidationException(
                        "Max daily dose override must reference an active ingredient.");
            }
            if (override.overrideReason() == null || override.overrideReason().isBlank()) {
                throw new ValidationException(
                        "Max daily dose override reason is required.");
            }
            String key = normalizeIngredient(override.activeIngredient());
            if (reasonsByIngredient.put(key, override.overrideReason().trim()) != null) {
                throw new ValidationException("Duplicate max daily dose override.");
            }
        }

        Set<String> detectedKeys = warnings.stream()
                .map(w -> normalizeIngredient(w.activeIngredient()))
                .collect(Collectors.toSet());

        for (String suppliedKey : reasonsByIngredient.keySet()) {
            if (!detectedKeys.contains(suppliedKey)) {
                throw new ValidationException(
                        "Override does not belong to a detected max daily dose warning: "
                                + suppliedKey);
            }
        }

        boolean unconfirmed = warnings.stream()
                .anyMatch(w -> !reasonsByIngredient.containsKey(
                        normalizeIngredient(w.activeIngredient())));
        if (unconfirmed) {
            throw new PrescriptionMaxDailyDoseConfirmationRequiredException(warnings);
        }

        return Map.copyOf(reasonsByIngredient);
    }

    private void saveMaxDailyDoseWarningLogs(
            UUID prescriptionId,
            UUID patientId,
            List<MaxDailyDoseWarning> warnings,
            Map<String, String> overrideReasons,
            UUID handledBy,
            Instant handledAt
    ) {
        for (MaxDailyDoseWarning warning : warnings) {
            maxDailyDoseWarningLogRepository.save(PrescriptionMaxDailyDoseWarningLog.create(
                    UUID.randomUUID(),
                    prescriptionId,
                    patientId,
                    warning.activeIngredient(),
                    warning.totalDailyDoseMg(),
                    warning.maxDailyDoseMg(),
                    overrideReasons.get(normalizeIngredient(warning.activeIngredient())),
                    handledBy,
                    handledAt
            ));
        }
    }

    private void recordMissingMaxDailyDoseData(
            Map<UUID, Medicine> medicines,
            Instant detectedAt
    ) {
        for (Medicine medicine : medicines.values()) {
            if (medicine.getMaxDailyDoseMg() == null) {
                medicineMaxDailyDoseMissingDataRepository.record(
                        medicine.getId(),
                        medicine.getActiveIngredient(),
                        MedicineMaxDailyDoseMissingData.REASON_MAX_DAILY_DOSE,
                        detectedAt
                );
            }
            if (medicine.getStrengthValueMg() == null) {
                medicineMaxDailyDoseMissingDataRepository.record(
                        medicine.getId(),
                        medicine.getActiveIngredient(),
                        MedicineMaxDailyDoseMissingData.REASON_STRENGTH_VALUE,
                        detectedAt
                );
            }
        }
    }

    private List<MaxDailyDoseMissingDataResult> toMissingDataResults(
            List<MaxDailyDoseMissingData> missingData
    ) {
        return missingData.stream()
                .map(data -> new MaxDailyDoseMissingDataResult(
                        data.activeIngredient(),
                        data.reason()
                ))
                .toList();
    }

    private static String normalizeIngredient(String activeIngredient) {
        return activeIngredient == null
                ? ""
                : activeIngredient.trim().toLowerCase(java.util.Locale.ROOT);
    }

    private void requireCommand(CreatePrescriptionCommand command) {
        if (command == null) {
            throw new ValidationException(
                    "Create prescription command is required."
            );
        }
    }
}
