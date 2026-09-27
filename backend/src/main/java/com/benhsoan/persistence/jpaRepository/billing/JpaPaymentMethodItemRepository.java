package com.benhsoan.persistence.jpaRepository.billing;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import com.benhsoan.persistence.entity.billing.PaymentMethodItemEntity;

public interface JpaPaymentMethodItemRepository extends JpaRepository<PaymentMethodItemEntity, UUID> {

    List<PaymentMethodItemEntity> findAllByPaymentId(UUID paymentId);

    void deleteAllByPaymentId(UUID paymentId);
}
