package com.benhsoan.domain.inventory.procurement;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import com.benhsoan.domain.inventory.procurement.enums.ProcurementPlanStatus;
import com.benhsoan.domain.inventory.procurement.exception.ProcurementPlanDuplicateMedicineException;
import com.benhsoan.domain.inventory.procurement.exception.ProcurementPlanEmptyItemsException;
import com.benhsoan.domain.inventory.procurement.exception.ProcurementPlanInvalidStatusException;
import com.benhsoan.domain.shared.exception.ValidationException;

class MedicationProcurementPlanTest {

        private UUID planId;
        private UUID creatorId;
        private UUID medicineId1;
        private UUID medicineId2;
        private Instant now;

        @BeforeEach
        void setUp() {
                planId = UUID.randomUUID();
                creatorId = UUID.randomUUID();
                medicineId1 = UUID.randomUUID();
                medicineId2 = UUID.randomUUID();
                now = Instant.now();
        }

        private MedicationProcurementItem createSampleItem(UUID medId, int currentStock, int minStock, int consumption,
                        int suggested, int proposed) {
                return MedicationProcurementItem.create(
                                UUID.randomUUID(),
                                planId,
                                medId,
                                currentStock,
                                minStock,
                                consumption,
                                suggested,
                                proposed,
                                "Ghi chú",
                                now);
        }

        @Test
        @DisplayName("Tạo phiếu dự trù ở trạng thái DRAFT thành công")
        void createDraftSuccess() {
                MedicationProcurementItem item = createSampleItem(medicineId1, 20, 50, 40, 70, 70);
                MedicationProcurementPlan plan = MedicationProcurementPlan.createDraft(
                                planId,
                                "DT000001",
                                creatorId,
                                LocalDate.now().minusDays(30),
                                LocalDate.now(),
                                "Dự trù tháng 9",
                                List.of(item),
                                now);

                assertNotNull(plan);
                assertEquals(ProcurementPlanStatus.DRAFT, plan.getStatus());
                assertEquals("DT000001", plan.getPlanCode());
                assertEquals(1, plan.getTotalItems());
                assertEquals(70, plan.getTotalSuggestedQuantity());
                assertEquals(70, plan.getTotalProposedQuantity());
                assertEquals(0, plan.getTotalApprovedQuantity());
        }

        @Test
        @DisplayName("Tạo phiếu dự trù và gửi duyệt ngay (PENDING_APPROVAL) thành công")
        void createAndSubmitSuccess() {
                MedicationProcurementItem item1 = createSampleItem(medicineId1, 20, 50, 40, 70, 70);
                MedicationProcurementItem item2 = createSampleItem(medicineId2, 10, 30, 25, 45, 50);
                MedicationProcurementPlan plan = MedicationProcurementPlan.createAndSubmit(
                                planId,
                                "DT000002",
                                creatorId,
                                LocalDate.now().minusDays(30),
                                LocalDate.now(),
                                "Dự trù gấp",
                                List.of(item1, item2),
                                now);

                assertEquals(ProcurementPlanStatus.PENDING_APPROVAL, plan.getStatus());
                assertEquals(2, plan.getTotalItems());
                assertEquals(115, plan.getTotalSuggestedQuantity());
                assertEquals(120, plan.getTotalProposedQuantity());
                assertNotNull(plan.getSubmittedAt());
        }

        @Test
        @DisplayName("Gửi duyệt phiếu từ trạng thái DRAFT")
        void submitFromDraftSuccess() {
                MedicationProcurementItem item = createSampleItem(medicineId1, 20, 50, 40, 70, 70);
                MedicationProcurementPlan plan = MedicationProcurementPlan.createDraft(
                                planId,
                                "DT000003",
                                creatorId,
                                LocalDate.now().minusDays(30),
                                LocalDate.now(),
                                "Dự trù",
                                List.of(item),
                                now);

                Instant submitTime = now.plusSeconds(60);
                plan.submit(submitTime);

                assertEquals(ProcurementPlanStatus.PENDING_APPROVAL, plan.getStatus());
                assertEquals(submitTime, plan.getSubmittedAt());
        }

        @Test
        @DisplayName("Phê duyệt phiếu dự trù thành công và cập nhật số lượng được duyệt")
        void approvePlanSuccess() {
                MedicationProcurementItem item1 = createSampleItem(medicineId1, 20, 50, 40, 70, 70);
                MedicationProcurementItem item2 = createSampleItem(medicineId2, 10, 30, 25, 45, 50);
                MedicationProcurementPlan plan = MedicationProcurementPlan.createAndSubmit(
                                planId,
                                "DT000004",
                                creatorId,
                                LocalDate.now().minusDays(30),
                                LocalDate.now(),
                                "Dự trù",
                                List.of(item1, item2),
                                now);

                UUID approverId = UUID.randomUUID();
                Instant approveTime = now.plusSeconds(120);

                // Duyệt với điều chỉnh: thuốc 1 giữ nguyên 70, thuốc 2 giảm xuống 40
                plan.approve(approverId, approveTime, Map.of(medicineId1, 70, medicineId2, 40));

                assertEquals(ProcurementPlanStatus.APPROVED, plan.getStatus());
                assertEquals(approverId, plan.getApprovedBy());
                assertEquals(approveTime, plan.getApprovedAt());
                assertEquals(110, plan.getTotalApprovedQuantity());
                assertEquals(70, plan.getItems().get(0).getApprovedQuantity());
                assertEquals(40, plan.getItems().get(1).getApprovedQuantity());
        }

        @Test
        @DisplayName("Từ chối phiếu dự trù thành công kèm lý do")
        void rejectPlanSuccess() {
                MedicationProcurementItem item = createSampleItem(medicineId1, 20, 50, 40, 70, 70);
                MedicationProcurementPlan plan = MedicationProcurementPlan.createAndSubmit(
                                planId,
                                "DT000005",
                                creatorId,
                                LocalDate.now().minusDays(30),
                                LocalDate.now(),
                                "Dự trù",
                                List.of(item),
                                now);

                UUID approverId = UUID.randomUUID();
                Instant rejectTime = now.plusSeconds(120);
                String reason = "Ngân sách tháng này đã vượt hạn mức quy định.";

                plan.reject(approverId, reason, rejectTime);

                assertEquals(ProcurementPlanStatus.REJECTED, plan.getStatus());
                assertEquals(approverId, plan.getApprovedBy());
                assertEquals(rejectTime, plan.getApprovedAt());
                assertEquals(reason, plan.getRejectionReason());
                assertEquals(0, plan.getTotalApprovedQuantity());
        }

        @Test
        @DisplayName("Hủy phiếu dự trù đang chờ duyệt")
        void cancelPlanSuccess() {
                MedicationProcurementItem item = createSampleItem(medicineId1, 20, 50, 40, 70, 70);
                MedicationProcurementPlan plan = MedicationProcurementPlan.createAndSubmit(
                                planId,
                                "DT000006",
                                creatorId,
                                LocalDate.now().minusDays(30),
                                LocalDate.now(),
                                "Dự trù",
                                List.of(item),
                                now);

                plan.cancel(creatorId, now.plusSeconds(30));
                assertEquals(ProcurementPlanStatus.CANCELLED, plan.getStatus());
        }

        @Test
        @DisplayName("Ném ngoại lệ khi tạo phiếu có danh sách thuốc trống")
        void emptyItemsThrowsException() {
                assertThrows(ProcurementPlanEmptyItemsException.class, () -> MedicationProcurementPlan.createDraft(
                                planId,
                                "DT000007",
                                creatorId,
                                LocalDate.now().minusDays(30),
                                LocalDate.now(),
                                "Trống",
                                List.of(),
                                now));
        }

        @Test
        @DisplayName("Ném ngoại lệ khi có thuốc trùng lặp trong cùng một phiếu")
        void duplicateMedicineThrowsException() {
                MedicationProcurementItem item1 = createSampleItem(medicineId1, 10, 20, 10, 20, 20);
                MedicationProcurementItem item2 = createSampleItem(medicineId1, 10, 20, 10, 20, 30);

                assertThrows(ProcurementPlanDuplicateMedicineException.class,
                                () -> MedicationProcurementPlan.createDraft(
                                                planId,
                                                "DT000008",
                                                creatorId,
                                                LocalDate.now().minusDays(30),
                                                LocalDate.now(),
                                                "Trùng thuốc",
                                                List.of(item1, item2),
                                                now));
        }

        @Test
        @DisplayName("Ném ngoại lệ khi cố tình phê duyệt phiếu đã kết thúc (APPROVED)")
        void cannotApproveAlreadyApprovedPlan() {
                MedicationProcurementItem item = createSampleItem(medicineId1, 20, 50, 40, 70, 70);
                MedicationProcurementPlan plan = MedicationProcurementPlan.createAndSubmit(
                                planId,
                                "DT000009",
                                creatorId,
                                LocalDate.now().minusDays(30),
                                LocalDate.now(),
                                "Dự trù",
                                List.of(item),
                                now);

                UUID approverId = UUID.randomUUID();
                plan.approve(approverId, now, null);

                assertThrows(ProcurementPlanInvalidStatusException.class,
                                () -> plan.approve(approverId, now.plusSeconds(10), null));
        }

        @Test
        @DisplayName("Ném ngoại lệ khi từ chối phiếu với lý do quá ngắn")
        void rejectReasonTooShortThrowsValidationException() {
                MedicationProcurementItem item = createSampleItem(medicineId1, 20, 50, 40, 70, 70);
                MedicationProcurementPlan plan = MedicationProcurementPlan.createAndSubmit(
                                planId,
                                "DT000010",
                                creatorId,
                                LocalDate.now().minusDays(30),
                                LocalDate.now(),
                                "Dự trù",
                                List.of(item),
                                now);

                UUID approverId = UUID.randomUUID();
                assertThrows(ValidationException.class, () -> plan.reject(approverId, "ko", now));
        }
}
