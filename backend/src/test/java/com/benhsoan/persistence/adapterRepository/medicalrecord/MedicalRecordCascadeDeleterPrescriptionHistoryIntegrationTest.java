package com.benhsoan.persistence.adapterRepository.medicalrecord;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.context.annotation.Import;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import com.benhsoan.domain.prescription.enums.InterconnectionStatus;
import com.benhsoan.domain.prescription.enums.PrescriptionInterconnectionAttemptType;
import com.benhsoan.domain.prescription.enums.PrescriptionInterconnectionOutcome;
import com.benhsoan.domain.prescription.enums.PrescriptionReconciliationOutcome;
import com.benhsoan.domain.prescription.enums.PrescriptionStatus;
import com.benhsoan.persistence.entity.prescription.PrescriptionEntity;
import com.benhsoan.persistence.entity.prescription.PrescriptionInterconnectionLogEntity;
import com.benhsoan.persistence.entity.prescription.PrescriptionReconciliationNoteEntity;
import com.benhsoan.persistence.jpaRepository.prescription.JpaPrescriptionInterconnectionLogRepository;
import com.benhsoan.persistence.jpaRepository.prescription.JpaPrescriptionReconciliationNoteRepository;
import com.benhsoan.persistence.jpaRepository.prescription.JpaPrescriptionRepository;

import jakarta.persistence.EntityManager;

/**
 * Regression guard for the non-cascading foreign keys on the prescription child tables introduced
 * for transmission history (V21) and reconciliation notes (V102): the rows must be removed before
 * their prescriptions, otherwise medical-record deletion fails on a foreign-key-enforcing database.
 *
 * The foreign keys are added explicitly because Flyway is disabled in H2 slice tests (project
 * convention), so Hibernate alone would not create them and the defect would stay invisible.
 */
@DataJpaTest(properties = {
        "spring.flyway.enabled=false",
        "spring.sql.init.mode=never",
        "spring.datasource.url=jdbc:h2:mem:prescription-history-cascade;MODE=MySQL;DB_CLOSE_DELAY=-1;DATABASE_TO_LOWER=TRUE",
        "spring.jpa.database-platform=org.hibernate.dialect.H2Dialect",
        "spring.jpa.hibernate.ddl-auto=create-drop"
})
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.ANY)
@Import(MedicalRecordCascadeDeleter.class)
@DisplayName("MedicalRecordCascadeDeleter - prescription child tables - H2")
class MedicalRecordCascadeDeleterPrescriptionHistoryIntegrationTest {

    private static final Instant PRESCRIBED_AT = Instant.parse("2026-09-10T02:00:00Z");

    @Autowired
    private EntityManager entityManager;

    @Autowired
    private MedicalRecordCascadeDeleter deleter;

    @Autowired
    private JpaPrescriptionRepository prescriptionRepository;

    @Autowired
    private JpaPrescriptionReconciliationNoteRepository noteRepository;

    @Autowired
    private JpaPrescriptionInterconnectionLogRepository logRepository;

    @Test
    void medicalRecordWithReconciliationNotesIsDeleted() {
        UUID medicalRecordId = UUID.randomUUID();
        UUID firstPrescription = persistPrescription("RX900001", medicalRecordId, PrescriptionStatus.DISPENSED);
        UUID secondPrescription = persistPrescription("RX900002", medicalRecordId, PrescriptionStatus.PENDING_DISPENSE);
        persistNote(firstPrescription);
        persistNote(firstPrescription);
        persistNote(secondPrescription);
        entityManager.flush();

        addNotePrescriptionForeignKey();

        deleter.deleteByMedicalRecordId(medicalRecordId);
        entityManager.flush();

        assertTrue(notesOf(firstPrescription).isEmpty());
        assertTrue(notesOf(secondPrescription).isEmpty());
        assertFalse(prescriptionRepository.existsById(firstPrescription));
        assertFalse(prescriptionRepository.existsById(secondPrescription));
    }

    @Test
    void medicalRecordWithInterconnectionLogsIsDeleted() {
        UUID medicalRecordId = UUID.randomUUID();
        UUID firstPrescription = persistPrescription("RX900003", medicalRecordId, PrescriptionStatus.DISPENSED);
        UUID secondPrescription = persistPrescription("RX900004", medicalRecordId, PrescriptionStatus.PENDING_DISPENSE);
        persistLog(firstPrescription, 1);
        persistLog(firstPrescription, 2);
        persistLog(secondPrescription, 1);
        entityManager.flush();

        addInterconnectionLogPrescriptionForeignKey();

        deleter.deleteByMedicalRecordId(medicalRecordId);
        entityManager.flush();

        assertTrue(logsOf(firstPrescription).isEmpty());
        assertTrue(logsOf(secondPrescription).isEmpty());
        assertFalse(prescriptionRepository.existsById(firstPrescription));
        assertFalse(prescriptionRepository.existsById(secondPrescription));
    }

    @Test
    void childRowsOfOtherMedicalRecordsAreKept() {
        UUID deletedRecordId = UUID.randomUUID();
        UUID keptRecordId = UUID.randomUUID();
        UUID deletedPrescription = persistPrescription("RX900005", deletedRecordId, PrescriptionStatus.DISPENSED);
        UUID keptPrescription = persistPrescription("RX900006", keptRecordId, PrescriptionStatus.DISPENSED);
        persistNote(deletedPrescription);
        persistNote(keptPrescription);
        persistLog(deletedPrescription, 1);
        persistLog(keptPrescription, 1);
        entityManager.flush();

        addNotePrescriptionForeignKey();
        addInterconnectionLogPrescriptionForeignKey();

        deleter.deleteByMedicalRecordId(deletedRecordId);
        entityManager.flush();

        assertTrue(notesOf(deletedPrescription).isEmpty());
        assertTrue(logsOf(deletedPrescription).isEmpty());
        assertFalse(prescriptionRepository.existsById(deletedPrescription));

        assertEquals(1, notesOf(keptPrescription).size());
        assertEquals(1, logsOf(keptPrescription).size());
        assertTrue(prescriptionRepository.existsById(keptPrescription));
    }

    /**
     * The cascade deleter must join the caller's transaction. A {@code REQUIRES_NEW} boundary would
     * let the child-row deletions commit while the medical record itself is rolled back.
     */
    @Test
    void deletionJoinsTheCallersTransaction() throws NoSuchMethodException {
        Transactional transactional = MedicalRecordCascadeDeleter.class
                .getMethod("deleteByMedicalRecordId", UUID.class)
                .getAnnotation(Transactional.class);

        assertNotNull(transactional, "deleteByMedicalRecordId must stay transactional");
        assertEquals(Propagation.REQUIRED, transactional.propagation());
    }

    private List<PrescriptionReconciliationNoteEntity> notesOf(UUID prescriptionId) {
        return noteRepository.findByPrescriptionIdOrderByNotedAtAscIdAsc(prescriptionId);
    }

    private List<PrescriptionInterconnectionLogEntity> logsOf(UUID prescriptionId) {
        return logRepository.findByPrescriptionIdOrderByAttemptNumberAsc(prescriptionId);
    }

    /** Recreates the V102 / V21 foreign keys, which do not cascade. */
    private void addNotePrescriptionForeignKey() {
        recreateForeignKey("prescription_reconciliation_notes", "fk_reconciliation_note_prescription_test");
    }

    private void addInterconnectionLogPrescriptionForeignKey() {
        recreateForeignKey("prescription_interconnection_logs", "fk_interconnection_log_prescription_test");
    }

    private void recreateForeignKey(String table, String constraint) {
        entityManager.createNativeQuery(
                "ALTER TABLE " + table + " DROP CONSTRAINT IF EXISTS " + constraint).executeUpdate();
        entityManager.createNativeQuery("ALTER TABLE " + table + " ADD CONSTRAINT " + constraint
                + " FOREIGN KEY (prescription_id) REFERENCES prescriptions(id)").executeUpdate();
        entityManager.flush();
    }

    private UUID persistPrescription(String code, UUID medicalRecordId, PrescriptionStatus status) {
        UUID id = UUID.randomUUID();
        entityManager.persist(PrescriptionEntity.builder()
                .id(id)
                .prescriptionCode(code)
                .medicalRecordId(medicalRecordId)
                .status(status)
                .prescribedBy(UUID.randomUUID())
                .prescribedAt(PRESCRIBED_AT)
                .interconnectionStatus(InterconnectionStatus.FAILED)
                .build());
        return id;
    }

    private void persistNote(UUID prescriptionId) {
        entityManager.persist(PrescriptionReconciliationNoteEntity.builder()
                .id(UUID.randomUUID())
                .prescriptionId(prescriptionId)
                .reconciliationOutcome(PrescriptionReconciliationOutcome.DISPENSED_NOT_TRANSMITTED)
                .reason("Da xu ly thu cong")
                .notedBy(UUID.randomUUID())
                .notedAt(PRESCRIBED_AT)
                .createdAt(PRESCRIBED_AT)
                .build());
    }

    private void persistLog(UUID prescriptionId, int attemptNumber) {
        entityManager.persist(PrescriptionInterconnectionLogEntity.builder()
                .id(UUID.randomUUID())
                .prescriptionId(prescriptionId)
                .attemptNumber(attemptNumber)
                .attemptType(attemptNumber == 1
                        ? PrescriptionInterconnectionAttemptType.SEND
                        : PrescriptionInterconnectionAttemptType.RETRY)
                .outcome(PrescriptionInterconnectionOutcome.SUCCESS)
                .requestPayload("{\"prescriptionCode\":\"RX\"}")
                .responsePayload("{\"receiptCode\":\"LT-1\"}")
                .receiptCode("LT-" + attemptNumber)
                .attemptedBy(UUID.randomUUID())
                .startedAt(PRESCRIBED_AT)
                .completedAt(PRESCRIBED_AT.plusSeconds(1))
                .build());
    }
}
