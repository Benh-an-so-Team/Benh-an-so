package com.benhsoan.application.ucservice.portal;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;

import com.benhsoan.application.ucservice.patient.PatientAccessGuard;
import com.benhsoan.domain.auditlog.enums.ResourceType;
import com.benhsoan.domain.portal.exception.PatientPortalNotificationNotFoundException;
import com.benhsoan.domain.portal.notification.PatientPortalNotification;
import com.benhsoan.domain.portal.notification.PatientPortalNotificationType;
import com.benhsoan.port.outbound.repository.portal.PatientPortalNotificationRepository;
import com.benhsoan.port.outbound.time.ClockPort;

@ExtendWith(MockitoExtension.class)
class MarkPatientPortalNotificationReadServiceTest {

    private static final Instant NOW = Instant.parse("2026-09-30T01:00:00Z");
    private static final UUID NOTIFICATION_ID = UUID.randomUUID();
    private static final UUID PATIENT_ID = UUID.randomUUID();

    @Mock
    private PatientPortalNotificationRepository notificationRepository;
    @Mock
    private PatientAccessGuard patientAccessGuard;
    @Mock
    private ClockPort clockPort;

    private MarkPatientPortalNotificationReadService service;

    @BeforeEach
    void setUp() {
        service = new MarkPatientPortalNotificationReadService(
                notificationRepository, patientAccessGuard,
                new PatientPortalNotificationResultMapper(), clockPort);
    }

    @Test
    void marksOwnNotificationReadAndPersists() {
        PatientPortalNotification notification = notification();
        when(notificationRepository.findById(NOTIFICATION_ID)).thenReturn(Optional.of(notification));
        when(clockPort.now()).thenReturn(NOW);
        when(notificationRepository.save(notification)).thenReturn(notification);

        var result = service.markRead(NOTIFICATION_ID);

        verify(patientAccessGuard).requirePatientOwnership(
                PATIENT_ID, ResourceType.PATIENT_PORTAL, NOTIFICATION_ID);
        verify(notificationRepository).save(notification);
        assertEquals(true, result.read());
    }

    @Test
    void missingNotificationThrowsNotFound() {
        when(notificationRepository.findById(NOTIFICATION_ID)).thenReturn(Optional.empty());

        assertThrows(PatientPortalNotificationNotFoundException.class,
                () -> service.markRead(NOTIFICATION_ID));
    }

    @Test
    void foreignNotificationIsRejected() {
        when(notificationRepository.findById(NOTIFICATION_ID))
                .thenReturn(Optional.of(notification()));
        doThrow(new AccessDeniedException("denied")).when(patientAccessGuard)
                .requirePatientOwnership(any(), any(), any());

        assertThrows(AccessDeniedException.class, () -> service.markRead(NOTIFICATION_ID));
    }

    private PatientPortalNotification notification() {
        return PatientPortalNotification.restore(
                NOTIFICATION_ID, PATIENT_ID, PatientPortalNotificationType.APPOINTMENT_REMINDER,
                "t", "m", null, NOW, UUID.randomUUID(), null, null, null);
    }
}
