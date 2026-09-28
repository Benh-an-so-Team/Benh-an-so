package com.benhsoan.config;

import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app.cors")
public record CorsProperties(
        List<String> allowedOriginPatterns
) {
    public CorsProperties {
        allowedOriginPatterns = (allowedOriginPatterns == null || allowedOriginPatterns.isEmpty())
                ? List.of("http://localhost:3000", "http://localhost:5173", "http://localhost:4200", "https://*.vercel.app")
                : List.copyOf(allowedOriginPatterns);
    }
}
