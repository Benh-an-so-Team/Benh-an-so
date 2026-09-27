package com.benhsoan.persistence.mapper.prescription;

import org.springframework.stereotype.Component;

import com.benhsoan.domain.prescription.PrescriptionReconciliationNote;
import com.benhsoan.persistence.entity.prescription.PrescriptionReconciliationNoteEntity;

@Component
public class PrescriptionReconciliationNotePersistenceMapper {

    public PrescriptionReconciliationNote toDomain(PrescriptionReconciliationNoteEntity entity) {
        if (entity == null) {
            return null;
        }

        return PrescriptionReconciliationNote.restore(
                entity.getId(),
                entity.getPrescriptionId(),
                entity.getReconciliationOutcome(),
                entity.getReason(),
                entity.getNotedBy(),
                entity.getNotedAt(),
                entity.getCreatedAt()
        );
    }

    public PrescriptionReconciliationNoteEntity toEntity(PrescriptionReconciliationNote domain) {
        if (domain == null) {
            return null;
        }

        return PrescriptionReconciliationNoteEntity.builder()
                .id(domain.getId())
                .prescriptionId(domain.getPrescriptionId())
                .reconciliationOutcome(domain.getReconciliationOutcome())
                .reason(domain.getReason())
                .notedBy(domain.getNotedBy())
                .notedAt(domain.getNotedAt())
                .createdAt(domain.getCreatedAt())
                .build();
    }
}
