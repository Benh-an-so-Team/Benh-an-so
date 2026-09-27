package com.benhsoan.domain.personaldata;

import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

import com.benhsoan.domain.personaldata.enums.PersonalDataRequestStatus;
import com.benhsoan.domain.personaldata.exception.PersonalDataRequestAlreadyCompletedException;
import com.benhsoan.domain.shared.Guard.Guard;
import com.benhsoan.domain.shared.exception.ValidationException;

import lombok.AccessLevel;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.ToString;

@Getter
@ToString
@EqualsAndHashCode(of = "id")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class PersonalDataRequest {

    /**
     * Request type explicitly named by the workbook (NCL-15-CN-006 TC-01:
     * "xin bản sao hồ sơ"). The type is an open string so future request
     * categories can be recorded without schema change; no whitelist is
     * enforced here.
     */
    public static final String TYPE_MEDICAL_RECORD_COPY = "MEDICAL_RECORD_COPY";

    public static final int MAX_REQUEST_TYPE_LENGTH = 50;
    public static final int MAX_REASON_LENGTH = 2000;
    public static final int MAX_RESULT_LENGTH = 2000;

    private UUID id;
    private UUID patientId;
    private String requestType;
    private PersonalDataRequestStatus status;
    private String reason;
    private Instant receivedAt;
    private Instant dueAt;
    private String result;
    private Instant completedAt;
    private UUID processedBy;
    private Instant createdAt;
    private Instant updatedAt;

    private PersonalDataRequest(
            UUID id,
            UUID patientId,
            String requestType,
            PersonalDataRequestStatus status,
            String reason,
            Instant receivedAt,
            Instant dueAt,
            String result,
            Instant completedAt,
            UUID processedBy,
            Instant createdAt,
            Instant updatedAt
    ) {
        this.id = Guard.require(id, "Personal data request id");
        this.patientId = Guard.require(patientId, "Patient id");
        this.requestType = requireText(requestType, "Request type", MAX_REQUEST_TYPE_LENGTH);
        this.status = Guard.require(status, "Request status");
        this.reason = optionalText(reason, MAX_REASON_LENGTH);
        this.receivedAt = Guard.require(receivedAt, "Received at");
        this.dueAt = Guard.require(dueAt, "Due at");
        if (this.dueAt.isBefore(this.receivedAt)) {
            throw new ValidationException("Due date must not be before the received date.");
        }
        this.result = optionalText(result, MAX_RESULT_LENGTH);
        this.completedAt = completedAt;
        this.processedBy = processedBy;
        this.createdAt = Guard.require(createdAt, "Created at");
        this.updatedAt = updatedAt;
    }

    public static PersonalDataRequest create(
            UUID patientId,
            String requestType,
            String reason,
            Instant receivedAt,
            Instant dueAt
    ) {
        return new PersonalDataRequest(
                UUID.randomUUID(),
                patientId,
                requestType,
                PersonalDataRequestStatus.RECEIVED,
                reason,
                receivedAt,
                dueAt,
                null,
                null,
                null,
                receivedAt,
                null
        );
    }

    public static PersonalDataRequest restore(
            UUID id,
            UUID patientId,
            String requestType,
            PersonalDataRequestStatus status,
            String reason,
            Instant receivedAt,
            Instant dueAt,
            String result,
            Instant completedAt,
            UUID processedBy,
            Instant createdAt,
            Instant updatedAt
    ) {
        return new PersonalDataRequest(
                id,
                patientId,
                requestType,
                status,
                reason,
                receivedAt,
                dueAt,
                result,
                completedAt,
                processedBy,
                createdAt,
                updatedAt
        );
    }

    public void complete(String processingResult, UUID processorId, Instant now) {
        if (this.status == PersonalDataRequestStatus.COMPLETED) {
            throw new PersonalDataRequestAlreadyCompletedException(this.id);
        }
        this.result = requireText(processingResult, "Result", MAX_RESULT_LENGTH);
        this.processedBy = Guard.require(processorId, "Processor id");
        this.status = PersonalDataRequestStatus.COMPLETED;
        this.completedAt = Objects.requireNonNull(now, "Completed at is required.");
        this.updatedAt = now;
    }

    public boolean isOverdue(Instant now) {
        return this.status == PersonalDataRequestStatus.RECEIVED
                && this.dueAt.isBefore(now);
    }

    private static String requireText(String value, String field, int maxLength) {
        if (value == null || value.isBlank()) {
            throw new ValidationException(field + " is required.");
        }
        String trimmed = value.trim();
        if (trimmed.length() > maxLength) {
            throw new ValidationException(field + " must not exceed " + maxLength + " characters.");
        }
        return trimmed;
    }

    private static String optionalText(String value, int maxLength) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        if (trimmed.isEmpty()) {
            return null;
        }
        if (trimmed.length() > maxLength) {
            throw new ValidationException("Value must not exceed " + maxLength + " characters.");
        }
        return trimmed;
    }
}
