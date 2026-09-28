package com.benhsoan.port.outbound.repository.prescription;

import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.time.Instant;
import java.util.UUID;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import com.benhsoan.domain.prescription.Prescription;
import com.benhsoan.domain.prescription.enums.PrescriptionStatus;
import com.benhsoan.domain.prescription.enums.InterconnectionStatus;
public interface PrescriptionRepository {

    Prescription save(Prescription prescription);

    Optional<Prescription> findById(UUID id);

    List<Prescription> findAllById(Collection<UUID> ids);

    Optional<Prescription> findByPrescriptionCode(String prescriptionCode);

    boolean existsByPrescriptionCode(String prescriptionCode);

    Optional<Prescription> findTopByOrderByPrescriptionCodeDesc();

    List<Prescription> findByMedicalRecordId(UUID medicalRecordId);

    List<Prescription> findByMedicalRecordIdAndStatusForUpdate(UUID medicalRecordId, PrescriptionStatus status);

    Map<UUID, Long> countByMedicalRecordIdIn(Collection<UUID> medicalRecordIds);

    Page<Prescription> findByStatus(PrescriptionStatus status, Pageable pageable);

    Page<Prescription> findByInterconnectionStatus(
            InterconnectionStatus status,
            Instant fromInclusive,
            Instant toExclusive,
            Pageable pageable
    );

    Optional<Prescription> findByIdForUpdate(UUID id);

    Optional<Prescription> findReplacementOf(UUID originalPrescriptionId);
}
