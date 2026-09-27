package com.benhsoan.persistence.adapterRepository.billing;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;

import com.benhsoan.domain.billing.DiscountRequest;
import com.benhsoan.domain.billing.enums.DiscountRequestStatus;
import com.benhsoan.domain.billing.enums.DiscountType;
import com.benhsoan.persistence.entity.billing.DiscountRequestEntity;
import com.benhsoan.persistence.jpaRepository.billing.JpaDiscountRequestRepository;
import com.benhsoan.persistence.mapper.billing.DiscountRequestPersistenceMapper;
import com.benhsoan.port.outbound.repository.billing.DiscountRequestSearchCriteria;

@ExtendWith(MockitoExtension.class)
class DiscountRequestRepositoryAdapterTest {

    @Mock
    private JpaDiscountRequestRepository jpaRepository;

    @Spy
    private DiscountRequestPersistenceMapper mapper = new DiscountRequestPersistenceMapper();

    @InjectMocks
    private DiscountRequestRepositoryAdapter adapter;

    @Test
    void savesAndConvertsDomain() {
        UUID id = UUID.randomUUID();
        UUID visitId = UUID.randomUUID();
        UUID requesterId = UUID.randomUUID();
        Instant now = Instant.parse("2026-09-21T10:00:00Z");

        DiscountRequest domain = DiscountRequest.create(
                id,
                visitId,
                DiscountType.PERCENTAGE,
                new BigDecimal("10"),
                new BigDecimal("100000"),
                "Lý do ưu đãi",
                requesterId,
                now
        );

        when(jpaRepository.saveAndFlush(any(DiscountRequestEntity.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        DiscountRequest saved = adapter.save(domain);

        assertEquals(id, saved.getId());
        assertEquals(new BigDecimal("10000.00"), saved.getDiscountAmount());
        assertEquals(new BigDecimal("90000.00"), saved.getFinalAmount());
        verify(jpaRepository).saveAndFlush(any(DiscountRequestEntity.class));
    }

    @Test
    void findsByVisitIdAndStatus() {
        UUID id = UUID.randomUUID();
        UUID visitId = UUID.randomUUID();
        UUID requesterId = UUID.randomUUID();
        Instant now = Instant.parse("2026-09-21T10:00:00Z");

        DiscountRequestEntity entity = DiscountRequestEntity.builder()
                .id(id)
                .visitId(visitId)
                .discountType(DiscountType.PERCENTAGE)
                .discountValue(new BigDecimal("10.00"))
                .originalAmount(new BigDecimal("100000.00"))
                .discountAmount(new BigDecimal("10000.00"))
                .finalAmount(new BigDecimal("90000.00"))
                .reason("Lý do ưu đãi")
                .status(DiscountRequestStatus.PENDING)
                .requestedBy(requesterId)
                .requestedAt(now)
                .build();

        when(jpaRepository.findFirstByVisitIdAndStatusOrderByApprovedAtDesc(visitId, DiscountRequestStatus.PENDING))
                .thenReturn(Optional.of(entity));

        Optional<DiscountRequest> result = adapter.findByVisitIdAndStatus(visitId, DiscountRequestStatus.PENDING);

        assertTrue(result.isPresent());
        assertEquals(id, result.get().getId());
        assertEquals(DiscountRequestStatus.PENDING, result.get().getStatus());
    }

    @Test
    void findsByIdForUpdate() {
        UUID id = UUID.randomUUID();
        DiscountRequestEntity entity = DiscountRequestEntity.builder()
                .id(id)
                .visitId(UUID.randomUUID())
                .discountType(DiscountType.PERCENTAGE)
                .discountValue(new BigDecimal("10.00"))
                .originalAmount(new BigDecimal("100000.00"))
                .discountAmount(new BigDecimal("10000.00"))
                .finalAmount(new BigDecimal("90000.00"))
                .reason("Lý do ưu đãi")
                .status(DiscountRequestStatus.PENDING)
                .requestedBy(UUID.randomUUID())
                .requestedAt(Instant.now())
                .build();

        when(jpaRepository.findByIdForUpdate(id)).thenReturn(Optional.of(entity));

        Optional<DiscountRequest> result = adapter.findByIdForUpdate(id);

        assertTrue(result.isPresent());
        assertEquals(id, result.get().getId());
        verify(jpaRepository).findByIdForUpdate(id);
    }

    @Test
    void searchesWithCriteria() {
        UUID visitId = UUID.randomUUID();
        DiscountRequestSearchCriteria criteria = new DiscountRequestSearchCriteria(
                visitId,
                DiscountRequestStatus.PENDING,
                null,
                null,
                null,
                null,
                null
        );
        PageRequest pageable = PageRequest.of(0, 10);

        when(jpaRepository.search(visitId, DiscountRequestStatus.PENDING, null, null, null, null, null, pageable))
                .thenReturn(new PageImpl<>(List.of()));

        Page<DiscountRequest> result = adapter.search(criteria, pageable);

        assertEquals(0, result.getTotalElements());
        verify(jpaRepository).search(visitId, DiscountRequestStatus.PENDING, null, null, null, null, null, pageable);
    }
}
