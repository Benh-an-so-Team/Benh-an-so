package com.benhsoan.application.ucservice.clinic;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.benhsoan.domain.auditlog.AuditLog;
import com.benhsoan.domain.auditlog.enums.ActionType;
import com.benhsoan.domain.auditlog.enums.ResourceType;
import com.benhsoan.domain.clinic.DocumentPrintTemplate;
import com.benhsoan.domain.clinic.exception.PrintTemplateNotFoundException;
import com.benhsoan.domain.shared.exception.ValidationException;
import com.benhsoan.port.dto.command.clinic.UpdateDocumentPrintTemplateCommand;
import com.benhsoan.port.dto.result.clinic.DocumentPrintTemplateResult;
import com.benhsoan.port.inbound.clinic.UpdateDocumentPrintTemplateUseCase;
import com.benhsoan.port.outbound.repository.audit.AuditLogRepository;
import com.benhsoan.port.outbound.repository.clinic.DocumentPrintTemplateRepository;
import com.benhsoan.port.outbound.security.CurrentUserPort;
import com.benhsoan.port.outbound.time.ClockPort;
import com.fasterxml.jackson.databind.ObjectMapper;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
@Transactional
public class UpdateDocumentPrintTemplateService implements UpdateDocumentPrintTemplateUseCase {

    private final DocumentPrintTemplateRepository repository;
    private final AuditLogRepository auditLogRepository;
    private final CurrentUserPort currentUserPort;
    private final ClockPort clockPort;
    private final ObjectMapper objectMapper;

    @Override
    public DocumentPrintTemplateResult update(UpdateDocumentPrintTemplateCommand command) {
        if (command == null) {
            throw new ValidationException("Update document print template command is required.");
        }
        if (command.documentType() == null) {
            throw new ValidationException("Document type is required.");
        }

        DocumentPrintTemplate existing = repository.findByDocumentType(command.documentType())
                .orElseThrow(() -> new PrintTemplateNotFoundException(command.documentType()));

        Map<String, Object> before = captureSnapshot(existing);

        Instant now = clockPort.now();
        boolean showLogo = command.showLogo() != null ? command.showLogo() : existing.isShowLogo();

        existing.update(
                command.templateName() != null ? command.templateName() : existing.getTemplateName(),
                command.title() != null ? command.title() : existing.getTitle(),
                command.logoUrl(),
                command.legalInfo(),
                command.footerText(),
                showLogo,
                command.fieldVisibility(),
                now
        );

        DocumentPrintTemplate saved = repository.save(existing);
        Map<String, Object> after = captureSnapshot(saved);

        auditUpdate(saved.getId(), saved.getDocumentType().name(), before, after, now);

        return toResult(saved);
    }

    private Map<String, Object> captureSnapshot(DocumentPrintTemplate template) {
        Map<String, Object> snapshot = new LinkedHashMap<>();
        snapshot.put("documentType", template.getDocumentType().name());
        snapshot.put("templateName", template.getTemplateName());
        snapshot.put("title", template.getTitle());
        snapshot.put("logoUrl", template.getLogoUrl());
        snapshot.put("legalInfo", template.getLegalInfo());
        snapshot.put("footerText", template.getFooterText());
        snapshot.put("showLogo", template.isShowLogo());
        snapshot.put("fieldVisibility", template.getFieldVisibility());
        return snapshot;
    }

    private void auditUpdate(
            UUID resourceId,
            String documentTypeName,
            Map<String, Object> before,
            Map<String, Object> after,
            Instant now
    ) {
        UUID actorId = currentUserPort.getCurrentUserId();
        Map<String, Object> detailMap = new LinkedHashMap<>();
        detailMap.put("documentType", documentTypeName);
        detailMap.put("before", before);
        detailMap.put("after", after);
        detailMap.put("summary", "Updated print template for " + documentTypeName);

        String detailJson;
        try {
            detailJson = objectMapper.writeValueAsString(detailMap);
        } catch (Exception ex) {
            detailJson = "{\"documentType\":\"" + documentTypeName + "\",\"summary\":\"Updated print template\"}";
        }

        auditLogRepository.save(AuditLog.create(
                actorId,
                ActionType.UPDATE,
                ResourceType.CONFIGURATION,
                resourceId,
                detailJson,
                null,
                now
        ));
    }

    private DocumentPrintTemplateResult toResult(DocumentPrintTemplate template) {
        return new DocumentPrintTemplateResult(
                template.getId(),
                template.getDocumentType(),
                template.getTemplateName(),
                template.getTitle(),
                template.getLogoUrl(),
                template.getLegalInfo(),
                template.getFooterText(),
                template.isShowLogo(),
                template.getFieldVisibility(),
                template.getCreatedAt(),
                template.getUpdatedAt()
        );
    }
}
