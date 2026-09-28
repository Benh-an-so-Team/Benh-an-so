package com.benhsoan.port.dto.result.personaldata;

import java.util.List;

/**
 * NCL-15-CN-006 TC-02: the outcome of a deadline review, split so the caller can
 * persist distinct UPCOMING and OVERDUE alerts for each affected request.
 */
public record PersonalDataRequestDeadlineReviewResult(
        List<PersonalDataRequestResult> overdueRequests,
        List<PersonalDataRequestResult> upcomingRequests
) {
}
