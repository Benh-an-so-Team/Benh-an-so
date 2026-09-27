package com.benhsoan.persistence.jpaRepository.appointment;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import com.benhsoan.persistence.entity.appointment.AppointmentSeriesEntity;

public interface JpaAppointmentSeriesRepository extends JpaRepository<AppointmentSeriesEntity, UUID> {

    Optional<AppointmentSeriesEntity> findBySeriesCode(String seriesCode);

    List<AppointmentSeriesEntity> findByPatientIdOrderByCreatedAtDesc(UUID patientId);

    @Query(value = """
            SELECT series_code
            FROM appointment_series
            WHERE series_code REGEXP '[0-9]{6}$'
            ORDER BY CAST(RIGHT(series_code, 6) AS UNSIGNED) DESC
            LIMIT 1
            """, nativeQuery = true)
    Optional<String> findHighestSeriesCode();
}
