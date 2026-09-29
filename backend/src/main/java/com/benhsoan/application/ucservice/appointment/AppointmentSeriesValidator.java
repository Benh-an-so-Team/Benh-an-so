package com.benhsoan.application.ucservice.appointment;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import org.springframework.stereotype.Component;

import com.benhsoan.domain.appointment.AppointmentSeriesConflictDetail;
import com.benhsoan.domain.shared.exception.ValidationException;
import com.benhsoan.port.outbound.repository.appointment.AppointmentRepository;
import com.benhsoan.port.outbound.repository.appointment.DoctorTimeOffRepository;
import com.benhsoan.port.outbound.time.ClockPort;

import lombok.RequiredArgsConstructor;

@Component
@RequiredArgsConstructor
public class AppointmentSeriesValidator {

    private static final ZoneId CLINIC_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");

    private final DoctorScheduleValidator doctorScheduleValidator;
    private final DoctorTimeOffRepository doctorTimeOffRepository;
    private final AppointmentRepository appointmentRepository;
    private final ClockPort clockPort;

    public record SessionSlot(
            int sequenceNumber,
            Instant startTime,
            Instant endTime
    ) {}

    public void validateSessionStructure(List<SessionSlot> sessions, int totalSessions, int intervalDays) {
        if (sessions == null || sessions.isEmpty()) {
            throw new ValidationException("Danh sách các buổi của liệu trình không được để trống.");
        }
        if (sessions.size() != totalSessions) {
            throw new ValidationException("Số lượng buổi trong danh sách (" + sessions.size()
                    + ") không khớp với tổng số buổi (" + totalSessions + ").");
        }

        Set<Integer> seenSequences = new HashSet<>();
        for (SessionSlot slot : sessions) {
            if (slot.sequenceNumber() < 1 || slot.sequenceNumber() > totalSessions) {
                throw new ValidationException("Số thứ tự buổi khám (" + slot.sequenceNumber()
                        + ") không hợp lệ, phải nằm trong khoảng từ 1 đến " + totalSessions + ".");
            }
            if (!seenSequences.add(slot.sequenceNumber())) {
                throw new ValidationException("Số thứ tự buổi khám " + slot.sequenceNumber() + " bị trùng lặp.");
            }
            if (slot.startTime() == null || slot.endTime() == null) {
                throw new ValidationException("Thời gian bắt đầu và kết thúc của buổi số "
                        + slot.sequenceNumber() + " không được để trống.");
            }
            if (!slot.endTime().isAfter(slot.startTime())) {
                throw new ValidationException("Buổi số " + slot.sequenceNumber() + ": Thời gian kết thúc phải sau thời gian bắt đầu.");
            }
        }

        if (seenSequences.size() != totalSessions) {
            throw new ValidationException("Số thứ tự các buổi khám phải duy nhất và liên tục từ 1 đến " + totalSessions + ".");
        }

        List<SessionSlot> sorted = sessions.stream()
                .sorted(Comparator.comparingInt(SessionSlot::sequenceNumber))
                .toList();

        for (int i = 1; i < sorted.size(); i++) {
            SessionSlot prev = sorted.get(i - 1);
            SessionSlot curr = sorted.get(i);

            if (!curr.startTime().isAfter(prev.endTime())) {
                throw new ValidationException("Buổi số " + curr.sequenceNumber()
                        + " phải diễn ra sau khi buổi số " + prev.sequenceNumber() + " kết thúc.");
            }

            LocalDate prevDate = prev.startTime().atZone(CLINIC_ZONE).toLocalDate();
            LocalDate currDate = curr.startTime().atZone(CLINIC_ZONE).toLocalDate();

            if (!currDate.isAfter(prevDate)) {
                throw new ValidationException("Buổi số " + curr.sequenceNumber() + " (" + currDate
                        + ") phải diễn ra sau ngày của buổi số " + prev.sequenceNumber() + " (" + prevDate + ").");
            }

            long gapDays = java.time.temporal.ChronoUnit.DAYS.between(prevDate, currDate);
            if (intervalDays == 1) {
                if (gapDays > 14) {
                    throw new ValidationException("Khoảng cách giữa buổi số " + prev.sequenceNumber()
                            + " và buổi số " + curr.sequenceNumber() + " (" + gapDays
                            + " ngày) vượt quá giới hạn chu kỳ hàng ngày.");
                }
            } else {
                long minGap = Math.max(1, intervalDays - 3);
                long maxGap = intervalDays + 14;
                if (gapDays < minGap || gapDays > maxGap) {
                    throw new ValidationException("Khoảng cách giữa buổi số " + prev.sequenceNumber()
                            + " và buổi số " + curr.sequenceNumber() + " (" + gapDays
                            + " ngày) không phù hợp với chu kỳ " + intervalDays + " ngày của liệu trình.");
                }
            }
        }
    }

    public List<SessionSlot> generateSessionsSkippingDoctorOffDays(
            UUID doctorId,
            Instant firstSessionStartTime,
            int sessionDurationMinutes,
            int totalSessions,
            int intervalDays
    ) {
        List<SessionSlot> slots = new ArrayList<>();
        Duration duration = Duration.ofMinutes(sessionDurationMinutes);

        ZonedDateTime firstZoned = firstSessionStartTime.atZone(CLINIC_ZONE);
        LocalTime slotStartTime = firstZoned.toLocalTime();
        LocalDate startDate = firstZoned.toLocalDate();

        // 1. Session 1: If doctor is not working on startDate, look ahead up to 7 days
        LocalDate s1Date = startDate;
        if (!isDoctorWorkingAndAvailable(doctorId, s1Date, slotStartTime, duration)) {
            for (int offset = 1; offset <= 7; offset++) {
                LocalDate candidate = startDate.plusDays(offset);
                if (isDoctorWorkingAndAvailable(doctorId, candidate, slotStartTime, duration)) {
                    s1Date = candidate;
                    break;
                }
            }
        }

        ZonedDateTime s1Start = s1Date.atTime(slotStartTime).atZone(CLINIC_ZONE);
        slots.add(new SessionSlot(1, s1Start.toInstant(), s1Start.toInstant().plus(duration)));

        // 2. Subsequent sessions: target = previousDate + intervalDays
        LocalDate prevDate = s1Date;
        for (int seq = 2; seq <= totalSessions; seq++) {
            LocalDate nominalDate = prevDate.plusDays(intervalDays);
            LocalDate sessionDate = nominalDate;

            // If doctor is off on nominalDate, look ahead up to 7 days to skip off days
            if (!isDoctorWorkingAndAvailable(doctorId, nominalDate, slotStartTime, duration)) {
                for (int offset = 1; offset <= 7; offset++) {
                    LocalDate candidate = nominalDate.plusDays(offset);
                    if (isDoctorWorkingAndAvailable(doctorId, candidate, slotStartTime, duration)) {
                        sessionDate = candidate;
                        break;
                    }
                }
            }

            ZonedDateTime slotStart = sessionDate.atTime(slotStartTime).atZone(CLINIC_ZONE);
            slots.add(new SessionSlot(seq, slotStart.toInstant(), slotStart.toInstant().plus(duration)));
            prevDate = sessionDate;
        }

        return slots;
    }

    private boolean isDoctorWorkingAndAvailable(UUID doctorId, LocalDate date, LocalTime startTime, Duration duration) {
        ZonedDateTime startZoned = date.atTime(startTime).atZone(CLINIC_ZONE);
        Instant startInstant = startZoned.toInstant();
        Instant endInstant = startInstant.plus(duration);
        return doctorScheduleValidator.isDoctorWorkingAndAvailable(doctorId, startInstant, endInstant);
    }

    public List<AppointmentSeriesConflictDetail> validateSessions(UUID doctorId, List<SessionSlot> sessions) {
        List<AppointmentSeriesConflictDetail> conflicts = new ArrayList<>();
        Instant now = clockPort.now();

        // 1. Check internal overlap between sessions
        for (int i = 0; i < sessions.size(); i++) {
            SessionSlot s1 = sessions.get(i);
            for (int j = i + 1; j < sessions.size(); j++) {
                SessionSlot s2 = sessions.get(j);
                if (s1.startTime().isBefore(s2.endTime()) && s1.endTime().isAfter(s2.startTime())) {
                    conflicts.add(new AppointmentSeriesConflictDetail(
                            s2.sequenceNumber(),
                            s2.startTime(),
                            s2.endTime(),
                            "INTERNAL_CONFLICT",
                            "Buổi số " + s2.sequenceNumber() + " bị trùng giờ với buổi số " + s1.sequenceNumber() + " trong cùng liệu trình."
                    ));
                }
            }
        }

        // 2. Check each session individually
        for (SessionSlot slot : sessions) {
            if (!slot.endTime().isAfter(slot.startTime())) {
                conflicts.add(new AppointmentSeriesConflictDetail(
                        slot.sequenceNumber(),
                        slot.startTime(),
                        slot.endTime(),
                        "INVALID_TIME",
                        "Thời gian kết thúc phải sau thời gian bắt đầu."
                ));
                continue;
            }

            if (slot.startTime().isBefore(now)) {
                conflicts.add(new AppointmentSeriesConflictDetail(
                        slot.sequenceNumber(),
                        slot.startTime(),
                        slot.endTime(),
                        "PAST_TIME",
                        "Thời gian đặt lịch không được ở trong quá khứ."
                ));
                continue;
            }

            ZonedDateTime startZoned = slot.startTime().atZone(CLINIC_ZONE);
            ZonedDateTime endZoned = slot.endTime().atZone(CLINIC_ZONE);
            LocalDate startDate = startZoned.toLocalDate();
            LocalDate endDate = endZoned.toLocalDate();
            LocalTime slotStartTime = startZoned.toLocalTime();
            LocalTime slotEndTime = endZoned.toLocalTime();

            if (!startDate.equals(endDate)) {
                conflicts.add(new AppointmentSeriesConflictDetail(
                        slot.sequenceNumber(),
                        slot.startTime(),
                        slot.endTime(),
                        "DOCTOR_NOT_WORKING",
                        "Khung giờ khám không được kéo dài qua ngày khác."
                ));
                continue;
            }

            // QTN-30: Check doctor working hours
            Optional<DoctorScheduleValidator.EffectiveWorkingHours> workingHoursOpt =
                    doctorScheduleValidator.resolveWorkingHours(doctorId, startDate);
            if (workingHoursOpt.isEmpty()) {
                conflicts.add(new AppointmentSeriesConflictDetail(
                        slot.sequenceNumber(),
                        slot.startTime(),
                        slot.endTime(),
                        "DOCTOR_NOT_WORKING",
                        "Bác sĩ không có ca làm việc vào ngày " + startDate + "."
                ));
                continue;
            }

            DoctorScheduleValidator.EffectiveWorkingHours workingHours = workingHoursOpt.get();
            if (slotStartTime.isBefore(workingHours.startTime()) || slotEndTime.isAfter(workingHours.endTime())) {
                conflicts.add(new AppointmentSeriesConflictDetail(
                        slot.sequenceNumber(),
                        slot.startTime(),
                        slot.endTime(),
                        "DOCTOR_NOT_WORKING",
                        "Khung giờ đặt lịch nằm ngoài ca làm việc (" + workingHours.startTime() + " - " + workingHours.endTime() + ") của bác sĩ."
                ));
                continue;
            }

            // QTN-30: Check doctor time-off
            if (doctorTimeOffRepository.existsActiveOverlapping(doctorId, slot.startTime(), slot.endTime())) {
                conflicts.add(new AppointmentSeriesConflictDetail(
                        slot.sequenceNumber(),
                        slot.startTime(),
                        slot.endTime(),
                        "DOCTOR_TIME_OFF",
                        "Bác sĩ có lịch nghỉ phép đã đăng ký trong khung giờ này."
                ));
                continue;
            }

            // QTN-04: Check appointment conflict
            if (appointmentRepository.existsActiveAppointmentConflict(doctorId, slot.startTime(), slot.endTime())) {
                conflicts.add(new AppointmentSeriesConflictDetail(
                        slot.sequenceNumber(),
                        slot.startTime(),
                        slot.endTime(),
                        "APPOINTMENT_CONFLICT",
                        "Bác sĩ đã có lịch hẹn khác trong khung giờ này."
                ));
            }
        }

        return conflicts;
    }
}
