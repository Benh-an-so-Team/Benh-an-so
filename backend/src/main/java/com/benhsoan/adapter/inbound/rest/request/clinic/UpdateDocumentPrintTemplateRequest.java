package com.benhsoan.adapter.inbound.rest.request.clinic;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record UpdateDocumentPrintTemplateRequest(
        @NotBlank(message = "Template name is required.")
        @Size(max = 150, message = "Template name must not exceed 150 characters.")
        String templateName,

        @NotBlank(message = "Title is required.")
        @Size(max = 255, message = "Title must not exceed 255 characters.")
        String title,

        @Size(max = 1000, message = "Logo URL must not exceed 1000 characters.")
        String logoUrl,

        @Size(max = 1000, message = "Legal info must not exceed 1000 characters.")
        String legalInfo,

        @Size(max = 1000, message = "Footer text must not exceed 1000 characters.")
        String footerText,

        Boolean showLogo,

        @Size(max = 4000, message = "Field visibility JSON must not exceed 4000 characters.")
        String fieldVisibility
) {
}
