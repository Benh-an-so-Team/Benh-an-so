package com.benhsoan.domain.clinic.exception;

import java.util.UUID;

import com.benhsoan.domain.clinic.enums.PrintDocumentType;
import com.benhsoan.domain.shared.exception.DomainErrorCode;
import com.benhsoan.domain.shared.exception.DomainException;

public class PrintTemplateNotFoundException extends DomainException {

    public PrintTemplateNotFoundException(UUID id) {
        super(DomainErrorCode.PRINT_TEMPLATE_NOT_FOUND, "Print template not found: " + id);
    }

    public PrintTemplateNotFoundException(PrintDocumentType documentType) {
        super(DomainErrorCode.PRINT_TEMPLATE_NOT_FOUND, "Print template not found for document type: " + documentType);
    }
}
