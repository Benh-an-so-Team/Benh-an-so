package com.benhsoan.application.ucservice.prescription;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import com.benhsoan.domain.medicalrecord.MedicalRecord;
import com.benhsoan.domain.medicalrecord.MedicalRecordDiagnosis;
import com.benhsoan.domain.medicalrecord.enums.DiagnosisType;
import com.benhsoan.domain.medicalrecord.enums.MedicalRecordStatus;
import com.benhsoan.domain.medicine.Medicine;
import com.benhsoan.domain.medicine.enums.AdministrationRoute;
import com.benhsoan.domain.medicine.enums.DosageForm;
import com.benhsoan.domain.prescription.Prescription;
import com.benhsoan.domain.prescription.PrescriptionItem;
import com.benhsoan.domain.prescription.enums.InterconnectionStatus;
import com.benhsoan.domain.prescription.enums.PrescriptionStatus;
import com.benhsoan.domain.prescription.exception.PrescriptionAlreadyDispensedException;
import com.benhsoan.domain.visit.Visit;
import com.benhsoan.domain.visit.enums.VisitStatus;
import com.benhsoan.domain.visit.enums.VisitType;
import com.benhsoan.port.dto.command.prescription.CreatePrescriptionCommand;
import com.benhsoan.port.dto.command.prescription.CreatePrescriptionItemCommand;
import com.benhsoan.port.dto.command.prescription.ReplacePrescriptionCommand;
import com.benhsoan.port.dto.result.ContraindicationCheckResult;
import com.benhsoan.port.dto.result.PrescriptionInterconnectionResult;
import com.benhsoan.port.dto.result.PrescriptionReplacementResult;
import com.benhsoan.port.inbound.prescription.CheckContraindicationUseCase;
import com.benhsoan.port.inbound.prescription.CheckDrugInteractionUseCase;
import com.benhsoan.port.inbound.prescription.CheckPatientDrugAllergyUseCase;
import com.benhsoan.port.inbound.prescription.SendPrescriptionInterconnectionUseCase;
import com.benhsoan.port.outbound.generator.PrescriptionCodeGenerator;
import com.benhsoan.port.outbound.repository.medicalrecord.MedicalRecordDiagnosisRepository;
import com.benhsoan.port.outbound.repository.medicalrecord.MedicalRecordRepository;
import com.benhsoan.port.outbound.repository.medicine.MedicineRepository;
import com.benhsoan.port.outbound.repository.prescription.PrescriptionRepository;
import com.benhsoan.port.outbound.repository.visit.VisitRepository;
import com.benhsoan.port.outbound.security.CurrentUserPort;
import com.benhsoan.port.outbound.time.ClockPort;

/**
 * NCL-12-CN-008 CV-01/TC-01: end-to-end replacement through the real application service and
 * real repositories against H2. The original prescription was successfully interconnected and
 * the visit has been completed, which exercises the replacement-specific creation path.
 */
@SpringBootTest(properties = {
        "spring.flyway.enabled=false",
        "spring.sql.init.mode=never",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.datasource.url=jdbc:h2:mem:prescription_replacement_test;DB_CLOSE_DELAY=-1;MODE=MySQL;DATABASE_TO_LOWER=TRUE",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "spring.jpa.database-platform=org.hibernate.dialect.H2Dialect",
        "spring.jpa.hibernate.ddl-auto=create-drop"
})
@ActiveProfiles("test")
@DisplayName("ReplaceInterconnectedPrescriptionService Integration (H2)")
class ReplaceInterconnectedPrescriptionServiceIntegrationTest {

    private static final Instant NOW = Instant.parse("2026-09-25T03:00:00Z");
    private static final String REASON = "Sai liều lượng so với chẩn đoán đã cập nhật";
    private static final String REPLACEMENT_CODE = "RX000002";

    private String originalCode;

    @Autowired private ReplaceInterconnectedPrescriptionService service;
    @Autowired private PrescriptionRepository prescriptionRepository;
    @Autowired private MedicineRepository medicineRepository;
    @Autowired private MedicalRecordRepository medicalRecordRepository;
    @Autowired private VisitRepository visitRepository;
    @Autowired private MedicalRecordDiagnosisRepository medicalRecordDiagnosisRepository;

    @MockitoBean private CurrentUserPort currentUserPort;
    @MockitoBean private ClockPort clockPort;
    @MockitoBean private PrescriptionCodeGenerator prescriptionCodeGenerator;
    @MockitoBean private SendPrescriptionInterconnectionUseCase sendPrescriptionInterconnectionUseCase;
    @MockitoBean private CheckDrugInteractionUseCase checkDrugInteractionUseCase;
    @MockitoBean private CheckPatientDrugAllergyUseCase checkPatientDrugAllergyUseCase;
    @MockitoBean private CheckContraindicationUseCase checkContraindicationUseCase;

    private UUID actorId;
    private UUID medicalRecordId;
    private UUID medicineId;

    @BeforeEach
    void setUp() {
        actorId = UUID.randomUUID();
        medicalRecordId = UUID.randomUUID();
        medicineId = UUID.randomUUID();

        when(currentUserPort.hasRole("DOCTOR")).thenReturn(true);
        when(currentUserPort.getCurrentUserId()).thenReturn(actorId);
        when(clockPort.now()).thenReturn(NOW);
        when(prescriptionCodeGenerator.generate()).thenReturn(REPLACEMENT_CODE);
        when(checkDrugInteractionUseCase.check(any())).thenReturn(List.of());
        when(checkPatientDrugAllergyUseCase.check(any(), any())).thenReturn(List.of());
        when(checkContraindicationUseCase.check(any(), any()))
                .thenReturn(new ContraindicationCheckResult(List.of(), List.of()));
        when(sendPrescriptionInterconnectionUseCase.send(any()))
                .thenReturn(new PrescriptionInterconnectionResult(
                        null, REPLACEMENT_CODE, InterconnectionStatus.SUCCESS,
                        "LT-20260925-000123", null, NOW));

        seedClinicalContext();
        seedMedicine();
    }

    @Test
    @DisplayName("A completed visit still allows replacement of an eligible interconnected prescription")
    void replacesEligiblePrescriptionAfterVisitCompletion() {
        UUID originalId = UUID.randomUUID();
        seedOriginalPrescription(originalId, PrescriptionStatus.PENDING_DISPENSE);

        PrescriptionReplacementResult result = service.replace(
                new ReplacePrescriptionCommand(originalId, REASON, replacementCommand()));

        assertNotNull(result);
        assertEquals(PrescriptionStatus.REPLACED, result.originalPrescription().status());

        Prescription original = prescriptionRepository.findById(originalId).orElseThrow();
        assertEquals(PrescriptionStatus.REPLACED, original.getStatus());
        assertEquals(InterconnectionStatus.SUCCESS, original.getInterconnectionStatus());

        Prescription replacement = prescriptionRepository.findReplacementOf(originalId).orElseThrow();
        assertEquals(originalId, replacement.getReplacesPrescriptionId());
        assertEquals(originalCode, replacement.getReplacesPrescriptionCode());
        assertEquals(REASON, replacement.getReplacementReason());
        assertEquals(REPLACEMENT_CODE, replacement.getPrescriptionCode());
        assertEquals(medicalRecordId, replacement.getMedicalRecordId());
    }

    @Test
    @DisplayName("An already dispensed original prescription cannot be replaced")
    void rejectsAlreadyDispensedPrescription() {
        UUID originalId = UUID.randomUUID();
        seedOriginalPrescription(originalId, PrescriptionStatus.DISPENSED);

        assertThrows(PrescriptionAlreadyDispensedException.class,
                () -> service.replace(new ReplacePrescriptionCommand(originalId, REASON, replacementCommand())));

        assertEquals(PrescriptionStatus.DISPENSED,
                prescriptionRepository.findById(originalId).orElseThrow().getStatus());
    }

    private void seedClinicalContext() {
        UUID visitId = UUID.randomUUID();
        visitRepository.save(Visit.restore(
                visitId, "VS000001", UUID.randomUUID(), actorId, null, null,
                VisitType.WALK_IN, VisitStatus.COMPLETED, NOW.minusSeconds(600), NOW.minusSeconds(600), NOW,
                "Khám tổng quát", null, actorId, NOW.minusSeconds(600), null));

        medicalRecordRepository.save(MedicalRecord.restore(
                medicalRecordId, visitId, "Đau bụng", null, null, null, null, null, null,
                "Viêm dạ dày cấp", MedicalRecordStatus.OPEN, null, null, null,
                actorId, NOW.minusSeconds(600), null, null));

        medicalRecordDiagnosisRepository.replaceForMedicalRecord(medicalRecordId, List.of(
                MedicalRecordDiagnosis.create(
                        medicalRecordId, null, "A09", "Viêm dạ dày cấp",
                        DiagnosisType.PRIMARY, null, actorId, NOW.minusSeconds(600))));
    }

    private void seedMedicine() {
        medicineRepository.save(Medicine.restore(
                medicineId, "MED-" + medicineId.toString().substring(0, 8), "Paracetamol", "Paracetamol", "500 mg",
                DosageForm.TABLET, "vien", AdministrationRoute.ORAL, true,
                NOW.minusSeconds(600), null, 100, 10, false,
                new BigDecimal("500"), new BigDecimal("4000")));
    }

    private void seedOriginalPrescription(UUID originalId, PrescriptionStatus status) {
        originalCode = "RX-" + originalId.toString().substring(0, 8);
        PrescriptionItem item = PrescriptionItem.restore(
                UUID.randomUUID(), originalId, medicineId, "Paracetamol", "Paracetamol",
                "500 mg", "vien", "1 viên", 2, AdministrationRoute.ORAL, 5,
                10, 0, null, NOW.minusSeconds(600), null);

        prescriptionRepository.save(Prescription.restore(
                originalId, originalCode, medicalRecordId, status, null, actorId,
                NOW.minusSeconds(600), null, null,
                InterconnectionStatus.SUCCESS, NOW.minusSeconds(300), null, "LT-20260925-000001",
                List.of(item)));
    }

    private CreatePrescriptionCommand replacementCommand() {
        return CreatePrescriptionCommand.builder()
                .medicalRecordId(medicalRecordId)
                .note("Đơn thay thế")
                .items(List.of(CreatePrescriptionItemCommand.builder()
                        .medicineId(medicineId)
                        .dosage("1 viên")
                        .frequency(2)
                        .route(AdministrationRoute.ORAL)
                        .durationDays(5)
                        .quantity(10)
                        .instructions(null)
                        .singleDoseQuantity(BigDecimal.ONE)
                        .build()))
                .build();
    }
}
