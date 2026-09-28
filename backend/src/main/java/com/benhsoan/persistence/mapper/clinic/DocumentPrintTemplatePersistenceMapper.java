package com.benhsoan.persistence.mapper.clinic;

import org.springframework.stereotype.Component;

import com.benhsoan.domain.clinic.DocumentPrintTemplate;
import com.benhsoan.domain.clinic.enums.PrintDocumentType;
import com.benhsoan.persistence.entity.clinic.DocumentPrintTemplateEntity;

@Component
public class DocumentPrintTemplatePersistenceMapper {

    public DocumentPrintTemplate toDomain(DocumentPrintTemplateEntity entity) {
        if (entity == null) {
            return null;
        }

        return DocumentPrintTemplate.reconstitute(
                entity.getId(),
                PrintDocumentType.valueOf(entity.getDocumentType()),
                entity.getTemplateName(),
                entity.getTitle(),
                entity.getLogoUrl(),
                entity.getLegalInfo(),
                entity.getFooterText(),
                entity.isShowLogo(),
                entity.getFieldVisibility(),
                entity.getCreatedAt(),
                entity.getUpdatedAt()
        );
    }

    public DocumentPrintTemplateEntity toEntity(DocumentPrintTemplate domain) {
        if (domain == null) {
            return null;
        }

        return DocumentPrintTemplateEntity.builder()
                .id(domain.getId())
                .documentType(domain.getDocumentType().name())
                .templateName(domain.getTemplateName())
                .title(domain.getTitle())
                .logoUrl(domain.getLogoUrl())
                .legalInfo(domain.getLegalInfo())
                .footerText(domain.getFooterText())
                .showLogo(domain.isShowLogo())
                .fieldVisibility(domain.getFieldVisibility())
                .createdAt(domain.getCreatedAt())
                .updatedAt(domain.getUpdatedAt())
                .build();
    }
}
