package com.benhsoan.persistence.adapterRepository.prescription;

import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import com.benhsoan.port.outbound.repository.prescription.PrescriptionCodeSequenceRepository;

import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;

@Repository
@RequiredArgsConstructor
public class PrescriptionCodeSequenceRepositoryAdapter
        implements PrescriptionCodeSequenceRepository {

    private final EntityManager entityManager;

    @Override
    @Transactional
    public long reserveNextValue(String prefix) {
        entityManager.createNativeQuery("""
                INSERT INTO prescription_code_sequences (code_prefix, `last_value`)
                VALUES (:prefix, LAST_INSERT_ID(1))
                ON DUPLICATE KEY UPDATE `last_value` = LAST_INSERT_ID(`last_value` + 1)
                """)
                .setParameter("prefix", prefix)
                .executeUpdate();

        Number value = (Number) entityManager
                .createNativeQuery("SELECT LAST_INSERT_ID()")
                .getSingleResult();
        return value.longValue();
    }
}
