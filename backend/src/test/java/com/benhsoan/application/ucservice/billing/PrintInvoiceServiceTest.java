package com.benhsoan.application.ucservice.billing;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import com.benhsoan.domain.auditlog.AuditLog;
import com.benhsoan.domain.auditlog.enums.ActionType;
import com.benhsoan.domain.auth.User;
import com.benhsoan.domain.billing.Invoice;
import com.benhsoan.domain.billing.InvoiceLine;
import com.benhsoan.domain.billing.enums.InvoiceLineType;
import com.benhsoan.domain.billing.enums.InvoiceType;
import com.benhsoan.domain.clinic.DocumentPrintTemplate;
import com.benhsoan.domain.clinic.enums.PrintDocumentType;
import com.benhsoan.domain.patient.Patient;
import com.benhsoan.domain.patient.enums.Gender;
import com.benhsoan.domain.specialty.Specialty;
import com.benhsoan.domain.visit.Visit;
import com.benhsoan.domain.visit.enums.VisitStatus;
import com.benhsoan.domain.visit.enums.VisitType;
import com.benhsoan.port.dto.result.billing.InvoicePrintDocument;
import com.benhsoan.port.dto.result.portal.InvoicePrintResult;
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

class PrintInvoiceServiceTest {

        private static final Instant NOW = Instant.parse("2026-09-25T08:00:00Z");
        private static final UUID ACTOR_ID = UUID.randomUUID();

        private final InvoiceRepository invoiceRepository = mock(InvoiceRepository.class);
        private final VisitRepository visitRepository = mock(VisitRepository.class);
        private final PatientRepository patientRepository = mock(PatientRepository.class);
        private final UserRepository userRepository = mock(UserRepository.class);
        private final SpecialtyRepository specialtyRepository = mock(SpecialtyRepository.class);
        private final ClinicConfigurationRepository clinicConfigurationRepository = mock(
                        ClinicConfigurationRepository.class);
        private final DocumentPrintTemplateRepository documentPrintTemplateRepository = mock(
                        DocumentPrintTemplateRepository.class);
        private final InvoicePdfRenderer invoicePdfRenderer = mock(InvoicePdfRenderer.class);
        private final AuditLogRepository auditLogRepository = mock(AuditLogRepository.class);
        private final CurrentUserPort currentUserPort = mock(CurrentUserPort.class);
        private final ClockPort clockPort = mock(ClockPort.class);
        private final ObjectMapper objectMapper = new ObjectMapper();

        private PrintInvoiceService service;

        @BeforeEach
        void setUp() {
                service = new PrintInvoiceService(
                                invoiceRepository,
                                visitRepository,
                                patientRepository,
                                userRepository,
                                specialtyRepository,
                                clinicConfigurationRepository,
                                documentPrintTemplateRepository,
                                invoicePdfRenderer,
                                auditLogRepository,
                                currentUserPort,
                                clockPort,
                                objectMapper);
                when(clockPort.now()).thenReturn(NOW);
                when(currentUserPort.getCurrentUserId()).thenReturn(ACTOR_ID);
        }

        @Test
        void print_whenReprintingInvoice_usesUpdatedTemplateAndRecordsReprintAudit() {
                UUID invoiceId = UUID.randomUUID();
                UUID visitId = UUID.randomUUID();
                UUID patientId = UUID.randomUUID();
                UUID doctorId = UUID.randomUUID();
                UUID specialtyId = UUID.randomUUID();

                UUID lineId = UUID.randomUUID();
                InvoiceLine line = InvoiceLine.create(
                                lineId, invoiceId, InvoiceLineType.SERVICE_FEE, "Khám bệnh",
                                visitId, 1, new BigDecimal("100000"), new BigDecimal("100000"), NOW);
                Invoice invoice = Invoice.restore(
                                invoiceId, "HD-20260925-001", visitId, UUID.randomUUID(), InvoiceType.ORIGINAL,
                                null, null, new BigDecimal("100000"), ACTOR_ID, NOW,
                                1, NOW.minusSeconds(3600), List.of(line));

                Visit visit = Visit.restore(
                                visitId, "KB-001", patientId, doctorId, null, null, specialtyId,
                                VisitType.WALK_IN, VisitStatus.COMPLETED,
                                NOW.minusSeconds(7200), NOW.minusSeconds(3600), NOW,
                                "Lý do khám", "Ghi chú", ACTOR_ID, NOW, NOW);

                Patient patient = mock(Patient.class);
                when(patient.getId()).thenReturn(patientId);
                when(patient.getPatientCode()).thenReturn("BN-001");
                when(patient.getFullName()).thenReturn("Nguyễn Văn A");
                when(patient.getDateOfBirth()).thenReturn(LocalDate.of(1990, 1, 1));
                when(patient.getGender()).thenReturn(Gender.MALE);
                when(patient.getPhone()).thenReturn("0901234567");

                User user = mock(User.class);
                when(user.getId()).thenReturn(ACTOR_ID);
                when(user.getFullName()).thenReturn("Lễ tân");

                Specialty specialty = mock(Specialty.class);
                when(specialty.getId()).thenReturn(specialtyId);
                when(specialty.getName()).thenReturn("Nội");

                DocumentPrintTemplate template = DocumentPrintTemplate.create(
                                PrintDocumentType.INVOICE,
                                "Mẫu mới nhất",
                                "HÓA ĐƠN ĐIỆN TỬ MỚI",
                                "http://logo-moi.png",
                                "MST Mới: 999999",
                                "Chân trang mới cập nhật",
                                true,
                                "{}",
                                NOW);

                when(invoiceRepository.findById(invoiceId)).thenReturn(Optional.of(invoice));
                when(visitRepository.findById(visitId)).thenReturn(Optional.of(visit));
                when(patientRepository.findById(patientId)).thenReturn(Optional.of(patient));
                when(userRepository.findById(any())).thenReturn(Optional.of(user));
                when(specialtyRepository.findById(any())).thenReturn(Optional.of(specialty));
                when(clinicConfigurationRepository.find()).thenReturn(Optional.empty());
                when(documentPrintTemplateRepository.findByDocumentType(PrintDocumentType.INVOICE))
                                .thenReturn(Optional.of(template));
                when(invoicePdfRenderer.render(any(InvoicePrintDocument.class)))
                                .thenReturn("%PDF-1.4 dummy invoice".getBytes());

                InvoicePrintResult result = service.print(invoiceId);

                assertNotNull(result);
                assertEquals("hoa-don-HD-20260925-001.pdf", result.fileName());

                // Verify reprint metadata was NOT modified by GET /print (idempotent read)
                assertEquals(1, invoice.getReprintCount());
                verify(invoiceRepository, never()).updateReprintMetadata(any(), any(Integer.class), any());

                // Verify template parameters were passed to renderer
                ArgumentCaptor<InvoicePrintDocument> docCaptor = ArgumentCaptor.forClass(InvoicePrintDocument.class);
                verify(invoicePdfRenderer).render(docCaptor.capture());
                InvoicePrintDocument capturedDoc = docCaptor.getValue();
                assertEquals("HÓA ĐƠN ĐIỆN TỬ MỚI", capturedDoc.title());
                assertEquals("http://logo-moi.png", capturedDoc.logoUrl());
                assertEquals("MST Mới: 999999", capturedDoc.legalInfo());
                assertEquals("Chân trang mới cập nhật", capturedDoc.footerText());
                assertEquals(1, capturedDoc.reprintCount());

                // Verify audit log recorded EXPORT
                ArgumentCaptor<AuditLog> auditCaptor = ArgumentCaptor.forClass(AuditLog.class);
                verify(auditLogRepository).save(auditCaptor.capture());
                assertEquals(ActionType.EXPORT, auditCaptor.getValue().getActionType());
        }
}
