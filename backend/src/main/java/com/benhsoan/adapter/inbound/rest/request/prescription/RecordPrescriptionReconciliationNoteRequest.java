package com.benhsoan.adapter.inbound.rest.request.prescription;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * NCL-12-CN-007: reason/note recorded against a reconciliation discrepancy.
 *
 * Only the reason comes from the client. The discrepancy type, the author and the timestamp
 * are resolved server side, so they cannot be spoofed through this payload.
 */
public record RecordPrescriptionReconciliationNoteRequest(
        @NotBlank(message = "reason is required")
        @Size(max = 500, message = "reason must not exceed 500 characters")
        String reason
) {
}
