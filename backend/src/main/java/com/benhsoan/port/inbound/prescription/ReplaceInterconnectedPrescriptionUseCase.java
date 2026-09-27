package com.benhsoan.port.inbound.prescription;

import com.benhsoan.port.dto.command.prescription.ReplacePrescriptionCommand;
import com.benhsoan.port.dto.result.PrescriptionReplacementResult;

public interface ReplaceInterconnectedPrescriptionUseCase {

    PrescriptionReplacementResult replace(ReplacePrescriptionCommand command);
}
