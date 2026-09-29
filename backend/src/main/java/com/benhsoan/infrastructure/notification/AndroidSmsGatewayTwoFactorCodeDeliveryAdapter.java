package com.benhsoan.infrastructure.notification;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Primary;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import com.benhsoan.domain.auth.User;
import com.benhsoan.port.outbound.notification.TwoFactorCodeDeliveryPort;
import com.benhsoan.port.outbound.repository.auth.UserRepository;

import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;

/**
 * Adapter delivering Two-Factor Authentication (2FA) SMS OTP codes via Android SMS Gateway
 * (capcom6 / sms-gate.app) for high-privilege accounts (NCL-01-CN-006).
 */
@Slf4j
@Component
@Primary
@ConditionalOnProperty(name = "app.sms.gateway.provider", havingValue = "android")
public class AndroidSmsGatewayTwoFactorCodeDeliveryAdapter implements TwoFactorCodeDeliveryPort {

    private final RestClient restClient;
    private final UserRepository userRepository;
    private final String gatewayUrl;
    private final String basicAuthHeader;

    @Autowired
    public AndroidSmsGatewayTwoFactorCodeDeliveryAdapter(
            UserRepository userRepository,
            @Value("${app.sms.gateway.android.url:https://api.sms-gate.app/3rdparty/v1/message}") String gatewayUrl,
            @Value("${app.sms.gateway.android.username:LRIMS3}") String username,
            @Value("${app.sms.gateway.android.password:050jm5oro3ihgy}") String password,
            @Value("${app.sms.gateway.android.connect-timeout-ms:5000}") int connectTimeoutMs,
            @Value("${app.sms.gateway.android.read-timeout-ms:10000}") int readTimeoutMs
    ) {
        this.userRepository = userRepository;
        this.gatewayUrl = gatewayUrl;

        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(Duration.ofMillis(connectTimeoutMs));
        requestFactory.setReadTimeout(Duration.ofMillis(readTimeoutMs));

        this.restClient = RestClient.builder()
                .requestFactory(requestFactory)
                .build();

        String credentials = (username != null ? username : "") + ":" + (password != null ? password : "");
        this.basicAuthHeader = "Basic " + Base64.getEncoder().encodeToString(credentials.getBytes(StandardCharsets.UTF_8));
    }

    /**
     * Package-private constructor for unit testing with a custom RestClient.
     */
    AndroidSmsGatewayTwoFactorCodeDeliveryAdapter(
            RestClient restClient,
            UserRepository userRepository,
            String gatewayUrl,
            String username,
            String password
    ) {
        this.restClient = restClient;
        this.userRepository = userRepository;
        this.gatewayUrl = gatewayUrl;
        String credentials = (username != null ? username : "") + ":" + (password != null ? password : "");
        this.basicAuthHeader = "Basic " + Base64.getEncoder().encodeToString(credentials.getBytes(StandardCharsets.UTF_8));
    }

    @PostConstruct
    public void init() {
        log.info(">>> [2FA SMS ADAPTER ACTIVATED] AndroidSmsGatewayTwoFactorCodeDeliveryAdapter is ACTIVE (Gateway URL: {})", gatewayUrl);
    }

    @Override
    public void sendVerificationCode(String username, String code, long ttlSeconds) {
        Optional<User> userOpt = userRepository.findByUsername(username);
        if (userOpt.isEmpty()) {
            log.warn("================================================================================");
            log.warn("[2FA SMS GATEWAY] Không tìm thấy tài khoản người dùng '{}' để lấy SĐT gửi OTP 2FA.", username);
            log.warn("================================================================================");
            return;
        }

        User user = userOpt.get();
        String phone = user.getPhone();
        if (phone == null || phone.isBlank()) {
            log.warn("================================================================================");
            log.warn("[2FA SMS GATEWAY] Tài khoản '{}' chưa thiết lập số điện thoại trong hệ thống. Không thể gửi SMS OTP 2FA.", username);
            log.warn("   -> Vui lòng cập nhật số điện thoại cho tài khoản '{}' trong bảng users để nhận SMS OTP.", username);
            log.warn("================================================================================");
            return;
        }

        String e164Phone = formatToE164(phone);
        long minutes = Math.max(1, ttlSeconds / 60);

        String message = String.format(
                "[BENH AN SO] Ma xac thuc 2FA dang nhap he thong cua ban la: %s. Ma co hieu luc trong %d phut.",
                code, minutes
        );

        Map<String, Object> payload = Map.of(
                "phoneNumbers", List.of(e164Phone),
                "message", message
        );

        try {
            log.info("--------------------------------------------------------------------------------");
            log.info("[2FA SMS GATEWAY] Bắt đầu gửi SMS OTP 2FA...");
            log.info("   -> Tài khoản:        {}", username);
            log.info("   -> SĐT nhận:         {} (chuẩn hóa E.164: {})", phone, e164Phone);
            log.info("   -> Mã OTP:           {}", code);
            log.info("   -> Hiệu lực:         {} giây (~{} phút)", ttlSeconds, minutes);
            log.info("   -> Gateway URL:      {}", gatewayUrl);
            log.info("--------------------------------------------------------------------------------");

            ResponseEntity<String> response = restClient.post()
                    .uri(gatewayUrl)
                    .header(HttpHeaders.AUTHORIZATION, basicAuthHeader)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(payload)
                    .retrieve()
                    .toEntity(String.class);

            log.info("================================================================================");
            log.info("[2FA SMS GATEWAY - GỬI THÀNH CÔNG!]");
            log.info("   -> Tài khoản:        {}", username);
            log.info("   -> SĐT nhận:         {} (E.164: {})", phone, e164Phone);
            log.info("   -> HTTP Status:      {}", response.getStatusCode());
            log.info("   -> Gateway Response: {}", response.getBody());
            log.info("================================================================================");
        } catch (RestClientResponseException ex) {
            log.error("================================================================================");
            log.error("[2FA SMS GATEWAY - GỬI THẤT BẠI - HTTP ERROR!]");
            log.error("   -> Tài khoản:   {}", username);
            log.error("   -> SĐT nhận:    {} (E.164: {})", phone, e164Phone);
            log.error("   -> HTTP Status: {} {}", ex.getStatusCode().value(), ex.getStatusText());
            log.error("   -> Error Body:  {}", ex.getResponseBodyAsString());
            log.error("================================================================================");
        } catch (ResourceAccessException ex) {
            log.error("================================================================================");
            log.error("[2FA SMS GATEWAY - GỬI THẤT BẠI - LỖI KẾT NỐI/TIMEOUT!]");
            log.error("   -> Tài khoản:   {}", username);
            log.error("   -> SĐT nhận:    {}", phone);
            log.error("   -> Gateway URL: {}", gatewayUrl);
            log.error("   -> Chi tiết:    {}", ex.getMessage());
            log.error("================================================================================");
        } catch (Exception ex) {
            log.error("================================================================================");
            log.error("[2FA SMS GATEWAY - GỬI THẤT BẠI - LỖI KHÔNG XÁC ĐỊNH!]");
            log.error("   -> Tài khoản: {}", username);
            log.error("   -> SĐT nhận:  {}", phone);
            log.error("   -> Chi tiết:  {}", ex.getMessage(), ex);
            log.error("================================================================================");
        }
    }

    /**
     * Converts a local Vietnamese phone number into E.164 international standard (+84...).
     */
    public String formatToE164(String phone) {
        if (phone == null || phone.isBlank()) {
            return "";
        }
        String cleaned = phone.trim().replaceAll("\\s+", "");
        if (cleaned.startsWith("+84")) {
            return cleaned;
        }
        if (cleaned.startsWith("0")) {
            return "+84" + cleaned.substring(1);
        }
        if (cleaned.startsWith("84")) {
            return "+" + cleaned;
        }
        return cleaned;
    }
}
