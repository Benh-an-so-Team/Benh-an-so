package com.benhsoan.persistence.migration;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;

import java.io.InputStream;
import java.io.StringReader;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;

import org.h2.tools.RunScript;
import org.junit.jupiter.api.Test;

/**
 * Executes the actual V106 data migration against H2 to prove the three demo
 * medicines become configured (strength_value_mg + max_daily_dose_mg) while
 * other medicines are left untouched.
 */
class V106ConfigureMedicineMaxDailyDoseDataH2Test {

    @Test
    void v106ConfiguresTheThreeDemoMedicinesByStableCode() throws Exception {
        try (Connection conn = DriverManager.getConnection(
                "jdbc:h2:mem:v106;DB_CLOSE_DELAY=-1", "sa", "")) {
            Statement stmt = conn.createStatement();
            stmt.execute("CREATE TABLE medicines ("
                    + "id BINARY(16) NOT NULL, "
                    + "medicine_code VARCHAR(30) NOT NULL, "
                    + "medicine_name VARCHAR(150) NOT NULL, "
                    + "strength_value_mg DECIMAL(12,3) NULL, "
                    + "max_daily_dose_mg DECIMAL(12,3) NULL, "
                    + "PRIMARY KEY (id))");

            seed(stmt, "MED-PARA-500");
            seed(stmt, "MED-IBU-400");
            seed(stmt, "MED-AMOX-500");
            seed(stmt, "MED-OTHER-10");

            String ddl = readResource("db/migration/V106__configure_medicine_max_daily_dose_data.sql");
            RunScript.execute(conn, new StringReader(ddl));

            assertConfigured(conn, "MED-PARA-500", "500", "4000");
            assertConfigured(conn, "MED-IBU-400", "400", "2400");
            assertConfigured(conn, "MED-AMOX-500", "500", "3000");

            try (ResultSet rs = stmt.executeQuery(
                    "SELECT strength_value_mg, max_daily_dose_mg FROM medicines "
                            + "WHERE medicine_code = 'MED-OTHER-10'")) {
                rs.next();
                assertNull(rs.getBigDecimal("strength_value_mg"));
                assertNull(rs.getBigDecimal("max_daily_dose_mg"));
            }
        }
    }

    private void seed(Statement stmt, String code) throws SQLException {
        try (PreparedStatement ps = stmt.getConnection().prepareStatement(
                "INSERT INTO medicines (id, medicine_code, medicine_name) VALUES (RANDOM_UUID(), ?, ?)")) {
            ps.setString(1, code);
            ps.setString(2, code + " name");
            ps.executeUpdate();
        }
    }

    private void assertConfigured(
            Connection conn,
            String code,
            String expectedStrength,
            String expectedMaxDose
    ) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT strength_value_mg, max_daily_dose_mg FROM medicines WHERE medicine_code = ?")) {
            ps.setString(1, code);
            try (ResultSet rs = ps.executeQuery()) {
                rs.next();
                assertEquals(0, new BigDecimal(expectedStrength)
                        .compareTo(rs.getBigDecimal("strength_value_mg")));
                assertEquals(0, new BigDecimal(expectedMaxDose)
                        .compareTo(rs.getBigDecimal("max_daily_dose_mg")));
            }
        }
    }

    private String readResource(String path) throws Exception {
        try (InputStream in = getClass().getClassLoader().getResourceAsStream(path)) {
            assertNotNull(in, "Migration resource not found: " + path);
            return new String(in.readAllBytes(), StandardCharsets.UTF_8);
        }
    }
}
