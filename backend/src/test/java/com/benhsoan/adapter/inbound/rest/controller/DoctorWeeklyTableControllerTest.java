package com.benhsoan.adapter.inbound.rest.controller;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.EnableAspectJAutoProxy;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

import com.benhsoan.adapter.inbound.rest.mapper.AppointmentRestMapper;
import com.benhsoan.domain.appointment.enums.AppointmentStatus;
import com.benhsoan.domain.appointment.enums.SlotAvailabilityStatus;
import com.benhsoan.domain.appointment.exception.DoctorNotWorkingException;
import com.benhsoan.domain.auditlog.AuditLog;
import com.benhsoan.domain.auditlog.enums.ActionType;
import com.benhsoan.domain.auditlog.enums.ResourceType;
import com.benhsoan.exception.GlobalExceptionHandler;
import com.benhsoan.infrastructure.security.annotation.RequirePermissionAspect;
import com.benhsoan.infrastructure.security.service.PermissionEvaluator;
import com.benhsoan.port.dto.result.AppointmentResult;
import com.benhsoan.port.dto.result.appointment.DoctorWeeklyTableResult;
import com.benhsoan.port.dto.result.appointment.DoctorWeeklyTableResult.AppointmentSummaryResult;
import com.benhsoan.port.dto.result.appointment.DoctorWeeklyTableResult.DoctorDayScheduleResult;
import com.benhsoan.port.dto.result.appointment.DoctorWeeklyTableResult.DoctorScheduleDayResult;
import com.benhsoan.port.dto.result.appointment.DoctorWeeklyTableResult.DoctorScheduleSlotResult;
import com.benhsoan.port.dto.result.appointment.DoctorWeeklyTableResult.DoctorSummaryResult;
import com.benhsoan.port.inbound.appointment.CancelAppointmentUseCase;
import com.benhsoan.port.inbound.appointment.ConfirmAppointmentUseCase;
import com.benhsoan.port.inbound.appointment.CreateAppointmentUseCase;
import com.benhsoan.port.inbound.appointment.GetAppointmentByIdUseCase;
import com.benhsoan.port.inbound.appointment.GetDoctorWeeklyScheduleTableUseCase;
import com.benhsoan.port.inbound.appointment.GetOverdueAppointmentsUseCase;
import com.benhsoan.port.inbound.appointment.GetUnconfirmedAppointmentsUseCase;
import com.benhsoan.port.inbound.appointment.MarkAppointmentNoShowUseCase;
import com.benhsoan.port.inbound.appointment.RescheduleAppointmentUseCase;
import com.benhsoan.port.inbound.appointment.SearchAppointmentsUseCase;
import com.benhsoan.adapter.inbound.rest.mapper.AppointmentSeriesRestMapper;
import com.benhsoan.port.inbound.appointment.CreateAppointmentSeriesUseCase;
import com.benhsoan.port.inbound.appointment.GetAppointmentSeriesByIdUseCase;
import com.benhsoan.port.inbound.appointment.GetPatientAppointmentSeriesUseCase;
import com.benhsoan.port.inbound.appointment.PreviewAppointmentSeriesUseCase;
import com.benhsoan.port.inbound.appointment.SendAppointmentReminderManuallyUseCase;
import com.benhsoan.port.outbound.authSecurity.JwtTokenPort;
import com.benhsoan.port.outbound.repository.audit.AuditLogRepository;
import com.benhsoan.port.outbound.repository.auth.RoleRepository;
import com.benhsoan.port.outbound.repository.auth.UserRepository;
import com.benhsoan.port.outbound.repository.auth.UserSessionRepository;
import com.benhsoan.port.outbound.security.CurrentUserPort;
import com.benhsoan.port.outbound.time.ClockPort;

/**
 * Acceptance Criteria tests for NCL-03-CN-010:
 * TC-01: Successful view of weekly doctor schedule grid.
 * TC-02: Direct appointment booking on an empty slot.
 * TC-03: Booking attempt on a doctor's leave slot rejected by QTN-30.
 * TC-04: Unauthorized Pharmacist access rejected with 403 and audited with ACCESS_DENIED.
 */
import com.benhsoan.application.ucservice.anonymization.AnonymizationModeState;

@WebMvcTest(controllers = AppointmentController.class)
@AutoConfigureMockMvc(addFilters = false)
@Import({AppointmentRestMapper.class, AppointmentSeriesRestMapper.class, AnonymizationModeState.class, GlobalExceptionHandler.class, RequirePermissionAspect.class,
        PermissionEvaluator.class, DoctorWeeklyTableControllerTest.AspectTestConfig.class})
class DoctorWeeklyTableControllerTest {

    @TestConfiguration(proxyBeanMethods = false)
    @EnableAspectJAutoProxy
    static class AspectTestConfig {
    }

    private static final UUID DOCTOR_ID = UUID.fromString("22222222-2222-2222-2222-222222222201");
    private static final UUID PATIENT_ID = UUID.fromString("33333333-3333-3333-3333-333333333333");
    private static final LocalDate MONDAY = LocalDate.of(2099, 8, 10);
    private static final LocalDate SUNDAY = LocalDate.of(2099, 8, 16);

    @Autowired private MockMvc mockMvc;
    @Autowired private AnonymizationModeState anonymizationModeState;

    @MockitoBean private CreateAppointmentUseCase createAppointmentUseCase;
    @MockitoBean private CancelAppointmentUseCase cancelAppointmentUseCase;
    @MockitoBean private ConfirmAppointmentUseCase confirmAppointmentUseCase;
    @MockitoBean private MarkAppointmentNoShowUseCase markAppointmentNoShowUseCase;
    @MockitoBean private GetOverdueAppointmentsUseCase getOverdueAppointmentsUseCase;
    @MockitoBean private GetUnconfirmedAppointmentsUseCase getUnconfirmedAppointmentsUseCase;
    @MockitoBean private SearchAppointmentsUseCase searchAppointmentsUseCase;
    @MockitoBean private GetAppointmentByIdUseCase getAppointmentByIdUseCase;
    @MockitoBean private RescheduleAppointmentUseCase rescheduleAppointmentUseCase;
    @MockitoBean private SendAppointmentReminderManuallyUseCase sendAppointmentReminderManuallyUseCase;
    @MockitoBean private GetDoctorWeeklyScheduleTableUseCase getDoctorWeeklyScheduleTableUseCase;
    @MockitoBean private PreviewAppointmentSeriesUseCase previewAppointmentSeriesUseCase;
    @MockitoBean private CreateAppointmentSeriesUseCase createAppointmentSeriesUseCase;
    @MockitoBean private GetAppointmentSeriesByIdUseCase getAppointmentSeriesByIdUseCase;
    @MockitoBean private GetPatientAppointmentSeriesUseCase getPatientAppointmentSeriesUseCase;

    @MockitoBean private JwtTokenPort jwtTokenPort;
    @MockitoBean private UserRepository userRepository;
    @MockitoBean private UserSessionRepository userSessionRepository;
    @MockitoBean private CurrentUserPort currentUserPort;
    @MockitoBean private ClockPort clockPort;
    @MockitoBean private RoleRepository roleRepository;
    @MockitoBean private AuditLogRepository auditLogRepository;

    @AfterEach
    void cleanUp() {
        SecurityContextHolder.clearContext();
        anonymizationModeState.setEnabled(false);
    }

    private RequestPostProcessor withPermissions(String... permissions) {
        return request -> {
            SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                    "receptionist-user", null, List.of(permissions).stream()
                            .map(permission -> new SimpleGrantedAuthority("PERMISSION_" + permission))
                            .toList()));
            return request;
        };
    }

    @Test
    void tc01_receptionistCanViewDoctorWeeklyTable() throws Exception {
        // Given: Lễ tân mở lịch tuần
        DoctorWeeklyTableResult mockResult = DoctorWeeklyTableResult.builder()
                .weekStartDate(MONDAY)
                .weekEndDate(SUNDAY)
                .clinicStartTime(LocalTime.of(7, 30))
                .clinicEndTime(LocalTime.of(17, 30))
                .timeSlots(List.of(LocalTime.of(8, 0), LocalTime.of(8, 30), LocalTime.of(9, 0)))
                .doctors(List.of(DoctorSummaryResult.builder()
                        .id(DOCTOR_ID)
                        .fullName("BS. Nguyen Van A")
                        .username("dr_a")
                        .build()))
                .days(List.of(DoctorDayScheduleResult.builder()
                        .date(MONDAY)
                        .dayOfWeek(DayOfWeek.MONDAY)
                        .doctorSchedules(List.of(DoctorScheduleDayResult.builder()
                                .doctorId(DOCTOR_ID)
                                .doctorName("BS. Nguyen Van A")
                                .workingDay(true)
                                .workingStartTime(LocalTime.of(8, 0))
                                .workingEndTime(LocalTime.of(17, 0))
                                .slots(List.of(
                                        DoctorScheduleSlotResult.builder()
                                                .startTime(Instant.parse("2099-08-10T01:00:00Z"))
                                                .endTime(Instant.parse("2099-08-10T01:30:00Z"))
                                                .slotStartTime(LocalTime.of(8, 0))
                                                .slotEndTime(LocalTime.of(8, 30))
                                                .status(SlotAvailabilityStatus.AVAILABLE)
                                                .isBookable(true)
                                                .build(),
                                        DoctorScheduleSlotResult.builder()
                                                .startTime(Instant.parse("2099-08-10T01:30:00Z"))
                                                .endTime(Instant.parse("2099-08-10T02:00:00Z"))
                                                .slotStartTime(LocalTime.of(8, 30))
                                                .slotEndTime(LocalTime.of(9, 0))
                                                .status(SlotAvailabilityStatus.BOOKED)
                                                .isBookable(false)
                                                .appointment(AppointmentSummaryResult.builder()
                                                        .id(UUID.randomUUID())
                                                        .appointmentCode("APT000001")
                                                        .patientId(PATIENT_ID)
                                                        .patientCode("BN000001")
                                                        .patientName("Tran Thi B")
                                                        .patientPhone("0901234567")
                                                        .status(AppointmentStatus.SCHEDULED)
                                                        .reason("Kham tong quat")
                                                        .build())
                                                .build()
                                ))
                                .build()))
                        .build()))
                .build();

        when(getDoctorWeeklyScheduleTableUseCase.getWeeklyScheduleTable(any())).thenReturn(mockResult);

        // When: Call GET /appointments/doctor-weekly-table with APPOINTMENT_READ
        mockMvc.perform(get("/appointments/doctor-weekly-table")
                        .param("date", "2099-08-10")
                        .with(withPermissions("APPOINTMENT_READ")))
                // Then: Bảng hiển thị đúng lịch hẹn theo cột bác sĩ và hàng khung giờ
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.weekStartDate").value("2099-08-10"))
                .andExpect(jsonPath("$.weekEndDate").value("2099-08-16"))
                .andExpect(jsonPath("$.doctors[0].id").value(DOCTOR_ID.toString()))
                .andExpect(jsonPath("$.doctors[0].fullName").value("BS. Nguyen Van A"))
                .andExpect(jsonPath("$.days[0].doctorSchedules[0].slots[0].status").value("AVAILABLE"))
                .andExpect(jsonPath("$.days[0].doctorSchedules[0].slots[0].isBookable").value(true))
                .andExpect(jsonPath("$.days[0].doctorSchedules[0].slots[1].status").value("BOOKED"))
                .andExpect(jsonPath("$.days[0].doctorSchedules[0].slots[1].isBookable").value(false))
                .andExpect(jsonPath("$.days[0].doctorSchedules[0].slots[1].appointment.appointmentCode").value("APT000001"))
                .andExpect(jsonPath("$.days[0].doctorSchedules[0].slots[1].appointment.patientCode").value("BN000001"))
                .andExpect(jsonPath("$.days[0].doctorSchedules[0].slots[1].appointment.patientName").value("Tran Thi B"));
    }

    @Test
    void tc02_receptionistCanBookAppointmentDirectlyOnEmptySlot() throws Exception {
        // Given: Đang xem lịch tuần, ô 08:00 - 08:30 đang trống
        UUID appointmentId = UUID.randomUUID();
        Instant startTime = Instant.parse("2099-08-10T01:00:00Z");
        Instant endTime = Instant.parse("2099-08-10T01:30:00Z");

        AppointmentResult result = AppointmentResult.builder()
                .id(appointmentId)
                .appointmentCode("APT000002")
                .patientId(PATIENT_ID)
                .doctorId(DOCTOR_ID)
                .startTime(startTime)
                .endTime(endTime)
                .status(AppointmentStatus.SCHEDULED)
                .reason("Dat lich tren o trong")
                .build();

        when(createAppointmentUseCase.create(any())).thenReturn(result);

        // When: Lễ tân bấm vào ô trống để tạo lịch (gọi POST /appointments)
        mockMvc.perform(post("/appointments")
                        .with(withPermissions("APPOINTMENT_CREATE"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "patientId": "%s",
                                  "doctorId": "%s",
                                  "startTime": "%s",
                                  "endTime": "%s",
                                  "reason": "Dat lich tren o trong"
                                }
                                """.formatted(PATIENT_ID, DOCTOR_ID, startTime, endTime)))
                // Then: Lịch hẹn được tạo đúng bác sĩ và khung giờ của ô đó
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(appointmentId.toString()))
                .andExpect(jsonPath("$.appointmentCode").value("APT000002"))
                .andExpect(jsonPath("$.doctorId").value(DOCTOR_ID.toString()))
                .andExpect(jsonPath("$.patientId").value(PATIENT_ID.toString()))
                .andExpect(jsonPath("$.status").value("SCHEDULED"));
    }

    @Test
    void tc03_bookingOnDoctorLeaveSlotIsRejectedByQTN30() throws Exception {
        // Given: Ô thuộc khoảng nghỉ của bác sĩ (QTN-30)
        Instant startTime = Instant.parse("2099-08-10T03:00:00Z");
        Instant endTime = Instant.parse("2099-08-10T04:00:00Z");

        when(createAppointmentUseCase.create(any()))
                .thenThrow(new DoctorNotWorkingException("Bác sĩ không làm việc trong khung giờ này."));

        // When: Lễ tân bấm tạo lịch trên ô đó
        mockMvc.perform(post("/appointments")
                        .with(withPermissions("APPOINTMENT_CREATE"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "patientId": "%s",
                                  "doctorId": "%s",
                                  "startTime": "%s",
                                  "endTime": "%s",
                                  "reason": "Co tinh dat vao gio nghi"
                                }
                                """.formatted(PATIENT_ID, DOCTOR_ID, startTime, endTime)))
                // Then: Hệ thống chặn theo QTN-30 và báo bác sĩ không làm việc
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Bác sĩ không làm việc trong khung giờ này."));
    }

    @Test
    void tc04_pharmacistWithoutAppointmentReadIsDeniedAndAudited() throws Exception {
        // Given: Người đăng nhập là Dược sĩ (chỉ có quyền PHARMACY, không có APPOINTMENT_READ)
        UUID pharmacistUserId = UUID.randomUUID();
        when(currentUserPort.getCurrentUserId()).thenReturn(pharmacistUserId);

        // When: Mở màn hình lịch tuần / gọi API lịch tuần
        mockMvc.perform(get("/appointments/doctor-weekly-table")
                        .param("date", "2099-08-10")
                        .with(withPermissions("PHARMACY_READ"))) // Quyền dược sĩ
                // Then: Hệ thống từ chối truy cập (403 Forbidden)
                .andExpect(status().isForbidden());

        // And Then: Hệ thống ghi nhật ký kiểm toán (ACCESS_DENIED / PERMISSION)
        ArgumentCaptor<AuditLog> auditCaptor = ArgumentCaptor.forClass(AuditLog.class);
        verify(auditLogRepository).save(auditCaptor.capture());
        AuditLog savedLog = auditCaptor.getValue();
        org.junit.jupiter.api.Assertions.assertEquals(ActionType.ACCESS_DENIED, savedLog.getActionType());
        org.junit.jupiter.api.Assertions.assertEquals(ResourceType.PERMISSION, savedLog.getResourceType());
        org.junit.jupiter.api.Assertions.assertEquals(pharmacistUserId, savedLog.getUserId());
    }

    @Test
    void tc05_receptionistViewsTableWithAnonymizationEnabled() throws Exception {
        // Given: Hệ thống bật chế độ ẩn danh (NCL-15-CN-003 / Finding P3-1)
        anonymizationModeState.setEnabled(true);

        DoctorWeeklyTableResult mockResult = DoctorWeeklyTableResult.builder()
                .weekStartDate(MONDAY)
                .weekEndDate(SUNDAY)
                .clinicStartTime(LocalTime.of(7, 30))
                .clinicEndTime(LocalTime.of(17, 30))
                .timeSlots(List.of(LocalTime.of(8, 0)))
                .doctors(List.of(DoctorSummaryResult.builder()
                        .id(DOCTOR_ID)
                        .fullName("BS. Nguyen Van A")
                        .username("dr_a")
                        .build()))
                .days(List.of(DoctorDayScheduleResult.builder()
                        .date(MONDAY)
                        .dayOfWeek(DayOfWeek.MONDAY)
                        .doctorSchedules(List.of(DoctorScheduleDayResult.builder()
                                .doctorId(DOCTOR_ID)
                                .doctorName("BS. Nguyen Van A")
                                .workingDay(true)
                                .workingStartTime(LocalTime.of(8, 0))
                                .workingEndTime(LocalTime.of(17, 0))
                                .slots(List.of(
                                        DoctorScheduleSlotResult.builder()
                                                .startTime(Instant.parse("2099-08-10T01:00:00Z"))
                                                .endTime(Instant.parse("2099-08-10T01:30:00Z"))
                                                .slotStartTime(LocalTime.of(8, 0))
                                                .slotEndTime(LocalTime.of(8, 30))
                                                .status(SlotAvailabilityStatus.BOOKED)
                                                .isBookable(false)
                                                .appointment(AppointmentSummaryResult.builder()
                                                        .id(UUID.randomUUID())
                                                        .appointmentCode("APT000001")
                                                        .patientId(PATIENT_ID)
                                                        .patientCode("BN000001")
                                                        .patientName("Tran Thi B")
                                                        .patientPhone("0901234567")
                                                        .status(AppointmentStatus.SCHEDULED)
                                                        .reason("Kham tong quat")
                                                        .build())
                                                .build()
                                ))
                                .build()))
                        .build()))
                .build();

        when(getDoctorWeeklyScheduleTableUseCase.getWeeklyScheduleTable(any())).thenReturn(mockResult);

        // When: Lễ tân gọi API
        mockMvc.perform(get("/appointments/doctor-weekly-table")
                        .param("date", "2099-08-10")
                        .with(withPermissions("APPOINTMENT_READ")))
                // Then: Tên và số điện thoại của bệnh nhân bị ẩn danh đúng chuẩn
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.days[0].doctorSchedules[0].slots[0].appointment.patientCode").value("BN000001"))
                .andExpect(jsonPath("$.days[0].doctorSchedules[0].slots[0].appointment.patientName").value("BỆNH NHÂN #BN000001"))
                .andExpect(jsonPath("$.days[0].doctorSchedules[0].slots[0].appointment.patientPhone").value("09******67"));
    }
}
