package com.benhsoan.persistence.jpaRepository.billing;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

import java.math.BigDecimal;
import java.util.UUID;

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
        "logging.level.org.hibernate.SQL=WARN"
})
@DisplayName("Invoice Discount & Free Flyway MySQL Integration Tests (V84)")
class InvoiceDiscountFlywayMySqlIntegrationTest {

    @Container
    @SuppressWarnings("resource")
    static final MySQLContainer<?> MYSQL = new MySQLContainer<>("mysql:8.4")
            .withDatabaseName("discount_flyway_test")
            .withUsername("discount_test")
            .withPassword("discount_test");

    @DynamicPropertySource
    static void databaseProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", MYSQL::getJdbcUrl);
        registry.add("spring.datasource.username", MYSQL::getUsername);
        registry.add("spring.datasource.password", MYSQL::getPassword);
        registry.add("spring.datasource.driver-class-name", MYSQL::getDriverClassName);
    }

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Test
    @DisplayName("MySQL V84: discount_requests table exists with active_status generated column and unique index")
    void verifiesDiscountRequestsTableStructure() {
        Integer tableCount = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'discount_requests'",
                Integer.class
        );
        assertEquals(1, tableCount, "Table discount_requests must exist after V84 migration");

        Integer uniqueCount = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM information_schema.table_constraints WHERE table_schema = DATABASE() AND table_name = 'discount_requests' AND constraint_name = 'uk_discount_requests_active_visit'",
                Integer.class
        );
        assertEquals(1, uniqueCount, "Constraint uk_discount_requests_active_visit must exist");
    }

    @Test
    @DisplayName("MySQL V84: Supports 100% free invoice (total_amount = 0) and negative DISCOUNT line")
    void verifiesNegativeDiscountLineAndZeroTotalInvoice() {
        // Find existing patient and user IDs from flyway seeds
        byte[] patientId = jdbcTemplate.queryForObject("SELECT id FROM patients LIMIT 1", byte[].class);
        byte[] userId = jdbcTemplate.queryForObject("SELECT id FROM users LIMIT 1", byte[].class);
        assertNotNull(patientId);
        assertNotNull(userId);

        // 1. Create a visit
        UUID visitId = UUID.randomUUID();
        jdbcTemplate.update(
                """
                INSERT INTO visits (id, visit_code, patient_id, doctor_id, visit_type, status, visit_at, reason, created_by, created_at, updated_at)
                VALUES (UUID_TO_BIN(?), ?, ?, ?, 'OUTPATIENT', 'COMPLETED', NOW(), 'Kham benh', ?, NOW(), NOW())
                """,
                visitId.toString(),
                "VISIT-" + visitId.toString().substring(0, 8),
                patientId,
                userId,
                userId
        );

        // 2. Insert approved discount request (100% free)
        UUID discountRequestId = UUID.randomUUID();
        jdbcTemplate.update(
                """
                INSERT INTO discount_requests (
                    id, visit_id, discount_type, discount_value, original_amount, discount_amount, final_amount,
                    reason, status, requested_by, requested_at, approved_by, approved_at
                ) VALUES (
                    UUID_TO_BIN(?), UUID_TO_BIN(?), 'FULL_FREE', 100.00, 250000.00, 250000.00, 0.00,
                    'Miễn phí 100% người có công', 'APPROVED', ?, NOW(), ?, NOW()
                )
                """,
                discountRequestId.toString(),
                visitId.toString(),
                userId,
                userId
        );

        // 3. Insert payment with amount_paid = 0 (total_amount = 250000, discount_amount = 250000)
        UUID paymentId = UUID.randomUUID();
        jdbcTemplate.update(
                """
                INSERT INTO payments (
                    id, visit_id, exam_fee, medicine_fee, service_fee, total_amount, discount_amount,
                    discount_request_id, amount_paid, payment_method, status, collected_by, paid_at, created_at
                ) VALUES (
                    UUID_TO_BIN(?), UUID_TO_BIN(?), 100000.00, 150000.00, 0.00, 250000.00, 250000.00,
                    UUID_TO_BIN(?), 0.00, 'CASH', 'RECORDED', ?, NOW(), NOW()
                )
                """,
                paymentId.toString(),
                visitId.toString(),
                discountRequestId.toString(),
                userId
        );

        // 4. Insert original invoice with total_amount = 0.00 (allowed by updated chk_invoices_original_shape)
        UUID invoiceId = UUID.randomUUID();
        jdbcTemplate.update(
                """
                INSERT INTO invoices (
                    id, invoice_code, visit_id, payment_id, invoice_type, total_amount, discount_amount,
                    discount_request_id, created_by, created_at
                ) VALUES (
                    UUID_TO_BIN(?), ?, UUID_TO_BIN(?), UUID_TO_BIN(?), 'ORIGINAL', 0.00, 250000.00,
                    UUID_TO_BIN(?), ?, NOW()
                )
                """,
                invoiceId.toString(),
                "INV-ZERO-" + invoiceId.toString().substring(0, 8),
                visitId.toString(),
                paymentId.toString(),
                discountRequestId.toString(),
                userId
        );

        // 5. Insert positive charge lines
        jdbcTemplate.update(
                """
                INSERT INTO invoice_lines (id, invoice_id, line_type, item_name, quantity, unit_price, amount, created_at)
                VALUES (UUID_TO_BIN(UUID()), UUID_TO_BIN(?), 'EXAM_FEE', 'Khám lâm sàng', 1, 100000.00, 100000.00, NOW())
                """,
                invoiceId.toString()
        );
        jdbcTemplate.update(
                """
                INSERT INTO invoice_lines (id, invoice_id, line_type, item_name, quantity, unit_price, amount, created_at)
                VALUES (UUID_TO_BIN(UUID()), UUID_TO_BIN(?), 'MEDICINE_FEE', 'Thuốc men', 1, 150000.00, 150000.00, NOW())
                """,
                invoiceId.toString()
        );

        // 6. Insert negative DISCOUNT line (-250000.00) - allowed by updated chk_invoice_lines_type & amounts
        jdbcTemplate.update(
                """
                INSERT INTO invoice_lines (id, invoice_id, line_type, item_name, quantity, unit_price, amount, created_at)
                VALUES (UUID_TO_BIN(UUID()), UUID_TO_BIN(?), 'DISCOUNT', 'Miễn phí 100% người có công', 1, -250000.00, -250000.00, NOW())
                """,
                invoiceId.toString()
        );

        // 7. Verify counts and net invoice total
        Integer lineCount = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM invoice_lines WHERE invoice_id = UUID_TO_BIN(?)",
                Integer.class,
                invoiceId.toString()
        );
        assertEquals(3, lineCount);

        BigDecimal netTotal = jdbcTemplate.queryForObject(
                "SELECT SUM(amount) FROM invoice_lines WHERE invoice_id = UUID_TO_BIN(?)",
                BigDecimal.class,
                invoiceId.toString()
        );
        assertNotNull(netTotal);
        assertEquals(0, netTotal.compareTo(BigDecimal.ZERO), "Net sum of invoice lines must equal zero for 100% free");
    }
}
