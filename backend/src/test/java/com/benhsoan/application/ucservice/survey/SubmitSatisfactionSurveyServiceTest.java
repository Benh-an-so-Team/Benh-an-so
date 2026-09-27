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
import com.benhsoan.domain.survey.exception.SatisfactionSurveyAlreadyExistsException;
import com.benhsoan.domain.visit.Visit;
import com.benhsoan.domain.visit.enums.VisitStatus;
import com.benhsoan.domain.visit.enums.VisitType;
import com.benhsoan.domain.visit.exception.VisitInvalidStatusException;
import com.benhsoan.domain.visit.exception.VisitNotFoundException;
import com.benhsoan.port.dto.result.survey.SatisfactionSurveyResult;
import com.benhsoan.port.outbound.repository.audit.AuditLogRepository;
import com.benhsoan.port.outbound.repository.auth.UserRepository;
import com.benhsoan.port.outbound.repository.survey.SatisfactionSurveyRepository;
import com.benhsoan.port.outbound.repository.visit.VisitRepository;
import com.benhsoan.port.outbound.security.CurrentUserPort;
import com.benhsoan.port.outbound.time.ClockPort;

@ExtendWith(MockitoExtension.class)
class SubmitSatisfactionSurveyServiceTest {

    @Mock
    private VisitRepository visitRepository;
    @Mock
    private SatisfactionSurveyRepository surveyRepository;
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

    private SubmitSatisfactionSurveyService service;

    private final UUID visitId = UUID.randomUUID();
    private final UUID patientId = UUID.randomUUID();
    private final UUID doctorId = UUID.randomUUID();
    private final UUID currentUserId = UUID.randomUUID();
    private final Instant now = Instant.parse("2026-09-25T14:00:00Z");

    @BeforeEach
    void setUp() {
        service = new SubmitSatisfactionSurveyService(
                visitRepository,
                surveyRepository,
                patientAccessGuard,
                userRepository,
                auditLogRepository,
                currentUserPort,
                clockPort);
    }

    private Visit createVisit(VisitStatus status) {
        return Visit.restore(
                visitId,
                "KB-001",
                patientId,
                doctorId,
                null,
                null,
                VisitType.WALK_IN,
                status,
                now.minusSeconds(7200),
                now.minusSeconds(3600),
                status == VisitStatus.COMPLETED ? now.minusSeconds(1800) : null,
                "Kham benh",
                null,
                doctorId,
                now.minusSeconds(7200),
                now.minusSeconds(1800));
    }

    @Test
    @DisplayName("TC-01: Gửi khảo sát thành công khi lượt khám hoàn tất và bệnh nhân có quyền")
    void testSubmitSurvey_Success_TC01() {
        Visit completedVisit = createVisit(VisitStatus.COMPLETED);
        when(visitRepository.findById(visitId)).thenReturn(Optional.of(completedVisit));
        when(surveyRepository.existsByVisitId(visitId)).thenReturn(false);
        when(clockPort.now()).thenReturn(now);
        when(currentUserPort.getCurrentUserId()).thenReturn(currentUserId);

        User doctor = User.restore(
                doctorId, "dr.anh", "hash", "Dr. Nguyen Minh Anh", "anh@clinic.com", "0901000001",
                UUID.randomUUID(), true, null, now);
        when(userRepository.findById(doctorId)).thenReturn(Optional.of(doctor));

        when(surveyRepository.save(any(PatientSatisfactionSurvey.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        SatisfactionSurveyResult result = service.submitSurvey(visitId, 5, "Dịch vụ xuất sắc");

        assertNotNull(result);
        assertEquals(visitId, result.visitId());
        assertEquals("KB-001", result.visitCode());
        assertEquals(patientId, result.patientId());
        assertEquals(doctorId, result.doctorId());
        assertEquals("Dr. Nguyen Minh Anh", result.doctorName());
        assertEquals(5, result.score());
        assertEquals("Dịch vụ xuất sắc", result.comment());

        verify(patientAccessGuard).requirePatientOwnership(patientId, ResourceType.PATIENT_SATISFACTION_SURVEY,
                visitId);
        verify(surveyRepository).save(any(PatientSatisfactionSurvey.class));
        verify(auditLogRepository).save(any(AuditLog.class));
    }

    @Test
    @DisplayName("TC-02: Bị chặn khi gửi đánh giá lần hai cho cùng một lượt khám")
    void testSubmitSurvey_DuplicateSurvey_ThrowsException_TC02() {
        Visit completedVisit = createVisit(VisitStatus.COMPLETED);
        when(visitRepository.findById(visitId)).thenReturn(Optional.of(completedVisit));
        when(surveyRepository.existsByVisitId(visitId)).thenReturn(true);

        assertThrows(SatisfactionSurveyAlreadyExistsException.class,
                () -> service.submitSurvey(visitId, 4, "Đánh giá lại"));
    }

    @Test
    @DisplayName("Bị chặn khi lượt khám chưa ở trạng thái hoàn tất (COMPLETED)")
    void testSubmitSurvey_VisitNotCompleted_ThrowsException() {
        Visit inProgressVisit = createVisit(VisitStatus.IN_PROGRESS);
        when(visitRepository.findById(visitId)).thenReturn(Optional.of(inProgressVisit));

        assertThrows(VisitInvalidStatusException.class, () -> service.submitSurvey(visitId, 5, "Tốt"));
    }

    @Test
    @DisplayName("QTN-23: Bị từ chối quyền truy cập khi bệnh nhân gửi đánh giá cho lượt khám của người khác")
    void testSubmitSurvey_NotPatientOwns_ThrowsAccessDenied_QTN23() {
        Visit completedVisit = createVisit(VisitStatus.COMPLETED);
        when(visitRepository.findById(visitId)).thenReturn(Optional.of(completedVisit));
        doThrow(new AccessDeniedException("Access denied")).when(patientAccessGuard)
                .requirePatientOwnership(eq(patientId), eq(ResourceType.PATIENT_SATISFACTION_SURVEY), eq(visitId));

        assertThrows(AccessDeniedException.class, () -> service.submitSurvey(visitId, 5, "Gian lận"));
    }

    @Test
    @DisplayName("Ném VisitNotFoundException khi mã lượt khám không tồn tại")
    void testSubmitSurvey_VisitNotFound_ThrowsException() {
        when(visitRepository.findById(visitId)).thenReturn(Optional.empty());

        assertThrows(VisitNotFoundException.class, () -> service.submitSurvey(visitId, 5, "Khong tim thay"));
    }
}
