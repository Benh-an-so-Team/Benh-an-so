package com.benhsoan.application.ucservice.prescription;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.benhsoan.domain.auditlog.AuditLog;
import com.benhsoan.domain.auditlog.enums.ActionType;
import com.benhsoan.domain.auditlog.enums.ResourceType;
import com.benhsoan.domain.prescription.Prescription;
import com.benhsoan.domain.prescription.PrescriptionReconciliationClassifier;
import com.benhsoan.domain.prescription.PrescriptionReconciliationNote;
import com.benhsoan.domain.prescription.enums.PrescriptionReconciliationOutcome;
import com.benhsoan.domain.prescription.exception.PrescriptionNotFoundException;
import com.benhsoan.domain.shared.exception.ValidationException;
import com.benhsoan.port.dto.command.prescription.RecordPrescriptionReconciliationNoteCommand;
import com.benhsoan.port.dto.result.PrescriptionReconciliationNoteResult;
import com.benhsoan.port.inbound.prescription.RecordPrescriptionReconciliationNoteUseCase;
import com.benhsoan.port.outbound.repository.audit.AuditLogRepository;
import com.benhsoan.port.outbound.repository.prescription.PrescriptionReconciliationNoteRepository;
import com.benhsoan.port.outbound.repository.prescription.PrescriptionRepository;
import com.benhsoan.port.outbound.security.CurrentUserPort;
import com.benhsoan.port.outbound.time.ClockPort;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;

import lombok.RequiredArgsConstructor;

/**
 * NCL-12-CN-007: records a reason/note for a reconciliation discrepancy, the alternative the
 * workbook offers next to retransmitting the interconnection.
 *
 * The discrepancy type, the author and the timestamp are derived server side. A note is only
 * appended; nothing is updated or deleted, and no retransmission is triggered here.
 */
@Service
@RequiredArgsConstructor
@Transactional
public class RecordPrescriptionReconciliationNoteService
        implements RecordPrescriptionReconciliationNoteUseCase {

    private static final String AUDIT_ACTION = "RECONCILIATION_NOTE";

    private final PrescriptionRepository prescriptionRepository;
    private final PrescriptionReconciliationNoteRepository noteRepository;
    private final PrescriptionReconciliationAccessValidator accessValidator;
    private final CurrentUserPort currentUserPort;
    private final ClockPort clockPort;
    private final AuditLogRepository auditLogRepository;
    private final ObjectMapper objectMapper;

    @Override
    public PrescriptionReconciliationNoteResult record(
            RecordPrescriptionReconciliationNoteCommand command
    ) {
        accessValidator.requireCanRecordNote();
        if (command == null || command.prescriptionId() == null) {
            throw new ValidationException("Prescription id is required.");
        }

        UUID actorId = currentUserPort.getCurrentUserId();
        Prescription prescription = prescriptionRepository.findById(command.prescriptionId())
                .orElseThrow(() -> new PrescriptionNotFoundException(command.prescriptionId()));

        // Discrepancy type is always computed from persisted state. The client never supplies it.
        PrescriptionReconciliationOutcome outcome = PrescriptionReconciliationClassifier.classify(
                prescription.getStatus(), prescription.getInterconnectionStatus());
        if (!outcome.isDiscrepancy()) {
            throw new ValidationException(
                    "A reconciliation note can only be recorded for a discrepancy outcome.");
        }

        Instant now = clockPort.now();
        PrescriptionReconciliationNote saved = noteRepository.save(
                PrescriptionReconciliationNote.create(
                        UUID.randomUUID(),
                        prescription.getId(),
                        outcome,
                        command.reason(),
                        actorId,
                        now));

        auditLogRepository.save(AuditLog.create(
                actorId,
                ActionType.UPDATE,
                ResourceType.PRESCRIPTION,
                prescription.getId(),
                auditDetail(prescription, saved),
                null,
                now));

        return new PrescriptionReconciliationNoteResult(
                saved.getId(),
                saved.getPrescriptionId(),
                saved.getReconciliationOutcome(),
                saved.getReason(),
                saved.getNotedBy(),
                saved.getNotedAt());
    }

    private String auditDetail(Prescription prescription, PrescriptionReconciliationNote note) {
        Map<String, Object> detail = new LinkedHashMap<>();
        detail.put("action", AUDIT_ACTION);
        detail.put("prescriptionCode", prescription.getPrescriptionCode());
        detail.put("reconciliationOutcome", note.getReconciliationOutcome().name());
        detail.put("reconciliationNoteId", note.getId().toString());
        detail.put("reason", note.getReason());
        return json(detail);
    }

    private String json(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Could not serialize reconciliation note audit detail.", exception);
        }
    }
}
