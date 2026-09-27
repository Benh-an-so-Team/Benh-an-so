package com.benhsoan.application.ucservice.dashboard;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.Collections;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.security.access.AccessDeniedException;

import com.benhsoan.domain.appointment.enums.AppointmentStatus;
import com.benhsoan.domain.clinic.ClinicConfiguration;
import com.benhsoan.domain.clinical.enums.ClinicalResultAbnormalFlag;
import com.benhsoan.domain.clinical.enums.ClinicalResultStatus;
import com.benhsoan.domain.clinical.enums.ClinicalResultType;
import com.benhsoan.domain.medicalrecord.enums.MedicalRecordStatus;
import com.benhsoan.domain.queue.enums.QueueItemSourceType;
import com.benhsoan.domain.queue.enums.QueueItemStatus;
import com.benhsoan.domain.queue.enums.QueuePriority;
import com.benhsoan.port.dto.query.dashboard.GetDoctorDashboardQuery;
import com.benhsoan.port.dto.result.DoctorDashboardResult;
import com.benhsoan.port.dto.result.QueueItemResult;
import com.benhsoan.port.outbound.repository.clinic.ClinicConfigurationRepository;
import com.benhsoan.port.outbound.repository.dashboard.DoctorDashboardQueryRepository;
import com.benhsoan.port.outbound.repository.queue.QueueItemQueryRepository;
import com.benhsoan.port.outbound.security.CurrentUserPort;
import com.benhsoan.port.outbound.time.ClockPort;

class GetDoctorDashboardServiceTest {

    private static final Instant NOW = Instant.parse("2026-09-25T08:00:00Z");
    private static final LocalDate TODAY = LocalDate.ofInstant(NOW, ZoneOffset.UTC);
    private static final Instant START_OF_DAY = TODAY.atStartOfDay(ZoneOffset.UTC).toInstant();
    private static final Instant START_OF_NEXT_DAY = TODAY.plusDays(1).atStartOfDay(ZoneOffset.UTC).toInstant();

    private static final UUID LOGGED_IN_DOCTOR_ID = UUID.fromString("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2");
    private static final UUID OTHER_DOCTOR_ID = UUID.fromString("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3");

    private final DoctorDashboardQueryRepository doctorDashboardQueryRepository = mock(DoctorDashboardQueryRepository.class);
    private final QueueItemQueryRepository queueItemQueryRepository = mock(QueueItemQueryRepository.class);
    private final ClinicConfigurationRepository clinicConfigurationRepository = mock(ClinicConfigurationRepository.class);
    private final CurrentUserPort currentUserPort = mock(CurrentUserPort.class);
    private final ClockPort clockPort = mock(ClockPort.class);

    private GetDoctorDashboardService service;

    @BeforeEach
    void setUp() {
        service = new GetDoctorDashboardService(
                doctorDashboardQueryRepository,
                queueItemQueryRepository,
                clinicConfigurationRepository,
                currentUserPort,
                clockPort
        );

        when(clockPort.now()).thenReturn(NOW);
        when(currentUserPort.getCurrentUserId()).thenReturn(LOGGED_IN_DOCTOR_ID);
        when(currentUserPort.hasRole("DOCTOR")).thenReturn(true);
        when(currentUserPort.hasRole("ADMIN")).thenReturn(false);

        ClinicConfiguration config = mock(ClinicConfiguration.class);
        when(config.getSigningDeadlineHours()).thenReturn(24);
        when(clinicConfigurationRepository.find()).thenReturn(Optional.of(config));
    }

    @Test
    @DisplayName("NCL-08-CN-010-TC-01: Luồng thành công - Màn hình hiển thị đúng lịch khám, hàng đợi và bệnh án chờ ký của chính bác sĩ")
    void returnsDoctorDashboardSuccessfullyForDoctor() {
        // Appointments
        var appt1 = new DoctorDashboardResult.AppointmentItem(
                UUID.randomUUID(), "APP-001", UUID.randomUUID(), "BN-01", "Nguyễn Văn A", "0901",
                NOW.plusSeconds(1800), NOW.plusSeconds(3600), AppointmentStatus.CONFIRMED, "Khám tổng quát"
        );
        var appt2 = new DoctorDashboardResult.AppointmentItem(
                UUID.randomUUID(), "APP-002", UUID.randomUUID(), "BN-02", "Trần Thị B", "0902",
                NOW.plusSeconds(3600), NOW.plusSeconds(5400), AppointmentStatus.SCHEDULED, "Tái khám"
        );
        when(doctorDashboardQueryRepository.findAppointments(eq(LOGGED_IN_DOCTOR_ID), eq(START_OF_DAY), eq(START_OF_NEXT_DAY)))
                .thenReturn(List.of(appt1, appt2));

        // Queue
        var queueItem1 = new QueueItemResult(
                UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID(), "BN-01", "Nguyễn Văn A",
                LOGGED_IN_DOCTOR_ID, "Dr. Minh", UUID.randomUUID(), "P101",
                appt1.appointmentId(), UUID.randomUUID(), "KB-01",
                QueueItemSourceType.APPOINTMENT, QueueItemStatus.WAITING, 1, TODAY,
                NOW.minusSeconds(600), null, null, null, null, null, null, 0,
                QueuePriority.NORMAL, null, null, null
        );
        var queueItem2 = new QueueItemResult(
                UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID(), "BN-02", "Trần Thị B",
                LOGGED_IN_DOCTOR_ID, "Dr. Minh", UUID.randomUUID(), "P101",
                appt2.appointmentId(), UUID.randomUUID(), "KB-02",
                QueueItemSourceType.APPOINTMENT, QueueItemStatus.IN_PROGRESS, 2, TODAY,
                NOW.minusSeconds(300), NOW, null, null, null, null, null, 1,
                QueuePriority.NORMAL, null, null, null
        );
        when(queueItemQueryRepository.findQueueBoard(eq(TODAY), eq(LOGGED_IN_DOCTOR_ID), any()))
                .thenReturn(List.of(queueItem1, queueItem2));

        // Pending Medical Records
        var pending1 = new DoctorDashboardResult.PendingMedicalRecordItem(
                UUID.randomUUID(), UUID.randomUUID(), "KB-01", UUID.randomUUID(), "BN-01", "Nguyễn Văn A",
                MedicalRecordStatus.DRAFT, NOW.minusSeconds(3600), NOW.plusSeconds(82800), false, 0, 0
        );
        var pending2 = new DoctorDashboardResult.PendingMedicalRecordItem(
                UUID.randomUUID(), UUID.randomUUID(), "KB-00", UUID.randomUUID(), "BN-00", "Lê Văn C",
                MedicalRecordStatus.DRAFT, NOW.minusSeconds(100000), NOW.minusSeconds(13600), true, 3, 1
        );
        when(doctorDashboardQueryRepository.findPendingMedicalRecords(eq(LOGGED_IN_DOCTOR_ID), eq(24), eq(NOW)))
                .thenReturn(List.of(pending2, pending1));

        // Clinical Results
        var clResult1 = new DoctorDashboardResult.ClinicalResultItem(
                UUID.randomUUID(), UUID.randomUUID(), "XQ-01", "X-Quang Ngực",
                UUID.randomUUID(), "KB-01", UUID.randomUUID(), "BN-01", "Nguyễn Văn A",
                ClinicalResultType.TEXT, null, "Bình thường", null, null,
                ClinicalResultAbnormalFlag.NORMAL, "Không tổn thương", ClinicalResultStatus.FINAL, NOW.minusSeconds(900)
        );
        var clResult2 = new DoctorDashboardResult.ClinicalResultItem(
                UUID.randomUUID(), UUID.randomUUID(), "XN-02", "Đường huyết",
                UUID.randomUUID(), "KB-02", UUID.randomUUID(), "BN-02", "Trần Thị B",
                ClinicalResultType.NUMBER, new BigDecimal("8.5"), null, "mmol/L", "3.9-6.4",
                ClinicalResultAbnormalFlag.ABNORMAL, "Tăng nhẹ", ClinicalResultStatus.FINAL, NOW.minusSeconds(600)
        );
        when(doctorDashboardQueryRepository.findNewClinicalResults(eq(LOGGED_IN_DOCTOR_ID), eq(START_OF_DAY)))
                .thenReturn(List.of(clResult1, clResult2));

        // Execute
        DoctorDashboardResult result = service.getDashboard(new GetDoctorDashboardQuery(TODAY, null));

        // Verify summary
        assertThat(result).isNotNull();
        assertThat(result.asOf()).isEqualTo(NOW);
        assertThat(result.summary().todayAppointmentsCount()).isEqualTo(2);
        assertThat(result.summary().waitingQueueCount()).isEqualTo(1);
        assertThat(result.summary().inProgressQueueCount()).isEqualTo(1);
        assertThat(result.summary().pendingSignaturesCount()).isEqualTo(2);
        assertThat(result.summary().overdueSignaturesCount()).isEqualTo(1);
        assertThat(result.summary().newClinicalResultsCount()).isEqualTo(2);
        assertThat(result.summary().abnormalClinicalResultsCount()).isEqualTo(1);

        // Verify detailed collections
        assertThat(result.appointments()).hasSize(2);
        assertThat(result.queue()).hasSize(2);
        assertThat(result.pendingMedicalRecords()).hasSize(2);
        assertThat(result.newClinicalResults()).hasSize(2);
    }

    @Test
    @DisplayName("NCL-08-CN-010-TC-02: Không có quyền - Bác sĩ cố tình xem dữ liệu của bác sĩ khác, hệ thống chỉ trả về dữ liệu của chính mình")
    void enforcesDoctorOwnDataWhenRequestingAnotherDoctor() {
        when(doctorDashboardQueryRepository.findAppointments(any(), any(), any()))
                .thenReturn(Collections.emptyList());
        when(queueItemQueryRepository.findQueueBoard(any(), any(), any()))
                .thenReturn(Collections.emptyList());
        when(doctorDashboardQueryRepository.findPendingMedicalRecords(any(), any(Integer.class), any()))
                .thenReturn(Collections.emptyList());
        when(doctorDashboardQueryRepository.findNewClinicalResults(any(), any()))
                .thenReturn(Collections.emptyList());

        // Bác sĩ cố tình truyền OTHER_DOCTOR_ID
        GetDoctorDashboardQuery queryWithOtherDoctor = new GetDoctorDashboardQuery(TODAY, OTHER_DOCTOR_ID);
        DoctorDashboardResult result = service.getDashboard(queryWithOtherDoctor);

        assertThat(result).isNotNull();

        // Kiểm chứng: repository LUÔN được gọi với LOGGED_IN_DOCTOR_ID, không phải OTHER_DOCTOR_ID
        verify(doctorDashboardQueryRepository).findAppointments(eq(LOGGED_IN_DOCTOR_ID), eq(START_OF_DAY), eq(START_OF_NEXT_DAY));
        verify(queueItemQueryRepository).findQueueBoard(eq(TODAY), eq(LOGGED_IN_DOCTOR_ID), any());
        verify(doctorDashboardQueryRepository).findPendingMedicalRecords(eq(LOGGED_IN_DOCTOR_ID), eq(24), eq(NOW));
        verify(doctorDashboardQueryRepository).findNewClinicalResults(eq(LOGGED_IN_DOCTOR_ID), eq(START_OF_DAY));
    }

    @Test
    @DisplayName("Admin có thể xem bảng điều khiển của bác sĩ bất kỳ khi chỉ định doctorId")
    void allowsAdminToViewAnyDoctorDashboard() {
        when(currentUserPort.hasRole("DOCTOR")).thenReturn(false);
        when(currentUserPort.hasRole("ADMIN")).thenReturn(true);

        when(doctorDashboardQueryRepository.findAppointments(any(), any(), any()))
                .thenReturn(Collections.emptyList());
        when(queueItemQueryRepository.findQueueBoard(any(), any(), any()))
                .thenReturn(Collections.emptyList());
        when(doctorDashboardQueryRepository.findPendingMedicalRecords(any(), any(Integer.class), any()))
                .thenReturn(Collections.emptyList());
        when(doctorDashboardQueryRepository.findNewClinicalResults(any(), any()))
                .thenReturn(Collections.emptyList());

        GetDoctorDashboardQuery adminQuery = new GetDoctorDashboardQuery(TODAY, OTHER_DOCTOR_ID);
        DoctorDashboardResult result = service.getDashboard(adminQuery);

        assertThat(result).isNotNull();
        verify(doctorDashboardQueryRepository).findAppointments(eq(OTHER_DOCTOR_ID), eq(START_OF_DAY), eq(START_OF_NEXT_DAY));
        verify(queueItemQueryRepository).findQueueBoard(eq(TODAY), eq(OTHER_DOCTOR_ID), any());
    }

    @Test
    @DisplayName("QTN-01: Người dùng không phải Bác sĩ cũng không phải Admin bị từ chối truy cập (AccessDeniedException)")
    void throwsAccessDeniedWhenUserIsNeitherDoctorNorAdmin() {
        when(currentUserPort.hasRole("DOCTOR")).thenReturn(false);
        when(currentUserPort.hasRole("ADMIN")).thenReturn(false);

        assertThatThrownBy(() -> service.getDashboard(new GetDoctorDashboardQuery(TODAY, null)))
                .isInstanceOf(AccessDeniedException.class)
                .hasMessageContaining("Chỉ bác sĩ hoặc quản trị viên");
    }

    @Test
    @DisplayName("Dữ liệu rỗng - Bác sĩ không có lịch, queue trống, không có bệnh án chờ ký -> trả về count = 0 an toàn không lỗi")
    void returnsZeroesAndEmptyListsWhenNoData() {
        when(doctorDashboardQueryRepository.findAppointments(any(), any(), any()))
                .thenReturn(Collections.emptyList());
        when(queueItemQueryRepository.findQueueBoard(any(), any(), any()))
                .thenReturn(Collections.emptyList());
        when(doctorDashboardQueryRepository.findPendingMedicalRecords(any(), any(Integer.class), any()))
                .thenReturn(Collections.emptyList());
        when(doctorDashboardQueryRepository.findNewClinicalResults(any(), any()))
                .thenReturn(Collections.emptyList());

        DoctorDashboardResult result = service.getDashboard(new GetDoctorDashboardQuery(null, null));

        assertThat(result).isNotNull();
        assertThat(result.summary().todayAppointmentsCount()).isZero();
        assertThat(result.summary().waitingQueueCount()).isZero();
        assertThat(result.summary().inProgressQueueCount()).isZero();
        assertThat(result.summary().pendingSignaturesCount()).isZero();
        assertThat(result.summary().overdueSignaturesCount()).isZero();
        assertThat(result.summary().newClinicalResultsCount()).isZero();
        assertThat(result.summary().abnormalClinicalResultsCount()).isZero();
        assertThat(result.appointments()).isEmpty();
        assertThat(result.queue()).isEmpty();
        assertThat(result.pendingMedicalRecords()).isEmpty();
        assertThat(result.newClinicalResults()).isEmpty();
    }

    @Test
    @DisplayName("FINDING-03: todayAppointmentsCount chỉ đếm các lịch hẹn chưa bị hủy, mảng chi tiết vẫn giữ đủ")
    void excludesCancelledAppointmentsFromSummaryCount() {
        var appt1 = new DoctorDashboardResult.AppointmentItem(
                UUID.randomUUID(), "APP-001", UUID.randomUUID(), "BN-01", "Nguyễn Văn A", "0901",
                NOW.plusSeconds(1800), NOW.plusSeconds(3600), AppointmentStatus.CONFIRMED, "Khám tổng quát"
        );
        var appt2 = new DoctorDashboardResult.AppointmentItem(
                UUID.randomUUID(), "APP-002", UUID.randomUUID(), "BN-02", "Trần Thị B", "0902",
                NOW.plusSeconds(3600), NOW.plusSeconds(5400), AppointmentStatus.CANCELLED, "Đã hủy hẹn"
        );
        var appt3 = new DoctorDashboardResult.AppointmentItem(
                UUID.randomUUID(), "APP-003", UUID.randomUUID(), "BN-03", "Lê Văn C", "0903",
                NOW.plusSeconds(5400), NOW.plusSeconds(7200), AppointmentStatus.SCHEDULED, "Khám mắt"
        );
        when(doctorDashboardQueryRepository.findAppointments(eq(LOGGED_IN_DOCTOR_ID), any(), any()))
                .thenReturn(List.of(appt1, appt2, appt3));
        when(queueItemQueryRepository.findQueueBoard(any(), any(), any())).thenReturn(Collections.emptyList());
        when(doctorDashboardQueryRepository.findPendingMedicalRecords(any(), any(Integer.class), any())).thenReturn(Collections.emptyList());
        when(doctorDashboardQueryRepository.findNewClinicalResults(any(), any())).thenReturn(Collections.emptyList());

        DoctorDashboardResult result = service.getDashboard(new GetDoctorDashboardQuery(TODAY, null));

        assertThat(result.summary().todayAppointmentsCount()).isEqualTo(2);
        assertThat(result.appointments()).hasSize(3);
    }
}
