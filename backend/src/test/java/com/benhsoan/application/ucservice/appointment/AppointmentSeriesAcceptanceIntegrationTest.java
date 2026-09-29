package com.benhsoan.application.ucservice.appointment;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.benhsoan.domain.appointment.Appointment;
import com.benhsoan.domain.appointment.enums.AppointmentSeriesStatus;
import com.benhsoan.domain.appointment.enums.AppointmentStatus;
import com.benhsoan.domain.appointment.exception.AppointmentSeriesConflictException;
import com.benhsoan.domain.appointment.exception.UnauthorizedAppointmentOperationException;
import com.benhsoan.domain.auditlog.enums.ActionType;
import com.benhsoan.domain.auditlog.enums.ResourceType;
import com.benhsoan.domain.auth.User;
import com.benhsoan.domain.patient.Patient;
import com.benhsoan.persistence.adapterRepository.appointment.AppointmentRepositoryAdapter;
import com.benhsoan.persistence.adapterRepository.appointment.AppointmentSeriesRepositoryAdapter;
import com.benhsoan.persistence.adapterRepository.auditlog.AuditLogRepositoryAdapter;
import com.benhsoan.persistence.jpaRepository.appointment.JpaAppointmentRepository;
import com.benhsoan.persistence.jpaRepository.appointment.JpaAppointmentSeriesRepository;
import com.benhsoan.persistence.jpaRepository.auditlog.JpaAuditLogRepository;
import com.benhsoan.persistence.mapper.appointment.AppointmentPersistenceMapper;
import com.benhsoan.persistence.mapper.appointment.AppointmentSeriesPersistenceMapper;
import com.benhsoan.persistence.mapper.auditlog.AuditLogPersistenceMapper;
import com.benhsoan.port.dto.command.appointment.CreateAppointmentSeriesCommand;
import com.benhsoan.port.dto.command.appointment.PreviewAppointmentSeriesCommand;
import com.benhsoan.port.dto.result.appointment.AppointmentSeriesPreviewResult;
import com.benhsoan.port.dto.result.appointment.AppointmentSeriesResult;
import com.benhsoan.port.outbound.generator.AppointmentCodeGenerator;
import com.benhsoan.port.outbound.generator.AppointmentSeriesCodeGenerator;
import com.benhsoan.port.outbound.repository.appointment.DoctorScheduleRepository;
import com.benhsoan.port.outbound.repository.appointment.DoctorTimeOffRepository;
import com.benhsoan.port.outbound.repository.appointment.DoctorWeeklyScheduleRepository;
import com.benhsoan.port.outbound.repository.auth.UserRepository;
import com.benhsoan.port.outbound.repository.medicalrecord.MedicalRecordRepository;
import com.benhsoan.port.outbound.repository.patient.PatientRepository;
import com.benhsoan.port.outbound.repository.visit.VisitRepository;
import com.benhsoan.port.outbound.security.CurrentUserPort;
import com.benhsoan.port.outbound.time.ClockPort;

@DataJpaTest(properties = {
                "spring.flyway.enabled=false",
                "spring.sql.init.mode=never",
                "spring.jpa.database-platform=org.hibernate.dialect.H2Dialect",
                "spring.jpa.hibernate.ddl-auto=create-drop"
})
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.ANY)
@Import({
                CreateAppointmentSeriesService.class,
                PreviewAppointmentSeriesService.class,
                GetAppointmentSeriesByIdService.class,
                GetPatientAppointmentSeriesService.class,
                AppointmentSeriesValidator.class,
                DoctorScheduleValidator.class,
                AppointmentSeriesResultMapper.class,
                AppointmentResultMapper.class,
                AppointmentAccessDeniedAuditWriter.class,
                AppointmentSeriesRepositoryAdapter.class,
                AppointmentRepositoryAdapter.class,
                AuditLogRepositoryAdapter.class,
                AppointmentSeriesPersistenceMapper.class,
                AppointmentPersistenceMapper.class,
                AuditLogPersistenceMapper.class,
                ObjectMapper.class
})
@Transactional(propagation = Propagation.NOT_SUPPORTED)
class AppointmentSeriesAcceptanceIntegrationTest {

        private static final UUID ACTOR_ID = UUID.fromString("11111111-1111-1111-1111-111111111111");
        private static final UUID PATIENT_ID = UUID.fromString("22222222-2222-2222-2222-222222222222");
        private static final UUID DOCTOR_ID = UUID.fromString("33333333-3333-3333-3333-333333333333");
        private static final Instant NOW = Instant.parse("2026-09-01T08:00:00Z");

        @Autowired
        private CreateAppointmentSeriesService createService;
        @Autowired
        private PreviewAppointmentSeriesService previewService;
        @Autowired
        private GetAppointmentSeriesByIdService getByIdService;
        @Autowired
        private GetPatientAppointmentSeriesService getByPatientService;

        @Autowired
        private JpaAppointmentSeriesRepository seriesJpaRepository;
        @Autowired
        private JpaAppointmentRepository appointmentJpaRepository;
        @Autowired
        private JpaAuditLogRepository auditLogJpaRepository;

        @MockitoBean
        private AppointmentCodeGenerator appointmentCodeGenerator;
        @MockitoBean
        private AppointmentSeriesCodeGenerator appointmentSeriesCodeGenerator;
        @MockitoBean
        private PatientRepository patientRepository;
        @MockitoBean
        private UserRepository userRepository;
        @MockitoBean
        private MedicalRecordRepository medicalRecordRepository;
        @MockitoBean
        private VisitRepository visitRepository;
        @MockitoBean
        private DoctorTimeOffRepository doctorTimeOffRepository;
        @MockitoBean
        private DoctorScheduleRepository doctorScheduleRepository;
        @MockitoBean
        private DoctorWeeklyScheduleRepository doctorWeeklyScheduleRepository;
        @MockitoBean
        private CurrentUserPort currentUserPort;
        @MockitoBean
        private ClockPort clockPort;

        @BeforeEach
        void setUp() {
                appointmentJpaRepository.deleteAll();
                seriesJpaRepository.deleteAll();
                auditLogJpaRepository.deleteAll();

                when(clockPort.now()).thenReturn(NOW);
                when(currentUserPort.getCurrentUserId()).thenReturn(ACTOR_ID);
                when(currentUserPort.hasRole("ADMIN")).thenReturn(false);
                when(currentUserPort.hasRole("RECEPTIONIST")).thenReturn(true);

                Patient patient = mock(Patient.class);
                when(patientRepository.findById(PATIENT_ID)).thenReturn(Optional.of(patient));

                User doctor = User.restore(DOCTOR_ID, "doctor1", "hash", "Bác sĩ Chuyên Khoa", "bs@benhsoan.vn",
                                "0912345678", UUID.randomUUID(), true, null, NOW);
                when(userRepository.findById(DOCTOR_ID)).thenReturn(Optional.of(doctor));
                when(userRepository.findByIdForUpdate(DOCTOR_ID)).thenReturn(Optional.of(doctor));

                // Default doctor schedule: 07:00 to 18:00 every day, no time off
                when(doctorScheduleRepository.findByDoctorIdAndScheduleDate(eq(DOCTOR_ID), any()))
                                .thenReturn(Optional.empty());
                when(doctorWeeklyScheduleRepository.findByDoctorIdAndDayOfWeek(eq(DOCTOR_ID), any()))
                                .thenReturn(Optional.empty());
                when(doctorTimeOffRepository.existsActiveOverlapping(eq(DOCTOR_ID), any(), any()))
                                .thenReturn(false);
        }

        private void mockWorkingHours(LocalTime start, LocalTime end) {
                when(doctorWeeklyScheduleRepository.findByDoctorIdAndDayOfWeek(eq(DOCTOR_ID), any()))
                                .thenAnswer(inv -> Optional
                                                .of(com.benhsoan.domain.appointment.DoctorWeeklySchedule.create(
                                                                DOCTOR_ID,
                                                                inv.getArgument(1),
                                                                start,
                                                                end,
                                                                NOW)));
        }

        @Test
        void tc01CreatesAppointmentSeriesWithBatchGeneratedCodesAndAuditLog() {
                mockWorkingHours(LocalTime.of(7, 0), LocalTime.of(18, 0));

                when(appointmentSeriesCodeGenerator.generate()).thenReturn("SER000001");
                when(appointmentCodeGenerator.generateBatch(3))
                                .thenReturn(List.of("APT000001", "APT000002", "APT000003"));

                Instant s1Start = Instant.parse("2026-09-02T02:00:00Z"); // 09:00 VN
                Instant s1End = Instant.parse("2026-09-02T02:30:00Z"); // 09:30 VN
                Instant s2Start = s1Start.plus(Duration.ofDays(7));
                Instant s2End = s1End.plus(Duration.ofDays(7));
                Instant s3Start = s1Start.plus(Duration.ofDays(14));
                Instant s3End = s1End.plus(Duration.ofDays(14));

                var sessions = List.of(
                                new CreateAppointmentSeriesCommand.AppointmentSeriesSessionCommand(1, s1Start, s1End),
                                new CreateAppointmentSeriesCommand.AppointmentSeriesSessionCommand(2, s2Start, s2End),
                                new CreateAppointmentSeriesCommand.AppointmentSeriesSessionCommand(3, s3Start, s3End));

                CreateAppointmentSeriesCommand command = CreateAppointmentSeriesCommand.builder()
                                .patientId(PATIENT_ID)
                                .doctorId(DOCTOR_ID)
                                .title("Liệu trình châm cứu bấm huyệt")
                                .notes("Mỗi tuần 1 buổi")
                                .totalSessions(3)
                                .intervalDays(7)
                                .sessions(sessions)
                                .build();

                AppointmentSeriesResult result = createService.create(command);

                // Verify result
                assertNotNull(result);
                assertEquals("SER000001", result.seriesCode());
                assertEquals(AppointmentSeriesStatus.ACTIVE, result.status());
                assertEquals(3, result.totalSessions());
                assertEquals(3, result.appointments().size());

                // Verify sequential codes generated in batch without collision
                assertEquals("APT000001", result.appointments().get(0).appointmentCode());
                assertEquals("APT000002", result.appointments().get(1).appointmentCode());
                assertEquals("APT000003", result.appointments().get(2).appointmentCode());

                // Verify Database Records
                assertEquals(1, seriesJpaRepository.count());
                assertEquals(3, appointmentJpaRepository.count());

                var savedSeriesOpt = seriesJpaRepository.findById(result.id());
                assertTrue(savedSeriesOpt.isPresent());
                var savedSeries = savedSeriesOpt.get();
                assertEquals("SER000001", savedSeries.getSeriesCode());
                assertEquals(PATIENT_ID, savedSeries.getPatientId());
                assertEquals(DOCTOR_ID, savedSeries.getDoctorId());
                assertEquals(3, savedSeries.getTotalSessions());

                var savedAppointments = appointmentJpaRepository.findBySeriesIdOrderBySequenceNumberAsc(result.id());
                assertEquals(3, savedAppointments.size());
                for (int i = 0; i < 3; i++) {
                        var apt = savedAppointments.get(i);
                        assertEquals(result.id(), apt.getSeriesId());
                        assertEquals(i + 1, apt.getSequenceNumber());
                        assertEquals(AppointmentStatus.SCHEDULED, apt.getStatus());
                        assertEquals("APT00000" + (i + 1), apt.getAppointmentCode());
                }

                // Verify Audit Log
                var audits = auditLogJpaRepository.findAll();
                assertEquals(1, audits.size());
                assertEquals(ActionType.CREATE, audits.get(0).getActionType());
                assertEquals(ResourceType.APPOINTMENT, audits.get(0).getResourceType());
                assertEquals(result.id(), audits.get(0).getResourceId());

                // Verify query use cases
                AppointmentSeriesResult fetchedById = getByIdService.getById(result.id());
                assertEquals("SER000001", fetchedById.seriesCode());
                assertEquals(3, fetchedById.appointments().size());

                List<AppointmentSeriesResult> patientSeries = getByPatientService.getByPatientId(PATIENT_ID);
                assertEquals(1, patientSeries.size());
                assertEquals("SER000001", patientSeries.get(0).seriesCode());
        }

        @Test
        void tc02RejectsOnSlotConflictAndRollsBackAllOrNothing() {
                mockWorkingHours(LocalTime.of(7, 0), LocalTime.of(18, 0));

                Instant s1Start = Instant.parse("2026-09-02T02:00:00Z");
                Instant s1End = Instant.parse("2026-09-02T02:30:00Z");
                Instant s2Start = s1Start.plus(Duration.ofDays(7));
                Instant s2End = s1End.plus(Duration.ofDays(7));

                // Pre-create an appointment conflicting with session 2 using restore to avoid
                // clock check
                var existingAppointment = Appointment.restore(
                                UUID.randomUUID(),
                                "APT999999",
                                UUID.randomUUID(),
                                DOCTOR_ID,
                                s2Start,
                                s2End,
                                AppointmentStatus.SCHEDULED,
                                "Khám trước đó",
                                null,
                                null,
                                null,
                                ACTOR_ID,
                                NOW,
                                "COUNTER",
                                null,
                                null,
                                null,
                                null);
                new AppointmentRepositoryAdapter(appointmentJpaRepository, new AppointmentPersistenceMapper())
                                .save(existingAppointment);

                assertEquals(1, appointmentJpaRepository.count());

                var sessions = List.of(
                                new CreateAppointmentSeriesCommand.AppointmentSeriesSessionCommand(1, s1Start, s1End),
                                new CreateAppointmentSeriesCommand.AppointmentSeriesSessionCommand(2, s2Start, s2End));

                CreateAppointmentSeriesCommand command = CreateAppointmentSeriesCommand.builder()
                                .patientId(PATIENT_ID)
                                .doctorId(DOCTOR_ID)
                                .title("Liệu trình trùng buổi 2")
                                .totalSessions(2)
                                .intervalDays(7)
                                .sessions(sessions)
                                .build();

                AppointmentSeriesConflictException ex = assertThrows(
                                AppointmentSeriesConflictException.class,
                                () -> createService.create(command));

                // Verify structured conflict details
                assertNotNull(ex.getConflicts());
                assertEquals(1, ex.getConflicts().size());
                var conflict = ex.getConflicts().get(0);
                assertEquals(2, conflict.sequenceNumber());
                assertEquals("APPOINTMENT_CONFLICT", conflict.conflictType());

                // Verify all-or-nothing rollback: 0 series persisted, and only the 1
                // pre-existing appointment exists
                assertEquals(0, seriesJpaRepository.count());
                assertEquals(1, appointmentJpaRepository.count());
        }

        @Test
        void tc03PreviewsSeriesAccuratelySkippingDoctorTimeOffAndEnsuringTotalSessions() {
                mockWorkingHours(LocalTime.of(7, 0), LocalTime.of(18, 0));

                Instant firstSession = Instant.parse("2026-09-02T02:00:00Z");
                Instant secondSessionStart = firstSession.plus(Duration.ofDays(7));
                Instant secondSessionEnd = secondSessionStart.plus(Duration.ofMinutes(30));

                // Doctor is on leave during session 2's nominal date
                when(doctorTimeOffRepository.existsActiveOverlapping(DOCTOR_ID, secondSessionStart, secondSessionEnd))
                                .thenReturn(true);

                PreviewAppointmentSeriesCommand command = PreviewAppointmentSeriesCommand.builder()
                                .patientId(PATIENT_ID)
                                .doctorId(DOCTOR_ID)
                                .firstSessionStartTime(firstSession)
                                .sessionDurationMinutes(30)
                                .totalSessions(3)
                                .intervalDays(7)
                                .build();

                AppointmentSeriesPreviewResult preview = previewService.preview(command);

                assertNotNull(preview);
                assertEquals(3, preview.totalSessions());
                assertEquals(7, preview.intervalDays());
                assertTrue(preview.allAvailable());
                assertEquals(0, preview.conflictCount());
                assertEquals(3, preview.sessions().size());

                assertEquals(1, preview.sessions().get(0).sequenceNumber());
                assertEquals("AVAILABLE", preview.sessions().get(0).status());
                assertEquals(firstSession, preview.sessions().get(0).startTime());

                // Session 2 automatically skipped the leave day and moved to next working day (2026-09-10)
                assertEquals(2, preview.sessions().get(1).sequenceNumber());
                assertEquals("AVAILABLE", preview.sessions().get(1).status());
                assertEquals(Instant.parse("2026-09-10T02:00:00Z"), preview.sessions().get(1).startTime());

                // Session 3 scheduled 7 days after session 2
                assertEquals(3, preview.sessions().get(2).sequenceNumber());
                assertEquals("AVAILABLE", preview.sessions().get(2).status());
                assertEquals(Instant.parse("2026-09-17T02:00:00Z"), preview.sessions().get(2).startTime());
        }

        @Test
        void tc04PreviewsSeriesFlagsAppointmentConflictWhenSlotAlreadyBooked() {
                mockWorkingHours(LocalTime.of(7, 0), LocalTime.of(18, 0));

                Instant firstSession = Instant.parse("2026-09-02T02:00:00Z");
                Instant secondSessionStart = firstSession.plus(Duration.ofDays(7));
                Instant secondSessionEnd = secondSessionStart.plus(Duration.ofMinutes(30));

                var existingAppointment = Appointment.restore(
                                UUID.randomUUID(),
                                "APT999999",
                                UUID.randomUUID(),
                                DOCTOR_ID,
                                secondSessionStart,
                                secondSessionEnd,
                                AppointmentStatus.SCHEDULED,
                                "Khám trước đó",
                                null,
                                null,
                                null,
                                ACTOR_ID,
                                NOW,
                                "COUNTER",
                                null,
                                null,
                                null,
                                null);
                new AppointmentRepositoryAdapter(appointmentJpaRepository, new AppointmentPersistenceMapper())
                                .save(existingAppointment);

                PreviewAppointmentSeriesCommand command = PreviewAppointmentSeriesCommand.builder()
                                .patientId(PATIENT_ID)
                                .doctorId(DOCTOR_ID)
                                .firstSessionStartTime(firstSession)
                                .sessionDurationMinutes(30)
                                .totalSessions(3)
                                .intervalDays(7)
                                .build();

                AppointmentSeriesPreviewResult preview = previewService.preview(command);

                assertNotNull(preview);
                assertEquals(3, preview.totalSessions());
                assertFalse(preview.allAvailable());
                assertEquals(1, preview.conflictCount());

                assertEquals(2, preview.sessions().get(1).sequenceNumber());
                assertEquals("APPOINTMENT_CONFLICT", preview.sessions().get(1).status());
        }

        @Test
        void doctorRoleRejectedWith403AndIndependentAuditLogRecorded() {
                // User has DOCTOR role only (no ADMIN, no RECEPTIONIST)
                when(currentUserPort.hasRole("ADMIN")).thenReturn(false);
                when(currentUserPort.hasRole("RECEPTIONIST")).thenReturn(false);

                CreateAppointmentSeriesCommand command = CreateAppointmentSeriesCommand.builder()
                                .patientId(PATIENT_ID)
                                .doctorId(DOCTOR_ID)
                                .title("Liệu trình bác sĩ tự tạo")
                                .totalSessions(2)
                                .intervalDays(7)
                                .sessions(List.of(
                                                new CreateAppointmentSeriesCommand.AppointmentSeriesSessionCommand(1,
                                                                NOW.plusSeconds(3600), NOW.plusSeconds(5400)),
                                                new CreateAppointmentSeriesCommand.AppointmentSeriesSessionCommand(2,
                                                                NOW.plusSeconds(7200), NOW.plusSeconds(9000))))
                                .build();

                assertThrows(UnauthorizedAppointmentOperationException.class, () -> createService.create(command));

                // Series was not created
                assertEquals(0, seriesJpaRepository.count());
                assertEquals(0, appointmentJpaRepository.count());

                // Independent audit log was written
                var audits = auditLogJpaRepository.findAll();
                assertEquals(1, audits.size());
                assertEquals(ActionType.ACCESS_DENIED, audits.get(0).getActionType());
                assertEquals(ResourceType.APPOINTMENT, audits.get(0).getResourceType());
                assertTrue(audits.get(0).getDetail()
                                .contains("User lacks RECEPTIONIST or ADMIN role to create appointment series"));
        }

        @Test
        void doctorRoleRejectedWith403OnPreviewAndIndependentAuditLogRecorded() {
                when(currentUserPort.hasRole("ADMIN")).thenReturn(false);
                when(currentUserPort.hasRole("RECEPTIONIST")).thenReturn(false);

                PreviewAppointmentSeriesCommand command = PreviewAppointmentSeriesCommand.builder()
                                .patientId(PATIENT_ID)
                                .doctorId(DOCTOR_ID)
                                .firstSessionStartTime(NOW.plusSeconds(3600))
                                .sessionDurationMinutes(30)
                                .totalSessions(3)
                                .intervalDays(7)
                                .build();

                assertThrows(UnauthorizedAppointmentOperationException.class, () -> previewService.preview(command));

                var audits = auditLogJpaRepository.findAll();
                assertEquals(1, audits.size());
                assertEquals(ActionType.ACCESS_DENIED, audits.get(0).getActionType());
                assertEquals(ResourceType.APPOINTMENT, audits.get(0).getResourceType());
                assertTrue(audits.get(0).getDetail()
                                .contains("User lacks RECEPTIONIST or ADMIN role to preview appointment series"));
        }
}
