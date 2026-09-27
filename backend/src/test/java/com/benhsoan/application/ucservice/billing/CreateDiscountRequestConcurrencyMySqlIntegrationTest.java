package com.benhsoan.application.ucservice.billing;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
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

import com.benhsoan.domain.billing.enums.DiscountType;
import com.benhsoan.domain.billing.exception.DiscountAlreadyExistsException;
import com.benhsoan.port.dto.command.billing.CreateDiscountRequestCommand;
import com.benhsoan.port.dto.result.DiscountRequestResult;
import com.benhsoan.port.outbound.security.CurrentUserPort;
import com.benhsoan.port.outbound.time.ClockPort;

@Testcontainers(disabledWithoutDocker = true)
@SpringBootTest(properties = {
        "spring.jpa.show-sql=false",
        "logging.level.org.hibernate.SQL=WARN"
})
@DisplayName("CreateDiscountRequest Concurrency & Anti-Duplicate MySQL Integration Tests")
class CreateDiscountRequestConcurrencyMySqlIntegrationTest {

    private static final UUID RECEPTIONIST_ID = UUID.fromString("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa5");

    @Container
    @SuppressWarnings("resource")
    static final MySQLContainer<?> MYSQL = new MySQLContainer<>("mysql:8.4")
            .withDatabaseName("discount_concurrency_test")
            .withUsername("discount_user")
            .withPassword("discount_user");

    @DynamicPropertySource
    static void databaseProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", MYSQL::getJdbcUrl);
        registry.add("spring.datasource.username", MYSQL::getUsername);
        registry.add("spring.datasource.password", MYSQL::getPassword);
        registry.add("spring.datasource.driver-class-name", MYSQL::getDriverClassName);
    }

    @Autowired
    private CreateDiscountRequestService createDiscountRequestService;

    @Autowired
    private com.benhsoan.persistence.jpaRepository.visit.JpaVisitRepository visitRepository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @MockitoBean
    private CurrentUserPort currentUserPort;

    @MockitoBean
    private ClockPort clockPort;

    @BeforeEach
    void setUp() {
        when(currentUserPort.getCurrentUserId()).thenReturn(RECEPTIONIST_ID);
        when(currentUserPort.hasRole("RECEPTIONIST")).thenReturn(true);
        when(currentUserPort.hasRole("ADMIN")).thenReturn(false);
        when(currentUserPort.hasRole("MANAGER")).thenReturn(false);
        when(currentUserPort.hasPermission("INVOICE_CREATE")).thenReturn(true);
        when(clockPort.now()).thenReturn(Instant.parse("2026-09-22T10:00:00Z"));
    }

    private UUID createVisitFixture() {
        UUID patientId = UUID.fromString(jdbcTemplate.queryForObject("SELECT BIN_TO_UUID(id) FROM patients LIMIT 1", String.class));
        UUID userId = UUID.fromString(jdbcTemplate.queryForObject("SELECT BIN_TO_UUID(id) FROM users LIMIT 1", String.class));
        UUID visitId = UUID.randomUUID();
        Instant now = Instant.parse("2026-09-22T08:00:00Z");

        visitRepository.saveAndFlush(com.benhsoan.persistence.entity.visit.VisitEntity.builder()
                .id(visitId)
                .visitCode("VISIT-" + visitId.toString().substring(0, 8))
                .patientId(patientId)
                .doctorId(userId)
                .specialtyId(UUID.fromString("f0000000-0000-0000-0000-000000000001"))
                .visitType(com.benhsoan.domain.visit.enums.VisitType.WALK_IN)
                .status(com.benhsoan.domain.visit.enums.VisitStatus.IN_PROGRESS)
                .reason("Kham benh")
                .visitAt(now)
                .createdBy(userId)
                .createdAt(now)
                .updatedAt(now)
                .build());
        return visitId;
    }

    @Test
    @DisplayName("P1 Concurrency: Hai luồng đồng thời tạo discount cho cùng 1 visitId -> Đúng 1 luồng thành công, 1 luồng nhận Conflict 409")
    void concurrentCreateDiscountRequestsForSameVisit() throws Exception {
        UUID visitId = createVisitFixture();

        CreateDiscountRequestCommand command = new CreateDiscountRequestCommand(
                visitId,
                DiscountType.PERCENTAGE,
                new BigDecimal("20.00"),
                new BigDecimal("500000.00"),
                "Giảm giá bệnh nhân hoàn cảnh khó khăn"
        );

        int threads = 2;
        ExecutorService executor = Executors.newFixedThreadPool(threads);
        CountDownLatch readyLatch = new CountDownLatch(threads);
        CountDownLatch startLatch = new CountDownLatch(1);

        AtomicInteger successCount = new AtomicInteger(0);
        AtomicInteger duplicateConflictCount = new AtomicInteger(0);

        List<Future<?>> futures = new ArrayList<>();
        for (int i = 0; i < threads; i++) {
            futures.add(executor.submit(() -> {
                readyLatch.countDown();
                try {
                    startLatch.await();
                    DiscountRequestResult result = createDiscountRequestService.create(command);
                    if (result != null && result.id() != null) {
                        successCount.incrementAndGet();
                    }
                } catch (DiscountAlreadyExistsException | org.springframework.dao.DataIntegrityViolationException e) {
                    duplicateConflictCount.incrementAndGet();
                } catch (Exception e) {
                    e.printStackTrace();
                }
            }));
        }

        readyLatch.await(5, TimeUnit.SECONDS);
        startLatch.countDown();

        for (Future<?> f : futures) {
            f.get(10, TimeUnit.SECONDS);
        }
        executor.shutdown();

        assertEquals(1, successCount.get(), "Đúng 1 luồng tạo discount thành công");
        assertEquals(1, duplicateConflictCount.get(), "Đúng 1 luồng nhận DiscountAlreadyExistsException (409 Conflict)");

        Integer dbRecordCount = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM discount_requests WHERE visit_id = UUID_TO_BIN(?)",
                Integer.class,
                visitId.toString()
        );
        assertEquals(1, dbRecordCount, "Chỉ có duy nhất 1 bản ghi discount request được tạo trong cơ sở dữ liệu");
    }
}
