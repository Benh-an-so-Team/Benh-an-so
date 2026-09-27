package com.benhsoan.persistence.adapterRepository.prescription;

import java.util.List;
import java.util.UUID;

import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import com.benhsoan.domain.prescription.PrescriptionReconciliationNote;
import com.benhsoan.persistence.jpaRepository.prescription.JpaPrescriptionReconciliationNoteRepository;
import com.benhsoan.persistence.mapper.prescription.PrescriptionReconciliationNotePersistenceMapper;
import com.benhsoan.port.outbound.repository.prescription.PrescriptionReconciliationNoteRepository;

import lombok.RequiredArgsConstructor;

@Repository
@RequiredArgsConstructor
public class PrescriptionReconciliationNoteRepositoryAdapter
        implements PrescriptionReconciliationNoteRepository {

    private final JpaPrescriptionReconciliationNoteRepository jpaRepository;
    private final PrescriptionReconciliationNotePersistenceMapper mapper;

    @Override
    @Transactional
    public PrescriptionReconciliationNote save(PrescriptionReconciliationNote note) {
        return mapper.toDomain(jpaRepository.save(mapper.toEntity(note)));
    }

    @Override
    @Transactional(readOnly = true)
    public List<PrescriptionReconciliationNote> findByPrescriptionId(UUID prescriptionId) {
        return jpaRepository.findByPrescriptionIdOrderByNotedAtAscIdAsc(prescriptionId).stream()
                .map(mapper::toDomain)
                .toList();
    }
}
