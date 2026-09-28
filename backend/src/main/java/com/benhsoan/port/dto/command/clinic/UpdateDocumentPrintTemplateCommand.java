package com.benhsoan.port.dto.command.clinic;

import com.benhsoan.domain.clinic.enums.PrintDocumentType;

public record UpdateDocumentPrintTemplateCommand(
        PrintDocumentType documentType,
        String templateName,
        String title,
        String logoUrl,
        String legalInfo,
        String footerText,
        Boolean showLogo,
        String fieldVisibility
) {
}
