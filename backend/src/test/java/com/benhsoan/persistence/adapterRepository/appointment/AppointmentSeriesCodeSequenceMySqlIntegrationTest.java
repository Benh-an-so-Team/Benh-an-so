package com.benhsoan.persistence.adapterRepository.appointment;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
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

import com.benhsoan.port.outbound.repository.appointment.AppointmentCodeSequenceRepository;

@Testcontainers(disabledWithoutDocker = true)
@SpringBootTest(properties = {
        "spring.jpa.show-sql=false",
        "logging.level.org.hibernate.SQL=WARN",
        "logging.level.org.hibernate.orm.jdbc.bind=WARN"
})
@DisplayName("AppointmentSeries and Sequence MySQL & Flyway Integration Tests")
class AppointmentSeriesCodeSequenceMySqlIntegrationTest {

    @Container
    @SuppressWarnings("resource")
    static final MySQLContainer<?> MYSQL = new MySQLContainer<>("mysql:8.4")
            .withDatabaseName("appointment_sequence_test")
            .withUsername("appointment_test")
            .withPassword("appointment_test");

    @DynamicPropertySource
    static void databaseProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", MYSQL::getJdbcUrl);
        registry.add("spring.datasource.username", MYSQL::getUsername);
        registry.add("spring.datasource.password", MYSQL::getPassword);
        registry.add("spring.datasource.driver-class-name", MYSQL::getDriverClassName);
    }

    @Autowired
    private AppointmentCodeSequenceRepository sequenceRepository;

    @Autowired
    private PlatformTransactionManager transactionManager;

    @Autowired
    private JdbcTemplate jdbc;

    @BeforeEach
    void resetSequence() {
        jdbc.update("DELETE FROM appointment_code_sequences WHERE code_prefix IN (?, ?)", "APT", "SER");
        jdbc.update("INSERT INTO appointment_code_sequences (code_prefix, `last_value`) VALUES ('APT', 0), ('SER', 0)");
    }

    @Test
    @DisplayName("P1: MySQL atomic LAST_INSERT_ID tăng sequence nguyên tử, không trùng lặp khi chạy đồng thời")
    void reservesDistinctConsecutiveValuesForConcurrentMySqlTransactions() throws Exception {
        int threads = 5;
        int batchSize = 3;
        CountDownLatch ready = new CountDownLatch(threads);
        CountDownLatch start = new CountDownLatch(1);

        try (ExecutorService executor = Executors.newFixedThreadPool(threads)) {
            List<Future<List<Long>>> futures = new ArrayList<>();
            for (int i = 0; i < threads; i++) {
                futures.add(executor.submit(() -> {
                    ready.countDown();
                    start.await();
                    return new TransactionTemplate(transactionManager).execute(status -> {
                        long endVal = sequenceRepository.reserveNextValues("APT", batchSize);
                        long startVal = endVal - batchSize + 1;
                        List<Long> values = new ArrayList<>();
                        for (long v = startVal; v <= endVal; v++) {
                            values.add(v);
                        }
                        return values;
                    });
                }));
            }

            assertTrue(ready.await(5, TimeUnit.SECONDS));
            start.countDown();

            Set<Long> allReservedValues = Collections.synchronizedSet(new HashSet<>());
            for (var future : futures) {
                List<Long> batch = future.get(10, TimeUnit.SECONDS);
                assertEquals(batchSize, batch.size());
                allReservedValues.addAll(batch);
            }

            assertEquals(threads * batchSize, allReservedValues.size());
            for (long expected = 1; expected <= threads * batchSize; expected++) {
                assertTrue(allReservedValues.contains(expected), "Missing sequence value: " + expected);
            }
        }

        assertEquals((long) threads * batchSize, jdbc.queryForObject(
                "SELECT `last_value` FROM appointment_code_sequences WHERE code_prefix = ?",
                Long.class,
                "APT"
        ));
    }

    @Test
    @DisplayName("P0: Flyway migration V88 tạo đúng schema appointment_series, sequence và cột liên kết")
    void flywayCreatesAppointmentSeriesSchemaAndSequences() {
        assertEquals(1, jdbc.queryForObject(
                "SELECT COUNT(*) FROM information_schema.tables "
                        + "WHERE table_schema = DATABASE() AND table_name = 'appointment_series'",
                Integer.class));

        assertEquals(1, jdbc.queryForObject(
                "SELECT COUNT(*) FROM information_schema.tables "
                        + "WHERE table_schema = DATABASE() AND table_name = 'appointment_code_sequences'",
                Integer.class));

        assertEquals(1, jdbc.queryForObject(
                "SELECT COUNT(*) FROM information_schema.columns "
                        + "WHERE table_schema = DATABASE() AND table_name = 'appointments' AND column_name = 'series_id'",
                Integer.class));

        assertEquals(1, jdbc.queryForObject(
                "SELECT COUNT(*) FROM information_schema.columns "
                        + "WHERE table_schema = DATABASE() AND table_name = 'appointments' AND column_name = 'sequence_number'",
                Integer.class));
    }
}
