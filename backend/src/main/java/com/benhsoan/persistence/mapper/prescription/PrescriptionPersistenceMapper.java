package com.benhsoan.persistence.mapper.prescription;

import java.util.List;
import java.util.Objects;

import org.springframework.stereotype.Component;

import com.benhsoan.domain.prescription.Prescription;
import com.benhsoan.domain.prescription.PrescriptionItem;
import com.benhsoan.persistence.entity.prescription.PrescriptionEntity;
import com.benhsoan.persistence.entity.prescription.PrescriptionItemEntity;

@Component
public class PrescriptionPersistenceMapper {

    private final PrescriptionItemPersistenceMapper itemMapper;

    public PrescriptionPersistenceMapper(PrescriptionItemPersistenceMapper itemMapper) {
        this.itemMapper = itemMapper;
    }

    public Prescription toDomain(
            PrescriptionEntity entity,
            List<PrescriptionItemEntity> itemEntities
    ) {
        if (entity == null) {
            return null;
        }

        Objects.requireNonNull(itemEntities, "Prescription item entities are required.");

        List<PrescriptionItem> items = itemEntities.stream()
                .map(itemMapper::toDomain)
                .toList();

        return Prescription.restore(
                entity.getId(),
                entity.getPrescriptionCode(),
                entity.getMedicalRecordId(),
                entity.getStatus(),
                entity.getNote(),
                entity.getCancelReason(),
                entity.getPrescribedBy(),
                entity.getPrescribedAt(),
                entity.getUpdatedBy(),
                entity.getUpdatedAt(),
                entity.getInterconnectionStatus(),
                entity.getLastInterconnectionAt(),
                entity.getLastInterconnectionError(),
                entity.getInterconnectionReceiptCode(),
                entity.getReplacesPrescriptionId(),
                entity.getReplacesPrescriptionCode(),
                entity.getReplacementReason(),
                items
        );
    }

    public PrescriptionEntity toEntity(Prescription domain) {
        if (domain == null) {
            return null;
        }

        return PrescriptionEntity.builder()
                .id(domain.getId())
                .prescriptionCode(domain.getPrescriptionCode())
                .medicalRecordId(domain.getMedicalRecordId())
                .status(domain.getStatus())
                .note(domain.getNote())
                .cancelReason(domain.getCancelReason())
                .prescribedBy(domain.getPrescribedBy())
                .prescribedAt(domain.getPrescribedAt())
                .updatedBy(domain.getUpdatedBy())
                .updatedAt(domain.getUpdatedAt())
                .interconnectionStatus(domain.getInterconnectionStatus())
                .lastInterconnectionAt(domain.getLastInterconnectionAt())
                .lastInterconnectionError(domain.getLastInterconnectionError())
                .interconnectionReceiptCode(domain.getInterconnectionReceiptCode())
                .replacesPrescriptionId(domain.getReplacesPrescriptionId())
                .replacesPrescriptionCode(domain.getReplacesPrescriptionCode())
                .replacementReason(domain.getReplacementReason())
                .build();
    }
}
