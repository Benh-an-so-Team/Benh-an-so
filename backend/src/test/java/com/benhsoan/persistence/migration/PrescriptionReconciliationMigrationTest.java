package com.benhsoan.persistence.migration;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.stream.Collectors;
import java.util.stream.Stream;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * Guard for the locked NCL-12-CN-007 authorization rules at the migration level.
 *
 * NCL-12-CN-007 may only introduce the two reconciliation permissions. It must never grant
 * or modify an interconnection permission, because retransmission stays with the untouched
 * NCL-12-CN-004 flow (PRESCRIPTION_INTERCONNECTION_RETRY, ADMIN only). A pharmacist must not
 * gain retransmission capability through this story.
 *
 * Comments are stripped before asserting so the migration header may still document the
 * constraint it is honouring without tripping the guard.
 */
@DisplayName("V102 reconciliation migration - locked authorization rules")
class PrescriptionReconciliationMigrationTest {

    private static final Path MIGRATION = Path.of(
            "src/main/resources/db/migration/V102__create_prescription_reconciliation_schema.sql");

    private String executableSql() throws IOException {
        return Files.readString(MIGRATION).lines()
                .filter(line -> !line.trim().startsWith("--"))
                .collect(Collectors.joining("\n"));
    }

    @Test
    void introducesExactlyTheTwoReconciliationPermissions() throws IOException {
        String sql = executableSql();

        assertTrue(sql.contains("'PRESCRIPTION_RECONCILIATION_VIEW'"));
        assertTrue(sql.contains("'PRESCRIPTION_RECONCILIATION_NOTE'"));
    }

    @Test
    void neverGrantsOrModifiesAnyInterconnectionPermission() throws IOException {
        String sql = executableSql();

        assertFalse(sql.contains("PRESCRIPTION_INTERCONNECTION_RETRY"),
                "NCL-12-CN-007 must not grant the retry permission; it stays ADMIN only");
        assertFalse(sql.contains("PRESCRIPTION_INTERCONNECTION_SEND"));
        assertFalse(sql.contains("PRESCRIPTION_INTERCONNECTION_READ"));
    }

    @Test
    void grantsReconciliationPermissionsOnlyToAdminAndPharmacist() throws IOException {
        String sql = executableSql();

        assertTrue(sql.contains("'ADMIN', 'PHARMACIST'"));
        assertFalse(sql.contains("'RECEPTIONIST'"));
        assertFalse(sql.contains("'MANAGER'"));
    }

    @Test
    void createsOnlyTheAppendOnlyNoteTable() throws IOException {
        String sql = executableSql();

        assertTrue(sql.contains("CREATE TABLE prescription_reconciliation_notes"));
        // The story reuses the existing prescription, interconnection, dispensing and audit tables.
        assertFalse(sql.contains("ALTER TABLE prescriptions"));
        assertFalse(sql.contains("ALTER TABLE prescription_items"));
        assertFalse(sql.contains("ALTER TABLE prescription_interconnection_logs"));
        assertFalse(sql.contains("CREATE TABLE prescription_interconnection_logs"));
        assertFalse(sql.contains("CREATE TABLE prescription_interconnection"));
        assertFalse(sql.contains("CREATE TABLE prescription_dispense_items"));
        assertFalse(sql.contains("CREATE TABLE audit_logs"));
        assertFalse(sql.contains("CREATE TABLE prescriptions"));
    }

    /**
     * Guards the P0 defect this story hit twice: version 101 was taken by
     * {@code add_guardian_link_review_notifications} on develop, which made Flyway fail with
     * "Found more than one migration with version 101". The schema must own exactly one version.
     */
    @Test
    void versionIsUniqueAcrossTheMigrationDirectory() throws IOException {
        try (Stream<Path> files = Files.list(MIGRATION.getParent())) {
            List<String> version102 = files.map(path -> path.getFileName().toString())
                    .filter(name -> name.startsWith("V102__"))
                    .toList();
            assertEquals(1, version102.size(),
                    "expected exactly one V102 migration but found: " + version102);
            assertTrue(version102.get(0).contains("prescription_reconciliation"));
        }
    }
}
