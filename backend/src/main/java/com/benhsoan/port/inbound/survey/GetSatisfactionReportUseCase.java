package com.benhsoan.port.inbound.survey;

import java.time.LocalDate;
import java.util.UUID;

import com.benhsoan.port.dto.result.survey.SatisfactionReportResult;

public interface GetSatisfactionReportUseCase {

    SatisfactionReportResult getReport(LocalDate from, LocalDate to, UUID doctorId);
}
