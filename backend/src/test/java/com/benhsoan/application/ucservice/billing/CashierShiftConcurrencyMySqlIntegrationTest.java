package com.benhsoan.application.ucservice.billing;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.when;

import java.time.Instant;
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

import com.benhsoan.domain.billing.exception.CashierShiftAlreadyConfirmedException;
import com.benhsoan.port.dto.command.billing.ConfirmCashierShiftCommand;
import com.benhsoan.port.outbound.security.CurrentUserPort;
import com.benhsoan.port.outbound.time.ClockPort;

@Testcontainers(disabledWithoutDocker = true)
@SpringBootTest(properties = {
        "spring.jpa.show-sql=false",
        "logging.level.org.hibernate.SQL=WARN"
})
@DisplayName("CashierShift Confirm Concurrency MySQL Integration Tests")
class CashierShiftConcurrencyMySqlIntegrationTest {

    private static final UUID CASHIER_ID = UUID.fromString("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1");
    private static final UUID MANAGER_A_ID = UUID.fromString("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2");
    private static final UUID MANAGER_B_ID = UUID.fromString("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3");

    @Container
    @SuppressWarnings("resource")
    static final MySQLContainer<?> MYSQL = new MySQLContainer<>("mysql:8.4")
            .withDatabaseName("shift_concurrency_test")
            .withUsername("shift_user")
            .withPassword("shift_user");

    @DynamicPropertySource
    static void databaseProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", MYSQL::getJdbcUrl);
        registry.add("spring.datasource.username", MYSQL::getUsername);
        registry.add("spring.datasource.password", MYSQL::getPassword);
        registry.add("spring.datasource.driver-class-name", MYSQL::getDriverClassName);
    }

    @Autowired
    private ConfirmCashierShiftService confirmService;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @MockitoBean
    private CurrentUserPort currentUserPort;

    @MockitoBean
    private ClockPort clockPort;

    @BeforeEach
    void setupSecurityAndClock() {
        when(currentUserPort.getCurrentUserId()).thenReturn(MANAGER_A_ID);
        when(currentUserPort.hasRole("MANAGER")).thenReturn(true);
        when(currentUserPort.hasRole("ADMIN")).thenReturn(false);
        when(currentUserPort.hasPermission("CASHIER_SHIFT_CONFIRM")).thenReturn(true);
        when(clockPort.now()).thenReturn(Instant.parse("2026-09-21T10:00:00Z"));
    }

    private UUID createPendingShiftFixture() {
        UUID shiftId = UUID.randomUUID();
        jdbcTemplate.update("""
                INSERT INTO cashier_shifts (
                    id, shift_code, cashier_id, start_time, end_time, total_transactions,
                    total_system_amount, system_cash_amount, system_transfer_amount,
                    system_card_amount, system_other_amount, actual_cash_amount,
                    difference_amount, status, notes, created_at
                ) VALUES (
                    UUID_TO_BIN(?), ?, UUID_TO_BIN(?), '2026-09-21 02:00:00', '2026-09-21 10:00:00', 3,
                    1500000.00, 1000000.00, 500000.00, 0.00, 0.00, 950000.00,
                    -50000.00, 'PENDING_CONFIRMATION', 'Chênh lệch 50k', '2026-09-21 10:00:00'
                )
                """,
                shiftId.toString(), "CS-" + UUID.randomUUID().toString().substring(0, 6),
                CASHIER_ID.toString()
        );
        return shiftId;
    }

    @Test
    @DisplayName("P1: Hai quản lý xác nhận đồng thời trên cùng một ca - Pessimistic Lock đảm bảo chỉ 1 thành công và 1 nhận lỗi")
    void shouldSerializeConcurrentConfirmationsWithPessimisticLock() throws Exception {
        UUID shiftId = createPendingShiftFixture();

        CountDownLatch readyLatch = new CountDownLatch(2);
        CountDownLatch startLatch = new CountDownLatch(1);

        AtomicInteger successCount = new AtomicInteger(0);
        AtomicInteger conflictCount = new AtomicInteger(0);

        try (ExecutorService executor = Executors.newFixedThreadPool(2)) {
            Future<?> futureA = executor.submit(() -> {
                readyLatch.countDown();
                try {
                    startLatch.await(5, TimeUnit.SECONDS);
                    when(currentUserPort.getCurrentUserId()).thenReturn(MANAGER_A_ID);
                    confirmService.confirm(new ConfirmCashierShiftCommand(shiftId, "Quản lý A duyệt"));
                    successCount.incrementAndGet();
                } catch (CashierShiftAlreadyConfirmedException e) {
                    conflictCount.incrementAndGet();
                } catch (Exception e) {
                    if (e.getCause() instanceof CashierShiftAlreadyConfirmedException) {
                        conflictCount.incrementAndGet();
                    } else {
                        throw new RuntimeException(e);
                    }
                }
            });

            Future<?> futureB = executor.submit(() -> {
                readyLatch.countDown();
                try {
                    startLatch.await(5, TimeUnit.SECONDS);
                    when(currentUserPort.getCurrentUserId()).thenReturn(MANAGER_B_ID);
                    confirmService.confirm(new ConfirmCashierShiftCommand(shiftId, "Quản lý B duyệt"));
                    successCount.incrementAndGet();
                } catch (CashierShiftAlreadyConfirmedException e) {
                    conflictCount.incrementAndGet();
                } catch (Exception e) {
                    if (e.getCause() instanceof CashierShiftAlreadyConfirmedException) {
                        conflictCount.incrementAndGet();
                    } else {
                        throw new RuntimeException(e);
                    }
                }
            });

            assertTrue(readyLatch.await(5, TimeUnit.SECONDS));
            startLatch.countDown();

            futureA.get(10, TimeUnit.SECONDS);
            futureB.get(10, TimeUnit.SECONDS);
        }

        assertEquals(1, successCount.get(), "Chỉ đúng 1 transaction xác nhận thành công");
        assertEquals(1, conflictCount.get(), "Transaction còn lại phải nhận lỗi xung đột (đã được xác nhận)");

        String finalStatus = jdbcTemplate.queryForObject(
                "SELECT status FROM cashier_shifts WHERE id = UUID_TO_BIN(?)",
                String.class,
                shiftId.toString()
        );
        assertEquals("CONFIRMED", finalStatus);
    }
}
