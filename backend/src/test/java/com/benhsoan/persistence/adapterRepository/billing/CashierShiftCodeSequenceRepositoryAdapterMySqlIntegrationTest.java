package com.benhsoan.persistence.adapterRepository.billing;

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
import org.junit.jupiter.api.DisplayName;
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

import com.benhsoan.port.outbound.repository.billing.CashierShiftCodeSequenceRepository;

@Testcontainers(disabledWithoutDocker = true)
@SpringBootTest(properties = {
        "spring.jpa.show-sql=false",
        "logging.level.org.hibernate.SQL=WARN",
        "logging.level.org.hibernate.orm.jdbc.bind=WARN"
})
@DisplayName("CashierShiftCodeSequence MySQL & Flyway Integration Tests")
class CashierShiftCodeSequenceRepositoryAdapterMySqlIntegrationTest {

    @Container
    @SuppressWarnings("resource")
    static final MySQLContainer<?> MYSQL = new MySQLContainer<>("mysql:8.4")
            .withDatabaseName("cashier_shift_sequence_test")
            .withUsername("cashier_test")
            .withPassword("cashier_test");

    @DynamicPropertySource
    static void databaseProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", MYSQL::getJdbcUrl);
        registry.add("spring.datasource.username", MYSQL::getUsername);
        registry.add("spring.datasource.password", MYSQL::getPassword);
        registry.add("spring.datasource.driver-class-name", MYSQL::getDriverClassName);
    }

    @Autowired
    private CashierShiftCodeSequenceRepository sequenceRepository;

    @Autowired
    private PlatformTransactionManager transactionManager;

    @Autowired
    private JdbcTemplate jdbc;

    @BeforeEach
    void resetSequence() {
        jdbc.update("DELETE FROM cashier_shift_code_sequences WHERE code_prefix = ?", "CS");
    }

    @Test
    @DisplayName("P2: MySQL ON DUPLICATE KEY UPDATE tăng sequence nguyên tử, không trùng lặp khi chạy đồng thời")
    void reservesDistinctConsecutiveValuesForConcurrentMySqlTransactions() throws Exception {
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
                "SELECT `last_value` FROM cashier_shift_code_sequences WHERE code_prefix = ?",
                Long.class,
                "CS"
        ));
    }

    @Test
    @DisplayName("P0: Flyway migration tạo đúng schema cashier_shifts, sequence và permissions không lỗi")
    void flywayCreatesCashierShiftSchemaAndAssignsPermissions() {
        assertEquals(1, jdbc.queryForObject(
                "SELECT COUNT(*) FROM information_schema.tables "
                        + "WHERE table_schema = DATABASE() AND table_name = 'cashier_shifts'",
                Integer.class));

        assertEquals(1, jdbc.queryForObject(
                "SELECT COUNT(*) FROM information_schema.tables "
                        + "WHERE table_schema = DATABASE() AND table_name = 'cashier_shift_code_sequences'",
                Integer.class));

        assertEquals(3, jdbc.queryForObject(
                "SELECT COUNT(*) FROM permissions WHERE code IN (?, ?, ?)", Integer.class,
                "CASHIER_SHIFT_READ",
                "CASHIER_SHIFT_CREATE",
                "CASHIER_SHIFT_CONFIRM"));
    }

    private Long reserveAfterStart(CountDownLatch ready, CountDownLatch start) throws Exception {
        ready.countDown();
        start.await();
        return new TransactionTemplate(transactionManager).execute(
                status -> sequenceRepository.reserveNextValue("CS")
        );
    }
}
