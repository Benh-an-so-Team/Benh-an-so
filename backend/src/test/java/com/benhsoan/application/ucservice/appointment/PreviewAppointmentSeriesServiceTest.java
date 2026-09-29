package com.benhsoan.application.ucservice.appointment;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.benhsoan.domain.appointment.exception.UnauthorizedAppointmentOperationException;
import com.benhsoan.domain.auth.User;
import com.benhsoan.domain.patient.Patient;
import com.benhsoan.port.dto.command.appointment.PreviewAppointmentSeriesCommand;
import com.benhsoan.port.dto.result.appointment.AppointmentSeriesPreviewResult;
import com.benhsoan.port.outbound.repository.auth.UserRepository;
import com.benhsoan.port.outbound.repository.patient.PatientRepository;
import com.benhsoan.port.outbound.security.CurrentUserPort;
import com.benhsoan.port.outbound.time.ClockPort;

@ExtendWith(MockitoExtension.class)
class PreviewAppointmentSeriesServiceTest {

    private static final Instant NOW = Instant.parse("2026-09-01T08:00:00Z");

    @Mock private PatientRepository patientRepository;
    @Mock private UserRepository userRepository;
    @Mock private AppointmentSeriesValidator appointmentSeriesValidator;
    @Mock private CurrentUserPort currentUserPort;
    @Mock private ClockPort clockPort;
    @Mock private AppointmentAccessDeniedAuditWriter appointmentAccessDeniedAuditWriter;

    private PreviewAppointmentSeriesService service;

    @BeforeEach
    void setUp() {
        service = new PreviewAppointmentSeriesService(
                patientRepository,
                userRepository,
                appointmentSeriesValidator,
                currentUserPort,
                clockPort,
                appointmentAccessDeniedAuditWriter
        );
    }

    @Test
    void rejectsDoctorOrUnauthorizedUserAndWritesAuditLog() {
        UUID actorId = UUID.randomUUID();
        when(currentUserPort.getCurrentUserId()).thenReturn(actorId);
        when(currentUserPort.hasRole("ADMIN")).thenReturn(false);
        when(currentUserPort.hasRole("RECEPTIONIST")).thenReturn(false);
        when(clockPort.now()).thenReturn(NOW);

        PreviewAppointmentSeriesCommand command = PreviewAppointmentSeriesCommand.builder()
                .patientId(UUID.randomUUID())
                .doctorId(UUID.randomUUID())
                .firstSessionStartTime(NOW.plusSeconds(3600))
                .sessionDurationMinutes(30)
                .totalSessions(3)
                .intervalDays(7)
                .build();

        assertThrows(UnauthorizedAppointmentOperationException.class, () -> service.preview(command));
        verify(appointmentAccessDeniedAuditWriter).writeSeriesPreviewDenied(eq(actorId), eq(NOW), any());
        verify(patientRepository, never()).findById(any());
    }

    @Test
    void allowsReceptionistToPreviewSeries() {
        UUID actorId = UUID.randomUUID();
        UUID patientId = UUID.randomUUID();
        UUID doctorId = UUID.randomUUID();

        when(currentUserPort.getCurrentUserId()).thenReturn(actorId);
        when(currentUserPort.hasRole("ADMIN")).thenReturn(false);
        when(currentUserPort.hasRole("RECEPTIONIST")).thenReturn(true);

        Patient patient = mock(Patient.class);
        when(patientRepository.findById(patientId)).thenReturn(Optional.of(patient));

        User doctor = User.restore(doctorId, "doctor1", "hash", "Dr. A", "a@example.com", "0900000001",
                UUID.randomUUID(), true, null, NOW);
        when(userRepository.findById(doctorId)).thenReturn(Optional.of(doctor));

        when(appointmentSeriesValidator.generateSessionsSkippingDoctorOffDays(eq(doctorId), any(), anyInt(), anyInt(), anyInt()))
                .thenReturn(List.of(
                        new AppointmentSeriesValidator.SessionSlot(1, NOW.plusSeconds(86400), NOW.plusSeconds(86400 + 1800)),
                        new AppointmentSeriesValidator.SessionSlot(2, NOW.plusSeconds(86400 * 8), NOW.plusSeconds(86400 * 8 + 1800)),
                        new AppointmentSeriesValidator.SessionSlot(3, NOW.plusSeconds(86400 * 15), NOW.plusSeconds(86400 * 15 + 1800))
                ));
        when(appointmentSeriesValidator.validateSessions(eq(doctorId), any())).thenReturn(List.of());

        PreviewAppointmentSeriesCommand command = PreviewAppointmentSeriesCommand.builder()
                .patientId(patientId)
                .doctorId(doctorId)
                .firstSessionStartTime(NOW.plusSeconds(86400))
                .sessionDurationMinutes(30)
                .totalSessions(3)
                .intervalDays(7)
                .build();

        AppointmentSeriesPreviewResult result = service.preview(command);

        assertNotNull(result);
        assertEquals(3, result.totalSessions());
        assertEquals(7, result.intervalDays());
        assertTrue(result.allAvailable());
        assertEquals(3, result.sessions().size());
        verify(appointmentAccessDeniedAuditWriter, never()).writeSeriesPreviewDenied(any(), any(), any());
    }
}
