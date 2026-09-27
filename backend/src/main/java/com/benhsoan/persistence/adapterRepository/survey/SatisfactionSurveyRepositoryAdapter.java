package com.benhsoan.persistence.adapterRepository.survey;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import com.benhsoan.domain.survey.PatientSatisfactionSurvey;
import com.benhsoan.persistence.entity.survey.SatisfactionSurveyEntity;
import com.benhsoan.persistence.jpaRepository.survey.JpaSatisfactionSurveyRepository;
import com.benhsoan.persistence.mapper.survey.SatisfactionSurveyPersistenceMapper;
import com.benhsoan.port.outbound.repository.survey.DoctorSatisfactionSummary;
import com.benhsoan.port.outbound.repository.survey.SatisfactionOverallSummary;
import com.benhsoan.port.outbound.repository.survey.SatisfactionReportQueryRepository;
import com.benhsoan.port.outbound.repository.survey.SatisfactionScoreCount;
import com.benhsoan.port.outbound.repository.survey.SatisfactionSurveyRepository;

import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;

@Repository
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class SatisfactionSurveyRepositoryAdapter
        implements SatisfactionSurveyRepository, SatisfactionReportQueryRepository {

    private final JpaSatisfactionSurveyRepository jpaRepository;
    private final SatisfactionSurveyPersistenceMapper mapper;
    private final EntityManager entityManager;

    @Override
    @Transactional
    public PatientSatisfactionSurvey save(PatientSatisfactionSurvey survey) {
        SatisfactionSurveyEntity entity = mapper.toEntity(survey);
        SatisfactionSurveyEntity saved = jpaRepository.save(entity);
        return mapper.toDomain(saved);
    }

    @Override
    public Optional<PatientSatisfactionSurvey> findById(UUID id) {
        return jpaRepository.findById(id).map(mapper::toDomain);
    }

    @Override
    public Optional<PatientSatisfactionSurvey> findByVisitId(UUID visitId) {
        return jpaRepository.findByVisitId(visitId).map(mapper::toDomain);
    }

    @Override
    public boolean existsByVisitId(UUID visitId) {
        return jpaRepository.existsByVisitId(visitId);
    }

    @Override
    public SatisfactionOverallSummary getOverallSummary(Instant fromInclusive, Instant toExclusive, UUID doctorId) {
        String jpql = """
                select count(s.id), coalesce(avg(cast(s.score as double)), 0.0)
                from SatisfactionSurveyEntity s
                where s.createdAt >= :fromInclusive
                  and s.createdAt < :toExclusive
                """ + (doctorId != null ? "  and s.doctorId = :doctorId\n" : "\n");

        var query = entityManager.createQuery(jpql, Object[].class)
                .setParameter("fromInclusive", fromInclusive)
                .setParameter("toExclusive", toExclusive);

        if (doctorId != null) {
            query.setParameter("doctorId", doctorId);
        }

        Object[] result = query.getSingleResult();
        long total = ((Number) result[0]).longValue();
        double avg = ((Number) result[1]).doubleValue();
        return new SatisfactionOverallSummary(total, avg);
    }

    @Override
    public List<SatisfactionScoreCount> getScoreDistribution(Instant fromInclusive, Instant toExclusive, UUID doctorId) {
        String jpql = """
                select s.score, count(s.id)
                from SatisfactionSurveyEntity s
                where s.createdAt >= :fromInclusive
                  and s.createdAt < :toExclusive
                """ + (doctorId != null ? "  and s.doctorId = :doctorId\n" : "\n")
                + "group by s.score\norder by s.score asc\n";

        var query = entityManager.createQuery(jpql, Object[].class)
                .setParameter("fromInclusive", fromInclusive)
                .setParameter("toExclusive", toExclusive);

        if (doctorId != null) {
            query.setParameter("doctorId", doctorId);
        }

        return query.getResultList().stream()
                .map(row -> new SatisfactionScoreCount(((Number) row[0]).intValue(), ((Number) row[1]).longValue()))
                .toList();
    }

    @Override
    public List<DoctorSatisfactionSummary> getDoctorSummaries(Instant fromInclusive, Instant toExclusive, UUID doctorId) {
        String jpql = """
                select d.id, d.username, d.fullName, count(s.id), coalesce(avg(cast(s.score as double)), 0.0)
                from SatisfactionSurveyEntity s
                join UserEntity d on d.id = s.doctorId
                where s.createdAt >= :fromInclusive
                  and s.createdAt < :toExclusive
                """ + (doctorId != null ? "  and s.doctorId = :doctorId\n" : "\n")
                + "group by d.id, d.username, d.fullName\norder by count(s.id) desc, d.fullName asc\n";

        var query = entityManager.createQuery(jpql, Object[].class)
                .setParameter("fromInclusive", fromInclusive)
                .setParameter("toExclusive", toExclusive);

        if (doctorId != null) {
            query.setParameter("doctorId", doctorId);
        }

        return query.getResultList().stream()
                .map(row -> new DoctorSatisfactionSummary(
                        (UUID) row[0],
                        (String) row[1],
                        (String) row[2],
                        ((Number) row[3]).longValue(),
                        ((Number) row[4]).doubleValue()
                ))
                .toList();
    }
}
