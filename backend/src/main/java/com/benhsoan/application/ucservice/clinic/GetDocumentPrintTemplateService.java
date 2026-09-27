package com.benhsoan.application.ucservice.clinic;

import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.benhsoan.domain.clinic.DocumentPrintTemplate;
import com.benhsoan.domain.clinic.enums.PrintDocumentType;
import com.benhsoan.domain.clinic.exception.PrintTemplateNotFoundException;
import com.benhsoan.port.dto.result.clinic.DocumentPrintTemplateResult;
import com.benhsoan.port.inbound.clinic.GetDocumentPrintTemplatesUseCase;
import com.benhsoan.port.outbound.repository.clinic.DocumentPrintTemplateRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class GetDocumentPrintTemplateService implements GetDocumentPrintTemplatesUseCase {

    private final DocumentPrintTemplateRepository repository;

    @Override
    public List<DocumentPrintTemplateResult> getAll() {
        return repository.findAll().stream()
                .map(this::toResult)
                .toList();
    }

    @Override
    public DocumentPrintTemplateResult getByDocumentType(PrintDocumentType documentType) {
        if (documentType == null) {
            throw new PrintTemplateNotFoundException((PrintDocumentType) null);
        }
        return repository.findByDocumentType(documentType)
                .map(this::toResult)
                .orElseThrow(() -> new PrintTemplateNotFoundException(documentType));
    }

    DocumentPrintTemplateResult toResult(DocumentPrintTemplate template) {
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
