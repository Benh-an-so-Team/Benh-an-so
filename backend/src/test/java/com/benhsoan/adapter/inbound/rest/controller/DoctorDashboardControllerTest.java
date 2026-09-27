package com.benhsoan.adapter.inbound.rest.controller;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;
import java.util.Collections;
import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import com.benhsoan.adapter.inbound.rest.mapper.DoctorDashboardRestMapper;
import com.benhsoan.application.ucservice.anonymization.AnonymizationModeState;
import com.benhsoan.domain.appointment.enums.AppointmentStatus;
import com.benhsoan.domain.clinical.enums.ClinicalResultAbnormalFlag;
import com.benhsoan.domain.clinical.enums.ClinicalResultStatus;
import com.benhsoan.domain.clinical.enums.ClinicalResultType;
import com.benhsoan.domain.medicalrecord.enums.MedicalRecordStatus;
import com.benhsoan.domain.queue.enums.QueueItemStatus;
import com.benhsoan.domain.queue.enums.QueuePriority;
import com.benhsoan.port.dto.result.DoctorDashboardResult;
import com.benhsoan.port.inbound.dashboard.GetDoctorDashboardUseCase;
import com.benhsoan.port.outbound.authSecurity.JwtTokenPort;
import com.benhsoan.port.outbound.repository.auth.UserRepository;
import com.benhsoan.port.outbound.repository.auth.UserSessionRepository;
import com.benhsoan.port.outbound.security.CurrentUserPort;
import com.benhsoan.port.outbound.time.ClockPort;

@WebMvcTest(controllers = DoctorDashboardController.class)
@AutoConfigureMockMvc(addFilters = false)
@Import({ DoctorDashboardRestMapper.class })
@DisplayName("DoctorDashboardController - MockMvc Tests")
class DoctorDashboardControllerTest {

        @Autowired
        private MockMvc mockMvc;

        @MockitoBean
        private GetDoctorDashboardUseCase getDoctorDashboardUseCase;

        @MockitoBean
        private AnonymizationModeState anonymizationModeState;

        @MockitoBean
        private CurrentUserPort currentUserPort;

        @MockitoBean
        private UserRepository userRepository;

        @MockitoBean
        private UserSessionRepository userSessionRepository;

        @MockitoBean
        private JwtTokenPort jwtTokenPort;

        @MockitoBean
        private ClockPort clockPort;

        @Test
        @DisplayName("GET /dashboard/doctor trả về HTTP 200 và dữ liệu JSON theo đúng contract")
        void returnsDoctorDashboard() throws Exception {
                UUID apptId = UUID.randomUUID();
                UUID patientId = UUID.randomUUID();
                UUID mrId = UUID.randomUUID();
                UUID visitId = UUID.randomUUID();
                UUID clinicalResultId = UUID.randomUUID();
                Instant now = Instant.parse("2026-09-25T08:00:00Z");

                var summary = new DoctorDashboardResult.Summary(1, 1, 0, 1, 0, 1, 0);

                var appt = new DoctorDashboardResult.AppointmentItem(
                                apptId, "APP-001", patientId, "BN-01", "Nguyễn Văn A", "0901",
                                now.plusSeconds(1800), now.plusSeconds(3600), AppointmentStatus.CONFIRMED,
                                "Khám tổng quát");

                var queue = new DoctorDashboardResult.QueueItem(
                                UUID.randomUUID(), UUID.randomUUID(), 1, patientId, "BN-01", "Nguyễn Văn A",
                                UUID.randomUUID(), "P101", visitId, "KB-01", QueueItemStatus.WAITING,
                                QueuePriority.NORMAL,
                                now.minusSeconds(600), null);

                var pendingMr = new DoctorDashboardResult.PendingMedicalRecordItem(
                                mrId, visitId, "KB-01", patientId, "BN-01", "Nguyễn Văn A",
                                MedicalRecordStatus.DRAFT, now.minusSeconds(3600), now.plusSeconds(82800), false, 0, 0);

                var clResult = new DoctorDashboardResult.ClinicalResultItem(
                                clinicalResultId, UUID.randomUUID(), "XQ-01", "X-Quang Ngực",
                                visitId, "KB-01", patientId, "BN-01", "Nguyễn Văn A",
                                ClinicalResultType.TEXT, null, "Bình thường", null, null,
                                ClinicalResultAbnormalFlag.NORMAL, "Không tổn thương", ClinicalResultStatus.FINAL,
                                now.minusSeconds(900));

                when(getDoctorDashboardUseCase.getDashboard(any()))
                                .thenReturn(new DoctorDashboardResult(
                                                summary,
                                                List.of(appt),
                                                List.of(queue),
                                                List.of(pendingMr),
                                                List.of(clResult),
                                                now));

                mockMvc.perform(get("/dashboard/doctor"))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.summary.todayAppointmentsCount").value(1))
                                .andExpect(jsonPath("$.summary.waitingQueueCount").value(1))
                                .andExpect(jsonPath("$.summary.pendingSignaturesCount").value(1))
                                .andExpect(jsonPath("$.summary.newClinicalResultsCount").value(1))
                                .andExpect(jsonPath("$.appointments[0].appointmentCode").value("APP-001"))
                                .andExpect(jsonPath("$.appointments[0].patientName").value("Nguyễn Văn A"))
                                .andExpect(jsonPath("$.queue[0].queueNumber").value(1))
                                .andExpect(jsonPath("$.pendingMedicalRecords[0].medicalRecordId")
                                                .value(mrId.toString()))
                                .andExpect(jsonPath("$.pendingMedicalRecords[0].visitCode").value("KB-01"))
                                .andExpect(jsonPath("$.newClinicalResults[0].serviceName").value("X-Quang Ngực"));
        }

        @Test
        @DisplayName("GET /dashboard/doctor?date=2026-09-25 truyền tham số date thành công")
        void returnsDoctorDashboardWithDate() throws Exception {
                Instant now = Instant.parse("2026-09-25T08:00:00Z");
                var summary = new DoctorDashboardResult.Summary(0, 0, 0, 0, 0, 0, 0);

                when(getDoctorDashboardUseCase.getDashboard(any()))
                                .thenReturn(new DoctorDashboardResult(
                                                summary,
                                                Collections.emptyList(),
                                                Collections.emptyList(),
                                                Collections.emptyList(),
                                                Collections.emptyList(),
                                                now));

                mockMvc.perform(get("/dashboard/doctor").param("date", "2026-09-25"))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.summary.todayAppointmentsCount").value(0))
                                .andExpect(jsonPath("$.appointments").isEmpty());
        }
}
