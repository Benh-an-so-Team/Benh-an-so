package com.benhsoan.adapter.inbound.rest.controller;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.aop.AopAutoConfiguration;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.EnableAspectJAutoProxy;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import com.benhsoan.adapter.inbound.rest.mapper.PatientConsentRestMapper;
import com.benhsoan.adapter.inbound.rest.mapper.PatientRestMapper;
import com.benhsoan.config.SecurityConfig;
import com.benhsoan.domain.patient.Patient;
import com.benhsoan.domain.patient.enums.BloodType;
import com.benhsoan.domain.patient.enums.ConsentHistoryStatus;
import com.benhsoan.domain.patient.enums.ConsentScope;
import com.benhsoan.domain.patient.enums.Gender;
import com.benhsoan.exception.GlobalExceptionHandler;
import com.benhsoan.infrastructure.authSecurity.JwtAuthenticationFilter;
import com.benhsoan.infrastructure.security.annotation.RequirePermissionAspect;
import com.benhsoan.infrastructure.security.service.PermissionEvaluator;
import com.benhsoan.port.dto.result.PatientResult;
import com.benhsoan.port.dto.result.patient.DataErasureResult;
import com.benhsoan.port.dto.result.patient.PatientConsentHistoryResult;
import com.benhsoan.port.inbound.patient.GetPatientConsentHistoryUseCase;
import com.benhsoan.port.inbound.patient.RequestPatientDataErasureUseCase;
import com.benhsoan.port.inbound.patient.UpdatePatientConsentUseCase;
import com.benhsoan.port.outbound.authSecurity.JwtTokenPort;
import com.benhsoan.port.outbound.repository.audit.AuditLogRepository;
import com.benhsoan.port.outbound.repository.auth.RoleRepository;
import com.benhsoan.port.outbound.repository.auth.UserRepository;
import com.benhsoan.port.outbound.repository.auth.UserSessionRepository;
import com.benhsoan.port.outbound.repository.patient.PatientRepository;
import com.benhsoan.port.outbound.security.CurrentUserPort;
import com.benhsoan.port.outbound.time.ClockPort;

@WebMvcTest(controllers = {
                PatientConsentManagementController.class,
                PatientPortalConsentController.class
})
@Import({
                com.benhsoan.application.ucservice.anonymization.AnonymizationModeState.class,
                AopAutoConfiguration.class,
                PatientConsentManagementIntegrationTest.AspectTestConfig.class,
                PatientConsentRestMapper.class,
                PatientRestMapper.class,
                GlobalExceptionHandler.class,
                SecurityConfig.class,
                JwtAuthenticationFilter.class,
                RequirePermissionAspect.class,
                PermissionEvaluator.class
})
@DisplayName("Patient Consent Management Integration Tests (NCL-15-CN-005)")
class PatientConsentManagementIntegrationTest {

        private static final Instant NOW = Instant.parse("2026-09-23T10:00:00Z");

        @TestConfiguration
        @EnableAspectJAutoProxy(proxyTargetClass = true)
        static class AspectTestConfig {
        }

        @Autowired
        private MockMvc mockMvc;

        @MockitoBean
        private GetPatientConsentHistoryUseCase getPatientConsentHistoryUseCase;
        @MockitoBean
        private UpdatePatientConsentUseCase updatePatientConsentUseCase;
        @MockitoBean
        private RequestPatientDataErasureUseCase requestPatientDataErasureUseCase;
        @MockitoBean
        private PatientRepository patientRepository;
        @MockitoBean
        private CurrentUserPort currentUserPort;
        @MockitoBean
        private JwtTokenPort jwtTokenPort;
        @MockitoBean
        private UserRepository userRepository;
        @MockitoBean
        private UserSessionRepository userSessionRepository;
        @MockitoBean
        private RoleRepository roleRepository;
        @MockitoBean
        private AuditLogRepository auditLogRepository;
        @MockitoBean
        private ClockPort clockPort;

        private Patient createTestPatient(UUID patientId, UUID userId) {
                return Patient.restore(
                                patientId,
                                "PAT-2026-0001",
                                "Nguyễn Văn An",
                                LocalDate.of(1990, 5, 20),
                                Gender.MALE,
                                "0901234567",
                                "an@example.com",
                                "123 Ba Đình, Hà Nội",
                                "001090000001",
                                "DN4010123456789",
                                BloodType.O_POSITIVE,
                                null, null, null, null, null, null, null, null,
                                "Nguyễn Văn An",
                                true,
                                NOW.minusSeconds(86400),
                                NOW.minusSeconds(86400),
                                userId,
                                userId,
                                true,
                                NOW.minusSeconds(86400),
                                "v1.0",
                                false,
                                null,
                                null,
                                false);
        }

        @Test
        @DisplayName("GET /patients/{patientId}/consent-history: 200 OK khi có quyền PATIENT_READ")
        void getConsentHistory_authorized_returns200() throws Exception {
                UUID patientId = UUID.randomUUID();

                PatientConsentHistoryResult r1 = PatientConsentHistoryResult.builder()
                                .id(UUID.randomUUID())
                                .patientId(patientId)
                                .versionNumber(1)
                                .versionCode("v1.0")
                                .status(ConsentHistoryStatus.AGREED)
                                .scopes(ConsentScope.defaultAll())
                                .consentAgreed(true)
                                .consentAgreedAt(NOW)
                                .consentWithdrawn(false)
                                .nonMedicalUseRestricted(false)
                                .signerName("Nguyễn Văn An")
                                .createdAt(NOW)
                                .build();

                when(getPatientConsentHistoryUseCase.getConsentHistory(patientId)).thenReturn(List.of(r1));

                mockMvc.perform(get("/patients/{patientId}/consent-history", patientId)
                                .with(user("receptionist")
                                                .authorities(new SimpleGrantedAuthority("PERMISSION_PATIENT_READ"))))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$[0].versionNumber").value(1))
                                .andExpect(jsonPath("$[0].status").value("AGREED"))
                                .andExpect(jsonPath("$[0].consentAgreed").value(true));
        }

        @Test
        @DisplayName("GET /patients/{patientId}/consent-history: 403 Forbidden khi thiếu quyền")
        void getConsentHistory_forbiddenWithoutPermission() throws Exception {
                UUID patientId = UUID.randomUUID();

                mockMvc.perform(get("/patients/{patientId}/consent-history", patientId)
                                .with(user("unauthorized_user").authorities(new SimpleGrantedAuthority("ROLE_USER"))))
                                .andExpect(status().isForbidden());
        }

        @Test
        @DisplayName("POST /patients/{patientId}/data-erasure-request: 200 OK khi có quyền PATIENT_CONSENT_UPDATE")
        void requestDataErasure_authorized_returns200WithRetentionMessage() throws Exception {
                UUID patientId = UUID.randomUUID();

                DataErasureResult result = DataErasureResult.builder()
                                .patientId(patientId)
                                .consentWithdrawn(true)
                                .nonMedicalUseRestricted(true)
                                .medicalRecordsRetained(true)
                                .retentionYears(10)
                                .message("Hồ sơ bệnh án được lưu trữ tối thiểu 10 năm theo Luật Khám bệnh, chữa bệnh (QTN-19).")
                                .build();

                when(requestPatientDataErasureUseCase.requestErasure(eq(patientId), any())).thenReturn(result);

                mockMvc.perform(post("/patients/{patientId}/data-erasure-request", patientId)
                                .with(user("receptionist").authorities(
                                                new SimpleGrantedAuthority("PERMISSION_PATIENT_CONSENT_UPDATE")))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"reason\":\"Yêu cầu xóa toàn bộ dữ liệu\"}"))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.patientId").value(patientId.toString()))
                                .andExpect(jsonPath("$.medicalRecordsRetained").value(true))
                                .andExpect(jsonPath("$.retentionYears").value(10))
                                .andExpect(jsonPath("$.consentWithdrawn").value(true))
                                .andExpect(jsonPath("$.message").value(result.message()));
        }

        @Test
        @DisplayName("POST /patients/{patientId}/data-erasure-request: 403 Forbidden khi thiếu quyền")
        void requestDataErasure_forbiddenWithoutPermission() throws Exception {
                UUID patientId = UUID.randomUUID();

                mockMvc.perform(post("/patients/{patientId}/data-erasure-request", patientId)
                                .with(user("user_no_perm").authorities(new SimpleGrantedAuthority("PATIENT_READ")))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"reason\":\"Yêu cầu xóa\"}"))
                                .andExpect(status().isForbidden());
        }

        @Test
        @DisplayName("GET /patient-portal/consent/history: 200 OK khi bệnh nhân truy cập portal")
        void portalGetConsentHistory_returns200() throws Exception {
                UUID userId = UUID.randomUUID();
                UUID patientId = UUID.randomUUID();
                Patient patient = createTestPatient(patientId, userId);

                when(currentUserPort.getCurrentUserId()).thenReturn(userId);
                when(patientRepository.findByUserId(userId)).thenReturn(Optional.of(patient));

                PatientConsentHistoryResult r1 = PatientConsentHistoryResult.builder()
                                .id(UUID.randomUUID())
                                .patientId(patientId)
                                .versionNumber(1)
                                .versionCode("v1.0")
                                .status(ConsentHistoryStatus.AGREED)
                                .scopes(ConsentScope.defaultAll())
                                .consentAgreed(true)
                                .consentAgreedAt(NOW)
                                .consentWithdrawn(false)
                                .nonMedicalUseRestricted(false)
                                .signerName("Nguyễn Văn An")
                                .createdAt(NOW)
                                .build();

                when(getPatientConsentHistoryUseCase.getConsentHistory(patientId)).thenReturn(List.of(r1));

                mockMvc.perform(get("/patient-portal/consent/history")
                                .with(user("patient_user").authorities(new SimpleGrantedAuthority("ROLE_PATIENT"))))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$[0].versionNumber").value(1))
                                .andExpect(jsonPath("$[0].status").value("AGREED"));
        }

        @Test
        @DisplayName("PUT /patient-portal/consent: 200 OK khi bệnh nhân cập nhật phạm vi trên portal")
        void portalUpdateConsent_returns200() throws Exception {
                UUID userId = UUID.randomUUID();
                UUID patientId = UUID.randomUUID();
                Patient patient = createTestPatient(patientId, userId);

                when(currentUserPort.getCurrentUserId()).thenReturn(userId);
                when(patientRepository.findByUserId(userId)).thenReturn(Optional.of(patient));

                patient.updateConsentScope(true, NOW);
                PatientResult patientResult = new com.benhsoan.application.ucservice.patient.PatientResultMapper()
                                .toResult(patient);

                when(updatePatientConsentUseCase.updateConsent(eq(patientId), any())).thenReturn(patientResult);

                mockMvc.perform(put("/patient-portal/consent")
                                .with(user("patient_user").authorities(new SimpleGrantedAuthority("ROLE_PATIENT")))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"scopes\":[\"TREATMENT\"]}"))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.id").value(patientId.toString()))
                                .andExpect(jsonPath("$.nonMedicalUseRestricted").value(true));
        }

        @Test
        @DisplayName("POST /patient-portal/consent/data-erasure-request: 200 OK khi bệnh nhân gửi yêu cầu xóa qua portal")
        void portalRequestDataErasure_returns200() throws Exception {
                UUID userId = UUID.randomUUID();
                UUID patientId = UUID.randomUUID();
                Patient patient = createTestPatient(patientId, userId);

                when(currentUserPort.getCurrentUserId()).thenReturn(userId);
                when(patientRepository.findByUserId(userId)).thenReturn(Optional.of(patient));

                DataErasureResult result = DataErasureResult.builder()
                                .patientId(patientId)
                                .consentWithdrawn(true)
                                .nonMedicalUseRestricted(true)
                                .medicalRecordsRetained(true)
                                .retentionYears(10)
                                .message("Hồ sơ bệnh án được lưu trữ tối thiểu 10 năm theo Luật Khám bệnh, chữa bệnh (QTN-19).")
                                .build();

                when(requestPatientDataErasureUseCase.requestErasure(eq(patientId), any())).thenReturn(result);

                mockMvc.perform(post("/patient-portal/consent/data-erasure-request")
                                .with(user("patient_user").authorities(new SimpleGrantedAuthority("ROLE_PATIENT")))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"reason\":\"Không muốn tiếp tục lưu trữ\"}"))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.medicalRecordsRetained").value(true))
                                .andExpect(jsonPath("$.retentionYears").value(10))
                                .andExpect(jsonPath("$.consentWithdrawn").value(true));
        }
}
