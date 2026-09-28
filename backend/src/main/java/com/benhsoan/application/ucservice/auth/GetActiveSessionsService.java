package com.benhsoan.application.ucservice.auth;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.benhsoan.domain.auth.Role;
import com.benhsoan.domain.auth.User;
import com.benhsoan.domain.auth.UserSession;
import com.benhsoan.domain.clinic.ClinicConfiguration;
import com.benhsoan.port.dto.result.auth.ActiveSessionResult;
import com.benhsoan.port.inbound.auth.GetActiveSessionsUseCase;
import com.benhsoan.port.outbound.repository.auth.RoleRepository;
import com.benhsoan.port.outbound.repository.auth.UserRepository;
import com.benhsoan.port.outbound.repository.auth.UserSessionRepository;
import com.benhsoan.port.outbound.repository.clinic.ClinicConfigurationRepository;
import com.benhsoan.port.outbound.security.CurrentUserPort;
import com.benhsoan.port.outbound.time.ClockPort;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class GetActiveSessionsService implements GetActiveSessionsUseCase {

        private final UserSessionRepository userSessionRepository;
        private final ClinicConfigurationRepository clinicConfigurationRepository;
        private final UserRepository userRepository;
        private final RoleRepository roleRepository;
        private final CurrentUserPort currentUserPort;
        private final ClockPort clockPort;

        @Override
        public Page<ActiveSessionResult> getActiveSessions(Pageable pageable) {
                int timeoutMinutes = clinicConfigurationRepository.find()
                                .map(ClinicConfiguration::getSessionIdleTimeoutMinutes)
                                .orElse(ClinicConfiguration.DEFAULT_SESSION_IDLE_TIMEOUT_MINUTES);

                Instant now = clockPort.now();
                Instant activeThreshold = now.minus(Duration.ofMinutes(timeoutMinutes));

                Page<UserSession> sessionsPage = userSessionRepository.findActiveSessions(now, activeThreshold,
                                pageable);

                if (sessionsPage.isEmpty()) {
                        return Page.empty(pageable);
                }

                List<UUID> userIds = sessionsPage.getContent().stream()
                                .map(UserSession::getUserId)
                                .distinct()
                                .toList();

                Map<UUID, User> usersMap = userRepository.findAllById(userIds).stream()
                                .collect(Collectors.toMap(User::getId, Function.identity()));

                Map<UUID, Role> rolesMap = roleRepository.findAll().stream()
                                .collect(Collectors.toMap(Role::getId, Function.identity(), (r1, r2) -> r1));

                UUID currentSessionId = currentUserPort.getCurrentSessionId();

                return sessionsPage.map(session -> {
                        User user = usersMap.get(session.getUserId());
                        Role role = user != null ? rolesMap.get(user.getRoleId()) : null;

                        return new ActiveSessionResult(
                                        session.getId(),
                                        session.getUserId(),
                                        user != null ? user.getUsername() : "UNKNOWN",
                                        user != null ? user.getFullName() : "UNKNOWN",
                                        role != null ? role.getName() : "UNKNOWN",
                                        session.getIpAddress(),
                                        session.getUserAgent(),
                                        session.getCreatedAt(),
                                        session.getLastUsedAt(),
                                        currentSessionId != null && currentSessionId.equals(session.getId()));
                });
        }
}
