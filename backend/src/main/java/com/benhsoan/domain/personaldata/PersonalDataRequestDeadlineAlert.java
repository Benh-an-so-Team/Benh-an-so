package com.benhsoan.domain.personaldata;

import java.time.Instant;
import java.util.UUID;

import com.benhsoan.domain.personaldata.enums.PersonalDataRequestDeadlineAlertType;
import com.benhsoan.domain.shared.Guard.Guard;

import lombok.AccessLevel;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.ToString;

/**
 * NCL-15-CN-006 TC-02: a persisted, administrator-visible alert that a personal
 * data request is approaching its deadline (UPCOMING) or has already missed it
 * (OVERDUE). Identity is deterministic per request + alert type so the scheduler
 * does not emit a duplicate alert on every run.
 */
@Getter
@ToString
@EqualsAndHashCode(of = "id")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class PersonalDataRequestDeadlineAlert {

    private UUID id;
    private UUID personalDataRequestId;
    private PersonalDataRequestDeadlineAlertType alertType;
    private Instant createdAt;

    private PersonalDataRequestDeadlineAlert(
            UUID id,
            UUID personalDataRequestId,
            PersonalDataRequestDeadlineAlertType alertType,
            Instant createdAt
    ) {
        this.id = Guard.require(id, "Deadline alert id");
        this.personalDataRequestId = Guard.require(personalDataRequestId, "Personal data request id");
        this.alertType = Guard.require(alertType, "Alert type");
        this.createdAt = Guard.require(createdAt, "Created at");
    }

    public static PersonalDataRequestDeadlineAlert create(
            UUID personalDataRequestId,
            PersonalDataRequestDeadlineAlertType alertType,
            Instant createdAt
    ) {
        return new PersonalDataRequestDeadlineAlert(
                UUID.randomUUID(), personalDataRequestId, alertType, createdAt);
    }

    public static PersonalDataRequestDeadlineAlert restore(
            UUID id,
            UUID personalDataRequestId,
            PersonalDataRequestDeadlineAlertType alertType,
            Instant createdAt
    ) {
        return new PersonalDataRequestDeadlineAlert(id, personalDataRequestId, alertType, createdAt);
    }
}
