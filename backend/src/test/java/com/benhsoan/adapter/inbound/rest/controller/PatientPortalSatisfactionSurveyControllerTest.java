package com.benhsoan.adapter.inbound.rest.controller;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;
import java.util.UUID;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import com.benhsoan.adapter.inbound.rest.mapper.SatisfactionSurveyRestMapper;
import com.benhsoan.domain.survey.exception.SatisfactionSurveyAlreadyExistsException;
import com.benhsoan.domain.survey.exception.SatisfactionSurveyNotFoundException;
import com.benhsoan.exception.GlobalExceptionHandler;
import com.benhsoan.port.dto.result.survey.SatisfactionSurveyResult;
import com.benhsoan.port.inbound.survey.GetPatientSatisfactionSurveyUseCase;
import com.benhsoan.port.inbound.survey.SubmitSatisfactionSurveyUseCase;
import com.benhsoan.port.inbound.survey.UpdateSatisfactionSurveyUseCase;
import com.benhsoan.port.outbound.authSecurity.JwtTokenPort;
import com.benhsoan.port.outbound.repository.auth.UserRepository;
import com.benhsoan.port.outbound.repository.auth.UserSessionRepository;
import com.benhsoan.port.outbound.security.CurrentUserPort;
import com.benhsoan.port.outbound.time.ClockPort;

@WebMvcTest(controllers = PatientPortalSatisfactionSurveyController.class)
@AutoConfigureMockMvc(addFilters = false)
@Import({SatisfactionSurveyRestMapper.class, GlobalExceptionHandler.class})
class PatientPortalSatisfactionSurveyControllerTest {

    @Autowired private MockMvc mockMvc;

    @MockitoBean private SubmitSatisfactionSurveyUseCase submitSatisfactionSurveyUseCase;
    @MockitoBean private UpdateSatisfactionSurveyUseCase updateSatisfactionSurveyUseCase;
    @MockitoBean private GetPatientSatisfactionSurveyUseCase getPatientSatisfactionSurveyUseCase;
    @MockitoBean private CurrentUserPort currentUserPort;
    @MockitoBean private UserRepository userRepository;
    @MockitoBean private UserSessionRepository userSessionRepository;
    @MockitoBean private JwtTokenPort jwtTokenPort;
    @MockitoBean private ClockPort clockPort;

    private final UUID surveyId = UUID.randomUUID();
    private final UUID visitId = UUID.randomUUID();
    private final UUID patientId = UUID.randomUUID();
    private final UUID doctorId = UUID.randomUUID();
    private final Instant now = Instant.parse("2026-09-25T14:00:00Z");

    @Test
    @DisplayName("POST /patient-portal/satisfaction-surveys: Trả về 201 Created khi gửi khảo sát hợp lệ (TC-01)")
    void submitSurvey_Success_Returns201() throws Exception {
        SatisfactionSurveyResult result = new SatisfactionSurveyResult(
                surveyId, visitId, "KB-001", patientId, doctorId, "Dr. Nguyen Minh Anh",
                5, "Tốt lắm", now, null
        );

        when(submitSatisfactionSurveyUseCase.submitSurvey(eq(visitId), eq(5), eq("Tốt lắm")))
                .thenReturn(result);

        String payload = """
                {
                    "visitId": "%s",
                    "score": 5,
                    "comment": "Tốt lắm"
                }
                """.formatted(visitId);

        mockMvc.perform(post("/patient-portal/satisfaction-surveys")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(surveyId.toString()))
                .andExpect(jsonPath("$.visitId").value(visitId.toString()))
                .andExpect(jsonPath("$.score").value(5))
                .andExpect(jsonPath("$.comment").value("Tốt lắm"))
                .andExpect(jsonPath("$.doctorName").value("Dr. Nguyen Minh Anh"));
    }

    @Test
    @DisplayName("POST /patient-portal/satisfaction-surveys: Trả về 409 Conflict khi khảo sát đã tồn tại (TC-02)")
    void submitSurvey_Duplicate_Returns409() throws Exception {
        when(submitSatisfactionSurveyUseCase.submitSurvey(eq(visitId), eq(4), any()))
                .thenThrow(new SatisfactionSurveyAlreadyExistsException(visitId));

        String payload = """
                {
                    "visitId": "%s",
                    "score": 4,
                    "comment": "Đánh giá lần 2"
                }
                """.formatted(visitId);

        mockMvc.perform(post("/patient-portal/satisfaction-surveys")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("SATISFACTION_SURVEY_ALREADY_EXISTS"));
    }

    @Test
    @DisplayName("POST /patient-portal/satisfaction-surveys: Trả về 400 Bad Request khi thiếu visitId hoặc điểm không hợp lệ")
    void submitSurvey_InvalidInput_Returns400() throws Exception {
        String invalidScorePayload = """
                {
                    "visitId": "%s",
                    "score": 6
                }
                """.formatted(visitId);

        mockMvc.perform(post("/patient-portal/satisfaction-surveys")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(invalidScorePayload))
                .andExpect(status().isBadRequest());

        String missingVisitIdPayload = """
                {
                    "score": 4
                }
                """;

        mockMvc.perform(post("/patient-portal/satisfaction-surveys")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(missingVisitIdPayload))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("PUT /patient-portal/satisfaction-surveys/{id}: Trả về 200 OK khi sửa khảo sát thành công (TC-02)")
    void updateSurvey_Success_Returns200() throws Exception {
        SatisfactionSurveyResult result = new SatisfactionSurveyResult(
                surveyId, visitId, "KB-001", patientId, doctorId, "Dr. Nguyen Minh Anh",
                4, "Cập nhật lại nhận xét", now, now.plusSeconds(300)
        );

        when(updateSatisfactionSurveyUseCase.updateSurvey(eq(surveyId), eq(4), eq("Cập nhật lại nhận xét")))
                .thenReturn(result);

        String payload = """
                {
                    "score": 4,
                    "comment": "Cập nhật lại nhận xét"
                }
                """;

        mockMvc.perform(put("/patient-portal/satisfaction-surveys/{id}", surveyId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(surveyId.toString()))
                .andExpect(jsonPath("$.score").value(4))
                .andExpect(jsonPath("$.comment").value("Cập nhật lại nhận xét"));
    }

    @Test
    @DisplayName("PUT /patient-portal/satisfaction-surveys/{id}: Trả về 404 Not Found khi không tìm thấy khảo sát")
    void updateSurvey_NotFound_Returns404() throws Exception {
        when(updateSatisfactionSurveyUseCase.updateSurvey(eq(surveyId), eq(4), any()))
                .thenThrow(new SatisfactionSurveyNotFoundException(surveyId));

        String payload = """
                {
                    "score": 4,
                    "comment": "Sửa"
                }
                """;

        mockMvc.perform(put("/patient-portal/satisfaction-surveys/{id}", surveyId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("SATISFACTION_SURVEY_NOT_FOUND"));
    }

    @Test
    @DisplayName("GET /patient-portal/satisfaction-surveys/by-visit/{visitId}: Trả về 200 OK khi tìm thấy khảo sát theo lượt khám")
    void getSurveyByVisitId_Success_Returns200() throws Exception {
        SatisfactionSurveyResult result = new SatisfactionSurveyResult(
                surveyId, visitId, "KB-001", patientId, doctorId, "Dr. Nguyen Minh Anh",
                5, "Tuyệt vời", now, null
        );

        when(getPatientSatisfactionSurveyUseCase.getSurveyByVisitId(visitId)).thenReturn(result);

        mockMvc.perform(get("/patient-portal/satisfaction-surveys/by-visit/{visitId}", visitId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(surveyId.toString()))
                .andExpect(jsonPath("$.visitId").value(visitId.toString()))
                .andExpect(jsonPath("$.score").value(5));
    }

    @Test
    @DisplayName("GET /patient-portal/satisfaction-surveys/by-visit/{visitId}: Trả về 404 khi chưa có khảo sát")
    void getSurveyByVisitId_NotFound_Returns404() throws Exception {
        when(getPatientSatisfactionSurveyUseCase.getSurveyByVisitId(visitId))
                .thenThrow(new SatisfactionSurveyNotFoundException("Not found"));

        mockMvc.perform(get("/patient-portal/satisfaction-surveys/by-visit/{visitId}", visitId))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("GET /patient-portal/satisfaction-surveys/{id}: Trả về 200 OK khi tìm thấy khảo sát theo ID")
    void getSurveyById_Success_Returns200() throws Exception {
        SatisfactionSurveyResult result = new SatisfactionSurveyResult(
                surveyId, visitId, "KB-001", patientId, doctorId, "Dr. Nguyen Minh Anh",
                5, "Tuyệt vời", now, null
        );

        when(getPatientSatisfactionSurveyUseCase.getSurveyById(surveyId)).thenReturn(result);

        mockMvc.perform(get("/patient-portal/satisfaction-surveys/{id}", surveyId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(surveyId.toString()))
                .andExpect(jsonPath("$.score").value(5));
    }

    @Test
    @DisplayName("POST /patient-portal/satisfaction-surveys: Race condition DB unique constraint trả về 409 SATISFACTION_SURVEY_ALREADY_EXISTS")
    void submitSurvey_RaceConditionDuplicateConstraint_Returns409() throws Exception {
        when(submitSatisfactionSurveyUseCase.submitSurvey(eq(visitId), eq(5), any()))
                .thenThrow(new org.springframework.dao.DataIntegrityViolationException(
                        "Duplicate entry for key 'uq_patient_satisfaction_surveys_visit'"
                ));

        String payload = """
                {
                    "visitId": "%s",
                    "score": 5,
                    "comment": "Rất tốt"
                }
                """.formatted(visitId);

        mockMvc.perform(post("/patient-portal/satisfaction-surveys")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("SATISFACTION_SURVEY_ALREADY_EXISTS"))
                .andExpect(jsonPath("$.message").value("Lượt khám này đã được gửi khảo sát hài lòng."));
    }
}
