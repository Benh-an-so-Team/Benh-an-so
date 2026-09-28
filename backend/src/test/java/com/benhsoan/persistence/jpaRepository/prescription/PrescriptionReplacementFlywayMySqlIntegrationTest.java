package com.benhsoan.persistence.jpaRepository.prescription;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
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
@DisplayName("Prescription replacement Flyway MySQL Integration Tests (V107)")
class PrescriptionReplacementFlywayMySqlIntegrationTest {

    private static final String SEEDED_PENDING_PRESCRIPTION_ID = "16200000-0000-0000-0000-000000000005";

    @Container
    @SuppressWarnings("resource")
    static final MySQLContainer<?> MYSQL = new MySQLContainer<>("mysql:8.4")
            .withDatabaseName("prescription_replacement_test")
            .withUsername("prescription_replacement")
            .withPassword("prescription_replacement");

    @DynamicPropertySource
    static void databaseProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", MYSQL::getJdbcUrl);
        registry.add("spring.datasource.username", MYSQL::getUsername);
        registry.add("spring.datasource.password", MYSQL::getPassword);
        registry.add("spring.datasource.driver-class-name", MYSQL::getDriverClassName);
    }

    @Autowired
    private JdbcTemplate jdbc;

    @Test
    @DisplayName("MySQL V107: chk_prescriptions_status chấp nhận REPLACED")
    void checkConstraintAcceptsReplaced() {
        Integer constraintCount = jdbc.queryForObject(
                "SELECT COUNT(*) FROM information_schema.check_constraints "
                        + "WHERE constraint_schema = DATABASE() "
                        + "AND constraint_name = 'chk_prescriptions_status' "
                        + "AND check_clause LIKE '%REPLACED%'",
                Integer.class
        );
        assertEquals(1, constraintCount, "chk_prescriptions_status must include REPLACED");

        jdbc.update(
                "UPDATE prescriptions SET status = 'REPLACED' WHERE id = UUID_TO_BIN(?)",
                SEEDED_PENDING_PRESCRIPTION_ID
        );

        String persisted = jdbc.queryForObject(
                "SELECT status FROM prescriptions WHERE id = UUID_TO_BIN(?)",
                String.class,
                SEEDED_PENDING_PRESCRIPTION_ID
        );
        assertEquals("REPLACED", persisted, "REPLACED must be persisted and read back");
    }

    @Test
    @DisplayName("MySQL V107: replacement columns, unique link and cascade delete rule exist")
    void replacementSchemaIsApplied() {
        Integer columnCount = jdbc.queryForObject(
                "SELECT COUNT(*) FROM information_schema.columns "
                        + "WHERE table_schema = DATABASE() AND table_name = 'prescriptions' "
                        + "AND column_name IN ('replaces_prescription_id', "
                        + "'replaces_prescription_code', 'replacement_reason')",
                Integer.class
        );
        assertEquals(3, columnCount, "the three replacement columns must exist");

        String deleteRule = jdbc.queryForObject(
                "SELECT delete_rule FROM information_schema.referential_constraints "
                        + "WHERE constraint_schema = DATABASE() "
                        + "AND constraint_name = 'fk_prescriptions_replaces'",
                String.class
        );
        assertEquals("CASCADE", deleteRule);

        Integer uniqueIndex = jdbc.queryForObject(
                "SELECT COUNT(*) FROM information_schema.statistics "
                        + "WHERE table_schema = DATABASE() AND table_name = 'prescriptions' "
                        + "AND index_name = 'uk_prescriptions_replaces' AND non_unique = 0",
                Integer.class
        );
        assertTrue(uniqueIndex >= 1, "at most one replacement per original must be enforced");

        String reasonCheck = jdbc.queryForObject(
                "SELECT check_clause FROM information_schema.check_constraints "
                        + "WHERE constraint_schema = DATABASE() "
                        + "AND constraint_name = 'chk_prescriptions_replacement_link'",
                String.class
        );
        assertTrue(reasonCheck.contains("replacement_reason"));
    }
}
