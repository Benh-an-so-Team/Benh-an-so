package com.benhsoan.port.dto.result.billing;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

public record InvoicePrintDocument(
        String clinicName,
        String clinicAddress,
        String clinicPhone,
        String invoiceCode,
        String invoiceType,
        String originalInvoiceCode,
        String adjustmentReason,
        String patientCode,
        String patientName,
        String patientDateOfBirth,
        String patientGender,
        String patientPhone,
        String visitCode,
        Instant visitAt,
        String doctorName,
        String specialtyName,
        Instant createdAt,
        String createdByName,
        List<InvoicePrintLine> lines,
        BigDecimal totalAmount,
        Instant printedAt,
        String title,
        String logoUrl,
        String legalInfo,
        String footerText,
        boolean showLogo,
        int reprintCount,
        String fieldVisibility
) {

    public InvoicePrintDocument {
        if (lines != null && totalAmount != null && !lines.isEmpty()) {
            BigDecimal calculatedTotal = lines.stream()
                    .map(InvoicePrintLine::amount)
                    .filter(java.util.Objects::nonNull)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
            if (totalAmount.compareTo(calculatedTotal) != 0) {
                throw new com.benhsoan.domain.shared.exception.ValidationException(
                        "Tổng tiền hóa đơn không khớp với tổng các dòng chi phí."
                );
            }
        }
    }

    public InvoicePrintDocument(
            String clinicName,
            String clinicAddress,
            String clinicPhone,
            String invoiceCode,
            String invoiceType,
            String originalInvoiceCode,
            String adjustmentReason,
            String patientCode,
            String patientName,
            String patientDateOfBirth,
            String patientGender,
            String patientPhone,
            String visitCode,
            Instant visitAt,
            String doctorName,
            String specialtyName,
            Instant createdAt,
            String createdByName,
            List<InvoicePrintLine> lines,
            BigDecimal totalAmount,
            Instant printedAt,
            String title,
            String logoUrl,
            String legalInfo,
            String footerText,
            boolean showLogo,
            int reprintCount
    ) {
        this(
                clinicName,
                clinicAddress,
                clinicPhone,
                invoiceCode,
                invoiceType,
                originalInvoiceCode,
                adjustmentReason,
                patientCode,
                patientName,
                patientDateOfBirth,
                patientGender,
                patientPhone,
                visitCode,
                visitAt,
                doctorName,
                specialtyName,
                createdAt,
                createdByName,
                lines,
                totalAmount,
                printedAt,
                title,
                logoUrl,
                legalInfo,
                footerText,
                showLogo,
                reprintCount,
                null
        );
    }

    public InvoicePrintDocument(
            String clinicName,
            String clinicAddress,
            String clinicPhone,
            String invoiceCode,
            String invoiceType,
            String originalInvoiceCode,
            String adjustmentReason,
            String patientCode,
            String patientName,
            String patientDateOfBirth,
            String patientGender,
            String patientPhone,
            String visitCode,
            Instant visitAt,
            String doctorName,
            String specialtyName,
            Instant createdAt,
            String createdByName,
            List<InvoicePrintLine> lines,
            BigDecimal totalAmount,
            Instant printedAt
    ) {
        this(
                clinicName,
                clinicAddress,
                clinicPhone,
                invoiceCode,
                invoiceType,
                originalInvoiceCode,
                adjustmentReason,
                patientCode,
                patientName,
                patientDateOfBirth,
                patientGender,
                patientPhone,
                visitCode,
                visitAt,
                doctorName,
                specialtyName,
                createdAt,
                createdByName,
                lines,
                totalAmount,
                printedAt,
                null,
                null,
                null,
                null,
                true,
                0,
                null
        );
    }

    public record InvoicePrintLine(
            int itemIndex,
            String itemName,
            String lineType,
            int quantity,
            BigDecimal unitPrice,
            BigDecimal amount
    ) {
    }
}
