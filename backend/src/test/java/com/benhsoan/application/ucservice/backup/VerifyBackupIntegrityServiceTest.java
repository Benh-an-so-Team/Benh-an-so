package com.benhsoan.application.ucservice.backup;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.access.AccessDeniedException;

import com.benhsoan.domain.auditlog.enums.ActionType;
import com.benhsoan.domain.backup.BackupRecord;
import com.benhsoan.domain.backup.BackupScheduleConfiguration;
import com.benhsoan.domain.backup.BackupVerificationReport;
import com.benhsoan.domain.backup.enums.BackupStatus;
import com.benhsoan.domain.backup.enums.BackupType;
import com.benhsoan.domain.backup.exception.BackupNotFoundException;
import com.benhsoan.port.outbound.backup.DatabaseBackupStoragePort;
import com.benhsoan.port.outbound.repository.backup.BackupRecordRepository;
import com.benhsoan.port.outbound.repository.backup.BackupScheduleRepositoryPort;
import com.benhsoan.port.outbound.security.CurrentUserPort;
import com.benhsoan.port.outbound.time.ClockPort;

class VerifyBackupIntegrityServiceTest {

    private static final UUID ADMIN_ID = UUID.randomUUID();
    private static final Instant NOW = Instant.parse("2026-09-24T08:00:00Z");

    private final BackupRecordRepository backupRecordRepository = mock(BackupRecordRepository.class);
    private final DatabaseBackupStoragePort storagePort = mock(DatabaseBackupStoragePort.class);
    private final BackupScheduleRepositoryPort scheduleRepository = mock(BackupScheduleRepositoryPort.class);
    private final CurrentUserPort currentUserPort = mock(CurrentUserPort.class);
    private final ClockPort clockPort = mock(ClockPort.class);
    private final BackupAuditLogWriter auditLogWriter = mock(BackupAuditLogWriter.class);
    private final BackupAuthorizer authorizer = new BackupAuthorizer(currentUserPort);

    private VerifyBackupIntegrityService service;
    private BackupRecord successfulRecord;

    @BeforeEach
    void setUp() {
        service = new VerifyBackupIntegrityService(
                backupRecordRepository,
                storagePort,
                scheduleRepository,
                authorizer,
                currentUserPort,
                clockPort,
                auditLogWriter);

        when(currentUserPort.hasRole("ADMIN")).thenReturn(true);
        when(currentUserPort.getCurrentUserId()).thenReturn(ADMIN_ID);
        when(clockPort.now()).thenReturn(NOW);

        successfulRecord = BackupRecord.create("BKP-20260924-0001", BackupType.FULL, "Manual", ADMIN_ID, NOW);
        successfulRecord.markSuccess("BKP-20260924-0001.json", 1024L);
    }

    @Test
    void verifyLatestRejectsNonAdmin() {
        when(currentUserPort.hasRole("ADMIN")).thenReturn(false);

        assertThrows(AccessDeniedException.class, () -> service.verifyLatest());
    }

    @Test
    void verifyLatestSucceedsWhenLatestBackupValid() {
        // NCL-09-CN-009-TC-03
        when(backupRecordRepository.findLatestByStatus(BackupStatus.SUCCESS)).thenReturn(Optional.of(successfulRecord));

        BackupVerificationReport report = BackupVerificationReport.success(
                successfulRecord.getId(),
                successfulRecord.getBackupCode(),
                successfulRecord.getFileName(),
                28,
                150,
                "87",
                NOW);
        when(storagePort.verifySnapshot(successfulRecord.getId(), successfulRecord.getBackupCode(),
                successfulRecord.getFileName()))
                .thenReturn(report);

        BackupScheduleConfiguration config = BackupScheduleConfiguration.createDefault(ADMIN_ID, NOW);
        when(scheduleRepository.find()).thenReturn(Optional.of(config));

        BackupVerificationReport result = service.verifyLatest();

        assertNotNull(result);
        assertTrue(result.valid());
        assertTrue(result.readable());
        assertTrue(result.dataIntact());
        assertEquals(28, result.tableCount());
        assertEquals("Bản sao lưu đọc được và đủ dữ liệu.", result.message());

        verify(storagePort).verifySnapshot(successfulRecord.getId(), successfulRecord.getBackupCode(),
                successfulRecord.getFileName());
        verify(scheduleRepository).save(config);
        verify(auditLogWriter).write(eq(ADMIN_ID), eq(ActionType.READ), eq(successfulRecord.getId()), any());
    }

    @Test
    void verifyLatestThrowsWhenNoSuccessfulBackupFound() {
        when(backupRecordRepository.findLatestByStatus(BackupStatus.SUCCESS)).thenReturn(Optional.empty());

        assertThrows(BackupNotFoundException.class, () -> service.verifyLatest());
    }

    @Test
    void verifyByIdSucceedsAndDoesNotMutateScheduleConfig() {
        UUID id = successfulRecord.getId();
        when(backupRecordRepository.findById(id)).thenReturn(Optional.of(successfulRecord));

        BackupVerificationReport report = BackupVerificationReport.success(
                successfulRecord.getId(),
                successfulRecord.getBackupCode(),
                successfulRecord.getFileName(),
                28,
                150,
                "87",
                NOW);
        when(storagePort.verifySnapshot(successfulRecord.getId(), successfulRecord.getBackupCode(),
                successfulRecord.getFileName()))
                .thenReturn(report);

        BackupVerificationReport result = service.verifyById(id);

        assertNotNull(result);
        assertTrue(result.valid());
        // Verify scheduleRepository.save is NEVER called for historical verifyById
        // (Finding 4)
        verify(scheduleRepository, org.mockito.Mockito.never()).save(any());
    }

    @Test
    void verifyByIdWhenFileNameIsNullReturnsFailureReportWithoutThrowingNpe() {
        BackupRecord recordWithoutFile = BackupRecord.create("BKP-NOFILE", BackupType.FULL, "Manual", ADMIN_ID, NOW);
        UUID id = recordWithoutFile.getId();
        when(backupRecordRepository.findById(id)).thenReturn(Optional.of(recordWithoutFile));

        BackupVerificationReport result = service.verifyById(id);

        assertNotNull(result);
        org.junit.jupiter.api.Assertions.assertFalse(result.valid());
        org.junit.jupiter.api.Assertions.assertFalse(result.readable());
        assertEquals("Bản sao lưu đang được xử lý và chưa hoàn tất tệp dữ liệu.", result.message());
        verify(storagePort, org.mockito.Mockito.never()).verifySnapshot(any(), any(), any());
    }

    @Test
    void verifyByIdThrowsWhenRecordNotFound() {
        UUID randomId = UUID.randomUUID();
        when(backupRecordRepository.findById(randomId)).thenReturn(Optional.empty());

        assertThrows(BackupNotFoundException.class, () -> service.verifyById(randomId));
    }
}
