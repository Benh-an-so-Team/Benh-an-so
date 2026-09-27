package com.benhsoan.persistence.adapterRepository.billing;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import com.benhsoan.domain.billing.DiscountRequest;
import com.benhsoan.domain.billing.enums.DiscountRequestStatus;
import com.benhsoan.persistence.entity.billing.DiscountRequestEntity;
import com.benhsoan.persistence.jpaRepository.billing.JpaDiscountRequestRepository;
import com.benhsoan.persistence.mapper.billing.DiscountRequestPersistenceMapper;
import com.benhsoan.port.outbound.repository.billing.DiscountRequestRepository;
import com.benhsoan.port.outbound.repository.billing.DiscountRequestSearchCriteria;

import lombok.RequiredArgsConstructor;

@Repository
@RequiredArgsConstructor
public class DiscountRequestRepositoryAdapter implements DiscountRequestRepository {

    private final JpaDiscountRequestRepository jpaRepository;
    private final DiscountRequestPersistenceMapper mapper;

    @Override
    @Transactional
    public DiscountRequest save(DiscountRequest discountRequest) {
        try {
            DiscountRequestEntity entity = mapper.toEntity(discountRequest);
            DiscountRequestEntity saved = jpaRepository.saveAndFlush(entity);
            return mapper.toDomain(saved != null ? saved : entity);
        } catch (org.springframework.dao.DataIntegrityViolationException ex) {
            if (isDuplicateActiveDiscountConflict(ex)) {
                throw new com.benhsoan.domain.billing.exception.DiscountAlreadyExistsException(
                        discountRequest.getVisitId());
            }
            throw ex;
        }
    }

    private boolean isDuplicateActiveDiscountConflict(org.springframework.dao.DataIntegrityViolationException ex) {
        String message = extractMessage(ex).toLowerCase();
        return message.contains("uk_discount_requests_active_visit")
                || message.contains("discount_requests")
                || (message.contains("duplicate entry") && message.contains("active"));
    }

    private String extractMessage(Throwable throwable) {
        StringBuilder builder = new StringBuilder();
        Throwable current = throwable;
        while (current != null) {
            if (current.getMessage() != null) {
                builder.append(current.getMessage()).append(' ');
            }
            current = current.getCause();
        }
        return builder.toString();
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<DiscountRequest> findById(UUID id) {
        return jpaRepository.findById(id).map(mapper::toDomain);
    }

    @Override
    @Transactional
    public Optional<DiscountRequest> findByIdForUpdate(UUID id) {
        return jpaRepository.findByIdForUpdate(id).map(mapper::toDomain);
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<DiscountRequest> findByVisitIdAndStatus(UUID visitId, DiscountRequestStatus status) {
        return jpaRepository.findFirstByVisitIdAndStatusOrderByApprovedAtDesc(visitId, status)
                .map(mapper::toDomain);
    }

    @Override
    @Transactional(readOnly = true)
    public List<DiscountRequest> findByVisitId(UUID visitId) {
        return jpaRepository.findByVisitIdOrderByRequestedAtDesc(visitId)
                .stream()
                .map(mapper::toDomain)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public boolean existsByVisitIdAndStatus(UUID visitId, DiscountRequestStatus status) {
        return jpaRepository.existsByVisitIdAndStatus(visitId, status);
    }

    @Override
    @Transactional(readOnly = true)
    public Page<DiscountRequest> search(DiscountRequestSearchCriteria criteria, Pageable pageable) {
        if (criteria == null) {
            return jpaRepository.findAll(pageable).map(mapper::toDomain);
        }

        return jpaRepository.search(
                criteria.visitId(),
                criteria.status(),
                criteria.discountType(),
                criteria.requestedBy(),
                criteria.approvedBy(),
                criteria.requestedFrom(),
                criteria.requestedTo(),
                pageable).map(mapper::toDomain);
    }
}
