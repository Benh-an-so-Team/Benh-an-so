package com.benhsoan.infrastructure.notification;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.stereotype.Component;

import com.benhsoan.port.outbound.notification.TwoFactorCodeDeliveryPort;

import lombok.extern.slf4j.Slf4j;

@Slf4j
@Component
public class MockTwoFactorCodeDeliveryAdapter implements TwoFactorCodeDeliveryPort {

    private final Map<String, String> lastSentCodes = new ConcurrentHashMap<>();

    @Override
    public void sendVerificationCode(String username, String code, long ttlSeconds) {
        lastSentCodes.put(username, code);
        log.warn("===> [MOCK 2FA - CHỈ DÙNG CHO MÔI TRƯỜNG DEV/TEST] User: {} | " +
                "Mã xác thực: [ {} ] | Hiệu lực: {}s | " +
                "⚠️ CẢNH BÁO: Dòng log này lộ mã OTP dạng plaintext — BẮT BUỘC " +
                "phải gỡ bỏ hoặc chuyển sang cơ chế gửi SMS/Email thật trước khi " +
                "triển khai cho người dùng thật <===",
                username, code, ttlSeconds);
    }

    public String getLastSentCode(String username) {
        return lastSentCodes.get(username);
    }

    public void clear() {
        lastSentCodes.clear();
    }
}
