package com.benhsoan.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.ConstructorBinding;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * Configuration for the periodic cleanup of temporary two-factor challenge
 * records (NCL-01-CN-006). The cleanup removes only challenges that are no
 * longer usable (consumed or expired) and older than the retention window, so
 * it can never delete an active challenge.
 */
@ConfigurationProperties(prefix = "app.security.two-factor.challenge.cleanup")
public record TwoFactorChallengeCleanupProperties(
        boolean enabled,
        int retentionDays,
        String cron
) {
    @ConstructorBinding
    public TwoFactorChallengeCleanupProperties(
            @DefaultValue("true") boolean enabled,
            @DefaultValue("30") int retentionDays,
            @DefaultValue("0 0 3 * * *") String cron
    ) {
        this.enabled = enabled;
        this.retentionDays = retentionDays;
        this.cron = cron;
    }

    public TwoFactorChallengeCleanupProperties(int retentionDays) {
        this(true, retentionDays, "0 0 3 * * *");
    }
}