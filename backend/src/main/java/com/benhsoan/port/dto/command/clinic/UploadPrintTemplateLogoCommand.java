package com.benhsoan.port.dto.command.clinic;

public record UploadPrintTemplateLogoCommand(
        byte[] content,
        String originalFilename,
        String contentType,
        long size
) {
}
