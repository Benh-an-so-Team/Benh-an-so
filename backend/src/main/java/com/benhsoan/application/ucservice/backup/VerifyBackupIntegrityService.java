package com.benhsoan.application.ucservice.backup;

import java.time.Instant;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.benhsoan.domain.auditlog.enums.ActionType;
import com.benhsoan.domain.backup.BackupRecord;
import com.benhsoan.domain.backup.BackupVerificationReport;
import com.benhsoan.domain.backup.enums.BackupStatus;
import com.benhsoan.domain.backup.exception.BackupNotFoundException;
import com.benhsoan.port.inbound.backup.VerifyBackupIntegrityUseCase;
import com.benhsoan.port.outbound.backup.DatabaseBackupStoragePort;
import com.benhsoan.port.outbound.repository.backup.BackupRecordRepository;
import com.benhsoan.port.outbound.repository.backup.BackupScheduleRepositoryPort;
import com.benhsoan.port.outbound.security.CurrentUserPort;
import com.benhsoan.port.outbound.time.ClockPort;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class VerifyBackupIntegrityService implements VerifyBackupIntegrityUseCase {

    private final BackupRecordRepository backupRecordRepository;
    private final DatabaseBackupStoragePort storagePort;
    private final BackupScheduleRepositoryPort scheduleRepository;
    private final BackupAuthorizer authorizer;
    private final CurrentUserPort currentUserPort;
    private final ClockPort clockPort;
    private final BackupAuditLogWriter auditLogWriter;

    @Override
    @Transactional
    public BackupVerificationReport verifyLatest() {
        authorizer.requireAdmin();

        BackupRecord latest = backupRecordRepository.findLatestByStatus(BackupStatus.SUCCESS)
                .orElseThrow(() -> new BackupNotFoundException(
                        "Không tìm thấy bản sao lưu thành công nào để kiểm tra tính toàn vẹn."));

        BackupVerificationReport report = verifyRecord(latest);

        Instant now = clockPort.now();
        scheduleRepository.find().ifPresent(config -> {
            config.recordVerification(now, report.valid() ? "VALID" : "INVALID");
            scheduleRepository.save(config);
        });

        return report;
    }

    @Override
    @Transactional
    public BackupVerificationReport verifyById(UUID backupId) {
        authorizer.requireAdmin();

        BackupRecord record = backupRecordRepository.findById(backupId)
                .orElseThrow(() -> new BackupNotFoundException(backupId));

        return verifyRecord(record);
    }

    private BackupVerificationReport verifyRecord(BackupRecord record) {
        UUID actorId = currentUserPort.getCurrentUserId();
        Instant now = clockPort.now();

        BackupVerificationReport report;
        if (record.getStatus() != BackupStatus.SUCCESS || record.getFileName() == null
                || record.getFileName().isBlank()) {
            String issueMsg = record.getStatus() == BackupStatus.IN_PROGRESS
                    ? "Bản sao lưu đang được xử lý và chưa hoàn tất tệp dữ liệu."
                    : "Bản sao lưu có trạng thái thất bại hoặc không có tệp dữ liệu để kiểm tra.";
            report = BackupVerificationReport.failure(
                    record.getId(),
                    record.getBackupCode(),
                    record.getFileName(),
                    false,
                    0,
                    0,
                    null,
                    now,
                    issueMsg,
                    java.util.List.of(issueMsg));
        } else {
            report = storagePort.verifySnapshot(
                    record.getId(),
                    record.getBackupCode(),
                    record.getFileName());
        }

        String detail = """
                {"backupCode":"%s","valid":%s,"readable":%s,"dataIntact":%s,"tableCount":%d,"rowCount":%d}
                """.formatted(
                record.getBackupCode(),
                report.valid(),
                report.readable(),
                report.dataIntact(),
                report.tableCount(),
                report.rowCount()).trim();
        auditLogWriter.write(actorId, ActionType.READ, record.getId(), detail);

        return report;
    }
}
