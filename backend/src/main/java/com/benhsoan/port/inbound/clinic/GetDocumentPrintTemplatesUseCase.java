package com.benhsoan.port.inbound.clinic;

import java.util.List;

import com.benhsoan.domain.clinic.enums.PrintDocumentType;
import com.benhsoan.port.dto.result.clinic.DocumentPrintTemplateResult;

public interface GetDocumentPrintTemplatesUseCase {

    List<DocumentPrintTemplateResult> getAll();

    DocumentPrintTemplateResult getByDocumentType(PrintDocumentType documentType);
}
