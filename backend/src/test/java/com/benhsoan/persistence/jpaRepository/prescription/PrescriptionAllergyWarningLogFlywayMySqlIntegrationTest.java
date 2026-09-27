package com.benhsoan.persistence.jpaRepository.prescription;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.MySQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@Testcontainers(disabledWithoutDocker = true)
@SpringBootTest(properties = {
        "spring.jpa.show-sql=false",
        "logging.level.org.hibernate.SQL=WARN",
        "logging.level.org.hibernate.orm.jdbc.bind=WARN"
})
@DisplayName("PrescriptionAllergyWarningLog Flyway MySQL Integration Tests (V41)")
class PrescriptionAllergyWarningLogFlywayMySqlIntegrationTest {

    @Container
    @SuppressWarnings("resource")
    static final MySQLContainer<?> MYSQL = new MySQLContainer<>("mysql:8.4")
            .withDatabaseName("pawl_mysql_test")
            .withUsername("pawl_test")
            .withPassword("pawl_test");

    @DynamicPropertySource
    static void databaseProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", MYSQL::getJdbcUrl);
        registry.add("spring.datasource.username", MYSQL::getUsername);
        registry.add("spring.datasource.password", MYSQL::getPassword);
        registry.add("spring.datasource.driver-class-name", MYSQL::getDriverClassName);
    }

    @Autowired
    private JdbcTemplate jdbc;

    private static final String SEEDED_PRESCRIPTION_ID = "16200000-0000-0000-0000-000000000001";
    private static final String SEEDED_PATIENT_ID = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb001";
    private static final String SEEDED_DOCTOR_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2";
    private static final String SEEDED_MEDICINE_ID = "16000000-0000-0000-0000-000000000003";

    @Test
    @DisplayName("MySQL V41: Bảng prescription_allergy_warning_logs tồn tại đủ 13 cột và các index")
    void schema_tableColumnsAndIndexesExist() {
        Integer tableCount = jdbc.queryForObject(
                "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'prescription_allergy_warning_logs'",
                Integer.class
        );
        assertEquals(1, tableCount);

        Integer columnCount = jdbc.queryForObject(
                """
                SELECT COUNT(*) FROM information_schema.columns
                WHERE table_schema = DATABASE() AND table_name = 'prescription_allergy_warning_logs'
                AND column_name IN (
                    'id', 'prescription_id', 'patient_id', 'allergy_id', 'medicine_id',
                    'active_ingredient', 'allergen_name', 'severity', 'reaction',
                    'override_reason', 'handled_by', 'handled_at', 'created_at'
                )
                """,
                Integer.class
        );
        assertEquals(13, columnCount);

        List<String> indexes = jdbc.queryForList(
                "SELECT DISTINCT index_name FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'prescription_allergy_warning_logs'",
                String.class
        );
        assertTrue(indexes.contains("PRIMARY"));
        assertTrue(indexes.contains("idx_pawl_prescription"));
        assertTrue(indexes.contains("idx_pawl_patient"));
        assertTrue(indexes.contains("idx_pawl_handled_by"));
        assertTrue(indexes.contains("idx_pawl_handled_at"));
    }

    @Test
    @DisplayName("MySQL V41: Quyền PRESCRIPTION_ALLERGY_WARNING_VIEW được khởi tạo và gán cho vai trò ADMIN")
    void seed_permissionGrantedToAdminRole() {
        Integer permCount = jdbc.queryForObject(
                "SELECT COUNT(*) FROM permissions WHERE code = 'PRESCRIPTION_ALLERGY_WARNING_VIEW'",
                Integer.class
        );
        assertEquals(1, permCount);

        Integer adminPermCount = jdbc.queryForObject(
                """
                SELECT COUNT(*) FROM role_permissions rp
                JOIN permissions p ON rp.permission_id = p.id
                WHERE rp.role_id = UUID_TO_BIN('11111111-1111-1111-1111-111111111111')
                AND p.code = 'PRESCRIPTION_ALLERGY_WARNING_VIEW'
                """,
                Integer.class
        );
        assertEquals(1, adminPermCount);
    }

    @Test
    @DisplayName("MySQL V41: Khóa ngoại ON DELETE CASCADE tự động xóa warning logs khi đơn thuốc bị xóa")
    void cascadeDelete_whenPrescriptionDeleted_warningLogsCascaded() {
        UUID tempPrescriptionId = UUID.randomUUID();
        UUID tempAllergyId = UUID.randomUUID();
        UUID logId = UUID.randomUUID();

        // 1. Tạo đơn thuốc tạm thời
        jdbc.update(
                """
                INSERT INTO prescriptions (
                    id, prescription_code, medical_record_id, status, note,
                    prescribed_by, prescribed_at, updated_by, updated_at
                ) VALUES (
                    UUID_TO_BIN(?), ?, UUID_TO_BIN('e0000000-0000-0000-0000-000000000001'),
                    'PENDING_DISPENSE', 'Test cascade', UUID_TO_BIN(?), NOW(), NULL, NULL
                )
                """,
                tempPrescriptionId.toString(),
                "RX-CAS-" + tempPrescriptionId.toString().substring(0, 6),
                SEEDED_DOCTOR_ID
        );

        // 2. Tạo dị ứng thuốc tạm thời
        jdbc.update(
                """
                INSERT INTO patient_allergies (
                    id, patient_id, allergen_type, allergen_name, normalized_allergen_name,
                    severity, reaction, active, created_by, created_at, updated_by, updated_at
                ) VALUES (
                    UUID_TO_BIN(?), UUID_TO_BIN(?), 'MEDICATION', 'Amoxicillin Test', 'amoxicillin test',
                    'SEVERE', 'Rash', TRUE, UUID_TO_BIN(?), NOW(), NULL, NOW()
                )
                """,
                tempAllergyId.toString(),
                SEEDED_PATIENT_ID,
                SEEDED_DOCTOR_ID
        );

        // 3. Ghi log cảnh báo dị ứng
        jdbc.update(
                """
                INSERT INTO prescription_allergy_warning_logs (
                    id, prescription_id, patient_id, allergy_id, medicine_id,
                    active_ingredient, allergen_name, severity, reaction,
                    override_reason, handled_by, handled_at, created_at
                ) VALUES (
                    UUID_TO_BIN(?), UUID_TO_BIN(?), UUID_TO_BIN(?), UUID_TO_BIN(?), UUID_TO_BIN(?),
                    'Amoxicillin', 'Amoxicillin Test', 'SEVERE', 'Rash',
                    'Clinical override benefit', UUID_TO_BIN(?), NOW(), NOW()
                )
                """,
                logId.toString(),
                tempPrescriptionId.toString(),
                SEEDED_PATIENT_ID,
                tempAllergyId.toString(),
                SEEDED_MEDICINE_ID,
                SEEDED_DOCTOR_ID
        );

        Integer countBefore = jdbc.queryForObject(
                "SELECT COUNT(*) FROM prescription_allergy_warning_logs WHERE id = UUID_TO_BIN(?)",
                Integer.class,
                logId.toString()
        );
        assertEquals(1, countBefore);

        // 4. Xóa đơn thuốc -> MySQL trigger ON DELETE CASCADE
        jdbc.update("DELETE FROM prescriptions WHERE id = UUID_TO_BIN(?)", tempPrescriptionId.toString());

        Integer countAfter = jdbc.queryForObject(
                "SELECT COUNT(*) FROM prescription_allergy_warning_logs WHERE id = UUID_TO_BIN(?)",
                Integer.class,
                logId.toString()
        );
        assertEquals(0, countAfter);
    }

    @Test
    @DisplayName("MySQL V41: Check constraints từ chối severity không hợp lệ và override_reason rỗng")
    void checkConstraints_rejectInvalidSeverityAndBlankOverrideReason() {
        UUID allergyId = UUID.randomUUID();
        jdbc.update(
                """
                INSERT INTO patient_allergies (
                    id, patient_id, allergen_type, allergen_name, normalized_allergen_name,
                    severity, reaction, active, created_by, created_at, updated_by, updated_at
                ) VALUES (
                    UUID_TO_BIN(?), UUID_TO_BIN(?), 'MEDICATION', 'Aspirin Test', 'aspirin test',
                    'MILD', 'Itch', TRUE, UUID_TO_BIN(?), NOW(), NULL, NOW()
                )
                """,
                allergyId.toString(),
                SEEDED_PATIENT_ID,
                SEEDED_DOCTOR_ID
        );

        // 1. Severity sai ('INVALID_SEVERITY')
        assertThrows(DataIntegrityViolationException.class, () -> jdbc.update(
                """
                INSERT INTO prescription_allergy_warning_logs (
                    id, prescription_id, patient_id, allergy_id, medicine_id,
                    active_ingredient, allergen_name, severity, reaction,
                    override_reason, handled_by, handled_at, created_at
                ) VALUES (
                    UUID_TO_BIN(?), UUID_TO_BIN(?), UUID_TO_BIN(?), UUID_TO_BIN(?), UUID_TO_BIN(?),
                    'Aspirin', 'Aspirin Test', 'INVALID_SEVERITY', 'Itch',
                    'Valid override reason', UUID_TO_BIN(?), NOW(), NOW()
                )
                """,
                UUID.randomUUID().toString(),
                SEEDED_PRESCRIPTION_ID,
                SEEDED_PATIENT_ID,
                allergyId.toString(),
                SEEDED_MEDICINE_ID,
                SEEDED_DOCTOR_ID
        ));

        // 2. Override reason rỗng / whitespace ('   ')
        assertThrows(DataIntegrityViolationException.class, () -> jdbc.update(
                """
                INSERT INTO prescription_allergy_warning_logs (
                    id, prescription_id, patient_id, allergy_id, medicine_id,
                    active_ingredient, allergen_name, severity, reaction,
                    override_reason, handled_by, handled_at, created_at
                ) VALUES (
                    UUID_TO_BIN(?), UUID_TO_BIN(?), UUID_TO_BIN(?), UUID_TO_BIN(?), UUID_TO_BIN(?),
                    'Aspirin', 'Aspirin Test', 'MILD', 'Itch',
                    '    ', UUID_TO_BIN(?), NOW(), NOW()
                )
                """,
                UUID.randomUUID().toString(),
                SEEDED_PRESCRIPTION_ID,
                SEEDED_PATIENT_ID,
                allergyId.toString(),
                SEEDED_MEDICINE_ID,
                SEEDED_DOCTOR_ID
        ));
    }
}
