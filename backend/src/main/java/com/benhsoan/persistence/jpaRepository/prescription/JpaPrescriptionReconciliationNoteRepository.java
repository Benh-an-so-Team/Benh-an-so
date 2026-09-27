package com.benhsoan.persistence.jpaRepository.prescription;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.benhsoan.persistence.entity.prescription.PrescriptionReconciliationNoteEntity;

public interface JpaPrescriptionReconciliationNoteRepository
        extends JpaRepository<PrescriptionReconciliationNoteEntity, UUID> {

    List<PrescriptionReconciliationNoteEntity> findByPrescriptionIdOrderByNotedAtAscIdAsc(
            UUID prescriptionId);

    /** Batched note count for a page of prescriptions (NCL-12-CN-007 reconciliation list). */
    @Query("""
            select new com.benhsoan.persistence.jpaRepository.prescription.PrescriptionReconciliationNoteCountProjection(
                note.prescriptionId, count(note)
            )
            from PrescriptionReconciliationNoteEntity note
            where note.prescriptionId in :prescriptionIds
            group by note.prescriptionId
            """)
    List<PrescriptionReconciliationNoteCountProjection> countByPrescriptionIdIn(
            @Param("prescriptionIds") Collection<UUID> prescriptionIds);

    @Modifying
    @Query("delete from PrescriptionReconciliationNoteEntity note where note.prescriptionId in :prescriptionIds")
    void deleteByPrescriptionIdIn(@Param("prescriptionIds") Collection<UUID> prescriptionIds);
}
