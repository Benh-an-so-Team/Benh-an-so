package com.benhsoan.application.ucservice.survey;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;

import com.benhsoan.application.ucservice.patient.PatientAccessGuard;
import com.benhsoan.domain.auditlog.AuditLog;
import com.benhsoan.domain.auditlog.enums.ResourceType;
import com.benhsoan.domain.auth.User;
import com.benhsoan.domain.survey.PatientSatisfactionSurvey;
import com.benhsoan.domain.survey.exception.SatisfactionSurveyNotFoundException;
import com.benhsoan.domain.visit.Visit;
import com.benhsoan.domain.visit.enums.VisitStatus;
import com.benhsoan.domain.visit.enums.VisitType;
import com.benhsoan.port.dto.result.survey.SatisfactionSurveyResult;
import com.benhsoan.port.outbound.repository.audit.AuditLogRepository;
import com.benhsoan.port.outbound.repository.auth.UserRepository;
import com.benhsoan.port.outbound.repository.survey.SatisfactionSurveyRepository;
import com.benhsoan.port.outbound.repository.visit.VisitRepository;
import com.benhsoan.port.outbound.security.CurrentUserPort;
import com.benhsoan.port.outbound.time.ClockPort;

@ExtendWith(MockitoExtension.class)
class UpdateSatisfactionSurveyServiceTest {

        @Mock
        private SatisfactionSurveyRepository surveyRepository;
        @Mock
        private VisitRepository visitRepository;
        @Mock
        private PatientAccessGuard patientAccessGuard;
        @Mock
        private UserRepository userRepository;
        @Mock
        private AuditLogRepository auditLogRepository;
        @Mock
        private CurrentUserPort currentUserPort;
        @Mock
        private ClockPort clockPort;

        private UpdateSatisfactionSurveyService service;

        private final UUID surveyId = UUID.randomUUID();
        private final UUID visitId = UUID.randomUUID();
        private final UUID patientId = UUID.randomUUID();
        private final UUID doctorId = UUID.randomUUID();
        private final UUID currentUserId = UUID.randomUUID();
        private final Instant createdTime = Instant.parse("2026-09-25T10:00:00Z");
        private final Instant updateTime = Instant.parse("2026-09-25T11:00:00Z");

        @BeforeEach
        void setUp() {
                service = new UpdateSatisfactionSurveyService(
                                surveyRepository,
                                visitRepository,
                                patientAccessGuard,
                                userRepository,
                                auditLogRepository,
                                currentUserPort,
                                clockPort);
        }

        @Test
        @DisplayName("TC-02: Cho phép sửa đánh giá cũ thay vì tạo mới")
        void testUpdateSurvey_Success_TC02() {
                PatientSatisfactionSurvey existing = PatientSatisfactionSurvey.restore(
                                surveyId, visitId, patientId, doctorId, 3, "Bình thường", createdTime, null);
                when(surveyRepository.findById(surveyId)).thenReturn(Optional.of(existing));
                when(clockPort.now()).thenReturn(updateTime);
                when(currentUserPort.getCurrentUserId()).thenReturn(currentUserId);
                when(surveyRepository.save(any(PatientSatisfactionSurvey.class)))
                                .thenAnswer(invocation -> invocation.getArgument(0));

                Visit visit = Visit.restore(
                                visitId, "KB-001", patientId, doctorId, null, null,
                                VisitType.WALK_IN, VisitStatus.COMPLETED, createdTime.minusSeconds(3600),
                                createdTime.minusSeconds(1800), createdTime.minusSeconds(600),
                                "Kham", null, doctorId, createdTime.minusSeconds(3600), createdTime.minusSeconds(600));
                when(visitRepository.findById(visitId)).thenReturn(Optional.of(visit));

                User doctor = User.restore(
                                doctorId, "dr.anh", "hash", "Dr. Nguyen Minh Anh", "anh@clinic.com", "0901000001",
                                UUID.randomUUID(), true, null, createdTime);
                when(userRepository.findById(doctorId)).thenReturn(Optional.of(doctor));

                SatisfactionSurveyResult result = service.updateSurvey(surveyId, 5, "Bác sĩ hỗ trợ lại rất tốt");

                assertNotNull(result);
                assertEquals(surveyId, result.id());
                assertEquals(5, result.score());
                assertEquals("Bác sĩ hỗ trợ lại rất tốt", result.comment());
                assertEquals(updateTime, result.updatedAt());

                verify(patientAccessGuard).requirePatientOwnership(patientId, ResourceType.PATIENT_SATISFACTION_SURVEY,
                                surveyId);
                verify(surveyRepository).save(existing);
                verify(auditLogRepository).save(any(AuditLog.class));
        }

        @Test
        @DisplayName("QTN-23: Bị từ chối khi sửa khảo sát không thuộc quyền sở hữu")
        void testUpdateSurvey_AccessDenied_QTN23() {
                PatientSatisfactionSurvey existing = PatientSatisfactionSurvey.restore(
                                surveyId, visitId, patientId, doctorId, 3, "Bình thường", createdTime, null);
                when(surveyRepository.findById(surveyId)).thenReturn(Optional.of(existing));
                doThrow(new AccessDeniedException("Access denied")).when(patientAccessGuard)
                                .requirePatientOwnership(eq(patientId), eq(ResourceType.PATIENT_SATISFACTION_SURVEY),
                                                eq(surveyId));

                assertThrows(AccessDeniedException.class, () -> service.updateSurvey(surveyId, 4, "Sửa"));
        }

        @Test
        @DisplayName("Ném SatisfactionSurveyNotFoundException khi không tìm thấy khảo sát để sửa")
        void testUpdateSurvey_NotFound_ThrowsException() {
                when(surveyRepository.findById(surveyId)).thenReturn(Optional.empty());

                assertThrows(SatisfactionSurveyNotFoundException.class, () -> service.updateSurvey(surveyId, 4, "Sửa"));
        }
}
