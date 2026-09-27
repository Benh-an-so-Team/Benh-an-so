package com.benhsoan.application.ucservice.auth;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;

import com.benhsoan.domain.auth.Role;
import com.benhsoan.domain.auth.User;
import com.benhsoan.domain.auth.UserSession;
import com.benhsoan.port.dto.result.auth.ActiveSessionResult;
import com.benhsoan.port.outbound.repository.auth.RoleRepository;
import com.benhsoan.port.outbound.repository.auth.UserRepository;
import com.benhsoan.port.outbound.repository.auth.UserSessionRepository;
import com.benhsoan.port.outbound.repository.clinic.ClinicConfigurationRepository;
import com.benhsoan.port.outbound.security.CurrentUserPort;
import com.benhsoan.port.outbound.time.ClockPort;

@ExtendWith(MockitoExtension.class)
@DisplayName("GetActiveSessionsService Tests")
class GetActiveSessionsServiceTest {

    private static final Instant NOW = Instant.parse("2026-09-24T08:00:00Z");

    @Mock
    private UserSessionRepository userSessionRepository;
    @Mock
    private ClinicConfigurationRepository clinicConfigurationRepository;
    @Mock
    private UserRepository userRepository;
    @Mock
    private RoleRepository roleRepository;
    @Mock
    private CurrentUserPort currentUserPort;
    @Mock
    private ClockPort clockPort;

    private GetActiveSessionsService service;

    @BeforeEach
    void setUp() {
        service = new GetActiveSessionsService(
                userSessionRepository,
                clinicConfigurationRepository,
                userRepository,
                roleRepository,
                currentUserPort,
                clockPort);
        when(clockPort.now()).thenReturn(NOW);
    }

    @Test
    @DisplayName("Tra cứu danh sách phiên hoạt động thành công")
    void getActiveSessionsSuccess() {
        UUID userId = UUID.randomUUID();
        UUID roleId = UUID.randomUUID();
        UUID currentSessionId = UUID.randomUUID();
        Pageable pageable = PageRequest.of(0, 10);

        UserSession session = UserSession.restore(
                currentSessionId, userId, "hash", null,
                NOW.plus(Duration.ofDays(7)), NOW, NOW, null,
                "192.168.1.50", "Mozilla/5.0");

        when(clinicConfigurationRepository.find()).thenReturn(Optional.empty());
        when(userSessionRepository.findActiveSessions(eq(NOW), any(Instant.class), eq(pageable)))
                .thenReturn(new PageImpl<>(List.of(session), pageable, 1));

        User user = User.restore(userId, "doctor_a", "hash", "Doctor A", "doctor@clinic.com", null, roleId, true, null,
                NOW);
        when(userRepository.findAllById(List.of(userId))).thenReturn(List.of(user));

        Role role = Role.restore(roleId, "DOCTOR", "Doctor role", true, NOW, NOW, java.util.Collections.emptySet());
        when(roleRepository.findAll()).thenReturn(List.of(role));
        when(currentUserPort.getCurrentSessionId()).thenReturn(currentSessionId);

        Page<ActiveSessionResult> result = service.getActiveSessions(pageable);

        assertNotNull(result);
        assertEquals(1, result.getTotalElements());
        ActiveSessionResult item = result.getContent().get(0);
        assertEquals(currentSessionId, item.sessionId());
        assertEquals("doctor_a", item.username());
        assertEquals("Doctor A", item.fullName());
        assertEquals("DOCTOR", item.roleName());
        assertEquals("192.168.1.50", item.ipAddress());
        assertEquals("Mozilla/5.0", item.userAgent());
        assertTrue(item.isCurrentSession());
    }

    @Test
    @DisplayName("Trả về trang rỗng khi không có phiên hoạt động")
    void getActiveSessionsEmpty() {
        Pageable pageable = PageRequest.of(0, 10);
        when(clinicConfigurationRepository.find()).thenReturn(Optional.empty());
        when(userSessionRepository.findActiveSessions(eq(NOW), any(Instant.class), eq(pageable)))
                .thenReturn(Page.empty(pageable));

        Page<ActiveSessionResult> result = service.getActiveSessions(pageable);

        assertNotNull(result);
        assertTrue(result.isEmpty());
    }
}
