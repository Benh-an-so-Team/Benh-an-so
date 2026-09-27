package com.benhsoan.application.ucservice.prescription;

import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.benhsoan.domain.auditlog.AuditLog;
import com.benhsoan.domain.auditlog.enums.ActionType;
import com.benhsoan.domain.auditlog.enums.ResourceType;
import com.benhsoan.domain.prescription.enums.PrescriptionStatus;
import com.benhsoan.domain.prescription.exception.PrescriptionNotFoundException;
import com.benhsoan.domain.prescription.exception.PrescriptionNotPrintableException;
import com.benhsoan.domain.shared.exception.ValidationException;
import com.benhsoan.application.ucservice.anonymization.AnonymizationModeState;
import com.benhsoan.domain.patient.PatientAnonymizer;
import com.benhsoan.infrastructure.pdf.PdfRenderingException;
import com.benhsoan.port.dto.result.PrescriptionPrintResult;
import com.benhsoan.port.dto.result.PrescriptionPrintDocument;
import com.benhsoan.port.inbound.prescription.ExportPrescriptionUseCase;
import com.benhsoan.port.outbound.pdf.PrescriptionPdfRenderer;
import com.benhsoan.port.outbound.repository.clinic.ClinicConfigurationRepository;
import com.benhsoan.port.outbound.repository.audit.AuditLogRepository;
import com.benhsoan.port.outbound.repository.prescription.PrescriptionRepository;
import com.benhsoan.port.outbound.security.CurrentUserPort;
import com.benhsoan.port.outbound.time.ClockPort;

@Service
@Transactional
public class ExportPrescriptionService implements ExportPrescriptionUseCase {

        private static final String PDF_CONTENT_TYPE = "application/pdf";
        private static final Logger log = LoggerFactory.getLogger(ExportPrescriptionService.class);

        private final PrescriptionRepository prescriptionRepository;
        private final PrescriptionReadAccessValidator accessValidator;
        private final PrescriptionDisplayContextResolver displayContextResolver;
        private final ClinicConfigurationRepository clinicConfigurationRepository;
        private final com.benhsoan.port.outbound.repository.clinic.DocumentPrintTemplateRepository documentPrintTemplateRepository;
        private final PrescriptionPdfRenderer pdfRenderer;
        private final CurrentUserPort currentUserPort;
        private final AuditLogRepository auditLogRepository;
        private final ClockPort clockPort;
        private final AnonymizationModeState anonymizationModeState;

        @org.springframework.beans.factory.annotation.Autowired
        public ExportPrescriptionService(
                        PrescriptionRepository prescriptionRepository,
                        PrescriptionReadAccessValidator accessValidator,
                        PrescriptionDisplayContextResolver displayContextResolver,
                        ClinicConfigurationRepository clinicConfigurationRepository,
                        com.benhsoan.port.outbound.repository.clinic.DocumentPrintTemplateRepository documentPrintTemplateRepository,
                        PrescriptionPdfRenderer pdfRenderer,
                        CurrentUserPort currentUserPort,
                        AuditLogRepository auditLogRepository,
                        ClockPort clockPort,
                        AnonymizationModeState anonymizationModeState) {
                this.prescriptionRepository = prescriptionRepository;
                this.accessValidator = accessValidator;
                this.displayContextResolver = displayContextResolver;
                this.clinicConfigurationRepository = clinicConfigurationRepository;
                this.documentPrintTemplateRepository = documentPrintTemplateRepository;
                this.pdfRenderer = pdfRenderer;
                this.currentUserPort = currentUserPort;
                this.auditLogRepository = auditLogRepository;
                this.clockPort = clockPort;
                this.anonymizationModeState = anonymizationModeState;
        }

        public ExportPrescriptionService(
                        PrescriptionRepository prescriptionRepository,
                        PrescriptionReadAccessValidator accessValidator,
                        PrescriptionDisplayContextResolver displayContextResolver,
                        ClinicConfigurationRepository clinicConfigurationRepository,
                        PrescriptionPdfRenderer pdfRenderer,
                        CurrentUserPort currentUserPort,
                        AuditLogRepository auditLogRepository,
                        ClockPort clockPort,
                        AnonymizationModeState anonymizationModeState) {
                this(prescriptionRepository, accessValidator, displayContextResolver,
                                clinicConfigurationRepository, null, pdfRenderer,
                                currentUserPort, auditLogRepository, clockPort, anonymizationModeState);
        }

        @Override
        public PrescriptionPrintResult export(UUID prescriptionId) {
                var prescription = prescriptionRepository.findById(prescriptionId)
                                .orElseThrow(() -> new PrescriptionNotFoundException(prescriptionId));
                accessValidator.requireCanRead(prescription);
                authorizePrintRole();
                ensurePrintable(prescription.getStatus(), prescription.getPrescriptionCode());
                var clinic = clinicConfigurationRepository.find()
                                .orElseThrow(() -> new ValidationException(
                                                "Clinic configuration is required for printing."));
                PrescriptionPrintDocument printModel = toPrintModel(prescription, clinic);

                byte[] content;
                try {
                        content = pdfRenderer.render(printModel);
                } catch (PdfRenderingException ex) {
                        log.error("Infrastructure failure: operation=render_prescription_pdf prescriptionId={} prescriptionCode={}",
                                        prescriptionId, printModel.prescriptionCode(), ex);
                        throw ex;
                }
                recordPrintAudit(prescription.getId(), printModel.prescriptionCode());
                return new PrescriptionPrintResult(
                                "prescription-" + printModel.prescriptionCode() + ".pdf",
                                PDF_CONTENT_TYPE,
                                content);
        }

        private void recordPrintAudit(UUID prescriptionId, String prescriptionCode) {
                UUID printedBy = currentUserPort.getCurrentUserId();
                var printedAt = clockPort.now();
                String roles = currentUserPort.getCurrentUserRoles().stream()
                                .sorted()
                                .map(role -> "\"" + role + "\"")
                                .collect(java.util.stream.Collectors.joining(","));
                String detail = """
                                {
                                "prescriptionCode":"%s",
                                "printedBy":"%s",
                                "roles":[%s],
                                "printedAt":"%s"
                                }
                                """.formatted(prescriptionCode, printedBy, roles, printedAt);
                auditLogRepository.save(AuditLog.create(
                                printedBy, ActionType.EXPORT, ResourceType.PRESCRIPTION,
                                prescriptionId, detail, null, printedAt));
        }

        private void ensurePrintable(PrescriptionStatus status, String prescriptionCode) {
                if (status != PrescriptionStatus.PENDING_DISPENSE && status != PrescriptionStatus.DISPENSED) {
                        throw new PrescriptionNotPrintableException("Only active prescriptions can be printed.");
                }
                requireText(prescriptionCode, "Prescription code is required for printing.");
        }

        private void authorizePrintRole() {
                if (!currentUserPort.hasRole("DOCTOR") && !currentUserPort.hasRole("PHARMACIST")) {
                        throw new AccessDeniedException("Only doctors and pharmacists can print prescriptions.");
                }
        }

        private PrescriptionPrintDocument toPrintModel(
                        com.benhsoan.domain.prescription.Prescription prescription,
                        com.benhsoan.domain.clinic.ClinicConfiguration clinic) {
                var context = displayContextResolver.resolve(
                                prescription.getMedicalRecordId(), prescription.getPrescribedBy());
                requireText(context.patientName(), "Patient name is required for printing.");
                requireText(context.doctorName(), "Prescribing doctor was not found for printing.");
                if (prescription.getPrescribedAt() == null || prescription.getItems().isEmpty()) {
                        throw new ValidationException("Prescription details are required for printing.");
                }
                requireText(clinic.getClinicName(), "Clinic name is required for printing.");
                requireText(clinic.getAddress(), "Clinic address is required for printing.");
                requireText(clinic.getPhone(), "Clinic phone is required for printing.");

                var template = documentPrintTemplateRepository != null
                                ? documentPrintTemplateRepository.findByDocumentType(
                                                com.benhsoan.domain.clinic.enums.PrintDocumentType.PRESCRIPTION)
                                                .orElse(null)
                                : null;
                String title = template != null ? template.getTitle() : null;
                String logoUrl = template != null ? template.getLogoUrl() : null;
                String legalInfo = template != null ? template.getLegalInfo() : null;
                String footerText = template != null ? template.getFooterText() : null;
                boolean showLogo = template == null || template.isShowLogo();
                String fieldVisibility = template != null ? template.getFieldVisibility() : null;

                return new PrescriptionPrintDocument(
                                clinic.getClinicName(), clinic.getAddress(), clinic.getPhone(),
                                prescription.getPrescriptionCode(), context.patientId(), context.patientCode(),
                                anonymizationModeState.isEnabled()
                                                ? PatientAnonymizer.maskFullName(context.patientCode())
                                                : context.patientName(),
                                prescription.getPrescribedBy(), context.doctorName(),
                                prescription.getPrescribedAt(), prescription.getItems().stream()
                                                .map(item -> new PrescriptionPrintDocument.Item(
                                                                item.getMedicineName(), item.getStrength(),
                                                                item.getUnit(),
                                                                item.getDosage(), item.getFrequency(),
                                                                item.getDurationDays(),
                                                                item.getRoute(), item.getQuantity(),
                                                                item.getInstructions()))
                                                .toList(),
                                title, logoUrl, legalInfo, footerText, showLogo, fieldVisibility);
        }

        private void requireText(String value, String message) {
                if (value == null || value.isBlank()) {
                        throw new ValidationException(message);
                }
        }
}
