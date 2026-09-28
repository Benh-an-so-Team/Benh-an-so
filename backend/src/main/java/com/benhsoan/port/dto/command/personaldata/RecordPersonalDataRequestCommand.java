package com.benhsoan.port.dto.command.personaldata;

import java.time.Instant;
import java.util.UUID;

public record RecordPersonalDataRequestCommand(
        UUID patientId,
        String requestType,
        String reason,
        Instant dueAt
) {
}
