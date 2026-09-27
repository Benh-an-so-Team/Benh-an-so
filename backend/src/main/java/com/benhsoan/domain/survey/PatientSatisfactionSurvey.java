package com.benhsoan.domain.survey;

import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

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
public class PatientSatisfactionSurvey {

    public static final int MIN_SCORE = 1;
    public static final int MAX_SCORE = 5;
    public static final int MAX_COMMENT_LENGTH = 1000;

    private UUID id;
    private UUID visitId;
    private UUID patientId;
    private UUID doctorId;
    private int score;
    private String comment;
    private Instant createdAt;
    private Instant updatedAt;

    private PatientSatisfactionSurvey(
            UUID id,
            UUID visitId,
            UUID patientId,
            UUID doctorId,
            int score,
            String comment,
            Instant createdAt,
            Instant updatedAt
    ) {
        this.id = Guard.require(id, "Survey id");
        this.visitId = Guard.require(visitId, "Visit id");
        this.patientId = Guard.require(patientId, "Patient id");
        this.doctorId = Guard.require(doctorId, "Doctor id");
        this.score = validateScore(score);
        this.comment = validateComment(comment);
        this.createdAt = Guard.require(createdAt, "Created at");
        this.updatedAt = updatedAt;
    }

    public static PatientSatisfactionSurvey create(
            UUID visitId,
            UUID patientId,
            UUID doctorId,
            int score,
            String comment,
            Instant now
    ) {
        return new PatientSatisfactionSurvey(
                UUID.randomUUID(),
                visitId,
                patientId,
                doctorId,
                score,
                comment,
                Objects.requireNonNull(now, "Created at is required."),
                null
        );
    }

    public static PatientSatisfactionSurvey restore(
            UUID id,
            UUID visitId,
            UUID patientId,
            UUID doctorId,
            int score,
            String comment,
            Instant createdAt,
            Instant updatedAt
    ) {
        return new PatientSatisfactionSurvey(
                id,
                visitId,
                patientId,
                doctorId,
                score,
                comment,
                createdAt,
                updatedAt
        );
    }

    public void update(int newScore, String newComment, Instant now) {
        this.score = validateScore(newScore);
        this.comment = validateComment(newComment);
        this.updatedAt = Objects.requireNonNull(now, "Updated at is required.");
    }

    private static int validateScore(int score) {
        if (score < MIN_SCORE || score > MAX_SCORE) {
            throw new ValidationException("Score must be between " + MIN_SCORE + " and " + MAX_SCORE + ".");
        }
        return score;
    }

    private static String validateComment(String comment) {
        if (comment == null) {
            return null;
        }
        String trimmed = comment.trim();
        if (trimmed.isEmpty()) {
            return null;
        }
        if (trimmed.length() > MAX_COMMENT_LENGTH) {
            throw new ValidationException("Comment must not exceed " + MAX_COMMENT_LENGTH + " characters.");
        }
        return trimmed;
    }
}
