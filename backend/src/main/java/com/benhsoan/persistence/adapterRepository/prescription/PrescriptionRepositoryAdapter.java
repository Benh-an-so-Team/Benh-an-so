package com.benhsoan.persistence.adapterRepository.prescription;

import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.time.Instant;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import com.benhsoan.domain.prescription.Prescription;
import com.benhsoan.domain.prescription.PrescriptionItem;
import com.benhsoan.domain.prescription.enums.PrescriptionStatus;
import com.benhsoan.domain.prescription.enums.InterconnectionStatus;
import com.benhsoan.persistence.entity.prescription.PrescriptionEntity;
import com.benhsoan.persistence.entity.prescription.PrescriptionItemEntity;
import com.benhsoan.persistence.jpaRepository.prescription.JpaPrescriptionItemRepository;
import com.benhsoan.persistence.jpaRepository.prescription.JpaPrescriptionRepository;
import com.benhsoan.persistence.jpaRepository.prescription.PrescriptionCountProjection;
import com.benhsoan.persistence.mapper.prescription.PrescriptionItemPersistenceMapper;
import com.benhsoan.persistence.mapper.prescription.PrescriptionPersistenceMapper;
import com.benhsoan.port.outbound.repository.prescription.PrescriptionRepository;

import lombok.RequiredArgsConstructor;

@Repository
@RequiredArgsConstructor
public class PrescriptionRepositoryAdapter
        implements PrescriptionRepository {

    private final JpaPrescriptionRepository jpaRepository;

    private final JpaPrescriptionItemRepository itemJpaRepository;

    private final PrescriptionPersistenceMapper mapper;

    private final PrescriptionItemPersistenceMapper itemMapper;

    @Override
    @Transactional
    public Prescription save(Prescription prescription) {
        PrescriptionEntity savedEntity = jpaRepository.save(
                mapper.toEntity(prescription)
        );

        List<PrescriptionItemEntity> existingItems = itemJpaRepository
                .findByPrescriptionIdOrderByCreatedAtAsc(savedEntity.getId());
        Map<UUID, PrescriptionItemEntity> existingById = existingItems.stream()
                .collect(Collectors.toMap(
                        PrescriptionItemEntity::getId,
                        Function.identity()
                ));

        List<PrescriptionItemEntity> itemsToPersist = new ArrayList<>();
        for (PrescriptionItem item : prescription.getItems()) {
            PrescriptionItemEntity existing = existingById.remove(item.getId());
            if (existing == null) {
                itemsToPersist.add(itemMapper.toEntity(item));
            } else {
                updateItemInPlace(existing, item);
                itemsToPersist.add(existing);
            }
        }

        if (!existingById.isEmpty()) {
            itemJpaRepository.deleteAll(existingById.values());
        }

        List<PrescriptionItemEntity> savedItemEntities = itemJpaRepository.saveAll(itemsToPersist);

        return mapper.toDomain(savedEntity, savedItemEntities);
    }

    private void updateItemInPlace(PrescriptionItemEntity entity, PrescriptionItem item) {
        entity.setPrescriptionId(item.getPrescriptionId());
        entity.setMedicineId(item.getMedicineId());
        entity.setMedicineName(item.getMedicineName());
        entity.setActiveIngredient(item.getActiveIngredient());
        entity.setStrength(item.getStrength());
        entity.setUnit(item.getUnit());
        entity.setDosage(item.getDosage());
        entity.setFrequency(item.getFrequency());
        entity.setRoute(item.getRoute());
        entity.setDurationDays(item.getDurationDays());
        entity.setQuantity(item.getQuantity());
        entity.setDispensedQuantity(item.getDispensedQuantity());
        entity.setInstructions(item.getInstructions());
        entity.setUpdatedAt(item.getUpdatedAt());
        // `id` and `createdAt` are intentionally preserved so that existing
        // foreign-key references (e.g. prescription_dispense_items,
        // stock_movements) remain intact after a prescription update.
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<Prescription> findByPrescriptionCode(
            String prescriptionCode
    ) {
        return jpaRepository.findByPrescriptionCode(prescriptionCode)
                .map(this::toDomain);
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<Prescription> findById(UUID id) {
        return jpaRepository.findById(id).map(this::toDomain);
    }

    @Override
    @Transactional(readOnly = true)
    public List<Prescription> findAllById(Collection<UUID> ids) {
        if (ids == null || ids.isEmpty()) {
            return List.of();
        }
        return jpaRepository.findAllById(ids).stream()
                .map(this::toDomain)
                .toList();
    }

    @Override
    public boolean existsByPrescriptionCode(String prescriptionCode) {
        return jpaRepository.existsByPrescriptionCode(prescriptionCode);
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<Prescription> findTopByOrderByPrescriptionCodeDesc() {
        return jpaRepository.findTopByOrderByPrescriptionCodeDesc()
                .map(this::toDomain);
    }

    @Override
    @Transactional(readOnly = true)
    public List<Prescription> findByMedicalRecordId(UUID medicalRecordId) {
        return jpaRepository
                .findByMedicalRecordIdOrderByPrescribedAtDesc(medicalRecordId)
                .stream()
                .map(this::toDomain)
                .toList();
    }

    @Override
    @Transactional
    public List<Prescription> findByMedicalRecordIdAndStatusForUpdate(
            UUID medicalRecordId,
            PrescriptionStatus status
    ) {
        return jpaRepository
                .findByMedicalRecordIdAndStatusForUpdate(medicalRecordId, status)
                .stream()
                .map(this::toDomain)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public Map<UUID, Long> countByMedicalRecordIdIn(Collection<UUID> medicalRecordIds) {
        if (medicalRecordIds == null || medicalRecordIds.isEmpty()) {
            return Map.of();
        }
        return jpaRepository.countByMedicalRecordIdIn(medicalRecordIds).stream()
                .collect(Collectors.toMap(
                        PrescriptionCountProjection::medicalRecordId,
                        PrescriptionCountProjection::count
                ));
    }

    @Override
    @Transactional(readOnly = true)
    public Page<Prescription> findByStatus(
            PrescriptionStatus status,
            Pageable pageable
    ) {
        return jpaRepository.findByStatus(status, pageable)
                .map(this::toDomain);
    }

    @Override
    @Transactional(readOnly = true)
    public Page<Prescription> findByInterconnectionStatus(
            InterconnectionStatus status,
            Instant fromInclusive,
            Instant toExclusive,
            Pageable pageable
    ) {
        return jpaRepository.findByInterconnectionStatus(
                status, fromInclusive, toExclusive, pageable
        ).map(this::toDomain);
    }

    @Override
    @Transactional
    public Optional<Prescription> findByIdForUpdate(UUID id) {
        return jpaRepository.findByIdForUpdate(id)
                .map(this::toDomain);
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<Prescription> findReplacementOf(UUID originalPrescriptionId) {
        if (originalPrescriptionId == null) {
            return Optional.empty();
        }
        return jpaRepository.findByReplacesPrescriptionId(originalPrescriptionId)
                .map(this::toDomain);
    }

    private Prescription toDomain(PrescriptionEntity entity) {
        List<PrescriptionItemEntity> itemEntities = itemJpaRepository
                .findByPrescriptionIdOrderByCreatedAtAsc(entity.getId());

        return mapper.toDomain(entity, itemEntities);
    }
}
