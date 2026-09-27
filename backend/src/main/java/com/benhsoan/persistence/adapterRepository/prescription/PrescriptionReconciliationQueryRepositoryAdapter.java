package com.benhsoan.persistence.adapterRepository.prescription;

import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import com.benhsoan.domain.prescription.PrescriptionReconciliationClassifier;
import com.benhsoan.domain.prescription.enums.PrescriptionReconciliationOutcome;
import com.benhsoan.persistence.jpaRepository.prescription.JpaPrescriptionDispenseItemRepository;
import com.benhsoan.persistence.jpaRepository.prescription.JpaPrescriptionReconciliationNoteRepository;
import com.benhsoan.persistence.jpaRepository.prescription.PrescriptionDispenseAggregateProjection;
import com.benhsoan.persistence.jpaRepository.prescription.PrescriptionReconciliationNoteCountProjection;
import com.benhsoan.persistence.jpaRepository.prescription.PrescriptionReconciliationProjection;
import com.benhsoan.port.dto.query.prescription.ReconciliationOutcomeGroup;
import com.benhsoan.port.dto.query.prescription.ReconciliationQueryFilter;
import com.benhsoan.port.dto.result.PrescriptionReconciliationItemResult;
import com.benhsoan.port.outbound.repository.prescription.PrescriptionReconciliationQueryRepository;

import jakarta.persistence.EntityManager;
import jakarta.persistence.TypedQuery;
import lombok.RequiredArgsConstructor;

/**
 * Reconciliation read adapter (NCL-12-CN-007 CV-02).
 *
 * A single page is served by exactly four queries: the reconciliation projection, the paged
 * count, and the two batched dispensing/note lookups. No per-row aggregate mapper is used, so
 * the query count does not grow with the page size.
 *
 * The JPQL is assembled here instead of being declared on the Spring Data interface, because the
 * outcome filter must accept any number of groups. Each group becomes one
 * {@code (status in ... and interconnectionStatus in ...)} block joined by OR, so the previous
 * two-group ceiling no longer exists. The same predicate text feeds both the page and the count
 * query, so the two can never drift apart; the count query deliberately omits the display joins
 * (medical record, visit, patient, doctor) because they cannot remove a row.
 */
@Repository
@RequiredArgsConstructor
public class PrescriptionReconciliationQueryRepositoryAdapter
        implements PrescriptionReconciliationQueryRepository {

    private static final String SELECT_PROJECTION = """
            select new com.benhsoan.persistence.jpaRepository.prescription.PrescriptionReconciliationProjection(
                prescription.id, prescription.prescriptionCode, prescription.medicalRecordId,
                prescription.status, prescription.interconnectionStatus,
                prescription.prescribedAt, prescription.lastInterconnectionAt,
                prescription.lastInterconnectionError, prescription.interconnectionReceiptCode,
                patient.id, patient.patientCode, patient.fullName,
                prescription.prescribedBy, doctor.fullName
            )
            from PrescriptionEntity prescription
            left join MedicalRecordEntity medicalRecord on medicalRecord.id = prescription.medicalRecordId
            left join VisitEntity visit on visit.id = medicalRecord.visitId
            left join PatientEntity patient on patient.id = visit.patientId
            left join UserEntity doctor on doctor.id = prescription.prescribedBy
            """;

    private static final String SELECT_COUNT = """
            select count(prescription)
            from PrescriptionEntity prescription
            """;

    private static final String ORDER_BY =
            "order by prescription.prescribedAt desc, prescription.id desc";

    private static final String PERIOD_AND_CODE_PREDICATE = """
            where (:prescriptionCode is null or prescription.prescriptionCode = :prescriptionCode)
              and (
                    :periodUnbounded = true
                    or (
                        (:fromInclusive is null or prescription.prescribedAt >= :fromInclusive)
                        and (:toExclusive is null or prescription.prescribedAt < :toExclusive)
                    )
                    or (
                        (:fromInclusive is null or prescription.lastInterconnectionAt >= :fromInclusive)
                        and (:toExclusive is null or prescription.lastInterconnectionAt < :toExclusive)
                    )
                    or exists (
                        select dispense.id from PrescriptionDispenseItemEntity dispense
                        where dispense.prescriptionId = prescription.id
                          and (:fromInclusive is null or dispense.dispensedAt >= :fromInclusive)
                          and (:toExclusive is null or dispense.dispensedAt < :toExclusive)
                    )
              )
            """;

    private final EntityManager entityManager;
    private final JpaPrescriptionDispenseItemRepository dispenseItemJpaRepository;
    private final JpaPrescriptionReconciliationNoteRepository noteJpaRepository;

    @Override
    @Transactional(readOnly = true)
    public Page<PrescriptionReconciliationItemResult> findByFilter(
            ReconciliationQueryFilter filter,
            Pageable pageable
    ) {
        String predicate = predicate(filter);
        Map<String, Object> parameters = parameters(filter);

        TypedQuery<PrescriptionReconciliationProjection> pageQuery = entityManager.createQuery(
                SELECT_PROJECTION + predicate + ORDER_BY,
                PrescriptionReconciliationProjection.class);
        parameters.forEach(pageQuery::setParameter);
        pageQuery.setFirstResult((int) pageable.getOffset());
        pageQuery.setMaxResults(pageable.getPageSize());

        TypedQuery<Long> countQuery = entityManager.createQuery(SELECT_COUNT + predicate, Long.class);
        parameters.forEach(countQuery::setParameter);
        Long total = countQuery.getSingleResult();

        List<PrescriptionReconciliationProjection> content = pageQuery.getResultList();
        List<UUID> prescriptionIds = content.stream()
                .map(PrescriptionReconciliationProjection::prescriptionId)
                .toList();

        Map<UUID, Instant> lastDispensedAtById = findLastDispensedAt(prescriptionIds);
        Map<UUID, Long> noteCountById = countNotes(prescriptionIds);

        List<PrescriptionReconciliationItemResult> rows = content.stream()
                .map(projection -> toResult(
                        projection,
                        lastDispensedAtById.get(projection.prescriptionId()),
                        noteCountById.getOrDefault(projection.prescriptionId(), 0L)))
                .toList();

        return new PageImpl<>(rows, pageable, total == null ? 0L : total);
    }

    /**
     * Expands every requested outcome group into its own OR block, so the number of groups is
     * limited only by what the caller asks for. An empty group list means "no outcome filter".
     */
    private static String predicate(ReconciliationQueryFilter filter) {
        List<ReconciliationOutcomeGroup> groups = filter.outcomeGroups();
        if (groups.isEmpty()) {
            return PERIOD_AND_CODE_PREDICATE;
        }
        StringBuilder jpql = new StringBuilder(PERIOD_AND_CODE_PREDICATE).append("  and (");
        for (int index = 0; index < groups.size(); index++) {
            if (index > 0) {
                jpql.append("\n       or ");
            }
            jpql.append("(prescription.status in :group").append(index)
                    .append("DispensingStatuses and prescription.interconnectionStatus in :group")
                    .append(index).append("InterconnectionStatuses)");
        }
        return jpql.append(")\n").toString();
    }

    /** Binds exactly the parameters named by {@link #predicate(ReconciliationQueryFilter)}. */
    private static Map<String, Object> parameters(ReconciliationQueryFilter filter) {
        Map<String, Object> parameters = new HashMap<>();
        parameters.put("prescriptionCode", filter.prescriptionCode());
        parameters.put("periodUnbounded", filter.periodUnbounded());
        parameters.put("fromInclusive", filter.fromInclusive());
        parameters.put("toExclusive", filter.toExclusive());
        List<ReconciliationOutcomeGroup> groups = filter.outcomeGroups();
        for (int index = 0; index < groups.size(); index++) {
            parameters.put("group" + index + "DispensingStatuses",
                    groups.get(index).dispensingStatuses());
            parameters.put("group" + index + "InterconnectionStatuses",
                    groups.get(index).interconnectionStatuses());
        }
        return parameters;
    }

    private Map<UUID, Instant> findLastDispensedAt(List<UUID> prescriptionIds) {
        if (prescriptionIds.isEmpty()) {
            return Map.of();
        }
        return dispenseItemJpaRepository.findDispenseAggregates(prescriptionIds).stream()
                .collect(Collectors.toMap(
                        PrescriptionDispenseAggregateProjection::prescriptionId,
                        PrescriptionDispenseAggregateProjection::lastDispensedAt));
    }

    private Map<UUID, Long> countNotes(List<UUID> prescriptionIds) {
        if (prescriptionIds.isEmpty()) {
            return Map.of();
        }
        return noteJpaRepository.countByPrescriptionIdIn(prescriptionIds).stream()
                .collect(Collectors.toMap(
                        PrescriptionReconciliationNoteCountProjection::prescriptionId,
                        PrescriptionReconciliationNoteCountProjection::noteCount));
    }

    private PrescriptionReconciliationItemResult toResult(
            PrescriptionReconciliationProjection projection,
            Instant lastDispensedAt,
            long reconciliationNoteCount
    ) {
        PrescriptionReconciliationOutcome outcome = PrescriptionReconciliationClassifier.classify(
                projection.prescriptionStatus(), projection.interconnectionStatus());
        return new PrescriptionReconciliationItemResult(
                projection.prescriptionId(),
                projection.prescriptionCode(),
                projection.patientId(),
                projection.patientCode(),
                projection.patientName(),
                projection.doctorId(),
                projection.doctorName(),
                projection.prescriptionStatus(),
                projection.interconnectionStatus(),
                outcome,
                outcome.isDiscrepancy(),
                PrescriptionReconciliationClassifier.isRetransmissionEligible(projection.interconnectionStatus()),
                projection.prescribedAt(),
                projection.lastInterconnectionAt(),
                lastDispensedAt,
                projection.lastInterconnectionError(),
                projection.interconnectionReceiptCode(),
                reconciliationNoteCount);
    }
}
