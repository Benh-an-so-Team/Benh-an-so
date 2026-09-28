package com.benhsoan.persistence.adapterRepository.appointment;

import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import com.benhsoan.port.outbound.repository.appointment.AppointmentCodeSequenceRepository;

import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;

@Repository
@RequiredArgsConstructor
@Transactional
public class AppointmentCodeSequenceRepositoryAdapter implements AppointmentCodeSequenceRepository {

    private final EntityManager entityManager;

    @Override
    public long reserveNextValue(String prefix) {
        return reserveNextValues(prefix, 1);
    }

    @Override
    public long reserveNextValues(String prefix, int count) {
        if (count <= 0) {
            throw new IllegalArgumentException("Số lượng mã cần cấp phát phải lớn hơn 0.");
        }

        entityManager.createNativeQuery("""
                INSERT INTO appointment_code_sequences (code_prefix, `last_value`)
                VALUES (:prefix, LAST_INSERT_ID(:count))
                ON DUPLICATE KEY UPDATE `last_value` = LAST_INSERT_ID(`last_value` + :count)
                """)
                .setParameter("prefix", prefix)
                .setParameter("count", count)
                .executeUpdate();

        Number value = (Number) entityManager
                .createNativeQuery("SELECT LAST_INSERT_ID()")
                .getSingleResult();
        return value.longValue();
    }
}
