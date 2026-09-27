package com.benhsoan.application.ucservice.billing;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

import java.util.LinkedHashMap;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;

import com.benhsoan.domain.auditlog.AuditLog;
import com.benhsoan.domain.auditlog.enums.ActionType;
import com.benhsoan.domain.auditlog.enums.ResourceType;
import com.benhsoan.domain.billing.Payment;
import com.benhsoan.domain.billing.PaymentMethodItem;
import com.benhsoan.domain.billing.PaymentServiceFee;
import com.benhsoan.domain.billing.exception.PaymentAlreadyExistsException;
import com.benhsoan.domain.billing.exception.PaymentNotAllowedException;
import com.benhsoan.domain.medicalrecord.MedicalRecord;
import com.benhsoan.domain.prescription.Prescription;
import com.benhsoan.domain.prescription.enums.PrescriptionStatus;
import com.benhsoan.domain.shared.exception.ValidationException;
import com.benhsoan.domain.visit.Visit;
import com.benhsoan.domain.visit.enums.VisitStatus;
import com.benhsoan.domain.visit.exception.VisitNotFoundException;
import com.benhsoan.port.dto.command.billing.RecordPaymentCommand;
import com.benhsoan.port.dto.result.PaymentResult;
import com.benhsoan.port.inbound.billing.RecordPaymentUseCase;
import com.benhsoan.port.outbound.repository.audit.AuditLogRepository;
import com.benhsoan.port.outbound.repository.billing.PaymentRepository;
import com.benhsoan.port.outbound.repository.billing.PaymentServiceFeeRepository;
import com.benhsoan.port.outbound.repository.medicalrecord.MedicalRecordRepository;
import com.benhsoan.port.outbound.repository.prescription.PrescriptionRepository;
import com.benhsoan.port.outbound.repository.visit.VisitRepository;
import com.benhsoan.port.outbound.security.CurrentUserPort;
import com.benhsoan.port.outbound.time.ClockPort;

@Service
@Transactional
public class RecordPaymentService implements RecordPaymentUseCase {

    private final VisitRepository visitRepository;
    private final MedicalRecordRepository medicalRecordRepository;
    private final PrescriptionRepository prescriptionRepository;
    private final PaymentRepository paymentRepository;
    private final CurrentUserPort currentUserPort;
    private final ClockPort clockPort;
    private final AuditLogRepository auditLogRepository;
    private final PaymentResultMapper resultMapper;
    private final ClinicalServiceFeeCalculator clinicalServiceFeeCalculator;
    private final PaymentServiceFeeRepository paymentServiceFeeRepository;
    private final com.benhsoan.port.outbound.repository.billing.DiscountRequestRepository discountRequestRepository;
    private final ObjectMapper objectMapper;
    private final BillingAccessDeniedAuditWriter accessDeniedAuditWriter;


    @Autowired
    public RecordPaymentService(
            VisitRepository visitRepository,
            MedicalRecordRepository medicalRecordRepository,
            PrescriptionRepository prescriptionRepository,
            PaymentRepository paymentRepository,
            CurrentUserPort currentUserPort,
            ClockPort clockPort,
            AuditLogRepository auditLogRepository,
            PaymentResultMapper resultMapper,
            ClinicalServiceFeeCalculator clinicalServiceFeeCalculator,
            PaymentServiceFeeRepository paymentServiceFeeRepository,
            com.benhsoan.port.outbound.repository.billing.DiscountRequestRepository discountRequestRepository,
            ObjectMapper objectMapper,
            BillingAccessDeniedAuditWriter accessDeniedAuditWriter) {
        this.visitRepository = visitRepository;
        this.medicalRecordRepository = medicalRecordRepository;
        this.prescriptionRepository = prescriptionRepository;
        this.paymentRepository = paymentRepository;
        this.currentUserPort = currentUserPort;
        this.clockPort = clockPort;
        this.auditLogRepository = auditLogRepository;
        this.resultMapper = resultMapper;
        this.clinicalServiceFeeCalculator = clinicalServiceFeeCalculator;
        this.paymentServiceFeeRepository = paymentServiceFeeRepository;
        this.discountRequestRepository = discountRequestRepository;
        this.objectMapper = objectMapper;
        this.accessDeniedAuditWriter = accessDeniedAuditWriter;
    }

    public RecordPaymentService(
            VisitRepository visitRepository,
            MedicalRecordRepository medicalRecordRepository,
            PrescriptionRepository prescriptionRepository,
            PaymentRepository paymentRepository,
            CurrentUserPort currentUserPort,
            ClockPort clockPort,
            AuditLogRepository auditLogRepository,
            PaymentResultMapper resultMapper,
            ClinicalServiceFeeCalculator clinicalServiceFeeCalculator,
            PaymentServiceFeeRepository paymentServiceFeeRepository,
            com.benhsoan.port.outbound.repository.billing.DiscountRequestRepository discountRequestRepository) {
        this(
                visitRepository,
                medicalRecordRepository,
                prescriptionRepository,
                paymentRepository,
                currentUserPort,
                clockPort,
                auditLogRepository,
                resultMapper,
                clinicalServiceFeeCalculator,
                paymentServiceFeeRepository,
                discountRequestRepository,
                new ObjectMapper(),
                new BillingAccessDeniedAuditWriter(auditLogRepository, new ObjectMapper()));
    }

    public RecordPaymentService(
            VisitRepository visitRepository,
            MedicalRecordRepository medicalRecordRepository,
            PrescriptionRepository prescriptionRepository,
            PaymentRepository paymentRepository,
            CurrentUserPort currentUserPort,
            ClockPort clockPort,
            AuditLogRepository auditLogRepository,
            PaymentResultMapper resultMapper,
            ClinicalServiceFeeCalculator clinicalServiceFeeCalculator,
            PaymentServiceFeeRepository paymentServiceFeeRepository,
            ObjectMapper objectMapper,
            BillingAccessDeniedAuditWriter accessDeniedAuditWriter) {
        this(
                visitRepository,
                medicalRecordRepository,
                prescriptionRepository,
                paymentRepository,
                currentUserPort,
                clockPort,
                auditLogRepository,
                resultMapper,
                clinicalServiceFeeCalculator,
                paymentServiceFeeRepository,
                null,
                objectMapper,
                accessDeniedAuditWriter);
    }

    public RecordPaymentService(
            VisitRepository visitRepository,
            MedicalRecordRepository medicalRecordRepository,
            PrescriptionRepository prescriptionRepository,
            PaymentRepository paymentRepository,
            CurrentUserPort currentUserPort,
            ClockPort clockPort,
            AuditLogRepository auditLogRepository,
            PaymentResultMapper resultMapper,
            ClinicalServiceFeeCalculator clinicalServiceFeeCalculator,
            PaymentServiceFeeRepository paymentServiceFeeRepository) {
        this(
                visitRepository,
                medicalRecordRepository,
                prescriptionRepository,
                paymentRepository,
                currentUserPort,
                clockPort,
                auditLogRepository,
                resultMapper,
                clinicalServiceFeeCalculator,
                paymentServiceFeeRepository,
                null,
                new ObjectMapper(),
                new BillingAccessDeniedAuditWriter(auditLogRepository, new ObjectMapper()));
    }

    @Override
    public PaymentResult record(RecordPaymentCommand command) {
        ensureAuthorized(command.visitId());

        Visit visit = visitRepository.findByIdForUpdate(command.visitId())
                .orElseThrow(() -> new VisitNotFoundException(command.visitId()));

        if (visit.getStatus() == VisitStatus.CANCELLED) {
            throw new PaymentNotAllowedException(
                    "Payment cannot be recorded for cancelled visits.");
        }

        if (discountRequestRepository != null && discountRequestRepository.existsByVisitIdAndStatus(visit.getId(),
                com.benhsoan.domain.billing.enums.DiscountRequestStatus.PENDING)) {
            throw new com.benhsoan.domain.billing.exception.PendingDiscountApprovalException(visit.getId());
        }

        if (paymentRepository.findByVisitId(visit.getId()).isPresent()) {
            throw new PaymentAlreadyExistsException(visit.getId());
        }

        ensureDispensingCompleted(visit.getId());

        UUID actorId = currentUserPort.getCurrentUserId();
        Instant now = clockPort.now();
        List<ClinicalServiceCharge> serviceCharges = clinicalServiceFeeCalculator
                .calculate(visit.getId(), now);

        java.math.BigDecimal discountAmount = java.math.BigDecimal.ZERO;
        UUID discountRequestId = null;
        if (discountRequestRepository != null) {
            var approvedDiscountOpt = discountRequestRepository.findByVisitIdAndStatus(
                    visit.getId(),
                    com.benhsoan.domain.billing.enums.DiscountRequestStatus.APPROVED);
            if (approvedDiscountOpt.isPresent()) {
                var approvedDiscount = approvedDiscountOpt.get();
                discountAmount = approvedDiscount.getDiscountAmount();
                discountRequestId = approvedDiscount.getId();
            }
        }

        UUID paymentId = UUID.randomUUID();
        List<PaymentMethodItem> methodItems;
        if (command.amountPaid() != null && command.amountPaid().compareTo(BigDecimal.ZERO) == 0) {
            methodItems = List.of();
        } else if (command.paymentMethods() != null && !command.paymentMethods().isEmpty()) {
            methodItems = command.paymentMethods().stream()
                    .map(cmd -> PaymentMethodItem.create(
                            UUID.randomUUID(),
                            paymentId,
                            cmd.paymentMethod(),
                            cmd.amount(),
                            cmd.referenceNumber(),
                            now))
                    .toList();
        } else if (command.paymentMethod() != null) {
            methodItems = List.of(PaymentMethodItem.create(
                    UUID.randomUUID(),
                    paymentId,
                    command.paymentMethod(),
                    command.amountPaid(),
                    command.referenceNumber(),
                    now));
        } else {
            throw new ValidationException("Payment method or payment methods list is required.");
        }

        Payment payment = Payment.record(
                paymentId,
                visit.getId(),
                command.examFee(),
                command.medicineFee(),
                clinicalServiceFeeCalculator.total(serviceCharges),
                discountAmount,
                discountRequestId,
                command.amountPaid(),
                methodItems,
                actorId,
                now,
                visit.getStatus(),
                true);

        Payment saved;
        try {
            saved = paymentRepository.save(payment);
        } catch (DataIntegrityViolationException ex) {
            if (isDuplicatePaymentConflict(ex)) {
                throw new PaymentAlreadyExistsException(visit.getId());
            }
            throw ex;
        }
        paymentServiceFeeRepository.saveAll(serviceCharges.stream()
                .map(charge -> PaymentServiceFee.create(
                        UUID.randomUUID(),
                        saved.getId(),
                        charge.clinicalOrderItemId(),
                        charge.serviceName(),
                        charge.price(),
                        now))
                .toList());

        Map<String, Object> auditPayload = new LinkedHashMap<>();
        auditPayload.put("visitId", saved.getVisitId());
        auditPayload.put("examFee", saved.getExamFee());
        auditPayload.put("medicineFee", saved.getMedicineFee());
        auditPayload.put("serviceFee", saved.getServiceFee());
        auditPayload.put("totalAmount", saved.getTotalAmount());
        auditPayload.put("paymentMethod", saved.getPaymentMethod());

        List<Map<String, Object>> auditMethodItems = saved.getPaymentMethodItems() == null
                ? List.of()
                : saved.getPaymentMethodItems().stream()
                        .map(i -> {
                            Map<String, Object> item = new LinkedHashMap<>();
                            item.put("method", i.getPaymentMethod() != null ? i.getPaymentMethod().name() : null);
                            item.put("amount", i.getAmount() != null ? i.getAmount().toString() : null);
                            item.put("referenceNumber", i.getReferenceNumber());
                            return item;
                        })
                        .toList();
        auditPayload.put("paymentMethods", auditMethodItems);

        String auditDetailsJson;
        try {
            auditDetailsJson = objectMapper.writeValueAsString(auditPayload);
        } catch (JsonProcessingException e) {
            auditDetailsJson = "{}";
        }

        auditLogRepository.save(AuditLog.create(
                actorId,
                ActionType.CREATE,
                ResourceType.PAYMENT,
                saved.getId(),
                auditDetailsJson,
                null));

        return resultMapper.toResult(saved);
    }

    private void ensureAuthorized(UUID visitId) {
        if (!currentUserPort.hasRole("ADMIN")
                && !currentUserPort.hasRole("RECEPTIONIST")) {
            if (accessDeniedAuditWriter != null) {
                accessDeniedAuditWriter.writePaymentDenied(
                        currentUserPort.getCurrentUserId(),
                        visitId,
                        clockPort.now(),
                        "Only receptionists can record payments.");
            }
            throw new AccessDeniedException("Only receptionists can record payments.");
        }
    }

    private void ensureDispensingCompleted(UUID visitId) {
        MedicalRecord medicalRecord = medicalRecordRepository.findByVisitId(visitId)
                .orElse(null);

        if (medicalRecord == null) {
            return;
        }

        List<Prescription> prescriptions = prescriptionRepository
                .findByMedicalRecordId(medicalRecord.getId());

        boolean hasPendingDispense = prescriptions.stream()
                .anyMatch(prescription -> prescription.getStatus() == PrescriptionStatus.PENDING_DISPENSE);

        if (hasPendingDispense) {
            throw new PaymentNotAllowedException(
                    "Payment cannot be recorded before dispensing is completed.");
        }
    }

    private boolean isDuplicatePaymentConflict(DataIntegrityViolationException ex) {
        String message = extractMessage(ex).toLowerCase();
        return message.contains("uk_payments_visit")
                || message.contains("duplicate entry")
                        && message.contains("visit_id");
    }

    private String extractMessage(Throwable throwable) {
        StringBuilder builder = new StringBuilder();
        Throwable current = throwable;
        while (current != null) {
            if (current.getMessage() != null) {
                builder.append(current.getMessage()).append(' ');
            }
            current = current.getCause();
        }
        return builder.toString();
    }
}
