package com.benhsoan.persistence.adapterRepository.prescription;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.Set;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.testcontainers.containers.MySQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import com.benhsoan.port.outbound.repository.prescription.PrescriptionCodeSequenceRepository;

@Testcontainers(disabledWithoutDocker = true)
@SpringBootTest(properties = {
        "spring.jpa.show-sql=false",
        "logging.level.org.hibernate.SQL=WARN",
        "logging.level.org.hibernate.orm.jdbc.bind=WARN"
})
class PrescriptionCodeSequenceRepositoryAdapterMySqlIntegrationTest {

    @Container
    @SuppressWarnings("resource")
    static final MySQLContainer<?> MYSQL = new MySQLContainer<>("mysql:8.4")
            .withDatabaseName("prescription_code_sequence_test")
            .withUsername("prescription_test")
            .withPassword("prescription_test");

    @DynamicPropertySource
    static void databaseProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", MYSQL::getJdbcUrl);
        registry.add("spring.datasource.username", MYSQL::getUsername);
        registry.add("spring.datasource.password", MYSQL::getPassword);
        registry.add("spring.datasource.driver-class-name", MYSQL::getDriverClassName);
    }

    @Autowired private PrescriptionCodeSequenceRepository sequenceRepository;
    @Autowired private PlatformTransactionManager transactionManager;
    @Autowired private JdbcTemplate jdbc;

    @BeforeEach
    void resetSequence() {
        jdbc.update("DELETE FROM prescription_code_sequences WHERE code_prefix = ?", "RX");
    }

    @Test
    void reservesDistinctConsecutiveValuesForConcurrentMySqlTransactions()
            throws Exception {
        CountDownLatch ready = new CountDownLatch(2);
        CountDownLatch start = new CountDownLatch(1);

        try (ExecutorService executor = Executors.newFixedThreadPool(2)) {
            List<Future<Long>> reservedValues = List.of(
                    executor.submit(() -> reserveAfterStart(ready, start)),
                    executor.submit(() -> reserveAfterStart(ready, start))
            );
            assertTrue(ready.await(5, TimeUnit.SECONDS));
            start.countDown();

            assertEquals(
                    Set.of(1L, 2L),
                    Set.of(
                            reservedValues.get(0).get(5, TimeUnit.SECONDS),
                            reservedValues.get(1).get(5, TimeUnit.SECONDS)
                    )
            );
        }
        assertEquals(2L, jdbc.queryForObject(
                "SELECT `last_value` FROM prescription_code_sequences WHERE code_prefix = ?",
                Long.class,
                "RX"
        ));
    }

    @Test
    void flywayCreatesInterconnectionSchemaAndAssignsDedicatedPermissions() {
        assertEquals(1, jdbc.queryForObject(
                "SELECT COUNT(*) FROM information_schema.tables "
                        + "WHERE table_schema = DATABASE() AND table_name = 'prescription_interconnection_logs'",
                Integer.class));
        assertEquals(3, jdbc.queryForObject(
                "SELECT COUNT(*) FROM permissions WHERE code IN (?, ?, ?)", Integer.class,
                "PRESCRIPTION_INTERCONNECTION_SEND",
                "PRESCRIPTION_INTERCONNECTION_READ",
                "PRESCRIPTION_INTERCONNECTION_RETRY"));
        assertEquals(1, jdbc.queryForObject(
                "SELECT COUNT(*) FROM role_permissions rp JOIN roles r ON r.id = rp.role_id "
                        + "JOIN permissions p ON p.id = rp.permission_id "
                        + "WHERE r.name = 'DOCTOR' AND p.code = 'PRESCRIPTION_INTERCONNECTION_SEND'",
                Integer.class));
        assertEquals(2, jdbc.queryForObject(
                "SELECT COUNT(*) FROM role_permissions rp JOIN roles r ON r.id = rp.role_id "
                        + "JOIN permissions p ON p.id = rp.permission_id "
                        + "WHERE r.name = 'ADMIN' AND p.code IN (?, ?)",
                Integer.class,
                "PRESCRIPTION_INTERCONNECTION_READ",
                "PRESCRIPTION_INTERCONNECTION_RETRY"));
        assertEquals(0, jdbc.queryForObject(
                "SELECT COUNT(*) FROM role_permissions rp JOIN roles r ON r.id = rp.role_id "
                        + "JOIN permissions p ON p.id = rp.permission_id "
                        + "WHERE r.name = 'PHARMACIST' AND p.code LIKE 'PRESCRIPTION_INTERCONNECTION_%'",
                Integer.class));
    }

    private long reserveAfterStart(CountDownLatch ready, CountDownLatch start)
            throws InterruptedException {
        ready.countDown();
        start.await();
        return new TransactionTemplate(transactionManager).execute(status ->
                sequenceRepository.reserveNextValue("RX")
        );
    }
}
