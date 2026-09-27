package com.benhsoan.application.ucservice.backup;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import com.benhsoan.domain.auditlog.enums.ActionType;
import com.benhsoan.domain.backup.BackupRecord;
import com.benhsoan.domain.backup.BackupScheduleConfiguration;
import com.benhsoan.domain.backup.enums.BackupStatus;
import com.benhsoan.domain.backup.enums.BackupType;
import com.benhsoan.domain.backup.exception.BackupExecutionException;
import com.benhsoan.port.dto.result.BackupResult;
import com.benhsoan.port.outbound.backup.BackupSnapshot;
import com.benhsoan.port.outbound.repository.backup.BackupRecordRepository;
import com.benhsoan.port.outbound.repository.backup.BackupScheduleRepositoryPort;
import com.benhsoan.port.outbound.time.ClockPort;

class ScheduledBackupExecutionServiceTest {

    private static final UUID SYSTEM_USER_ID = UUID.fromString("00000000-0000-0000-0000-000000000000");
    private static final Instant NOW = Instant.parse("2026-09-24T02:05:00Z"); // 09:05:00 in Vietnam (+7)

    private final BackupScheduleRepositoryPort scheduleRepository = mock(BackupScheduleRepositoryPort.class);
    private final BackupRecordRepository backupRecordRepository = mock(BackupRecordRepository.class);
    private final BackupRecordLifecycleService lifecycleService = mock(BackupRecordLifecycleService.class);
    private final BackupSnapshotExportService snapshotExportService = mock(BackupSnapshotExportService.class);
    private final BackupCodeGenerator backupCodeGenerator = mock(BackupCodeGenerator.class);
    private final BackupAuditLogWriter auditLogWriter = mock(BackupAuditLogWriter.class);
    private final BackupResultMapper resultMapper = new BackupResultMapper();
    private final ClockPort clockPort = mock(ClockPort.class);

    private ScheduledBackupExecutionService service;
    private BackupRecord createdRecord;

    @BeforeEach
    void setUp() {
        service = new ScheduledBackupExecutionService(
                scheduleRepository,
                backupRecordRepository,
                lifecycleService,
                snapshotExportService,
                backupCodeGenerator,
                auditLogWriter,
                resultMapper,
                clockPort);

        when(clockPort.now()).thenReturn(NOW);
        when(backupCodeGenerator.generate()).thenReturn("BKP-20260924-0001");
        when(backupRecordRepository.hasActiveInProgressBackup(any())).thenReturn(false);

        createdRecord = BackupRecord.create("BKP-20260924-0001", BackupType.SCHEDULED, "desc", SYSTEM_USER_ID, NOW);
        when(lifecycleService.createInProgress(any(), any(), any(), any(), any())).thenReturn(createdRecord);
    }

    @Test
    void executeNowSucceedsAndUpdatesConfigAndAudits() {
        // NCL-09-CN-009-TC-01
        BackupScheduleConfiguration config = BackupScheduleConfiguration.createDefault(SYSTEM_USER_ID, NOW);
        config.updateSchedule(true, "09:00", SYSTEM_USER_ID, NOW);
        when(scheduleRepository.find()).thenReturn(Optional.of(config));

        BackupSnapshot snapshot = new BackupSnapshot("BKP-20260924-0001.json", new byte[] { 1, 2, 3 });
        when(snapshotExportService.export("BKP-20260924-0001")).thenReturn(snapshot);

        createdRecord.markSuccess("BKP-20260924-0001.json", 3L);
        when(lifecycleService.markSuccess(createdRecord.getId(), snapshot)).thenReturn(createdRecord);

        BackupResult result = service.executeNow();

        assertNotNull(result);
        assertEquals(BackupStatus.SUCCESS, result.status());
        assertEquals(BackupType.SCHEDULED, result.backupType());
        assertEquals("BKP-20260924-0001.json", result.fileName());

        verify(lifecycleService).markSuccess(createdRecord.getId(), snapshot);
        verify(scheduleRepository).save(config);
        assertEquals(BackupStatus.SUCCESS, config.getLastStatus());
        assertFalse(config.isAlertActive());

        verify(auditLogWriter).write(eq(SYSTEM_USER_ID), eq(ActionType.BACKUP), eq(createdRecord.getId()), any());
    }

    @Test
    void executeNowFailsWhenExportThrowsAndActivatesAlert() {
        // NCL-09-CN-009-TC-02
        BackupScheduleConfiguration config = BackupScheduleConfiguration.createDefault(SYSTEM_USER_ID, NOW);
        config.updateSchedule(true, "09:00", SYSTEM_USER_ID, NOW);
        when(scheduleRepository.find()).thenReturn(Optional.of(config));

        when(snapshotExportService.export("BKP-20260924-0001"))
                .thenThrow(new RuntimeException("Disk full / IO error"));

        BackupExecutionException ex = assertThrows(BackupExecutionException.class, () -> service.executeNow());
        assertTrue(ex.getMessage().contains("Disk full / IO error"));

        verify(lifecycleService).markFailed(createdRecord.getId(), "Disk full / IO error");
        verify(scheduleRepository).save(config);
        assertEquals(BackupStatus.FAILED, config.getLastStatus());
        assertEquals("Disk full / IO error", config.getLastFailureReason());
        assertTrue(config.isAlertActive());

        verify(auditLogWriter).write(eq(SYSTEM_USER_ID), eq(ActionType.BACKUP), eq(createdRecord.getId()), any());
    }

    @Test
    void executeNowRejectsWhenAnotherBackupIsInProgress() {
        when(backupRecordRepository.hasActiveInProgressBackup(any())).thenReturn(true);

        assertThrows(BackupExecutionException.class, () -> service.executeNow());
        verify(lifecycleService, never()).createInProgress(any(), any(), any(), any(), any());
    }

    @Test
    void executeNowQueriesWithSixtyMinuteStaleThreshold() {
        BackupScheduleConfiguration config = BackupScheduleConfiguration.createDefault(SYSTEM_USER_ID, NOW);
        when(scheduleRepository.find()).thenReturn(Optional.of(config));
        BackupSnapshot snapshot = new BackupSnapshot("BKP-20260924-0001.json", new byte[] { 1 });
        when(snapshotExportService.export("BKP-20260924-0001")).thenReturn(snapshot);
        when(lifecycleService.markSuccess(any(), any())).thenReturn(createdRecord);

        service.executeNow();

        Instant expectedCutoff = NOW.minus(java.time.Duration.ofMinutes(60));
        verify(backupRecordRepository).hasActiveInProgressBackup(expectedCutoff);
    }

    @Test
    void executeIfDueDoesNothingWhenNotDue() {
        BackupScheduleConfiguration config = BackupScheduleConfiguration.createDefault(SYSTEM_USER_ID, NOW);
        // Set to 15:00 in Vietnam (+7), but current time is 09:05
        config.updateSchedule(true, "15:00", SYSTEM_USER_ID, NOW);
        when(scheduleRepository.find()).thenReturn(Optional.of(config));

        service.executeIfDue();

        verify(lifecycleService, never()).createInProgress(any(), any(), any(), any(), any());
    }

    @Test
    void executeIfDueTriggersExecutionWhenDue() {
        BackupScheduleConfiguration config = BackupScheduleConfiguration.createDefault(SYSTEM_USER_ID, NOW);
        // Set to 09:00 in Vietnam (+7), current time is 09:05
        config.updateSchedule(true, "09:00", SYSTEM_USER_ID, NOW);
        when(scheduleRepository.find()).thenReturn(Optional.of(config));

        BackupSnapshot snapshot = new BackupSnapshot("BKP-20260924-0001.json", new byte[] { 1 });
        when(snapshotExportService.export("BKP-20260924-0001")).thenReturn(snapshot);
        when(lifecycleService.markSuccess(any(), any())).thenReturn(createdRecord);

        service.executeIfDue();

        verify(lifecycleService).createInProgress(any(), any(), any(), any(), any());
        verify(snapshotExportService).export("BKP-20260924-0001");
    }
}
