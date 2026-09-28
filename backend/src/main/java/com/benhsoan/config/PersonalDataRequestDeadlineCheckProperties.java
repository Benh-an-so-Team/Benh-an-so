package com.benhsoan.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * NCL-15-CN-006 TC-02: configures the periodic review of personal-data-request
 * processing deadlines. The upcoming window is intentionally configurable so an
 * operator can tune how far ahead the system warns about approaching deadlines.
 */
@ConfigurationProperties(prefix = "personal-data-request.deadline-check")
public record PersonalDataRequestDeadlineCheckProperties(
        boolean enabled,
        long scanIntervalMs,
        long upcomingWindowHours
) {
}
