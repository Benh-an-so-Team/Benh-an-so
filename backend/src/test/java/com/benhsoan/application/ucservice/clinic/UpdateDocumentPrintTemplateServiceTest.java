package com.benhsoan.application.ucservice.clinic;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import com.benhsoan.domain.auditlog.AuditLog;
import com.benhsoan.domain.auditlog.enums.ActionType;
import com.benhsoan.domain.auditlog.enums.ResourceType;
import com.benhsoan.domain.clinic.DocumentPrintTemplate;
import com.benhsoan.domain.clinic.enums.PrintDocumentType;
import com.benhsoan.domain.clinic.exception.PrintTemplateNotFoundException;
import com.benhsoan.port.dto.command.clinic.UpdateDocumentPrintTemplateCommand;
import com.benhsoan.port.dto.result.clinic.DocumentPrintTemplateResult;
import com.benhsoan.port.outbound.repository.audit.AuditLogRepository;
import com.benhsoan.port.outbound.repository.clinic.DocumentPrintTemplateRepository;
import com.benhsoan.port.outbound.security.CurrentUserPort;
import com.benhsoan.port.outbound.time.ClockPort;
import com.fasterxml.jackson.databind.ObjectMapper;

class UpdateDocumentPrintTemplateServiceTest {

        private static final Instant NOW = Instant.parse("2026-09-25T08:00:00Z");
        private static final UUID ACTOR_ID = UUID.randomUUID();

        private final DocumentPrintTemplateRepository repository = mock(DocumentPrintTemplateRepository.class);
        private final AuditLogRepository auditLogRepository = mock(AuditLogRepository.class);
        private final CurrentUserPort currentUserPort = mock(CurrentUserPort.class);
        private final ClockPort clockPort = mock(ClockPort.class);
        private final ObjectMapper objectMapper = new ObjectMapper();

        private UpdateDocumentPrintTemplateService service;

        @BeforeEach
        void setUp() {
                service = new UpdateDocumentPrintTemplateService(
                                repository, auditLogRepository, currentUserPort, clockPort, objectMapper);
                when(clockPort.now()).thenReturn(NOW);
                when(currentUserPort.getCurrentUserId()).thenReturn(ACTOR_ID);
        }

        @Test
        void update_whenValid_updatesTemplateAndRecordsAuditLogWithBeforeAndAfter() {
                DocumentPrintTemplate existing = DocumentPrintTemplate.create(
                                PrintDocumentType.PRESCRIPTION,
                                "Tên cũ",
                                "ĐƠN THUỐC CŨ",
                                "logo-cu.png",
                                "Pháp lý cũ",
                                "Chân trang cũ",
                                true,
                                "{\"field\":\"cu\"}",
                                NOW.minusSeconds(3600));

                when(repository.findByDocumentType(PrintDocumentType.PRESCRIPTION)).thenReturn(Optional.of(existing));
                when(repository.save(any(DocumentPrintTemplate.class)))
                                .thenAnswer(invocation -> invocation.getArgument(0));

                UpdateDocumentPrintTemplateCommand command = new UpdateDocumentPrintTemplateCommand(
                                PrintDocumentType.PRESCRIPTION,
                                "Tên mới",
                                "ĐƠN THUỐC MỚI",
                                "logo-moi.png",
                                "Pháp lý mới: Giấy phép 999",
                                "Chân trang mới: Lời dặn 999",
                                true,
                                "{\"field\":\"moi\"}");

                DocumentPrintTemplateResult result = service.update(command);

                assertEquals("Tên mới", result.templateName());
                assertEquals("ĐƠN THUỐC MỚI", result.title());
                assertEquals("logo-moi.png", result.logoUrl());
                assertEquals("Pháp lý mới: Giấy phép 999", result.legalInfo());
                assertEquals("Chân trang mới: Lời dặn 999", result.footerText());

                ArgumentCaptor<AuditLog> auditCaptor = ArgumentCaptor.forClass(AuditLog.class);
                verify(auditLogRepository).save(auditCaptor.capture());

                AuditLog capturedAudit = auditCaptor.getValue();
                assertEquals(ACTOR_ID, capturedAudit.getUserId());
                assertEquals(ActionType.UPDATE, capturedAudit.getActionType());
                assertEquals(ResourceType.CONFIGURATION, capturedAudit.getResourceType());
                assertEquals(existing.getId(), capturedAudit.getResourceId());
                assertEquals(NOW, capturedAudit.getCreatedAt());

                String detail = capturedAudit.getDetail();
                assertNotNull(detail);
                assertTrue(detail.contains("\"before\""));
                assertTrue(detail.contains("\"after\""));
                assertTrue(detail.contains("ĐƠN THUỐC CŨ"));
                assertTrue(detail.contains("ĐƠN THUỐC MỚI"));
        }

        @Test
        void update_whenNotFound_throwsPrintTemplateNotFoundException() {
                when(repository.findByDocumentType(PrintDocumentType.INVOICE)).thenReturn(Optional.empty());

                UpdateDocumentPrintTemplateCommand command = new UpdateDocumentPrintTemplateCommand(
                                PrintDocumentType.INVOICE,
                                "Tên",
                                "Tiêu đề",
                                null,
                                null,
                                null,
                                true,
                                null);

                org.assertj.core.api.Assertions.assertThatThrownBy(() -> service.update(command))
                                .isInstanceOf(PrintTemplateNotFoundException.class);
        }
}
