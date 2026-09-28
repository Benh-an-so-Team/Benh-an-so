package com.benhsoan.adapter.inbound.rest.request.personaldata;

import java.time.Instant;
import java.util.UUID;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record RecordPersonalDataRequestRequest(
        @NotNull(message = "patientId is required.")
        UUID patientId,

        @NotBlank(message = "requestType is required.")
        @Size(max = 50, message = "requestType must not exceed 50 characters.")
        String requestType,

        @Size(max = 2000, message = "reason must not exceed 2000 characters.")
        String reason,

        @NotNull(message = "dueAt is required.")
        Instant dueAt
) {
}
