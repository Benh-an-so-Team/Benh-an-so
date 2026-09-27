package com.benhsoan.application.ucservice.prescription;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.benhsoan.domain.auditlog.AuditLog;
import com.benhsoan.domain.auditlog.enums.ActionType;
import com.benhsoan.domain.auditlog.enums.ResourceType;
import com.benhsoan.domain.prescription.Prescription;
import com.benhsoan.domain.prescription.exception.PrescriptionNotFoundException;
import com.benhsoan.domain.prescription.exception.UnauthorizedPrescriptionReplacementException;
import com.benhsoan.domain.shared.exception.ValidationException;
import com.benhsoan.port.dto.command.prescription.CreatePrescriptionCommand;
import com.benhsoan.port.dto.command.prescription.PrescriptionCreationContext;
import com.benhsoan.port.dto.command.prescription.ReplacePrescriptionCommand;
import com.benhsoan.port.dto.result.PrescriptionInterconnectionResult;
import com.benhsoan.port.dto.result.PrescriptionReplacementResult;
import com.benhsoan.port.dto.result.PrescriptionResult;
import com.benhsoan.port.inbound.prescription.CreatePrescriptionUseCase;
import com.benhsoan.port.inbound.prescription.ReplaceInterconnectedPrescriptionUseCase;
import com.benhsoan.port.inbound.prescription.SendPrescriptionInterconnectionUseCase;
import com.benhsoan.port.outbound.repository.audit.AuditLogRepository;
import com.benhsoan.port.outbound.repository.prescription.PrescriptionRepository;
import com.benhsoan.port.outbound.repository.prescription.PrescriptionWarningLogRepository;
import com.benhsoan.port.outbound.security.CurrentUserPort;
import com.benhsoan.port.outbound.time.ClockPort;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
@Transactional
public class ReplaceInterconnectedPrescriptionService implements ReplaceInterconnectedPrescriptionUseCase {

    private final PrescriptionRepository prescriptionRepository;
    private final PrescriptionWarningLogRepository warningLogRepository;
    private final CreatePrescriptionUseCase createPrescriptionUseCase;
    private final SendPrescriptionInterconnectionUseCase sendPrescriptionInterconnectionUseCase;
    private final PrescriptionClinicalContextValidator clinicalContextValidator;
    private final PrescriptionAccessDeniedAuditWriter accessDeniedAuditWriter;
    private final PrescriptionResultMapper resultMapper;
    private final CurrentUserPort currentUserPort;
    private final ClockPort clockPort;
    private final AuditLogRepository auditLogRepository;
    private final ObjectMapper objectMapper;

    @Override
    public PrescriptionReplacementResult replace(ReplacePrescriptionCommand command) {
        requireCommand(command);
        requireDoctor();

        UUID actorId = currentUserPort.getCurrentUserId();
        Instant now = clockPort.now();

        Prescription original = prescriptionRepository
                .findByIdForUpdate(command.originalPrescriptionId())
                .orElseThrow(() -> new PrescriptionNotFoundException(command.originalPrescriptionId()));

        requirePrescribingDoctor(original, actorId, now);
        clinicalContextValidator.requireDoctorPermissionForPrescriptionReplacement(
                original.getMedicalRecordId(),
                actorId
        );
        original.ensureReplaceable();

        String reason = command.replacementReason().trim();

        PrescriptionResult createdReplacement = createPrescriptionUseCase.create(
                creationCommandFor(original, command.prescription())
        );

        Prescription replacement = prescriptionRepository.findById(createdReplacement.id())
                .orElseThrow(() -> new PrescriptionNotFoundException(createdReplacement.id()));
        replacement.markAsReplacementOf(
                original.getId(),
                original.getPrescriptionCode(),
                reason,
                actorId,
                now
        );
        Prescription savedReplacement = prescriptionRepository.save(replacement);

        original.markReplaced(actorId, now);
        Prescription savedOriginal = prescriptionRepository.save(original);
        recordReplacementAudit(savedOriginal, savedReplacement, reason, actorId, now);

        PrescriptionInterconnectionResult interconnection =
                sendPrescriptionInterconnectionUseCase.send(savedReplacement.getId());

        return new PrescriptionReplacementResult(
                toResult(savedOriginal),
                toResult(reload(savedReplacement.getId())),
                interconnection
        );
    }

    private void requireCommand(ReplacePrescriptionCommand command) {
        if (command == null || command.originalPrescriptionId() == null) {
            throw new ValidationException("Prescription id is required.");
        }
        if (command.replacementReason() == null || command.replacementReason().isBlank()) {
            throw new ValidationException("Replacement reason is required.");
        }
        if (command.prescription() == null) {
            throw new ValidationException("Replacement prescription content is required.");
        }
    }

    private void requireDoctor() {
        if (!currentUserPort.hasRole("DOCTOR")) {
            throw new AccessDeniedException("Only doctors can replace prescriptions.");
        }
    }

    private CreatePrescriptionCommand creationCommandFor(
            Prescription original,
            CreatePrescriptionCommand requested
    ) {
        return CreatePrescriptionCommand.builder()
                .medicalRecordId(original.getMedicalRecordId())
                .note(requested.note())
                .items(requested.items())
                .interactionOverrides(requested.interactionOverrides())
                .allergyOverrides(requested.allergyOverrides())
                .contraindicationOverrides(requested.contraindicationOverrides())
                .maxDailyDoseOverrides(requested.maxDailyDoseOverrides())
                .controlledMedicineConfirmed(requested.controlledMedicineConfirmed())
                .creationContext(PrescriptionCreationContext.REPLACEMENT)
                .build();
    }

    private void requirePrescribingDoctor(Prescription original, UUID actorId, Instant deniedAt) {
        if (Objects.equals(original.getPrescribedBy(), actorId)) {
            return;
        }
        accessDeniedAuditWriter.writeReplacementDenied(
                actorId,
                original.getId(),
                original.getPrescribedBy(),
                deniedAt,
                "Attempted to replace prescription prescribed by another doctor"
        );
        throw new UnauthorizedPrescriptionReplacementException();
    }

    private Prescription reload(UUID prescriptionId) {
        return prescriptionRepository.findById(prescriptionId)
                .orElseThrow(() -> new PrescriptionNotFoundException(prescriptionId));
    }

    private PrescriptionResult toResult(Prescription prescription) {
        return resultMapper.toResult(
                prescription,
                warningLogRepository.findByPrescriptionId(prescription.getId())
        );
    }

    private void recordReplacementAudit(
            Prescription original,
            Prescription replacement,
            String replacementReason,
            UUID actorId,
            Instant replacedAt
    ) {
        Map<String, Object> originalDetail = new LinkedHashMap<>();
        originalDetail.put("prescriptionCode", original.getPrescriptionCode());
        originalDetail.put("status", original.getStatus().name());
        originalDetail.put("replacementPrescriptionId", replacement.getId().toString());
        originalDetail.put("replacementPrescriptionCode", replacement.getPrescriptionCode());
        originalDetail.put("replacementReason", replacementReason);
        originalDetail.put("replacedAt", replacedAt.toString());

        // The replacement itself must also expose the relationship, so auditing the new
        // prescription reveals that it was created as a replacement of the original.
        Map<String, Object> replacementDetail = new LinkedHashMap<>();
        replacementDetail.put("replacesPrescriptionId", original.getId().toString());
        replacementDetail.put("replacesPrescriptionCode", original.getPrescriptionCode());
        replacementDetail.put("replacementReason", replacementReason);
        replacementDetail.put("replacedAt", replacedAt.toString());

        try {
            auditLogRepository.save(AuditLog.create(
                    actorId,
                    ActionType.UPDATE,
                    ResourceType.PRESCRIPTION,
                    original.getId(),
                    objectMapper.writeValueAsString(originalDetail),
                    null,
                    replacedAt
            ));
            auditLogRepository.save(AuditLog.create(
                    actorId,
                    ActionType.UPDATE,
                    ResourceType.PRESCRIPTION,
                    replacement.getId(),
                    objectMapper.writeValueAsString(replacementDetail),
                    null,
                    replacedAt
            ));
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException(
                    "Could not serialize prescription replacement audit detail.", exception);
        }
    }
}
