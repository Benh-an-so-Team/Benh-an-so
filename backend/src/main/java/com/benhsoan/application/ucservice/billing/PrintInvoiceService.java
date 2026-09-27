package com.benhsoan.application.ucservice.billing;

import java.time.Instant;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.benhsoan.domain.auditlog.AuditLog;
import com.benhsoan.domain.auditlog.enums.ActionType;
import com.benhsoan.domain.auditlog.enums.ResourceType;
import com.benhsoan.domain.auth.User;
import com.benhsoan.domain.billing.Invoice;
import com.benhsoan.domain.billing.exception.InvoiceNotFoundException;
import com.benhsoan.domain.clinic.ClinicConfiguration;
import com.benhsoan.domain.clinic.DocumentPrintTemplate;
import com.benhsoan.domain.clinic.enums.PrintDocumentType;
import com.benhsoan.domain.patient.Patient;
import com.benhsoan.domain.patient.exception.PatientNotFoundException;
import com.benhsoan.domain.specialty.Specialty;
import com.benhsoan.domain.visit.Visit;
import com.benhsoan.domain.visit.exception.VisitNotFoundException;
import com.benhsoan.port.dto.result.billing.InvoicePrintDocument;
import com.benhsoan.port.dto.result.billing.InvoicePrintDocument.InvoicePrintLine;
import com.benhsoan.port.dto.result.portal.InvoicePrintResult;
import com.benhsoan.port.inbound.billing.PrintInvoiceUseCase;
import com.benhsoan.port.outbound.pdf.InvoicePdfRenderer;
import com.benhsoan.port.outbound.repository.audit.AuditLogRepository;
import com.benhsoan.port.outbound.repository.auth.UserRepository;
import com.benhsoan.port.outbound.repository.billing.InvoiceRepository;
import com.benhsoan.port.outbound.repository.clinic.ClinicConfigurationRepository;
import com.benhsoan.port.outbound.repository.clinic.DocumentPrintTemplateRepository;
import com.benhsoan.port.outbound.repository.patient.PatientRepository;
import com.benhsoan.port.outbound.repository.specialty.SpecialtyRepository;
import com.benhsoan.port.outbound.repository.visit.VisitRepository;
import com.benhsoan.port.outbound.security.CurrentUserPort;
import com.benhsoan.port.outbound.time.ClockPort;
import com.fasterxml.jackson.databind.ObjectMapper;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
@Transactional
public class PrintInvoiceService implements PrintInvoiceUseCase {

    private static final String PDF_CONTENT_TYPE = "application/pdf";
    private static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter.ofPattern("dd/MM/yyyy");

    private final InvoiceRepository invoiceRepository;
    private final VisitRepository visitRepository;
    private final PatientRepository patientRepository;
    private final UserRepository userRepository;
    private final SpecialtyRepository specialtyRepository;
    private final ClinicConfigurationRepository clinicConfigurationRepository;
    private final DocumentPrintTemplateRepository documentPrintTemplateRepository;
    private final InvoicePdfRenderer invoicePdfRenderer;
    private final AuditLogRepository auditLogRepository;
    private final CurrentUserPort currentUserPort;
    private final ClockPort clockPort;
    private final ObjectMapper objectMapper;

    @Override
    public InvoicePrintResult print(UUID invoiceId) {
        Invoice invoice = invoiceRepository.findById(invoiceId)
                .orElseThrow(() -> new InvoiceNotFoundException(invoiceId));

        Visit visit = visitRepository.findById(invoice.getVisitId())
                .orElseThrow(() -> new VisitNotFoundException(invoice.getVisitId()));

        Patient patient = patientRepository.findById(visit.getPatientId())
                .orElseThrow(() -> new PatientNotFoundException(visit.getPatientId()));

        Instant now = clockPort.now();
        UUID currentUserId = currentUserPort.getCurrentUserId();

        ClinicConfiguration clinic = clinicConfigurationRepository.find().orElse(null);
        String clinicName = clinic != null ? clinic.getClinicName() : "Phòng khám Đa khoa";
        String clinicAddress = clinic != null ? clinic.getAddress() : "-";
        String clinicPhone = clinic != null ? clinic.getPhone() : "-";

        DocumentPrintTemplate template = documentPrintTemplateRepository
                .findByDocumentType(PrintDocumentType.INVOICE)
                .orElse(null);

        String title = template != null ? template.getTitle() : null;
        String logoUrl = template != null ? template.getLogoUrl() : null;
        String legalInfo = template != null ? template.getLegalInfo() : null;
        String footerText = template != null ? template.getFooterText() : null;
        boolean showLogo = template == null || template.isShowLogo();
        String fieldVisibility = template != null ? template.getFieldVisibility() : null;

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
                        line.getAmount()
                ));
            }
        }

        String dobStr = patient.getDateOfBirth() != null ? DATE_FORMATTER.format(patient.getDateOfBirth()) : "-";
        String genderStr = patient.getGender() != null ? patient.getGender().name() : "-";

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
                fieldVisibility
        );

        byte[] pdfContent = invoicePdfRenderer.render(printDoc);

        auditLogRepository.save(AuditLog.create(
                currentUserId,
                ActionType.EXPORT,
                ResourceType.INVOICE,
                invoice.getId(),
                auditDetail(visit, invoice, now),
                null,
                now
        ));

        String fileName = "hoa-don-" + invoice.getInvoiceCode() + ".pdf";
        return new InvoicePrintResult(fileName, PDF_CONTENT_TYPE, pdfContent);
    }

    private String auditDetail(Visit visit, Invoice invoice, Instant exportedAt) {
        Map<String, Object> detail = new LinkedHashMap<>();
        detail.put("channel", "RECEPTION_DESK");
        detail.put("invoiceId", invoice.getId().toString());
        detail.put("invoiceCode", invoice.getInvoiceCode());
        detail.put("reprintCount", invoice.getReprintCount());
        detail.put("isReprint", invoice.getReprintCount() > 0);
        detail.put("visitId", visit.getId().toString());
        detail.put("patientId", visit.getPatientId().toString());
        detail.put("exportedAt", exportedAt.toString());

        try {
            return objectMapper.writeValueAsString(detail);
        } catch (Exception ex) {
            return "{\"invoiceCode\":\"" + invoice.getInvoiceCode() + "\"}";
        }
    }
}
