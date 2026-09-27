package com.benhsoan.persistence.jpaRepository.medicalrecord;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

import com.benhsoan.domain.medicalrecord.MedicalRecordTemplate;
import com.benhsoan.domain.medicalrecord.MedicalRecordTemplateVersion.SectionDefinition;
import com.benhsoan.domain.medicalrecord.enums.MedicalRecordFieldCode;
import com.benhsoan.port.outbound.repository.medicalrecord.MedicalRecordTemplateRepository;

import org.testcontainers.containers.MySQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@SpringBootTest
@Testcontainers(disabledWithoutDocker = true)
class MedicalRecordTemplateSchemaIntegrationTest {

    private static final String ADMIN_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1";
    private static final String GENERAL_SPECIALTY_ID = "f0000000-0000-0000-0000-000000000001";

    @Container
    @SuppressWarnings("resource")
    static final MySQLContainer<?> MYSQL = new MySQLContainer<>("mysql:8.4")
            .withDatabaseName("medical_record_template_test")
            .withUsername("template_test")
            .withPassword("template_test");

    @DynamicPropertySource
    static void databaseProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", MYSQL::getJdbcUrl);
        registry.add("spring.datasource.username", MYSQL::getUsername);
        registry.add("spring.datasource.password", MYSQL::getPassword);
        registry.add("spring.datasource.driver-class-name", MYSQL::getDriverClassName);
    }

    @Autowired
    private JdbcTemplate jdbc;
    @Autowired
    private MedicalRecordTemplateRepository templateRepository;

    @Test
    void migrationsSeedSpecialtiesTemplatesAndGrantOnlyAdminTemplateManagement() {
        assertEquals(1, count("SELECT COUNT(*) FROM flyway_schema_history WHERE version = '29' AND success = TRUE"));
        assertEquals(1, count("SELECT COUNT(*) FROM flyway_schema_history WHERE version = '30' AND success = TRUE"));
        assertEquals(1, count("SELECT COUNT(*) FROM specialties WHERE code = 'GENERAL' AND active = TRUE"));
        assertEquals(1, count("SELECT COUNT(*) FROM specialties WHERE code = 'INTERNAL_MEDICINE' AND active = TRUE"));
        assertEquals(4, count("SELECT COUNT(*) FROM medical_record_templates WHERE active = TRUE"));
        assertEquals(2, count("SELECT COUNT(*) FROM medical_record_templates WHERE active = TRUE AND is_default = TRUE"));
        assertEquals(29, count("SELECT COUNT(*) FROM medical_record_template_sections"));
        assertEquals(0, count("SELECT COUNT(*) FROM visits WHERE specialty_id IS NULL"));
        assertTrue(count("""
                SELECT COUNT(*)
                FROM visits visit
                JOIN specialties specialty ON specialty.id = visit.specialty_id
                WHERE specialty.code = 'GENERAL'
                """) > 0);
        assertEquals(1, count("""
                SELECT COUNT(*)
                FROM role_permissions role_permission
                JOIN roles role ON role.id = role_permission.role_id
                JOIN permissions permission ON permission.id = role_permission.permission_id
                WHERE role.name = 'ADMIN' AND permission.code = 'MEDICAL_RECORD_TEMPLATE_MANAGE'
                """));
        assertEquals(0, count("""
                SELECT COUNT(*)
                FROM role_permissions role_permission
                JOIN roles role ON role.id = role_permission.role_id
                JOIN permissions permission ON permission.id = role_permission.permission_id
                WHERE role.name <> 'ADMIN' AND permission.code = 'MEDICAL_RECORD_TEMPLATE_MANAGE'
                """));
    }

    private static final String TEST_SPECIALTY_ID = "f0000000-0000-0000-0000-000000000099";

    @Test
    void schemaEnforcesTemplateVersionAndSectionUniqueness() {
        jdbc.update("""
                INSERT INTO specialties (id, code, name, active, created_at, updated_at)
                VALUES (UUID_TO_BIN(?), 'TEMP_TEST', 'Temp Test Specialty', TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                ON DUPLICATE KEY UPDATE name = 'Temp Test Specialty'
                """, TEST_SPECIALTY_ID);
        jdbc.update("UPDATE medical_records SET applied_template_version_id = NULL WHERE applied_template_version_id IN (SELECT id FROM medical_record_template_versions WHERE specialty_id = UUID_TO_BIN(?))", TEST_SPECIALTY_ID);
        jdbc.update("DELETE FROM medical_record_template_sections WHERE template_version_id IN (SELECT id FROM medical_record_template_versions WHERE specialty_id = UUID_TO_BIN(?))", TEST_SPECIALTY_ID);
        jdbc.update("DELETE FROM medical_record_template_versions WHERE specialty_id = UUID_TO_BIN(?)", TEST_SPECIALTY_ID);
        jdbc.update("DELETE FROM medical_record_templates WHERE specialty_id = UUID_TO_BIN(?)", TEST_SPECIALTY_ID);

        insertTemplate("f0000000-0000-0000-0000-000000000011", TEST_SPECIALTY_ID, "General examination", "general examination", true);

        assertThrows(DataIntegrityViolationException.class, () ->
                insertTemplate("f0000000-0000-0000-0000-000000000012", TEST_SPECIALTY_ID, " GENERAL EXAMINATION ", "general examination", false));
        assertThrows(DataIntegrityViolationException.class, () ->
                insertTemplate("f0000000-0000-0000-0000-000000000013", TEST_SPECIALTY_ID, "General follow-up", "general follow-up", true));

        String templateId = "f0000000-0000-0000-0000-000000000011";
        String versionId = "f0000000-0000-0000-0000-000000000021";
        insertVersion(versionId, templateId, TEST_SPECIALTY_ID, 1);
        assertThrows(DataIntegrityViolationException.class, () ->
                insertVersion("f0000000-0000-0000-0000-000000000022", templateId, TEST_SPECIALTY_ID, 1));

        insertSection("f0000000-0000-0000-0000-000000000031", versionId, "CHIEF_COMPLAINT", 1);
        assertThrows(DataIntegrityViolationException.class, () ->
                insertSection("f0000000-0000-0000-0000-000000000032", versionId, "CHIEF_COMPLAINT", 2));
        assertThrows(DataIntegrityViolationException.class, () ->
                insertSection("f0000000-0000-0000-0000-000000000033", versionId, "SYMPTOMS", 1));

        jdbc.update("DELETE FROM medical_record_template_sections WHERE template_version_id IN (SELECT id FROM medical_record_template_versions WHERE specialty_id = UUID_TO_BIN(?))", TEST_SPECIALTY_ID);
        jdbc.update("DELETE FROM medical_record_template_versions WHERE specialty_id = UUID_TO_BIN(?)", TEST_SPECIALTY_ID);
        jdbc.update("DELETE FROM medical_record_templates WHERE specialty_id = UUID_TO_BIN(?)", TEST_SPECIALTY_ID);
        jdbc.update("DELETE FROM specialties WHERE id = UUID_TO_BIN(?)", TEST_SPECIALTY_ID);
    }

    @Test
    void persistenceLoadsSectionsByOrderAndPreservesOldVersionAfterUpdate() {
        UUID specialtyId = UUID.fromString(GENERAL_SPECIALTY_ID);
        UUID adminId = UUID.fromString(ADMIN_ID);
        MedicalRecordTemplate template = MedicalRecordTemplate.create(specialtyId, "Persistence examination", false,
                List.of(new SectionDefinition(MedicalRecordFieldCode.CONCLUSION, "Conclusion", false, 2),
                        new SectionDefinition(MedicalRecordFieldCode.CHIEF_COMPLAINT, "Chief complaint", true, 1)),
                adminId, Instant.parse("2026-08-26T00:00:00Z"));
        MedicalRecordTemplate saved = templateRepository.save(template);

        assertEquals(MedicalRecordFieldCode.CHIEF_COMPLAINT,
                saved.getCurrentVersion().getSections().getFirst().getFieldCode());
        saved.update("Persistence follow-up",
                List.of(new SectionDefinition(MedicalRecordFieldCode.CHIEF_COMPLAINT, "Updated complaint", true, 1)),
                "Revision", adminId, Instant.parse("2026-08-26T00:01:00Z"));
        templateRepository.save(saved);

        MedicalRecordTemplate reloaded = templateRepository.findById(saved.getId()).orElseThrow();
        assertEquals(2, reloaded.getVersions().size());
        assertEquals("Persistence examination", reloaded.getVersions().getFirst().getTemplateName());
        assertEquals("Chief complaint", reloaded.getVersions().getFirst().getSections().getFirst().getLabel());
        assertEquals("Persistence follow-up", reloaded.getCurrentVersion().getTemplateName());
    }

    private void insertTemplate(String id, String specialtyId, String name, String nameKey, boolean defaultTemplate) {
        jdbc.update("""
                INSERT INTO medical_record_templates (
                    id, specialty_id, name, name_key, active, is_default, current_version_no, created_by, created_at
                ) VALUES (
                    UUID_TO_BIN(?), UUID_TO_BIN(?), ?, ?, TRUE, ?, 1, UUID_TO_BIN(?), CURRENT_TIMESTAMP
                )
                """, id, specialtyId, name, nameKey, defaultTemplate, ADMIN_ID);
    }

    private void insertVersion(String id, String templateId, String specialtyId, int versionNo) {
        jdbc.update("""
                INSERT INTO medical_record_template_versions (
                    id, template_id, version_no, specialty_id, template_name, created_by, created_at
                ) VALUES (
                    UUID_TO_BIN(?), UUID_TO_BIN(?), ?, UUID_TO_BIN(?), 'General examination', UUID_TO_BIN(?), CURRENT_TIMESTAMP
                )
                """, id, templateId, versionNo, specialtyId, ADMIN_ID);
    }

    private void insertSection(String id, String versionId, String fieldCode, int displayOrder) {
        jdbc.update("""
                INSERT INTO medical_record_template_sections (
                    id, template_version_id, field_code, label, required, display_order
                ) VALUES (UUID_TO_BIN(?), UUID_TO_BIN(?), ?, 'Section', TRUE, ?)
                """, id, versionId, fieldCode, displayOrder);
    }

    private int count(String sql) {
        return jdbc.queryForObject(sql, Integer.class);
    }
}
