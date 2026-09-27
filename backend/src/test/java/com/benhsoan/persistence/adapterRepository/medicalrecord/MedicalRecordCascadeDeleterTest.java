package com.benhsoan.persistence.adapterRepository.medicalrecord;

import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InOrder;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.benhsoan.persistence.jpaRepository.clinical.JpaClinicalOrderItemRepository;
import com.benhsoan.persistence.jpaRepository.clinical.JpaClinicalOrderRepository;
import com.benhsoan.persistence.jpaRepository.clinical.JpaClinicalResultHistoryRepository;
import com.benhsoan.persistence.jpaRepository.clinical.JpaClinicalResultRepository;
import com.benhsoan.persistence.jpaRepository.clinical.JpaMedicalAttachmentRepository;
import com.benhsoan.persistence.jpaRepository.medicalrecord.JpaMedicalRecordAccessLogRepository;
import com.benhsoan.persistence.jpaRepository.medicalrecord.JpaMedicalRecordAmendmentRepository;
import com.benhsoan.persistence.jpaRepository.medicalrecord.JpaMedicalRecordDiagnosisRepository;
import com.benhsoan.persistence.jpaRepository.prescription.JpaPrescriptionAllergyWarningLogRepository;
import com.benhsoan.persistence.jpaRepository.prescription.JpaPrescriptionAmendmentRepository;
import com.benhsoan.persistence.jpaRepository.prescription.JpaPrescriptionDispenseItemRepository;
import com.benhsoan.persistence.jpaRepository.prescription.JpaPrescriptionInterconnectionLogRepository;
import com.benhsoan.persistence.jpaRepository.prescription.JpaPrescriptionItemRepository;
import com.benhsoan.persistence.jpaRepository.prescription.JpaPrescriptionReconciliationNoteRepository;
import com.benhsoan.persistence.jpaRepository.prescription.JpaPrescriptionRepository;
import com.benhsoan.persistence.jpaRepository.prescription.JpaPrescriptionWarningLogRepository;

@ExtendWith(MockitoExtension.class)
@DisplayName("MedicalRecordCascadeDeleter Unit Tests")
class MedicalRecordCascadeDeleterTest {

    @Mock private JpaMedicalRecordAccessLogRepository accessLogRepository;
    @Mock private JpaMedicalRecordAmendmentRepository amendmentRepository;
    @Mock private JpaMedicalRecordDiagnosisRepository diagnosisRepository;
    @Mock private JpaMedicalAttachmentRepository attachmentRepository;
    @Mock private JpaClinicalOrderRepository clinicalOrderRepository;
    @Mock private JpaClinicalOrderItemRepository clinicalOrderItemRepository;
    @Mock private JpaClinicalResultRepository clinicalResultRepository;
    @Mock private JpaClinicalResultHistoryRepository clinicalResultHistoryRepository;
    @Mock private JpaPrescriptionRepository prescriptionRepository;
    @Mock private JpaPrescriptionItemRepository prescriptionItemRepository;
    @Mock private JpaPrescriptionAmendmentRepository prescriptionAmendmentRepository;
    @Mock private JpaPrescriptionWarningLogRepository prescriptionWarningLogRepository;
    @Mock private JpaPrescriptionAllergyWarningLogRepository prescriptionAllergyWarningLogRepository;
    @Mock private JpaPrescriptionDispenseItemRepository prescriptionDispenseItemRepository;
    @Mock private JpaPrescriptionInterconnectionLogRepository prescriptionInterconnectionLogRepository;
    @Mock private JpaPrescriptionReconciliationNoteRepository prescriptionReconciliationNoteRepository;

    @InjectMocks
    private MedicalRecordCascadeDeleter deleter;

    @Test
    @DisplayName("Deletes all prescription child rows including allergy warning logs when prescriptions exist")
    void deletesPrescriptionAllergyWarningLogsWhenPrescriptionsExist() {
        UUID medicalRecordId = UUID.randomUUID();
        UUID prescriptionId1 = UUID.randomUUID();
        UUID prescriptionId2 = UUID.randomUUID();
        List<UUID> prescriptionIds = List.of(prescriptionId1, prescriptionId2);

        when(clinicalOrderRepository.findIdsByMedicalRecordId(medicalRecordId)).thenReturn(List.of());
        when(prescriptionRepository.findIdsByMedicalRecordId(medicalRecordId)).thenReturn(prescriptionIds);

        deleter.deleteByMedicalRecordId(medicalRecordId);

        verify(prescriptionDispenseItemRepository).deleteByPrescriptionIdIn(prescriptionIds);
        verify(prescriptionAmendmentRepository).deleteByPrescriptionIdIn(prescriptionIds);
        verify(prescriptionWarningLogRepository).deleteByPrescriptionIdIn(prescriptionIds);
        verify(prescriptionAllergyWarningLogRepository).deleteByPrescriptionIdIn(prescriptionIds);
        verify(prescriptionInterconnectionLogRepository).deleteByPrescriptionIdIn(prescriptionIds);
        verify(prescriptionReconciliationNoteRepository).deleteByPrescriptionIdIn(prescriptionIds);
        verify(prescriptionItemRepository).deleteAllByPrescriptionIdIn(prescriptionIds);
        verify(prescriptionRepository).deleteByMedicalRecordId(medicalRecordId);
    }

    @Test
    @DisplayName("Deletes reconciliation notes before their prescriptions so the foreign key holds")
    void deletesReconciliationNotesBeforePrescriptions() {
        UUID medicalRecordId = UUID.randomUUID();
        List<UUID> prescriptionIds = List.of(UUID.randomUUID(), UUID.randomUUID());

        when(clinicalOrderRepository.findIdsByMedicalRecordId(medicalRecordId)).thenReturn(List.of());
        when(prescriptionRepository.findIdsByMedicalRecordId(medicalRecordId)).thenReturn(prescriptionIds);

        deleter.deleteByMedicalRecordId(medicalRecordId);

        InOrder inOrder = inOrder(prescriptionInterconnectionLogRepository,
                prescriptionReconciliationNoteRepository, prescriptionRepository);
        inOrder.verify(prescriptionInterconnectionLogRepository).deleteByPrescriptionIdIn(prescriptionIds);
        inOrder.verify(prescriptionReconciliationNoteRepository).deleteByPrescriptionIdIn(prescriptionIds);
        inOrder.verify(prescriptionRepository).deleteByMedicalRecordId(medicalRecordId);
    }
}
