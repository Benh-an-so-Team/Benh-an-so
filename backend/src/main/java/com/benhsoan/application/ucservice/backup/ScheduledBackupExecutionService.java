package com.benhsoan.application.ucservice.backup;

import java.time.Instant;
import java.time.ZoneId;
import java.util.Optional;
import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import com.benhsoan.domain.auditlog.enums.ActionType;
import com.benhsoan.domain.backup.BackupRecord;
import com.benhsoan.domain.backup.BackupScheduleConfiguration;
import com.benhsoan.domain.backup.enums.BackupType;
import com.benhsoan.domain.backup.exception.BackupExecutionException;
import com.benhsoan.port.dto.result.BackupResult;
import com.benhsoan.port.inbound.backup.ExecuteScheduledBackupUseCase;
import com.benhsoan.port.outbound.backup.BackupSnapshot;
import com.benhsoan.port.outbound.repository.backup.BackupRecordRepository;
import com.benhsoan.port.outbound.repository.backup.BackupScheduleRepositoryPort;
import com.benhsoan.port.outbound.time.ClockPort;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class ScheduledBackupExecutionService implements ExecuteScheduledBackupUseCase {

    private static final Logger log = LoggerFactory.getLogger(ScheduledBackupExecutionService.class);
    private static final UUID SYSTEM_USER_ID = UUID.fromString("00000000-0000-0000-0000-000000000000");
    private static final ZoneId DEFAULT_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");

    private final BackupScheduleRepositoryPort scheduleRepository;
    private final BackupRecordRepository backupRecordRepository;
    private final BackupRecordLifecycleService lifecycleService;
    private final BackupSnapshotExportService snapshotExportService;
    private final BackupCodeGenerator backupCodeGenerator;
    private final BackupAuditLogWriter auditLogWriter;
    private final BackupResultMapper resultMapper;
    private final ClockPort clockPort;

    @Override
    public void executeIfDue() {
        Optional<BackupScheduleConfiguration> configOpt = scheduleRepository.find();
        if (configOpt.isEmpty()) {
            return;
        }

        BackupScheduleConfiguration config = configOpt.get();
        Instant now = clockPort.now();
        if (!config.isDue(now, DEFAULT_ZONE)) {
            return;
        }

        log.info("Backup schedule is due at {}. Triggering automated backup execution...", now);
        try {
            executeNow();
            log.info("Automated backup executed successfully at {}", now);
        } catch (Exception ex) {
            log.error("Automated backup failed at {}: {}", now, ex.getMessage(), ex);
        }
    }

    @Override
    public BackupResult executeNow() {
        Instant now = clockPort.now();

        // Concurrency Guard: check if any recent backup is already IN_PROGRESS (within
        // 60m threshold)
        Instant inProgressThreshold = now.minus(60, java.time.temporal.ChronoUnit.MINUTES);
        boolean hasInProgress = backupRecordRepository.hasActiveInProgressBackup(inProgressThreshold);
        if (hasInProgress) {
            log.warn("Another backup operation is currently in progress (<60m). Skipping scheduled execution.");
            throw new BackupExecutionException("Another backup operation is currently in progress.");
        }

        String backupCode = backupCodeGenerator.generate();
        BackupRecord record = lifecycleService.createInProgress(
                backupCode,
                BackupType.SCHEDULED,
                "Sao lưu tự động định kỳ theo lịch",
                SYSTEM_USER_ID,
                now);

        BackupScheduleConfiguration config = scheduleRepository.find()
                .orElseGet(() -> BackupScheduleConfiguration.createDefault(SYSTEM_USER_ID, now));

        try {
            BackupSnapshot snapshot = snapshotExportService.export(backupCode);
            record = lifecycleService.markSuccess(record.getId(), snapshot);

            config.recordSuccess(now);
            scheduleRepository.save(config);

            auditLogWriter.write(SYSTEM_USER_ID, ActionType.BACKUP, record.getId(), toDetail(record));
            return resultMapper.toResult(record);
        } catch (RuntimeException ex) {
            lifecycleService.markFailed(record.getId(), ex.getMessage());

            config.recordFailure(now, ex.getMessage());
            scheduleRepository.save(config);

            String safeError = ex.getMessage() != null
                    ? ex.getMessage().replace("\"", "\\\"").replace("\n", " ").replace("\r", "")
                    : "Unknown error";
            String failureDetail = """
                    {"backupCode":"%s","status":"FAILED","error":"%s"}
                    """.formatted(backupCode, safeError).trim();
            auditLogWriter.write(SYSTEM_USER_ID, ActionType.BACKUP, record.getId(), failureDetail);

            throw new BackupExecutionException("Automated backup snapshot failed: " + ex.getMessage());
        }
    }

    private String toDetail(BackupRecord record) {
        return """
                {
                "backupCode":"%s",
                "fileName":"%s",
                "fileSize":%d,
                "backupType":"%s"
                }
                """.formatted(
                record.getBackupCode(),
                record.getFileName(),
                record.getFileSize(),
                record.getBackupType()).trim();
    }
}
