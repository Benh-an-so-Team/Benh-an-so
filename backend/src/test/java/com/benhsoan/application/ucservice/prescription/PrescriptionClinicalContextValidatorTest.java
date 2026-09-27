package com.benhsoan.application.ucservice.prescription;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.lenient;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;

import com.benhsoan.domain.medicalrecord.MedicalRecord;
import com.benhsoan.domain.medicalrecord.enums.MedicalRecordStatus;
import com.benhsoan.domain.medicalrecord.exception.MedicalRecordAlreadyLockedException;
import com.benhsoan.domain.prescription.exception.PrescriptionClinicalContextConflictException;
import com.benhsoan.domain.visit.Visit;
import com.benhsoan.domain.visit.enums.VisitStatus;
import com.benhsoan.domain.visit.enums.VisitType;
import com.benhsoan.port.outbound.repository.medicalrecord.MedicalRecordRepository;
import com.benhsoan.port.outbound.repository.visit.VisitRepository;

@ExtendWith(MockitoExtension.class)
class PrescriptionClinicalContextValidatorTest {

    private static final Instant NOW = Instant.parse("2026-08-05T02:00:00Z");

    @Mock private MedicalRecordRepository medicalRecordRepository;
    @Mock private VisitRepository visitRepository;

    private PrescriptionClinicalContextValidator validator;
    private UUID recordId;
    private UUID visitId;
    private UUID doctorId;

    @BeforeEach
    void setUp() {
        validator = new PrescriptionClinicalContextValidator(
                medicalRecordRepository,
                visitRepository
        );
        recordId = UUID.randomUUID();
        visitId = UUID.randomUUID();
        doctorId = UUID.randomUUID();
    }

    @Test
    void allowsResponsibleDoctorDuringActiveVisitWithEditableRecord() {
        stubContext(MedicalRecordStatus.OPEN, VisitStatus.IN_PROGRESS, doctorId);

        assertDoesNotThrow(() -> validator.requireEditableRecordForDoctor(
                recordId,
                doctorId
        ));
    }

    @Test
    void rejectsLockedMedicalRecord() {
        stubContext(MedicalRecordStatus.LOCKED, VisitStatus.IN_PROGRESS, doctorId);

        assertThrows(MedicalRecordAlreadyLockedException.class,
                () -> validator.requireEditableRecordForDoctor(recordId, doctorId));
    }

    @Test
    void rejectsCompletedVisit() {
        stubContext(MedicalRecordStatus.OPEN, VisitStatus.COMPLETED, doctorId);

        assertThrows(PrescriptionClinicalContextConflictException.class,
                () -> validator.requireEditableRecordForDoctor(recordId, doctorId));
    }

    @Test
    void rejectsDoctorWhoDoesNotOwnVisit() {
        stubContext(MedicalRecordStatus.OPEN, VisitStatus.IN_PROGRESS, UUID.randomUUID());

        assertThrows(AccessDeniedException.class,
                () -> validator.requireEditableRecordForDoctor(recordId, doctorId));
    }

    @Test
    void replacementPermissionAllowsResponsibleDoctor() {
        stubContext(MedicalRecordStatus.OPEN, VisitStatus.IN_PROGRESS, doctorId);

        assertDoesNotThrow(() -> validator.requireDoctorPermissionForPrescriptionReplacement(
                recordId, doctorId));
    }

    @Test
    void replacementPermissionRejectsDoctorWhoDoesNotOwnVisit() {
        stubContext(MedicalRecordStatus.OPEN, VisitStatus.IN_PROGRESS, UUID.randomUUID());

        AccessDeniedException exception = assertThrows(AccessDeniedException.class,
                () -> validator.requireDoctorPermissionForPrescriptionReplacement(recordId, doctorId));
        assertEquals("Only the doctor responsible for the visit can replace prescriptions.",
                exception.getMessage());
    }

    @Test
    void replacementCreationAllowsCompletedVisitForResponsibleDoctor() {
        stubContext(MedicalRecordStatus.OPEN, VisitStatus.COMPLETED, doctorId);

        assertDoesNotThrow(() -> validator.requireRecordForPrescriptionReplacement(
                recordId, doctorId));
    }

    @Test
    void replacementCreationRejectsLockedMedicalRecord() {
        stubContext(MedicalRecordStatus.LOCKED, VisitStatus.COMPLETED, doctorId);

        assertThrows(MedicalRecordAlreadyLockedException.class,
                () -> validator.requireRecordForPrescriptionReplacement(recordId, doctorId));
    }

    @Test
    void replacementCreationRejectsDoctorWhoDoesNotOwnVisit() {
        stubContext(MedicalRecordStatus.OPEN, VisitStatus.COMPLETED, UUID.randomUUID());

        AccessDeniedException exception = assertThrows(AccessDeniedException.class,
                () -> validator.requireRecordForPrescriptionReplacement(recordId, doctorId));
        assertEquals("Only the doctor responsible for the visit can replace prescriptions.",
                exception.getMessage());
    }

    private void stubContext(
            MedicalRecordStatus recordStatus,
            VisitStatus visitStatus,
            UUID visitDoctorId
    ) {
        when(medicalRecordRepository.findById(recordId)).thenReturn(Optional.of(
                MedicalRecord.restore(recordId, visitId, "Complaint", null, null, null,
                        null, null, null, "Conclusion", recordStatus,
                        recordStatus == MedicalRecordStatus.LOCKED ? NOW : null,
                        recordStatus == MedicalRecordStatus.LOCKED ? doctorId : null,
                        doctorId, NOW, null, null)
        ));
        lenient().when(visitRepository.findById(visitId)).thenReturn(Optional.of(
                Visit.restore(visitId, "VS000001", UUID.randomUUID(), visitDoctorId,
                        null, null, VisitType.WALK_IN, visitStatus, NOW, NOW,
                        visitStatus == VisitStatus.COMPLETED ? NOW.plusSeconds(60) : null,
                        "Consultation", null, doctorId, NOW, null)
        ));
    }
}
