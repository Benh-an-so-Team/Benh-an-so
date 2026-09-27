package com.benhsoan.application.ucservice.prescription;

import java.util.List;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.benhsoan.domain.prescription.PrescriptionReconciliationNote;
import com.benhsoan.domain.prescription.exception.PrescriptionNotFoundException;
import com.benhsoan.port.dto.result.PrescriptionReconciliationNoteResult;
import com.benhsoan.port.inbound.prescription.GetPrescriptionReconciliationNotesUseCase;
import com.benhsoan.port.outbound.repository.prescription.PrescriptionReconciliationNoteRepository;
import com.benhsoan.port.outbound.repository.prescription.PrescriptionRepository;

import lombok.RequiredArgsConstructor;

/**
 * NCL-12-CN-007: reads the append only reconciliation note history of one prescription.
 *
 * The target prescription must exist before its notes are returned, so an unknown id is a
 * 404 rather than an empty list.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class GetPrescriptionReconciliationNotesService
        implements GetPrescriptionReconciliationNotesUseCase {

    private final PrescriptionReconciliationNoteRepository noteRepository;
    private final PrescriptionRepository prescriptionRepository;
    private final PrescriptionReconciliationAccessValidator accessValidator;

    @Override
    public List<PrescriptionReconciliationNoteResult> getNotes(UUID prescriptionId) {
        accessValidator.requireCanView();
        if (prescriptionId == null || prescriptionRepository.findById(prescriptionId).isEmpty()) {
            throw new PrescriptionNotFoundException(prescriptionId);
        }
        return noteRepository.findByPrescriptionId(prescriptionId).stream()
                .map(GetPrescriptionReconciliationNotesService::toResult)
                .toList();
    }

    private static PrescriptionReconciliationNoteResult toResult(PrescriptionReconciliationNote note) {
        return new PrescriptionReconciliationNoteResult(
                note.getId(),
                note.getPrescriptionId(),
                note.getReconciliationOutcome(),
                note.getReason(),
                note.getNotedBy(),
                note.getNotedAt());
    }
}
