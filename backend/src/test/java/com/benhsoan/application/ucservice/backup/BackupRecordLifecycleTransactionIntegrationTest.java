package com.benhsoan.application.ucservice.backup;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

import javax.sql.DataSource;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.test.context.junit.jupiter.SpringJUnitConfig;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.EnableTransactionManagement;
import org.springframework.transaction.support.TransactionTemplate;
import org.testcontainers.containers.MySQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import com.benhsoan.domain.backup.exception.BackupExecutionException;
import com.benhsoan.domain.backup.BackupRecord;
import com.benhsoan.domain.backup.enums.BackupType;
import com.benhsoan.port.dto.command.backup.CreateBackupCommand;
import com.benhsoan.port.outbound.backup.DatabaseBackupStoragePort;
import com.benhsoan.port.outbound.security.CurrentUserPort;
import com.benhsoan.port.outbound.time.ClockPort;
import com.benhsoan.port.outbound.repository.backup.BackupRecordRepository;

import lombok.RequiredArgsConstructor;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@Testcontainers(disabledWithoutDocker = true)
@SpringJUnitConfig(BackupRecordLifecycleTransactionIntegrationTest.TransactionTestConfiguration.class)
class BackupRecordLifecycleTransactionIntegrationTest {

    @Container
    @SuppressWarnings("resource")
    static final MySQLContainer<?> MYSQL = new MySQLContainer<>("mysql:8.4")
            .withDatabaseName("backup_lifecycle_test")
            .withUsername("backup_test")
            .withPassword("backup_test");

    private final BackupRecordLifecycleService lifecycleService;
    private final BackupRecordRepository backupRecordRepository;
    private final JdbcTemplate jdbcTemplate;
    private final TransactionTemplate transactionTemplate;

    @Autowired
    BackupRecordLifecycleTransactionIntegrationTest(
            BackupRecordLifecycleService lifecycleService,
            BackupRecordRepository backupRecordRepository,
            JdbcTemplate jdbcTemplate,
            PlatformTransactionManager transactionManager
    ) {
        this.lifecycleService = lifecycleService;
        this.backupRecordRepository = backupRecordRepository;
        this.jdbcTemplate = jdbcTemplate;
        this.transactionTemplate = new TransactionTemplate(transactionManager);
    }

    @BeforeEach
    void setUp() {
        jdbcTemplate.execute("DROP TABLE IF EXISTS backup_records_test");
        jdbcTemplate.execute("""
                CREATE TABLE backup_records_test (
                    id VARCHAR(36) PRIMARY KEY,
                    backup_code VARCHAR(50) NULL,
                    status VARCHAR(30) NOT NULL
                ) ENGINE=InnoDB
                """);
    }

    @Test
    void persistsFailedStatusWhenOuterTransactionRollsBack() {
        UUID actorId = UUID.randomUUID();
        BackupRecord[] record = new BackupRecord[1];

        transactionTemplate.executeWithoutResult(status -> {
            record[0] = lifecycleService.createInProgress(
                    "BKP-20260814-0001", BackupType.FULL, null, actorId, Instant.now());
            lifecycleService.markFailed(record[0].getId());
            status.setRollbackOnly();
        });

        assertEquals("FAILED", jdbcTemplate.queryForObject(
                "SELECT status FROM backup_records_test WHERE id = ?", String.class, record[0].getId().toString()));
    }

    @Test
    void persistsFailedStatusWhenExportThrows() {
        CurrentUserPort currentUser = mock(CurrentUserPort.class);
        ClockPort clock = mock(ClockPort.class);
        BackupAuditLogWriter auditLogWriter = mock(BackupAuditLogWriter.class);
        when(currentUser.hasRole("ADMIN")).thenReturn(true);
        when(currentUser.getCurrentUserId()).thenReturn(UUID.randomUUID());
        when(clock.now()).thenReturn(Instant.parse("2026-08-15T00:00:00Z"));

        DatabaseBackupStoragePort failingStorage = new DatabaseBackupStoragePort() {
            @Override
            public com.benhsoan.port.outbound.backup.BackupSnapshot exportSnapshot(String backupCode) {
                throw new IllegalStateException("simulated export failure");
            }

            @Override
            public com.benhsoan.port.outbound.backup.BackupSnapshot loadSnapshot(String fileName) {
                throw new UnsupportedOperationException();
            }

            @Override
            public void restoreSnapshot(String fileName) {
                throw new UnsupportedOperationException();
            }

            @Override
            public com.benhsoan.domain.backup.BackupVerificationReport verifySnapshot(
                    UUID backupId, String backupCode, String fileName) {
                throw new UnsupportedOperationException();
            }
        };
        CreateBackupService service = new CreateBackupService(
                lifecycleService,
                new BackupSnapshotExportService(failingStorage),
                new BackupCodeGenerator(backupRecordRepository, clock),
                auditLogWriter,
                new BackupResultMapper(),
                new BackupAuthorizer(currentUser),
                currentUser,
                clock
        );

        assertThrows(BackupExecutionException.class,
                () -> service.create(new CreateBackupCommand(BackupType.FULL, "must fail")));

        assertEquals("FAILED", jdbcTemplate.queryForObject(
                "SELECT status FROM backup_records_test WHERE backup_code = ?", String.class, "BKP-20260815-0001"));
        verifyNoInteractions(auditLogWriter);
    }

    @Configuration
    @EnableTransactionManagement
    static class TransactionTestConfiguration {

        @Bean
        DataSource dataSource() {
            return new DriverManagerDataSource(MYSQL.getJdbcUrl(), MYSQL.getUsername(), MYSQL.getPassword());
        }

        @Bean
        JdbcTemplate jdbcTemplate(DataSource dataSource) {
            return new JdbcTemplate(dataSource);
        }

        @Bean
        PlatformTransactionManager transactionManager(DataSource dataSource) {
            return new DataSourceTransactionManager(dataSource);
        }

        @Bean
        BackupRecordRepository backupRecordRepository(JdbcTemplate jdbcTemplate) {
            return new TransactionalBackupRecordRepository(jdbcTemplate);
        }

        @Bean
        BackupRecordLifecycleService lifecycleService(BackupRecordRepository backupRecordRepository) {
            return new BackupRecordLifecycleService(backupRecordRepository);
        }
    }

    @RequiredArgsConstructor
    private static class TransactionalBackupRecordRepository implements BackupRecordRepository {

        private final JdbcTemplate jdbcTemplate;
        private final Map<UUID, BackupRecord> records = new ConcurrentHashMap<>();

        @Override
        public BackupRecord save(BackupRecord record) {
            records.put(record.getId(), record);
            jdbcTemplate.update("""
                    INSERT INTO backup_records_test (id, backup_code, status) VALUES (?, ?, ?)
                    ON DUPLICATE KEY UPDATE status = VALUES(status), backup_code = VALUES(backup_code)
                    """, record.getId().toString(), record.getBackupCode(), record.getStatus().name());
            return record;
        }

        @Override
        public Optional<BackupRecord> findById(UUID id) {
            return Optional.ofNullable(records.get(id));
        }

        @Override
        public List<BackupRecord> findAllByOrderByCreatedAtDesc() {
            return List.of();
        }

        @Override
        public Optional<BackupRecord> findTopByOrderByBackupCodeDesc() {
            return Optional.empty();
        }

        @Override
        public boolean hasActiveInProgressBackup(java.time.Instant createdAfter) {
            return records.values().stream()
                    .anyMatch(r -> r.getStatus() == com.benhsoan.domain.backup.enums.BackupStatus.IN_PROGRESS
                            && r.getCreatedAt().isAfter(createdAfter));
        }

        @Override
        public Optional<BackupRecord> findLatestByStatus(com.benhsoan.domain.backup.enums.BackupStatus status) {
            return records.values().stream()
                    .filter(r -> r.getStatus() == status)
                    .max(java.util.Comparator.comparing(BackupRecord::getCreatedAt));
        }
    }
}
