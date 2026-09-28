package com.benhsoan.adapter.inbound.rest.mapper;

import java.util.List;
import java.util.UUID;

import com.benhsoan.application.ucservice.anonymization.AnonymizationModeState;
import org.springframework.stereotype.Component;

import com.benhsoan.adapter.inbound.rest.request.prescription.AmendPrescriptionItemRequest;
import com.benhsoan.adapter.inbound.rest.request.prescription.AmendPrescriptionRequest;
import com.benhsoan.adapter.inbound.rest.request.prescription.CancelPrescriptionRequest;
import com.benhsoan.adapter.inbound.rest.request.prescription.CheckDrugInteractionRequest;
import com.benhsoan.adapter.inbound.rest.request.prescription.CheckMaxDailyDoseRequest;
import com.benhsoan.adapter.inbound.rest.request.prescription.CreatePrescriptionItemRequest;
import com.benhsoan.adapter.inbound.rest.request.prescription.CreatePrescriptionRequest;
import com.benhsoan.adapter.inbound.rest.request.prescription.DispenseItemRequest;
import com.benhsoan.adapter.inbound.rest.request.prescription.DispensePrescriptionRequest;
import com.benhsoan.adapter.inbound.rest.request.prescription.PartialDispensePrescriptionRequest;
import com.benhsoan.adapter.inbound.rest.request.prescription.ReturnMedicationItemRequest;
import com.benhsoan.adapter.inbound.rest.request.prescription.ReturnMedicationRequest;
import com.benhsoan.adapter.inbound.rest.request.prescription.PrescriptionInteractionOverrideRequest;
import com.benhsoan.adapter.inbound.rest.response.prescription.ContraindicationCheckResponse;
import com.benhsoan.adapter.inbound.rest.response.prescription.ContraindicationMissingDataResponse;
import com.benhsoan.adapter.inbound.rest.response.prescription.ContraindicationWarningResponse;
import com.benhsoan.adapter.inbound.rest.response.prescription.DrugInteractionWarningResponse;
import com.benhsoan.adapter.inbound.rest.response.prescription.DispenseAllocationResponse;
import com.benhsoan.adapter.inbound.rest.response.prescription.DispenseHistoryResponse;
import com.benhsoan.adapter.inbound.rest.response.prescription.DispenseItemSummaryResponse;
import com.benhsoan.adapter.inbound.rest.response.prescription.DispensePrescriptionResponse;
import com.benhsoan.adapter.inbound.rest.response.prescription.DispenseSuggestionBatchResponse;
import com.benhsoan.adapter.inbound.rest.response.prescription.DispenseSuggestionItemResponse;
import com.benhsoan.adapter.inbound.rest.response.prescription.DispenseSuggestionResponse;
import com.benhsoan.adapter.inbound.rest.response.prescription.PartialDispensePrescriptionResponse;
import com.benhsoan.adapter.inbound.rest.response.prescription.PrescriptionItemResponse;
import com.benhsoan.adapter.inbound.rest.response.prescription.PrescriptionResponse;
import com.benhsoan.adapter.inbound.rest.response.prescription.PrescriptionWarningResponse;
import com.benhsoan.adapter.inbound.rest.response.prescription.ReturnMedicationResponse;
import com.benhsoan.adapter.inbound.rest.response.prescription.ReturnedMedicationItemResponse;
import com.benhsoan.domain.patient.PatientAnonymizer;
import com.benhsoan.port.dto.command.prescription.AmendPrescriptionCommand;
import com.benhsoan.port.dto.command.prescription.AmendPrescriptionItemCommand;
import com.benhsoan.port.dto.command.prescription.CancelPrescriptionCommand;
import com.benhsoan.port.dto.command.prescription.CheckDrugInteractionCommand;
import com.benhsoan.port.dto.command.prescription.CheckMaxDailyDoseCommand;
import com.benhsoan.port.dto.command.prescription.CheckMaxDailyDoseItemCommand;
import com.benhsoan.port.dto.command.prescription.CreatePrescriptionCommand;
import com.benhsoan.port.dto.command.prescription.CreatePrescriptionItemCommand;
import com.benhsoan.port.dto.command.prescription.DispenseItemCommand;
import com.benhsoan.port.dto.command.prescription.DispensePrescriptionCommand;
import com.benhsoan.port.dto.command.prescription.DispensePrescriptionItemsCommand;
import com.benhsoan.port.dto.command.prescription.PrescriptionInteractionOverrideCommand;
import com.benhsoan.port.dto.command.prescription.ReturnMedicationCommand;
import com.benhsoan.port.dto.command.prescription.ReturnMedicationItemCommand;
import com.benhsoan.port.dto.result.ContraindicationCheckResult;
import com.benhsoan.port.dto.result.ContraindicationMissingDataResult;
import com.benhsoan.port.dto.result.ContraindicationWarningResult;
import com.benhsoan.port.dto.result.DrugInteractionWarningResult;
import com.benhsoan.port.dto.result.DispenseAllocationResult;
import com.benhsoan.port.dto.result.DispenseItemSummaryResult;
import com.benhsoan.port.dto.result.DispensePrescriptionResult;
import com.benhsoan.port.dto.result.DispenseSuggestionBatchResult;
import com.benhsoan.port.dto.result.DispenseSuggestionItemResult;
import com.benhsoan.port.dto.result.DispenseSuggestionResult;
import com.benhsoan.port.dto.result.PartialDispensePrescriptionResult;
import com.benhsoan.port.dto.result.PrescriptionDispenseHistoryResult;
import com.benhsoan.port.dto.result.PrescriptionItemResult;
import com.benhsoan.port.dto.result.PrescriptionResult;
import com.benhsoan.port.dto.result.PrescriptionWarningResult;
import com.benhsoan.port.dto.result.ReturnMedicationResult;
import com.benhsoan.port.dto.result.ReturnedMedicationItemResult;

import com.benhsoan.adapter.inbound.rest.request.prescription.PrescriptionAllergyOverrideRequest;
import com.benhsoan.adapter.inbound.rest.request.prescription.PrescriptionContraindicationOverrideRequest;
import com.benhsoan.adapter.inbound.rest.request.prescription.PrescriptionMaxDailyDoseOverrideRequest;
import com.benhsoan.adapter.inbound.rest.response.prescription.MaxDailyDoseMissingDataResponse;
import com.benhsoan.adapter.inbound.rest.response.prescription.MaxDailyDoseCheckResponse;
import com.benhsoan.adapter.inbound.rest.response.prescription.MaxDailyDoseWarningResponse;
import com.benhsoan.adapter.inbound.rest.response.prescription.PatientAllergyWarningResponse;
import com.benhsoan.adapter.inbound.rest.response.prescription.PrescriptionAllergyWarningLogResponse;
import com.benhsoan.port.dto.command.prescription.PrescriptionAllergyOverrideCommand;
import com.benhsoan.port.dto.command.prescription.PrescriptionContraindicationOverrideCommand;
import com.benhsoan.port.dto.command.prescription.PrescriptionMaxDailyDoseOverrideCommand;
import com.benhsoan.port.dto.result.PatientAllergyWarningResult;
import com.benhsoan.port.dto.result.MaxDailyDoseCheckResult;
import com.benhsoan.port.dto.result.MaxDailyDoseMissingDataResult;
import com.benhsoan.port.dto.result.MaxDailyDoseWarningResult;
import com.benhsoan.port.dto.result.PrescriptionAllergyWarningLogResult;
import com.benhsoan.adapter.inbound.rest.request.prescription.ReplacePrescriptionRequest;
import com.benhsoan.adapter.inbound.rest.response.prescription.PrescriptionReplacementResponse;
import com.benhsoan.port.dto.command.prescription.ReplacePrescriptionCommand;
import com.benhsoan.port.dto.result.PrescriptionReplacementResult;

@Component
public class PrescriptionRestMapper {

    private final AnonymizationModeState anonymizationModeState;

    public PrescriptionRestMapper(
            AnonymizationModeState anonymizationModeState) {
        this.anonymizationModeState = anonymizationModeState;
    }

    public AmendPrescriptionCommand toCommand(
            UUID prescriptionId,
            AmendPrescriptionRequest request
    ) {
        List<PrescriptionInteractionOverrideCommand> interactionOverrides
                = request.interactionOverrides() == null
                        ? List.of()
                        : request.interactionOverrides()
                                .stream()
                                .map(this::toCommand)
                                .toList();

        List<PrescriptionAllergyOverrideCommand> allergyOverrides
                = request.allergyOverrides() == null
                        ? List.of()
                        : request.allergyOverrides()
                                .stream()
                                .map(this::toCommand)
                                .toList();

        List<PrescriptionMaxDailyDoseOverrideCommand> maxDailyDoseOverrides
                = request.maxDailyDoseOverrides() == null
                        ? List.of()
                        : request.maxDailyDoseOverrides()
                                .stream()
                                .map(this::toCommand)
                                .toList();

        return AmendPrescriptionCommand.builder()
                .prescriptionId(prescriptionId)
                .note(request.note())
                .changeReason(request.changeReason())
                .items(request.items()
                        .stream()
                        .map(this::toCommand)
                        .toList())
                .interactionOverrides(interactionOverrides)
                .allergyOverrides(allergyOverrides)
                .maxDailyDoseOverrides(maxDailyDoseOverrides)
                .controlledMedicineConfirmed(request.controlledMedicineConfirmed())
                .build();
    }

    public CreatePrescriptionCommand toCommand(
            CreatePrescriptionRequest request
    ) {
        List<PrescriptionInteractionOverrideCommand> interactionOverrides
                = request.interactionOverrides() == null
                        ? List.of()
                        : request.interactionOverrides()
                                .stream()
                                .map(this::toCommand)
                                .toList();

        List<PrescriptionAllergyOverrideCommand> allergyOverrides
                = request.allergyOverrides() == null
                        ? List.of()
                        : request.allergyOverrides()
                                .stream()
                                .map(this::toCommand)
                                .toList();

        List<PrescriptionContraindicationOverrideCommand> contraindicationOverrides
                = request.contraindicationOverrides() == null
                        ? List.of()
                        : request.contraindicationOverrides()
                                .stream()
                                .map(this::toCommand)
                                .toList();

        List<PrescriptionMaxDailyDoseOverrideCommand> maxDailyDoseOverrides
                = request.maxDailyDoseOverrides() == null
                        ? List.of()
                        : request.maxDailyDoseOverrides()
                                .stream()
                                .map(this::toCommand)
                                .toList();

        return CreatePrescriptionCommand.builder()
                .medicalRecordId(request.medicalRecordId())
                .note(request.note())
                .items(request.items()
                        .stream()
                        .map(this::toCommand)
                        .toList())
                .interactionOverrides(interactionOverrides)
                .allergyOverrides(allergyOverrides)
                .contraindicationOverrides(contraindicationOverrides)
                .maxDailyDoseOverrides(maxDailyDoseOverrides)
                .controlledMedicineConfirmed(request.controlledMedicineConfirmed())
                .build();
    }

    public ReplacePrescriptionCommand toReplacementCommand(
            UUID originalPrescriptionId,
            ReplacePrescriptionRequest request
    ) {
        return new ReplacePrescriptionCommand(
                originalPrescriptionId,
                request.replacementReason(),
                toCommand(new CreatePrescriptionRequest(
                        null,
                        request.note(),
                        request.items(),
                        request.interactionOverrides(),
                        request.allergyOverrides(),
                        request.contraindicationOverrides(),
                        request.maxDailyDoseOverrides(),
                        request.controlledMedicineConfirmed()
                ))
        );
    }

    public PrescriptionReplacementResponse toResponse(PrescriptionReplacementResult result) {
        return new PrescriptionReplacementResponse(
                toResponse(result.originalPrescription()),
                toResponse(result.replacementPrescription()),
                result.interconnection()
        );
    }

    public CancelPrescriptionCommand toCommand(
            UUID prescriptionId,
            CancelPrescriptionRequest request
    ) {
        return new CancelPrescriptionCommand(
                prescriptionId,
                request != null ? request.cancelReason() : null
        );
    }

    public CheckDrugInteractionCommand toCommand(
            CheckDrugInteractionRequest request
    ) {
        return new CheckDrugInteractionCommand(request.drugIds());
    }

    public PrescriptionResponse toResponse(
            PrescriptionResult result
    ) {
        return PrescriptionResponse.builder()
                .id(result.id())
                .prescriptionCode(result.prescriptionCode())
                .medicalRecordId(result.medicalRecordId())
                .visitId(result.visitId())
                .visitCode(result.visitCode())
                .patientId(result.patientId())
                .patientCode(result.patientCode())
                .patientName(anonymizationModeState.isEnabled() ? PatientAnonymizer.maskFullName(result.patientCode()) : result.patientName())
                .status(result.status())
                .note(result.note())
                .cancelReason(result.cancelReason())
                .prescribedBy(result.prescribedBy())
                .doctorName(result.doctorName())
                .prescribedAt(result.prescribedAt())
                .updatedBy(result.updatedBy())
                .updatedAt(result.updatedAt())
                .items(result.items()
                        .stream()
                        .map(this::toResponse)
                        .toList())
                .warnings(result.warnings()
                        .stream()
                        .map(this::toResponse)
                        .toList())
                .maxDailyDoseMissingData(result.maxDailyDoseMissingData() == null
                        ? List.of()
                        : result.maxDailyDoseMissingData()
                                .stream()
                                .map(this::toResponse)
                                .toList())
                .replacesPrescriptionId(result.replacesPrescriptionId())
                .replacesPrescriptionCode(result.replacesPrescriptionCode())
                .replacementReason(result.replacementReason())
                .replacedByPrescriptionId(result.replacedByPrescriptionId())
                .replacedByPrescriptionCode(result.replacedByPrescriptionCode())
                .build();
    }

    public List<DrugInteractionWarningResponse> toResponse(
            List<DrugInteractionWarningResult> results
    ) {
        return results.stream().map(this::toResponse).toList();
    }

    public DispensePrescriptionResponse toResponse(
            DispensePrescriptionResult result
    ) {
        return new DispensePrescriptionResponse(
                toResponse(result.prescription()),
                result.dispensedBy(),
                result.dispensedAt(),
                result.allocationCount(),
                result.totalDispensedQuantity(),
                result.allocations()
                        .stream()
                        .map(this::toResponse)
                        .toList()
        );
    }

    public DispensePrescriptionCommand toCommand(
            UUID prescriptionId,
            DispensePrescriptionRequest request
    ) {
        return new DispensePrescriptionCommand(
                prescriptionId,
                request != null && request.controlledMedicineConfirmed()
        );
    }

    public DispensePrescriptionItemsCommand toCommand(
            UUID prescriptionId,
            PartialDispensePrescriptionRequest request
    ) {
        List<DispenseItemCommand> items = request == null || request.items() == null
                ? List.of()
                : request.items().stream()
                        .map(this::toCommand)
                        .toList();
        boolean controlledMedicineConfirmed = request != null && request.controlledMedicineConfirmed();
        return new DispensePrescriptionItemsCommand(
                prescriptionId,
                items,
                controlledMedicineConfirmed
        );
    }

    private DispenseItemCommand toCommand(DispenseItemRequest request) {
        return new DispenseItemCommand(
                request.prescriptionItemId(),
                request.quantity(),
                request.batchId(),
                request.batchChangeReason());
    }

    public PartialDispensePrescriptionResponse toResponse(
            PartialDispensePrescriptionResult result
    ) {
        return new PartialDispensePrescriptionResponse(
                toResponse(result.prescription()),
                result.dispensedBy(),
                result.dispensedAt(),
                result.items().stream().map(this::toResponse).toList(),
                result.allocations().stream().map(this::toResponse).toList()
        );
    }

    public DispenseItemSummaryResponse toResponse(DispenseItemSummaryResult result) {
        return new DispenseItemSummaryResponse(
                result.prescriptionItemId(),
                result.medicineId(),
                result.medicineCode(),
                result.medicineName(),
                result.unit(),
                result.prescribedQuantity(),
                result.dispensedQuantity(),
                result.remainingQuantity());
    }

    public List<DispenseHistoryResponse> toDispenseHistoryResponse(
            List<PrescriptionDispenseHistoryResult> results
    ) {
        if (results == null) {
            return List.of();
        }
        return results.stream().map(this::toResponse).toList();
    }

    public DispenseHistoryResponse toResponse(PrescriptionDispenseHistoryResult result) {
        return new DispenseHistoryResponse(
                result.id(),
                result.prescriptionId(),
                result.prescriptionItemId(),
                result.medicineId(),
                result.medicineBatchId(),
                result.dispensedQuantity(),
                result.dispensedBy(),
                result.dispensedAt(),
                result.medicineName(),
                result.batchNumber(),
                result.dispenserName());
    }

    private CreatePrescriptionItemCommand toCommand(
            CreatePrescriptionItemRequest request
    ) {
        return CreatePrescriptionItemCommand.builder()
                .medicineId(request.medicineId())
                .dosage(request.dosage())
                .frequency(request.frequency())
                .route(request.route())
                .durationDays(request.durationDays())
                .quantity(request.quantity())
                .instructions(request.instructions())
                .singleDoseQuantity(request.singleDoseQuantity())
                .build();
    }

    private AmendPrescriptionItemCommand toCommand(
            AmendPrescriptionItemRequest request
    ) {
        return AmendPrescriptionItemCommand.builder()
                .medicineId(request.medicineId())
                .dosage(request.dosage())
                .frequency(request.frequency())
                .route(request.route())
                .durationDays(request.durationDays())
                .quantity(request.quantity())
                .instructions(request.instructions())
                .singleDoseQuantity(request.singleDoseQuantity())
                .build();
    }

    private PrescriptionInteractionOverrideCommand toCommand(
            PrescriptionInteractionOverrideRequest request
    ) {
        return new PrescriptionInteractionOverrideCommand(
                request.ruleId(),
                request.overrideReason()
        );
    }

    private PrescriptionItemResponse toResponse(
            PrescriptionItemResult result
    ) {
        return PrescriptionItemResponse.builder()
                .id(result.id())
                .prescriptionId(result.prescriptionId())
                .medicineId(result.medicineId())
                .medicineName(result.medicineName())
                .activeIngredient(result.activeIngredient())
                .strength(result.strength())
                .unit(result.unit())
                .dosage(result.dosage())
                .frequency(result.frequency())
                .route(result.route())
                .durationDays(result.durationDays())
                .quantity(result.quantity())
                .dispensedQuantity(result.dispensedQuantity())
                .remainingQuantity(result.remainingQuantity())
                .instructions(result.instructions())
                .singleDoseQuantity(result.singleDoseQuantity())
                .createdAt(result.createdAt())
                .updatedAt(result.updatedAt())
                .build();
    }

    private PrescriptionWarningResponse toResponse(
            PrescriptionWarningResult result
    ) {
        return PrescriptionWarningResponse.builder()
                .id(result.id())
                .ruleId(result.ruleId())
                .firstMedicineId(result.firstMedicineId())
                .secondMedicineId(result.secondMedicineId())
                .severity(result.severity())
                .warningMessage(result.warningMessage())
                .action(result.action())
                .overrideReason(result.overrideReason())
                .handledBy(result.handledBy())
                .handledAt(result.handledAt())
                .build();
    }

    private DrugInteractionWarningResponse toResponse(
            DrugInteractionWarningResult result
    ) {
        return new DrugInteractionWarningResponse(
                result.ruleId(),
                result.drugIdA(),
                result.drugIdB(),
                result.severity(),
                result.description(),
                result.clinicalRecommendation()
        );
    }

    private DispenseAllocationResponse toResponse(
            DispenseAllocationResult result
    ) {
        return new DispenseAllocationResponse(
                result.dispenseItemId(),
                result.prescriptionItemId(),
                result.medicineId(),
                result.medicineCode(),
                result.medicineName(),
                result.batchId(),
                result.batchNumber(),
                result.expiryDate(),
                result.dispensedQuantity(),
                result.batchQuantityRemaining()
        );
    }

    public PrescriptionAllergyOverrideCommand toCommand(
            PrescriptionAllergyOverrideRequest request
    ) {
        if (request == null) {
            return null;
        }
        return new PrescriptionAllergyOverrideCommand(
                request.allergyId(),
                request.medicineId(),
                request.overrideReason()
        );
    }

    public PrescriptionContraindicationOverrideCommand toCommand(
            PrescriptionContraindicationOverrideRequest request
    ) {
        if (request == null) {
            return null;
        }
        return new PrescriptionContraindicationOverrideCommand(
                request.ruleId(),
                request.medicineId(),
                request.overrideReason()
        );
    }

    public PrescriptionMaxDailyDoseOverrideCommand toCommand(
            PrescriptionMaxDailyDoseOverrideRequest request
    ) {
        if (request == null) {
            return null;
        }
        return new PrescriptionMaxDailyDoseOverrideCommand(
                request.activeIngredient(),
                request.overrideReason()
        );
    }

    public PatientAllergyWarningResponse toAllergyResponse(
            PatientAllergyWarningResult result
    ) {
        if (result == null) {
            return null;
        }
        return new PatientAllergyWarningResponse(
                result.allergyId(),
                result.patientId(),
                result.medicineId(),
                result.medicineName(),
                result.activeIngredient(),
                result.allergenName(),
                result.severity(),
                result.reaction()
        );
    }

    public List<PatientAllergyWarningResponse> toAllergyResponses(
            List<PatientAllergyWarningResult> results
    ) {
        if (results == null) {
            return List.of();
        }
        return results.stream().map(this::toAllergyResponse).toList();
    }

    public PrescriptionAllergyWarningLogResponse toAllergyLogResponse(
            PrescriptionAllergyWarningLogResult result
    ) {
        if (result == null) {
            return null;
        }
        String patientName = anonymizationModeState.isEnabled()
                ? PatientAnonymizer.maskFullName(result.patientCode())
                : result.patientName();
        return new PrescriptionAllergyWarningLogResponse(
                result.id(),
                result.prescriptionId(),
                result.prescriptionCode(),
                result.patientId(),
                result.patientCode(),
                patientName,
                result.doctorId(),
                result.doctorName(),
                result.medicineId(),
                result.medicineName(),
                result.activeIngredient(),
                result.allergenName(),
                result.severity(),
                result.reaction(),
                result.overrideReason(),
                result.handledAt()
        );
    }

    public ReturnMedicationCommand toCommand(UUID prescriptionId, ReturnMedicationRequest request) {
        return new ReturnMedicationCommand(
                prescriptionId,
                request.reason(),
                request.items().stream().map(this::toCommand).toList()
        );
    }

    public ReturnMedicationResponse toResponse(ReturnMedicationResult result) {
        return new ReturnMedicationResponse(
                result.prescriptionId(),
                result.status(),
                result.returnedBy(),
                result.returnedAt(),
                result.returns().stream().map(this::toResponse).toList()
        );
    }

    private ReturnMedicationItemCommand toCommand(ReturnMedicationItemRequest request) {
        return new ReturnMedicationItemCommand(request.dispenseItemId(), request.quantity());
    }

    private ReturnedMedicationItemResponse toResponse(ReturnedMedicationItemResult result) {
        return new ReturnedMedicationItemResponse(
                result.returnId(),
                result.dispenseItemId(),
                result.prescriptionItemId(),
                result.medicineId(),
                result.medicineName(),
                result.medicineBatchId(),
                result.batchNumber(),
                result.returnedQuantity(),
                result.remainingReturnableQuantity()
        );
    }

    public ContraindicationCheckResponse toResponse(ContraindicationCheckResult result) {
        return new ContraindicationCheckResponse(
                result.warnings().stream().map(this::toResponse).toList(),
                result.missingData().stream().map(this::toResponse).toList()
        );
    }

    private ContraindicationWarningResponse toResponse(ContraindicationWarningResult result) {
        return new ContraindicationWarningResponse(
                result.ruleId(),
                result.medicineId(),
                result.medicineName(),
                result.type(),
                result.severity(),
                result.message(),
                result.recommendation()
        );
    }

    private ContraindicationMissingDataResponse toResponse(ContraindicationMissingDataResult result) {
        return new ContraindicationMissingDataResponse(
                result.medicineId(),
                result.medicineName(),
                result.type(),
                result.message()
        );
    }

    private MaxDailyDoseMissingDataResponse toResponse(MaxDailyDoseMissingDataResult result) {
        return new MaxDailyDoseMissingDataResponse(
                result.activeIngredient(),
                result.reason()
        );
    }

    public CheckMaxDailyDoseCommand toCommand(CheckMaxDailyDoseRequest request) {
        return new CheckMaxDailyDoseCommand(
                request.medicalRecordId(),
                request.items().stream()
                        .map(item -> new CheckMaxDailyDoseItemCommand(
                                item.medicineId(),
                                item.singleDoseQuantity(),
                                item.frequency()
                        ))
                        .toList()
        );
    }

    public MaxDailyDoseCheckResponse toResponse(MaxDailyDoseCheckResult result) {
        return new MaxDailyDoseCheckResponse(
                result.warnings().stream().map(this::toResponse).toList(),
                result.missingData().stream().map(this::toResponse).toList()
        );
    }

    private MaxDailyDoseWarningResponse toResponse(MaxDailyDoseWarningResult result) {
        return new MaxDailyDoseWarningResponse(
                result.activeIngredient(),
                result.totalDailyDoseMg(),
                result.maxDailyDoseMg()
        );
    }

    public DispenseSuggestionResponse toResponse(DispenseSuggestionResult result) {
        return new DispenseSuggestionResponse(
                result.prescriptionId(),
                result.items().stream().map(this::toResponse).toList()
        );
    }

    private DispenseSuggestionItemResponse toResponse(DispenseSuggestionItemResult result) {
        return new DispenseSuggestionItemResponse(
                result.prescriptionItemId(),
                result.medicineId(),
                result.medicineName(),
                result.prescribedQuantity(),
                result.remainingQuantity(),
                result.batches().stream().map(this::toResponse).toList()
        );
    }

    private DispenseSuggestionBatchResponse toResponse(DispenseSuggestionBatchResult result) {
        return new DispenseSuggestionBatchResponse(
                result.batchId(),
                result.batchNumber(),
                result.expiryDate(),
                result.availableQuantity(),
                result.suggestedQuantity()
        );
    }
}
