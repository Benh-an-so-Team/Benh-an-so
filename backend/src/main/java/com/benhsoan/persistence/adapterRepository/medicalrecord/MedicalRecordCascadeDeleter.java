package com.benhsoan.persistence.adapterRepository.medicalrecord;

import java.util.List;
import java.util.UUID;

import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

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

import lombok.RequiredArgsConstructor;

/**
 * Removes all child rows referencing a medical record before the record itself
 * is deleted, avoiding foreign-key violations on a real database.
 */
@Component
@RequiredArgsConstructor
public class MedicalRecordCascadeDeleter {

    private final JpaMedicalRecordAccessLogRepository accessLogRepository;
    private final JpaMedicalRecordAmendmentRepository amendmentRepository;
    private final JpaMedicalRecordDiagnosisRepository diagnosisRepository;
    private final JpaMedicalAttachmentRepository attachmentRepository;
    private final JpaClinicalOrderRepository clinicalOrderRepository;
    private final JpaClinicalOrderItemRepository clinicalOrderItemRepository;
    private final JpaClinicalResultRepository clinicalResultRepository;
    private final JpaClinicalResultHistoryRepository clinicalResultHistoryRepository;
    private final JpaPrescriptionRepository prescriptionRepository;
    private final JpaPrescriptionItemRepository prescriptionItemRepository;
    private final JpaPrescriptionAmendmentRepository prescriptionAmendmentRepository;
    private final JpaPrescriptionWarningLogRepository prescriptionWarningLogRepository;
    private final JpaPrescriptionAllergyWarningLogRepository prescriptionAllergyWarningLogRepository;
    private final JpaPrescriptionDispenseItemRepository prescriptionDispenseItemRepository;
    private final JpaPrescriptionInterconnectionLogRepository prescriptionInterconnectionLogRepository;
    private final JpaPrescriptionReconciliationNoteRepository prescriptionReconciliationNoteRepository;

    @Transactional
    public void deleteByMedicalRecordId(UUID medicalRecordId) {
        accessLogRepository.deleteByMedicalRecordId(medicalRecordId);
        attachmentRepository.deleteByMedicalRecordId(medicalRecordId);
        diagnosisRepository.deleteByMedicalRecordId(medicalRecordId);
        amendmentRepository.deleteByMedicalRecordId(medicalRecordId);

        List<UUID> orderIds = clinicalOrderRepository.findIdsByMedicalRecordId(medicalRecordId);
        if (!orderIds.isEmpty()) {
            List<UUID> itemIds = clinicalOrderItemRepository.findIdsByClinicalOrderIdIn(orderIds);
            if (!itemIds.isEmpty()) {
                List<UUID> resultIds = clinicalResultRepository.findIdsByClinicalOrderItemIdIn(itemIds);
                if (!resultIds.isEmpty()) {
                    clinicalResultHistoryRepository.deleteByClinicalResultIdIn(resultIds);
                    attachmentRepository.deleteByClinicalResultIdIn(resultIds);
                }
                clinicalResultRepository.deleteByClinicalOrderItemIdIn(itemIds);
            }
            clinicalOrderItemRepository.deleteByClinicalOrderIdIn(orderIds);
        }
        clinicalOrderRepository.deleteByMedicalRecordId(medicalRecordId);

        List<UUID> prescriptionIds = prescriptionRepository.findIdsByMedicalRecordId(medicalRecordId);
        if (!prescriptionIds.isEmpty()) {
            prescriptionDispenseItemRepository.deleteByPrescriptionIdIn(prescriptionIds);
            prescriptionAmendmentRepository.deleteByPrescriptionIdIn(prescriptionIds);
            prescriptionWarningLogRepository.deleteByPrescriptionIdIn(prescriptionIds);
            prescriptionAllergyWarningLogRepository.deleteByPrescriptionIdIn(prescriptionIds);
            prescriptionInterconnectionLogRepository.deleteByPrescriptionIdIn(prescriptionIds);
            prescriptionReconciliationNoteRepository.deleteByPrescriptionIdIn(prescriptionIds);
            prescriptionItemRepository.deleteAllByPrescriptionIdIn(prescriptionIds);
        }
        prescriptionRepository.deleteByMedicalRecordId(medicalRecordId);
    }
}
