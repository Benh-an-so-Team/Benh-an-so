package com.benhsoan.application.ucservice.appointment;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.benhsoan.port.outbound.repository.appointment.AppointmentRepository;
import com.benhsoan.port.outbound.repository.appointment.DoctorTimeOffRepository;
import com.benhsoan.port.outbound.time.ClockPort;

@ExtendWith(MockitoExtension.class)
class AppointmentSeriesValidatorTest {

    private static final UUID DOCTOR_ID = UUID.randomUUID();
    private static final Instant NOW = Instant.parse("2026-09-01T00:00:00Z");

    @Mock private DoctorScheduleValidator doctorScheduleValidator;
    @Mock private DoctorTimeOffRepository doctorTimeOffRepository;
    @Mock private AppointmentRepository appointmentRepository;
    @Mock private ClockPort clockPort;

    private AppointmentSeriesValidator validator;

    @BeforeEach
    void setUp() {
        validator = new AppointmentSeriesValidator(
                doctorScheduleValidator,
                doctorTimeOffRepository,
                appointmentRepository,
                clockPort
        );
        org.mockito.Mockito.lenient().when(clockPort.now()).thenReturn(NOW);
    }

    @Test
    void detectsInternalOverlapBetweenSessions() {
        Instant s1Start = Instant.parse("2026-09-05T08:00:00Z");
        Instant s1End = Instant.parse("2026-09-05T09:00:00Z");
        Instant s2Start = Instant.parse("2026-09-05T08:30:00Z");
        Instant s2End = Instant.parse("2026-09-05T09:30:00Z");

        var sessions = List.of(
                new AppointmentSeriesValidator.SessionSlot(1, s1Start, s1End),
                new AppointmentSeriesValidator.SessionSlot(2, s2Start, s2End)
        );

        when(doctorScheduleValidator.resolveWorkingHours(eq(DOCTOR_ID), any()))
                .thenReturn(Optional.of(new DoctorScheduleValidator.EffectiveWorkingHours(
                        LocalTime.of(7, 0), LocalTime.of(18, 0)
                )));

        var conflicts = validator.validateSessions(DOCTOR_ID, sessions);

        assertTrue(conflicts.stream().anyMatch(c -> "INTERNAL_CONFLICT".equals(c.conflictType())));
    }

    @Test
    void detectsPastTimeSlot() {
        Instant pastStart = Instant.parse("2026-08-30T08:00:00Z");
        Instant pastEnd = Instant.parse("2026-08-30T09:00:00Z");

        var sessions = List.of(
                new AppointmentSeriesValidator.SessionSlot(1, pastStart, pastEnd)
        );

        var conflicts = validator.validateSessions(DOCTOR_ID, sessions);

        assertEquals(1, conflicts.size());
        assertEquals("PAST_TIME", conflicts.get(0).conflictType());
    }

    @Test
    void detectsDoctorNotWorkingOnDay() {
        Instant s1Start = Instant.parse("2026-09-06T08:00:00Z");
        Instant s1End = Instant.parse("2026-09-06T09:00:00Z");

        var sessions = List.of(
                new AppointmentSeriesValidator.SessionSlot(1, s1Start, s1End)
        );

        when(doctorScheduleValidator.resolveWorkingHours(eq(DOCTOR_ID), any(LocalDate.class)))
                .thenReturn(Optional.empty());

        var conflicts = validator.validateSessions(DOCTOR_ID, sessions);

        assertEquals(1, conflicts.size());
        assertEquals("DOCTOR_NOT_WORKING", conflicts.get(0).conflictType());
    }

    @Test
    void detectsSlotOutsideWorkingHours() {
        Instant s1Start = Instant.parse("2026-09-07T06:00:00Z"); // Before 08:00
        Instant s1End = Instant.parse("2026-09-07T07:00:00Z");

        var sessions = List.of(
                new AppointmentSeriesValidator.SessionSlot(1, s1Start, s1End)
        );

        when(doctorScheduleValidator.resolveWorkingHours(eq(DOCTOR_ID), any(LocalDate.class)))
                .thenReturn(Optional.of(new DoctorScheduleValidator.EffectiveWorkingHours(
                        LocalTime.of(15, 0), LocalTime.of(20, 0) // Shift does not cover slot
                )));

        var conflicts = validator.validateSessions(DOCTOR_ID, sessions);

        assertEquals(1, conflicts.size());
        assertEquals("DOCTOR_NOT_WORKING", conflicts.get(0).conflictType());
    }

    @Test
    void detectsDoctorTimeOff() {
        Instant s1Start = Instant.parse("2026-09-08T02:00:00Z");
        Instant s1End = Instant.parse("2026-09-08T03:00:00Z");

        var sessions = List.of(
                new AppointmentSeriesValidator.SessionSlot(1, s1Start, s1End)
        );

        when(doctorScheduleValidator.resolveWorkingHours(eq(DOCTOR_ID), any(LocalDate.class)))
                .thenReturn(Optional.of(new DoctorScheduleValidator.EffectiveWorkingHours(
                        LocalTime.of(7, 0), LocalTime.of(18, 0)
                )));
        when(doctorTimeOffRepository.existsActiveOverlapping(DOCTOR_ID, s1Start, s1End))
                .thenReturn(true);

        var conflicts = validator.validateSessions(DOCTOR_ID, sessions);

        assertEquals(1, conflicts.size());
        assertEquals("DOCTOR_TIME_OFF", conflicts.get(0).conflictType());
    }

    @Test
    void detectsAppointmentConflict() {
        Instant s1Start = Instant.parse("2026-09-08T02:00:00Z");
        Instant s1End = Instant.parse("2026-09-08T03:00:00Z");

        var sessions = List.of(
                new AppointmentSeriesValidator.SessionSlot(1, s1Start, s1End)
        );

        when(doctorScheduleValidator.resolveWorkingHours(eq(DOCTOR_ID), any(LocalDate.class)))
                .thenReturn(Optional.of(new DoctorScheduleValidator.EffectiveWorkingHours(
                        LocalTime.of(7, 0), LocalTime.of(18, 0)
                )));
        when(doctorTimeOffRepository.existsActiveOverlapping(DOCTOR_ID, s1Start, s1End))
                .thenReturn(false);
        when(appointmentRepository.existsActiveAppointmentConflict(DOCTOR_ID, s1Start, s1End))
                .thenReturn(true);

        var conflicts = validator.validateSessions(DOCTOR_ID, sessions);

        assertEquals(1, conflicts.size());
        assertEquals("APPOINTMENT_CONFLICT", conflicts.get(0).conflictType());
    }

    @Test
    void returnsEmptyConflictsWhenAllSessionsValid() {
        Instant s1Start = Instant.parse("2026-09-08T02:00:00Z");
        Instant s1End = Instant.parse("2026-09-08T03:00:00Z");
        Instant s2Start = Instant.parse("2026-09-10T02:00:00Z");
        Instant s2End = Instant.parse("2026-09-10T03:00:00Z");

        var sessions = List.of(
                new AppointmentSeriesValidator.SessionSlot(1, s1Start, s1End),
                new AppointmentSeriesValidator.SessionSlot(2, s2Start, s2End)
        );

        when(doctorScheduleValidator.resolveWorkingHours(eq(DOCTOR_ID), any(LocalDate.class)))
                .thenReturn(Optional.of(new DoctorScheduleValidator.EffectiveWorkingHours(
                        LocalTime.of(7, 0), LocalTime.of(18, 0)
                )));
        when(doctorTimeOffRepository.existsActiveOverlapping(eq(DOCTOR_ID), any(), any()))
                .thenReturn(false);
        when(appointmentRepository.existsActiveAppointmentConflict(eq(DOCTOR_ID), any(), any()))
                .thenReturn(false);

        var conflicts = validator.validateSessions(DOCTOR_ID, sessions);

        assertTrue(conflicts.isEmpty());
    }

    @Test
    void validateSessionStructureSucceedsForValidConsecutiveSessions() {
        Instant s1Start = Instant.parse("2026-09-08T02:00:00Z");
        Instant s1End = Instant.parse("2026-09-08T03:00:00Z");
        Instant s2Start = Instant.parse("2026-09-15T02:00:00Z"); // 7 days later
        Instant s2End = Instant.parse("2026-09-15T03:00:00Z");

        var sessions = List.of(
                new AppointmentSeriesValidator.SessionSlot(1, s1Start, s1End),
                new AppointmentSeriesValidator.SessionSlot(2, s2Start, s2End)
        );

        org.junit.jupiter.api.Assertions.assertDoesNotThrow(() ->
                validator.validateSessionStructure(sessions, 2, 7)
        );
    }

    @Test
    void validateSessionStructureRejectsDuplicateSequenceNumbers() {
        Instant s1Start = Instant.parse("2026-09-08T02:00:00Z");
        Instant s1End = Instant.parse("2026-09-08T03:00:00Z");
        Instant s2Start = Instant.parse("2026-09-15T02:00:00Z");
        Instant s2End = Instant.parse("2026-09-15T03:00:00Z");

        var sessions = List.of(
                new AppointmentSeriesValidator.SessionSlot(1, s1Start, s1End),
                new AppointmentSeriesValidator.SessionSlot(1, s2Start, s2End)
        );

        var ex = org.junit.jupiter.api.Assertions.assertThrows(
                com.benhsoan.domain.shared.exception.ValidationException.class,
                () -> validator.validateSessionStructure(sessions, 2, 7)
        );
        assertTrue(ex.getMessage().contains("trùng lặp"));
    }

    @Test
    void validateSessionStructureRejectsNonContiguousSequence() {
        Instant s1Start = Instant.parse("2026-09-08T02:00:00Z");
        Instant s1End = Instant.parse("2026-09-08T03:00:00Z");
        Instant s2Start = Instant.parse("2026-09-15T02:00:00Z");
        Instant s2End = Instant.parse("2026-09-15T03:00:00Z");

        var sessions = List.of(
                new AppointmentSeriesValidator.SessionSlot(1, s1Start, s1End),
                new AppointmentSeriesValidator.SessionSlot(5, s2Start, s2End)
        );

        var ex = org.junit.jupiter.api.Assertions.assertThrows(
                com.benhsoan.domain.shared.exception.ValidationException.class,
                () -> validator.validateSessionStructure(sessions, 2, 7)
        );
        assertTrue(ex.getMessage().contains("không hợp lệ") || ex.getMessage().contains("liên tục"));
    }

    @Test
    void validateSessionStructureRejectsSessionsTooCloseToEachOther() {
        Instant s1Start = Instant.parse("2026-09-08T02:00:00Z");
        Instant s1End = Instant.parse("2026-09-08T03:00:00Z");
        Instant s2Start = Instant.parse("2026-09-09T02:00:00Z"); // Only 1 day later when interval is 7
        Instant s2End = Instant.parse("2026-09-09T03:00:00Z");

        var sessions = List.of(
                new AppointmentSeriesValidator.SessionSlot(1, s1Start, s1End),
                new AppointmentSeriesValidator.SessionSlot(2, s2Start, s2End)
        );

        var ex = org.junit.jupiter.api.Assertions.assertThrows(
                com.benhsoan.domain.shared.exception.ValidationException.class,
                () -> validator.validateSessionStructure(sessions, 2, 7)
        );
        assertTrue(ex.getMessage().contains("không phù hợp với chu kỳ"));
    }

    @Test
    void validateSessionStructureRejectsChronologicalViolation() {
        Instant s1Start = Instant.parse("2026-09-15T02:00:00Z");
        Instant s1End = Instant.parse("2026-09-15T03:00:00Z");
        Instant s2Start = Instant.parse("2026-09-08T02:00:00Z"); // Earlier than session 1
        Instant s2End = Instant.parse("2026-09-08T03:00:00Z");

        var sessions = List.of(
                new AppointmentSeriesValidator.SessionSlot(1, s1Start, s1End),
                new AppointmentSeriesValidator.SessionSlot(2, s2Start, s2End)
        );

        var ex = org.junit.jupiter.api.Assertions.assertThrows(
                com.benhsoan.domain.shared.exception.ValidationException.class,
                () -> validator.validateSessionStructure(sessions, 2, 7)
        );
        assertTrue(ex.getMessage().contains("phải diễn ra sau"));
    }

    @Test
    void generateSessionsSkipsNonWorkingDaysAndEnsuresTotalSessions() {
        // Friday 2026-09-04 at 09:00 VN = 02:00 UTC
        Instant s1Start = Instant.parse("2026-09-04T02:00:00Z");

        // Doctor only works on weekdays (Mon-Fri)
        when(doctorScheduleValidator.isDoctorWorkingAndAvailable(eq(DOCTOR_ID), any(), any()))
                .thenAnswer(inv -> {
                    Instant start = inv.getArgument(1);
                    java.time.DayOfWeek dow = start.atZone(java.time.ZoneId.of("Asia/Ho_Chi_Minh")).getDayOfWeek();
                    return dow != java.time.DayOfWeek.SATURDAY && dow != java.time.DayOfWeek.SUNDAY;
                });

        var slots = validator.generateSessionsSkippingDoctorOffDays(DOCTOR_ID, s1Start, 30, 3, 1);

        assertEquals(3, slots.size());
        assertEquals(1, slots.get(0).sequenceNumber());
        assertEquals(s1Start, slots.get(0).startTime()); // Friday 2026-09-04

        // Session 2 skips Saturday and Sunday -> Monday 2026-09-07
        assertEquals(2, slots.get(1).sequenceNumber());
        assertEquals(Instant.parse("2026-09-07T02:00:00Z"), slots.get(1).startTime());

        // Session 3 -> Tuesday 2026-09-08
        assertEquals(3, slots.get(2).sequenceNumber());
        assertEquals(Instant.parse("2026-09-08T02:00:00Z"), slots.get(2).startTime());
    }

    @Test
    void generateSessionsSkipsDoctorTimeOff() {
        // Monday 2026-09-07 at 09:00 VN = 02:00 UTC
        Instant s1Start = Instant.parse("2026-09-07T02:00:00Z");
        Instant tuesdaySlot = Instant.parse("2026-09-08T02:00:00Z");

        // Doctor is on time-off on Tuesday
        when(doctorScheduleValidator.isDoctorWorkingAndAvailable(eq(DOCTOR_ID), any(), any()))
                .thenAnswer(inv -> {
                    Instant start = inv.getArgument(1);
                    return !start.equals(tuesdaySlot);
                });

        var slots = validator.generateSessionsSkippingDoctorOffDays(DOCTOR_ID, s1Start, 30, 3, 1);

        assertEquals(3, slots.size());
        // Session 1: Monday
        assertEquals(s1Start, slots.get(0).startTime());
        // Session 2: Skips Tuesday -> Wednesday 2026-09-09
        assertEquals(Instant.parse("2026-09-09T02:00:00Z"), slots.get(1).startTime());
        // Session 3: Thursday 2026-09-10
        assertEquals(Instant.parse("2026-09-10T02:00:00Z"), slots.get(2).startTime());
    }
}
