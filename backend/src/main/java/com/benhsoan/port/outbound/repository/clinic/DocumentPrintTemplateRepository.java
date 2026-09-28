package com.benhsoan.port.outbound.repository.clinic;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import com.benhsoan.domain.clinic.DocumentPrintTemplate;
import com.benhsoan.domain.clinic.enums.PrintDocumentType;

public interface DocumentPrintTemplateRepository {

    List<DocumentPrintTemplate> findAll();

    Optional<DocumentPrintTemplate> findById(UUID id);

    Optional<DocumentPrintTemplate> findByDocumentType(PrintDocumentType documentType);

    DocumentPrintTemplate save(DocumentPrintTemplate template);
}
