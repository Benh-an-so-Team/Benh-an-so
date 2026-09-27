package com.benhsoan.infrastructure.storage;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import org.mockito.ArgumentMatchers;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.ResultSetExtractor;

import com.benhsoan.config.BackupStorageConfiguration;
import com.benhsoan.domain.backup.BackupVerificationReport;
import com.fasterxml.jackson.databind.ObjectMapper;

class JsonDatabaseBackupStorageAdapterVerificationTest {

    private final JdbcTemplate jdbcTemplate = mock(JdbcTemplate.class);
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final BackupRestorePlan plan = new BackupStorageConfiguration().fullBackupRestorePlan();

    @TempDir
    Path tempDir;

    private JsonDatabaseBackupStorageAdapter adapter;

    @BeforeEach
    void setUp() {
        adapter = new JsonDatabaseBackupStorageAdapter(jdbcTemplate, objectMapper, plan, tempDir);
        when(jdbcTemplate.queryForObject(anyString(), eq(String.class))).thenReturn("87");
    }

    @Test
    void verifySnapshotReturnsFailureWhenFileNotFound() {
        UUID id = UUID.randomUUID();
        BackupVerificationReport report = adapter.verifySnapshot(id, "BKP-MISSING", "nonexistent.json");

        assertFalse(report.valid());
        assertFalse(report.readable());
        assertTrue(report.message().contains("Không thể đọc tệp sao lưu"));
    }

    @Test
    void verifySnapshotReturnsFailureWhenJsonCorrupted() throws IOException {
        Path file = tempDir.resolve("corrupted.json");
        Files.writeString(file, "{ this is not json }");

        UUID id = UUID.randomUUID();
        BackupVerificationReport report = adapter.verifySnapshot(id, "BKP-CORRUPT", "corrupted.json");

        assertFalse(report.valid());
        assertTrue(report.readable());
        assertTrue(report.message().contains("không đúng định dạng JSON"));
    }

    @Test
    void verifySnapshotReturnsSuccessWhenSnapshotMatchesSchemaAndTables() throws IOException {
        String fileName = "valid.json";
        Path file = tempDir.resolve(fileName);

        List<String> tables = plan.snapshotTables();
        JsonDatabaseBackupStorageAdapter.BackupManifest manifest =
                new JsonDatabaseBackupStorageAdapter.BackupManifest(1, tables, Instant.now().toString(), "87");

        List<JsonDatabaseBackupStorageAdapter.TableSnapshot> data = tables.stream()
                .map(t -> new JsonDatabaseBackupStorageAdapter.TableSnapshot(
                        t,
                        List.of(new JsonDatabaseBackupStorageAdapter.ColumnMeta("id", java.sql.Types.BINARY)),
                        List.of(List.of("dummy"))
                ))
                .toList();

        byte[] json = objectMapper.writeValueAsBytes(
                new JsonDatabaseBackupStorageAdapter.BackupDocument(manifest, data));
        Files.write(file, json);

        // Mock database column metadata to match "id" -> Types.BINARY
        when(jdbcTemplate.query(anyString(), ArgumentMatchers.<ResultSetExtractor<Map<String, Integer>>>any()))
                .thenReturn(Map.of("id", java.sql.Types.BINARY));

        UUID id = UUID.randomUUID();
        BackupVerificationReport report = adapter.verifySnapshot(id, "BKP-VALID", fileName);

        assertTrue(report.valid());
        assertTrue(report.readable());
        assertTrue(report.dataIntact());
        assertEquals(tables.size(), report.tableCount());
        assertEquals(tables.size(), report.rowCount());
        assertEquals("Bản sao lưu đọc được và đủ dữ liệu.", report.message());
        assertTrue(report.issues().isEmpty());
    }

    @Test
    void verifySnapshotReturnsFailureWhenSchemaVersionMismatches() throws IOException {
        String fileName = "mismatched.json";
        Path file = tempDir.resolve(fileName);

        List<String> tables = plan.snapshotTables();
        JsonDatabaseBackupStorageAdapter.BackupManifest manifest =
                new JsonDatabaseBackupStorageAdapter.BackupManifest(1, tables, Instant.now().toString(), "80");

        List<JsonDatabaseBackupStorageAdapter.TableSnapshot> data = tables.stream()
                .map(t -> new JsonDatabaseBackupStorageAdapter.TableSnapshot(
                        t,
                        List.of(new JsonDatabaseBackupStorageAdapter.ColumnMeta("id", java.sql.Types.BINARY)),
                        List.of()
                ))
                .toList();

        byte[] json = objectMapper.writeValueAsBytes(
                new JsonDatabaseBackupStorageAdapter.BackupDocument(manifest, data));
        Files.write(file, json);

        when(jdbcTemplate.query(anyString(), ArgumentMatchers.<ResultSetExtractor<Map<String, Integer>>>any()))
                .thenReturn(Map.of("id", java.sql.Types.BINARY));

        UUID id = UUID.randomUUID();
        BackupVerificationReport report = adapter.verifySnapshot(id, "BKP-MISMATCH", fileName);

        assertFalse(report.valid());
        assertTrue(report.issues().stream().anyMatch(i -> i.contains("không khớp với database hiện tại")));
    }

    @Test
    void verifySnapshotReturnsFailureWhenFileNameIsNullOrBlank() {
        UUID id = UUID.randomUUID();
        BackupVerificationReport reportNull = adapter.verifySnapshot(id, "BKP-NULL", null);

        assertFalse(reportNull.valid());
        assertFalse(reportNull.readable());
        assertTrue(reportNull.message().contains("không hợp lệ"));

        BackupVerificationReport reportBlank = adapter.verifySnapshot(id, "BKP-BLANK", "   ");
        assertFalse(reportBlank.valid());
        assertFalse(reportBlank.readable());
    }

    @Test
    void verifySnapshotHandlesDisallowedTableNameGracefully() throws IOException {
        String fileName = "malicious_table.json";
        Path file = tempDir.resolve(fileName);

        List<String> tables = plan.snapshotTables();
        JsonDatabaseBackupStorageAdapter.BackupManifest manifest =
                new JsonDatabaseBackupStorageAdapter.BackupManifest(1, tables, Instant.now().toString(), "87");

        // Include an invalid table with SQL injection syntax
        List<JsonDatabaseBackupStorageAdapter.TableSnapshot> data = List.of(
                new JsonDatabaseBackupStorageAdapter.TableSnapshot(
                        "users; DROP TABLE test",
                        List.of(new JsonDatabaseBackupStorageAdapter.ColumnMeta("id", java.sql.Types.BINARY)),
                        List.of()
                )
        );

        byte[] json = objectMapper.writeValueAsBytes(
                new JsonDatabaseBackupStorageAdapter.BackupDocument(manifest, data));
        Files.write(file, json);

        UUID id = UUID.randomUUID();
        BackupVerificationReport report = adapter.verifySnapshot(id, "BKP-MALICIOUS", fileName);

        assertFalse(report.valid());
        assertTrue(report.issues().size() > 0);
    }
}
