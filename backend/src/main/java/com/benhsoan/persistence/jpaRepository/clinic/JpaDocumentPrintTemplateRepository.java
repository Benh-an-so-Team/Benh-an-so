package com.benhsoan.persistence.jpaRepository.clinic;

import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import com.benhsoan.persistence.entity.clinic.DocumentPrintTemplateEntity;

public interface JpaDocumentPrintTemplateRepository extends JpaRepository<DocumentPrintTemplateEntity, UUID> {

    Optional<DocumentPrintTemplateEntity> findByDocumentType(String documentType);

    boolean existsByDocumentType(String documentType);
}
