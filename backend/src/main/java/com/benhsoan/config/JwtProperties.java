package com.benhsoan.config;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

@Validated
@ConfigurationProperties(prefix = "app.jwt")
public record JwtProperties(
        @NotBlank(message = "JWT secret must not be blank")
        @Size(min = 32, message = "JWT secret must be at least 32 characters long")
        String secret,
        long expirationMs
) {
    public JwtProperties {
        if (expirationMs <= 0) {
            expirationMs = 900_000L;
        }
    }
}
