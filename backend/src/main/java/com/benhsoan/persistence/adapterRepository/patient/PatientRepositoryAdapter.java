package com.benhsoan.persistence.adapterRepository.patient;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Repository;

import com.benhsoan.domain.patient.Patient;
import com.benhsoan.persistence.entity.patient.PatientEntity;
import com.benhsoan.persistence.jpaRepository.patient.JpaPatientRepository;
import com.benhsoan.persistence.jpaRepository.patient.PatientSpecification;
import com.benhsoan.persistence.mapper.patient.PatientPersistenceMapper;
import com.benhsoan.port.dto.command.patient.SearchPatientCommand;
import com.benhsoan.port.outbound.repository.patient.PatientRepository;

import lombok.RequiredArgsConstructor;

@Repository
@RequiredArgsConstructor
public class PatientRepositoryAdapter implements PatientRepository {

    private final JpaPatientRepository jpaRepository;

    private final PatientPersistenceMapper mapper;

    @Override
    public Page<Patient> findAll(Pageable pageable) {
        return jpaRepository.findAll(pageable)
                .map(mapper::toDomain);
    }

    @Override
    public Optional<Patient> findById(UUID id) {
        return jpaRepository.findById(id)
                .map(mapper::toDomain);
    }

    @Override
    public List<Patient> findAllById(Collection<UUID> ids) {
        if (ids == null || ids.isEmpty()) {
            return List.of();
        }
        return jpaRepository.findAllById(ids).stream()
                .map(mapper::toDomain)
                .toList();
    }

    @Override
    public Optional<Patient> findByPatientCode(String patientCode) {
        return jpaRepository.findByPatientCode(patientCode)
                .map(mapper::toDomain);
    }

    @Override
    public Patient save(Patient patient) {

        PatientEntity entity = mapper.toEntity(patient);

        PatientEntity saved = jpaRepository.save(entity);

        return mapper.toDomain(saved);
    }

    @Override
    public boolean existsByPatientCode(String patientCode) {
        return jpaRepository.existsByPatientCode(patientCode);
    }

    @Override
    public boolean existsByIdentityNumber(String identityNumber) {

        return identityNumber != null
                && jpaRepository.existsByIdentityNumber(identityNumber);

    }

    @Override
    public Optional<Patient> findByIdentityNumber(String identityNumber) {
        if (identityNumber == null) {
            return Optional.empty();
        }
        return jpaRepository.findByIdentityNumber(identityNumber)
                .map(mapper::toDomain);
    }

    @Override
    public Optional<Patient> findTopByOrderByPatientCodeDesc() {
        return jpaRepository.findTopByOrderByPatientCodeDesc()
            .map(mapper::toDomain);
        }

    @Override
    public boolean existsByIdentityNumberAndIdNot(
        String identityNumber,
        UUID id
    ) {
        return jpaRepository.existsByIdentityNumberAndIdNot(
            identityNumber,
            id
        );
    }

    @Override
    public Optional<Patient> findByUserId(UUID userId) {
        return jpaRepository.findByUserId(userId)
                .map(mapper::toDomain);
    }

    @Override
    public Optional<Patient> findByGuardianUserIdAndId(UUID guardianUserId, UUID patientId) {
        return jpaRepository.findByGuardianUserIdAndId(guardianUserId, patientId)
                .map(mapper::toDomain);
    }

    @Override
    public List<Patient> findValidDependentsByGuardianUserId(UUID guardianUserId) {
        return jpaRepository.findValidDependentsByGuardianUserId(guardianUserId).stream()
                .map(mapper::toDomain)
                .toList();
    }

    @Override
    public Optional<Patient> findValidDependentByGuardianUserIdAndId(
            UUID guardianUserId,
            UUID patientId
    ) {
        return jpaRepository.findValidDependentByGuardianUserIdAndId(guardianUserId, patientId)
                .map(mapper::toDomain);
    }

    @Override
    public List<Patient> findGuardianLinkedProfiles() {
        return jpaRepository.findGuardianLinkedProfiles().stream()
                .map(mapper::toDomain)
                .toList();
    }

    @Override
    public List<Patient> findAllByPhone(String phone) {
        return jpaRepository.findAllByPhone(phone).stream()
                .map(mapper::toDomain)
                .toList();
    }

    @Override
    public Optional<Patient> findByIdForUpdate(UUID patientId) {
        return jpaRepository.findByIdForUpdate(patientId)
                .map(mapper::toDomain);
    }

    @Override
    public Page<Patient> search(
        SearchPatientCommand command
    ) {
        Pageable pageable = (command != null && command.pageable() != null)
                ? command.pageable()
                : PageRequest.of(0, 50);
        return jpaRepository.findAll(
            PatientSpecification.build(command),
            pageable
        ).map(mapper::toDomain);
    }

    @Override
    public List<Patient> findSuspectedDuplicates() {
        return jpaRepository.findSuspectedDuplicates().stream()
                .map(mapper::toDomain)
                .toList();
    }
}
