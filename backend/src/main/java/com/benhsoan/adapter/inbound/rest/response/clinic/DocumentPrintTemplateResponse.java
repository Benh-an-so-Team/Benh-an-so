package com.benhsoan.adapter.inbound.rest.response.clinic;

import java.time.Instant;
import java.util.UUID;

import com.benhsoan.domain.clinic.enums.PrintDocumentType;

public record DocumentPrintTemplateResponse(
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
