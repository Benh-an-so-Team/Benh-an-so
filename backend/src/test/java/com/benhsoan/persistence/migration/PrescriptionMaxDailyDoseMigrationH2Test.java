package com.benhsoan.persistence.migration;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

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
 * Executes the actual V92 migration file against an in-memory H2 database to prove the
 * DDL is H2-compatible and enforces the new columns, CHECK constraints and the max daily
 * dose warning log table.
 */
class PrescriptionMaxDailyDoseMigrationH2Test {

    @Test
    void v92MigrationRunsAndEnforcesConstraintsOnH2() throws Exception {
        try (Connection conn = DriverManager.getConnection(
                "jdbc:h2:mem:v92;DB_CLOSE_DELAY=-1;MODE=LEGACY", "sa", "")) {
            Statement stmt = conn.createStatement();
            stmt.execute("CREATE TABLE medicines (id BINARY(16) NOT NULL, PRIMARY KEY (id))");
            stmt.execute("CREATE TABLE prescription_items (id BINARY(16) NOT NULL, PRIMARY KEY (id))");
            stmt.execute("CREATE TABLE prescriptions (id BINARY(16) NOT NULL, PRIMARY KEY (id))");
            stmt.execute("CREATE TABLE patients (id BINARY(16) NOT NULL, PRIMARY KEY (id))");
            stmt.execute("CREATE TABLE users (id BINARY(16) NOT NULL, PRIMARY KEY (id))");

            String ddl = readResource("db/migration/V94__add_max_daily_dose_to_medicines.sql");
            RunScript.execute(conn, new StringReader(ddl));

            // The new warning log table must be queryable and reference parent rows.
            UUID medicineId = UUID.randomUUID();
            UUID prescriptionId = UUID.randomUUID();
            UUID patientId = UUID.randomUUID();
            UUID doctorId = UUID.randomUUID();
            seed(stmt, "medicines", medicineId);
            seed(stmt, "prescriptions", prescriptionId);
            seed(stmt, "patients", patientId);
            seed(stmt, "users", doctorId);

            insertWarningLog(conn, UUID.randomUUID(), prescriptionId, patientId, doctorId);

            try (ResultSet rs = stmt.executeQuery(
                    "SELECT COUNT(*) FROM prescription_max_daily_dose_warning_logs")) {
                rs.next();
                assertEquals(1, rs.getInt(1));
            }

            // strength_value_mg must be null or strictly positive.
            assertThrows(SQLException.class, () -> {
                try (PreparedStatement ps = conn.prepareStatement(
                        "UPDATE medicines SET strength_value_mg = 0 WHERE id = ?")) {
                    ps.setBytes(1, uuidBytes(medicineId));
                    ps.executeUpdate();
                }
            });
        }
    }

    private void seed(Statement stmt, String table, UUID id) throws SQLException {
        try (PreparedStatement ps = stmt.getConnection().prepareStatement(
                "INSERT INTO " + table + " (id) VALUES (?)")) {
            ps.setBytes(1, uuidBytes(id));
            ps.executeUpdate();
        }
    }

    private void insertWarningLog(
            Connection conn,
            UUID id,
            UUID prescriptionId,
            UUID patientId,
            UUID doctorId
    ) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "INSERT INTO prescription_max_daily_dose_warning_logs "
                        + "(id, prescription_id, patient_id, active_ingredient, total_daily_dose_mg, "
                        + "max_daily_dose_mg, override_reason, handled_by, handled_at, created_at) "
                        + "VALUES (?, ?, ?, 'Paracetamol', 3000, 2000, 'Clinical necessity', ?, ?, ?)")) {
            ps.setBytes(1, uuidBytes(id));
            ps.setBytes(2, uuidBytes(prescriptionId));
            ps.setBytes(3, uuidBytes(patientId));
            ps.setBytes(4, uuidBytes(doctorId));
            ps.setTimestamp(5, Timestamp.from(Instant.now()));
            ps.setTimestamp(6, Timestamp.from(Instant.now()));
            ps.executeUpdate();
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
