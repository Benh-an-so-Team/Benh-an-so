package com.benhsoan.application.ucservice.billing;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.testcontainers.containers.MySQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import com.benhsoan.domain.billing.enums.PaymentMethod;
import com.benhsoan.domain.billing.exception.PaymentAlreadyExistsException;
import com.benhsoan.port.dto.command.billing.PaymentMethodItemCommand;
import com.benhsoan.port.dto.command.billing.RecordPaymentCommand;
import com.benhsoan.port.dto.result.PaymentResult;
import com.benhsoan.port.outbound.security.CurrentUserPort;
import com.benhsoan.port.outbound.time.ClockPort;

@Testcontainers(disabledWithoutDocker = true)
@SpringBootTest(properties = {
        "spring.jpa.show-sql=false",
        "logging.level.org.hibernate.SQL=WARN"
})
@DisplayName("RecordPayment Concurrency & Anti-Duplicate MySQL Integration Tests")
class RecordPaymentConcurrencyMySqlIntegrationTest {

    private static final UUID RECEPTIONIST_ID = UUID.fromString("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa5");
    private static final UUID PATIENT_ID = UUID.fromString("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb001");
    private static final UUID DOCTOR_ID = UUID.fromString("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2");

    @Container
    @SuppressWarnings("resource")
    static final MySQLContainer<?> MYSQL = new MySQLContainer<>("mysql:8.4")
            .withDatabaseName("payment_concurrency_test")
            .withUsername("payment_user")
            .withPassword("payment_user");

    @DynamicPropertySource
    static void databaseProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", MYSQL::getJdbcUrl);
        registry.add("spring.datasource.username", MYSQL::getUsername);
        registry.add("spring.datasource.password", MYSQL::getPassword);
        registry.add("spring.datasource.driver-class-name", MYSQL::getDriverClassName);
    }

    @Autowired
    private RecordPaymentService recordPaymentService;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @MockitoBean
    private CurrentUserPort currentUserPort;

    @MockitoBean
    private ClockPort clockPort;

    @BeforeEach
    void setupSecurityAndClock() {
        when(currentUserPort.getCurrentUserId()).thenReturn(RECEPTIONIST_ID);
        when(currentUserPort.hasRole("RECEPTIONIST")).thenReturn(true);
        when(currentUserPort.hasRole("ADMIN")).thenReturn(false);
        when(clockPort.now()).thenReturn(Instant.parse("2026-08-20T10:00:00Z"));
    }

    private UUID createPayableVisitFixture() {
        UUID visitId = UUID.randomUUID();
        UUID medicalRecordId = UUID.randomUUID();
        UUID prescriptionId = UUID.randomUUID();

        // 1. Insert Visit
        jdbcTemplate.update("""
                INSERT INTO visits (id, visit_code, patient_id, doctor_id, visit_type, status, visit_at, started_at, completed_at, reason, created_by, created_at, updated_at)
                VALUES (UUID_TO_BIN(?), ?, UUID_TO_BIN(?), UUID_TO_BIN(?), 'WALK_IN', 'COMPLETED', '2026-08-20 09:00:00', '2026-08-20 09:10:00', '2026-08-20 09:40:00', 'Kham suc khoe', UUID_TO_BIN(?), '2026-08-20 09:00:00', '2026-08-20 09:40:00')
                """,
                visitId.toString(), "VIS-" + UUID.randomUUID().toString().substring(0, 6),
                PATIENT_ID.toString(), DOCTOR_ID.toString(), RECEPTIONIST_ID.toString()
        );

        // 2. Insert Medical Record
        jdbcTemplate.update("""
                INSERT INTO medical_records (id, visit_id, chief_complaint, symptoms, medical_history, status, created_by, created_at)
                VALUES (UUID_TO_BIN(?), UUID_TO_BIN(?), 'Sot nhe', 'Ho', 'Binh thuong', 'LOCKED', UUID_TO_BIN(?), '2026-08-20 09:15:00')
                """,
                medicalRecordId.toString(), visitId.toString(), DOCTOR_ID.toString()
        );

        // 3. Insert Prescription (DISPENSED) with at least one item
        jdbcTemplate.update("""
                INSERT INTO prescriptions (id, prescription_code, medical_record_id, status, prescribed_by, prescribed_at)
                VALUES (UUID_TO_BIN(?), ?, UUID_TO_BIN(?), 'DISPENSED', UUID_TO_BIN(?), '2026-08-20 09:20:00')
                """,
                prescriptionId.toString(), "RX-" + UUID.randomUUID().toString().substring(0, 6),
                medicalRecordId.toString(), DOCTOR_ID.toString()
        );

        byte[] medicineId = jdbcTemplate.queryForObject("SELECT id FROM medicines LIMIT 1", byte[].class);
        jdbcTemplate.update("""
                INSERT INTO prescription_items (
                    id, prescription_id, medicine_id, medicine_name, active_ingredient,
                    strength, unit, dosage, frequency, route, duration_days, quantity, instructions, created_at, updated_at
                ) VALUES (
                    UUID_TO_BIN(?), UUID_TO_BIN(?), ?, 'Paracetamol 500mg', 'Paracetamol',
                    '500mg', 'VIEN', '1 vien', 2, 'ORAL', 5, 10, 'Uong sau an', NOW(), NOW()
                )
                """,
                UUID.randomUUID().toString(), prescriptionId.toString(), medicineId
        );

        return visitId;
    }

    @Test
    @DisplayName("Scenario 1 & 2: Two concurrent identical payment requests for same visit -> exactly 1 succeeds, 1 fails with PaymentAlreadyExistsException")
    void twoConcurrentIdenticalPaymentsForSameVisit() throws Exception {
        UUID visitId = createPayableVisitFixture();

        RecordPaymentCommand cmd = RecordPaymentCommand.builder()
                .visitId(visitId)
                .examFee(new BigDecimal("100000"))
                .medicineFee(new BigDecimal("150000"))
                .amountPaid(new BigDecimal("250000"))
                .paymentMethods(List.of(
                        new PaymentMethodItemCommand(PaymentMethod.CASH, new BigDecimal("100000"), null),
                        new PaymentMethodItemCommand(PaymentMethod.BANK_TRANSFER, new BigDecimal("150000"), "TXN-CONCURRENT-01")
                ))
                .build();

        int threads = 2;
        ExecutorService executor = Executors.newFixedThreadPool(threads);
        CountDownLatch readyLatch = new CountDownLatch(threads);
        CountDownLatch startLatch = new CountDownLatch(1);

        AtomicInteger successCount = new AtomicInteger(0);
        AtomicInteger duplicateConflictCount = new AtomicInteger(0);

        List<Future<?>> futures = new java.util.ArrayList<>();
        for (int i = 0; i < threads; i++) {
            futures.add(executor.submit(() -> {
                readyLatch.countDown();
                try {
                    startLatch.await();
                    recordPaymentService.record(cmd);
                    successCount.incrementAndGet();
                } catch (PaymentAlreadyExistsException e) {
                    duplicateConflictCount.incrementAndGet();
                } catch (Exception e) {
                    // other exceptions
                }
            }));
        }

        readyLatch.await(5, TimeUnit.SECONDS);
        startLatch.countDown();

        for (Future<?> f : futures) {
            f.get(10, TimeUnit.SECONDS);
        }
        executor.shutdown();

        assertEquals(1, successCount.get(), "Exactly one concurrent payment request must succeed");
        assertEquals(1, duplicateConflictCount.get(), "Concurrent second request must be caught as PaymentAlreadyExistsException");

        // Verify database has exactly 1 payment record
        Integer count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM payments WHERE visit_id = UUID_TO_BIN(?)",
                Integer.class,
                visitId.toString()
        );
        assertEquals(1, count);
    }

    @Test
    @DisplayName("Scenario 3: Two concurrent payment requests with DIFFERENT methods for same visit -> exactly 1 succeeds")
    void twoConcurrentDifferentMethodPaymentsForSameVisit() throws Exception {
        UUID visitId = createPayableVisitFixture();

        RecordPaymentCommand cmdCash = RecordPaymentCommand.builder()
                .visitId(visitId)
                .examFee(new BigDecimal("100000"))
                .medicineFee(new BigDecimal("150000"))
                .amountPaid(new BigDecimal("250000"))
                .paymentMethod(PaymentMethod.CASH)
                .build();

        RecordPaymentCommand cmdBank = RecordPaymentCommand.builder()
                .visitId(visitId)
                .examFee(new BigDecimal("100000"))
                .medicineFee(new BigDecimal("150000"))
                .amountPaid(new BigDecimal("250000"))
                .paymentMethod(PaymentMethod.BANK_TRANSFER)
                .referenceNumber("TXN-DIFF-02")
                .build();

        ExecutorService executor = Executors.newFixedThreadPool(2);
        CountDownLatch readyLatch = new CountDownLatch(2);
        CountDownLatch startLatch = new CountDownLatch(1);

        AtomicInteger successCount = new AtomicInteger(0);
        AtomicInteger duplicateConflictCount = new AtomicInteger(0);

        Future<?> f1 = executor.submit(() -> {
            readyLatch.countDown();
            try {
                startLatch.await();
                recordPaymentService.record(cmdCash);
                successCount.incrementAndGet();
            } catch (PaymentAlreadyExistsException e) {
                duplicateConflictCount.incrementAndGet();
            } catch (Exception ignored) {}
        });

        Future<?> f2 = executor.submit(() -> {
            readyLatch.countDown();
            try {
                startLatch.await();
                recordPaymentService.record(cmdBank);
                successCount.incrementAndGet();
            } catch (PaymentAlreadyExistsException e) {
                duplicateConflictCount.incrementAndGet();
            } catch (Exception ignored) {}
        });

        readyLatch.await(5, TimeUnit.SECONDS);
        startLatch.countDown();

        f1.get(10, TimeUnit.SECONDS);
        f2.get(10, TimeUnit.SECONDS);
        executor.shutdown();

        assertEquals(1, successCount.get(), "Exactly one payment method request must succeed");
        assertEquals(1, duplicateConflictCount.get(), "Losing request must be rejected as PaymentAlreadyExistsException");
    }

    @Test
    @DisplayName("Scenario 5: Retrying payment after first request succeeded -> rejected with PaymentAlreadyExistsException")
    void retryPaymentAfterSuccessThrowsException() {
        UUID visitId = createPayableVisitFixture();

        RecordPaymentCommand cmd = RecordPaymentCommand.builder()
                .visitId(visitId)
                .examFee(new BigDecimal("100000"))
                .medicineFee(new BigDecimal("150000"))
                .amountPaid(new BigDecimal("250000"))
                .paymentMethod(PaymentMethod.CASH)
                .build();

        // First attempt succeeds
        PaymentResult firstResult = recordPaymentService.record(cmd);
        assertEquals(visitId, firstResult.visitId());

        // Second attempt (retry) must fail with PaymentAlreadyExistsException
        assertThrows(PaymentAlreadyExistsException.class, () -> recordPaymentService.record(cmd));
    }
}
