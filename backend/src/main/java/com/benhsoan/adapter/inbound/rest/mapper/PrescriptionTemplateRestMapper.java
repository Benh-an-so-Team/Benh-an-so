package com.benhsoan.adapter.inbound.rest.mapper;

import org.springframework.stereotype.Component;

import com.benhsoan.adapter.inbound.rest.response.prescription.AppliedPrescriptionTemplateResponse;
import com.benhsoan.adapter.inbound.rest.response.prescription.ContraindicationMissingDataResponse;
import com.benhsoan.adapter.inbound.rest.response.prescription.ContraindicationWarningResponse;
import com.benhsoan.adapter.inbound.rest.response.prescription.DrugInteractionWarningResponse;
import com.benhsoan.adapter.inbound.rest.response.prescription.PatientAllergyWarningResponse;
import com.benhsoan.adapter.inbound.rest.response.prescription.PrescriptionTemplateResponse;
import com.benhsoan.port.dto.result.AppliedPrescriptionTemplateResult;
import com.benhsoan.port.dto.result.ContraindicationMissingDataResult;
import com.benhsoan.port.dto.result.ContraindicationWarningResult;
import com.benhsoan.port.dto.result.DrugInteractionWarningResult;
import com.benhsoan.port.dto.result.PatientAllergyWarningResult;
import com.benhsoan.port.dto.result.PrescriptionTemplateResult;

@Component
public class PrescriptionTemplateRestMapper {

    public PrescriptionTemplateResponse toResponse(PrescriptionTemplateResult result) {
        if (result == null) {
            return null;
        }
        return new PrescriptionTemplateResponse(
                result.id(),
                result.diagnosisCatalogId(),
                result.diagnosisCode(),
                result.diagnosisName(),
                result.createdBy(),
                result.createdAt(),
                result.items().stream().map(this::toItem).toList());
    }

    public AppliedPrescriptionTemplateResponse toResponse(AppliedPrescriptionTemplateResult result) {
        if (result == null) {
            return null;
        }
        return new AppliedPrescriptionTemplateResponse(
                result.templateId(),
                result.diagnosisCode(),
                result.diagnosisName(),
                result.items().stream().map(this::toDraftItem).toList(),
                result.skippedItems().stream().map(this::toSkippedItem).toList(),
                result.interactionWarnings().stream().map(this::toInteractionWarning).toList(),
                result.allergyWarnings().stream().map(this::toAllergyWarning).toList(),
                result.contraindicationWarnings().stream().map(this::toContraindicationWarning).toList(),
                result.contraindicationMissingData().stream().map(this::toMissingData).toList());
    }

    private PrescriptionTemplateResponse.Item toItem(PrescriptionTemplateResult.Item item) {
        return new PrescriptionTemplateResponse.Item(
                item.id(),
                item.medicineId(),
                item.medicineCode(),
                item.medicineName(),
                item.activeIngredient(),
                item.strength(),
                item.unit(),
                item.dosage(),
                item.frequency(),
                item.route(),
                item.durationDays(),
                item.quantity(),
                item.instructions(),
                item.sortOrder());
    }

    private AppliedPrescriptionTemplateResponse.DraftItem toDraftItem(
            AppliedPrescriptionTemplateResult.DraftItem item) {
        return new AppliedPrescriptionTemplateResponse.DraftItem(
                item.medicineId(),
                item.medicineCode(),
                item.medicineName(),
                item.activeIngredient(),
                item.strength(),
                item.unit(),
                item.dosage(),
                item.frequency(),
                item.route(),
                item.durationDays(),
                item.quantity(),
                item.instructions());
    }

    private AppliedPrescriptionTemplateResponse.SkippedItem toSkippedItem(
            AppliedPrescriptionTemplateResult.SkippedItem item) {
        return new AppliedPrescriptionTemplateResponse.SkippedItem(
                item.medicineId(),
                item.medicineName(),
                item.reason());
    }

    private DrugInteractionWarningResponse toInteractionWarning(DrugInteractionWarningResult warning) {
        return new DrugInteractionWarningResponse(
                warning.ruleId(),
                warning.drugIdA(),
                warning.drugIdB(),
                warning.severity(),
                warning.description(),
                warning.clinicalRecommendation());
    }

    private PatientAllergyWarningResponse toAllergyWarning(PatientAllergyWarningResult warning) {
        return new PatientAllergyWarningResponse(
                warning.allergyId(),
                warning.patientId(),
                warning.medicineId(),
                warning.medicineName(),
                warning.activeIngredient(),
                warning.allergenName(),
                warning.severity(),
                warning.reaction());
    }

    private ContraindicationWarningResponse toContraindicationWarning(ContraindicationWarningResult warning) {
        return new ContraindicationWarningResponse(
                warning.ruleId(),
                warning.medicineId(),
                warning.medicineName(),
                warning.type(),
                warning.severity(),
                warning.message(),
                warning.recommendation());
    }

    private ContraindicationMissingDataResponse toMissingData(ContraindicationMissingDataResult missing) {
        return new ContraindicationMissingDataResponse(
                missing.medicineId(),
                missing.medicineName(),
                missing.type(),
                missing.message());
    }
}
