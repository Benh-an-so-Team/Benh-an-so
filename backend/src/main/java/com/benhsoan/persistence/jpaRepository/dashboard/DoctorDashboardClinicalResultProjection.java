package com.benhsoan.persistence.jpaRepository.dashboard;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

import com.benhsoan.domain.clinical.enums.ClinicalResultAbnormalFlag;
import com.benhsoan.domain.clinical.enums.ClinicalResultStatus;
import com.benhsoan.domain.clinical.enums.ClinicalResultType;

public record DoctorDashboardClinicalResultProjection(
        UUID clinicalResultId,
        UUID clinicalOrderItemId,
        String serviceCode,
        String serviceName,
        UUID visitId,
        String visitCode,
        UUID patientId,
        String patientCode,
        String patientFullName,
        ClinicalResultType resultType,
        BigDecimal numericValue,
        String textValue,
        String unit,
        String referenceRange,
        ClinicalResultAbnormalFlag abnormalFlag,
        String conclusion,
        ClinicalResultStatus status,
        Instant enteredAt
) {
}
