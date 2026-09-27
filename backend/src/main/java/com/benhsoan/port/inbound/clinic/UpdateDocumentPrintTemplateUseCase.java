package com.benhsoan.port.inbound.clinic;

import com.benhsoan.port.dto.command.clinic.UpdateDocumentPrintTemplateCommand;
import com.benhsoan.port.dto.result.clinic.DocumentPrintTemplateResult;

public interface UpdateDocumentPrintTemplateUseCase {

    DocumentPrintTemplateResult update(UpdateDocumentPrintTemplateCommand command);
}
