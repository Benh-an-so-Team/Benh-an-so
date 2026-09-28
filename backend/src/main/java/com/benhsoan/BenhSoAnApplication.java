package com.benhsoan;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.boot.context.properties.EnableConfigurationProperties;

import com.benhsoan.config.AnomalyDetectionProperties;
import com.benhsoan.config.AppointmentReminderProperties;
import com.benhsoan.config.ClinicalAttachmentProperties;
import com.benhsoan.config.CorsProperties;
import com.benhsoan.config.InventoryProperties;
import com.benhsoan.config.JwtProperties;
import com.benhsoan.config.LoginSecurityProperties;
import com.benhsoan.config.MockInterconnectionGatewayProperties;
import com.benhsoan.config.PersonalDataRequestDeadlineCheckProperties;
import com.benhsoan.config.TwoFactorChallengeCleanupProperties;
import com.benhsoan.infrastructure.storage.CloudinaryProperties;

@SpringBootApplication
@EnableAsync
@EnableScheduling
@EnableConfigurationProperties({AppointmentReminderProperties.class, ClinicalAttachmentProperties.class,
        CloudinaryProperties.class, MockInterconnectionGatewayProperties.class, AnomalyDetectionProperties.class,
        TwoFactorChallengeCleanupProperties.class, PersonalDataRequestDeadlineCheckProperties.class,
        JwtProperties.class, CorsProperties.class, LoginSecurityProperties.class, InventoryProperties.class})
public class BenhSoAnApplication {

    public static void main(String[] args) {
        SpringApplication.run(BenhSoAnApplication.class, args);
    }
}
