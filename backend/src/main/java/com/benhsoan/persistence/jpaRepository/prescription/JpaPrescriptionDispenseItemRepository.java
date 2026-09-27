package com.benhsoan.persistence.jpaRepository.prescription;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.benhsoan.persistence.entity.prescription.PrescriptionDispenseItemEntity;

public interface JpaPrescriptionDispenseItemRepository
        extends JpaRepository<PrescriptionDispenseItemEntity, UUID> {

    List<PrescriptionDispenseItemEntity> findByPrescriptionIdOrderByDispensedAtAsc(UUID prescriptionId);

    List<PrescriptionDispenseItemEntity> findByPrescriptionItemIdOrderByDispensedAtAsc(UUID prescriptionItemId);

    @Modifying
    @Query("delete from PrescriptionDispenseItemEntity dispense where dispense.prescriptionId in :prescriptionIds")
    void deleteByPrescriptionIdIn(@Param("prescriptionIds") Collection<UUID> prescriptionIds);

    /**
     * NCL-12-CN-007: batched last-dispensing-instant lookup for a whole page of
     * prescriptions, so the reconciliation list never issues one dispense query per row.
     */
    @Query("""
            select new com.benhsoan.persistence.jpaRepository.prescription.PrescriptionDispenseAggregateProjection(
                dispense.prescriptionId, max(dispense.dispensedAt)
            )
            from PrescriptionDispenseItemEntity dispense
            where dispense.prescriptionId in :prescriptionIds
            group by dispense.prescriptionId
            """)
    List<PrescriptionDispenseAggregateProjection> findDispenseAggregates(
            @Param("prescriptionIds") Collection<UUID> prescriptionIds);
}
