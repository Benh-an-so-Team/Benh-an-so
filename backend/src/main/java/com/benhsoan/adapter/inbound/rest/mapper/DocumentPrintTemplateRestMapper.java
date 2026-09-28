package com.benhsoan.adapter.inbound.rest.mapper;

import org.springframework.stereotype.Component;

import com.benhsoan.adapter.inbound.rest.request.clinic.PreviewDocumentPrintTemplateRequest;
import com.benhsoan.adapter.inbound.rest.request.clinic.UpdateDocumentPrintTemplateRequest;
import com.benhsoan.adapter.inbound.rest.response.clinic.DocumentPrintTemplateResponse;
import com.benhsoan.domain.clinic.enums.PrintDocumentType;
import com.benhsoan.port.dto.command.clinic.PreviewDocumentPrintTemplateCommand;
import com.benhsoan.port.dto.command.clinic.UpdateDocumentPrintTemplateCommand;
import com.benhsoan.port.dto.result.clinic.DocumentPrintTemplateResult;

@Component
public class DocumentPrintTemplateRestMapper {

    public DocumentPrintTemplateResponse toResponse(DocumentPrintTemplateResult result) {
        if (result == null) {
            return null;
        }
        return new DocumentPrintTemplateResponse(
                result.id(),
                result.documentType(),
                result.templateName(),
                result.title(),
                result.logoUrl(),
                result.legalInfo(),
                result.footerText(),
                result.showLogo(),
                result.fieldVisibility(),
                result.createdAt(),
                result.updatedAt()
        );
    }

    public UpdateDocumentPrintTemplateCommand toCommand(PrintDocumentType documentType, UpdateDocumentPrintTemplateRequest request) {
        if (request == null) {
            return null;
        }
        return new UpdateDocumentPrintTemplateCommand(
                documentType,
                request.templateName(),
                request.title(),
                request.logoUrl(),
                request.legalInfo(),
                request.footerText(),
                request.showLogo(),
                request.fieldVisibility()
        );
    }

    public PreviewDocumentPrintTemplateCommand toCommand(PreviewDocumentPrintTemplateRequest request) {
        if (request == null) {
            return null;
        }
        return new PreviewDocumentPrintTemplateCommand(
                request.documentType(),
                request.templateName(),
                request.title(),
                request.logoUrl(),
                request.legalInfo(),
                request.footerText(),
                request.showLogo(),
                request.fieldVisibility()
        );
    }
}
