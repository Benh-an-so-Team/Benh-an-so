package com.benhsoan.adapter.inbound.rest.controller;

import static org.hamcrest.Matchers.hasSize;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import com.benhsoan.adapter.inbound.rest.mapper.QueueRestMapper;
import com.benhsoan.application.ucservice.anonymization.AnonymizationModeState;
import com.benhsoan.application.ucservice.queue.GetQueueDisplayService;
import com.benhsoan.domain.queue.Room;
import com.benhsoan.domain.queue.enums.QueueItemSourceType;
import com.benhsoan.domain.queue.enums.QueueItemStatus;
import com.benhsoan.domain.queue.enums.QueuePriority;
import com.benhsoan.exception.GlobalExceptionHandler;
import com.benhsoan.port.dto.result.QueueItemResult;
import com.benhsoan.port.inbound.queue.CallNextQueueItemUseCase;
import com.benhsoan.port.inbound.queue.CheckInAppointmentUseCase;
import com.benhsoan.port.inbound.queue.CheckInWalkInUseCase;
import com.benhsoan.port.inbound.queue.CloseVisitUseCase;
import com.benhsoan.port.inbound.queue.CompleteQueueItemUseCase;
import com.benhsoan.port.inbound.queue.GetMyQueueUseCase;
import com.benhsoan.port.inbound.queue.GetQueueHistoryUseCase;
import com.benhsoan.port.inbound.queue.GetQueueItemUseCase;
import com.benhsoan.port.inbound.queue.GetQueuesUseCase;
import com.benhsoan.port.inbound.queue.PrioritizeQueueItemUseCase;
import com.benhsoan.port.inbound.queue.ReQueueItemUseCase;
import com.benhsoan.port.inbound.queue.SkipQueueItemUseCase;
import com.benhsoan.port.inbound.queue.UpdateQueueItemStatusUseCase;
import com.benhsoan.port.outbound.authSecurity.JwtTokenPort;
import com.benhsoan.port.outbound.repository.auth.UserRepository;
import com.benhsoan.port.outbound.repository.auth.UserSessionRepository;
import com.benhsoan.port.outbound.repository.queue.QueueItemQueryRepository;
import com.benhsoan.port.outbound.repository.queue.RoomRepository;
import com.benhsoan.port.outbound.security.CurrentUserPort;
import com.benhsoan.port.outbound.time.ClockPort;

/**
 * End-to-end web layer integration test for User Story NCL-03-CN-014:
 * Màn hình hiển thị số thứ tự tại khu vực chờ.
 * Verifies Acceptance Criteria TC-01, TC-02, and TC-03.
 */
@WebMvcTest(controllers = QueueController.class)
@AutoConfigureMockMvc(addFilters = false)
@Import({
                GetQueueDisplayService.class,
                QueueRestMapper.class,
                AnonymizationModeState.class,
                GlobalExceptionHandler.class
})
class QueueDisplayIntegrationTest {

        private static final LocalDate QUEUE_DATE = LocalDate.of(2026, 9, 24);
        private static final Instant NOW = Instant.parse("2026-09-24T08:30:00Z");

        @Autowired
        private MockMvc mockMvc;

        @MockitoBean
        private QueueItemQueryRepository queueItemQueryRepository;
        @MockitoBean
        private RoomRepository roomRepository;
        @MockitoBean
        private ClockPort clockPort;

        // Remaining QueueController mock dependencies
        @MockitoBean
        private GetQueuesUseCase getQueuesUseCase;
        @MockitoBean
        private GetMyQueueUseCase getMyQueueUseCase;
        @MockitoBean
        private CheckInAppointmentUseCase checkInAppointmentUseCase;
        @MockitoBean
        private CheckInWalkInUseCase checkInWalkInUseCase;
        @MockitoBean
        private CallNextQueueItemUseCase callNextQueueItemUseCase;
        @MockitoBean
        private UpdateQueueItemStatusUseCase updateQueueItemStatusUseCase;
        @MockitoBean
        private CompleteQueueItemUseCase completeQueueItemUseCase;
        @MockitoBean
        private CloseVisitUseCase closeVisitUseCase;
        @MockitoBean
        private GetQueueItemUseCase getQueueItemUseCase;
        @MockitoBean
        private SkipQueueItemUseCase skipQueueItemUseCase;
        @MockitoBean
        private ReQueueItemUseCase reQueueItemUseCase;
        @MockitoBean
        private PrioritizeQueueItemUseCase prioritizeQueueItemUseCase;
        @MockitoBean
        private GetQueueHistoryUseCase getQueueHistoryUseCase;
        @MockitoBean
        private JwtTokenPort jwtTokenPort;
        @MockitoBean
        private UserRepository userRepository;
        @MockitoBean
        private UserSessionRepository userSessionRepository;
        @MockitoBean
        private CurrentUserPort currentUserPort;

        @Test
        void verifiesAcceptanceCriteriaTc01Tc02Tc03() throws Exception {
                when(clockPort.now()).thenReturn(NOW);

                UUID roomId = UUID.randomUUID();
                UUID doctorId = UUID.randomUUID();
                Room room = Room.restore(roomId, "P201", "Phòng Khám Nhi Đồng", true, NOW, NOW);
                when(roomRepository.findAllById(any())).thenReturn(List.of(room));

                // TC-01: Bác sĩ gọi bệnh nhân kế tiếp -> trạng thái IN_PROGRESS
                QueueItemResult inProgressItem = new QueueItemResult(
                                UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID(), "BN001", "Nguyễn Văn An",
                                doctorId, "BS. Phạm Minh Tuấn", roomId, "P201", null, UUID.randomUUID(), "VIS001",
                                QueueItemSourceType.WALK_IN, QueueItemStatus.IN_PROGRESS, 10, QUEUE_DATE,
                                NOW.minusSeconds(600), NOW.minusSeconds(120), null, null, null, null, null, 1,
                                QueuePriority.NORMAL, null, null, null);

                // Regular waiting item
                QueueItemResult normalWaiting = new QueueItemResult(
                                UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID(), "BN002", "Trần Quốc Toản",
                                doctorId, "BS. Phạm Minh Tuấn", roomId, "P201", null, UUID.randomUUID(), "VIS002",
                                QueueItemSourceType.WALK_IN, QueueItemStatus.WAITING, 11, QUEUE_DATE,
                                NOW.minusSeconds(500), null, null, null, null, null, null, 0,
                                QueuePriority.NORMAL, null, null, null);

                // TC-03: Ca ưu tiên cấp cứu EMERGENCY -> xếp trước
                QueueItemResult emergencyWaiting = new QueueItemResult(
                                UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID(), "BN003", "Lê Văn Cấp Cứu",
                                doctorId, "BS. Phạm Minh Tuấn", roomId, "P201", null, UUID.randomUUID(), "VIS003",
                                QueueItemSourceType.WALK_IN, QueueItemStatus.WAITING, 12, QUEUE_DATE,
                                NOW.minusSeconds(300), null, null, null, null, null, null, 0,
                                QueuePriority.EMERGENCY, "Sốt cao co giật", NOW.minusSeconds(60), UUID.randomUUID());

                when(queueItemQueryRepository.findActiveQueueBoard(QUEUE_DATE, null))
                                .thenReturn(List.of(inProgressItem, normalWaiting, emergencyWaiting));

                mockMvc.perform(get("/queues/display")
                                .param("date", "2026-09-24"))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.date").value("2026-09-24"))
                                .andExpect(jsonPath("$.rooms", hasSize(1)))
                                .andExpect(jsonPath("$.rooms[0].roomNumber").value("P201"))
                                .andExpect(jsonPath("$.rooms[0].roomName").value("Phòng Khám Nhi Đồng"))
                                .andExpect(jsonPath("$.rooms[0].doctorName").value("BS. Phạm Minh Tuấn"))

                                // TC-01: Màn hình khu vực chờ cập nhật số thứ tự đang khám theo phòng
                                .andExpect(jsonPath("$.rooms[0].currentCalling.queueNumber").value(10))
                                .andExpect(jsonPath("$.rooms[0].currentCalling.status").value("IN_PROGRESS"))

                                // TC-02: Chỉ hiện số thứ tự và tên viết tắt, không hiện họ tên đầy đủ hay số
                                // điện thoại
                                .andExpect(jsonPath("$.rooms[0].currentCalling.patientInitials").value("N. V. A"))
                                .andExpect(jsonPath("$.rooms[0].currentCalling.fullName").doesNotExist())
                                .andExpect(jsonPath("$.rooms[0].currentCalling.patientName").doesNotExist())
                                .andExpect(jsonPath("$.rooms[0].currentCalling.patientId").doesNotExist())
                                .andExpect(jsonPath("$.rooms[0].currentCalling.phone").doesNotExist())
                                .andExpect(jsonPath("$.rooms[0].currentCalling.visitCode").doesNotExist())

                                // TC-03: Ca ưu tiên xếp lên trước ngay lần cập nhật kế tiếp
                                .andExpect(jsonPath("$.rooms[0].waitingList", hasSize(2)))
                                .andExpect(jsonPath("$.rooms[0].waitingList[0].queueNumber").value(12))
                                .andExpect(jsonPath("$.rooms[0].waitingList[0].priority").value("EMERGENCY"))
                                .andExpect(jsonPath("$.rooms[0].waitingList[0].patientInitials").value("L. V. C. C"))

                                // Ca thường xếp sau ca ưu tiên
                                .andExpect(jsonPath("$.rooms[0].waitingList[1].queueNumber").value(11))
                                .andExpect(jsonPath("$.rooms[0].waitingList[1].priority").value("NORMAL"))
                                .andExpect(jsonPath("$.rooms[0].waitingList[1].patientInitials").value("T. Q. T"));
        }

        @Test
        void filtersDisplayBoardBySpecificRoomId() throws Exception {
                when(clockPort.now()).thenReturn(NOW);

                UUID roomId1 = UUID.randomUUID();
                Room room1 = Room.restore(roomId1, "P301", "Phòng Khám Tai Mũi Họng", true, NOW, NOW);
                when(roomRepository.findAllById(any())).thenReturn(List.of(room1));

                QueueItemResult room1Item = new QueueItemResult(
                                UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID(), "BN005", "Đỗ Văn Long",
                                UUID.randomUUID(), "BS. Nam", roomId1, "P301", null, UUID.randomUUID(), "VIS005",
                                QueueItemSourceType.WALK_IN, QueueItemStatus.WAITING, 5, QUEUE_DATE,
                                NOW, null, null, null, null, null, null, 0,
                                QueuePriority.NORMAL, null, null, null);

                when(queueItemQueryRepository.findActiveQueueBoard(QUEUE_DATE, roomId1))
                                .thenReturn(List.of(room1Item));

                mockMvc.perform(get("/queues/display")
                                .param("date", "2026-09-24")
                                .param("roomId", roomId1.toString()))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.rooms", hasSize(1)))
                                .andExpect(jsonPath("$.rooms[0].roomId").value(roomId1.toString()))
                                .andExpect(jsonPath("$.rooms[0].roomNumber").value("P301"))
                                .andExpect(jsonPath("$.rooms[0].waitingList[0].queueNumber").value(5));
        }
}
