package com.benhsoan.application.ucservice.appointment;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.benhsoan.domain.appointment.enums.WaitlistStatus;
import com.benhsoan.port.dto.query.appointment.GetAppointmentWaitlistQuery;
import com.benhsoan.port.dto.result.appointment.AppointmentWaitlistResult;
import com.benhsoan.port.inbound.appointment.GetAppointmentWaitlistUseCase;
import com.benhsoan.port.outbound.repository.appointment.AppointmentWaitlistRepository;
import com.benhsoan.port.outbound.time.ClockPort;

@Service
@Transactional(readOnly = true)
public class GetAppointmentWaitlistService implements GetAppointmentWaitlistUseCase {

    public static final ZoneId CLINIC_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");

    private final AppointmentWaitlistRepository appointmentWaitlistRepository;
    private final AppointmentWaitlistResultMapper resultMapper;
    private final ClockPort clockPort;

    public GetAppointmentWaitlistService(
            AppointmentWaitlistRepository appointmentWaitlistRepository,
            AppointmentWaitlistResultMapper resultMapper) {
        this(appointmentWaitlistRepository, resultMapper, Instant::now);
    }

    @Autowired
    public GetAppointmentWaitlistService(
            AppointmentWaitlistRepository appointmentWaitlistRepository,
            AppointmentWaitlistResultMapper resultMapper,
            @Autowired(required = false) ClockPort clockPort) {
        this.appointmentWaitlistRepository = appointmentWaitlistRepository;
        this.resultMapper = resultMapper;
        this.clockPort = clockPort != null ? clockPort : Instant::now;
    }

    @Override
    public List<AppointmentWaitlistResult> getWaitlist(GetAppointmentWaitlistQuery query) {
        WaitlistStatus targetStatus = (query != null && query.status() != null)
                ? query.status()
                : WaitlistStatus.WAITING;

        var doctorId = query != null ? query.doctorId() : null;
        var desiredDate = query != null ? query.desiredDate() : null;

        if (desiredDate == null && targetStatus == WaitlistStatus.WAITING) {
            LocalDate fromDate = clockPort.now().atZone(CLINIC_ZONE).toLocalDate();
            return appointmentWaitlistRepository.findWaitlist(doctorId, null, fromDate, targetStatus)
                    .stream()
                    .map(resultMapper::toResult)
                    .toList();
        }

        return appointmentWaitlistRepository.findWaitlist(doctorId, desiredDate, targetStatus)
                .stream()
                .map(resultMapper::toResult)
                .toList();
    }
}
