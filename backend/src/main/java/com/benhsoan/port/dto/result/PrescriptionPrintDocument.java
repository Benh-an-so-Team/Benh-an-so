package com.benhsoan.port.dto.result;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import com.benhsoan.domain.medicine.enums.AdministrationRoute;

public record PrescriptionPrintDocument(
        String clinicName,
        String clinicAddress,
        String clinicPhone,
        String prescriptionCode,
        UUID patientId,
        String patientCode,
        String patientName,
        UUID doctorId,
        String doctorName,
        Instant prescribedAt,
        List<Item> items,
        String title,
        String logoUrl,
        String legalInfo,
        String footerText,
        boolean showLogo,
        String fieldVisibility
) {
    public PrescriptionPrintDocument {
        items = items == null ? List.of() : List.copyOf(items);
    }

    public PrescriptionPrintDocument(
            String clinicName,
            String clinicAddress,
            String clinicPhone,
            String prescriptionCode,
            UUID patientId,
            String patientCode,
            String patientName,
            UUID doctorId,
            String doctorName,
            Instant prescribedAt,
            List<Item> items,
            String title,
            String logoUrl,
            String legalInfo,
            String footerText,
            boolean showLogo
    ) {
        this(
                clinicName,
                clinicAddress,
                clinicPhone,
                prescriptionCode,
                patientId,
                patientCode,
                patientName,
                doctorId,
                doctorName,
                prescribedAt,
                items,
                title,
                logoUrl,
                legalInfo,
                footerText,
                showLogo,
                null
        );
    }

    public PrescriptionPrintDocument(
            String clinicName,
            String clinicAddress,
            String clinicPhone,
            String prescriptionCode,
            UUID patientId,
            String patientCode,
            String patientName,
            UUID doctorId,
            String doctorName,
            Instant prescribedAt,
            List<Item> items
    ) {
        this(
                clinicName,
                clinicAddress,
                clinicPhone,
                prescriptionCode,
                patientId,
                patientCode,
                patientName,
                doctorId,
                doctorName,
                prescribedAt,
                items,
                null,
                null,
                null,
                null,
                true,
                null
        );
    }

    public record Item(
            String medicineName,
            String strength,
            String unit,
            String dosage,
            Integer frequency,
            Integer durationDays,
            AdministrationRoute route,
            int quantity,
            String instructions
    ) {
    }
}
