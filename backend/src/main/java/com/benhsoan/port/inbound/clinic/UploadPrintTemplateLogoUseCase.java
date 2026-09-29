package com.benhsoan.port.inbound.clinic;

import com.benhsoan.port.dto.command.clinic.UploadPrintTemplateLogoCommand;

public interface UploadPrintTemplateLogoUseCase {

    String uploadLogo(UploadPrintTemplateLogoCommand command);
}
