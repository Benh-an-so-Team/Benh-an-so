package com.benhsoan.port.outbound.repository.personaldata;

import java.time.Instant;
import java.util.UUID;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import com.benhsoan.domain.personaldata.PersonalDataRequestDeadlineAlert;
import com.benhsoan.domain.personaldata.enums.PersonalDataRequestDeadlineAlertType;

public interface PersonalDataRequestDeadlineAlertRepository {

    /**
     * Persists an alert only if none exists yet for the same request + alert type.
     *
     * @return {@code true} when a new alert was created, {@code false} when an
     *         identical alert already existed.
     */
    boolean saveIfAbsent(
            UUID personalDataRequestId,
            PersonalDataRequestDeadlineAlertType alertType,
            Instant createdAt);

    Page<PersonalDataRequestDeadlineAlert> findAll(Pageable pageable);
}
