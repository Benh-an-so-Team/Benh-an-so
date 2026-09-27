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
import java.util.UUID;

import org.h2.tools.RunScript;
import org.junit.jupiter.api.Test;

class PrescriptionReplacementMigrationH2Test {

    private static final String MIGRATION = "db/migration/V107__add_prescription_replacement.sql";

    @Test
    void v107AcceptsReplacedStatusAndPersistsTheReplacementLink() throws Exception {
        try (Connection conn = migratedDatabase("v107_link")) {
            UUID originalId = UUID.randomUUID();
            UUID replacementId = UUID.randomUUID();

            insertPrescription(conn, originalId, "RX000001", "REPLACED", null, null, null);
            insertReplacement(conn, replacementId, "RX000002", originalId, "RX000001", "Sai liều lượng");

            try (ResultSet rs = conn.createStatement().executeQuery(
                    "SELECT prescription_code, status, replaces_prescription_code, replacement_reason "
                            + "FROM prescriptions WHERE id = " + hex(replacementId))) {
                rs.next();
                assertEquals("RX000002", rs.getString("prescription_code"));
                assertEquals("PENDING_DISPENSE", rs.getString("status"));
                assertEquals("RX000001", rs.getString("replaces_prescription_code"));
                assertEquals("Sai liều lượng", rs.getString("replacement_reason"));
            }
        }
    }

    @Test
    void v107RejectsASecondReplacementOfTheSameOriginal() throws Exception {
        try (Connection conn = migratedDatabase("v107_unique")) {
            UUID originalId = UUID.randomUUID();
            insertPrescription(conn, originalId, "RX000001", "REPLACED", null, null, null);
            insertReplacement(conn, UUID.randomUUID(), "RX000002", originalId, "RX000001", "Sai liều lượng");

            assertThrows(SQLException.class, () -> insertReplacement(
                    conn, UUID.randomUUID(), "RX000003", originalId, "RX000001", "Lần hai"));
        }
    }

    @Test
    void v107RejectsSelfReplacement() throws Exception {
        try (Connection conn = migratedDatabase("v107_self")) {
            UUID prescriptionId = UUID.randomUUID();

            assertThrows(SQLException.class, () -> insertReplacement(
                    conn, prescriptionId, "RX000001", prescriptionId, "RX000001", "Sai liều lượng"));
        }
    }

    @Test
    void v107RequiresAnOriginalCodeAndAReasonForALinkedReplacement() throws Exception {
        try (Connection conn = migratedDatabase("v107_reason")) {
            UUID originalId = UUID.randomUUID();
            insertPrescription(conn, originalId, "RX000001", "REPLACED", null, null, null);

            assertThrows(SQLException.class, () -> insertPrescription(
                    conn, UUID.randomUUID(), "RX000002", "PENDING_DISPENSE", originalId, null, null));
            assertThrows(SQLException.class, () -> insertReplacement(
                    conn, UUID.randomUUID(), "RX000003", originalId, "RX000001", "   "));
        }
    }

    @Test
    void v107RejectsALinkToAnUnknownPrescription() throws Exception {
        try (Connection conn = migratedDatabase("v107_fk")) {
            assertThrows(SQLException.class, () -> insertReplacement(
                    conn, UUID.randomUUID(), "RX000002", UUID.randomUUID(), "RX000001", "Sai liều lượng"));
        }
    }

    @Test
    void v107RejectsAnUnknownStatusValue() throws Exception {
        try (Connection conn = migratedDatabase("v107_status")) {
            assertThrows(SQLException.class, () -> insertPrescription(
                    conn, UUID.randomUUID(), "RX000002", "SUPERSEDED", null, null, null));
        }
    }

    @Test
    void v107CascadesPrescriptionHistoryWhenTheMedicalRecordIsDeleted() throws Exception {
        try (Connection conn = migratedDatabase("v107_cascade")) {
            UUID originalId = UUID.randomUUID();
            UUID replacementId = UUID.randomUUID();
            insertPrescription(conn, originalId, "RX000001", "REPLACED", null, null, null);
            insertReplacement(conn, replacementId, "RX000002", originalId, "RX000001", "Sai liều lượng");

            // MedicalRecordCascadeDeleter removes every prescription of a medical
            // record with one record-scoped delete; the self reference must not make
            // that delete order-dependent.
            try (PreparedStatement ps = conn.prepareStatement("DELETE FROM prescriptions WHERE id = ?")) {
                ps.setBytes(1, uuidBytes(originalId));
                ps.executeUpdate();
            }

            try (ResultSet rs = conn.createStatement().executeQuery("SELECT COUNT(*) FROM prescriptions")) {
                rs.next();
                assertEquals(0, rs.getInt(1));
            }
        }
    }

    private Connection migratedDatabase(String name) throws Exception {
        Connection conn = DriverManager.getConnection(
                "jdbc:h2:mem:" + name + ";DB_CLOSE_DELAY=-1", "sa", "");
        Statement stmt = conn.createStatement();
        stmt.execute("CREATE TABLE prescriptions ("
                + "id BINARY(16) NOT NULL, "
                + "prescription_code VARCHAR(30) NOT NULL, "
                + "medical_record_id BINARY(16) NOT NULL, "
                + "status VARCHAR(30) NOT NULL, "
                + "CONSTRAINT pk_prescriptions PRIMARY KEY (id), "
                + "CONSTRAINT uk_prescriptions_code UNIQUE (prescription_code), "
                + "CONSTRAINT chk_prescriptions_status CHECK ("
                + "status IN ('PENDING_DISPENSE', 'DISPENSED', 'CANCELLED')))");

        RunScript.execute(conn, new StringReader(readResource(MIGRATION)));
        return conn;
    }

    private void insertPrescription(
            Connection conn,
            UUID id,
            String code,
            String status,
            UUID replacesId,
            String replacesCode,
            String reason
    ) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "INSERT INTO prescriptions (id, prescription_code, medical_record_id, status, "
                        + "replaces_prescription_id, replaces_prescription_code, replacement_reason) "
                        + "VALUES (?, ?, ?, ?, ?, ?, ?)")) {
            ps.setBytes(1, uuidBytes(id));
            ps.setString(2, code);
            ps.setBytes(3, uuidBytes(UUID.randomUUID()));
            ps.setString(4, status);
            ps.setBytes(5, replacesId == null ? null : uuidBytes(replacesId));
            ps.setString(6, replacesCode);
            ps.setString(7, reason);
            ps.executeUpdate();
        }
    }

    private void insertReplacement(
            Connection conn,
            UUID id,
            String code,
            UUID replacesId,
            String replacesCode,
            String reason
    ) throws SQLException {
        insertPrescription(conn, id, code, "PENDING_DISPENSE", replacesId, replacesCode, reason);
    }

    private String readResource(String path) throws Exception {
        try (InputStream in = getClass().getClassLoader().getResourceAsStream(path)) {
            assertNotNull(in, "Migration resource not found: " + path);
            return new String(in.readAllBytes(), StandardCharsets.UTF_8);
        }
    }

    private String hex(UUID uuid) {
        return "X'" + uuid.toString().replace("-", "").toUpperCase() + "'";
    }

    private byte[] uuidBytes(UUID uuid) {
        byte[] bytes = new byte[16];
        ByteBuffer.wrap(bytes).putLong(uuid.getMostSignificantBits()).putLong(uuid.getLeastSignificantBits());
        return bytes;
    }
}
