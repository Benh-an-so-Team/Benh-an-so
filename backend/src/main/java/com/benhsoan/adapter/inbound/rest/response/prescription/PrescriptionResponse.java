package com.benhsoan.adapter.inbound.rest.response.prescription;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import com.benhsoan.domain.prescription.enums.PrescriptionStatus;

import lombok.Builder;

@Builder
public record PrescriptionResponse(

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

        List<PrescriptionItemResponse> items,

        List<PrescriptionWarningResponse> warnings,

        List<MaxDailyDoseMissingDataResponse> maxDailyDoseMissingData,

        UUID replacesPrescriptionId,

        String replacesPrescriptionCode,

        String replacementReason,

        UUID replacedByPrescriptionId,

        String replacedByPrescriptionCode

) {
}
