package com.benhsoan.persistence.jpaRepository.prescription;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.context.annotation.Import;

import com.benhsoan.domain.medicine.enums.AdministrationRoute;
import com.benhsoan.domain.prescription.Prescription;
import com.benhsoan.domain.prescription.PrescriptionItem;
import com.benhsoan.domain.prescription.enums.InterconnectionStatus;
import com.benhsoan.domain.prescription.enums.PrescriptionStatus;
import com.benhsoan.persistence.entity.prescription.PrescriptionEntity;
import com.benhsoan.persistence.mapper.prescription.PrescriptionItemPersistenceMapper;
import com.benhsoan.persistence.mapper.prescription.PrescriptionPersistenceMapper;

@DataJpaTest(properties = {
        "spring.flyway.enabled=false",
        "spring.sql.init.mode=never",
        "spring.jpa.database-platform=org.hibernate.dialect.H2Dialect",
        "spring.jpa.hibernate.ddl-auto=create-drop"
})
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.ANY)
@Import({PrescriptionPersistenceMapper.class, PrescriptionItemPersistenceMapper.class})
@DisplayName("Prescription replacement persistence")
class JpaPrescriptionRepositoryReplacementTest {

    private static final Instant NOW = Instant.parse("2026-09-25T03:00:00Z");
    private static final String REASON = "Sai liều lượng so với chẩn đoán đã cập nhật";

    @Autowired
    private JpaPrescriptionRepository repository;

    @Autowired
    private PrescriptionPersistenceMapper mapper;

    @Autowired
    private PrescriptionItemPersistenceMapper itemMapper;

    @Test
    @DisplayName("A replacement is found by the prescription it supersedes and maps back into the domain")
    void persistsAndFindsReplacementByOriginal() {
        UUID originalId = UUID.randomUUID();
        UUID replacementId = UUID.randomUUID();
        repository.saveAndFlush(entity(
                originalId, "RX000001", PrescriptionStatus.REPLACED, null, null, null));
        repository.saveAndFlush(entity(
                replacementId, "RX000002", PrescriptionStatus.PENDING_DISPENSE,
                originalId, "RX000001", REASON));

        Optional<PrescriptionEntity> found = repository.findByReplacesPrescriptionId(originalId);

        assertTrue(found.isPresent());
        assertEquals(replacementId, found.get().getId());

        Prescription domain = mapper.toDomain(found.get(), List.of(itemMapper.toEntity(item(replacementId))));
        assertEquals(originalId, domain.getReplacesPrescriptionId());
        assertEquals("RX000001", domain.getReplacesPrescriptionCode());
        assertEquals(REASON, domain.getReplacementReason());
        assertEquals(PrescriptionStatus.PENDING_DISPENSE, domain.getStatus());
    }

    @Test
    @DisplayName("An ordinary prescription carries no replacement metadata")
    void ordinaryPrescriptionHasNoReplacementMetadata() {
        UUID prescriptionId = UUID.randomUUID();
        repository.saveAndFlush(entity(
                prescriptionId, "RX000003", PrescriptionStatus.PENDING_DISPENSE, null, null, null));

        PrescriptionEntity entity = repository.findById(prescriptionId).orElseThrow();
        Prescription domain = mapper.toDomain(entity, List.of(itemMapper.toEntity(item(prescriptionId))));

        assertNull(domain.getReplacesPrescriptionId());
        assertNull(domain.getReplacesPrescriptionCode());
        assertNull(domain.getReplacementReason());
        assertTrue(repository.findByReplacesPrescriptionId(prescriptionId).isEmpty());
    }

    @Test
    @DisplayName("A superseded original keeps its interconnection history")
    void supersededOriginalKeepsInterconnectionHistory() {
        UUID originalId = UUID.randomUUID();
        PrescriptionEntity entity = entity(
                originalId, "RX000001", PrescriptionStatus.REPLACED, null, null, null);
        entity.setInterconnectionStatus(InterconnectionStatus.SUCCESS);
        entity.setLastInterconnectionAt(NOW.minusSeconds(300));
        entity.setInterconnectionReceiptCode("LT-20260925-000001");
        repository.saveAndFlush(entity);

        PrescriptionEntity reloaded = repository.findById(originalId).orElseThrow();
        Prescription domain = mapper.toDomain(reloaded, List.of(itemMapper.toEntity(item(originalId))));

        assertEquals(PrescriptionStatus.REPLACED, domain.getStatus());
        assertEquals(InterconnectionStatus.SUCCESS, domain.getInterconnectionStatus());
        assertEquals("LT-20260925-000001", domain.getInterconnectionReceiptCode());
        assertEquals(NOW.minusSeconds(300), domain.getLastInterconnectionAt());
    }

    private PrescriptionEntity entity(
            UUID id,
            String prescriptionCode,
            PrescriptionStatus status,
            UUID replacesPrescriptionId,
            String replacesPrescriptionCode,
            String replacementReason
    ) {
        return PrescriptionEntity.builder()
                .id(id)
                .prescriptionCode(prescriptionCode)
                .medicalRecordId(UUID.randomUUID())
                .status(status)
                .prescribedBy(UUID.randomUUID())
                .prescribedAt(NOW.minusSeconds(600))
                .interconnectionStatus(InterconnectionStatus.NOT_SENT)
                .replacesPrescriptionId(replacesPrescriptionId)
                .replacesPrescriptionCode(replacesPrescriptionCode)
                .replacementReason(replacementReason)
                .build();
    }

    private PrescriptionItem item(UUID prescriptionId) {
        return PrescriptionItem.create(
                UUID.randomUUID(), prescriptionId, UUID.randomUUID(),
                "Paracetamol", "Paracetamol", "500 mg", "vien", "1 vien", 2,
                AdministrationRoute.ORAL, 5, 10, null, NOW.minusSeconds(600));
    }
}
