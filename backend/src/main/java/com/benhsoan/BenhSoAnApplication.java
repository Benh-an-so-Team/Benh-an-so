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
        loadDotenv();
        SpringApplication.run(BenhSoAnApplication.class, args);
    }

    private static void loadDotenv() {
        java.nio.file.Path[] potentialPaths = {
                java.nio.file.Path.of(".env"),
                java.nio.file.Path.of("backend/.env"),
                java.nio.file.Path.of("../.env")
        };
        for (java.nio.file.Path path : potentialPaths) {
            if (java.nio.file.Files.exists(path) && java.nio.file.Files.isRegularFile(path)) {
                try (var lines = java.nio.file.Files.lines(path)) {
                    lines.map(String::trim)
                            .filter(line -> !line.isEmpty() && !line.startsWith("#"))
                            .forEach(line -> {
                                int eqIdx = line.indexOf('=');
                                if (eqIdx > 0) {
                                    String key = line.substring(0, eqIdx).trim();
                                    String value = line.substring(eqIdx + 1).trim();
                                    if ((value.startsWith("\"") && value.endsWith("\""))
                                            || (value.startsWith("'") && value.endsWith("'"))) {
                                        value = value.substring(1, value.length() - 1);
                                    }
                                    if (System.getProperty(key) == null && System.getenv(key) == null) {
                                        System.setProperty(key, value);
                                    }
                                }
                            });
                    System.out.println(">>> [DOTENV] Loaded environment configuration from: " + path.toAbsolutePath());
                    break;
                } catch (Exception ex) {
                    System.err.println(">>> [DOTENV] Failed to load .env from " + path + ": " + ex.getMessage());
                }
            }
        }
    }
}
