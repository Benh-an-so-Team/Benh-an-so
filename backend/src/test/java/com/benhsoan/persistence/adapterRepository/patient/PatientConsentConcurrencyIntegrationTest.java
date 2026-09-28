package com.benhsoan.persistence.adapterRepository.patient;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.time.Instant;
import java.time.LocalDate;
import java.util.Collections;
import java.util.EnumSet;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.context.annotation.Import;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import com.benhsoan.domain.patient.Patient;
import com.benhsoan.domain.patient.PatientConsentRecord;
import com.benhsoan.domain.patient.enums.BloodType;
import com.benhsoan.domain.patient.enums.ConsentHistoryStatus;
import com.benhsoan.domain.patient.enums.ConsentScope;
import com.benhsoan.domain.patient.enums.Gender;
import com.benhsoan.persistence.jpaRepository.patient.JpaPatientConsentHistoryRepository;
import com.benhsoan.persistence.jpaRepository.patient.JpaPatientRepository;
import com.benhsoan.persistence.mapper.patient.PatientConsentHistoryPersistenceMapper;
import com.benhsoan.persistence.mapper.patient.PatientPersistenceMapper;

/**
 * Kiểm thử đa luồng chứng minh cơ chế khóa bi quan (findByIdForUpdate) bảo vệ
 * tính tuần tự hóa
 * của lịch sử phiếu đồng ý dưới tải đồng thời (Finding P1, P2-2, P3-2).
 */
@DataJpaTest(properties = {
        "spring.flyway.enabled=false",
        "spring.sql.init.mode=never",
        "spring.jpa.database-platform=org.hibernate.dialect.H2Dialect",
        "spring.jpa.hibernate.ddl-auto=create-drop"
})
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.ANY)
@Import({
        PatientRepositoryAdapter.class,
        PatientPersistenceMapper.class,
        PatientConsentHistoryRepositoryAdapter.class,
        PatientConsentHistoryPersistenceMapper.class
})
@Transactional(propagation = Propagation.NOT_SUPPORTED)
@DisplayName("Patient Consent Concurrency Integration Test (Pessimistic Locking - P1, P2-2, P3-2)")
class PatientConsentConcurrencyIntegrationTest {

    private static final Instant NOW = Instant.parse("2026-09-24T10:00:00Z");

    @Autowired
    private PatientRepositoryAdapter patientRepository;
    @Autowired
    private PatientConsentHistoryRepositoryAdapter consentHistoryRepository;
    @Autowired
    private JpaPatientRepository jpaPatientRepository;
    @Autowired
    private JpaPatientConsentHistoryRepository jpaConsentHistoryRepository;
    @Autowired
    private PlatformTransactionManager transactionManager;

    @BeforeEach
    void cleanDatabase() {
        new TransactionTemplate(transactionManager).executeWithoutResult(status -> {
            jpaConsentHistoryRepository.deleteAll();
            jpaPatientRepository.deleteAll();
        });
    }

    private Patient seedPatientWithInitialConsent(UUID userId) {
        return new TransactionTemplate(transactionManager).execute(status -> {
            Patient patient = Patient.create(
                    "BN000001",
                    "Nguyễn Văn A",
                    LocalDate.of(1990, 1, 1),
                    Gender.MALE,
                    "0901234567",
                    "a@example.com",
                    "Hà Nội",
                    "001090000001",
                    "DN1234567890123",
                    BloodType.O_POSITIVE,
                    null,
                    null,
                    null,
                    null,
                    null,
                    null,
                    null,
                    null,
                    "Nguyễn Văn A",
                    true,
                    "v1.0",
                    userId);
            Patient saved = patientRepository.save(patient);

            // Version 1 ban đầu
            PatientConsentRecord v1 = PatientConsentRecord.create(
                    saved.getId(),
                    1,
                    "v1.0",
                    ConsentHistoryStatus.AGREED,
                    ConsentScope.defaultAll(),
                    true,
                    NOW.minusSeconds(3600),
                    false,
                    null,
                    null,
                    false,
                    "Nguyễn Văn A",
                    userId,
                    NOW.minusSeconds(3600));
            consentHistoryRepository.save(v1);

            return saved;
        });
    }

    @Test
    @DisplayName("P1 & P2-2: Hai giao dịch đồng thời cập nhật/xóa consent serialize trật tự qua findByIdForUpdate, không bị trùng version")
    void concurrentConsentUpdates_serializeViaPessimisticLock_andProduceSequentialVersions() throws Exception {
        UUID userId = UUID.randomUUID();
        Patient savedPatient = seedPatientWithInitialConsent(userId);
        UUID patientId = savedPatient.getId();

        CountDownLatch startSignal = new CountDownLatch(1);
        AtomicReference<Exception> thread1Error = new AtomicReference<>();
        AtomicReference<Exception> thread2Error = new AtomicReference<>();

        ExecutorService executor = Executors.newFixedThreadPool(2);
        try {
            // Luồng 1: Yêu cầu xóa dữ liệu (Erasure Flow)
            Future<?> future1 = executor.submit(() -> {
                try {
                    startSignal.await(5, TimeUnit.SECONDS);
                    new TransactionTemplate(transactionManager).executeWithoutResult(status -> {
                        Patient patient = patientRepository.findByIdForUpdate(patientId).orElseThrow();
                        int nextVersion = consentHistoryRepository.getNextVersionNumber(patientId);

                        PatientConsentRecord record = PatientConsentRecord.create(
                                patientId,
                                nextVersion,
                                "v1.0",
                                ConsentHistoryStatus.WITHDRAWN,
                                Collections.emptySet(),
                                true,
                                NOW,
                                true,
                                NOW,
                                "Yêu cầu xóa dữ liệu (QTN-19)",
                                true,
                                patient.getConsentSignerName(),
                                userId,
                                NOW);
                        consentHistoryRepository.save(record);
                        patient.withdrawConsent("Yêu cầu xóa dữ liệu (QTN-19)", NOW);
                        patientRepository.save(patient);
                    });
                } catch (Exception ex) {
                    thread1Error.set(ex);
                }
            });

            // Luồng 2: Cập nhật thu hẹp phạm vi consent (Update Consent Flow)
            Future<?> future2 = executor.submit(() -> {
                try {
                    startSignal.await(5, TimeUnit.SECONDS);
                    new TransactionTemplate(transactionManager).executeWithoutResult(status -> {
                        Patient patient = patientRepository.findByIdForUpdate(patientId).orElseThrow();
                        int nextVersion = consentHistoryRepository.getNextVersionNumber(patientId);

                        PatientConsentRecord record = PatientConsentRecord.create(
                                patientId,
                                nextVersion,
                                "v1.0",
                                ConsentHistoryStatus.PARTIALLY_WITHDRAWN,
                                EnumSet.of(ConsentScope.TREATMENT),
                                true,
                                NOW,
                                false,
                                null,
                                null,
                                true,
                                patient.getConsentSignerName(),
                                userId,
                                NOW);
                        consentHistoryRepository.save(record);
                        patient.updateConsentScope(true, NOW);
                        patientRepository.save(patient);
                    });
                } catch (Exception ex) {
                    thread2Error.set(ex);
                }
            });

            // Kích hoạt đồng thời cả 2 luồng
            startSignal.countDown();

            future1.get(10, TimeUnit.SECONDS);
            future2.get(10, TimeUnit.SECONDS);

            // Xác nhận cả 2 luồng đều không gặp ngoại lệ (đặc biệt không gặp
            // DataIntegrityViolationException)
            if (thread1Error.get() != null) {
                throw new AssertionError("Thread 1 gặp lỗi: " + thread1Error.get().getMessage(), thread1Error.get());
            }
            if (thread2Error.get() != null) {
                throw new AssertionError("Thread 2 gặp lỗi: " + thread2Error.get().getMessage(), thread2Error.get());
            }

            // Kiểm tra kết quả trong cơ sở dữ liệu
            List<PatientConsentRecord> history = consentHistoryRepository.findByPatientId(patientId);
            assertEquals(3, history.size(),
                    "Bắt buộc phải có đúng 3 bản ghi lịch sử (v1 ban đầu, v2 và v3 sau 2 giao dịch đồng thời)");

            // Các version phải được sắp xếp giảm dần: 3, 2, 1
            assertEquals(3, history.get(0).getVersionNumber(), "Bản ghi mới nhất phải có version = 3");
            assertEquals(2, history.get(1).getVersionNumber(), "Bản ghi kế tiếp phải có version = 2");
            assertEquals(1, history.get(2).getVersionNumber(), "Bản ghi ban đầu phải có version = 1");

            // Xác nhận không có trùng lặp version
            long distinctVersions = history.stream().map(PatientConsentRecord::getVersionNumber).distinct().count();
            assertEquals(3, distinctVersions, "Không được phép có phiên bản bị trùng lặp");
        } finally {
            executor.shutdownNow();
        }
    }
}
