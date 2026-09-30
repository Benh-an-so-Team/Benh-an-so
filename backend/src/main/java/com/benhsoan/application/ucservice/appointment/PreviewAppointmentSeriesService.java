package com.benhsoan.application.ucservice.appointment;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.benhsoan.domain.appointment.AppointmentSeriesConflictDetail;
import com.benhsoan.domain.appointment.exception.DoctorInactiveException;
import com.benhsoan.domain.appointment.exception.DoctorNotFoundException;
import com.benhsoan.domain.appointment.exception.UnauthorizedAppointmentOperationException;
import com.benhsoan.domain.auth.User;
import com.benhsoan.domain.patient.exception.PatientNotFoundException;
import com.benhsoan.domain.shared.exception.ValidationException;
import com.benhsoan.port.dto.command.appointment.PreviewAppointmentSeriesCommand;
import com.benhsoan.port.dto.result.appointment.AppointmentSeriesPreviewResult;
import com.benhsoan.port.dto.result.appointment.AppointmentSeriesSessionPreviewResult;
import com.benhsoan.port.inbound.appointment.PreviewAppointmentSeriesUseCase;
import com.benhsoan.port.outbound.repository.auth.UserRepository;
import com.benhsoan.port.outbound.repository.patient.PatientRepository;
import com.benhsoan.port.outbound.security.CurrentUserPort;
import com.benhsoan.port.outbound.time.ClockPort;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class PreviewAppointmentSeriesService implements PreviewAppointmentSeriesUseCase {

    private final PatientRepository patientRepository;
    private final UserRepository userRepository;
    private final AppointmentSeriesValidator appointmentSeriesValidator;
    private final CurrentUserPort currentUserPort;
    private final ClockPort clockPort;
    private final AppointmentAccessDeniedAuditWriter appointmentAccessDeniedAuditWriter;

    @Override
    public AppointmentSeriesPreviewResult preview(PreviewAppointmentSeriesCommand command) {
        UUID currentUserId = currentUserPort.getCurrentUserId();
        if (!currentUserPort.hasRole("ADMIN") && !currentUserPort.hasRole("RECEPTIONIST")) {
            appointmentAccessDeniedAuditWriter.writeSeriesPreviewDenied(
                    currentUserId,
                    clockPort.now(),
                    "User lacks RECEPTIONIST or ADMIN role to preview appointment series");
            throw new UnauthorizedAppointmentOperationException();
        }

        if (command.totalSessions() < 2) {
            throw new ValidationException("Số buổi của liệu trình phải từ 2 trở lên.");
        }
        if (command.intervalDays() < 1) {
            throw new ValidationException("Khoảng cách giữa các buổi phải từ 1 ngày trở lên.");
        }
        if (command.sessionDurationMinutes() <= 0) {
            throw new ValidationException("Thời lượng mỗi buổi phải lớn hơn 0 phút.");
        }

        patientRepository.findById(command.patientId())
                .orElseThrow(() -> new PatientNotFoundException(command.patientId()));

        User doctor = userRepository.findById(command.doctorId())
                .orElseThrow(() -> new DoctorNotFoundException(command.doctorId()));

        if (!doctor.isActive()) {
            throw new DoctorInactiveException(doctor.getId());
        }

        List<AppointmentSeriesValidator.SessionSlot> slots = appointmentSeriesValidator
                .generateSessionsSkippingDoctorOffDays(
                        command.doctorId(),
                        command.firstSessionStartTime(),
                        command.sessionDurationMinutes(),
                        command.totalSessions(),
                        command.intervalDays());

        List<AppointmentSeriesConflictDetail> conflicts = appointmentSeriesValidator
                .validateSessions(command.doctorId(), slots);
        Map<Integer, AppointmentSeriesConflictDetail> conflictMap = conflicts.stream()
                .collect(Collectors.toMap(
                        AppointmentSeriesConflictDetail::sequenceNumber,
                        Function.identity(),
                        (existing, replacement) -> existing));

        List<AppointmentSeriesSessionPreviewResult> sessionResults = slots.stream()
                .map(slot -> {
                    AppointmentSeriesConflictDetail conflict = conflictMap.get(slot.sequenceNumber());
                    if (conflict != null) {
                        return AppointmentSeriesSessionPreviewResult.builder()
                                .sequenceNumber(slot.sequenceNumber())
                                .startTime(slot.startTime())
                                .endTime(slot.endTime())
                                .status(conflict.conflictType())
                                .conflictReason(conflict.reason())
                                .build();
                    } else {
                        return AppointmentSeriesSessionPreviewResult.builder()
                                .sequenceNumber(slot.sequenceNumber())
                                .startTime(slot.startTime())
                                .endTime(slot.endTime())
                                .status("AVAILABLE")
                                .conflictReason(null)
                                .build();
                    }
                })
                .toList();

        return AppointmentSeriesPreviewResult.builder()
                .totalSessions(command.totalSessions())
                .intervalDays(command.intervalDays())
                .allAvailable(conflicts.isEmpty())
                .conflictCount(conflicts.size())
                .sessions(sessionResults)
                .build();
    }
}
