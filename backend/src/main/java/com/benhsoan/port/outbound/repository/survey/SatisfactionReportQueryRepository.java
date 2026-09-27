package com.benhsoan.port.outbound.repository.survey;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public interface SatisfactionReportQueryRepository {

    SatisfactionOverallSummary getOverallSummary(Instant fromInclusive, Instant toExclusive, UUID doctorId);

    List<SatisfactionScoreCount> getScoreDistribution(Instant fromInclusive, Instant toExclusive, UUID doctorId);

    List<DoctorSatisfactionSummary> getDoctorSummaries(Instant fromInclusive, Instant toExclusive, UUID doctorId);
}
