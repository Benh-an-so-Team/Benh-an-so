package com.benhsoan.application.ucservice.portal;

import java.time.Instant;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.benhsoan.application.ucservice.patient.PatientAccessGuard;
import com.benhsoan.domain.auditlog.AuditLog;
import com.benhsoan.domain.auditlog.enums.ActionType;
import com.benhsoan.domain.auditlog.enums.ResourceType;
import com.benhsoan.domain.auth.User;
import com.benhsoan.domain.billing.Invoice;
import com.benhsoan.domain.billing.exception.InvoiceNotFoundException;
import com.benhsoan.domain.clinic.ClinicConfiguration;
import com.benhsoan.domain.clinic.DocumentPrintTemplate;
import com.benhsoan.domain.patient.Patient;
import com.benhsoan.domain.patient.exception.PatientNotFoundException;
import com.benhsoan.domain.specialty.Specialty;
import com.benhsoan.domain.visit.Visit;
import com.benhsoan.domain.visit.exception.VisitNotFoundException;
import com.benhsoan.port.dto.result.billing.InvoicePrintDocument;
import com.benhsoan.port.dto.result.billing.InvoicePrintDocument.InvoicePrintLine;
import com.benhsoan.port.dto.result.portal.InvoicePrintResult;
import com.benhsoan.port.inbound.portal.ExportPatientPortalInvoiceUseCase;
import com.benhsoan.port.outbound.pdf.InvoicePdfRenderer;
import com.benhsoan.port.outbound.repository.audit.AuditLogRepository;
import com.benhsoan.port.outbound.repository.auth.UserRepository;
import com.benhsoan.port.outbound.repository.billing.InvoiceRepository;
import com.benhsoan.port.outbound.repository.clinic.ClinicConfigurationRepository;
import com.benhsoan.port.outbound.repository.patient.PatientRepository;
import com.benhsoan.port.outbound.repository.specialty.SpecialtyRepository;
import com.benhsoan.port.outbound.repository.visit.VisitRepository;
import com.benhsoan.port.outbound.security.CurrentUserPort;
import com.benhsoan.port.outbound.time.ClockPort;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;

@Service
@Transactional
public class ExportPatientPortalInvoiceService implements ExportPatientPortalInvoiceUseCase {

        private static final String ONLINE_PORTAL = "ONLINE_PORTAL";
        private static final String PDF_CONTENT_TYPE = "application/pdf";
        private static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter.ofPattern("dd/MM/yyyy");

        private final InvoiceRepository invoiceRepository;
        private final VisitRepository visitRepository;
        private final PatientRepository patientRepository;
        private final UserRepository userRepository;
        private final SpecialtyRepository specialtyRepository;
        private final ClinicConfigurationRepository clinicConfigurationRepository;
        private final com.benhsoan.port.outbound.repository.clinic.DocumentPrintTemplateRepository documentPrintTemplateRepository;
        private final InvoicePdfRenderer invoicePdfRenderer;
        private final PatientAccessGuard patientAccessGuard;
        private final AuditLogRepository auditLogRepository;
        private final CurrentUserPort currentUserPort;
        private final ClockPort clockPort;
        private final ObjectMapper objectMapper;

        @org.springframework.beans.factory.annotation.Autowired
        public ExportPatientPortalInvoiceService(
                        InvoiceRepository invoiceRepository,
                        VisitRepository visitRepository,
                        PatientRepository patientRepository,
                        UserRepository userRepository,
                        SpecialtyRepository specialtyRepository,
                        ClinicConfigurationRepository clinicConfigurationRepository,
                        com.benhsoan.port.outbound.repository.clinic.DocumentPrintTemplateRepository documentPrintTemplateRepository,
                        InvoicePdfRenderer invoicePdfRenderer,
                        PatientAccessGuard patientAccessGuard,
                        AuditLogRepository auditLogRepository,
                        CurrentUserPort currentUserPort,
                        ClockPort clockPort,
                        ObjectMapper objectMapper) {
                this.invoiceRepository = invoiceRepository;
                this.visitRepository = visitRepository;
                this.patientRepository = patientRepository;
                this.userRepository = userRepository;
                this.specialtyRepository = specialtyRepository;
                this.clinicConfigurationRepository = clinicConfigurationRepository;
                this.documentPrintTemplateRepository = documentPrintTemplateRepository;
                this.invoicePdfRenderer = invoicePdfRenderer;
                this.patientAccessGuard = patientAccessGuard;
                this.auditLogRepository = auditLogRepository;
                this.currentUserPort = currentUserPort;
                this.clockPort = clockPort;
                this.objectMapper = objectMapper;
        }

        public ExportPatientPortalInvoiceService(
                        InvoiceRepository invoiceRepository,
                        VisitRepository visitRepository,
                        PatientRepository patientRepository,
                        UserRepository userRepository,
                        SpecialtyRepository specialtyRepository,
                        ClinicConfigurationRepository clinicConfigurationRepository,
                        InvoicePdfRenderer invoicePdfRenderer,
                        PatientAccessGuard patientAccessGuard,
                        AuditLogRepository auditLogRepository,
                        CurrentUserPort currentUserPort,
                        ClockPort clockPort,
                        ObjectMapper objectMapper) {
                this(invoiceRepository, visitRepository, patientRepository, userRepository,
                                specialtyRepository, clinicConfigurationRepository, null,
                                invoicePdfRenderer, patientAccessGuard, auditLogRepository,
                                currentUserPort, clockPort, objectMapper);
        }

        @Override
        public InvoicePrintResult export(UUID invoiceId) {
                Invoice invoice = invoiceRepository.findById(invoiceId)
                                .orElseThrow(() -> new InvoiceNotFoundException(invoiceId));

                Visit visit = visitRepository.findById(invoice.getVisitId())
                                .orElseThrow(() -> new VisitNotFoundException(invoice.getVisitId()));

                // TC-03 / QTN-23: Check ownership and write ACCESS_DENIED audit if unauthorized
                patientAccessGuard.requirePatientOwnership(
                                visit.getPatientId(),
                                ResourceType.INVOICE,
                                invoiceId);

                Patient patient = patientRepository.findById(visit.getPatientId())
                                .orElseThrow(() -> new PatientNotFoundException(visit.getPatientId()));

                ClinicConfiguration clinic = clinicConfigurationRepository.find().orElse(null);
                String clinicName = clinic != null ? clinic.getClinicName() : "Phòng khám Đa khoa";
                String clinicAddress = clinic != null ? clinic.getAddress() : "-";
                String clinicPhone = clinic != null ? clinic.getPhone() : "-";

                String originalInvoiceCode = null;
                if (invoice.getOriginalInvoiceId() != null) {
                        originalInvoiceCode = invoiceRepository.findById(invoice.getOriginalInvoiceId())
                                        .map(Invoice::getInvoiceCode)
                                        .orElse(null);
                }

                String creatorName = userRepository.findById(invoice.getCreatedBy())
                                .map(User::getFullName)
                                .orElse("-");

                String doctorName = userRepository.findById(visit.getDoctorId())
                                .map(User::getFullName)
                                .orElse("-");

                String specialtyName = specialtyRepository.findById(visit.getSpecialtyId())
                                .map(Specialty::getName)
                                .orElse("-");

                List<InvoicePrintLine> printLines = new ArrayList<>();
                if (invoice.getLines() != null) {
                        for (int i = 0; i < invoice.getLines().size(); i++) {
                                var line = invoice.getLines().get(i);
                                printLines.add(new InvoicePrintLine(
                                                i + 1,
                                                line.getItemName(),
                                                line.getLineType() != null ? line.getLineType().name() : "SERVICE",
                                                line.getQuantity(),
                                                line.getUnitPrice(),
                                                line.getAmount()));
                        }
                }

                String dobStr = patient.getDateOfBirth() != null ? DATE_FORMATTER.format(patient.getDateOfBirth())
                                : "-";
                String genderStr = patient.getGender() != null ? patient.getGender().name() : "-";

                Instant now = clockPort.now();
                UUID currentUserId = currentUserPort.getCurrentUserId();

                DocumentPrintTemplate template = documentPrintTemplateRepository != null
                                ? documentPrintTemplateRepository.findByDocumentType(
                                                com.benhsoan.domain.clinic.enums.PrintDocumentType.INVOICE).orElse(null)
                                : null;

                String title = template != null ? template.getTitle() : null;
                String logoUrl = template != null ? template.getLogoUrl() : null;
                String legalInfo = template != null ? template.getLegalInfo() : null;
                String footerText = template != null ? template.getFooterText() : null;
                boolean showLogo = template == null || template.isShowLogo();
                String fieldVisibility = template != null ? template.getFieldVisibility() : null;

                InvoicePrintDocument printDoc = new InvoicePrintDocument(
                                clinicName,
                                clinicAddress,
                                clinicPhone,
                                invoice.getInvoiceCode(),
                                invoice.getType() != null ? invoice.getType().name() : "ORIGINAL",
                                originalInvoiceCode,
                                invoice.getAdjustmentReason(),
                                patient.getPatientCode(),
                                patient.getFullName(),
                                dobStr,
                                genderStr,
                                patient.getPhone(),
                                visit.getVisitCode(),
                                visit.getVisitAt(),
                                doctorName,
                                specialtyName,
                                invoice.getCreatedAt(),
                                creatorName,
                                printLines,
                                invoice.getTotalAmount(),
                                now,
                                title,
                                logoUrl,
                                legalInfo,
                                footerText,
                                showLogo,
                                invoice.getReprintCount(),
                                fieldVisibility);

                byte[] pdfContent = invoicePdfRenderer.render(printDoc);

                // Audit EXPORT operation
                auditLogRepository.save(AuditLog.create(
                                currentUserId,
                                ActionType.EXPORT,
                                ResourceType.INVOICE,
                                invoice.getId(),
                                auditDetail(visit, invoice, now),
                                null,
                                now));

                String fileName = "hoa-don-" + invoice.getInvoiceCode() + ".pdf";
                return new InvoicePrintResult(fileName, PDF_CONTENT_TYPE, pdfContent);
        }

        private String auditDetail(Visit visit, Invoice invoice, Instant exportedAt) {
                Map<String, Object> detail = new LinkedHashMap<>();
                detail.put("channel", ONLINE_PORTAL);
                detail.put("invoiceId", invoice.getId().toString());
                detail.put("invoiceCode", invoice.getInvoiceCode());
                detail.put("visitId", visit.getId().toString());
                detail.put("patientId", visit.getPatientId().toString());
                detail.put("exportedAt", exportedAt.toString());

                try {
                        return objectMapper.writeValueAsString(detail);
                } catch (JsonProcessingException exception) {
                        throw new IllegalStateException("Could not serialize invoice export audit detail.", exception);
                }
        }
}
