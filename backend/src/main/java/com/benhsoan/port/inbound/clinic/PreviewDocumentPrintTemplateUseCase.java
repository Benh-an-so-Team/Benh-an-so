package com.benhsoan.port.inbound.clinic;

import com.benhsoan.port.dto.command.clinic.PreviewDocumentPrintTemplateCommand;

public interface PreviewDocumentPrintTemplateUseCase {

    byte[] preview(PreviewDocumentPrintTemplateCommand command);
}
