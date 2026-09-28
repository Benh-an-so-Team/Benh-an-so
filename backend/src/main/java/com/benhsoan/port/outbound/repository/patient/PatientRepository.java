package com.benhsoan.port.outbound.repository.patient;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import com.benhsoan.domain.patient.Patient;
import com.benhsoan.port.dto.command.patient.SearchPatientCommand;
public interface PatientRepository {

    Optional<Patient> findById(UUID id);

    List<Patient> findAllById(Collection<UUID> ids);

    Patient save(Patient patient);

    Page<Patient> findAll(Pageable pageable);

    Optional<Patient> findByPatientCode(String patientCode);

    boolean existsByPatientCode(String patientCode);

    boolean existsByIdentityNumber(String identityNumber);

    Optional<Patient> findByIdentityNumber(String identityNumber);

    Optional<Patient> findTopByOrderByPatientCodeDesc();

    boolean existsByIdentityNumberAndIdNot( String identityNumber, UUID id);

    Optional<Patient> findByUserId(UUID userId);

    /**
     * NCL-14-CN-010: resolves a dependent patient only when the guardian link is explicit
     * (patients.guardian_user_id == guardianUserId).
     */
    Optional<Patient> findByGuardianUserIdAndId(UUID guardianUserId, UUID patientId);

    /**
     * NCL-14-CN-010 / QTN-33: valid (active, non-merged) dependent profiles of a guardian,
     * ordered by full name with a deterministic id tie-breaker.
     */
    List<Patient> findValidDependentsByGuardianUserId(UUID guardianUserId);

    /**
     * Re-validates a single dependent server-side, applying the same lifecycle rule, so a client
     * cannot bypass the linked-profile list by submitting an inactive/merged patientId.
     */
    Optional<Patient> findValidDependentByGuardianUserIdAndId(UUID guardianUserId, UUID patientId);

    /**
     * NCL-14-CN-010 TC-03: all active, non-merged dependents that still carry a guardian link.
     */
    List<Patient> findGuardianLinkedProfiles();

    List<Patient> findAllByPhone(String phone);

    Optional<Patient> findByIdForUpdate(UUID patientId);
    
    Page<Patient> search( SearchPatientCommand command);

    List<Patient> findSuspectedDuplicates();
}
