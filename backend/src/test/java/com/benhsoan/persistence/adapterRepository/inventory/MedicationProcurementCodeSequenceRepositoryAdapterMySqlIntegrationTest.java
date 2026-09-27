package com.benhsoan.persistence.adapterRepository.inventory;

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

import com.benhsoan.port.outbound.generator.MedicationProcurementCodeGenerator;
import com.benhsoan.port.outbound.repository.inventory.MedicationProcurementCodeSequenceRepository;

@Testcontainers(disabledWithoutDocker = true)
@SpringBootTest(properties = {
        "spring.jpa.show-sql=false",
        "logging.level.org.hibernate.SQL=WARN",
        "logging.level.org.hibernate.orm.jdbc.bind=WARN"
})
@DisplayName("Medication Procurement Code Sequence MySQL Integration Test (NCL-06-CN-012 / P3-05)")
class MedicationProcurementCodeSequenceRepositoryAdapterMySqlIntegrationTest {

    @Container
    @SuppressWarnings("resource")
    static final MySQLContainer<?> MYSQL = new MySQLContainer<>("mysql:8.4")
            .withDatabaseName("medication_procurement_code_sequence_test")
            .withUsername("procurement_test")
            .withPassword("procurement_test");

    @DynamicPropertySource
    static void databaseProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", MYSQL::getJdbcUrl);
        registry.add("spring.datasource.username", MYSQL::getUsername);
        registry.add("spring.datasource.password", MYSQL::getPassword);
        registry.add("spring.datasource.driver-class-name", MYSQL::getDriverClassName);
    }

    @Autowired private MedicationProcurementCodeSequenceRepository sequenceRepository;
    @Autowired private MedicationProcurementCodeGenerator codeGenerator;
    @Autowired private PlatformTransactionManager transactionManager;
    @Autowired private JdbcTemplate jdbc;

    @BeforeEach
    void resetSequence() {
        jdbc.update("DELETE FROM medication_procurement_code_sequences WHERE code_prefix = ?", "DT");
    }

    @Test
    @DisplayName("Cấp phát giá trị sequence duy nhất, tăng liên tiếp khi gọi đồng thời từ nhiều transaction MySQL (P3-05)")
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
                "SELECT `last_value` FROM medication_procurement_code_sequences WHERE code_prefix = ?",
                Long.class,
                "DT"
        ));
    }

    @Test
    @DisplayName("Bộ sinh mã DatabaseMedicationProcurementCodeGenerator định dạng chuẩn DT000001, DT000002")
    void generatesFormattedDocumentCodesWithPrefixAndPadding() {
        String code1 = codeGenerator.generate();
        String code2 = codeGenerator.generate();

        assertEquals("DT000001", code1);
        assertEquals("DT000002", code2);
    }

    @Test
    @DisplayName("Flyway V90 khởi tạo đúng cấu trúc bảng và quyền phân hệ dự trù mua thuốc")
    void flywayCreatesProcurementTablesAndSeedsPermissions() {
        assertEquals(1, jdbc.queryForObject(
                "SELECT COUNT(*) FROM information_schema.tables "
                        + "WHERE table_schema = DATABASE() AND table_name = 'medication_procurement_code_sequences'",
                Integer.class));
        assertEquals(1, jdbc.queryForObject(
                "SELECT COUNT(*) FROM information_schema.tables "
                        + "WHERE table_schema = DATABASE() AND table_name = 'medication_procurement_plans'",
                Integer.class));
        assertEquals(1, jdbc.queryForObject(
                "SELECT COUNT(*) FROM information_schema.tables "
                        + "WHERE table_schema = DATABASE() AND table_name = 'medication_procurement_items'",
                Integer.class));

        assertEquals(3, jdbc.queryForObject(
                "SELECT COUNT(*) FROM permissions WHERE code IN (?, ?, ?)", Integer.class,
                "MEDICATION_PROCUREMENT_READ",
                "MEDICATION_PROCUREMENT_CREATE",
                "MEDICATION_PROCUREMENT_APPROVE"));
    }

    private long reserveAfterStart(CountDownLatch ready, CountDownLatch start)
            throws InterruptedException {
        ready.countDown();
        start.await();
        return new TransactionTemplate(transactionManager).execute(status ->
                sequenceRepository.reserveNextValue("DT")
        );
    }
}
