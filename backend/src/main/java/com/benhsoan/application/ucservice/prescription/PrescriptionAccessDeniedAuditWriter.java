package com.benhsoan.application.ucservice.prescription;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import com.benhsoan.domain.auditlog.AuditLog;
import com.benhsoan.domain.auditlog.enums.ActionType;
import com.benhsoan.domain.auditlog.enums.ResourceType;
import com.benhsoan.port.outbound.repository.audit.AuditLogRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * Writes prescription cancellation access-denied audit entries (NCL-05-CN-005 TC-04)
 * in an independent transaction so the refusal record survives the rollback
 * triggered by the subsequent UnauthorizedPrescriptionCancellationException.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class PrescriptionAccessDeniedAuditWriter {

    private final AuditLogRepository auditLogRepository;
    private final ObjectMapper objectMapper;

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void writeCancelDenied(
            UUID actorId,
            UUID prescriptionId,
            UUID prescribedBy,
            Instant deniedAt,
            String errorReason
    ) {
        writeDenied(actorId, prescriptionId, prescribedBy, deniedAt, errorReason);
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void writeReplacementDenied(
            UUID actorId,
            UUID prescriptionId,
            UUID prescribedBy,
            Instant deniedAt,
            String errorReason
    ) {
        writeDenied(actorId, prescriptionId, prescribedBy, deniedAt, errorReason);
    }

    private void writeDenied(
            UUID actorId,
            UUID prescriptionId,
            UUID prescribedBy,
            Instant deniedAt,
            String errorReason
    ) {
        Map<String, Object> detail = new LinkedHashMap<>();
        detail.put("error", errorReason != null ? errorReason : "Attempted to cancel prescription prescribed by another doctor");
        if (prescribedBy != null) {
            detail.put("prescribedBy", prescribedBy.toString());
        }
        detail.put("deniedAt", deniedAt.toString());

        try {
            auditLogRepository.save(AuditLog.create(
                    actorId,
                    ActionType.ACCESS_DENIED,
                    ResourceType.PRESCRIPTION,
                    prescriptionId,
                    toJson(detail),
                    null,
                    deniedAt
            ));
        } catch (RuntimeException exception) {
            log.warn("Failed to record access denied audit log for actor {} on prescription {}: {}",
                    actorId, prescriptionId, exception.getMessage());
        }
    }

    private String toJson(Map<String, Object> detail) {
        try {
            return objectMapper.writeValueAsString(detail);
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Could not serialize prescription cancellation access denial audit detail.", exception);
        }
    }
}
