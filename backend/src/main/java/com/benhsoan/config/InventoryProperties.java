package com.benhsoan.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * Cấu hình nghiệp vụ quản lý kho dược / vật tư.
 */
@ConfigurationProperties(prefix = "inventory")
public record InventoryProperties(
        @DefaultValue("30") int expiryAlertDays
) {
}
