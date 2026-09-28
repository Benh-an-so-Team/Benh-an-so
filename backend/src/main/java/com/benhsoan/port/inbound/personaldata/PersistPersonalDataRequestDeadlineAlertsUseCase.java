package com.benhsoan.port.inbound.personaldata;

import com.benhsoan.port.dto.result.personaldata.PersonalDataRequestDeadlineReviewResult;

public interface PersistPersonalDataRequestDeadlineAlertsUseCase {

    /**
     * Persists deduplicated UPCOMING/OVERDUE alerts for every request found by a
     * deadline review.
     *
     * @return the number of new alerts persisted (already-existing alerts are skipped).
     */
    int persist(PersonalDataRequestDeadlineReviewResult review);
}
