package com.benhsoan.domain.clinic;

import java.time.Instant;
import java.util.UUID;

import com.benhsoan.domain.clinic.enums.PrintDocumentType;
import com.benhsoan.domain.shared.Guard.Guard;
import com.benhsoan.domain.shared.exception.ValidationException;

import lombok.Getter;

@Getter
public class DocumentPrintTemplate {

    private static final int MAX_TEMPLATE_NAME_LENGTH = 150;
    private static final int MAX_TITLE_LENGTH = 255;
    private static final int MAX_URL_LENGTH = 1000;
    private static final int MAX_TEXT_LENGTH = 1000;

    private final UUID id;
    private final PrintDocumentType documentType;
    private String templateName;
    private String title;
    private String logoUrl;
    private String legalInfo;
    private String footerText;
    private boolean showLogo;
    private String fieldVisibility;
    private final Instant createdAt;
    private Instant updatedAt;

    private DocumentPrintTemplate(
            UUID id,
            PrintDocumentType documentType,
            String templateName,
            String title,
            String logoUrl,
            String legalInfo,
            String footerText,
            boolean showLogo,
            String fieldVisibility,
            Instant createdAt,
            Instant updatedAt
    ) {
        this.id = Guard.require(id, "Id");
        this.documentType = Guard.require(documentType, "Document type");
        this.templateName = validateRequired(templateName, "Template name", MAX_TEMPLATE_NAME_LENGTH);
        this.title = validateRequired(title, "Title", MAX_TITLE_LENGTH);
        this.logoUrl = validateOptional(logoUrl, "Logo URL", MAX_URL_LENGTH);
        this.legalInfo = validateOptional(legalInfo, "Legal info", MAX_TEXT_LENGTH);
        this.footerText = validateOptional(footerText, "Footer text", MAX_TEXT_LENGTH);
        this.showLogo = showLogo;
        this.fieldVisibility = fieldVisibility;
        this.createdAt = Guard.require(createdAt, "Created at");
        this.updatedAt = Guard.require(updatedAt, "Updated at");
    }

    public static DocumentPrintTemplate create(
            PrintDocumentType documentType,
            String templateName,
            String title,
            String logoUrl,
            String legalInfo,
            String footerText,
            boolean showLogo,
            String fieldVisibility,
            Instant now
    ) {
        return new DocumentPrintTemplate(
                UUID.randomUUID(),
                documentType,
                templateName,
                title,
                logoUrl,
                legalInfo,
                footerText,
                showLogo,
                fieldVisibility,
                now,
                now
        );
    }

    public static DocumentPrintTemplate reconstitute(
            UUID id,
            PrintDocumentType documentType,
            String templateName,
            String title,
            String logoUrl,
            String legalInfo,
            String footerText,
            boolean showLogo,
            String fieldVisibility,
            Instant createdAt,
            Instant updatedAt
    ) {
        return new DocumentPrintTemplate(
                id,
                documentType,
                templateName,
                title,
                logoUrl,
                legalInfo,
                footerText,
                showLogo,
                fieldVisibility,
                createdAt,
                updatedAt
        );
    }

    public void update(
            String templateName,
            String title,
            String logoUrl,
            String legalInfo,
            String footerText,
            boolean showLogo,
            String fieldVisibility,
            Instant updatedAt
    ) {
        this.templateName = validateRequired(templateName, "Template name", MAX_TEMPLATE_NAME_LENGTH);
        this.title = validateRequired(title, "Title", MAX_TITLE_LENGTH);
        this.logoUrl = validateOptional(logoUrl, "Logo URL", MAX_URL_LENGTH);
        this.legalInfo = validateOptional(legalInfo, "Legal info", MAX_TEXT_LENGTH);
        this.footerText = validateOptional(footerText, "Footer text", MAX_TEXT_LENGTH);
        this.showLogo = showLogo;
        this.fieldVisibility = fieldVisibility;
        this.updatedAt = Guard.require(updatedAt, "Updated at");
    }

    private static String validateRequired(String value, String fieldName, int maxLength) {
        if (value == null || value.trim().isEmpty()) {
            throw new ValidationException(fieldName + " is required.");
        }
        String trimmed = value.trim();
        if (trimmed.length() > maxLength) {
            throw new ValidationException(fieldName + " must not exceed " + maxLength + " characters.");
        }
        return trimmed;
    }

    private static String validateOptional(String value, String fieldName, int maxLength) {
        if (value == null || value.trim().isEmpty()) {
            return null;
        }
        String trimmed = value.trim();
        if (trimmed.length() > maxLength) {
            throw new ValidationException(fieldName + " must not exceed " + maxLength + " characters.");
        }
        return trimmed;
    }
}
