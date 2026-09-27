package com.benhsoan.adapter.inbound.rest.controller;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.EnableAspectJAutoProxy;
import org.springframework.data.domain.Page;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import com.benhsoan.adapter.inbound.rest.mapper.PrescriptionRestMapper;
import com.benhsoan.application.ucservice.anonymization.AnonymizationModeState;
import com.benhsoan.config.SecurityConfig;
import com.benhsoan.infrastructure.authSecurity.JwtAuthenticationFilter;
import com.benhsoan.exception.GlobalExceptionHandler;
import com.benhsoan.infrastructure.security.annotation.RequirePermissionAspect;
import com.benhsoan.infrastructure.security.service.PermissionEvaluator;
import com.benhsoan.port.inbound.prescription.AmendPrescriptionUseCase;
import com.benhsoan.port.inbound.prescription.CancelPrescriptionUseCase;
import com.benhsoan.port.inbound.prescription.CheckDrugInteractionUseCase;
import com.benhsoan.port.inbound.prescription.CheckPatientDrugAllergyUseCase;
import com.benhsoan.port.inbound.prescription.CheckContraindicationUseCase;
import com.benhsoan.port.inbound.prescription.CheckMaxDailyDoseUseCase;
import com.benhsoan.port.inbound.prescription.CreatePrescriptionUseCase;
import com.benhsoan.port.inbound.prescription.DispensePrescriptionUseCase;
import com.benhsoan.port.inbound.prescription.DispensePrescriptionItemsUseCase;
import com.benhsoan.port.inbound.prescription.GetPrescriptionDispenseHistoryUseCase;
import com.benhsoan.port.inbound.prescription.GetDispenseSuggestionUseCase;
import com.benhsoan.port.inbound.prescription.ExportPrescriptionUseCase;
import com.benhsoan.port.inbound.prescription.GetPrescriptionUseCase;
import com.benhsoan.port.inbound.prescription.GetPrescriptionsByMedicalRecordUseCase;
import com.benhsoan.port.inbound.prescription.GetPrescriptionAllergyWarningLogsUseCase;
import com.benhsoan.port.inbound.prescription.SearchPrescriptionsUseCase;
import com.benhsoan.port.inbound.prescription.SendPrescriptionInterconnectionUseCase;
import com.benhsoan.port.inbound.prescription.RetryPrescriptionInterconnectionUseCase;
import com.benhsoan.port.inbound.prescription.ReturnMedicationUseCase;
import com.benhsoan.port.dto.result.PrescriptionInterconnectionResult;
import com.benhsoan.port.dto.command.prescription.CancelPrescriptionCommand;
import com.benhsoan.port.dto.result.PrescriptionResult;
import com.benhsoan.port.dto.result.ContraindicationCheckResult;
import com.benhsoan.port.dto.result.DispenseSuggestionResult;
import com.benhsoan.port.dto.result.ReturnMedicationResult;
import com.benhsoan.domain.prescription.enums.PrescriptionStatus;
import com.benhsoan.domain.prescription.enums.InterconnectionStatus;
import com.benhsoan.port.outbound.authSecurity.JwtTokenPort;
import com.benhsoan.port.outbound.repository.auth.UserRepository;
import com.benhsoan.port.outbound.repository.auth.UserSessionRepository;
import com.benhsoan.port.outbound.repository.auth.RoleRepository;
import com.benhsoan.port.outbound.repository.audit.AuditLogRepository;
import com.benhsoan.port.outbound.security.CurrentUserPort;
import com.benhsoan.port.outbound.time.ClockPort;

@WebMvcTest(controllers = {PrescriptionController.class, PrescriptionInterconnectionController.class})
@Import({AnonymizationModeState.class, PrescriptionRestMapper.class, SecurityConfig.class, JwtAuthenticationFilter.class, GlobalExceptionHandler.class,
        RequirePermissionAspect.class, PermissionEvaluator.class, PrescriptionSecurityIntegrationTest.AspectTestConfig.class})
class PrescriptionSecurityIntegrationTest {

    @TestConfiguration
    @EnableAspectJAutoProxy(proxyTargetClass = true)
    static class AspectTestConfig {
    }

    @Autowired private MockMvc mockMvc;

    @MockitoBean private CreatePrescriptionUseCase createPrescriptionUseCase;
    @MockitoBean private AmendPrescriptionUseCase amendPrescriptionUseCase;
    @MockitoBean private GetPrescriptionUseCase getPrescriptionUseCase;
    @MockitoBean private com.benhsoan.port.inbound.prescription.GetPrescriptionByCodeUseCase getPrescriptionByCodeUseCase;
    @MockitoBean private GetPrescriptionsByMedicalRecordUseCase getPrescriptionsByMedicalRecordUseCase;
    @MockitoBean private SearchPrescriptionsUseCase searchPrescriptionsUseCase;
    @MockitoBean private DispensePrescriptionUseCase dispensePrescriptionUseCase;
    @MockitoBean private DispensePrescriptionItemsUseCase dispensePrescriptionItemsUseCase;
    @MockitoBean private GetPrescriptionDispenseHistoryUseCase getPrescriptionDispenseHistoryUseCase;
    @MockitoBean private GetDispenseSuggestionUseCase getDispenseSuggestionUseCase;
    @MockitoBean private CancelPrescriptionUseCase cancelPrescriptionUseCase;
    @MockitoBean private CheckDrugInteractionUseCase checkDrugInteractionUseCase;
    @MockitoBean private CheckPatientDrugAllergyUseCase checkPatientDrugAllergyUseCase;
    @MockitoBean private CheckContraindicationUseCase checkContraindicationUseCase;
    @MockitoBean private CheckMaxDailyDoseUseCase checkMaxDailyDoseUseCase;
    @MockitoBean private GetPrescriptionAllergyWarningLogsUseCase getPrescriptionAllergyWarningLogsUseCase;
    @MockitoBean private ExportPrescriptionUseCase exportPrescriptionUseCase;
    @MockitoBean private SendPrescriptionInterconnectionUseCase sendPrescriptionInterconnectionUseCase;
    @MockitoBean private RetryPrescriptionInterconnectionUseCase retryPrescriptionInterconnectionUseCase;
    @MockitoBean private ReturnMedicationUseCase returnMedicationUseCase;
    @MockitoBean private com.benhsoan.port.inbound.prescription.SearchPrescriptionInterconnectionsUseCase searchPrescriptionInterconnectionsUseCase;
    @MockitoBean private JwtTokenPort jwtTokenPort;
    @MockitoBean private UserRepository userRepository;
    @MockitoBean private UserSessionRepository userSessionRepository;
    @MockitoBean private ClockPort clockPort;
    @MockitoBean private RoleRepository roleRepository;
    @MockitoBean private AuditLogRepository auditLogRepository;
    @MockitoBean private CurrentUserPort currentUserPort;

    @Test
    void onlyAllowsPharmacistsAndAdminsToReadDispensingQueue() throws Exception {
        when(searchPrescriptionsUseCase.search(any())).thenReturn(Page.empty());

        for (String role : new String[] {"ADMIN", "PHARMACIST"}) {
            mockMvc.perform(get("/prescriptions")
                            .param("status", "PENDING_DISPENSE")
                            .with(user(role.toLowerCase()).authorities(new org.springframework.security.core.authority.SimpleGrantedAuthority("PERMISSION_PRESCRIPTION_READ"))))
                    .andExpect(status().isOk());
        }

        mockMvc.perform(get("/prescriptions")
                        .param("status", "PENDING_DISPENSE")
                        .with(user("doctor").authorities(new org.springframework.security.core.authority.SimpleGrantedAuthority("PERMISSION_PRESCRIPTION_UPDATE"))))
                .andExpect(status().isForbidden());
    }

    @Test
    void allowsAdminsAndDoctorsToCheckInteractions() throws Exception {
        when(checkDrugInteractionUseCase.check(any())).thenReturn(java.util.List.of());

        String body = """
                {
                  "drugIds": [
                    "16000000-0000-0000-0000-000000000001",
                    "16000000-0000-0000-0000-000000000002"
                  ]
                }
                """;

        for (String role : new String[] {"ADMIN", "DOCTOR"}) {
            mockMvc.perform(post("/prescriptions/check-interactions")
                            .with(user(role.toLowerCase()).authorities(new org.springframework.security.core.authority.SimpleGrantedAuthority("PERMISSION_PRESCRIPTION_CREATE")))
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(body))
                    .andExpect(status().isOk());
        }

        mockMvc.perform(post("/prescriptions/check-interactions")
                        .with(user("pharmacist").authorities(new org.springframework.security.core.authority.SimpleGrantedAuthority("PERMISSION_PRESCRIPTION_READ")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isForbidden());
    }

    @Test
    void allowsDoctorsAndPharmacistsButRejectsReceptionistsToPrint() throws Exception {
        java.util.UUID prescriptionId = java.util.UUID.randomUUID();
        when(exportPrescriptionUseCase.export(prescriptionId))
                .thenReturn(new com.benhsoan.port.dto.result.PrescriptionPrintResult(
                        "prescription-RX-001.pdf", "application/pdf", "%PDF".getBytes()));

        for (String userRole : new String[] {"DOCTOR", "PHARMACIST"}) {
            mockMvc.perform(get("/prescriptions/{id}/print", prescriptionId)
                            .with(user(userRole.toLowerCase())
                                    .authorities(
                                            new org.springframework.security.core.authority.SimpleGrantedAuthority(
                                                    "ROLE_" + userRole),
                                            new org.springframework.security.core.authority.SimpleGrantedAuthority(
                                                    "PERMISSION_PRESCRIPTION_PRINT"))))
                    .andExpect(status().isOk());
        }

        mockMvc.perform(get("/prescriptions/{id}/print", prescriptionId)
                        .with(user("receptionist").authorities(
                                new org.springframework.security.core.authority.SimpleGrantedAuthority(
                                        "ROLE_RECEPTIONIST"),
                                new org.springframework.security.core.authority.SimpleGrantedAuthority(
                                        "PERMISSION_PRESCRIPTION_READ"))))
                .andExpect(status().isForbidden());
    }

    @Test
    void returnsInternalServerErrorWhenPdfRenderingFails() throws Exception {
        java.util.UUID prescriptionId = java.util.UUID.randomUUID();
        when(exportPrescriptionUseCase.export(prescriptionId)).thenThrow(
                new com.benhsoan.infrastructure.pdf.PdfRenderingException(
                        "Unable to generate prescription PDF.", new java.io.IOException("Render failure")
                )
        );

        mockMvc.perform(get("/prescriptions/{id}/print", prescriptionId)
                        .with(user("doctor").authorities(new org.springframework.security.core.authority.SimpleGrantedAuthority(
                                "ROLE_DOCTOR"), new org.springframework.security.core.authority.SimpleGrantedAuthority(
                                "PERMISSION_PRESCRIPTION_PRINT"))))
                .andExpect(status().isInternalServerError());
    }

    @Test
    void returnsConflictWithVietnameseMessageWhenPrescriptionIsNotComplete() throws Exception {
        java.util.UUID prescriptionId = java.util.UUID.randomUUID();
        when(exportPrescriptionUseCase.export(prescriptionId)).thenThrow(
                new com.benhsoan.domain.prescription.exception.PrescriptionNotPrintableException("Đơn chưa hoàn tất")
        );

        mockMvc.perform(get("/prescriptions/{id}/print", prescriptionId)
                        .with(user("doctor").authorities(
                                new org.springframework.security.core.authority.SimpleGrantedAuthority("ROLE_DOCTOR"),
                                new org.springframework.security.core.authority.SimpleGrantedAuthority(
                                        "PERMISSION_PRESCRIPTION_PRINT"))))
                .andExpect(status().isConflict())
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath("$.message")
                        .value("Đơn chưa hoàn tất"));
    }

    @Test
    void requiresDedicatedInterconnectionPermissions() throws Exception {
        java.util.UUID prescriptionId = java.util.UUID.randomUUID();
        var result = new PrescriptionInterconnectionResult(
                prescriptionId, "RX000001", InterconnectionStatus.SUCCESS,
                "LT-20260821-000001", null, java.time.Instant.parse("2026-08-21T03:00:00Z"));
        when(sendPrescriptionInterconnectionUseCase.send(prescriptionId)).thenReturn(result);
        when(retryPrescriptionInterconnectionUseCase.retry(prescriptionId)).thenReturn(result);

        mockMvc.perform(post("/prescriptions/{id}/interconnection", prescriptionId)
                        .with(user("doctor").authorities(new org.springframework.security.core.authority.SimpleGrantedAuthority(
                                "PERMISSION_PRESCRIPTION_INTERCONNECTION_SEND"))))
                .andExpect(status().isOk());
        mockMvc.perform(post("/prescriptions/{id}/interconnection", prescriptionId)
                        .with(user("doctor").authorities(new org.springframework.security.core.authority.SimpleGrantedAuthority(
                                "PERMISSION_PRESCRIPTION_UPDATE"))))
                .andExpect(status().isForbidden());
        mockMvc.perform(post("/prescriptions/{id}/interconnection/retry", prescriptionId)
                        .with(user("admin").authorities(new org.springframework.security.core.authority.SimpleGrantedAuthority(
                                "PERMISSION_PRESCRIPTION_INTERCONNECTION_RETRY"))))
                .andExpect(status().isOk());
        mockMvc.perform(post("/prescriptions/{id}/interconnection/retry", prescriptionId)
                        .with(user("pharmacist").authorities(new org.springframework.security.core.authority.SimpleGrantedAuthority(
                                "PERMISSION_PRESCRIPTION_READ"))))
                .andExpect(status().isForbidden());
    }

    @Test
    void pharmacistIsForbiddenFromInterconnectionSearchAndRetry() throws Exception {
        java.util.UUID prescriptionId = java.util.UUID.randomUUID();
        var pharmacist = user("pharmacist").authorities(
                new org.springframework.security.core.authority.SimpleGrantedAuthority("PERMISSION_PRESCRIPTION_READ"));

        mockMvc.perform(get("/prescription-interconnections").param("status", "FAILED").with(pharmacist))
                .andExpect(status().isForbidden());
        mockMvc.perform(post("/prescriptions/{id}/interconnection/retry", prescriptionId).with(pharmacist))
                .andExpect(status().isForbidden());
    }

    @Test
    void returnsConflictWhenSuccessfullyInterconnectedPrescriptionIsSentAgain() throws Exception {
        java.util.UUID prescriptionId = java.util.UUID.randomUUID();
        when(sendPrescriptionInterconnectionUseCase.send(prescriptionId)).thenThrow(
                new com.benhsoan.domain.prescription.exception.PrescriptionInvalidStatusException(
                        "Successfully interconnected prescriptions cannot be submitted again."));

        mockMvc.perform(post("/prescriptions/{id}/interconnection", prescriptionId)
                        .with(user("doctor").authorities(new org.springframework.security.core.authority.SimpleGrantedAuthority(
                                "PERMISSION_PRESCRIPTION_INTERCONNECTION_SEND"))))
                .andExpect(status().isConflict());
    }

    @Test
    void allowsDoctorsWithPrescriptionPermissionToCheckAllergyWarnings() throws Exception {
        when(checkPatientDrugAllergyUseCase.check(any(), any())).thenReturn(java.util.List.of());

        String body = """
                {
                  "medicalRecordId": "16000000-0000-0000-0000-000000000001",
                  "medicineIds": [
                    "16000000-0000-0000-0000-000000000002"
                  ]
                }
                """;

        mockMvc.perform(post("/prescriptions/check-allergy-warnings")
                        .with(user("doctor").authorities(new org.springframework.security.core.authority.SimpleGrantedAuthority("PERMISSION_PRESCRIPTION_CREATE")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk());

        mockMvc.perform(post("/prescriptions/check-allergy-warnings")
                        .with(user("doctor_updater").authorities(new org.springframework.security.core.authority.SimpleGrantedAuthority("PERMISSION_PRESCRIPTION_UPDATE")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk());

        mockMvc.perform(post("/prescriptions/check-allergy-warnings")
                        .with(user("pharmacist").authorities(new org.springframework.security.core.authority.SimpleGrantedAuthority("PERMISSION_PRESCRIPTION_READ")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isForbidden());
    }

    @Test
    void onlyAllowsUsersWithAllergyWarningViewPermissionToAccessLogs() throws Exception {
        when(getPrescriptionAllergyWarningLogsUseCase.search(any())).thenReturn(Page.empty());

        mockMvc.perform(get("/prescriptions/allergy-warning-logs")
                        .with(user("admin").authorities(new org.springframework.security.core.authority.SimpleGrantedAuthority("PERMISSION_PRESCRIPTION_ALLERGY_WARNING_VIEW"))))
                .andExpect(status().isOk());

        mockMvc.perform(get("/prescriptions/allergy-warning-logs")
                        .with(user("doctor").authorities(new org.springframework.security.core.authority.SimpleGrantedAuthority("PERMISSION_PRESCRIPTION_CREATE"))))
                .andExpect(status().isForbidden());

        mockMvc.perform(get("/prescriptions/allergy-warning-logs")
                        .with(user("pharmacist").authorities(new org.springframework.security.core.authority.SimpleGrantedAuthority("PERMISSION_PRESCRIPTION_READ"))))
                .andExpect(status().isForbidden());
    }

    @Test
    @org.junit.jupiter.api.DisplayName("FINDING-01: Chặn IDOR - Bác sĩ khác hoặc Admin không phụ trách ca khám bị 403 Forbidden")
    void rejectsCheckAllergyWarnings_WhenCallerDoesNotOwnMedicalRecord_Returns403() throws Exception {
        when(checkPatientDrugAllergyUseCase.check(any(), any()))
                .thenThrow(new org.springframework.security.access.AccessDeniedException(
                        "Only the doctor responsible for the visit can change prescriptions."));

        String body = """
                {
                  "medicalRecordId": "16000000-0000-0000-0000-000000000001",
                  "medicineIds": [
                    "16000000-0000-0000-0000-000000000002"
                  ]
                }
                """;

        // Bác sĩ khác không phụ trách ca khám
        mockMvc.perform(post("/prescriptions/check-allergy-warnings")
                        .with(user("doctor_other").authorities(
                                new org.springframework.security.core.authority.SimpleGrantedAuthority("PERMISSION_PRESCRIPTION_CREATE")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isForbidden());

        // Admin không phụ trách ca khám cũng bị chặn ở domain layer
        mockMvc.perform(post("/prescriptions/check-allergy-warnings")
                        .with(user("admin").authorities(
                                new org.springframework.security.core.authority.SimpleGrantedAuthority("PERMISSION_PRESCRIPTION_CREATE")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("POST /prescriptions/{id}/cancel requires PRESCRIPTION_UPDATE permission (QTN-27, TC-04)")
    void cancelPrescriptionRequiresPrescriptionUpdatePermission() throws Exception {
        UUID prescriptionId = UUID.randomUUID();
        when(cancelPrescriptionUseCase.cancel(any(CancelPrescriptionCommand.class)))
                .thenReturn(new PrescriptionResult(
                        prescriptionId, "RX000001", UUID.randomUUID(), UUID.randomUUID(), "VISIT-001",
                        UUID.randomUUID(), "PAT-001", "Nguyen Van A", PrescriptionStatus.CANCELLED,
                        "Note", "Patient cancelled", UUID.randomUUID(), "Dr. A", Instant.now(), null, null,
                        List.of(), List.of()
                ));

        String body = """
                {
                  "cancelReason": "Bệnh nhân đổi phương án điều trị"
                }
                """;

        // User having PRESCRIPTION_UPDATE is allowed
        mockMvc.perform(post("/prescriptions/{id}/cancel", prescriptionId)
                        .with(user("doctor").authorities(
                                new org.springframework.security.core.authority.SimpleGrantedAuthority("PERMISSION_PRESCRIPTION_UPDATE")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk());

        // Pharmacist/User having only PRESCRIPTION_READ is rejected with 403 Forbidden (TC-04)
        mockMvc.perform(post("/prescriptions/{id}/cancel", prescriptionId)
                        .with(user("pharmacist").authorities(
                                new org.springframework.security.core.authority.SimpleGrantedAuthority("PERMISSION_PRESCRIPTION_READ")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("GET /prescriptions/{id}/dispense-history requires PRESCRIPTION_DISPENSE_HISTORY_READ (NCL-06-CN-008, TC-05)")
    void dispenseHistoryRequiresDispenseHistoryReadPermission() throws Exception {
        UUID prescriptionId = UUID.randomUUID();
        when(getPrescriptionDispenseHistoryUseCase.getHistory(prescriptionId))
                .thenReturn(java.util.List.of());

        // MANAGER with the dedicated permission is allowed (TC-05)
        mockMvc.perform(get("/prescriptions/{id}/dispense-history", prescriptionId)
                        .with(user("manager").authorities(
                                new org.springframework.security.core.authority.SimpleGrantedAuthority("PERMISSION_PRESCRIPTION_DISPENSE_HISTORY_READ"))))
                .andExpect(status().isOk());

        // PHARMACIST with the dedicated permission is allowed
        mockMvc.perform(get("/prescriptions/{id}/dispense-history", prescriptionId)
                        .with(user("pharmacist").authorities(
                                new org.springframework.security.core.authority.SimpleGrantedAuthority("PERMISSION_PRESCRIPTION_DISPENSE_HISTORY_READ"))))
                .andExpect(status().isOk());

        // RECEPTIONIST (no dispense-history permission) is rejected
        mockMvc.perform(get("/prescriptions/{id}/dispense-history", prescriptionId)
                        .with(user("receptionist").authorities(
                                new org.springframework.security.core.authority.SimpleGrantedAuthority("PERMISSION_PRESCRIPTION_READ"))))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("POST /prescriptions/{id}/return requires PRESCRIPTION_UPDATE_STATUS (NCL-06-CN-009)")
    void returnMedicationRequiresUpdateStatusPermission() throws Exception {
        UUID prescriptionId = UUID.randomUUID();
        when(returnMedicationUseCase.returnMedication(any())).thenReturn(new ReturnMedicationResult(
                prescriptionId, PrescriptionStatus.PARTIALLY_DISPENSED, UUID.randomUUID(),
                Instant.now(), List.of()));

        String body = """
                {"reason":"Bệnh nhân không dùng thuốc","items":[{"dispenseItemId":"%s","quantity":5}]}
                """.formatted(UUID.randomUUID());

        mockMvc.perform(post("/prescriptions/{id}/return", prescriptionId)
                        .with(user("pharmacist").authorities(
                                new org.springframework.security.core.authority.SimpleGrantedAuthority("PERMISSION_PRESCRIPTION_UPDATE_STATUS")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk());

        mockMvc.perform(post("/prescriptions/{id}/return", prescriptionId)
                        .with(user("receptionist").authorities(
                                new org.springframework.security.core.authority.SimpleGrantedAuthority("PERMISSION_PRESCRIPTION_READ")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("GET /prescriptions/{id}/dispense-suggestion requires PRESCRIPTION_UPDATE_STATUS (NCL-06-CN-011)")
    void dispenseSuggestionRequiresUpdateStatusPermission() throws Exception {
        UUID prescriptionId = UUID.randomUUID();
        when(getDispenseSuggestionUseCase.getSuggestion(prescriptionId)).thenReturn(
                new DispenseSuggestionResult(prescriptionId, List.of()));

        mockMvc.perform(get("/prescriptions/{id}/dispense-suggestion", prescriptionId)
                        .with(user("pharmacist").authorities(
                                new org.springframework.security.core.authority.SimpleGrantedAuthority("PERMISSION_PRESCRIPTION_UPDATE_STATUS"))))
                .andExpect(status().isOk());

        mockMvc.perform(get("/prescriptions/{id}/dispense-suggestion", prescriptionId)
                        .with(user("receptionist").authorities(
                                new org.springframework.security.core.authority.SimpleGrantedAuthority("PERMISSION_PRESCRIPTION_READ"))))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("POST /prescriptions/check-contraindications requires PRESCRIPTION_CREATE or PRESCRIPTION_UPDATE (NCL-05-CN-006)")
    void checkContraindicationsRequiresCreateOrUpdatePermission() throws Exception {
        when(checkContraindicationUseCase.check(any(), any())).thenReturn(
                new ContraindicationCheckResult(List.of(), List.of()));

        String body = """
                {"medicalRecordId":"%s","medicineIds":["%s"]}
                """.formatted(UUID.randomUUID(), UUID.randomUUID());

        mockMvc.perform(post("/prescriptions/check-contraindications")
                        .with(user("doctor").authorities(
                                new org.springframework.security.core.authority.SimpleGrantedAuthority("PERMISSION_PRESCRIPTION_CREATE")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk());

        mockMvc.perform(post("/prescriptions/check-contraindications")
                        .with(user("pharmacist").authorities(
                                new org.springframework.security.core.authority.SimpleGrantedAuthority("PERMISSION_PRESCRIPTION_UPDATE_STATUS")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isForbidden());
    }

    @Test
    void allowsPharmacistsAndAdminsToReadPrescriptionByCode() throws Exception {
        UUID prescriptionId = UUID.randomUUID();
        String code = "RX000001";
        PrescriptionResult result = new PrescriptionResult(
                prescriptionId, code, UUID.randomUUID(), UUID.randomUUID(), "VISIT-001",
                UUID.randomUUID(), "PAT-001", "Nguyen Van A", PrescriptionStatus.PENDING_DISPENSE,
                null, UUID.randomUUID(), "Dr. B", Instant.now(), null, null, List.of(), List.of());
        when(getPrescriptionByCodeUseCase.getByCode(code)).thenReturn(result);

        for (String role : new String[] {"ADMIN", "PHARMACIST"}) {
            mockMvc.perform(get("/prescriptions/code/{prescriptionCode}", code)
                            .with(user(role.toLowerCase()).authorities(new org.springframework.security.core.authority.SimpleGrantedAuthority("PERMISSION_PRESCRIPTION_READ"))))
                    .andExpect(status().isOk());
        }
    }

    @Test
    void deniesUsersWithoutPrescriptionReadPermissionFromReadingByCode() throws Exception {
        UUID userId = UUID.randomUUID();
        when(currentUserPort.getCurrentUserId()).thenReturn(userId);

        mockMvc.perform(get("/prescriptions/code/RX000001")
                        .with(user("receptionist").authorities(new org.springframework.security.core.authority.SimpleGrantedAuthority("PERMISSION_APPOINTMENT_READ"))))
                .andExpect(status().isForbidden());

        org.mockito.Mockito.verify(auditLogRepository).save(org.mockito.ArgumentMatchers.argThat(log ->
                log.getActionType() == com.benhsoan.domain.auditlog.enums.ActionType.ACCESS_DENIED &&
                log.getResourceType() == com.benhsoan.domain.auditlog.enums.ResourceType.PERMISSION &&
                log.getUserId().equals(userId)
        ));
    }

}
