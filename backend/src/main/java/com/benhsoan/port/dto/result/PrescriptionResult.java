package com.benhsoan.port.dto.result;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import com.benhsoan.domain.prescription.enums.PrescriptionStatus;

public record PrescriptionResult(

        UUID id,

        String prescriptionCode,

        UUID medicalRecordId,

        UUID visitId,

        String visitCode,

        UUID patientId,

        String patientCode,

        String patientName,

        PrescriptionStatus status,

        String note,

        String cancelReason,

        UUID prescribedBy,

        String doctorName,

        Instant prescribedAt,

        UUID updatedBy,

        Instant updatedAt,

        List<PrescriptionItemResult> items,

        List<PrescriptionWarningResult> warnings,

        List<MaxDailyDoseMissingDataResult> maxDailyDoseMissingData,

        UUID replacesPrescriptionId,

        String replacesPrescriptionCode,

        String replacementReason,

        UUID replacedByPrescriptionId,

        String replacedByPrescriptionCode

) {

    public PrescriptionResult(
            UUID id,
            String prescriptionCode,
            UUID medicalRecordId,
            UUID visitId,
            String visitCode,
            UUID patientId,
            String patientCode,
            String patientName,
            PrescriptionStatus status,
            String note,
            String cancelReason,
            UUID prescribedBy,
            String doctorName,
            Instant prescribedAt,
            UUID updatedBy,
            Instant updatedAt,
            List<PrescriptionItemResult> items,
            List<PrescriptionWarningResult> warnings
    ) {
        this(id, prescriptionCode, medicalRecordId, visitId, visitCode, patientId, patientCode, patientName,
                status, note, cancelReason, prescribedBy, doctorName, prescribedAt, updatedBy, updatedAt, items,
                warnings, List.of(), null, null, null, null, null);
    }

    public PrescriptionResult(
            UUID id,
            String prescriptionCode,
            UUID medicalRecordId,
            UUID visitId,
            String visitCode,
            UUID patientId,
            String patientCode,
            String patientName,
            PrescriptionStatus status,
            String note,
            UUID prescribedBy,
            String doctorName,
            Instant prescribedAt,
            UUID updatedBy,
            Instant updatedAt,
            List<PrescriptionItemResult> items,
            List<PrescriptionWarningResult> warnings
    ) {
        this(id, prescriptionCode, medicalRecordId, visitId, visitCode, patientId, patientCode, patientName,
                status, note, null, prescribedBy, doctorName, prescribedAt, updatedBy, updatedAt, items, warnings,
                List.of(), null, null, null, null, null);
    }

    public PrescriptionResult withReplacementLink(
            UUID replacesPrescriptionId,
            String replacesPrescriptionCode,
            String replacementReason,
            UUID replacedByPrescriptionId,
            String replacedByPrescriptionCode
    ) {
        return new PrescriptionResult(
                id, prescriptionCode, medicalRecordId, visitId, visitCode, patientId, patientCode, patientName,
                status, note, cancelReason, prescribedBy, doctorName, prescribedAt, updatedBy, updatedAt, items,
                warnings, maxDailyDoseMissingData, replacesPrescriptionId, replacesPrescriptionCode,
                replacementReason, replacedByPrescriptionId, replacedByPrescriptionCode);
    }
}
