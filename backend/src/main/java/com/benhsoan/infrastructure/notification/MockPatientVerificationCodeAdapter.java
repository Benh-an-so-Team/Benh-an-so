package com.benhsoan.infrastructure.notification;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.stereotype.Component;

import com.benhsoan.port.outbound.notification.PatientVerificationCodePort;

import lombok.extern.slf4j.Slf4j;

/**
 * Mock adapter simulating SMS verification code delivery (NCL-14-CN-006 TC-01).
 */
@Slf4j
@Component
public class MockPatientVerificationCodeAdapter implements PatientVerificationCodePort {

    private final Map<String, String> lastSentCodes = new ConcurrentHashMap<>();

    @Override
    public void sendVerificationCode(String phone, String code, long ttlSeconds) {
        lastSentCodes.put(phone, code);
        log.info("[MOCK SMS] Gửi mã xác thực giả lập tới SĐT: {} | Mã OTP: {} (hiệu lực {}s)",
                phone, code, ttlSeconds);
    }

    private String maskPhone(String phone) {
        if (phone == null || phone.length() < 7) {
            return "[REDACTED]";
        }
        return phone.substring(0, 3) + "****" + phone.substring(phone.length() - 3);
    }

    public String getLastSentCode(String phone) {
        return lastSentCodes.get(phone);
    }

    public void clear() {
        lastSentCodes.clear();
    }
}
