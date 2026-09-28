package com.benhsoan.application.ucservice.medicalrecord;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

import org.springframework.data.domain.PageRequest;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.benhsoan.application.ucservice.anonymization.AnonymizationModeState;
import com.benhsoan.domain.auditlog.AuditLog;
import com.benhsoan.domain.auditlog.enums.ActionType;
import com.benhsoan.domain.auditlog.enums.ResourceType;
import com.benhsoan.domain.auth.User;
import com.benhsoan.domain.clinic.ClinicConfiguration;
import com.benhsoan.domain.clinical.ClinicalOrder;
import com.benhsoan.domain.clinical.ClinicalOrderItem;
import com.benhsoan.domain.clinical.ClinicalResult;
import com.benhsoan.domain.medicalrecord.MedicalRecord;
import com.benhsoan.domain.medicalrecord.MedicalRecordDiagnosis;
import com.benhsoan.domain.medicalrecord.enums.MedicalRecordAccessAction;
import com.benhsoan.domain.medicalrecord.exception.MedicalRecordMissingDiagnosisException;
import com.benhsoan.domain.medicalrecord.exception.MedicalRecordNotFoundException;
import com.benhsoan.domain.medicalrecord.exception.MedicalRecordNotSignedException;
import com.benhsoan.domain.patient.Patient;
import com.benhsoan.domain.patient.PatientAnonymizer;
import com.benhsoan.domain.patient.exception.PatientNotFoundException;
import com.benhsoan.domain.prescription.Prescription;
import com.benhsoan.domain.prescription.PrescriptionItem;
import com.benhsoan.domain.shared.exception.ValidationException;
import com.benhsoan.domain.visit.Visit;
import com.benhsoan.domain.visit.exception.VisitNotFoundException;
import com.benhsoan.port.dto.command.medicalrecord.ExportMedicalRecordExchangeCommand;
import com.benhsoan.port.dto.result.MedicalRecordExchangeBundle;
import com.benhsoan.port.dto.result.MedicalRecordExchangeDocument;
import com.benhsoan.port.dto.result.MedicalRecordExchangeExportResult;
import com.benhsoan.port.inbound.medicalrecord.ExportMedicalRecordExchangeUseCase;
import com.benhsoan.port.outbound.repository.audit.AuditLogRepository;
import com.benhsoan.port.outbound.repository.auth.UserRepository;
import com.benhsoan.port.outbound.repository.clinic.ClinicConfigurationRepository;
import com.benhsoan.port.outbound.repository.clinical.ClinicalOrderItemRepository;
import com.benhsoan.port.outbound.repository.clinical.ClinicalOrderRepository;
import com.benhsoan.port.outbound.repository.clinical.ClinicalResultRepository;
import com.benhsoan.port.outbound.repository.medicalrecord.MedicalRecordDiagnosisRepository;
import com.benhsoan.port.outbound.repository.medicalrecord.MedicalRecordRepository;
import com.benhsoan.port.outbound.repository.medicine.MedicineRepository;
import com.benhsoan.port.outbound.repository.patient.PatientRepository;
import com.benhsoan.port.outbound.repository.prescription.PrescriptionRepository;
import com.benhsoan.port.outbound.repository.visit.VisitRepository;
import com.benhsoan.port.outbound.security.CurrentUserPort;
import com.benhsoan.port.outbound.time.ClockPort;
import com.fasterxml.jackson.databind.ObjectMapper;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
@Transactional
public class ExportMedicalRecordExchangeService implements ExportMedicalRecordExchangeUseCase {

    private static final String JSON_CONTENT_TYPE = "application/json";
    private static final int MAX_BATCH_SIZE = 100;
    private static final int CLINICAL_ORDERS_RESULTS_PAGE_SIZE = 1000;

    private final MedicalRecordRepository medicalRecordRepository;
    private final MedicalRecordDiagnosisRepository medicalRecordDiagnosisRepository;
    private final VisitRepository visitRepository;
    private final PatientRepository patientRepository;
    private final UserRepository userRepository;
    private final ClinicConfigurationRepository clinicConfigurationRepository;
    private final ClinicalOrderRepository clinicalOrderRepository;
    private final ClinicalOrderItemRepository clinicalOrderItemRepository;
    private final ClinicalResultRepository clinicalResultRepository;
    private final PrescriptionRepository prescriptionRepository;
    private final MedicineRepository medicineRepository;
    private final CurrentUserPort currentUserPort;
    private final ClockPort clockPort;
    private final AuditLogRepository auditLogRepository;
    private final MedicalRecordAccessAuditService accessAuditService;
    private final ObjectMapper objectMapper;
    private final AnonymizationModeState anonymizationModeState;

    @Override
    @Transactional
    public MedicalRecordExchangeExportResult exportSingleRecord(UUID medicalRecordId) {
        authorizeExportRole();

        MedicalRecord record = medicalRecordRepository.findById(medicalRecordId)
                .orElseThrow(() -> new MedicalRecordNotFoundException(medicalRecordId));
        ensureSigned(record);
        List<MedicalRecordDiagnosis> diagnoses = medicalRecordDiagnosisRepository.findByMedicalRecordId(record.getId());
        ensureValidDiagnoses(record.getId(), diagnoses);

        ClinicConfiguration clinicConfig = clinicConfigurationRepository.find().orElse(null);
        Instant now = clockPort.now();
        UUID actorId = currentUserPort.getCurrentUserId();

        MedicalRecordExchangeDocument doc = buildDocument(record, diagnoses, clinicConfig, now);
        byte[] contentBytes = serializeToJson(doc);
        String fileName = "emr-exchange-" + doc.patient().patientCode() + "-" + doc.encounter().visitCode() + ".json";

        recordExportAudits(List.of(record), List.of(doc), actorId, now, "JSON");

        return new MedicalRecordExchangeExportResult(
                fileName,
                JSON_CONTENT_TYPE,
                contentBytes,
                1);
    }

    @Override
    @Transactional
    public MedicalRecordExchangeExportResult exportRecords(ExportMedicalRecordExchangeCommand command) {
        authorizeExportRole();

        List<MedicalRecord> records = resolveTargetRecords(command);
        if (records.isEmpty()) {
            throw new ValidationException("No medical records found for the requested export.");
        }
        if (records.size() > MAX_BATCH_SIZE) {
            throw new ValidationException(
                    "Maximum " + MAX_BATCH_SIZE + " medical records can be exported in a single batch.");
        }

        // QTN-41 & QTN-22 Verification across all records before building documents
        Map<UUID, List<MedicalRecordDiagnosis>> diagnosesByRecordId = new LinkedHashMap<>();
        for (MedicalRecord record : records) {
            ensureSigned(record);
            List<MedicalRecordDiagnosis> diagnoses = medicalRecordDiagnosisRepository
                    .findByMedicalRecordId(record.getId());
            ensureValidDiagnoses(record.getId(), diagnoses);
            diagnosesByRecordId.put(record.getId(), diagnoses);
        }

        ClinicConfiguration clinicConfig = clinicConfigurationRepository.find().orElse(null);
        Instant now = clockPort.now();
        UUID actorId = currentUserPort.getCurrentUserId();

        List<MedicalRecordExchangeDocument> documents = new ArrayList<>(records.size());
        for (MedicalRecord record : records) {
            documents.add(buildDocument(record, diagnosesByRecordId.get(record.getId()), clinicConfig, now));
        }

        // Always bundle format for batch export endpoint (F-08)
        MedicalRecordExchangeBundle bundle = new MedicalRecordExchangeBundle(
                UUID.randomUUID(),
                "1.0",
                now,
                actorId,
                documents.size(),
                documents);
        byte[] contentBytes = serializeToJson(bundle);
        String fileName = "emr-exchange-bundle-" + now.toEpochMilli() + ".json";

        recordExportAudits(records, documents, actorId, now, command.format());

        return new MedicalRecordExchangeExportResult(
                fileName,
                JSON_CONTENT_TYPE,
                contentBytes,
                documents.size());
    }

    private void authorizeExportRole() {
        if (!currentUserPort.hasPermission("MEDICAL_RECORD_EXPORT")
                && !currentUserPort.hasRole("ADMIN")
                && !currentUserPort.hasRole("MANAGER")) {
            throw new AccessDeniedException(
                    "Only managers and administrators can export medical records for data exchange.");
        }
    }

    private List<MedicalRecord> resolveTargetRecords(ExportMedicalRecordExchangeCommand command) {
        Set<UUID> resolvedRecordIds = new LinkedHashSet<>();
        List<MedicalRecord> records = new ArrayList<>();

        if (!command.medicalRecordIds().isEmpty()) {
            for (UUID recordId : command.medicalRecordIds()) {
                if (recordId != null && resolvedRecordIds.add(recordId)) {
                    MedicalRecord record = medicalRecordRepository.findById(recordId)
                            .orElseThrow(() -> new MedicalRecordNotFoundException(recordId));
                    records.add(record);
                }
            }
        }
        if (!command.visitIds().isEmpty()) {
            for (UUID visitId : command.visitIds()) {
                if (visitId != null) {
                    Visit visit = visitRepository.findById(visitId)
                            .orElseThrow(() -> new VisitNotFoundException(visitId));
                    MedicalRecord record = medicalRecordRepository.findByVisitId(visit.getId())
                            .orElseThrow(() -> new MedicalRecordNotFoundException(visitId));
                    if (resolvedRecordIds.add(record.getId())) {
                        records.add(record);
                    }
                }
            }
        }

        return records;
    }

    private void ensureSigned(MedicalRecord record) {
        if (!record.isContentLocked()) {
            throw new MedicalRecordNotSignedException(
                    record.getId(),
                    "Medical record with ID " + record.getId() + " must be signed before it can be exported.");
        }
    }

    private void ensureValidDiagnoses(UUID medicalRecordId, List<MedicalRecordDiagnosis> diagnoses) {
        if (diagnoses == null || diagnoses.isEmpty()) {
            throw new MedicalRecordMissingDiagnosisException(medicalRecordId);
        }
        boolean hasPrimaryWithCode = diagnoses.stream()
                .anyMatch(d -> d.isPrimary() && d.getDiagnosisCode() != null && !d.getDiagnosisCode().isBlank());
        if (!hasPrimaryWithCode) {
            throw new MedicalRecordMissingDiagnosisException(medicalRecordId);
        }
    }

    private MedicalRecordExchangeDocument buildDocument(
            MedicalRecord record,
            List<MedicalRecordDiagnosis> diagnoses,
            ClinicConfiguration clinicConfig,
            Instant generatedAt) {
        Visit visit = visitRepository.findById(record.getVisitId())
                .orElseThrow(() -> new VisitNotFoundException(record.getVisitId()));
        Patient patient = patientRepository.findById(visit.getPatientId())
                .orElseThrow(() -> new PatientNotFoundException(visit.getPatientId()));

        UUID doctorId = visit.getDoctorId() != null ? visit.getDoctorId() : record.getSignedBy();
        User doctor = doctorId != null ? userRepository.findById(doctorId).orElse(null) : null;

        String signingDoctorName = null;
        if (record.getSignedBy() != null) {
            if (doctor != null && record.getSignedBy().equals(doctor.getId())) {
                signingDoctorName = doctor.getFullName();
            } else {
                signingDoctorName = userRepository.findById(record.getSignedBy())
                        .map(User::getFullName)
                        .orElse(null);
            }
        }
        String doctorFullName = doctor != null ? doctor.getFullName()
                : (signingDoctorName != null ? signingDoctorName : "Chưa xác định");

        // 1. Facility Info
        MedicalRecordExchangeDocument.FacilityInfo facility = new MedicalRecordExchangeDocument.FacilityInfo(
                clinicConfig != null ? clinicConfig.getClinicName() : "Clinic",
                clinicConfig != null ? clinicConfig.getAddress() : null,
                clinicConfig != null ? clinicConfig.getPhone() : null,
                null);

        // 2. Patient Info (mask name, phone, address, and omit identity/insurance if
        // anonymization enabled - F-04)
        boolean anonymized = anonymizationModeState.isEnabled();
        String patientFullName = anonymized
                ? PatientAnonymizer.maskFullName(patient.getPatientCode())
                : patient.getFullName();
        String patientPhone = anonymized
                ? PatientAnonymizer.maskPhone(patient.getPhone())
                : patient.getPhone();
        String patientAddress = anonymized
                ? PatientAnonymizer.maskAddress(patient.getAddress())
                : patient.getAddress();
        String patientIdentityNumber = anonymized ? null : patient.getIdentityNumber();
        String patientInsuranceNumber = anonymized ? null : patient.getInsuranceNumber();

        MedicalRecordExchangeDocument.PatientInfo patientInfo = new MedicalRecordExchangeDocument.PatientInfo(
                patient.getId(),
                patient.getPatientCode(),
                patientFullName,
                patient.getDateOfBirth() != null ? patient.getDateOfBirth().toString() : null,
                patient.getGender() != null ? patient.getGender().name() : null,
                patientPhone,
                patientIdentityNumber,
                patientInsuranceNumber,
                patientAddress);

        // 3. Encounter Info
        MedicalRecordExchangeDocument.EncounterInfo encounterInfo = new MedicalRecordExchangeDocument.EncounterInfo(
                visit.getId(),
                visit.getVisitCode(),
                visit.getVisitAt(),
                visit.getStartedAt(),
                visit.getCompletedAt(),
                visit.getVisitType() != null ? visit.getVisitType().name() : null,
                visit.getReason(),
                doctor != null ? doctor.getId() : doctorId,
                doctorFullName);

        // 4. Clinical Record Info
        MedicalRecordExchangeDocument.ClinicalRecordInfo clinicalRecordInfo = new MedicalRecordExchangeDocument.ClinicalRecordInfo(
                record.getId(),
                record.getStatus().name(),
                record.getSignedAt(),
                record.getSignedBy(),
                signingDoctorName,
                record.getSignatureData(),
                record.getChiefComplaint(),
                record.getSymptoms(),
                record.getMedicalHistory(),
                record.getPhysicalExamination(),
                record.getClinicalProgress(),
                record.getTreatmentPlan(),
                record.getDoctorInstructions(),
                record.getConclusion(),
                record.getRevisitDate() != null ? record.getRevisitDate().toString() : null);

        // 5. Diagnoses Items
        List<MedicalRecordExchangeDocument.DiagnosisItem> diagnosisItems = diagnoses.stream()
                .map(d -> new MedicalRecordExchangeDocument.DiagnosisItem(
                        d.getDiagnosisType() != null ? d.getDiagnosisType().name() : null,
                        d.getDiagnosisCode(),
                        d.getDiagnosisName(),
                        d.getNote(),
                        d.getDiagnosedAt()))
                .toList();

        // 6. Clinical Orders
        List<ClinicalOrder> clinicalOrders = clinicalOrderRepository
                .findByVisitId(visit.getId(), PageRequest.of(0, CLINICAL_ORDERS_RESULTS_PAGE_SIZE))
                .getContent();

        List<ClinicalOrderItem> allItems = List.of();
        List<MedicalRecordExchangeDocument.ClinicalOrderItem> orderItems = List.of();
        if (!clinicalOrders.isEmpty()) {
            List<UUID> orderIds = clinicalOrders.stream().map(ClinicalOrder::getId).toList();
            allItems = clinicalOrderItemRepository.findByClinicalOrderIdIn(orderIds);
            Map<UUID, List<ClinicalOrderItem>> itemsByOrderId = allItems.stream()
                    .collect(Collectors.groupingBy(ClinicalOrderItem::getClinicalOrderId));

            orderItems = clinicalOrders.stream().map(order -> {
                List<ClinicalOrderItem> itemsForOrder = itemsByOrderId.getOrDefault(order.getId(), List.of());
                List<MedicalRecordExchangeDocument.ClinicalOrderServiceItem> serviceItems = itemsForOrder.stream()
                        .map(item -> new MedicalRecordExchangeDocument.ClinicalOrderServiceItem(
                                item.getId(),
                                item.getServiceCode(),
                                item.getServiceName(),
                                null,
                                item.getInstruction(),
                                item.getStatus() != null ? item.getStatus().name() : null))
                        .toList();

                return new MedicalRecordExchangeDocument.ClinicalOrderItem(
                        order.getId(),
                        order.getOrderCode(),
                        order.getOrderedAt(),
                        serviceItems);
            }).toList();
        }

        // 7. Clinical Results
        Map<UUID, ClinicalOrderItem> itemsById = allItems.stream()
                .collect(Collectors.toMap(ClinicalOrderItem::getId, item -> item, (a, b) -> a));

        List<ClinicalResult> clinicalResults = clinicalResultRepository
                .findByVisitId(visit.getId(), PageRequest.of(0, CLINICAL_ORDERS_RESULTS_PAGE_SIZE))
                .getContent();

        List<MedicalRecordExchangeDocument.ClinicalResultItem> resultItems = clinicalResults.stream()
                .map(res -> {
                    ClinicalOrderItem item = itemsById.get(res.getClinicalOrderItemId());
                    String serviceCode = null;
                    String serviceName = null;
                    if (item != null) {
                        serviceCode = item.getServiceCode();
                        serviceName = item.getServiceName();
                    } else if (res.getClinicalOrderItemId() != null) {
                        ClinicalOrderItem fallbackItem = clinicalOrderItemRepository
                                .findById(res.getClinicalOrderItemId()).orElse(null);
                        if (fallbackItem != null) {
                            serviceCode = fallbackItem.getServiceCode();
                            serviceName = fallbackItem.getServiceName();
                        }
                    }

                    return new MedicalRecordExchangeDocument.ClinicalResultItem(
                            res.getId(),
                            serviceCode,
                            serviceName,
                            res.getResultType() != null ? res.getResultType().name() : null,
                            res.getNumericValue(),
                            res.getTextValue(),
                            res.getUnit(),
                            res.getReferenceRange(),
                            res.getAbnormalFlag() != null ? res.getAbnormalFlag().name() : null,
                            res.getConclusion(),
                            res.getStatus() != null ? res.getStatus().name() : null);
                })
                .toList();

        // 8. Prescriptions (F-05: batch-fetch actual medicineCode)
        List<Prescription> prescriptions = prescriptionRepository.findByMedicalRecordId(record.getId());
        List<UUID> medicineIds = prescriptions.stream()
                .filter(p -> p.getItems() != null)
                .flatMap(p -> p.getItems().stream())
                .map(PrescriptionItem::getMedicineId)
                .filter(java.util.Objects::nonNull)
                .distinct()
                .toList();

        Map<UUID, String> medicineCodeById = medicineIds.isEmpty() ? Map.of()
                : medicineRepository.findAllById(medicineIds).stream()
                        .collect(Collectors.toMap(com.benhsoan.domain.medicine.Medicine::getId,
                                com.benhsoan.domain.medicine.Medicine::getMedicineCode, (a, b) -> a));

        List<MedicalRecordExchangeDocument.PrescriptionItemDocument> prescriptionDocs = prescriptions.stream()
                .map(p -> {
                    List<MedicalRecordExchangeDocument.PrescriptionMedicationItem> meds = Collections.emptyList();
                    if (p.getItems() != null) {
                        meds = p.getItems().stream()
                                .map(item -> new MedicalRecordExchangeDocument.PrescriptionMedicationItem(
                                        item.getMedicineId() != null ? medicineCodeById.get(item.getMedicineId())
                                                : null,
                                        item.getMedicineName(),
                                        item.getActiveIngredient(),
                                        item.getStrength(),
                                        item.getDosage(),
                                        item.getFrequency(),
                                        item.getRoute() != null ? item.getRoute().name() : null,
                                        item.getQuantity(),
                                        item.getUnit(),
                                        item.getInstructions(),
                                        item.getDurationDays()))
                                .toList();
                    }

                    return new MedicalRecordExchangeDocument.PrescriptionItemDocument(
                            p.getId(),
                            p.getPrescriptionCode(),
                            p.getStatus() != null ? p.getStatus().name() : null,
                            p.getPrescribedAt(),
                            p.getInterconnectionReceiptCode(),
                            p.getNote(),
                            meds);
                }).toList();

        return new MedicalRecordExchangeDocument(
                "1.0",
                generatedAt,
                facility,
                patientInfo,
                encounterInfo,
                clinicalRecordInfo,
                diagnosisItems,
                orderItems,
                resultItems,
                prescriptionDocs);
    }

    private byte[] serializeToJson(Object value) {
        try {
            return objectMapper.writerWithDefaultPrettyPrinter().writeValueAsBytes(value);
        } catch (Exception ex) {
            throw new IllegalStateException("Failed to serialize medical record exchange document to JSON.", ex);
        }
    }

    private void recordExportAudits(
            List<MedicalRecord> records,
            List<MedicalRecordExchangeDocument> documents,
            UUID actorId,
            Instant now,
            String format) {
        Map<String, Object> detail = new LinkedHashMap<>();
        detail.put("exportedBy", actorId.toString());
        detail.put("recordCount", records.size());
        detail.put("medicalRecordIds", records.stream().map(r -> r.getId().toString()).toList());
        detail.put("visitIds", records.stream().map(r -> r.getVisitId().toString()).toList());
        detail.put("format", format);
        detail.put("exportedAt", now.toString());

        UUID primaryResourceId = records.size() == 1 ? records.get(0).getId() : null;

        auditLogRepository.save(AuditLog.create(
                actorId,
                ActionType.EXPORT,
                ResourceType.MEDICAL_RECORD,
                primaryResourceId,
                toJsonString(detail),
                null,
                now));

        for (MedicalRecordExchangeDocument doc : documents) {
            accessAuditService.recordRecordAccess(
                    doc.patient().patientId(),
                    doc.encounter().visitId(),
                    doc.clinicalRecord().medicalRecordId(),
                    actorId,
                    MedicalRecordAccessAction.EXPORT,
                    "Medical record exported according to standard data exchange structure (NCL-11-CN-007)",
                    now);
        }
    }

    private String toJsonString(Map<String, Object> detail) {
        try {
            return objectMapper.writeValueAsString(detail);
        } catch (Exception ex) {
            throw new IllegalStateException("Could not serialize export audit detail.", ex);
        }
    }
}
