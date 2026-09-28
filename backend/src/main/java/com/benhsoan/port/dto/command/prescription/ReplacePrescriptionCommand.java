package com.benhsoan.port.dto.command.prescription;

import java.util.UUID;

/**
 * The replacement always belongs to the medical record of the original, so the
 * nested command's {@code medicalRecordId} is ignored.
 */
public record ReplacePrescriptionCommand(
        UUID originalPrescriptionId,
        String replacementReason,
        CreatePrescriptionCommand prescription
) {
}
