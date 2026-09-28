package com.benhsoan.application.ucservice.survey;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
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
import com.benhsoan.domain.auditlog.enums.ResourceType;
import com.benhsoan.domain.auth.User;
import com.benhsoan.domain.survey.PatientSatisfactionSurvey;
import com.benhsoan.domain.survey.exception.SatisfactionSurveyNotFoundException;
import com.benhsoan.domain.visit.Visit;
import com.benhsoan.domain.visit.enums.VisitStatus;
import com.benhsoan.domain.visit.enums.VisitType;
import com.benhsoan.port.dto.result.survey.SatisfactionSurveyResult;
import com.benhsoan.port.outbound.repository.auth.UserRepository;
import com.benhsoan.port.outbound.repository.survey.SatisfactionSurveyRepository;
import com.benhsoan.port.outbound.repository.visit.VisitRepository;

@ExtendWith(MockitoExtension.class)
class GetPatientSatisfactionSurveyServiceTest {

        @Mock
        private SatisfactionSurveyRepository surveyRepository;
        @Mock
        private VisitRepository visitRepository;
        @Mock
        private PatientAccessGuard patientAccessGuard;
        @Mock
        private UserRepository userRepository;

        private GetPatientSatisfactionSurveyService service;

        private final UUID surveyId = UUID.randomUUID();
        private final UUID visitId = UUID.randomUUID();
        private final UUID patientId = UUID.randomUUID();
        private final UUID doctorId = UUID.randomUUID();
        private final Instant now = Instant.parse("2026-09-25T14:00:00Z");

        @BeforeEach
        void setUp() {
                service = new GetPatientSatisfactionSurveyService(
                                surveyRepository,
                                visitRepository,
                                patientAccessGuard,
                                userRepository);
        }

        @Test
        @DisplayName("Tra cứu khảo sát theo visitId thành công")
        void getSurveyByVisitId_Success() {
                Visit visit = Visit.restore(
                                visitId, "KB-001", patientId, doctorId, null, null,
                                VisitType.WALK_IN, VisitStatus.COMPLETED, now.minusSeconds(3600),
                                now.minusSeconds(1800), now.minusSeconds(600),
                                "Kham", null, doctorId, now.minusSeconds(3600), now.minusSeconds(600));
                when(visitRepository.findById(visitId)).thenReturn(Optional.of(visit));

                PatientSatisfactionSurvey survey = PatientSatisfactionSurvey.restore(
                                surveyId, visitId, patientId, doctorId, 5, "Tot", now, null);
                when(surveyRepository.findByVisitId(visitId)).thenReturn(Optional.of(survey));

                User doctor = User.restore(
                                doctorId, "dr.anh", "hash", "Dr. Nguyen Minh Anh", "anh@clinic.com", "0901000001",
                                UUID.randomUUID(), true, null, now);
                when(userRepository.findById(doctorId)).thenReturn(Optional.of(doctor));

                SatisfactionSurveyResult result = service.getSurveyByVisitId(visitId);

                assertNotNull(result);
                assertEquals(surveyId, result.id());
                assertEquals("KB-001", result.visitCode());
                assertEquals("Dr. Nguyen Minh Anh", result.doctorName());

                verify(patientAccessGuard).requirePatientOwnership(patientId, ResourceType.PATIENT_SATISFACTION_SURVEY,
                                visitId);
        }

        @Test
        @DisplayName("QTN-23: Bị từ chối khi tra cứu khảo sát của bệnh nhân khác")
        void getSurveyByVisitId_AccessDenied_QTN23() {
                Visit visit = Visit.restore(
                                visitId, "KB-001", patientId, doctorId, null, null,
                                VisitType.WALK_IN, VisitStatus.COMPLETED, now.minusSeconds(3600),
                                now.minusSeconds(1800), now.minusSeconds(600),
                                "Kham", null, doctorId, now.minusSeconds(3600), now.minusSeconds(600));
                when(visitRepository.findById(visitId)).thenReturn(Optional.of(visit));
                doThrow(new AccessDeniedException("Access denied")).when(patientAccessGuard)
                                .requirePatientOwnership(eq(patientId), eq(ResourceType.PATIENT_SATISFACTION_SURVEY),
                                                eq(visitId));

                assertThrows(AccessDeniedException.class, () -> service.getSurveyByVisitId(visitId));
        }

        @Test
        @DisplayName("Ném SatisfactionSurveyNotFoundException khi chưa có khảo sát cho lượt khám")
        void getSurveyByVisitId_NotFound_ThrowsException() {
                Visit visit = Visit.restore(
                                visitId, "KB-001", patientId, doctorId, null, null,
                                VisitType.WALK_IN, VisitStatus.COMPLETED, now.minusSeconds(3600),
                                now.minusSeconds(1800), now.minusSeconds(600),
                                "Kham", null, doctorId, now.minusSeconds(3600), now.minusSeconds(600));
                when(visitRepository.findById(visitId)).thenReturn(Optional.of(visit));
                when(surveyRepository.findByVisitId(visitId)).thenReturn(Optional.empty());

                assertThrows(SatisfactionSurveyNotFoundException.class, () -> service.getSurveyByVisitId(visitId));
        }
}
