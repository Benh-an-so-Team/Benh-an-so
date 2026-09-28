package com.benhsoan.port.outbound.interconnection;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record PrescriptionInterconnectionGatewayRequest(
        String prescriptionCode,
        Instant prescribedAt,
        Clinic clinic,
        Doctor doctor,
        Patient patient,
        List<Item> items,
        String replacesPrescriptionCode
) {
    public PrescriptionInterconnectionGatewayRequest(
            String prescriptionCode,
            Instant prescribedAt,
            Clinic clinic,
            Doctor doctor,
            Patient patient,
            List<Item> items
    ) {
        this(prescriptionCode, prescribedAt, clinic, doctor, patient, items, null);
    }
    public record Clinic(String id, String name, String address, String phone) {
    }

    public record Doctor(UUID id, String name) {
    }

    public record Patient(UUID id, String code, String name) {
    }

    public record Item(
            UUID medicineId,
            String medicineName,
            String activeIngredient,
            String strength,
            String unit,
            String dosage,
            int frequencyPerDay,
            String route,
            int durationDays,
            int quantity,
            String instructions
    ) {
    }
}
