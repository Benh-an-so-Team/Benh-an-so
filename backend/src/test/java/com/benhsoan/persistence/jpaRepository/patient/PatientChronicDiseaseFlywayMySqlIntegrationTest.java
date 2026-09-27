package com.benhsoan.persistence.jpaRepository.patient;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.when;

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
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.testcontainers.containers.MySQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import com.benhsoan.domain.patient.exception.PatientChronicDiseaseAlreadyExistsException;
import com.benhsoan.port.dto.command.patient.AddPatientChronicDiseaseCommand;
import com.benhsoan.port.dto.command.patient.DeletePatientChronicDiseaseCommand;
import com.benhsoan.port.dto.result.patient.PatientChronicDiseaseResult;
import com.benhsoan.port.inbound.patient.AddPatientChronicDiseaseUseCase;
import com.benhsoan.port.inbound.patient.DeletePatientChronicDiseaseUseCase;
import com.benhsoan.port.outbound.security.CurrentUserPort;

@Testcontainers(disabledWithoutDocker = true)
@SpringBootTest(properties = {
        "spring.jpa.show-sql=false",
        "logging.level.org.hibernate.SQL=WARN",
        "logging.level.org.hibernate.orm.jdbc.bind=WARN"
})
class PatientChronicDiseaseFlywayMySqlIntegrationTest {

    private static final UUID DOCTOR_ID = UUID.fromString("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2");
    private static final UUID PATIENT_ID = UUID.fromString("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb001");
    private static final UUID CATALOG_ID = UUID.fromString("a1000000-0000-0000-0000-000000000005");

    @Container
    @SuppressWarnings("resource")
    static final MySQLContainer<?> MYSQL = new MySQLContainer<>("mysql:8.4")
            .withDatabaseName("patient_chronic_disease_test")
            .withUsername("chronic_test")
            .withPassword("chronic_test");

    @DynamicPropertySource
    static void databaseProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", MYSQL::getJdbcUrl);
        registry.add("spring.datasource.username", MYSQL::getUsername);
        registry.add("spring.datasource.password", MYSQL::getPassword);
        registry.add("spring.datasource.driver-class-name", MYSQL::getDriverClassName);
    }

    @Autowired private AddPatientChronicDiseaseUseCase addChronicDiseaseUseCase;
    @Autowired private DeletePatientChronicDiseaseUseCase deleteChronicDiseaseUseCase;
    @Autowired private JdbcTemplate jdbc;

    @MockitoBean private CurrentUserPort currentUserPort;

    @BeforeEach
    void setUp() {
        when(currentUserPort.getCurrentUserId()).thenReturn(DOCTOR_ID);
        jdbc.update("DELETE FROM patient_chronic_diseases");
    }

    @Test
    @DisplayName("MySQL V58: Unique constraint từ chối bệnh mạn tính trùng lặp trên cùng bệnh nhân")
    void uniqueConstraint_rejectsDuplicateActiveChronicDisease() {
        AddPatientChronicDiseaseCommand cmd = AddPatientChronicDiseaseCommand.builder()
                .patientId(PATIENT_ID)
                .diagnosisCatalogId(CATALOG_ID)
                .build();

        PatientChronicDiseaseResult first = addChronicDiseaseUseCase.addChronicDisease(cmd);
        assertNotNull(first.id());

        assertThrows(PatientChronicDiseaseAlreadyExistsException.class,
                () -> addChronicDiseaseUseCase.addChronicDisease(cmd));

        Integer activeCount = jdbc.queryForObject(
                "SELECT COUNT(*) FROM patient_chronic_diseases WHERE patient_id = UUID_TO_BIN(?) AND diagnosis_catalog_id = UUID_TO_BIN(?) AND active = TRUE",
                Integer.class,
                PATIENT_ID.toString(),
                CATALOG_ID.toString()
        );
        assertEquals(1, activeCount);
    }

    @Test
    @DisplayName("MySQL V58: Ràng buộc unique ở mức database (generated column) từ chối bản ghi active trùng lặp")
    void databaseUniqueConstraint_rejectsDuplicateActiveRow() {
        jdbc.update("""
                INSERT INTO patient_chronic_diseases
                    (id, patient_id, diagnosis_catalog_id, active, created_by, created_at, updated_at)
                VALUES (UUID_TO_BIN(?), UUID_TO_BIN(?), UUID_TO_BIN(?), TRUE, UUID_TO_BIN(?), ?, ?)
                """,
                UUID.randomUUID().toString(), PATIENT_ID.toString(), CATALOG_ID.toString(),
                DOCTOR_ID.toString(), "2026-08-20 02:00:00", "2026-08-20 02:00:00");

        assertThrows(DataIntegrityViolationException.class, () -> jdbc.update("""
                INSERT INTO patient_chronic_diseases
                    (id, patient_id, diagnosis_catalog_id, active, created_by, created_at, updated_at)
                VALUES (UUID_TO_BIN(?), UUID_TO_BIN(?), UUID_TO_BIN(?), TRUE, UUID_TO_BIN(?), ?, ?)
                """,
                UUID.randomUUID().toString(), PATIENT_ID.toString(), CATALOG_ID.toString(),
                DOCTOR_ID.toString(), "2026-08-20 02:00:00", "2026-08-20 02:00:00"));
    }

    @Test
    @DisplayName("MySQL V58: Bệnh mạn tính đã xóa mềm (inactive) cho phép tạo lại cùng mã bệnh")
    void softDeletedChronicDisease_allowsRecreationOfSameCatalog() {
        AddPatientChronicDiseaseCommand cmd = AddPatientChronicDiseaseCommand.builder()
                .patientId(PATIENT_ID)
                .diagnosisCatalogId(CATALOG_ID)
                .build();

        PatientChronicDiseaseResult created = addChronicDiseaseUseCase.addChronicDisease(cmd);

        deleteChronicDiseaseUseCase.deleteChronicDisease(DeletePatientChronicDiseaseCommand.builder()
                .patientId(PATIENT_ID)
                .chronicDiseaseId(created.id())
                .reason("Đã khỏi bệnh")
                .build());

        Integer inactiveCount = jdbc.queryForObject(
                "SELECT COUNT(*) FROM patient_chronic_diseases WHERE id = UUID_TO_BIN(?) AND active = FALSE",
                Integer.class,
                created.id().toString()
        );
        assertEquals(1, inactiveCount);

        PatientChronicDiseaseResult recreated = addChronicDiseaseUseCase.addChronicDisease(cmd);
        assertNotNull(recreated.id());
        assertTrue(!recreated.id().equals(created.id()));
    }

    @Test
    @DisplayName("MySQL V58: Concurrent insert -> Đúng 1 request thành công, 1 request nhận Conflict 409")
    void concurrentInsertSameChronicDisease_oneSucceedsOneReturnsConflict() throws Exception {
        int numThreads = 2;
        ExecutorService executor = Executors.newFixedThreadPool(numThreads);
        CountDownLatch readyLatch = new CountDownLatch(numThreads);
        CountDownLatch startLatch = new CountDownLatch(1);

        AtomicInteger successCount = new AtomicInteger(0);
        AtomicInteger conflictCount = new AtomicInteger(0);
        AtomicInteger unexpectedExceptionCount = new AtomicInteger(0);

        Runnable task = () -> {
            readyLatch.countDown();
            try {
                startLatch.await(5, TimeUnit.SECONDS);
                addChronicDiseaseUseCase.addChronicDisease(AddPatientChronicDiseaseCommand.builder()
                        .patientId(PATIENT_ID)
                        .diagnosisCatalogId(CATALOG_ID)
                        .build());
                successCount.incrementAndGet();
            } catch (PatientChronicDiseaseAlreadyExistsException e) {
                conflictCount.incrementAndGet();
            } catch (Exception e) {
                unexpectedExceptionCount.incrementAndGet();
            }
        };

        Future<?> f1 = executor.submit(task);
        Future<?> f2 = executor.submit(task);

        assertTrue(readyLatch.await(5, TimeUnit.SECONDS));
        startLatch.countDown();

        f1.get(10, TimeUnit.SECONDS);
        f2.get(10, TimeUnit.SECONDS);
        executor.shutdown();

        assertEquals(1, successCount.get(), "Đúng 1 request phải thành công");
        assertEquals(1, conflictCount.get(), "Request thứ hai phải ném PatientChronicDiseaseAlreadyExistsException (409)");
        assertEquals(0, unexpectedExceptionCount.get(), "Không được có lỗi không mong muốn (ví dụ 500)");

        Integer activeInDb = jdbc.queryForObject(
                "SELECT COUNT(*) FROM patient_chronic_diseases WHERE patient_id = UUID_TO_BIN(?) AND diagnosis_catalog_id = UUID_TO_BIN(?) AND active = TRUE",
                Integer.class,
                PATIENT_ID.toString(),
                CATALOG_ID.toString()
        );
        assertEquals(1, activeInDb);
    }
}