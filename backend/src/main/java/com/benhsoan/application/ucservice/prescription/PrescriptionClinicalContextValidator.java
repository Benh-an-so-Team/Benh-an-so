package com.benhsoan.application.ucservice.prescription;

import java.util.Objects;
import java.util.UUID;

import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Component;

import com.benhsoan.domain.medicalrecord.MedicalRecord;
import com.benhsoan.domain.prescription.exception.PrescriptionClinicalContextConflictException;
import com.benhsoan.domain.shared.exception.ValidationException;
import com.benhsoan.domain.visit.Visit;
import com.benhsoan.port.outbound.repository.medicalrecord.MedicalRecordRepository;
import com.benhsoan.port.outbound.repository.visit.VisitRepository;

import lombok.RequiredArgsConstructor;

/** Validates that a doctor can make clinical changes for a medical record. */
@Component
@RequiredArgsConstructor
public class PrescriptionClinicalContextValidator {

    private final MedicalRecordRepository medicalRecordRepository;
    private final VisitRepository visitRepository;

    public MedicalRecord requireEditableRecordForDoctor(
            UUID medicalRecordId,
            UUID doctorId
    ) {
        MedicalRecord medicalRecord = loadEditableRecord(medicalRecordId);

        Visit visit = loadVisit(medicalRecordId, medicalRecord);
        if (!visit.isActive()) {
            throw new PrescriptionClinicalContextConflictException(
                    "Prescriptions can only be changed during an active visit."
            );
        }
        requireResponsibleDoctor(
                visit, doctorId, "Only the doctor responsible for the visit can change prescriptions.");

        return medicalRecord;
    }

    /**
     * NCL-12-CN-008: the replacement creation path reuses every clinical-context rule except
     * the active-visit check. A doctor may replace a successfully interconnected prescription
     * after the visit has been completed, but the medical record must still be editable and the
     * actor must still own the visit.
     */
    public MedicalRecord requireRecordForPrescriptionReplacement(
            UUID medicalRecordId,
            UUID doctorId
    ) {
        MedicalRecord medicalRecord = loadEditableRecord(medicalRecordId);

        Visit visit = loadVisit(medicalRecordId, medicalRecord);
        requireResponsibleDoctor(
                visit, doctorId, "Only the doctor responsible for the visit can replace prescriptions.");

        return medicalRecord;
    }

    public MedicalRecord requireDoctorPermissionForPrescriptionCancellation(
            UUID medicalRecordId,
            UUID doctorId
    ) {
        MedicalRecord medicalRecord = loadRecord(medicalRecordId);

        Visit visit = loadVisit(medicalRecordId, medicalRecord);
        requireResponsibleDoctor(
                visit, doctorId, "Only the doctor responsible for the visit can cancel prescriptions.");

        return medicalRecord;
    }

    public MedicalRecord requireDoctorPermissionForPrescriptionReplacement(
            UUID medicalRecordId,
            UUID doctorId
    ) {
        MedicalRecord medicalRecord = loadRecord(medicalRecordId);

        Visit visit = loadVisit(medicalRecordId, medicalRecord);
        requireResponsibleDoctor(
                visit, doctorId, "Only the doctor responsible for the visit can replace prescriptions.");

        return medicalRecord;
    }

    private MedicalRecord loadRecord(UUID medicalRecordId) {
        if (medicalRecordId == null) {
            throw new ValidationException("Medical record id is required.");
        }
        return medicalRecordRepository.findById(medicalRecordId)
                .orElseThrow(() -> new ValidationException(
                        "Medical record not found: " + medicalRecordId
                ));
    }

    private MedicalRecord loadEditableRecord(UUID medicalRecordId) {
        MedicalRecord medicalRecord = loadRecord(medicalRecordId);
        medicalRecord.ensureEditable();
        return medicalRecord;
    }

    private Visit loadVisit(UUID medicalRecordId, MedicalRecord medicalRecord) {
        return visitRepository.findById(medicalRecord.getVisitId())
                .orElseThrow(() -> new ValidationException(
                        "Visit not found for medical record: " + medicalRecordId
                ));
    }

    private void requireResponsibleDoctor(Visit visit, UUID doctorId, String deniedMessage) {
        if (!Objects.equals(visit.getDoctorId(), doctorId)) {
            throw new AccessDeniedException(deniedMessage);
        }
    }
}
