package com.benhsoan.infrastructure.storage;

import java.io.IOException;
import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.sql.PreparedStatement;
import java.sql.ResultSetMetaData;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.sql.Types;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.HashSet;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.ResultSetExtractor;

import com.benhsoan.domain.backup.exception.BackupExecutionException;
import com.benhsoan.port.outbound.backup.BackupSnapshot;
import com.benhsoan.port.outbound.backup.DatabaseBackupStoragePort;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

public class JsonDatabaseBackupStorageAdapter implements DatabaseBackupStoragePort {

    private static final String EXTENSION = ".json";
    private static final int SNAPSHOT_FORMAT_VERSION = 1;
    private static final java.util.regex.Pattern TABLE_NAME_PATTERN = java.util.regex.Pattern.compile("^[a-zA-Z0-9_]+$");

    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;
    private final BackupRestorePlan backupRestorePlan;
    private final ForeignKeyRestorePlanner restorePlanner;
    private final Path backupDirectory;

    public JsonDatabaseBackupStorageAdapter(
            JdbcTemplate jdbcTemplate,
            ObjectMapper objectMapper,
            BackupRestorePlan backupRestorePlan,
            Path backupDirectory
    ) {
        this.jdbcTemplate = jdbcTemplate;
        this.objectMapper = objectMapper;
        this.backupRestorePlan = backupRestorePlan;
        this.restorePlanner = new ForeignKeyRestorePlanner(jdbcTemplate, backupRestorePlan);
        this.backupDirectory = backupDirectory;
    }

    @Override
    public BackupSnapshot exportSnapshot(String backupCode) {
        List<TableSnapshot> tables = backupRestorePlan.snapshotTables().stream()
                .map(this::dumpTable)
                .toList();

        BackupManifest manifest = new BackupManifest(
                SNAPSHOT_FORMAT_VERSION,
                backupRestorePlan.snapshotTables(),
                java.time.Instant.now().toString(),
                currentSchemaVersion()
        );
        byte[] content = writeJson(new BackupDocument(manifest, tables));
        String fileName = backupCode + EXTENSION;
        persist(fileName, content);

        return new BackupSnapshot(fileName, content);
    }

    @Override
    public BackupSnapshot loadSnapshot(String fileName) {
        return new BackupSnapshot(fileName, readFile(fileName));
    }

    @Override
    public com.benhsoan.domain.backup.BackupVerificationReport verifySnapshot(
            java.util.UUID backupId,
            String backupCode,
            String fileName
    ) {
        java.time.Instant verifiedAt = java.time.Instant.now();
        if (fileName == null || fileName.isBlank()) {
            return com.benhsoan.domain.backup.BackupVerificationReport.failure(
                    backupId,
                    backupCode,
                    fileName,
                    false,
                    0,
                    0,
                    null,
                    verifiedAt,
                    "Tên tệp sao lưu không hợp lệ.",
                    java.util.List.of("Tên tệp sao lưu rỗng hoặc không xác định.")
            );
        }

        byte[] fileBytes;
        try {
            fileBytes = readFile(fileName);
        } catch (RuntimeException ex) {
            String msg = (ex.getMessage() != null && !ex.getMessage().isBlank()) ? ex.getMessage() : "Không thể đọc tệp sao lưu";
            return com.benhsoan.domain.backup.BackupVerificationReport.failure(
                    backupId,
                    backupCode,
                    fileName,
                    false,
                    0,
                    0,
                    null,
                    verifiedAt,
                    "Không thể đọc tệp sao lưu: " + msg,
                    java.util.List.of(msg)
            );
        }

        BackupDocument document;
        try {
            document = readJson(fileBytes);
        } catch (RuntimeException ex) {
            String msg = (ex.getMessage() != null && !ex.getMessage().isBlank()) ? ex.getMessage() : "Tệp sao lưu không đúng định dạng JSON";
            return com.benhsoan.domain.backup.BackupVerificationReport.failure(
                    backupId,
                    backupCode,
                    fileName,
                    true,
                    0,
                    0,
                    null,
                    verifiedAt,
                    "Tệp sao lưu không đúng định dạng JSON: " + msg,
                    java.util.List.of(msg)
            );
        }

        java.util.List<String> issues = new java.util.ArrayList<>();
        if (document == null || document.manifest() == null || document.data() == null) {
            issues.add("Bản sao lưu thiếu phần manifest hoặc dữ liệu bảng.");
            return com.benhsoan.domain.backup.BackupVerificationReport.failure(
                    backupId, backupCode, fileName, true, 0, 0, null, verifiedAt,
                    "Bản sao lưu thiếu phần manifest hoặc dữ liệu bảng.", issues);
        }

        BackupManifest manifest = document.manifest();
        if (manifest.formatVersion() != SNAPSHOT_FORMAT_VERSION) {
            issues.add("Phiên bản định dạng sao lưu không được hỗ trợ: " + manifest.formatVersion());
        }
        if (manifest.createdAt() == null || manifest.createdAt().isBlank()) {
            issues.add("Bản sao lưu thiếu thời gian khởi tạo.");
        } else {
            try {
                java.time.Instant.parse(manifest.createdAt());
            } catch (Exception ex) {
                issues.add("Thời gian khởi tạo trong bản sao lưu không hợp lệ: " + manifest.createdAt());
            }
        }

        String currentSchema = currentSchemaVersion();
        if (currentSchema == null || !currentSchema.equals(manifest.schemaVersion())) {
            issues.add("Phiên bản schema của bản sao lưu (" + manifest.schemaVersion()
                    + ") không khớp với database hiện tại (" + currentSchema + ").");
        }

        java.util.List<TableSnapshot> tables = document.data();
        int tableCount = tables != null ? tables.size() : 0;
        int totalRows = 0;

        try {
            java.util.List<String> manifestTables = normalizeTableNames(manifest.tables());
            if (tables == null || tables.stream().anyMatch(java.util.Objects::isNull)) {
                issues.add("Bản sao lưu chứa bảng rỗng hoặc không xác định.");
            } else {
                java.util.List<String> dataTables = normalizeTableNames(tables.stream().map(TableSnapshot::name).toList());
                if (!manifestTables.equals(dataTables)) {
                    issues.add("Danh sách bảng trong manifest không khớp với danh sách bảng thực tế.");
                }
                if (!java.util.Set.copyOf(manifestTables).equals(java.util.Set.copyOf(backupRestorePlan.snapshotTables()))) {
                    issues.add("Danh sách bảng không khớp với phạm vi FULL được cấu hình.");
                }

                for (TableSnapshot table : tables) {
                    if (table != null && table.rows() != null) {
                        totalRows += table.rows().size();
                    }
                    try {
                        validateTableColumns(table);
                    } catch (RuntimeException ex) {
                        String msg = (ex.getMessage() != null && !ex.getMessage().isBlank()) ? ex.getMessage() : "Lỗi xác thực cột bảng";
                        issues.add("Bảng " + (table != null ? table.name() : "null") + " không hợp lệ: " + msg);
                    }
                }
            }
        } catch (RuntimeException ex) {
            String msg = (ex.getMessage() != null && !ex.getMessage().isBlank()) ? ex.getMessage() : "Lỗi cấu trúc bảng không xác định";
            issues.add("Lỗi cấu trúc bảng sao lưu: " + msg);
        }

        if (!issues.isEmpty()) {
            return com.benhsoan.domain.backup.BackupVerificationReport.failure(
                    backupId,
                    backupCode,
                    fileName,
                    true,
                    tableCount,
                    totalRows,
                    manifest.schemaVersion(),
                    verifiedAt,
                    "Phát hiện " + issues.size() + " lỗi toàn vẹn trong bản sao lưu.",
                    issues
            );
        }

        return com.benhsoan.domain.backup.BackupVerificationReport.success(
                backupId,
                backupCode,
                fileName,
                tableCount,
                totalRows,
                manifest.schemaVersion(),
                verifiedAt
        );
    }

    @Override
    public void restoreSnapshot(String fileName) {
        BackupDocument document = readJson(readFile(fileName));
        validateSnapshot(document);
        List<TableSnapshot> tables = document.data();
        Map<String, TableSnapshot> tablesByName = tablesByName(tables);
        ForeignKeyRestorePlanner.RestorePlan restorePlan = restorePlanner.createPlan(
                new ArrayList<>(tablesByName.keySet()));

        clearDeferredForeignKeys(restorePlan.deferredUpdates());
        for (String tableName : restorePlan.childFirstTables()) {
            deleteTable(tablesByName.get(tableName), restorePlan.deferredUpdates());
        }
        for (String tableName : restorePlan.parentFirstTables()) {
            TableSnapshot table = tablesByName.get(tableName);
            List<ForeignKeyRestorePlanner.DeferredUpdate> tableDeferredUpdates = restorePlan.deferredUpdates().stream()
                    .filter(deferred -> deferred.tableName().equals(tableName))
                    .toList();
            Set<String> deferredColumns = tableDeferredUpdates.stream()
                    .filter(deferred -> !isSelfReference(deferred))
                    .map(ForeignKeyRestorePlanner.DeferredUpdate::columnName)
                    .collect(Collectors.toUnmodifiableSet());
            insertTable(table, deferredColumns, tableDeferredUpdates.stream()
                    .filter(this::isSelfReference)
                    .toList());
        }
        for (ForeignKeyRestorePlanner.DeferredUpdate deferredUpdate : restorePlan.deferredUpdates()) {
            if (!isSelfReference(deferredUpdate)) {
                updateDeferredForeignKey(tablesByName.get(deferredUpdate.tableName()), deferredUpdate);
            }
        }
    }

    private void clearDeferredForeignKeys(List<ForeignKeyRestorePlanner.DeferredUpdate> deferredUpdates) {
        for (ForeignKeyRestorePlanner.DeferredUpdate deferredUpdate : deferredUpdates) {
            if (isSelfReference(deferredUpdate)) {
                continue;
            }
            jdbcTemplate.update("UPDATE " + deferredUpdate.tableName()
                    + " SET " + deferredUpdate.columnName() + " = NULL");
        }
    }

    private boolean isSelfReference(ForeignKeyRestorePlanner.DeferredUpdate deferredUpdate) {
        return deferredUpdate.tableName().equals(deferredUpdate.parentTable());
    }

    private Map<String, TableSnapshot> tablesByName(List<TableSnapshot> tables) {
        Map<String, TableSnapshot> tablesByName = new LinkedHashMap<>();
        for (TableSnapshot table : tables) {
            if (table == null || table.name() == null) {
                throw new BackupExecutionException("Backup snapshot contains an unnamed table.");
            }
            String tableName = table.name().toLowerCase(java.util.Locale.ROOT);
            if (tablesByName.putIfAbsent(tableName, table) != null) {
                throw new BackupExecutionException("Backup snapshot contains duplicate table: " + tableName);
            }
        }
        return tablesByName;
    }

    private TableSnapshot dumpTable(String tableName) {
        List<ColumnMeta> columns = new ArrayList<>();
        List<List<String>> rows = new ArrayList<>();

        jdbcTemplate.query("SELECT * FROM " + tableName, (ResultSetExtractor<Void>) rs -> {
            ResultSetMetaData metaData = rs.getMetaData();
            int columnCount = metaData.getColumnCount();
            for (int i = 1; i <= columnCount; i++) {
                columns.add(new ColumnMeta(metaData.getColumnName(i), metaData.getColumnType(i)));
            }

            while (rs.next()) {
                List<String> row = new ArrayList<>(columnCount);
                for (int i = 1; i <= columnCount; i++) {
                    row.add(toJsonSafe(rs.getObject(i)));
                }
                rows.add(row);
            }
            return null;
        });

        return new TableSnapshot(tableName, columns, rows);
    }

    private void validateSnapshot(BackupDocument document) {
        if (document == null || document.manifest() == null || document.data() == null) {
            throw new BackupExecutionException("Backup snapshot is missing its manifest or table data.");
        }

        BackupManifest manifest = document.manifest();
        if (manifest.formatVersion() != SNAPSHOT_FORMAT_VERSION) {
            throw new BackupExecutionException("Unsupported backup snapshot format version: " + manifest.formatVersion());
        }
        if (manifest.createdAt() == null || manifest.createdAt().isBlank()) {
            throw new BackupExecutionException("Backup snapshot is missing its creation time.");
        }
        try {
            java.time.Instant.parse(manifest.createdAt());
        } catch (java.time.format.DateTimeParseException ex) {
            throw new BackupExecutionException("Backup snapshot creation time is invalid.");
        }
        if (!currentSchemaVersion().equals(manifest.schemaVersion())) {
            throw new BackupExecutionException(
                    "Backup snapshot schema version does not match the current database schema.");
        }

        List<String> manifestTables = normalizeTableNames(manifest.tables());
        if (document.data().stream().anyMatch(java.util.Objects::isNull)) {
            throw new BackupExecutionException("Backup snapshot contains an empty table entry.");
        }
        List<String> dataTables = normalizeTableNames(document.data().stream().map(TableSnapshot::name).toList());
        if (!manifestTables.equals(dataTables)) {
            throw new BackupExecutionException("Backup manifest table list does not match its table data.");
        }
        if (!Set.copyOf(manifestTables).equals(Set.copyOf(backupRestorePlan.snapshotTables()))) {
            throw new BackupExecutionException("Backup snapshot does not match the configured FULL table scope.");
        }

        for (TableSnapshot table : document.data()) {
            validateTableColumns(table);
        }
    }

    private List<String> normalizeTableNames(List<String> tableNames) {
        if (tableNames == null || tableNames.isEmpty()) {
            throw new BackupExecutionException("Backup snapshot does not contain any tables.");
        }
        List<String> normalized = tableNames.stream()
                .map(tableName -> tableName == null ? "" : tableName.toLowerCase(java.util.Locale.ROOT))
                .toList();
        if (normalized.size() != Set.copyOf(normalized).size()) {
            throw new BackupExecutionException("Backup snapshot contains duplicate tables.");
        }
        return normalized;
    }

    private void validateTableColumns(TableSnapshot table) {
        if (table == null || table.columns() == null || table.rows() == null) {
            throw new BackupExecutionException("Backup snapshot contains incomplete table data.");
        }
        Map<String, Integer> snapshotColumns = new LinkedHashMap<>();
        for (ColumnMeta column : table.columns()) {
            if (column == null || column.name() == null) {
                throw new BackupExecutionException("Backup snapshot contains an unnamed column in table " + table.name() + ".");
            }
            String columnName = column.name().toLowerCase(java.util.Locale.ROOT);
            if (snapshotColumns.putIfAbsent(columnName, column.type()) != null) {
                throw new BackupExecutionException("Backup snapshot contains duplicate column " + columnName + ".");
            }
        }

        Map<String, Integer> databaseColumns = databaseColumns(table.name());
        if (!snapshotColumns.equals(databaseColumns)) {
            throw new BackupExecutionException("Backup snapshot columns do not match database table " + table.name() + ".");
        }
        for (List<String> row : table.rows()) {
            if (row == null || row.size() != table.columns().size()) {
                throw new BackupExecutionException("Backup snapshot row does not match columns in table " + table.name() + ".");
            }
        }
    }

    private Map<String, Integer> databaseColumns(String tableName) {
        if (tableName == null || !TABLE_NAME_PATTERN.matcher(tableName).matches()) {
            throw new BackupExecutionException("Invalid table name: " + tableName);
        }
        boolean isWhitelisted = backupRestorePlan.snapshotTables().stream()
                .anyMatch(allowed -> allowed.equalsIgnoreCase(tableName));
        if (!isWhitelisted) {
            throw new BackupExecutionException("Table is not in allowed backup snapshot tables: " + tableName);
        }
        return jdbcTemplate.query("SELECT * FROM " + tableName + " WHERE 1 = 0", (ResultSetExtractor<Map<String, Integer>>) rs -> {
            Map<String, Integer> columns = new LinkedHashMap<>();
            ResultSetMetaData metadata = rs.getMetaData();
            for (int index = 1; index <= metadata.getColumnCount(); index++) {
                columns.put(metadata.getColumnName(index).toLowerCase(java.util.Locale.ROOT), metadata.getColumnType(index));
            }
            return columns;
        });
    }

    private String currentSchemaVersion() {
        try {
            return jdbcTemplate.queryForObject("""
                    SELECT version
                    FROM flyway_schema_history
                    WHERE success = TRUE AND version IS NOT NULL
                    ORDER BY installed_rank DESC
                    LIMIT 1
                    """, String.class);
        } catch (RuntimeException ex) {
            throw new BackupExecutionException("Unable to determine the current database schema version.");
        }
    }

    private void deleteTable(
            TableSnapshot table,
            List<ForeignKeyRestorePlanner.DeferredUpdate> deferredUpdates
    ) {
        deferredUpdates.stream()
                .filter(this::isSelfReference)
                .filter(deferred -> deferred.tableName().equals(table.name()))
                .forEach(deferred -> deleteSelfReferencingRows(table, deferred));
        jdbcTemplate.update("DELETE FROM " + table.name());
    }

    private void deleteSelfReferencingRows(
            TableSnapshot table,
            ForeignKeyRestorePlanner.DeferredUpdate deferredUpdate
    ) {
        String deleteLeafRows = "DELETE child FROM " + table.name() + " child "
                + "LEFT JOIN " + table.name() + " dependent ON dependent." + deferredUpdate.columnName()
                + " = child." + deferredUpdate.primaryKeyColumn() + " "
                + "WHERE child." + deferredUpdate.columnName() + " IS NOT NULL "
                + "AND dependent." + deferredUpdate.primaryKeyColumn() + " IS NULL";
        while (jdbcTemplate.update(deleteLeafRows) > 0) {
            // Delete adjustment records before their referenced records without breaking table checks.
        }
        Integer remaining = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM " + table.name() + " WHERE " + deferredUpdate.columnName() + " IS NOT NULL",
                Integer.class);
        if (remaining != null && remaining > 0) {
            throw new BackupExecutionException("Cannot restore self-referencing rows in table " + table.name() + ".");
        }
    }

    private void insertTable(
            TableSnapshot table,
            Set<String> deferredColumns,
            List<ForeignKeyRestorePlanner.DeferredUpdate> selfReferences
    ) {
        if (table.rows().isEmpty()) {
            return;
        }

        String columnList = table.columns().stream()
                .map(ColumnMeta::name)
                .collect(Collectors.joining(", "));
        String placeholders = table.columns().stream()
                .map(column -> "?")
                .collect(Collectors.joining(", "));
        String insertSql = "INSERT INTO " + table.name() + " (" + columnList + ") VALUES (" + placeholders + ")";

        if (selfReferences.isEmpty()) {
            for (List<String> row : table.rows()) {
                jdbcTemplate.update(insertSql, ps -> bindRow(ps, table.columns(), row, deferredColumns));
            }
            return;
        }

        List<List<String>> pendingRows = new ArrayList<>(table.rows());
        Set<String> insertedIds = new HashSet<>();
        int primaryKeyIndex = columnIndex(table, selfReferences.getFirst().primaryKeyColumn());
        while (!pendingRows.isEmpty()) {
            boolean insertedAny = false;
            for (Iterator<List<String>> iterator = pendingRows.iterator(); iterator.hasNext();) {
                List<String> row = iterator.next();
                boolean referencesInsertedRow = selfReferences.stream().allMatch(deferred -> {
                    String value = row.get(columnIndex(table, deferred.columnName()));
                    return value == null || insertedIds.contains(value);
                });
                if (referencesInsertedRow) {
                    jdbcTemplate.update(insertSql, ps -> bindRow(ps, table.columns(), row, deferredColumns));
                    insertedIds.add(row.get(primaryKeyIndex));
                    iterator.remove();
                    insertedAny = true;
                }
            }
            if (!insertedAny) {
                throw new BackupExecutionException("Backup snapshot contains a self-referencing cycle in table "
                        + table.name() + ".");
            }
        }
    }

    private void updateDeferredForeignKey(
            TableSnapshot table,
            ForeignKeyRestorePlanner.DeferredUpdate deferredUpdate
    ) {
        int foreignKeyIndex = columnIndex(table, deferredUpdate.columnName());
        int primaryKeyIndex = columnIndex(table, deferredUpdate.primaryKeyColumn());
        ColumnMeta foreignKeyColumn = table.columns().get(foreignKeyIndex);
        ColumnMeta primaryKeyColumn = table.columns().get(primaryKeyIndex);
        String updateSql = "UPDATE " + table.name() + " SET " + foreignKeyColumn.name()
                + " = ? WHERE " + primaryKeyColumn.name() + " = ?";

        for (List<String> row : table.rows()) {
            String foreignKeyValue = row.get(foreignKeyIndex);
            if (foreignKeyValue != null) {
                jdbcTemplate.update(updateSql, ps -> {
                    setValue(ps, 1, foreignKeyColumn.type(), foreignKeyValue);
                    setValue(ps, 2, primaryKeyColumn.type(), row.get(primaryKeyIndex));
                });
            }
        }
    }

    private int columnIndex(TableSnapshot table, String columnName) {
        for (int index = 0; index < table.columns().size(); index++) {
            if (table.columns().get(index).name().equalsIgnoreCase(columnName)) {
                return index;
            }
        }
        throw new BackupExecutionException(
                "Backup snapshot is missing column " + columnName + " in table " + table.name() + ".");
    }

    private void bindRow(
            PreparedStatement ps,
            List<ColumnMeta> columns,
            List<String> row,
            Set<String> deferredColumns
    ) throws SQLException {
        for (int i = 0; i < columns.size(); i++) {
            if (deferredColumns.contains(columns.get(i).name().toLowerCase(java.util.Locale.ROOT))) {
                ps.setNull(i + 1, columns.get(i).type());
            } else {
                setValue(ps, i + 1, columns.get(i).type(), row.get(i));
            }
        }
    }

    private void setValue(PreparedStatement ps, int index, int jdbcType, String value) throws SQLException {
        if (value == null) {
            ps.setNull(index, jdbcType);
            return;
        }
        try {
            switch (jdbcType) {
                case Types.BINARY, Types.VARBINARY, Types.LONGVARBINARY, Types.BLOB ->
                        ps.setBytes(index, HexFormat.of().parseHex(value));
                case Types.DATE -> ps.setDate(index, java.sql.Date.valueOf(value));
                case Types.TIME -> ps.setTime(index, java.sql.Time.valueOf(value));
                case Types.TIMESTAMP, Types.TIMESTAMP_WITH_TIMEZONE -> ps.setTimestamp(index, toTimestamp(value));
                case Types.BOOLEAN, Types.BIT -> ps.setBoolean(index, isTrue(value));
                case Types.TINYINT, Types.SMALLINT, Types.INTEGER -> ps.setInt(index, Integer.parseInt(value));
                case Types.BIGINT -> ps.setLong(index, Long.parseLong(value));
                case Types.DECIMAL, Types.NUMERIC -> ps.setBigDecimal(index, new BigDecimal(value));
                case Types.FLOAT, Types.REAL -> ps.setFloat(index, Float.parseFloat(value));
                case Types.DOUBLE -> ps.setDouble(index, Double.parseDouble(value));
                default -> ps.setString(index, value);
            }
        } catch (IllegalArgumentException ex) {
            throw new BackupExecutionException("Invalid data value for column at index " + index + ": " + value, ex);
        }
    }

    private String toJsonSafe(Object value) {
        if (value == null) {
            return null;
        }
        if (value instanceof byte[] bytes) {
            return HexFormat.of().formatHex(bytes);
        }
        if (value instanceof Timestamp timestamp) {
            return timestamp.toInstant().toString();
        }
        if (value instanceof java.time.OffsetDateTime offsetDateTime) {
            return offsetDateTime.toInstant().toString();
        }
        if (value instanceof java.time.Instant instant) {
            return instant.toString();
        }
        return value.toString();
    }

    private Timestamp toTimestamp(String value) {
        if (value.endsWith("Z")) {
            return Timestamp.from(java.time.Instant.parse(value));
        }
        return Timestamp.valueOf(value.replace('T', ' '));
    }

    private boolean isTrue(String value) {
        return "true".equalsIgnoreCase(value) || "1".equals(value);
    }

    private byte[] writeJson(BackupDocument document) {
        try {
            return objectMapper.writeValueAsBytes(document);
        } catch (JsonProcessingException ex) {
            throw new BackupExecutionException("Failed to serialize backup snapshot: " + ex.getMessage());
        }
    }

    private BackupDocument readJson(byte[] content) {
        try {
            return objectMapper.readValue(content, new TypeReference<BackupDocument>() {
            });
        } catch (IOException ex) {
            throw new BackupExecutionException("Failed to deserialize backup snapshot: " + ex.getMessage());
        }
    }

    private void persist(String fileName, byte[] content) {
        try {
            Files.createDirectories(backupDirectory);
            Files.write(
                    backupDirectory.resolve(fileName),
                    content,
                    StandardOpenOption.CREATE,
                    StandardOpenOption.TRUNCATE_EXISTING
            );
        } catch (IOException ex) {
            throw new BackupExecutionException("Failed to store backup file: " + ex.getMessage());
        }
    }

    private byte[] readFile(String fileName) {
        try {
            Path path = backupDirectory.resolve(fileName);
            if (!Files.exists(path)) {
                throw new BackupExecutionException("Backup file not found: " + fileName);
            }
            return Files.readAllBytes(path);
        } catch (IOException ex) {
            throw new BackupExecutionException("Failed to read backup file: " + ex.getMessage());
        }
    }

    public record TableSnapshot(String name, List<ColumnMeta> columns, List<List<String>> rows) {
    }

    public record ColumnMeta(String name, int type) {
    }

    public record BackupDocument(BackupManifest manifest, List<TableSnapshot> data) {
    }

    public record BackupManifest(
            int formatVersion,
            List<String> tables,
            String createdAt,
            String schemaVersion
    ) {
    }
}
