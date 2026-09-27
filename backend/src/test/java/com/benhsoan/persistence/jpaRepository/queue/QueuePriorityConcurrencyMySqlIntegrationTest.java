package com.benhsoan.persistence.jpaRepository.queue;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.testcontainers.containers.MySQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import com.benhsoan.domain.queue.enums.MedicalQueueStatus;
import com.benhsoan.domain.queue.enums.QueueItemSourceType;
import com.benhsoan.domain.queue.enums.QueueItemStatus;
import com.benhsoan.domain.queue.enums.QueuePriority;
import com.benhsoan.persistence.entity.queue.MedicalQueueEntity;
import com.benhsoan.persistence.entity.queue.QueueItemEntity;

/**
 * Validates concurrency and pessimistic locking serialization on MySQL 8.4 via Testcontainers (F-05, F-07).
 * When running in environments without Docker, this test is skipped cleanly.
 */
@SpringBootTest
@Testcontainers(disabledWithoutDocker = true)
class QueuePriorityConcurrencyMySqlIntegrationTest {

    @Container
    @SuppressWarnings("resource")
    static final MySQLContainer<?> MYSQL = new MySQLContainer<>("mysql:8.4")
            .withDatabaseName("queue_priority_concurrency_test")
            .withUsername("queue_test")
            .withPassword("queue_test");

    @DynamicPropertySource
    static void databaseProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", MYSQL::getJdbcUrl);
        registry.add("spring.datasource.username", MYSQL::getUsername);
        registry.add("spring.datasource.password", MYSQL::getPassword);
        registry.add("spring.datasource.driver-class-name", MYSQL::getDriverClassName);
    }

    @Autowired private JpaQueueItemRepository queueItemRepository;
    @Autowired private JpaMedicalQueueRepository medicalQueueRepository;
    @Autowired private PlatformTransactionManager transactionManager;
    @Autowired private org.springframework.jdbc.core.JdbcTemplate jdbc;

    @Test
    void concurrentPrioritizeRequestsSerializeOnQueueItemPessimisticLock() throws Exception {
        UUID queueId = UUID.randomUUID();
        UUID itemId = UUID.randomUUID();
        Instant now = Instant.parse("2026-08-02T02:00:00Z");

        UUID doctorId = UUID.fromString(jdbc.queryForObject("SELECT BIN_TO_UUID(id) FROM users LIMIT 1", String.class));
        UUID roomId = UUID.fromString(jdbc.queryForObject("SELECT BIN_TO_UUID(id) FROM rooms LIMIT 1", String.class));
        UUID patientId = UUID.fromString(jdbc.queryForObject("SELECT BIN_TO_UUID(id) FROM patients LIMIT 1", String.class));

        medicalQueueRepository.saveAndFlush(MedicalQueueEntity.builder()
                .id(queueId).doctorId(doctorId).roomId(roomId).queueDate(LocalDate.of(2026, 8, 2))
                .status(MedicalQueueStatus.OPEN).createdAt(now).updatedAt(now).build());

        QueueItemEntity item = new QueueItemEntity();
        item.setId(itemId);
        item.setMedicalQueueId(queueId);
        item.setPatientId(patientId);
        item.setVisitId(null);
        item.setSourceType(QueueItemSourceType.WALK_IN);
        item.setStatus(QueueItemStatus.WAITING);
        item.setQueueNumber(1);
        item.setQueueDate(LocalDate.of(2026, 8, 2));
        item.setCheckedInAt(now);
        item.setPriority(QueuePriority.NORMAL);
        item.setCreatedBy(doctorId);
        item.setCreatedAt(now);
        item.setUpdatedAt(now);
        queueItemRepository.saveAndFlush(item);

        TransactionTemplate transaction = new TransactionTemplate(transactionManager);
        CountDownLatch firstLockAcquired = new CountDownLatch(1);
        CountDownLatch releaseFirstTransaction = new CountDownLatch(1);
        CountDownLatch secondLockAcquired = new CountDownLatch(1);

        ExecutorService executor = Executors.newFixedThreadPool(2);
        try {
            Future<?> first = executor.submit(() -> transaction.executeWithoutResult(status -> {
                queueItemRepository.findByIdForUpdate(itemId).orElseThrow();
                firstLockAcquired.countDown();
                await(releaseFirstTransaction);
            }));
            assertTrue(firstLockAcquired.await(5, TimeUnit.SECONDS));

            Future<?> second = executor.submit(() -> transaction.executeWithoutResult(status -> {
                queueItemRepository.findByIdForUpdate(itemId).orElseThrow();
                secondLockAcquired.countDown();
            }));

            assertFalse(secondLockAcquired.await(300, TimeUnit.MILLISECONDS),
                    "the second prioritize transaction must wait until the first transaction releases the queue item lock");
            releaseFirstTransaction.countDown();

            first.get(5, TimeUnit.SECONDS);
            second.get(5, TimeUnit.SECONDS);
            assertTrue(secondLockAcquired.await(5, TimeUnit.SECONDS));
        } finally {
            executor.shutdownNow();
        }
    }

    private static void await(CountDownLatch latch) {
        try {
            if (!latch.await(5, TimeUnit.SECONDS)) {
                throw new IllegalStateException("timed out waiting for latch");
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new RuntimeException(e);
        }
    }
}
