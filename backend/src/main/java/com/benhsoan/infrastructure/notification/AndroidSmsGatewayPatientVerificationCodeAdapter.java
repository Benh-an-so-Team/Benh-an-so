package com.benhsoan.infrastructure.notification;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Base64;
import java.util.List;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Primary;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import com.benhsoan.port.outbound.notification.PatientVerificationCodePort;

import lombok.extern.slf4j.Slf4j;

/**
 * Adapter integrating with Android SMS Gateway (capcom6 / sms-gate.app)
 * for patient portal password recovery (NCL-14-CN-006).
 */
@Slf4j
@Component
@Primary
@ConditionalOnProperty(name = "app.sms.gateway.provider", havingValue = "android")
public class AndroidSmsGatewayPatientVerificationCodeAdapter implements PatientVerificationCodePort {

    private final RestClient restClient;
    private final String gatewayUrl;
    private final String basicAuthHeader;

    @Autowired
    public AndroidSmsGatewayPatientVerificationCodeAdapter(
            @Value("${app.sms.gateway.android.url:https://api.sms-gate.app/3rdparty/v1/message}") String gatewayUrl,
            @Value("${app.sms.gateway.android.username:LRIMS3}") String username,
            @Value("${app.sms.gateway.android.password:050jm5oro3ihgy}") String password,
            @Value("${app.sms.gateway.android.connect-timeout-ms:5000}") int connectTimeoutMs,
            @Value("${app.sms.gateway.android.read-timeout-ms:10000}") int readTimeoutMs
    ) {
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
    AndroidSmsGatewayPatientVerificationCodeAdapter(RestClient restClient, String gatewayUrl, String username, String password) {
        this.restClient = restClient;
        this.gatewayUrl = gatewayUrl;
        String credentials = (username != null ? username : "") + ":" + (password != null ? password : "");
        this.basicAuthHeader = "Basic " + Base64.getEncoder().encodeToString(credentials.getBytes(StandardCharsets.UTF_8));
    }

    @Override
    public void sendVerificationCode(String phone, String code, long ttlSeconds) {
        String e164Phone = formatToE164(phone);
        long minutes = Math.max(1, ttlSeconds / 60);

        String message = String.format(
                "[BENH AN SO] Ma xac thuc khoi phuc mat khau cua ban la: %s. Ma co hieu luc trong %d phut.",
                code, minutes
        );

        Map<String, Object> payload = Map.of(
                "phoneNumbers", List.of(e164Phone),
                "message", message
        );

        try {
            log.info("[SMS GATEWAY] Bắt đầu gửi SMS OTP tới SĐT: {} (chuẩn hóa E.164: {}) qua Gateway: {}", phone, e164Phone, gatewayUrl);

            org.springframework.http.ResponseEntity<String> response = restClient.post()
                    .uri(gatewayUrl)
                    .header(HttpHeaders.AUTHORIZATION, basicAuthHeader)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(payload)
                    .retrieve()
                    .toEntity(String.class);

            log.info("[SMS GATEWAY THÀNH CÔNG] Đã gửi SMS OTP thành công tới SĐT: {} (E.164: {}) | HTTP Status: {} | Gateway Response: {}",
                    phone, e164Phone, response.getStatusCode(), response.getBody());
        } catch (org.springframework.web.client.RestClientResponseException ex) {
            log.error("[SMS GATEWAY THẤT BẠI] Gateway trả về mã lỗi HTTP khi gửi tới SĐT: {} (E.164: {}) | HTTP Status: {} {} | Error Response: {}",
                    phone, e164Phone, ex.getStatusCode().value(), ex.getStatusText(), ex.getResponseBodyAsString(), ex);
        } catch (org.springframework.web.client.ResourceAccessException ex) {
            log.error("[SMS GATEWAY THẤT BẠI] Lỗi kết nối / timeout tới SMS Gateway ({}) khi gửi tới SĐT: {}: {}",
                    gatewayUrl, phone, ex.getMessage(), ex);
        } catch (Exception ex) {
            log.error("[SMS GATEWAY THẤT BẠI] Lỗi không xác định khi gửi SMS OTP tới SĐT: {}: {}",
                    phone, ex.getMessage(), ex);
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

    private String maskPhone(String phone) {
        if (phone == null || phone.length() < 7) {
            return "[REDACTED]";
        }
        return phone.substring(0, 3) + "****" + phone.substring(phone.length() - 3);
    }
}
