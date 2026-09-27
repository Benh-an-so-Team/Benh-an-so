package com.benhsoan.adapter.inbound.rest.controller;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.aop.AopAutoConfiguration;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.EnableAspectJAutoProxy;
import org.springframework.context.annotation.Import;
import org.springframework.data.domain.PageImpl;
import org.springframework.http.MediaType;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import com.benhsoan.adapter.inbound.rest.mapper.PrescriptionReconciliationRestMapper;
import com.benhsoan.config.SecurityConfig;
import com.benhsoan.domain.auditlog.AuditLog;
import com.benhsoan.domain.auditlog.enums.ActionType;
import com.benhsoan.domain.auditlog.enums.ResourceType;
import com.benhsoan.domain.prescription.enums.InterconnectionStatus;
import com.benhsoan.domain.prescription.enums.PrescriptionReconciliationOutcome;
import com.benhsoan.domain.prescription.enums.PrescriptionStatus;
import com.benhsoan.domain.prescription.exception.PrescriptionNotFoundException;
import com.benhsoan.domain.shared.exception.ValidationException;
import com.benhsoan.exception.GlobalExceptionHandler;
import com.benhsoan.infrastructure.authSecurity.JwtAuthenticationFilter;
import com.benhsoan.infrastructure.security.annotation.RequirePermissionAspect;
import com.benhsoan.infrastructure.security.service.PermissionEvaluator;
import com.benhsoan.port.dto.result.PrescriptionReconciliationItemResult;
import com.benhsoan.port.dto.result.PrescriptionReconciliationNoteResult;
import com.benhsoan.port.inbound.prescription.GetPrescriptionReconciliationNotesUseCase;
import com.benhsoan.port.inbound.prescription.GetPrescriptionReconciliationUseCase;
import com.benhsoan.port.inbound.prescription.RecordPrescriptionReconciliationNoteUseCase;
import com.benhsoan.port.outbound.authSecurity.JwtTokenPort;
import com.benhsoan.port.outbound.repository.audit.AuditLogRepository;
import com.benhsoan.port.outbound.repository.auth.RoleRepository;
import com.benhsoan.port.outbound.repository.auth.UserRepository;
import com.benhsoan.port.outbound.repository.auth.UserSessionRepository;
import com.benhsoan.port.outbound.security.CurrentUserPort;
import com.benhsoan.port.outbound.time.ClockPort;

@WebMvcTest(controllers = PrescriptionReconciliationController.class)
@Import({
        AopAutoConfiguration.class,
        PrescriptionReconciliationControllerTest.AspectTestConfig.class,
        GlobalExceptionHandler.class,
        SecurityConfig.class,
        JwtAuthenticationFilter.class,
        RequirePermissionAspect.class,
        PermissionEvaluator.class,
        PrescriptionReconciliationRestMapper.class
})
class PrescriptionReconciliationControllerTest {

    @TestConfiguration
    @EnableAspectJAutoProxy(proxyTargetClass = true)
    static class AspectTestConfig {
    }

    private static final String VIEW = "PERMISSION_PRESCRIPTION_RECONCILIATION_VIEW";

    private static final String NOTE = "PERMISSION_PRESCRIPTION_RECONCILIATION_NOTE";

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private GetPrescriptionReconciliationUseCase getPrescriptionReconciliationUseCase;

    @MockitoBean
    private GetPrescriptionReconciliationNotesUseCase getPrescriptionReconciliationNotesUseCase;

    @MockitoBean
    private RecordPrescriptionReconciliationNoteUseCase recordPrescriptionReconciliationNoteUseCase;

    @MockitoBean
    private JwtTokenPort jwtTokenPort;

    @MockitoBean
    private UserRepository userRepository;

    @MockitoBean
    private UserSessionRepository userSessionRepository;

    @MockitoBean
    private RoleRepository roleRepository;

    @MockitoBean
    private ClockPort clockPort;

    @MockitoBean
    private AuditLogRepository auditLogRepository;

    @MockitoBean
    private CurrentUserPort currentUserPort;

    private static PrescriptionReconciliationItemResult row() {
        return new PrescriptionReconciliationItemResult(
                UUID.randomUUID(),
                "RX000001",
                UUID.randomUUID(),
                "PA001",
                "Nguyen Van A",
                UUID.randomUUID(),
                "Dr. B",
                PrescriptionStatus.DISPENSED,
                InterconnectionStatus.FAILED,
                PrescriptionReconciliationOutcome.DISPENSED_NOT_TRANSMITTED,
                true,
                true,
                Instant.parse("2026-09-10T02:00:00Z"),
                Instant.parse("2026-09-10T03:00:00Z"),
                Instant.parse("2026-09-11T02:00:00Z"),
                "gateway timeout",
                null,
                0L);
    }

    @Test
    void adminWithViewPermissionCanList() throws Exception {
        when(getPrescriptionReconciliationUseCase.search(any()))
                .thenReturn(new PageImpl<>(List.of(row())));

        mockMvc.perform(get("/prescription-reconciliation")
                        .with(user("admin").authorities(new SimpleGrantedAuthority(VIEW))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].prescriptionCode").value("RX000001"))
                .andExpect(jsonPath("$.content[0].outcome").value("DISPENSED_NOT_TRANSMITTED"))
                .andExpect(jsonPath("$.content[0].discrepancy").value(true))
                .andExpect(jsonPath("$.content[0].retransmissionEligible").value(true))
                .andExpect(jsonPath("$.content[0].patientCode").value("PA001"))
                .andExpect(jsonPath("$.content[0].prescribedQuantity").doesNotExist())
                .andExpect(jsonPath("$.content[0].dispensedQuantity").doesNotExist());
    }

    @Test
    void pharmacistWithViewPermissionCanList() throws Exception {
        when(getPrescriptionReconciliationUseCase.search(any()))
                .thenReturn(new PageImpl<>(List.of(row())));

        mockMvc.perform(get("/prescription-reconciliation")
                        .with(user("pharmacist").authorities(new SimpleGrantedAuthority(VIEW))))
                .andExpect(status().isOk());
    }

    @Test
    void receptionistWithoutViewPermissionIsDenied() throws Exception {
        mockMvc.perform(get("/prescription-reconciliation")
                        .with(user("receptionist").authorities(
                                new SimpleGrantedAuthority("PERMISSION_PATIENT_READ"))))
                .andExpect(status().isForbidden());
    }

    @Test
    void unauthenticatedRequestIsRejected() throws Exception {
        mockMvc.perform(get("/prescription-reconciliation"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void deniedAccessIsAuditedAsAccessDenied() throws Exception {
        UUID actorId = UUID.randomUUID();
        when(currentUserPort.getCurrentUserId()).thenReturn(actorId);

        mockMvc.perform(get("/prescription-reconciliation")
                        .with(user("receptionist").authorities(
                                new SimpleGrantedAuthority("PERMISSION_PATIENT_READ"))))
                .andExpect(status().isForbidden());

        ArgumentCaptor<AuditLog> captor = ArgumentCaptor.forClass(AuditLog.class);
        verify(auditLogRepository).save(captor.capture());
        assertEquals(ActionType.ACCESS_DENIED, captor.getValue().getActionType());
        assertEquals(ResourceType.PERMISSION, captor.getValue().getResourceType());
    }

    @Test
    void invertedPeriodIsRejectedWithBadRequest() throws Exception {
        when(getPrescriptionReconciliationUseCase.search(any()))
                .thenThrow(new ValidationException("from must be before or equal to to."));

        mockMvc.perform(get("/prescription-reconciliation")
                        .param("from", "2026-10-01T00:00:00Z")
                        .param("to", "2026-09-01T00:00:00Z")
                        .with(user("admin").authorities(new SimpleGrantedAuthority(VIEW))))
                .andExpect(status().isBadRequest());
    }

    @Test
    void invalidPageSizeIsRejectedWithBadRequest() throws Exception {
        mockMvc.perform(get("/prescription-reconciliation")
                        .param("size", "101")
                        .with(user("admin").authorities(new SimpleGrantedAuthority(VIEW))))
                .andExpect(status().isBadRequest());
    }

    @Test
    void filtersAreForwardedToTheUseCase() throws Exception {
        when(getPrescriptionReconciliationUseCase.search(any()))
                .thenReturn(new PageImpl<>(List.of()));

        mockMvc.perform(get("/prescription-reconciliation")
                        .param("from", "2026-09-01T00:00:00Z")
                        .param("to", "2026-10-01T00:00:00Z")
                        .param("outcome", "TRANSMITTED_NOT_DISPENSED")
                        .param("discrepanciesOnly", "true")
                        .param("prescriptionCode", "RX000001")
                        .param("page", "1")
                        .param("size", "5")
                        .with(user("admin").authorities(new SimpleGrantedAuthority(VIEW))))
                .andExpect(status().isOk());

        ArgumentCaptor<com.benhsoan.port.dto.command.prescription.SearchPrescriptionReconciliationQuery> captor =
                ArgumentCaptor.forClass(
                        com.benhsoan.port.dto.command.prescription.SearchPrescriptionReconciliationQuery.class);
        verify(getPrescriptionReconciliationUseCase).search(captor.capture());
        assertEquals(Instant.parse("2026-09-01T00:00:00Z"), captor.getValue().from());
        assertEquals(Instant.parse("2026-10-01T00:00:00Z"), captor.getValue().to());
        assertEquals(PrescriptionReconciliationOutcome.TRANSMITTED_NOT_DISPENSED, captor.getValue().outcome());
        assertEquals(true, captor.getValue().discrepanciesOnly());
        assertEquals("RX000001", captor.getValue().prescriptionCode());
        assertEquals(1, captor.getValue().page());
        assertEquals(5, captor.getValue().size());
    }

    @Test
    void notesCanBeReadWithViewPermission() throws Exception {
        UUID prescriptionId = UUID.randomUUID();
        when(getPrescriptionReconciliationNotesUseCase.getNotes(prescriptionId)).thenReturn(List.of(
                new PrescriptionReconciliationNoteResult(UUID.randomUUID(), prescriptionId,
                        PrescriptionReconciliationOutcome.DISPENSED_NOT_TRANSMITTED, "ly do",
                        UUID.randomUUID(), Instant.parse("2026-09-25T03:00:00Z"))));

        mockMvc.perform(get("/prescription-reconciliation/{id}/notes", prescriptionId)
                        .with(user("pharmacist").authorities(new SimpleGrantedAuthority(VIEW))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].reason").value("ly do"))
                .andExpect(jsonPath("$[0].reconciliationOutcome").value("DISPENSED_NOT_TRANSMITTED"));
    }

    @Test
    void notesCannotBeReadWithoutViewPermission() throws Exception {
        mockMvc.perform(get("/prescription-reconciliation/{id}/notes", UUID.randomUUID())
                        .with(user("doctor").authorities(
                                new SimpleGrantedAuthority("PERMISSION_PRESCRIPTION_READ"))))
                .andExpect(status().isForbidden());
    }

    @Test
    void notesOfUnknownPrescriptionReturnNotFound() throws Exception {
        UUID prescriptionId = UUID.randomUUID();
        when(getPrescriptionReconciliationNotesUseCase.getNotes(prescriptionId))
                .thenThrow(new PrescriptionNotFoundException(prescriptionId));

        mockMvc.perform(get("/prescription-reconciliation/{id}/notes", prescriptionId)
                        .with(user("admin").authorities(new SimpleGrantedAuthority(VIEW))))
                .andExpect(status().isNotFound());
    }

    @Test
    void recordingNoteRequiresTheNotePermission() throws Exception {
        mockMvc.perform(post("/prescription-reconciliation/{id}/notes", UUID.randomUUID())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reason\":\"ly do\"}")
                        .with(user("viewer").authorities(new SimpleGrantedAuthority(VIEW))))
                .andExpect(status().isForbidden());
    }

    @Test
    void blankReasonIsRejectedWithBadRequest() throws Exception {
        mockMvc.perform(post("/prescription-reconciliation/{id}/notes", UUID.randomUUID())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reason\":\"   \"}")
                        .with(user("pharmacist").authorities(new SimpleGrantedAuthority(NOTE))))
                .andExpect(status().isBadRequest());
    }

    @Test
    void reasonOverFiveHundredCharactersIsRejectedWithBadRequest() throws Exception {
        String tooLong = "x".repeat(501);
        mockMvc.perform(post("/prescription-reconciliation/{id}/notes", UUID.randomUUID())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reason\":\"" + tooLong + "\"}")
                        .with(user("pharmacist").authorities(new SimpleGrantedAuthority(NOTE))))
                .andExpect(status().isBadRequest());
    }

    @Test
    void pharmacistCanRecordANoteAndTheServerOwnsTheDiscrepancyType() throws Exception {
        UUID prescriptionId = UUID.randomUUID();
        when(recordPrescriptionReconciliationNoteUseCase.record(any())).thenReturn(
                new PrescriptionReconciliationNoteResult(UUID.randomUUID(), prescriptionId,
                        PrescriptionReconciliationOutcome.DISPENSED_NOT_TRANSMITTED, "ly do",
                        UUID.randomUUID(), Instant.parse("2026-09-25T03:00:00Z")));

        mockMvc.perform(post("/prescription-reconciliation/{id}/notes", prescriptionId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reason\":\"ly do\"}")
                        .with(user("pharmacist").authorities(new SimpleGrantedAuthority(NOTE))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.reason").value("ly do"))
                .andExpect(jsonPath("$.reconciliationOutcome").value("DISPENSED_NOT_TRANSMITTED"));

        ArgumentCaptor<com.benhsoan.port.dto.command.prescription.RecordPrescriptionReconciliationNoteCommand> captor =
                ArgumentCaptor.forClass(
                        com.benhsoan.port.dto.command.prescription.RecordPrescriptionReconciliationNoteCommand.class);
        verify(recordPrescriptionReconciliationNoteUseCase).record(captor.capture());
        assertEquals(prescriptionId, captor.getValue().prescriptionId());
        assertEquals("ly do", captor.getValue().reason());
    }
}
