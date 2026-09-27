package com.benhsoan.port.dto.result.clinic;

import java.time.Instant;
import java.util.UUID;

import com.benhsoan.domain.clinic.enums.PrintDocumentType;

public record DocumentPrintTemplateResult(
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
}
