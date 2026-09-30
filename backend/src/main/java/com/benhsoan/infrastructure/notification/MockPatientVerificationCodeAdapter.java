package com.benhsoan.infrastructure.notification;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.stereotype.Component;

import com.benhsoan.port.outbound.notification.PatientVerificationCodePort;

import lombok.extern.slf4j.Slf4j;

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

    public String getLastSentCode(String phone) {
        return lastSentCodes.get(phone);
    }

    public void clear() {
        lastSentCodes.clear();
    }
}
