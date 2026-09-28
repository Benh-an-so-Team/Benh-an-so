package com.benhsoan.persistence.adapterRepository.patient;

import java.util.List;
import java.util.UUID;

import org.springframework.stereotype.Repository;

import com.benhsoan.port.outbound.repository.patient.PatientMergeDataPort;

import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;

@Repository
@RequiredArgsConstructor
public class PatientMergeDataPersistenceAdapter implements PatientMergeDataPort {

        private final EntityManager entityManager;

        @Override
        public int transferAllPatientData(UUID sourcePatientId, UUID targetPatientId) {
                // 1. Deduplicate and transfer patient allergies safely
                transferAllergiesSafely(sourcePatientId, targetPatientId);

                // 2. Transfer Visits (all attached medical records, prescriptions, payments,
                // invoices link via visit_id)
                int transferredVisits = entityManager.createQuery(
                                "UPDATE VisitEntity v SET v.patientId = :targetId WHERE v.patientId = :sourceId")
                                .setParameter("targetId", targetPatientId)
                                .setParameter("sourceId", sourcePatientId)
                                .executeUpdate();

                // 3. Transfer Appointments
                entityManager.createQuery(
                                "UPDATE AppointmentEntity a SET a.patientId = :targetId WHERE a.patientId = :sourceId")
                                .setParameter("targetId", targetPatientId)
                                .setParameter("sourceId", sourcePatientId)
                                .executeUpdate();

                // 4. Transfer Queue Items
                entityManager.createQuery(
                                "UPDATE QueueItemEntity q SET q.patientId = :targetId WHERE q.patientId = :sourceId")
                                .setParameter("targetId", targetPatientId)
                                .setParameter("sourceId", sourcePatientId)
                                .executeUpdate();

                // 5. Transfer Clinical Orders (which has both patient_id and visit_id)
                entityManager.createQuery(
                                "UPDATE ClinicalOrderEntity c SET c.patientId = :targetId WHERE c.patientId = :sourceId")
                                .setParameter("targetId", targetPatientId)
                                .setParameter("sourceId", sourcePatientId)
                                .executeUpdate();

                // 6. Transfer Follow-up Reminders
                entityManager.createQuery(
                                "UPDATE FollowUpReminderEntity f SET f.patientId = :targetId WHERE f.patientId = :sourceId")
                                .setParameter("targetId", targetPatientId)
                                .setParameter("sourceId", sourcePatientId)
                                .executeUpdate();

                // 7. Transfer Post-care Logs
                entityManager.createQuery(
                                "UPDATE PostCareLogEntity p SET p.patientId = :targetId WHERE p.patientId = :sourceId")
                                .setParameter("targetId", targetPatientId)
                                .setParameter("sourceId", sourcePatientId)
                                .executeUpdate();

                // 8. Transfer Prescription Allergy Warning Logs
                entityManager.createQuery(
                                "UPDATE PrescriptionAllergyWarningLogEntity w SET w.patientId = :targetId WHERE w.patientId = :sourceId")
                                .setParameter("targetId", targetPatientId)
                                .setParameter("sourceId", sourcePatientId)
                                .executeUpdate();

                // 9. Transfer Medical Record Access Logs
                entityManager.createQuery(
                                "UPDATE MedicalRecordAccessLogEntity m SET m.patientId = :targetId WHERE m.patientId = :sourceId")
                                .setParameter("targetId", targetPatientId)
                                .setParameter("sourceId", sourcePatientId)
                                .executeUpdate();

                // 10. Transfer Appointment Notification Logs
                entityManager.createQuery(
                                "UPDATE AppointmentNotificationLogEntity a SET a.patientId = :targetId WHERE a.patientId = :sourceId")
                                .setParameter("targetId", targetPatientId)
                                .setParameter("sourceId", sourcePatientId)
                                .executeUpdate();

                // 11. Transfer Patient Chronic Diseases safely (deactivate duplicates to
                // prevent unique constraint violation)
                transferChronicDiseasesSafely(sourcePatientId, targetPatientId);

                // 12. Transfer Patient Family Histories
                transferFamilyHistories(sourcePatientId, targetPatientId);

                // 13. Transfer Personal Data Requests (NCL-15-CN-006: patient-owned historical
                // data that must follow the patient on merge)
                entityManager.createQuery(
                                "UPDATE PersonalDataRequestEntity p SET p.patientId = :targetId WHERE p.patientId = :sourceId")
                                .setParameter("targetId", targetPatientId)
                                .setParameter("sourceId", sourcePatientId)
                                .executeUpdate();

                return transferredVisits;
        }

        private void transferChronicDiseasesSafely(UUID sourcePatientId, UUID targetPatientId) {
                // Query target patient's active diagnosis catalog IDs
                List<UUID> targetActiveCatalogs = entityManager.createQuery(
                                "SELECT c.diagnosisCatalogId FROM PatientChronicDiseaseEntity c WHERE c.patientId = :targetId AND c.active = true",
                                UUID.class)
                                .setParameter("targetId", targetPatientId)
                                .getResultList();

                // Deactivate source patient's duplicate active chronic diseases to prevent
                // unique
                // constraint violation (uk_patient_active_chronic_disease)
                if (!targetActiveCatalogs.isEmpty()) {
                        entityManager.createQuery(
                                        "UPDATE PatientChronicDiseaseEntity c SET c.active = false WHERE c.patientId = :sourceId AND c.active = true AND c.diagnosisCatalogId IN :targetCatalogs")
                                        .setParameter("sourceId", sourcePatientId)
                                        .setParameter("targetCatalogs", targetActiveCatalogs)
                                        .executeUpdate();
                }

                // Transfer all chronic diseases of source to target
                entityManager.createQuery(
                                "UPDATE PatientChronicDiseaseEntity c SET c.patientId = :targetId WHERE c.patientId = :sourceId")
                                .setParameter("targetId", targetPatientId)
                                .setParameter("sourceId", sourcePatientId)
                                .executeUpdate();
        }

        private void transferFamilyHistories(UUID sourcePatientId, UUID targetPatientId) {
                entityManager.createQuery(
                                "UPDATE PatientFamilyHistoryEntity f SET f.patientId = :targetId WHERE f.patientId = :sourceId")
                                .setParameter("targetId", targetPatientId)
                                .setParameter("sourceId", sourcePatientId)
                                .executeUpdate();
        }

        private void transferAllergiesSafely(UUID sourcePatientId, UUID targetPatientId) {
                // Query target patient's active normalized allergen names
                List<String> targetAllergens = entityManager.createQuery(
                                "SELECT a.normalizedAllergenName FROM PatientAllergyEntity a WHERE a.patientId = :targetId AND a.active = true",
                                String.class)
                                .setParameter("targetId", targetPatientId)
                                .getResultList();

                // Deactivate source patient's duplicate active allergies to prevent unique
                // constraint violation (uk_patient_active_allergen)
                if (!targetAllergens.isEmpty()) {
                        entityManager.createQuery(
                                        "UPDATE PatientAllergyEntity a SET a.active = false WHERE a.patientId = :sourceId AND a.active = true AND a.normalizedAllergenName IN :targetAllergens")
                                        .setParameter("sourceId", sourcePatientId)
                                        .setParameter("targetAllergens", targetAllergens)
                                        .executeUpdate();
                }

                // Transfer all remaining allergies of source to target
                entityManager.createQuery(
                                "UPDATE PatientAllergyEntity a SET a.patientId = :targetId WHERE a.patientId = :sourceId")
                                .setParameter("targetId", targetPatientId)
                                .setParameter("sourceId", sourcePatientId)
                                .executeUpdate();

                // Transfer allergy change logs
                entityManager.createQuery(
                                "UPDATE PatientAllergyChangeLogEntity c SET c.patientId = :targetId WHERE c.patientId = :sourceId")
                                .setParameter("targetId", targetPatientId)
                                .setParameter("sourceId", sourcePatientId)
                                .executeUpdate();
        }

        @Override
        public boolean hasFinalizedMedicalRecords(UUID patientId) {
                Long count = entityManager.createQuery(
                                """
                                                SELECT COUNT(mr) FROM MedicalRecordEntity mr
                                                JOIN VisitEntity v ON v.id = mr.visitId
                                                WHERE v.patientId = :patientId
                                                  AND mr.status IN ('SIGNED', 'LOCKED', 'ARCHIVED')
                                                """, Long.class)
                                .setParameter("patientId", patientId)
                                .getSingleResult();
                return count != null && count > 0;
        }
}
