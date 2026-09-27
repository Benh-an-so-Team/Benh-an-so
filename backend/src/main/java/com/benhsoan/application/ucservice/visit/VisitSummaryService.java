package com.benhsoan.application.ucservice.visit;

import java.time.Instant;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.benhsoan.application.ucservice.anonymization.AnonymizationModeState;
import com.benhsoan.application.ucservice.medicalrecord.MedicalRecordAccessAuditService;
import com.benhsoan.domain.auditlog.AuditLog;
import com.benhsoan.domain.auditlog.enums.ActionType;
import com.benhsoan.domain.auditlog.enums.ResourceType;
import com.benhsoan.domain.auth.User;
import com.benhsoan.domain.auth.exception.UserNotFoundException;
import com.benhsoan.domain.clinic.ClinicConfiguration;
import com.benhsoan.domain.clinical.ClinicalOrder;
import com.benhsoan.domain.clinical.ClinicalOrderItem;
import com.benhsoan.domain.clinical.enums.ClinicalOrderStatus;
import com.benhsoan.domain.medicalrecord.MedicalRecord;
import com.benhsoan.domain.medicalrecord.MedicalRecordDiagnosis;
import com.benhsoan.domain.medicalrecord.enums.MedicalRecordAccessAction;
import com.benhsoan.domain.medicalrecord.exception.MedicalRecordNotFoundException;
import com.benhsoan.domain.medicalrecord.exception.MedicalRecordNotSignedException;
import com.benhsoan.domain.patient.Patient;
import com.benhsoan.domain.patient.PatientAnonymizer;
import com.benhsoan.domain.patient.exception.PatientNotFoundException;
import com.benhsoan.domain.visit.Visit;
import com.benhsoan.domain.visit.exception.VisitNotFoundException;
import com.benhsoan.port.dto.command.medicalrecord.GetMedicalRecordAccessLogsQuery;
import com.benhsoan.port.dto.result.VisitSummaryPrintDocument;
import com.benhsoan.port.dto.result.VisitSummaryPrintResult;
import com.benhsoan.port.dto.result.VisitSummaryResult;
import com.benhsoan.port.inbound.visit.ExportVisitSummaryUseCase;
import com.benhsoan.port.inbound.visit.GetVisitSummaryUseCase;
import com.benhsoan.port.outbound.pdf.VisitSummaryPdfRenderer;
import com.benhsoan.port.outbound.repository.audit.AuditLogRepository;
import com.benhsoan.port.outbound.repository.auth.UserRepository;
import com.benhsoan.port.outbound.repository.clinic.ClinicConfigurationRepository;
import com.benhsoan.port.outbound.repository.clinical.ClinicalOrderItemRepository;
import com.benhsoan.port.outbound.repository.clinical.ClinicalOrderRepository;
import com.benhsoan.port.outbound.repository.medicalrecord.MedicalRecordAccessLogRepository;
import com.benhsoan.port.outbound.repository.medicalrecord.MedicalRecordDiagnosisRepository;
import com.benhsoan.port.outbound.repository.medicalrecord.MedicalRecordRepository;
import com.benhsoan.port.outbound.repository.patient.PatientRepository;
import com.benhsoan.port.outbound.repository.visit.VisitRepository;
import com.benhsoan.port.outbound.security.CurrentUserPort;
import com.benhsoan.port.outbound.time.ClockPort;
import com.fasterxml.jackson.databind.ObjectMapper;

@Service
@Transactional
public class VisitSummaryService implements GetVisitSummaryUseCase, ExportVisitSummaryUseCase {

        private static final String PDF_CONTENT_TYPE = "application/pdf";

        private final VisitRepository visitRepository;
        private final MedicalRecordRepository medicalRecordRepository;
        private final PatientRepository patientRepository;
        private final UserRepository userRepository;
        private final ClinicConfigurationRepository clinicConfigurationRepository;
        private final com.benhsoan.port.outbound.repository.clinic.DocumentPrintTemplateRepository documentPrintTemplateRepository;
        private final MedicalRecordDiagnosisRepository medicalRecordDiagnosisRepository;
        private final ClinicalOrderRepository clinicalOrderRepository;
        private final ClinicalOrderItemRepository clinicalOrderItemRepository;
        private final MedicalRecordAccessLogRepository accessLogRepository;
        private final AuditLogRepository auditLogRepository;
        private final MedicalRecordAccessAuditService accessAuditService;
        private final VisitSummaryPdfRenderer pdfRenderer;
        private final CurrentUserPort currentUserPort;
        private final ClockPort clockPort;
        private final AnonymizationModeState anonymizationModeState;
        private final ObjectMapper objectMapper;
        private final VisitSummaryAuthorization visitSummaryAuthorization;

        @org.springframework.beans.factory.annotation.Autowired
        public VisitSummaryService(
                        VisitRepository visitRepository,
                        MedicalRecordRepository medicalRecordRepository,
                        PatientRepository patientRepository,
                        UserRepository userRepository,
                        ClinicConfigurationRepository clinicConfigurationRepository,
                        com.benhsoan.port.outbound.repository.clinic.DocumentPrintTemplateRepository documentPrintTemplateRepository,
                        MedicalRecordDiagnosisRepository medicalRecordDiagnosisRepository,
                        ClinicalOrderRepository clinicalOrderRepository,
                        ClinicalOrderItemRepository clinicalOrderItemRepository,
                        MedicalRecordAccessLogRepository accessLogRepository,
                        AuditLogRepository auditLogRepository,
                        MedicalRecordAccessAuditService accessAuditService,
                        VisitSummaryPdfRenderer pdfRenderer,
                        CurrentUserPort currentUserPort,
                        ClockPort clockPort,
                        AnonymizationModeState anonymizationModeState,
                        ObjectMapper objectMapper,
                        VisitSummaryAuthorization visitSummaryAuthorization) {
                this.visitRepository = visitRepository;
                this.medicalRecordRepository = medicalRecordRepository;
                this.patientRepository = patientRepository;
                this.userRepository = userRepository;
                this.clinicConfigurationRepository = clinicConfigurationRepository;
                this.documentPrintTemplateRepository = documentPrintTemplateRepository;
                this.medicalRecordDiagnosisRepository = medicalRecordDiagnosisRepository;
                this.clinicalOrderRepository = clinicalOrderRepository;
                this.clinicalOrderItemRepository = clinicalOrderItemRepository;
                this.accessLogRepository = accessLogRepository;
                this.auditLogRepository = auditLogRepository;
                this.accessAuditService = accessAuditService;
                this.pdfRenderer = pdfRenderer;
                this.currentUserPort = currentUserPort;
                this.clockPort = clockPort;
                this.anonymizationModeState = anonymizationModeState;
                this.objectMapper = objectMapper;
                this.visitSummaryAuthorization = visitSummaryAuthorization;
        }

        public VisitSummaryService(
                        VisitRepository visitRepository,
                        MedicalRecordRepository medicalRecordRepository,
                        PatientRepository patientRepository,
                        UserRepository userRepository,
                        ClinicConfigurationRepository clinicConfigurationRepository,
                        MedicalRecordDiagnosisRepository medicalRecordDiagnosisRepository,
                        ClinicalOrderRepository clinicalOrderRepository,
                        ClinicalOrderItemRepository clinicalOrderItemRepository,
                        MedicalRecordAccessLogRepository accessLogRepository,
                        AuditLogRepository auditLogRepository,
                        MedicalRecordAccessAuditService accessAuditService,
                        VisitSummaryPdfRenderer pdfRenderer,
                        CurrentUserPort currentUserPort,
                        ClockPort clockPort,
                        AnonymizationModeState anonymizationModeState,
                        ObjectMapper objectMapper,
                        VisitSummaryAuthorization visitSummaryAuthorization) {
                this(visitRepository, medicalRecordRepository, patientRepository, userRepository,
                                clinicConfigurationRepository, null, medicalRecordDiagnosisRepository,
                                clinicalOrderRepository, clinicalOrderItemRepository, accessLogRepository,
                                auditLogRepository, accessAuditService, pdfRenderer, currentUserPort, clockPort,
                                anonymizationModeState, objectMapper, visitSummaryAuthorization);
        }

        @Override
        @Transactional(readOnly = true)
        public VisitSummaryResult getSummary(UUID visitId) {
                VisitEncounterData data = loadAndValidateVisitData(visitId);
                return toResult(data);
        }

        @Override
        public VisitSummaryPrintResult export(UUID visitId) {
                VisitEncounterData data = loadAndValidateVisitData(visitId);

                UUID currentUserId = currentUserPort.getCurrentUserId();
                Instant now = clockPort.now();
                String currentUserName = resolveUserName(currentUserId);

                VisitSummaryPrintDocument doc = toPrintDocument(data, currentUserName, now);
                byte[] content = pdfRenderer.render(doc);

                recordPrintAudits(data.visit(), data.record(), data.patient(), currentUserId, now);

                String fileName = "phieu-tom-tat-" + data.visit().getVisitCode() + ".pdf";
                return new VisitSummaryPrintResult(fileName, PDF_CONTENT_TYPE, content);
        }

        private VisitEncounterData loadAndValidateVisitData(UUID visitId) {
                Visit visit = visitRepository.findById(visitId)
                                .orElseThrow(() -> new VisitNotFoundException(visitId));

                visitSummaryAuthorization.requireSummaryAccess(visit.getDoctorId());

                MedicalRecord record = medicalRecordRepository.findByVisitId(visitId)
                                .orElseThrow(() -> new MedicalRecordNotFoundException(visitId));

                // Precondition: Bệnh án của lượt khám đã được ký (QTN-17, TC-02)
                if (!record.isContentLocked()) {
                        throw new MedicalRecordNotSignedException(
                                        record.getId(),
                                        "Bệnh án của lượt khám chưa được ký. Vui lòng ký bệnh án trước khi in phiếu tóm tắt.");
                }

                Patient patient = patientRepository.findById(visit.getPatientId())
                                .orElseThrow(() -> new PatientNotFoundException(visit.getPatientId()));

                User doctor = userRepository.findById(visit.getDoctorId())
                                .orElseThrow(() -> new UserNotFoundException(visit.getDoctorId().toString()));

                ClinicConfiguration clinic = clinicConfigurationRepository.find().orElse(null);

                List<MedicalRecordDiagnosis> diagnoses = medicalRecordDiagnosisRepository
                                .findByMedicalRecordId(record.getId());

                ActiveOrderData activeOrderData = loadNonCancelledOrderItems(visitId);

                String signedByName = record.getSignedBy() != null ? resolveUserName(record.getSignedBy())
                                : doctor.getFullName();

                List<VisitSummaryResult.PrintHistoryItem> printHistory = loadPrintHistory(visitId);

                return new VisitEncounterData(
                                visit, record, patient, doctor, clinic, diagnoses, activeOrderData.items(),
                                activeOrderData.orderCodeMap(), signedByName, printHistory);
        }

        private record ActiveOrderData(
                        List<ClinicalOrderItem> items,
                        Map<UUID, String> orderCodeMap) {
        }

        private ActiveOrderData loadNonCancelledOrderItems(UUID visitId) {
                var ordersPage = clinicalOrderRepository.findByVisitId(visitId, Pageable.unpaged());
                Map<UUID, String> orderCodeMap = ordersPage.getContent().stream()
                                .filter(o -> o.getStatus() != ClinicalOrderStatus.CANCELLED)
                                .collect(Collectors.toMap(
                                                ClinicalOrder::getId,
                                                ClinicalOrder::getOrderCode,
                                                (c1, c2) -> c1));

                if (orderCodeMap.isEmpty()) {
                        return new ActiveOrderData(Collections.emptyList(), Collections.emptyMap());
                }

                List<ClinicalOrderItem> items = clinicalOrderItemRepository
                                .findByClinicalOrderIdIn(orderCodeMap.keySet()).stream()
                                .filter(item -> !"CANCELLED".equalsIgnoreCase(item.getStatus().name()))
                                .toList();

                return new ActiveOrderData(items, orderCodeMap);
        }

        private List<VisitSummaryResult.PrintHistoryItem> loadPrintHistory(UUID visitId) {
                var query = new GetMedicalRecordAccessLogsQuery(null, null, null, visitId, null, null, 0, 100);
                var page = accessLogRepository.search(query, Pageable.unpaged());

                Map<UUID, String> userNameCache = new HashMap<>();

                return page.getContent().stream()
                                .filter(log -> log.getAction() == MedicalRecordAccessAction.PRINT)
                                .map(log -> {
                                        String name = userNameCache.computeIfAbsent(log.getAccessedBy(),
                                                        this::resolveUserName);
                                        return new VisitSummaryResult.PrintHistoryItem(
                                                        log.getAccessedBy(),
                                                        name,
                                                        log.getAccessedAt(),
                                                        log.getDetail());
                                })
                                .sorted(Comparator.comparing(VisitSummaryResult.PrintHistoryItem::printedAt).reversed())
                                .toList();
        }

        private String resolveUserName(UUID userId) {
                if (userId == null) {
                        return "N/A";
                }
                return userRepository.findById(userId)
                                .map(User::getFullName)
                                .orElse(userId.toString());
        }

        private VisitSummaryResult toResult(VisitEncounterData d) {
                var clinicInfo = d.clinic() != null ? new VisitSummaryResult.ClinicInfo(
                                d.clinic().getClinicName(),
                                d.clinic().getAddress(),
                                d.clinic().getPhone()) : null;

                String displayName = anonymizationModeState.isEnabled()
                                ? PatientAnonymizer.maskFullName(d.patient().getPatientCode())
                                : d.patient().getFullName();

                String displayPhone = anonymizationModeState.isEnabled()
                                ? PatientAnonymizer.maskPhone(d.patient().getPhone())
                                : d.patient().getPhone();

                var patientInfo = new VisitSummaryResult.PatientInfo(
                                d.patient().getId(),
                                d.patient().getPatientCode(),
                                displayName,
                                d.patient().getDateOfBirth(),
                                d.patient().getGender(),
                                displayPhone,
                                d.patient().getIdentityNumber());

                var doctorInfo = new VisitSummaryResult.DoctorInfo(
                                d.doctor().getId(),
                                d.doctor().getFullName());

                var medicalRecordInfo = new VisitSummaryResult.MedicalRecordInfo(
                                d.record().getId(),
                                d.record().getStatus(),
                                d.record().getSignedAt(),
                                d.record().getSignedBy(),
                                d.signedByName());

                var diagnosisItems = d.diagnoses().stream()
                                .sorted(Comparator.comparing(MedicalRecordDiagnosis::isPrimary).reversed())
                                .map(diag -> new VisitSummaryResult.DiagnosisItem(
                                                diag.getDiagnosisCode(),
                                                diag.getDiagnosisName(),
                                                diag.isPrimary()))
                                .toList();

                var clinicalOrderItems = d.orderItems().stream()
                                .map(item -> new VisitSummaryResult.ClinicalOrderItemInfo(
                                                d.orderCodeMap().getOrDefault(item.getClinicalOrderId(), "N/A"),
                                                item.getServiceCode(),
                                                item.getServiceName(),
                                                item.getInstruction(),
                                                item.getStatus() != null ? item.getStatus().name() : null))
                                .toList();

                return new VisitSummaryResult(
                                d.visit().getId(),
                                d.visit().getVisitCode(),
                                d.visit().getVisitAt(),
                                clinicInfo,
                                patientInfo,
                                doctorInfo,
                                medicalRecordInfo,
                                diagnosisItems,
                                clinicalOrderItems,
                                d.record().getDoctorInstructions(),
                                d.record().getTreatmentPlan(),
                                d.record().getRevisitDate(),
                                d.printHistory());
        }

        private VisitSummaryPrintDocument toPrintDocument(VisitEncounterData d, String printedByName,
                        Instant printedAt) {
                String clinicName = d.clinic() != null ? d.clinic().getClinicName() : "PHÒNG KHÁM";
                String clinicAddress = d.clinic() != null ? d.clinic().getAddress() : "";
                String clinicPhone = d.clinic() != null ? d.clinic().getPhone() : "";

                String displayName = anonymizationModeState.isEnabled()
                                ? PatientAnonymizer.maskFullName(d.patient().getPatientCode())
                                : d.patient().getFullName();

                String displayPhone = anonymizationModeState.isEnabled()
                                ? PatientAnonymizer.maskPhone(d.patient().getPhone())
                                : d.patient().getPhone();

                String dobStr = d.patient().getDateOfBirth() != null ? d.patient().getDateOfBirth().toString() : "";
                String genderStr = d.patient().getGender() != null ? d.patient().getGender().name() : "";

                List<VisitSummaryPrintDocument.Diagnosis> printDiagnoses = d.diagnoses().stream()
                                .sorted(Comparator.comparing(MedicalRecordDiagnosis::isPrimary).reversed())
                                .map(diag -> new VisitSummaryPrintDocument.Diagnosis(
                                                diag.getDiagnosisCode(),
                                                diag.getDiagnosisName(),
                                                diag.isPrimary()))
                                .toList();

                List<VisitSummaryPrintDocument.ClinicalOrder> printOrders = d.orderItems().stream()
                                .map(item -> new VisitSummaryPrintDocument.ClinicalOrder(
                                                d.orderCodeMap().getOrDefault(item.getClinicalOrderId(), ""),
                                                item.getServiceCode(),
                                                item.getServiceName(),
                                                item.getInstruction(),
                                                item.getStatus() != null ? item.getStatus().name() : ""))
                                .toList();

                var template = documentPrintTemplateRepository != null
                                ? documentPrintTemplateRepository.findByDocumentType(
                                                com.benhsoan.domain.clinic.enums.PrintDocumentType.VISIT_SUMMARY)
                                                .orElse(null)
                                : null;
                String title = template != null ? template.getTitle() : null;
                String logoUrl = template != null ? template.getLogoUrl() : null;
                String legalInfo = template != null ? template.getLegalInfo() : null;
                String footerText = template != null ? template.getFooterText() : null;
                boolean showLogo = template == null || template.isShowLogo();
                String fieldVisibility = template != null ? template.getFieldVisibility() : null;

                return new VisitSummaryPrintDocument(
                                clinicName,
                                clinicAddress,
                                clinicPhone,
                                d.patient().getPatientCode(),
                                displayName,
                                dobStr,
                                genderStr,
                                displayPhone,
                                d.visit().getVisitCode(),
                                d.visit().getVisitAt(),
                                d.doctor().getFullName(),
                                printDiagnoses,
                                printOrders,
                                d.record().getDoctorInstructions(),
                                d.record().getTreatmentPlan(),
                                d.record().getRevisitDate(),
                                d.signedByName(),
                                d.record().getSignedAt(),
                                printedByName,
                                printedAt,
                                title,
                                logoUrl,
                                legalInfo,
                                footerText,
                                showLogo,
                                fieldVisibility);
        }

        private void recordPrintAudits(Visit visit, MedicalRecord record, Patient patient, UUID actorId, Instant now) {
                // 1. Ghi nhận AuditLog chung (ActionType.EXPORT, ResourceType.VISIT)
                Map<String, Object> detail = new HashMap<>();
                detail.put("visitCode", visit.getVisitCode());
                detail.put("printedBy", actorId.toString());
                detail.put("printedAt", now.toString());

                String detailJson;
                try {
                        detailJson = objectMapper.writeValueAsString(detail);
                } catch (Exception ex) {
                        detailJson = "{\"visitCode\":\"" + visit.getVisitCode() + "\"}";
                }

                auditLogRepository.save(AuditLog.create(
                                actorId,
                                ActionType.EXPORT,
                                ResourceType.VISIT,
                                visit.getId(),
                                detailJson,
                                null,
                                now));

                // 2. Ghi nhận MedicalRecordAccessLog chuyên biệt
                // (MedicalRecordAccessAction.PRINT) cùng transaction
                accessAuditService.recordRecordAccessInCurrentTransaction(
                                patient.getId(),
                                visit.getId(),
                                record.getId(),
                                actorId,
                                MedicalRecordAccessAction.PRINT,
                                "In phiếu tóm tắt lượt khám",
                                now);
        }

        private record VisitEncounterData(
                        Visit visit,
                        MedicalRecord record,
                        Patient patient,
                        User doctor,
                        ClinicConfiguration clinic,
                        List<MedicalRecordDiagnosis> diagnoses,
                        List<ClinicalOrderItem> orderItems,
                        Map<UUID, String> orderCodeMap,
                        String signedByName,
                        List<VisitSummaryResult.PrintHistoryItem> printHistory) {
        }
}
