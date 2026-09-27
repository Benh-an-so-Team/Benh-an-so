package com.benhsoan.domain.survey;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.time.Instant;
import java.util.UUID;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import com.benhsoan.domain.shared.exception.ValidationException;

class PatientSatisfactionSurveyTest {

    private final UUID visitId = UUID.randomUUID();
    private final UUID patientId = UUID.randomUUID();
    private final UUID doctorId = UUID.randomUUID();
    private final Instant now = Instant.parse("2026-09-25T10:00:00Z");

    @Test
    @DisplayName("Tạo khảo sát thành công với điểm số và nhận xét hợp lệ")
    void createSuccess() {
        PatientSatisfactionSurvey survey = PatientSatisfactionSurvey.create(
                visitId, patientId, doctorId, 5, "Bác sĩ rất tận tình", now
        );

        assertNotNull(survey.getId());
        assertEquals(visitId, survey.getVisitId());
        assertEquals(patientId, survey.getPatientId());
        assertEquals(doctorId, survey.getDoctorId());
        assertEquals(5, survey.getScore());
        assertEquals("Bác sĩ rất tận tình", survey.getComment());
        assertEquals(now, survey.getCreatedAt());
        assertNull(survey.getUpdatedAt());
    }

    @ParameterizedTest
    @ValueSource(ints = {1, 2, 3, 4, 5})
    @DisplayName("Thang điểm từ 1 đến 5 đều hợp lệ")
    void validScores(int score) {
        PatientSatisfactionSurvey survey = PatientSatisfactionSurvey.create(
                visitId, patientId, doctorId, score, null, now
        );
        assertEquals(score, survey.getScore());
    }

    @ParameterizedTest
    @ValueSource(ints = {-1, 0, 6, 10})
    @DisplayName("Thang điểm ngoài khoảng 1-5 sẽ ném ValidationException")
    void invalidScoresThrowException(int score) {
        assertThrows(ValidationException.class, () -> PatientSatisfactionSurvey.create(
                visitId, patientId, doctorId, score, "Nhận xét", now
        ));
    }

    @Test
    @DisplayName("Nhận xét trống hoặc khoảng trắng được chuẩn hóa thành null")
    void blankCommentNormalizedToNull() {
        PatientSatisfactionSurvey survey1 = PatientSatisfactionSurvey.create(
                visitId, patientId, doctorId, 4, null, now
        );
        assertNull(survey1.getComment());

        PatientSatisfactionSurvey survey2 = PatientSatisfactionSurvey.create(
                visitId, patientId, doctorId, 4, "   ", now
        );
        assertNull(survey2.getComment());
    }

    @Test
    @DisplayName("Nhận xét vượt quá 1000 ký tự sẽ ném ValidationException")
    void commentExceedingMaxLengthThrowsException() {
        String longComment = "a".repeat(1001);
        assertThrows(ValidationException.class, () -> PatientSatisfactionSurvey.create(
                visitId, patientId, doctorId, 4, longComment, now
        ));
    }

    @Test
    @DisplayName("Cập nhật khảo sát thành công")
    void updateSuccess() {
        PatientSatisfactionSurvey survey = PatientSatisfactionSurvey.create(
                visitId, patientId, doctorId, 3, "Bình thường", now
        );

        Instant updateTime = now.plusSeconds(3600);
        survey.update(4, "Đã cải thiện", updateTime);

        assertEquals(4, survey.getScore());
        assertEquals("Đã cải thiện", survey.getComment());
        assertEquals(updateTime, survey.getUpdatedAt());
    }

    @Test
    @DisplayName("Cập nhật với điểm không hợp lệ sẽ ném ValidationException")
    void updateInvalidScoreThrowsException() {
        PatientSatisfactionSurvey survey = PatientSatisfactionSurvey.create(
                visitId, patientId, doctorId, 3, "Bình thường", now
        );

        Instant updateTime = now.plusSeconds(3600);
        assertThrows(ValidationException.class, () -> survey.update(0, "Mới", updateTime));
    }
}
