package com.benhsoan.port.inbound.prescription;

import com.benhsoan.port.dto.result.PrescriptionResult;

public interface GetPrescriptionByCodeUseCase {

    PrescriptionResult getByCode(String prescriptionCode);
}
