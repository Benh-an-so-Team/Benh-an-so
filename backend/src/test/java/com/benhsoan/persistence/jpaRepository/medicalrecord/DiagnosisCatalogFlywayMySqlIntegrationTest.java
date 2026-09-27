package com.benhsoan.persistence.jpaRepository.medicalrecord;

import static org.junit.jupiter.api.Assertions.assertEquals;

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
class DiagnosisCatalogFlywayMySqlIntegrationTest {

    @Container
    @SuppressWarnings("resource")
    static final MySQLContainer<?> MYSQL = new MySQLContainer<>("mysql:8.4")
            .withDatabaseName("diagnosis_catalog_test")
            .withUsername("diagnosis_test")
            .withPassword("diagnosis_test");

    @DynamicPropertySource
    static void databaseProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", MYSQL::getJdbcUrl);
        registry.add("spring.datasource.username", MYSQL::getUsername);
        registry.add("spring.datasource.password", MYSQL::getPassword);
        registry.add("spring.datasource.driver-class-name", MYSQL::getDriverClassName);
    }

    @Autowired private JdbcTemplate jdbc;

    @Test
    void flywayCreatesCategorizedCatalogAndAdminOnlyManagementPermission() {
        assertEquals(1, jdbc.queryForObject(
                "SELECT COUNT(*) FROM information_schema.columns "
                        + "WHERE table_schema = DATABASE() AND table_name = 'diagnosis_catalog' "
                        + "AND column_name = 'disease_group' AND is_nullable = 'NO'",
                Integer.class
        ));
        assertEquals(0, jdbc.queryForObject(
                "SELECT COUNT(*) FROM diagnosis_catalog WHERE disease_group IS NULL OR disease_group = ''",
                Integer.class
        ));
        assertEquals(1, jdbc.queryForObject(
                "SELECT COUNT(*) FROM permissions WHERE code = 'DIAGNOSIS_CATALOG_MANAGE'",
                Integer.class
        ));
        assertEquals(1, jdbc.queryForObject(
                "SELECT COUNT(*) FROM role_permissions rp "
                        + "JOIN roles r ON r.id = rp.role_id "
                        + "JOIN permissions p ON p.id = rp.permission_id "
                        + "WHERE r.name = 'ADMIN' AND p.code = 'DIAGNOSIS_CATALOG_MANAGE'",
                Integer.class
        ));
        assertEquals(0, jdbc.queryForObject(
                "SELECT COUNT(*) FROM role_permissions rp "
                        + "JOIN roles r ON r.id = rp.role_id "
                        + "JOIN permissions p ON p.id = rp.permission_id "
                        + "WHERE r.name <> 'ADMIN' AND p.code = 'DIAGNOSIS_CATALOG_MANAGE'",
                Integer.class
        ));
    }

    @Test
    void flywayKeepsFreeTextSecondaryDiagnosisColumnsNullableAndIndexed() {
        assertEquals(2, jdbc.queryForObject(
                "SELECT COUNT(*) FROM information_schema.columns "
                        + "WHERE table_schema = DATABASE() AND table_name = 'medical_record_diagnoses' "
                        + "AND column_name IN ('diagnosis_catalog_id', 'diagnosis_code') AND is_nullable = 'YES'",
                Integer.class
        ));
        assertEquals(1, jdbc.queryForObject(
                "SELECT COUNT(*) FROM information_schema.referential_constraints "
                        + "WHERE constraint_schema = DATABASE() AND constraint_name = 'fk_diagnoses_catalog'",
                Integer.class
        ));
        assertEquals(1, jdbc.queryForObject(
                "SELECT COUNT(*) FROM information_schema.statistics "
                        + "WHERE table_schema = DATABASE() AND table_name = 'medical_record_diagnoses' "
                        + "AND index_name = 'idx_diagnoses_catalog'",
                Integer.class
        ));
    }

    @Test
    void flywayAddsNormalizedSearchColumnsAndIndex() {
        assertEquals(2, jdbc.queryForObject(
                "SELECT COUNT(*) FROM information_schema.columns "
                        + "WHERE table_schema = DATABASE() AND table_name = 'diagnosis_catalog' "
                        + "AND column_name IN ('name_norm', 'abbreviation_norm') AND is_nullable = 'YES'",
                Integer.class
        ));
        assertEquals(1, jdbc.queryForObject(
                "SELECT COUNT(DISTINCT index_name) FROM information_schema.statistics "
                        + "WHERE table_schema = DATABASE() AND table_name = 'diagnosis_catalog' "
                        + "AND index_name = 'idx_diagnosis_catalog_active_name_norm'",
                Integer.class
        ));
    }
}
