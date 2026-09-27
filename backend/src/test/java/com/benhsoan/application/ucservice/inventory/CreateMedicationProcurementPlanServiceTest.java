package com.benhsoan.application.ucservice.inventory;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.benhsoan.domain.inventory.procurement.enums.ProcurementPlanStatus;
import com.benhsoan.domain.inventory.procurement.exception.ProcurementPlanEmptyItemsException;
import com.benhsoan.domain.medicine.Medicine;
import com.benhsoan.port.dto.command.inventory.CreateProcurementPlanCommand;
import com.benhsoan.port.dto.command.inventory.CreateProcurementPlanItemCommand;
import com.benhsoan.port.dto.result.ProcurementPlanResult;
import com.benhsoan.port.outbound.generator.MedicationProcurementCodeGenerator;
import com.benhsoan.port.outbound.repository.audit.AuditLogRepository;
import com.benhsoan.port.outbound.repository.inventory.MedicationProcurementPlanRepository;
import com.benhsoan.port.outbound.repository.medicine.MedicineRepository;
import com.benhsoan.port.outbound.security.CurrentUserPort;
import com.benhsoan.port.outbound.time.ClockPort;
import com.fasterxml.jackson.databind.ObjectMapper;

@ExtendWith(MockitoExtension.class)
class CreateMedicationProcurementPlanServiceTest {

        @Mock
        private MedicationProcurementPlanRepository planRepository;

        @Mock
        private MedicineRepository medicineRepository;

        @Mock
        private MedicationProcurementCodeGenerator codeGenerator;

        @Mock
        private CurrentUserPort currentUserPort;

        @Mock
        private ClockPort clockPort;

        @Mock
        private AuditLogRepository auditLogRepository;

        @Mock
        private MedicationProcurementAuthorizer authorizer;

        private CreateMedicationProcurementPlanService service;
        private UUID pharmacistId;
        private UUID medicineId;
        private Instant now;

        @BeforeEach
        void setUp() {
                pharmacistId = UUID.randomUUID();
                medicineId = UUID.randomUUID();
                now = Instant.now();

                MedicationProcurementResultMapper resultMapper = new MedicationProcurementResultMapper(
                                medicineRepository);
                service = new CreateMedicationProcurementPlanService(
                                planRepository,
                                medicineRepository,
                                codeGenerator,
                                resultMapper,
                                currentUserPort,
                                authorizer,
                                clockPort,
                                auditLogRepository,
                                new ObjectMapper());
        }

        @Test
        @DisplayName("Dược sĩ tạo phiếu dự trù và gửi duyệt ngay thành công - loại bỏ N+1 bằng findAllById (TC-02 / P3-04)")
        void createAndSubmitPlanSuccess() {
                Medicine mockMedicine = Medicine.restore(
                                medicineId,
                                "TH001",
                                "Paracetamol",
                                "Paracetamol",
                                "500mg",
                                com.benhsoan.domain.medicine.enums.DosageForm.TABLET,
                                "Viên",
                                com.benhsoan.domain.medicine.enums.AdministrationRoute.ORAL,
                                true,
                                now,
                                null,
                                20,
                                50,
                                false);

                when(currentUserPort.getCurrentUserId()).thenReturn(pharmacistId);
                when(clockPort.now()).thenReturn(now);
                when(codeGenerator.generate()).thenReturn("DT000001");
                when(medicineRepository.findAllById(any())).thenReturn(List.of(mockMedicine));
                when(planRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

                CreateProcurementPlanItemCommand itemCmd = new CreateProcurementPlanItemCommand(
                                medicineId, 20, 50, 40, 70, 80, "Ghi chú thuốc");
                CreateProcurementPlanCommand command = new CreateProcurementPlanCommand(
                                LocalDate.now().minusDays(30),
                                LocalDate.now(),
                                "Dự trù định kỳ",
                                true, // submitImmediately = true!
                                List.of(itemCmd));

                ProcurementPlanResult result = service.create(command);

                assertNotNull(result);
                assertEquals("DT000001", result.planCode());
                assertEquals(ProcurementPlanStatus.PENDING_APPROVAL, result.status());
                assertEquals(pharmacistId, result.createdBy());
                assertEquals(1, result.totalItems());
                assertEquals(80, result.totalProposedQuantity());
                assertNotNull(result.submittedAt());
                verify(authorizer).requireCreatePermission();
                verify(medicineRepository).findAllById(any());
                verify(medicineRepository, org.mockito.Mockito.never()).findById(any());
                verify(auditLogRepository).save(any());
        }

        @Test
        @DisplayName("Người dùng không có quyền CREATE bị từ chối với AccessDeniedException từ tầng Service (P2-01)")
        void unauthorizedUserCannotCreateThrowsAccessDeniedException() {
                org.mockito.Mockito
                                .doThrow(new org.springframework.security.access.AccessDeniedException("Từ chối quyền"))
                                .when(authorizer).requireCreatePermission();

                CreateProcurementPlanCommand command = new CreateProcurementPlanCommand(
                                LocalDate.now().minusDays(30),
                                LocalDate.now(),
                                "Dự trù",
                                false,
                                List.of());

                assertThrows(org.springframework.security.access.AccessDeniedException.class,
                                () -> service.create(command));
        }

        @Test
        @DisplayName("Ném lỗi khi danh sách thuốc dự trù bị trống")
        void emptyItemsThrowsException() {
                CreateProcurementPlanCommand command = new CreateProcurementPlanCommand(
                                LocalDate.now().minusDays(30),
                                LocalDate.now(),
                                "Dự trù trống",
                                false,
                                List.of());

                assertThrows(ProcurementPlanEmptyItemsException.class, () -> service.create(command));
        }
}
