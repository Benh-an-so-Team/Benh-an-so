package com.benhsoan.application.ucservice.prescription;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.benhsoan.domain.auditlog.AuditLog;
import com.benhsoan.domain.auditlog.enums.ActionType;
import com.benhsoan.domain.auditlog.enums.ResourceType;
import com.benhsoan.domain.prescription.Prescription;
import com.benhsoan.domain.prescription.PrescriptionInterconnectionLog;
import com.benhsoan.domain.prescription.enums.InterconnectionStatus;
import com.benhsoan.domain.prescription.enums.PrescriptionInterconnectionAttemptType;
import com.benhsoan.domain.prescription.enums.PrescriptionInterconnectionOutcome;
import com.benhsoan.domain.prescription.enums.PrescriptionStatus;
import com.benhsoan.domain.prescription.exception.PrescriptionNotFoundException;
import com.benhsoan.domain.prescription.exception.PrescriptionInvalidStatusException;
import com.benhsoan.domain.shared.exception.ValidationException;
import com.benhsoan.port.dto.result.PrescriptionInterconnectionResult;
import com.benhsoan.port.inbound.prescription.SendPrescriptionInterconnectionUseCase;
import com.benhsoan.port.outbound.interconnection.PrescriptionInterconnectionGatewayPort;
import com.benhsoan.port.outbound.interconnection.PrescriptionInterconnectionGatewayRequest;
import com.benhsoan.port.outbound.interconnection.PrescriptionInterconnectionGatewayResponse;
import com.benhsoan.port.outbound.repository.audit.AuditLogRepository;
import com.benhsoan.port.outbound.repository.clinic.ClinicConfigurationRepository;
import com.benhsoan.port.outbound.repository.medicalrecord.MedicalRecordRepository;
import com.benhsoan.port.outbound.repository.patient.PatientRepository;
import com.benhsoan.port.outbound.repository.prescription.PrescriptionInterconnectionLogRepository;
import com.benhsoan.port.outbound.repository.prescription.PrescriptionRepository;
import com.benhsoan.port.outbound.repository.visit.VisitRepository;
import com.benhsoan.port.outbound.security.CurrentUserPort;
import com.benhsoan.port.outbound.time.ClockPort;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
@Transactional
public class SendPrescriptionInterconnectionService implements SendPrescriptionInterconnectionUseCase {

    private final PrescriptionRepository prescriptionRepository;
    private final PrescriptionInterconnectionLogRepository interconnectionLogRepository;
    private final PrescriptionInterconnectionGatewayPort gatewayPort;
    private final MedicalRecordRepository medicalRecordRepository;
    private final VisitRepository visitRepository;
    private final PatientRepository patientRepository;
    private final ClinicConfigurationRepository clinicConfigurationRepository;
    private final PrescriptionDisplayContextResolver displayContextResolver;
    private final CurrentUserPort currentUserPort;
    private final ClockPort clockPort;
    private final AuditLogRepository auditLogRepository;
    private final ObjectMapper objectMapper;

    @Override
    public PrescriptionInterconnectionResult send(UUID prescriptionId) {
        requireDoctor();
        UUID actorId = currentUserPort.getCurrentUserId();
        Prescription prescription = prescriptionRepository.findByIdForUpdate(prescriptionId)
                .orElseThrow(() -> new PrescriptionNotFoundException(prescriptionId));
        requireEligibleForSending(prescription);
        requireResponsibleDoctor(prescription, actorId);

        Instant startedAt = clockPort.now();
        PrescriptionInterconnectionGatewayRequest request = toGatewayRequest(prescription);
        String requestPayload = json(request);
        int attemptNumber = interconnectionLogRepository.findByPrescriptionId(prescriptionId).size() + 1;

        PrescriptionInterconnectionGatewayResponse gatewayResponse;
        try {
            gatewayResponse = gatewayPort.submit(request);
        } catch (RuntimeException exception) {
            Instant completedAt = clockPort.now();
            String failureReason = failureReason(exception);
            prescription.markInterconnectionFailed(failureReason, completedAt);
            Prescription saved = prescriptionRepository.save(prescription);
            interconnectionLogRepository.save(PrescriptionInterconnectionLog.create(
                    UUID.randomUUID(), saved.getId(), attemptNumber,
                    PrescriptionInterconnectionAttemptType.SEND, PrescriptionInterconnectionOutcome.FAILED,
                    requestPayload, json(Map.of("error", failureReason)), null, failureReason,
                    actorId, startedAt, completedAt
            ));
            recordAudit(saved, actorId, InterconnectionStatus.FAILED, null, failureReason, completedAt);
            return new PrescriptionInterconnectionResult(saved.getId(), saved.getPrescriptionCode(),
                    InterconnectionStatus.FAILED, null, failureReason, completedAt);
        }

        Instant completedAt = clockPort.now();
        prescription.markInterconnectionSucceeded(gatewayResponse.receiptCode(), completedAt);
        Prescription saved = prescriptionRepository.save(prescription);
        interconnectionLogRepository.save(PrescriptionInterconnectionLog.create(
                UUID.randomUUID(), saved.getId(), attemptNumber,
                PrescriptionInterconnectionAttemptType.SEND, PrescriptionInterconnectionOutcome.SUCCESS,
                requestPayload, json(gatewayResponse), gatewayResponse.receiptCode(), null,
                actorId, startedAt, completedAt
        ));
        recordAudit(saved, actorId, InterconnectionStatus.SUCCESS,
                gatewayResponse.receiptCode(), null, completedAt);
        return new PrescriptionInterconnectionResult(saved.getId(), saved.getPrescriptionCode(),
                InterconnectionStatus.SUCCESS, gatewayResponse.receiptCode(), null, completedAt);
    }

    private void requireDoctor() {
        if (!currentUserPort.hasRole("DOCTOR")) {
            throw new AccessDeniedException("Only doctors can send prescriptions for interconnection.");
        }
    }

    private void requireEligibleForSending(Prescription prescription) {
        if (prescription.getPrescriptionCode() == null || prescription.getPrescriptionCode().isBlank()) {
            throw new ValidationException("Prescription code is required before interconnection.");
        }
        if (prescription.getStatus() == PrescriptionStatus.CANCELLED) {
            throw new ValidationException("Cancelled prescriptions cannot be sent for interconnection.");
        }
        if (prescription.getInterconnectionStatus() == InterconnectionStatus.SUCCESS) {
            throw new PrescriptionInvalidStatusException(
                    "Successfully interconnected prescriptions cannot be submitted again."
            );
        }
    }

    private void requireResponsibleDoctor(Prescription prescription, UUID actorId) {
        var medicalRecord = medicalRecordRepository.findById(prescription.getMedicalRecordId())
                .orElseThrow(() -> new ValidationException("Medical record not found for prescription."));
        var visit = visitRepository.findById(medicalRecord.getVisitId())
                .orElseThrow(() -> new ValidationException("Visit not found for prescription."));
        if (!actorId.equals(visit.getDoctorId())) {
            throw new AccessDeniedException("Only the doctor responsible for the visit can send this prescription.");
        }
    }

    private PrescriptionInterconnectionGatewayRequest toGatewayRequest(Prescription prescription) {
        var clinic = clinicConfigurationRepository.find()
                .orElseThrow(() -> new ValidationException("Clinic configuration is required for interconnection."));
        var context = displayContextResolver.resolve(
                prescription.getMedicalRecordId(), prescription.getPrescribedBy());
        var patient = context.patientId() == null ? null : patientRepository.findById(context.patientId()).orElse(null);
        return new PrescriptionInterconnectionGatewayRequest(
                prescription.getPrescriptionCode(),
                prescription.getPrescribedAt(),
                new PrescriptionInterconnectionGatewayRequest.Clinic(
                        String.valueOf(clinic.getId()), clinic.getClinicName(), clinic.getAddress(), clinic.getPhone()),
                new PrescriptionInterconnectionGatewayRequest.Doctor(
                        prescription.getPrescribedBy(), context.doctorName()),
                patient == null ? null : new PrescriptionInterconnectionGatewayRequest.Patient(
                        patient.getId(), patient.getPatientCode(), patient.getFullName()),
                prescription.getItems().stream().map(item -> new PrescriptionInterconnectionGatewayRequest.Item(
                        item.getMedicineId(), item.getMedicineName(), item.getActiveIngredient(), item.getStrength(),
                        item.getUnit(), item.getDosage(), item.getFrequency(), item.getRoute().name(),
                        item.getDurationDays(), item.getQuantity(), item.getInstructions()
                )).toList(),
                prescription.getReplacesPrescriptionCode()
        );
    }

    private void recordAudit(
            Prescription prescription,
            UUID actorId,
            InterconnectionStatus status,
            String receiptCode,
            String failureReason,
            Instant completedAt
    ) {
        auditLogRepository.save(AuditLog.create(actorId, ActionType.SEND, ResourceType.PRESCRIPTION,
                prescription.getId(), json(Map.of(
                        "prescriptionCode", prescription.getPrescriptionCode(),
                        "result", status.name(),
                        "receiptCode", receiptCode == null ? "" : receiptCode,
                        "failureReason", failureReason == null ? "" : failureReason
                )), null, completedAt));
    }

    private String json(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Could not serialize interconnection payload.", exception);
        }
    }

    private String failureReason(RuntimeException exception) {
        return exception.getMessage() == null || exception.getMessage().isBlank()
                ? exception.getClass().getSimpleName()
                : exception.getMessage();
    }
}
