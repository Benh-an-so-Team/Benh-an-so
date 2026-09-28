package com.benhsoan.persistence.migration;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.InputStream;
import java.io.StringReader;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.UUID;

import org.h2.tools.RunScript;
import org.junit.jupiter.api.Test;

/**
 * Executes the schema portion of the V108 migration (table + indexes) against an
 * in-memory H2 database to prove the DDL is H2-compatible and enforces the status
 * CHECK and patient/processor foreign keys. The permission-seeding portion uses
 * MySQL {@code UUID_TO_BIN(UUID())} and is therefore exercised only by the
 * MySQL/Testcontainers suite (consistent with V103/V105, which are also not
 * H2-tested).
 */
class PersonalDataRequestMigrationH2Test {

    @Test
    void v108DdlRunsAndEnforcesConstraintsOnH2() throws Exception {
        try (Connection conn = DriverManager.getConnection(
                "jdbc:h2:mem:v108;DB_CLOSE_DELAY=-1;MODE=LEGACY", "sa", "")) {
            Statement stmt = conn.createStatement();
            stmt.execute("CREATE TABLE patients (id BINARY(16) NOT NULL, PRIMARY KEY (id))");
            stmt.execute("CREATE TABLE users (id BINARY(16) NOT NULL, PRIMARY KEY (id))");

            String ddl = readResource("db/migration/V108__create_personal_data_requests_table.sql");
            RunScript.execute(conn, new StringReader(schemaOnly(ddl)));

            UUID patientId = UUID.randomUUID();
            UUID processorId = UUID.randomUUID();
            seed(stmt, "patients", patientId);
            seed(stmt, "users", processorId);

            UUID requestId = UUID.randomUUID();
            insertRequest(conn, requestId, patientId, "MEDICAL_RECORD_COPY", "RECEIVED", processorId);

            try (ResultSet rs = stmt.executeQuery("SELECT COUNT(*) FROM personal_data_requests")) {
                rs.next();
                assertEquals(1, rs.getInt(1));
            }

            // CHECK constraint rejects an unknown status.
            assertThrows(SQLException.class, () -> insertRequest(
                    conn, UUID.randomUUID(), patientId, "MEDICAL_RECORD_COPY", "UNKNOWN", processorId));

            // Foreign key rejects a request for a non-existent patient.
            assertThrows(SQLException.class, () -> insertRequest(
                    conn, UUID.randomUUID(), UUID.randomUUID(), "MEDICAL_RECORD_COPY", "RECEIVED", processorId));

            assertIndexExists(stmt, "idx_personal_data_requests_status_due_at");
            assertIndexExists(stmt, "idx_personal_data_requests_patient");
            assertIndexExists(stmt, "idx_personal_data_requests_due_at");
            assertIndexExists(stmt, "idx_personal_data_requests_processed_by");
        }
    }

    @Test
    void v109DeadlineAlertsDdlRunsAndDeduplicatesOnH2() throws Exception {
        try (Connection conn = DriverManager.getConnection(
                "jdbc:h2:mem:v109;DB_CLOSE_DELAY=-1;MODE=LEGACY", "sa", "")) {
            Statement stmt = conn.createStatement();
            stmt.execute("CREATE TABLE patients (id BINARY(16) NOT NULL, PRIMARY KEY (id))");
            stmt.execute("CREATE TABLE users (id BINARY(16) NOT NULL, PRIMARY KEY (id))");

            String v108 = readResource("db/migration/V108__create_personal_data_requests_table.sql");
            RunScript.execute(conn, new StringReader(schemaOnly(v108)));

            String v109 = readResource("db/migration/V109__create_personal_data_request_deadline_alerts_table.sql");
            RunScript.execute(conn, new StringReader(v109));

            UUID patientId = UUID.randomUUID();
            UUID processorId = UUID.randomUUID();
            seed(stmt, "patients", patientId);
            seed(stmt, "users", processorId);

            UUID requestId = UUID.randomUUID();
            insertRequest(conn, requestId, patientId, "MEDICAL_RECORD_COPY", "RECEIVED", processorId);

            UUID alertId1 = UUID.randomUUID();
            UUID alertId2 = UUID.randomUUID();
            insertAlert(conn, alertId1, requestId, "OVERDUE");
            insertAlert(conn, alertId2, requestId, "UPCOMING");

            // Duplicate (same request + same type) must be rejected by the unique constraint.
            assertThrows(SQLException.class,
                    () -> insertAlert(conn, UUID.randomUUID(), requestId, "OVERDUE"));

            assertIndexExists(stmt, "idx_pdr_deadline_alerts_created_at");
        }
    }

    private void insertAlert(Connection conn, UUID id, UUID requestId, String alertType) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "INSERT INTO personal_data_request_deadline_alerts "
                        + "(id, personal_data_request_id, alert_type, created_at) VALUES (?, ?, ?, ?)")) {
            ps.setBytes(1, uuidBytes(id));
            ps.setBytes(2, uuidBytes(requestId));
            ps.setString(3, alertType);
            ps.setTimestamp(4, Timestamp.from(Instant.now()));
            ps.executeUpdate();
        }
    }

    private String schemaOnly(String migration) {
        int idx = migration.indexOf("INSERT INTO permissions");
        return idx >= 0 ? migration.substring(0, idx) : migration;
    }

    private void seed(Statement stmt, String table, UUID id) throws SQLException {
        try (PreparedStatement ps = stmt.getConnection().prepareStatement(
                "INSERT INTO " + table + " (id) VALUES (?)")) {
            ps.setBytes(1, uuidBytes(id));
            ps.executeUpdate();
        }
    }

    private void insertRequest(
            Connection conn,
            UUID id,
            UUID patientId,
            String requestType,
            String status,
            UUID processedBy) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "INSERT INTO personal_data_requests "
                        + "(id, patient_id, request_type, status, received_at, due_at, processed_by, created_at) "
                        + "VALUES (?, ?, ?, ?, ?, ?, ?, ?)")) {
            ps.setBytes(1, uuidBytes(id));
            ps.setBytes(2, uuidBytes(patientId));
            ps.setString(3, requestType);
            ps.setString(4, status);
            ps.setTimestamp(5, Timestamp.from(Instant.now()));
            ps.setTimestamp(6, Timestamp.from(Instant.now().plusSeconds(86400)));
            ps.setBytes(7, uuidBytes(processedBy));
            ps.setTimestamp(8, Timestamp.from(Instant.now()));
            ps.executeUpdate();
        }
    }

    private void assertIndexExists(Statement stmt, String indexName) throws SQLException {
        try (ResultSet rs = stmt.executeQuery(
                "SELECT COUNT(*) FROM information_schema.indexes WHERE LOWER(index_name) = '"
                        + indexName.toLowerCase() + "'")) {
            rs.next();
            assertTrue(rs.getInt(1) > 0, "Missing index: " + indexName);
        }
    }

    private String readResource(String path) throws Exception {
        try (InputStream in = getClass().getClassLoader().getResourceAsStream(path)) {
            assertNotNull(in, "Migration resource not found: " + path);
            return new String(in.readAllBytes(), StandardCharsets.UTF_8);
        }
    }

    private byte[] uuidBytes(UUID uuid) {
        byte[] bytes = new byte[16];
        ByteBuffer.wrap(bytes).putLong(uuid.getMostSignificantBits()).putLong(uuid.getLeastSignificantBits());
        return bytes;
    }
}
