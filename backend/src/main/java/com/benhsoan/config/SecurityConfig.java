package com.benhsoan.config;

import java.util.List;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import com.benhsoan.infrastructure.authSecurity.JwtAuthenticationFilter;
import com.benhsoan.exception.ApiErrorResponseFactory;
import com.fasterxml.jackson.databind.ObjectMapper;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@Configuration
@EnableWebSecurity
@EnableMethodSecurity
@RequiredArgsConstructor
public class SecurityConfig {

        private final JwtAuthenticationFilter jwtAuthenticationFilter;
        private final ObjectMapper objectMapper;

        @Bean
        public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {

                http
                                .csrf(AbstractHttpConfigurer::disable)

                                .cors(cors -> cors.configurationSource(corsConfigurationSource()))

                                .sessionManagement(session -> session.sessionCreationPolicy(
                                                SessionCreationPolicy.STATELESS))

                                .authorizeHttpRequests(auth -> auth

                                                // ===== AUTHENTICATION =====
                                                .requestMatchers("/auth/change-password", "/auth/sessions/current/extend").authenticated()
                                                .requestMatchers("/auth/**").permitAll()

                                                .requestMatchers(
                                                                "/v3/api-docs/**",
                                                                "/swagger-ui/**",
                                                                "/swagger-ui.html",
                                                                "/swagger-resources/**",
                                                                "/webjars/**")
                                                .permitAll()

                                                .requestMatchers(
                                                                "/actuator/health",
                                                                "/actuator/info")
                                                .permitAll()

                                                // Patient portal result lookup (public, strictly scoped by appointment
                                                // code — QTN-15)
                                                .requestMatchers("/portal/**").permitAll()
                                                .requestMatchers("/mock-interconnection/**").permitAll()

                                                // ===== ADMIN / USER MANAGEMENT =====
                                                .requestMatchers("/admin/sessions/**").authenticated()
                                                .requestMatchers("/admin/**").hasRole("ADMIN")
                                                .requestMatchers("/users/**").authenticated()
                                                .requestMatchers("/audit-logs/**").hasRole("ADMIN")
                                                .requestMatchers("/roles/**", "/permissions/**").authenticated()
                                                .requestMatchers("/system/services/**").authenticated()
                                                .requestMatchers("/system/specialties/**").authenticated()
                                                .requestMatchers("/system/diagnosis-catalog/**").authenticated()
                                                .requestMatchers("/system/clinic/**").authenticated()
                                                .requestMatchers("/system/print-templates/**").authenticated()
                                                .requestMatchers("/backups/**").authenticated()
                                                .requestMatchers("/follow-up-reminders/**").authenticated()
                                                .requestMatchers("/care-logs/**").authenticated()
                                                .requestMatchers("/dashboard/**").authenticated()

                                                // ===== PATIENTS =====
                                                .requestMatchers("/patients/**").authenticated()

                                                // ===== MEDICAL RECORDS =====
                                                .requestMatchers("/medical-history/**").authenticated()
                                                .requestMatchers("/visits/*/encounter").authenticated()
                                                .requestMatchers("/medical-records/**").authenticated()

                                                // ===== PRESCRIPTIONS / CLINICAL =====
                                                .requestMatchers("/medicines/**").authenticated()
                                                .requestMatchers("/prescriptions/**").authenticated()
                                                .requestMatchers("/prescription-templates/**").authenticated()
                                                .requestMatchers("/clinical-services/**").authenticated()
                                                .requestMatchers("/clinical-orders/**").authenticated()
                                                .requestMatchers("/clinical-order-items/**").authenticated()
                                                .requestMatchers("/clinical-results/**").authenticated()
                                                .requestMatchers("/clinical-result-attachments/**").authenticated()
                                                .requestMatchers("/diagnosis-catalog/**").authenticated()
                                                .requestMatchers("/vital-signs/**").authenticated()

                                                // ===== APPOINTMENTS =====
                                                .requestMatchers("/appointments/**").authenticated()

                                                // ===== PATIENT PORTAL =====
                                                .requestMatchers("/patient-portal/**").hasRole("PATIENT")

                                                // ===== REPORTS =====
                                                .requestMatchers("/reports/**").authenticated()

                                                // ===== PHARMACY / INVOICES =====
                                                .requestMatchers("/inventory/**").authenticated()
                                                .requestMatchers("/invoices/**").authenticated()
                                                .requestMatchers("/cashier-shifts/**").authenticated()

                                                // ===== MEDICAL QUEUE =====
                                                .requestMatchers(HttpMethod.GET, "/queues/display").permitAll()
                                                .requestMatchers("/queues/**", "/queue-items/**").authenticated()

                                                // ===== ROOMS =====
                                                .requestMatchers("/rooms/**").authenticated()
                                                .requestMatchers("/doctor-room-assignments/**").authenticated()
                                                .requestMatchers("/doctors/*/room-assignment").authenticated()

                                                // ===== OTHERS =====
                                                .anyRequest().authenticated())

                                .exceptionHandling(ex -> ex
                                                .authenticationEntryPoint(authenticationEntryPoint())
                                                .accessDeniedHandler(accessDeniedHandler()))

                                .addFilterBefore(
                                                jwtAuthenticationFilter,
                                                UsernamePasswordAuthenticationFilter.class);

                return http.build();
        }

        @Bean
        public CorsConfigurationSource corsConfigurationSource() {

                CorsConfiguration configuration = new CorsConfiguration();

                configuration.setAllowedOrigins(List.of(
                                "http://localhost:3000",
                                "http://localhost:5173",
                                "http://localhost:4200"));

                configuration.setAllowedMethods(List.of(
                                "GET",
                                "POST",
                                "PUT",
                                "PATCH",
                                "DELETE",
                                "OPTIONS"));

                configuration.setAllowedHeaders(List.of(
                                "Authorization",
                                "Content-Type",
                                "X-Idempotency-Key",
                                "Accept",
                                "X-Requested-With",
                                "Origin",
                                "Access-Control-Request-Method",
                                "Access-Control-Request-Headers"));

                configuration.setExposedHeaders(List.of(
                                "Authorization",
                                "Content-Disposition"));

                configuration.setAllowCredentials(true);
                configuration.setMaxAge(3600L);

                UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();

                source.registerCorsConfiguration("/**", configuration);

                return source;
        }

        @Bean
        public PasswordEncoder passwordEncoder() {
                return new BCryptPasswordEncoder(12);
        }

        @Bean
        public AuthenticationManager authenticationManager(
                        AuthenticationConfiguration authenticationConfiguration) throws Exception {
                return authenticationConfiguration.getAuthenticationManager();
        }

        @Bean
        public AuthenticationEntryPoint authenticationEntryPoint() {

                return (request, response, authException) -> {

                        writeError(response, HttpStatus.UNAUTHORIZED, "AUTHENTICATION_FAILED",
                                        "Bạn cần đăng nhập để truy cập tài nguyên này", request.getRequestURI(),
                                        objectMapper);
                };
        }

        @Bean
        public AccessDeniedHandler accessDeniedHandler() {

                return (request, response, accessDeniedException) -> {

                        writeError(response, HttpStatus.FORBIDDEN, "ACCESS_DENIED",
                                        "Bạn không có quyền truy cập tài nguyên này",
                                        request.getRequestURI(), objectMapper);
                };
        }

        private void writeError(
                        jakarta.servlet.http.HttpServletResponse response,
                        HttpStatus status,
                        String code,
                        String message,
                        String path,
                        ObjectMapper objectMapper) throws java.io.IOException {
                response.setStatus(status.value());
                response.setContentType(org.springframework.http.MediaType.APPLICATION_JSON_VALUE);
                response.setCharacterEncoding("UTF-8");
                objectMapper.writeValue(response.getWriter(),
                                ApiErrorResponseFactory.create(status, code, message, path));
        }
}
