package com.benhsoan.port.dto.result.portal;

import java.time.Instant;
import java.util.List;

public record ClinicalResultPrintDocument(
        String clinicName,
        String clinicAddress,
        String clinicPhone,
        String patientCode,
        String patientName,
        String patientDateOfBirth,
        String patientGender,
        String patientPhone,
        String visitCode,
        Instant visitAt,
        String doctorName,
        String specialtyName,
        String orderCode,
        String clinicalReason,
        List<ClinicalResultPrintItem> items,
        String overallConclusion,
        Instant printedAt,
        String title,
        String logoUrl,
        String legalInfo,
        String footerText,
        boolean showLogo,
        String fieldVisibility
) {

    public ClinicalResultPrintDocument(
            String clinicName,
            String clinicAddress,
            String clinicPhone,
            String patientCode,
            String patientName,
            String patientDateOfBirth,
            String patientGender,
            String patientPhone,
            String visitCode,
            Instant visitAt,
            String doctorName,
            String specialtyName,
            String orderCode,
            String clinicalReason,
            List<ClinicalResultPrintItem> items,
            String overallConclusion,
            Instant printedAt
    ) {
        this(
                clinicName,
                clinicAddress,
                clinicPhone,
                patientCode,
                patientName,
                patientDateOfBirth,
                patientGender,
                patientPhone,
                visitCode,
                visitAt,
                doctorName,
                specialtyName,
                orderCode,
                clinicalReason,
                items,
                overallConclusion,
                printedAt,
                null,
                null,
                null,
                null,
                true,
                null
        );
    }
    public record ClinicalResultPrintItem(
            int itemIndex,
            String serviceCode,
            String serviceName,
            String resultType,
            String resultValue,
            String unit,
            String referenceRange,
            String abnormalFlag,
            String conclusion
    ) {
    }
}
