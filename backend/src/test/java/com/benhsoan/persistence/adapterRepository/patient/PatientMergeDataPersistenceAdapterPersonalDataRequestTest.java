package com.benhsoan.persistence.adapterRepository.patient;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.time.Instant;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;

import com.benhsoan.domain.personaldata.enums.PersonalDataRequestStatus;
import com.benhsoan.persistence.entity.personaldata.PersonalDataRequestEntity;
import com.benhsoan.persistence.jpaRepository.personaldata.JpaPersonalDataRequestRepository;

import jakarta.persistence.EntityManager;

/**
 * NCL-15-CN-006 (Finding 4): patient merge must transfer personal_data_requests so
 * historical request records follow the target patient and are never deleted.
 */
@DataJpaTest(properties = {
        "spring.flyway.enabled=false",
        "spring.sql.init.mode=never",
        "spring.jpa.database-platform=org.hibernate.dialect.H2Dialect",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "spring.datasource.url=jdbc:h2:mem:merge;DB_CLOSE_DELAY=-1;MODE=MySQL;DATABASE_TO_LOWER=TRUE",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.datasource.username=sa",
        "spring.datasource.password="
})
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
class PatientMergeDataPersistenceAdapterPersonalDataRequestTest {

    private static final Instant NOW = Instant.parse("2026-09-26T08:00:00Z");

    @Autowired private EntityManager entityManager;
    @Autowired private JpaPersonalDataRequestRepository requestRepository;

    @Test
    void mergeTransfersPersonalDataRequestsFromSourceToTargetPatient() {
        UUID sourcePatientId = UUID.randomUUID();
        UUID targetPatientId = UUID.randomUUID();
        UUID requestId = UUID.randomUUID();

        requestRepository.saveAndFlush(PersonalDataRequestEntity.builder()
                .id(requestId)
                .patientId(sourcePatientId)
                .requestType("MEDICAL_RECORD_COPY")
                .status(PersonalDataRequestStatus.RECEIVED)
                .receivedAt(NOW)
                .dueAt(NOW.plusSeconds(86400))
                .createdAt(NOW)
                .build());

        assertEquals(sourcePatientId, requestRepository.findById(requestId).orElseThrow().getPatientId());

        PatientMergeDataPersistenceAdapter adapter = new PatientMergeDataPersistenceAdapter(entityManager);
        adapter.transferAllPatientData(sourcePatientId, targetPatientId);

        // Bulk JPQL updates bypass the persistence context; clear it so we re-read the row.
        entityManager.clear();

        PersonalDataRequestEntity transferred = requestRepository.findById(requestId).orElseThrow();
        assertEquals(targetPatientId, transferred.getPatientId());
        assertEquals(requestId, transferred.getId(), "request history must be preserved, not deleted");
        assertEquals(0, requestRepository.findAll().stream()
                .filter(e -> e.getPatientId().equals(sourcePatientId))
                .count());
    }
}