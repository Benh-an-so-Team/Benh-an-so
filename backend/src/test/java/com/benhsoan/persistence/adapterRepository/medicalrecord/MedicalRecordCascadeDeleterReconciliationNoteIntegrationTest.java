package com.benhsoan.persistence.adapterRepository.medicalrecord;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
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

import com.benhsoan.domain.prescription.enums.InterconnectionStatus;
import com.benhsoan.domain.prescription.enums.PrescriptionReconciliationOutcome;
import com.benhsoan.domain.prescription.enums.PrescriptionStatus;
import com.benhsoan.persistence.entity.prescription.PrescriptionEntity;
import com.benhsoan.persistence.entity.prescription.PrescriptionReconciliationNoteEntity;
import com.benhsoan.persistence.jpaRepository.prescription.JpaPrescriptionReconciliationNoteRepository;
import com.benhsoan.persistence.jpaRepository.prescription.JpaPrescriptionRepository;

import jakarta.persistence.EntityManager;

/**
 * Regression guard for the medical-record deletion defect: {@code prescription_reconciliation_notes}
 * has a non-cascading foreign key to {@code prescriptions(id)}, so deleting a medical record fails
 * unless the notes are removed before their prescriptions.
 *
 * The foreign key is added explicitly because Flyway is disabled in H2 slice tests (project
 * convention), so Hibernate alone would not create it and the defect would stay invisible.
 */
@DataJpaTest(properties = {
        "spring.flyway.enabled=false",
        "spring.sql.init.mode=never",
        "spring.datasource.url=jdbc:h2:mem:reconciliation-cascade;MODE=MySQL;DB_CLOSE_DELAY=-1;DATABASE_TO_LOWER=TRUE",
        "spring.jpa.database-platform=org.hibernate.dialect.H2Dialect",
        "spring.jpa.hibernate.ddl-auto=create-drop"
})
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.ANY)
@Import(MedicalRecordCascadeDeleter.class)
@DisplayName("MedicalRecordCascadeDeleter - reconciliation notes - H2")
class MedicalRecordCascadeDeleterReconciliationNoteIntegrationTest {

    private static final Instant PRESCRIBED_AT = Instant.parse("2026-09-10T02:00:00Z");

    @Autowired
    private EntityManager entityManager;

    @Autowired
    private MedicalRecordCascadeDeleter deleter;

    @Autowired
    private JpaPrescriptionRepository prescriptionRepository;

    @Autowired
    private JpaPrescriptionReconciliationNoteRepository noteRepository;

    @Test
    void medicalRecordWithPrescriptionsAndReconciliationNotesIsDeleted() {
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
    void reconciliationNotesOfOtherMedicalRecordsAreKept() {
        UUID deletedRecordId = UUID.randomUUID();
        UUID keptRecordId = UUID.randomUUID();
        UUID deletedPrescription = persistPrescription("RX900003", deletedRecordId, PrescriptionStatus.DISPENSED);
        UUID keptPrescription = persistPrescription("RX900004", keptRecordId, PrescriptionStatus.DISPENSED);
        persistNote(deletedPrescription);
        persistNote(keptPrescription);
        entityManager.flush();

        addNotePrescriptionForeignKey();

        deleter.deleteByMedicalRecordId(deletedRecordId);
        entityManager.flush();

        assertTrue(notesOf(deletedPrescription).isEmpty());
        assertFalse(prescriptionRepository.existsById(deletedPrescription));
        assertEquals(1, notesOf(keptPrescription).size());
        assertTrue(prescriptionRepository.existsById(keptPrescription));
    }

    private List<PrescriptionReconciliationNoteEntity> notesOf(UUID prescriptionId) {
        return noteRepository.findByPrescriptionIdOrderByNotedAtAscIdAsc(prescriptionId);
    }

    /** Mirrors the V102 foreign key: it does not cascade, so the delete order must be explicit. */
    private void addNotePrescriptionForeignKey() {
        entityManager.createNativeQuery("ALTER TABLE prescription_reconciliation_notes "
                + "DROP CONSTRAINT IF EXISTS fk_reconciliation_note_prescription_test")
                .executeUpdate();
        entityManager.createNativeQuery("ALTER TABLE prescription_reconciliation_notes "
                + "ADD CONSTRAINT fk_reconciliation_note_prescription_test "
                + "FOREIGN KEY (prescription_id) REFERENCES prescriptions(id)")
                .executeUpdate();
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
}
