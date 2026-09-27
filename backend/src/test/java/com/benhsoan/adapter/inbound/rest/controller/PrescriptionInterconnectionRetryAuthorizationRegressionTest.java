package com.benhsoan.adapter.inbound.rest.controller;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;
import java.util.UUID;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.aop.AopAutoConfiguration;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.EnableAspectJAutoProxy;
import org.springframework.context.annotation.Import;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import com.benhsoan.adapter.inbound.rest.mapper.PrescriptionRestMapper;
import com.benhsoan.application.ucservice.anonymization.AnonymizationModeState;
import com.benhsoan.config.SecurityConfig;
import com.benhsoan.domain.auditlog.AuditLog;
import com.benhsoan.domain.auditlog.enums.ActionType;
import com.benhsoan.domain.auditlog.enums.ResourceType;
import com.benhsoan.domain.prescription.enums.InterconnectionStatus;
import com.benhsoan.exception.GlobalExceptionHandler;
import com.benhsoan.infrastructure.authSecurity.JwtAuthenticationFilter;
import com.benhsoan.infrastructure.security.annotation.RequirePermissionAspect;
import com.benhsoan.infrastructure.security.service.PermissionEvaluator;
import com.benhsoan.port.dto.result.PrescriptionInterconnectionResult;
import com.benhsoan.port.inbound.prescription.AmendPrescriptionUseCase;
import com.benhsoan.port.inbound.prescription.CancelPrescriptionUseCase;
import com.benhsoan.port.inbound.prescription.CheckContraindicationUseCase;
import com.benhsoan.port.inbound.prescription.CheckDrugInteractionUseCase;
import com.benhsoan.port.inbound.prescription.CheckMaxDailyDoseUseCase;
import com.benhsoan.port.inbound.prescription.CheckPatientDrugAllergyUseCase;
import com.benhsoan.port.inbound.prescription.CreatePrescriptionUseCase;
import com.benhsoan.port.inbound.prescription.DispensePrescriptionItemsUseCase;
import com.benhsoan.port.inbound.prescription.DispensePrescriptionUseCase;
import com.benhsoan.port.inbound.prescription.ExportPrescriptionUseCase;
import com.benhsoan.port.inbound.prescription.GetDispenseSuggestionUseCase;
import com.benhsoan.port.inbound.prescription.GetPrescriptionAllergyWarningLogsUseCase;
import com.benhsoan.port.inbound.prescription.GetPrescriptionByCodeUseCase;
import com.benhsoan.port.inbound.prescription.GetPrescriptionDispenseHistoryUseCase;
import com.benhsoan.port.inbound.prescription.GetPrescriptionUseCase;
import com.benhsoan.port.inbound.prescription.GetPrescriptionsByMedicalRecordUseCase;
import com.benhsoan.port.inbound.prescription.ReplaceInterconnectedPrescriptionUseCase;
import com.benhsoan.port.inbound.prescription.RetryPrescriptionInterconnectionUseCase;
import com.benhsoan.port.inbound.prescription.ReturnMedicationUseCase;
import com.benhsoan.port.inbound.prescription.SearchPrescriptionsUseCase;
import com.benhsoan.port.inbound.prescription.SendPrescriptionInterconnectionUseCase;
import com.benhsoan.port.outbound.authSecurity.JwtTokenPort;
import com.benhsoan.port.outbound.repository.audit.AuditLogRepository;
import com.benhsoan.port.outbound.repository.auth.RoleRepository;
import com.benhsoan.port.outbound.repository.auth.UserRepository;
import com.benhsoan.port.outbound.repository.auth.UserSessionRepository;
import com.benhsoan.port.outbound.security.CurrentUserPort;
import com.benhsoan.port.outbound.time.ClockPort;

/**
 * Regression guard for NCL-12-CN-007 clarification 1.
 *
 * Retransmission authorization is owned by NCL-12-CN-004 and must stay unchanged:
 * ADMIN may retry FAILED submissions, a PHARMACIST may view reconciliation and record a
 * reason but must never gain retry access through NCL-12-CN-007.
 */
@WebMvcTest(controllers = PrescriptionController.class)
@Import({
        AopAutoConfiguration.class,
        PrescriptionInterconnectionRetryAuthorizationRegressionTest.AspectTestConfig.class,
        GlobalExceptionHandler.class,
        SecurityConfig.class,
        JwtAuthenticationFilter.class,
        RequirePermissionAspect.class,
        PermissionEvaluator.class,
        PrescriptionRestMapper.class,
        AnonymizationModeState.class
})
@DisplayName("NCL-12-CN-004 retry authorization stays unchanged under NCL-12-CN-007")
class PrescriptionInterconnectionRetryAuthorizationRegressionTest {

    @TestConfiguration
    @EnableAspectJAutoProxy(proxyTargetClass = true)
    static class AspectTestConfig {
    }

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean private CreatePrescriptionUseCase createPrescriptionUseCase;
    @MockitoBean private AmendPrescriptionUseCase amendPrescriptionUseCase;
    @MockitoBean private GetPrescriptionUseCase getPrescriptionUseCase;
    @MockitoBean private GetPrescriptionByCodeUseCase getPrescriptionByCodeUseCase;
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
    @MockitoBean private ReplaceInterconnectedPrescriptionUseCase replaceInterconnectedPrescriptionUseCase;
    @MockitoBean private ReturnMedicationUseCase returnMedicationUseCase;

    @MockitoBean private JwtTokenPort jwtTokenPort;
    @MockitoBean private UserRepository userRepository;
    @MockitoBean private UserSessionRepository userSessionRepository;
    @MockitoBean private RoleRepository roleRepository;
    @MockitoBean private ClockPort clockPort;
    @MockitoBean private AuditLogRepository auditLogRepository;
    @MockitoBean private CurrentUserPort currentUserPort;

    @Test
    void pharmacistHoldingEveryReconciliationPermissionStillCannotRetry() throws Exception {
        UUID actorId = UUID.randomUUID();
        when(currentUserPort.getCurrentUserId()).thenReturn(actorId);

        mockMvc.perform(post("/prescriptions/{id}/interconnection/retry", UUID.randomUUID())
                        .with(user("pharmacist").authorities(
                                new SimpleGrantedAuthority("PERMISSION_PRESCRIPTION_RECONCILIATION_VIEW"),
                                new SimpleGrantedAuthority("PERMISSION_PRESCRIPTION_RECONCILIATION_NOTE"),
                                new SimpleGrantedAuthority("PERMISSION_PRESCRIPTION_UPDATE_STATUS"))))
                .andExpect(status().isForbidden());

        verifyNoInteractions(retryPrescriptionInterconnectionUseCase);

        ArgumentCaptor<AuditLog> captor = ArgumentCaptor.forClass(AuditLog.class);
        verify(auditLogRepository).save(captor.capture());
        assertEquals(ActionType.ACCESS_DENIED, captor.getValue().getActionType());
        assertEquals(ResourceType.PERMISSION, captor.getValue().getResourceType());
    }

    @Test
    void adminStillRetriesFailedInterconnection() throws Exception {
        UUID prescriptionId = UUID.randomUUID();
        when(retryPrescriptionInterconnectionUseCase.retry(any())).thenReturn(
                new PrescriptionInterconnectionResult(prescriptionId, "RX000001",
                        InterconnectionStatus.SUCCESS, "LT-1", null, Instant.parse("2026-09-25T03:00:00Z")));

        mockMvc.perform(post("/prescriptions/{id}/interconnection/retry", prescriptionId)
                        .with(user("admin").authorities(
                                new SimpleGrantedAuthority("PERMISSION_PRESCRIPTION_INTERCONNECTION_RETRY"))))
                .andExpect(status().isOk());

        verify(retryPrescriptionInterconnectionUseCase).retry(prescriptionId);
    }
}
