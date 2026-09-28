package com.benhsoan.application.ucservice.appointment;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.benhsoan.application.ucservice.patient.PatientAccessGuard;
import com.benhsoan.domain.appointment.Appointment;
import com.benhsoan.domain.appointment.DoctorSchedule;
import com.benhsoan.domain.appointment.exception.DoctorInactiveException;
import com.benhsoan.domain.appointment.exception.DoctorNotFoundException;
import com.benhsoan.domain.appointment.exception.DoctorScheduleNotFoundException;
import com.benhsoan.domain.appointment.exception.DoctorUnavailableException;
import com.benhsoan.domain.appointment.exception.InvalidAppointmentTimeException;
import com.benhsoan.domain.appointment.exception.InvalidDoctorRoleException;
import com.benhsoan.domain.appointment.exception.SlotAlreadyBookedException;
import com.benhsoan.domain.auditlog.AuditLog;
import com.benhsoan.domain.auditlog.enums.ActionType;
import com.benhsoan.domain.auditlog.enums.ResourceType;
import com.benhsoan.domain.auth.Role;
import com.benhsoan.domain.auth.User;
import com.benhsoan.domain.patient.Patient;
import com.benhsoan.domain.shared.exception.ValidationException;
import com.benhsoan.port.dto.command.appointment.PatientBookAppointmentCommand;
import com.benhsoan.port.dto.result.appointment.PatientAppointmentResult;
import com.benhsoan.port.inbound.appointment.PatientBookAppointmentUseCase;
import com.benhsoan.port.outbound.generator.AppointmentCodeGenerator;
import com.benhsoan.port.outbound.repository.appointment.AppointmentRepository;
import com.benhsoan.port.outbound.repository.appointment.DoctorScheduleRepository;
import com.benhsoan.port.outbound.repository.audit.AuditLogRepository;
import com.benhsoan.port.outbound.repository.auth.RoleRepository;
import com.benhsoan.port.outbound.repository.auth.UserRepository;
import com.benhsoan.port.outbound.repository.patient.PatientRepository;
import com.benhsoan.port.outbound.security.CurrentUserPort;
import com.benhsoan.port.outbound.time.ClockPort;
import com.benhsoan.domain.appointment.DoctorWeeklySchedule;
import com.benhsoan.domain.appointment.exception.DoctorNotWorkingException;
import com.benhsoan.port.outbound.repository.appointment.DoctorTimeOffRepository;
import com.benhsoan.port.outbound.repository.appointment.DoctorWeeklyScheduleRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;

import org.springframework.beans.factory.annotation.Autowired;
import com.benhsoan.port.outbound.repository.appointment.AppointmentWaitlistRepository;

/**
 * NCL-14-CN-003 CV-03: books an appointment on behalf of the authenticated patient via the
 * online portal, guarding past time (TC-03), slot collision (TC-02 / QTN-04) and writing an
 * audit trail (TC-04).
 */

@Service
@Transactional
public class PatientBookAppointmentService implements PatientBookAppointmentUseCase {

    private static final Duration SLOT_DURATION = Duration.ofMinutes(30);

    private static final ZoneId CLINIC_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");

    private static final String ONLINE_PORTAL = "ONLINE_PORTAL";

    private static final String DEFAULT_REASON = "Đặt lịch hẹn trực tuyến";

    private final AppointmentRepository appointmentRepository;

    private final AppointmentCodeGenerator appointmentCodeGenerator;

    private final DoctorScheduleRepository doctorScheduleRepository;

    private final DoctorWeeklyScheduleRepository doctorWeeklyScheduleRepository;

    private final DoctorTimeOffRepository doctorTimeOffRepository;

    private final PatientRepository patientRepository;

    private final UserRepository userRepository;

    private final RoleRepository roleRepository;

    private final CurrentUserPort currentUserPort;

    private final PatientAccessGuard patientAccessGuard;

    private final AuditLogRepository auditLogRepository;

    private final ClockPort clockPort;

    private final ObjectMapper objectMapper;

    private final AppointmentWaitlistRepository appointmentWaitlistRepository;

    public PatientBookAppointmentService(
            AppointmentRepository appointmentRepository,
            AppointmentCodeGenerator appointmentCodeGenerator,
            DoctorScheduleRepository doctorScheduleRepository,
            DoctorWeeklyScheduleRepository doctorWeeklyScheduleRepository,
            DoctorTimeOffRepository doctorTimeOffRepository,
            PatientRepository patientRepository,
            UserRepository userRepository,
            RoleRepository roleRepository,
            CurrentUserPort currentUserPort,
            AuditLogRepository auditLogRepository,
            ClockPort clockPort,
            ObjectMapper objectMapper,
            PatientAccessGuard patientAccessGuard) {
        this(appointmentRepository, appointmentCodeGenerator, doctorScheduleRepository,
                doctorWeeklyScheduleRepository, doctorTimeOffRepository, patientRepository,
                userRepository, roleRepository, currentUserPort, auditLogRepository, clockPort,
                objectMapper, null, patientAccessGuard);
    }

    @Autowired
    public PatientBookAppointmentService(
            AppointmentRepository appointmentRepository,
            AppointmentCodeGenerator appointmentCodeGenerator,
            DoctorScheduleRepository doctorScheduleRepository,
            DoctorWeeklyScheduleRepository doctorWeeklyScheduleRepository,
            DoctorTimeOffRepository doctorTimeOffRepository,
            PatientRepository patientRepository,
            UserRepository userRepository,
            RoleRepository roleRepository,
            CurrentUserPort currentUserPort,
            AuditLogRepository auditLogRepository,
            ClockPort clockPort,
            ObjectMapper objectMapper,
            @Autowired(required = false) AppointmentWaitlistRepository appointmentWaitlistRepository,
            PatientAccessGuard patientAccessGuard) {
        this.appointmentRepository = appointmentRepository;
        this.appointmentCodeGenerator = appointmentCodeGenerator;
        this.doctorScheduleRepository = doctorScheduleRepository;
        this.doctorWeeklyScheduleRepository = doctorWeeklyScheduleRepository;
        this.doctorTimeOffRepository = doctorTimeOffRepository;
        this.patientRepository = patientRepository;
        this.userRepository = userRepository;
        this.roleRepository = roleRepository;
        this.currentUserPort = currentUserPort;
        this.auditLogRepository = auditLogRepository;
        this.clockPort = clockPort;
        this.objectMapper = objectMapper;
        this.appointmentWaitlistRepository = appointmentWaitlistRepository;
        this.patientAccessGuard = patientAccessGuard;
    }

    @Override
    public PatientAppointmentResult book(PatientBookAppointmentCommand command) {
        if (command.doctorId() == null
                || command.appointmentDate() == null
                || command.startTime() == null) {
            throw new ValidationException("doctorId, appointmentDate and startTime are required.");
        }

        Instant now = clockPort.now();
        Instant startTime = toInstant(command.appointmentDate(), command.startTime());
        Instant endTime = startTime.plus(SLOT_DURATION);

        if (!isAlignedToSlot(command.startTime())) {
            throw new InvalidAppointmentTimeException("Khung giờ đặt lịch phải theo mốc 30 phút.");
        }

        if (!startTime.isAfter(now)) {
            throw new InvalidAppointmentTimeException();
        }

        UUID userId = currentUserPort.getCurrentUserId();

        // NCL-14-CN-010: patientId == null keeps the own-profile behaviour; a non-null
        // value
        // selects a target patient that is authorised server-side by
        // PatientAccessGuard.
        Patient targetPatient = command.patientId() == null
                ? patientRepository.findByUserId(userId)
                        .orElseThrow(() -> new AccessDeniedException(
                                "No patient profile is linked to the authenticated user."))
                : patientAccessGuard.requirePatientAccess(command.patientId());

        // QTN-33: re-validate the target profile server-side regardless of how it was
        // resolved,
        // so a client cannot bypass the linked-profile list and book for an inactive or
        // merged
        // patient by submitting that patientId directly. Historical records are
        // untouched; this
        // guard only gates the creation of NEW appointments.
        targetPatient.validateCanReceiveNewActivity();

        UUID patientId = targetPatient.getId();
        boolean bookingOnBehalfOfDependent = !userId.equals(targetPatient.getUserId());

        // QTN-04: lock the doctor's user row so portal and reception serialize
        // appointment
        // creation per doctor before the overlap check and insert.
        User doctor = userRepository.findByIdForUpdate(command.doctorId())
                .orElseThrow(() -> new DoctorNotFoundException(command.doctorId()));
        if (!doctor.isActive()) {
            throw new DoctorInactiveException(doctor.getId());
        }
        requireDoctorRole(doctor);

        LocalTime scheduleStartTime;
        LocalTime scheduleEndTime;

        java.util.Optional<DoctorWeeklySchedule> weeklyOpt = doctorWeeklyScheduleRepository
                .findByDoctorIdAndDayOfWeek(command.doctorId(), command.appointmentDate().getDayOfWeek());
        if (weeklyOpt.isPresent()) {
            DoctorWeeklySchedule weekly = weeklyOpt.get();
            if (!weekly.isActive()) {
                throw new DoctorUnavailableException(command.doctorId(), command.appointmentDate());
            }
            java.util.Optional<DoctorSchedule> dateScheduleOpt = doctorScheduleRepository
                    .findByDoctorIdAndScheduleDateForUpdate(command.doctorId(), command.appointmentDate());
            if (dateScheduleOpt.isPresent()) {
                DoctorSchedule schedule = dateScheduleOpt.get();
                if (!schedule.isActive()) {
                    throw new DoctorUnavailableException(command.doctorId(), command.appointmentDate());
                }
                scheduleStartTime = schedule.getStartTime();
                scheduleEndTime = schedule.getEndTime();
            } else {
                scheduleStartTime = weekly.getStartTime();
                scheduleEndTime = weekly.getEndTime();
            }
        } else {
            java.util.Optional<DoctorSchedule> dateScheduleOpt = doctorScheduleRepository
                    .findByDoctorIdAndScheduleDateForUpdate(command.doctorId(), command.appointmentDate());
            if (dateScheduleOpt.isEmpty()) {
                throw new DoctorScheduleNotFoundException(command.doctorId(), command.appointmentDate());
            }
            DoctorSchedule schedule = dateScheduleOpt.get();
            if (!schedule.isActive()) {
                throw new DoctorUnavailableException(command.doctorId(), command.appointmentDate());
            }
            scheduleStartTime = schedule.getStartTime();
            scheduleEndTime = schedule.getEndTime();
        }

        LocalTime slotEndTime = command.startTime().plus(SLOT_DURATION);
        if (command.startTime().isBefore(scheduleStartTime)
                || slotEndTime.isAfter(scheduleEndTime)) {
            throw new InvalidAppointmentTimeException("Khung giờ đặt lịch nằm ngoài giờ làm việc của bác sĩ.");
        }

        // QTN-30: Check doctor time-off
        if (doctorTimeOffRepository.existsActiveOverlapping(command.doctorId(), startTime, endTime)) {
            throw new DoctorNotWorkingException("Bác sĩ không làm việc trong khung giờ này.");
        }

        if (!appointmentRepository.findActiveAppointmentsForDoctorBetween(
                command.doctorId(),
                startTime,
                endTime).isEmpty()) {
            throw new SlotAlreadyBookedException();
        }

        String reason = command.reason() == null || command.reason().isBlank()
                ? DEFAULT_REASON
                : command.reason();

        String appointmentCode = appointmentCodeGenerator.generate();

        Appointment appointment = Appointment.create(
                appointmentCode,
                patientId,
                command.doctorId(),
                startTime,
                endTime,
                reason,
                userId,
                ONLINE_PORTAL);

        Appointment saved = appointmentRepository.save(appointment);

        // NCL-03-CN-012-TC-03: Tự động chuyển trạng thái mục chờ thành SCHEDULED khi
        // bệnh nhân đặt lịch online
        if (appointmentWaitlistRepository != null && command.appointmentDate() != null) {
            appointmentWaitlistRepository.findActiveByPatientAndDoctorAndDate(
                    patientId,
                    command.doctorId(),
                    command.appointmentDate()).ifPresent(waitlist -> {
                        waitlist.markScheduled(saved.getId(), now);
                        appointmentWaitlistRepository.save(waitlist);
                    });
        }

        auditLogRepository.save(AuditLog.create(
                userId,
                ActionType.CREATE,
                ResourceType.APPOINTMENT,
                saved.getId(),
                auditDetail(saved, userId, bookingOnBehalfOfDependent, now),
                null,
                now));

        return toResult(saved);
    }

    private Instant toInstant(LocalDate date, LocalTime time) {
        return ZonedDateTime.of(date, time, CLINIC_ZONE).toInstant();
    }

    private void requireDoctorRole(User doctor) {
        Role doctorRole = roleRepository.findByName("DOCTOR")
                .orElseThrow(() -> new IllegalStateException("DOCTOR role is not configured."));
        if (!doctorRole.getId().equals(doctor.getRoleId())) {
            throw new InvalidDoctorRoleException(doctor.getId());
        }
    }

    private boolean isAlignedToSlot(LocalTime startTime) {
        return startTime.getMinute() % 30 == 0
                && startTime.getSecond() == 0
                && startTime.getNano() == 0;
    }

    private String auditDetail(
            Appointment appointment,
            UUID actorUserId,
            boolean bookingOnBehalfOfDependent,
            Instant bookedAt) {
        Map<String, Object> detail = new LinkedHashMap<>();
        detail.put("patientId", appointment.getPatientId().toString());
        detail.put("doctorId", appointment.getDoctorId().toString());
        detail.put("appointmentTime", appointment.getStartTime().toString());
        detail.put("channel", ONLINE_PORTAL);
        detail.put("bookedAt", bookedAt.toString());
        // NCL-14-CN-010: distinguish the authenticated actor from the target patient.
        detail.put("bookedByUserId", actorUserId.toString());
        detail.put("bookingOnBehalfOfDependent", bookingOnBehalfOfDependent);

        try {
            return objectMapper.writeValueAsString(detail);
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Could not serialize appointment booking audit detail.", exception);
        }
    }

    private PatientAppointmentResult toResult(Appointment appointment) {
        return new PatientAppointmentResult(
                appointment.getId(),
                appointment.getAppointmentCode(),
                appointment.getPatientId(),
                appointment.getDoctorId(),
                appointment.getStartTime(),
                appointment.getEndTime(),
                appointment.getStatus(),
                appointment.getReason(),
                appointment.getBookingChannel(),
                appointment.getCreatedAt());
    }
}
