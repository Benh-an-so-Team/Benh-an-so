package com.benhsoan.persistence.jpaRepository.prescription;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.benhsoan.persistence.entity.prescription.PrescriptionInterconnectionLogEntity;

public interface JpaPrescriptionInterconnectionLogRepository
        extends JpaRepository<PrescriptionInterconnectionLogEntity, UUID> {

    List<PrescriptionInterconnectionLogEntity> findByPrescriptionIdOrderByAttemptNumberAsc(UUID prescriptionId);

    @Modifying
    @Query("delete from PrescriptionInterconnectionLogEntity log where log.prescriptionId in :prescriptionIds")
    void deleteByPrescriptionIdIn(@Param("prescriptionIds") Collection<UUID> prescriptionIds);
}
