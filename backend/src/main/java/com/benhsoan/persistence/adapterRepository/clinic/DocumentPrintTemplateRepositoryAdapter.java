package com.benhsoan.persistence.adapterRepository.clinic;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.stereotype.Component;

import com.benhsoan.domain.clinic.DocumentPrintTemplate;
import com.benhsoan.domain.clinic.enums.PrintDocumentType;
import com.benhsoan.persistence.jpaRepository.clinic.JpaDocumentPrintTemplateRepository;
import com.benhsoan.persistence.mapper.clinic.DocumentPrintTemplatePersistenceMapper;
import com.benhsoan.port.outbound.repository.clinic.DocumentPrintTemplateRepository;

import lombok.RequiredArgsConstructor;

@Component
@RequiredArgsConstructor
public class DocumentPrintTemplateRepositoryAdapter implements DocumentPrintTemplateRepository {

    private final JpaDocumentPrintTemplateRepository jpaRepository;
    private final DocumentPrintTemplatePersistenceMapper mapper;

    @Override
    public List<DocumentPrintTemplate> findAll() {
        return jpaRepository.findAll().stream()
                .map(mapper::toDomain)
                .toList();
    }

    @Override
    public Optional<DocumentPrintTemplate> findById(UUID id) {
        return jpaRepository.findById(id)
                .map(mapper::toDomain);
    }

    @Override
    public Optional<DocumentPrintTemplate> findByDocumentType(PrintDocumentType documentType) {
        if (documentType == null) {
            return Optional.empty();
        }
        return jpaRepository.findByDocumentType(documentType.name())
                .map(mapper::toDomain);
    }

    @Override
    public DocumentPrintTemplate save(DocumentPrintTemplate template) {
        var entity = mapper.toEntity(template);
        var saved = jpaRepository.save(entity);
        return mapper.toDomain(saved);
    }
}
