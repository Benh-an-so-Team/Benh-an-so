package com.benhsoan.persistence.jpaRepository.survey;

import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import com.benhsoan.persistence.entity.survey.SatisfactionSurveyEntity;

public interface JpaSatisfactionSurveyRepository extends JpaRepository<SatisfactionSurveyEntity, UUID> {

    Optional<SatisfactionSurveyEntity> findByVisitId(UUID visitId);

    boolean existsByVisitId(UUID visitId);
}
