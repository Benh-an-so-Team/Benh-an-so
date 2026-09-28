package com.benhsoan.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app.security.login")
public record LoginSecurityProperties(
        int maxAttempts,
        long blockDurationMs
) {
    public LoginSecurityProperties {
        if (maxAttempts <= 0) {
            maxAttempts = 5;
        }
        if (blockDurationMs <= 0) {
            blockDurationMs = 900_000L;
        }
    }
}
