package com.benhsoan.adapter.inbound.rest.controller;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import com.benhsoan.adapter.inbound.rest.mapper.PrescriptionRestMapper;
import com.benhsoan.application.ucservice.anonymization.AnonymizationModeState;
import com.benhsoan.domain.prescription.exception.PrescriptionAllergyConfirmationRequiredException;
import com.benhsoan.domain.druginteraction.enums.InteractionSeverity;
import com.benhsoan.domain.medicine.enums.AdministrationRoute;
import com.benhsoan.domain.prescription.enums.PrescriptionStatus;
import com.benhsoan.domain.prescription.enums.InterconnectionStatus;
import com.benhsoan.port.dto.result.DispenseAllocationResult;
import com.benhsoan.port.dto.result.DispensePrescriptionResult;
import com.benhsoan.port.dto.result.PartialDispensePrescriptionResult;
import com.benhsoan.port.dto.result.PrescriptionDispenseHistoryResult;
import com.benhsoan.port.dto.result.DrugInteractionWarningResult;
import com.benhsoan.port.dto.result.PrescriptionItemResult;
import com.benhsoan.port.dto.result.PrescriptionResult;
import com.benhsoan.port.dto.result.PrescriptionInterconnectionResult;
import com.benhsoan.domain.patient.enums.AllergySeverity;
import com.benhsoan.port.dto.result.PatientAllergyWarningResult;
import com.benhsoan.port.dto.result.PrescriptionAllergyWarningLogResult;
import com.benhsoan.domain.prescription.exception.PrescriptionNotFoundException;
import com.benhsoan.domain.prescription.exception.PrescriptionAlreadyDispensedException;
import com.benhsoan.port.dto.command.prescription.CancelPrescriptionCommand;
import com.benhsoan.port.dto.command.prescription.DispensePrescriptionCommand;
import com.benhsoan.port.inbound.prescription.CheckPatientDrugAllergyUseCase;
import com.benhsoan.port.inbound.prescription.CheckContraindicationUseCase;
import com.benhsoan.port.inbound.prescription.CheckMaxDailyDoseUseCase;
import com.benhsoan.port.inbound.prescription.GetPrescriptionAllergyWarningLogsUseCase;
import com.benhsoan.port.inbound.prescription.AmendPrescriptionUseCase;
import com.benhsoan.port.inbound.prescription.CancelPrescriptionUseCase;
import com.benhsoan.port.inbound.prescription.CheckDrugInteractionUseCase;
import com.benhsoan.port.inbound.prescription.CreatePrescriptionUseCase;
import com.benhsoan.port.inbound.prescription.DispensePrescriptionUseCase;
import com.benhsoan.port.inbound.prescription.DispensePrescriptionItemsUseCase;
import com.benhsoan.port.inbound.prescription.GetPrescriptionDispenseHistoryUseCase;
import com.benhsoan.port.inbound.prescription.GetDispenseSuggestionUseCase;
import com.benhsoan.port.inbound.prescription.ExportPrescriptionUseCase;
import com.benhsoan.port.inbound.prescription.GetPrescriptionByCodeUseCase;
import com.benhsoan.port.inbound.prescription.GetPrescriptionUseCase;
import com.benhsoan.port.inbound.prescription.GetPrescriptionsByMedicalRecordUseCase;
import com.benhsoan.port.inbound.prescription.SearchPrescriptionsUseCase;
import com.benhsoan.port.inbound.prescription.SendPrescriptionInterconnectionUseCase;
import com.benhsoan.port.inbound.prescription.RetryPrescriptionInterconnectionUseCase;
import com.benhsoan.port.inbound.prescription.ReplaceInterconnectedPrescriptionUseCase;
import com.benhsoan.port.dto.command.prescription.ReplacePrescriptionCommand;
import com.benhsoan.port.dto.result.PrescriptionReplacementResult;
import com.benhsoan.domain.prescription.exception.PrescriptionInvalidStatusException;
import com.benhsoan.domain.prescription.exception.UnauthorizedPrescriptionReplacementException;
import org.springframework.security.access.AccessDeniedException;
import com.benhsoan.port.inbound.prescription.ReturnMedicationUseCase;
import com.benhsoan.port.outbound.authSecurity.JwtTokenPort;
import com.benhsoan.port.outbound.repository.auth.UserRepository;
import com.benhsoan.port.outbound.repository.auth.UserSessionRepository;
import com.benhsoan.port.outbound.security.CurrentUserPort;
import com.benhsoan.port.outbound.time.ClockPort;

@WebMvcTest(controllers = PrescriptionController.class)
@AutoConfigureMockMvc(addFilters = false)
@Import({PrescriptionRestMapper.class, AnonymizationModeState.class})
@DisplayName("PrescriptionController - MockMvc Tests")
class PrescriptionControllerTest {

    private static final Instant NOW = Instant.parse("2026-08-07T02:00:00Z");

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private AnonymizationModeState anonymizationModeState;

    @MockitoBean
    private CreatePrescriptionUseCase createPrescriptionUseCase;

    @MockitoBean
    private AmendPrescriptionUseCase amendPrescriptionUseCase;

    @MockitoBean
    private GetPrescriptionUseCase getPrescriptionUseCase;

    @MockitoBean
    private GetPrescriptionByCodeUseCase getPrescriptionByCodeUseCase;

    @MockitoBean
    private GetPrescriptionsByMedicalRecordUseCase getPrescriptionsByMedicalRecordUseCase;

    @MockitoBean
    private SearchPrescriptionsUseCase searchPrescriptionsUseCase;

    @MockitoBean
    private DispensePrescriptionUseCase dispensePrescriptionUseCase;

    @MockitoBean
    private DispensePrescriptionItemsUseCase dispensePrescriptionItemsUseCase;

    @MockitoBean
    private GetPrescriptionDispenseHistoryUseCase getPrescriptionDispenseHistoryUseCase;

    @MockitoBean
    private GetDispenseSuggestionUseCase getDispenseSuggestionUseCase;

    @MockitoBean
    private CancelPrescriptionUseCase cancelPrescriptionUseCase;

    @MockitoBean
    private ReplaceInterconnectedPrescriptionUseCase replaceInterconnectedPrescriptionUseCase;

    @MockitoBean
    private CheckDrugInteractionUseCase checkDrugInteractionUseCase;

    @MockitoBean
    private CheckPatientDrugAllergyUseCase checkPatientDrugAllergyUseCase;

    @MockitoBean
    private CheckContraindicationUseCase checkContraindicationUseCase;

    @MockitoBean
    private CheckMaxDailyDoseUseCase checkMaxDailyDoseUseCase;

    @MockitoBean
    private GetPrescriptionAllergyWarningLogsUseCase getPrescriptionAllergyWarningLogsUseCase;

    @MockitoBean
    private ExportPrescriptionUseCase exportPrescriptionUseCase;

    @MockitoBean
    private SendPrescriptionInterconnectionUseCase sendPrescriptionInterconnectionUseCase;

    @MockitoBean
    private RetryPrescriptionInterconnectionUseCase retryPrescriptionInterconnectionUseCase;

    @MockitoBean
    private ReturnMedicationUseCase returnMedicationUseCase;

    @MockitoBean
    private CurrentUserPort currentUserPort;

    @MockitoBean
    private UserRepository userRepository;

    @MockitoBean
    private UserSessionRepository userSessionRepository;

    @MockitoBean
    private JwtTokenPort jwtTokenPort;

    @MockitoBean
    private ClockPort clockPort;

    @Test
    @DisplayName("GET /prescriptions - 200 with pending dispensing page")
    void searchReturnsPendingDispensingPage() throws Exception {
        UUID prescriptionId = UUID.randomUUID();
        PrescriptionResult prescription = new PrescriptionResult(
                prescriptionId,
                "RX-001",
                UUID.randomUUID(),
                UUID.randomUUID(),
                "VISIT-001",
                UUID.randomUUID(),
                "PAT-001",
                "Nguyen Van A",
                PrescriptionStatus.PENDING_DISPENSE,
                null,
                UUID.randomUUID(),
                "Dr. B",
                NOW,
                null,
                null,
                List.of(),
                List.of()
        );
        when(searchPrescriptionsUseCase.search(any()))
                .thenReturn(new PageImpl<>(
                        List.of(prescription),
                        PageRequest.of(0, 20),
                        1
                ));

        mockMvc.perform(get("/prescriptions")
                        .param("status", "PENDING_DISPENSE")
                        .param("page", "0")
                        .param("size", "20"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].id").value(prescriptionId.toString()))
                .andExpect(jsonPath("$.content[0].status").value("PENDING_DISPENSE"))
                .andExpect(jsonPath("$.content[0].patientName").value("Nguyen Van A"))
                .andExpect(jsonPath("$.totalElements").value(1));
    }

    @Test
    @DisplayName("GET /prescriptions/{id}/print returns a downloadable PDF")
    void printReturnsDownloadablePdf() throws Exception {
        UUID prescriptionId = UUID.randomUUID();
        byte[] pdf = "%PDF-1.7".getBytes(java.nio.charset.StandardCharsets.US_ASCII);
        when(exportPrescriptionUseCase.export(prescriptionId))
                .thenReturn(new com.benhsoan.port.dto.result.PrescriptionPrintResult(
                        "prescription-RX-001.pdf", "application/pdf", pdf));

        mockMvc.perform(get("/prescriptions/{id}/print", prescriptionId))
                .andExpect(status().isOk())
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.header()
                        .string("Content-Type", "application/pdf"))
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.header()
                        .string("Content-Disposition", "attachment; filename=\"prescription-RX-001.pdf\""))
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.content().bytes(pdf));
    }

    @Test
    @DisplayName("GET /prescriptions - 400 for invalid status")
    void searchRejectsInvalidStatus() throws Exception {
        mockMvc.perform(get("/prescriptions")
                        .param("status", "PENDING_DISPENSING"))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("POST /prescriptions/check-interactions - 200 OK with sorted warnings")
    void checkInteractionsReturnsWarnings() throws Exception {
        UUID aspirinId = UUID.randomUUID();
        UUID warfarinId = UUID.randomUUID();

        when(checkDrugInteractionUseCase.check(any()))
                .thenReturn(List.of(
                        new DrugInteractionWarningResult(
                                UUID.randomUUID(),
                                aspirinId,
                                warfarinId,
                                InteractionSeverity.SEVERE,
                                "Aspirin làm tăng nguy cơ chảy máu khi phối hợp với Warfarin.",
                                "Cân nhắc ngừng Aspirin."
                        )
                ));

        mockMvc.perform(post("/prescriptions/check-interactions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"drugIds":["%s","%s"]}
                                """.formatted(aspirinId, warfarinId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].drugIdA").value(aspirinId.toString()))
                .andExpect(jsonPath("$[0].drugIdB").value(warfarinId.toString()))
                .andExpect(jsonPath("$[0].severity").value("SEVERE"))
                .andExpect(jsonPath("$[0].description").value(
                        "Aspirin làm tăng nguy cơ chảy máu khi phối hợp với Warfarin."))
                .andExpect(jsonPath("$[0].clinicalRecommendation").value(
                        "Cân nhắc ngừng Aspirin."));
    }

    @Test
    @DisplayName("POST /prescriptions/check-interactions - 200 OK with empty array when no interaction")
    void checkInteractionsReturnsEmptyArray() throws Exception {
        when(checkDrugInteractionUseCase.check(any())).thenReturn(List.of());

        mockMvc.perform(post("/prescriptions/check-interactions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"drugIds":["%s","%s"]}
                                """.formatted(UUID.randomUUID(), UUID.randomUUID())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray())
                .andExpect(jsonPath("$").isEmpty());
    }

    @Test
    @DisplayName("POST /prescriptions/check-interactions - 400 when drugIds is empty")
    void checkInteractionsRejectsEmptyDrugIds() throws Exception {
        mockMvc.perform(post("/prescriptions/check-interactions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"drugIds":[]}
                                """))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("POST /prescriptions/check-interactions - 400 when drugIds is missing")
    void checkInteractionsRejectsMissingDrugIds() throws Exception {
        mockMvc.perform(post("/prescriptions/check-interactions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {}
                                """))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("POST /prescriptions - 400 when a required item field is missing or invalid")
    void createRejectsInvalidRequiredItemFields() throws Exception {
        UUID medicalRecordId = UUID.randomUUID();
        UUID medicineId = UUID.randomUUID();

        mockMvc.perform(post("/prescriptions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "medicalRecordId":"%s",
                                  "items":[{
                                    "medicineId":"%s",
                                    "dosage":"1 tablet",
                                    "frequency":-1,
                                    "route":"ORAL",
                                    "durationDays":5,
                                    "quantity":10
                                  }]
                                }
                                """.formatted(medicalRecordId, medicineId)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.details.fields['items[0].frequency']").exists());

        mockMvc.perform(post("/prescriptions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "medicalRecordId":"%s",
                                  "items":[{
                                    "medicineId":"%s",
                                    "dosage":"1 tablet",
                                    "frequency":2,
                                    "durationDays":5,
                                    "quantity":10
                                  }]
                                }
                                """.formatted(medicalRecordId, medicineId)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.details.fields['items[0].route']").exists());

        mockMvc.perform(post("/prescriptions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "medicalRecordId":"%s",
                                  "items":[{
                                    "medicineId":"%s",
                                    "dosage":"1 tablet",
                                    "frequency":2,
                                    "route":"ORAL",
                                    "quantity":10
                                  }]
                                }
                                """.formatted(medicalRecordId, medicineId)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.details.fields['items[0].durationDays']").exists());

        mockMvc.perform(post("/prescriptions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "medicalRecordId":"%s",
                                  "items":[{
                                    "medicineId":"%s",
                                    "frequency":2,
                                    "route":"ORAL",
                                    "durationDays":5,
                                    "quantity":10
                                  }]
                                }
                                """.formatted(medicalRecordId, medicineId)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.details.fields['items[0].dosage']").exists());

        verify(createPrescriptionUseCase, never()).create(any());
    }

    @Test
    @DisplayName("POST and PATCH /prescriptions report an invalid route by item field")
    void createAndAmendReportInvalidRouteByItemField() throws Exception {
        UUID medicalRecordId = UUID.randomUUID();
        UUID medicineId = UUID.randomUUID();
        String item = """
                {
                  "medicineId":"%s",
                  "dosage":"1 tablet",
                  "frequency":2,
                  "route":"INVALID_ROUTE",
                  "durationDays":5,
                  "quantity":10
                }
                """.formatted(medicineId);

        mockMvc.perform(post("/prescriptions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "medicalRecordId":"%s",
                                  "items":[%s]
                                }
                                """.formatted(medicalRecordId, item)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.details.fields['items[0].route']").exists());

        mockMvc.perform(patch("/prescriptions/{id}", UUID.randomUUID())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "changeReason":"Correct route",
                                  "items":[%s]
                                }
                                """.formatted(item)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.details.fields['items[0].route']").exists());
    }

    @Test
    @DisplayName("POST /prescriptions/{id}/dispense - 200 OK with allocation payload")
    void dispenseReturnsAllocationPayload() throws Exception {
        UUID prescriptionId = UUID.randomUUID();
        UUID medicineId = UUID.randomUUID();
        UUID batchId = UUID.randomUUID();
        UUID prescriptionItemId = UUID.randomUUID();
        UUID dispenseItemId = UUID.randomUUID();
        UUID doctorId = UUID.randomUUID();
        UUID patientId = UUID.randomUUID();
        UUID visitId = UUID.randomUUID();
        UUID medicalRecordId = UUID.randomUUID();
        UUID pharmacistId = UUID.randomUUID();

        PrescriptionResult prescription = new PrescriptionResult(
                prescriptionId,
                "RX-001",
                medicalRecordId,
                visitId,
                "VISIT-001",
                patientId,
                "PAT-001",
                "Nguyen Van A",
                PrescriptionStatus.DISPENSED,
                "Cap phat ngay",
                doctorId,
                "Dr. B",
                NOW.minusSeconds(3600),
                pharmacistId,
                NOW,
                List.of(new PrescriptionItemResult(
                        prescriptionItemId,
                        prescriptionId,
                        medicineId,
                        "Paracetamol",
                        "Paracetamol",
                        "500 mg",
                        "vien",
                        "1 vien",
                        2,
                        AdministrationRoute.ORAL,
                        5,
                        20,
                        20,
                        0,
                        "Sau an",
                        NOW.minusSeconds(3600),
                        NOW
                )),
                List.of()
        );

        when(dispensePrescriptionUseCase.dispense(any(DispensePrescriptionCommand.class)))
                .thenReturn(new DispensePrescriptionResult(
                        prescription,
                        pharmacistId,
                        NOW,
                        1,
                        20,
                        List.of(new DispenseAllocationResult(
                                dispenseItemId,
                                prescriptionItemId,
                                medicineId,
                                "MED-001",
                                "Paracetamol",
                                batchId,
                                "BATCH-001",
                                LocalDate.of(2026, 12, 31),
                                20,
                                15
                        ))
                ));

        mockMvc.perform(post("/prescriptions/{id}/dispense", prescriptionId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.prescription.id").value(prescriptionId.toString()))
                .andExpect(jsonPath("$.prescription.status").value("DISPENSED"))
                .andExpect(jsonPath("$.dispensedBy").value(pharmacistId.toString()))
                .andExpect(jsonPath("$.allocationCount").value(1))
                .andExpect(jsonPath("$.totalDispensedQuantity").value(20))
                .andExpect(jsonPath("$.allocations[0].batchNumber").value("BATCH-001"))
                .andExpect(jsonPath("$.allocations[0].dispensedQuantity").value(20))
                .andExpect(jsonPath("$.allocations[0].batchQuantityRemaining").value(15));
    }

    @Test
    @DisplayName("POST /prescriptions/{id}/interconnection returns submission status")
    void sendToInterconnectionReturnsSubmissionStatus() throws Exception {
        UUID prescriptionId = UUID.randomUUID();
        when(sendPrescriptionInterconnectionUseCase.send(prescriptionId)).thenReturn(
                new PrescriptionInterconnectionResult(
                        prescriptionId, "RX000001", InterconnectionStatus.SUCCESS,
                        "LT-20260821-000001", null, NOW));

        mockMvc.perform(post("/prescriptions/{id}/interconnection", prescriptionId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.prescriptionId").value(prescriptionId.toString()))
                .andExpect(jsonPath("$.status").value("SUCCESS"))
                .andExpect(jsonPath("$.receiptCode").value("LT-20260821-000001"));
    }

    @Test
    @DisplayName("POST /prescriptions/{id}/interconnection/retry returns retry status")
    void retryInterconnectionReturnsSubmissionStatus() throws Exception {
        UUID prescriptionId = UUID.randomUUID();
        when(retryPrescriptionInterconnectionUseCase.retry(prescriptionId)).thenReturn(
                new PrescriptionInterconnectionResult(
                        prescriptionId, "RX000001", InterconnectionStatus.FAILED,
                        null, "Gateway unavailable", NOW));

        mockMvc.perform(post("/prescriptions/{id}/interconnection/retry", prescriptionId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.prescriptionId").value(prescriptionId.toString()))
                .andExpect(jsonPath("$.status").value("FAILED"))
                .andExpect(jsonPath("$.failureReason").value("Gateway unavailable"));
    }

    @Test
    @DisplayName("POST /prescriptions/check-allergy-warnings returns allergy warnings")
    void checkAllergyWarningsReturnsWarnings() throws Exception {
        UUID allergyId = UUID.randomUUID();
        UUID medicineId = UUID.randomUUID();
        UUID patientId = UUID.randomUUID();
        UUID medicalRecordId = UUID.randomUUID();
        when(checkPatientDrugAllergyUseCase.check(any(), any())).thenReturn(List.of(
                new PatientAllergyWarningResult(
                        allergyId,
                        patientId,
                        medicineId,
                        "Amoxicillin 500mg",
                        "Amoxicillin",
                        "Amoxicillin",
                        AllergySeverity.SEVERE,
                        "Anaphylactic shock"
                )
        ));

        mockMvc.perform(post("/prescriptions/check-allergy-warnings")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "medicalRecordId": "%s",
                                  "medicineIds": ["%s"]
                                }
                                """.formatted(medicalRecordId, medicineId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].allergyId").value(allergyId.toString()))
                .andExpect(jsonPath("$[0].medicineId").value(medicineId.toString()))
                .andExpect(jsonPath("$[0].allergenName").value("Amoxicillin"))
                .andExpect(jsonPath("$[0].severity").value("SEVERE"));
    }

    @Test
    @DisplayName("POST /prescriptions/check-allergy-warnings with null medicineId returns 400 Bad Request")
    void checkAllergyWarningsWithNullMedicineIdReturnsBadRequest() throws Exception {
        UUID medicalRecordId = UUID.randomUUID();

        mockMvc.perform(post("/prescriptions/check-allergy-warnings")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "medicalRecordId": "%s",
                                  "medicineIds": [null]
                                }
                                """.formatted(medicalRecordId)))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("GET /prescriptions/allergy-warning-logs returns paged logs")
    void getAllergyWarningLogsReturnsPage() throws Exception {
        UUID logId = UUID.randomUUID();
        UUID prescriptionId = UUID.randomUUID();
        when(getPrescriptionAllergyWarningLogsUseCase.search(any())).thenReturn(
                new PageImpl<>(List.of(
                        new PrescriptionAllergyWarningLogResult(
                                logId,
                                prescriptionId,
                                "RX000001",
                                UUID.randomUUID(),
                                "PAT-001",
                                "Nguyen Van A",
                                UUID.randomUUID(),
                                "Dr. Nguyen",
                                UUID.randomUUID(),
                                "Amoxicillin 500mg",
                                "Amoxicillin",
                                "Amoxicillin",
                                AllergySeverity.SEVERE,
                                "Anaphylaxis",
                                "Critical benefit outweighs risk",
                                NOW
                        )
                ), PageRequest.of(0, 20), 1)
        );

        mockMvc.perform(get("/prescriptions/allergy-warning-logs")
                        .param("page", "0")
                        .param("size", "20"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].id").value(logId.toString()))
                .andExpect(jsonPath("$.content[0].prescriptionId").value(prescriptionId.toString()))
                .andExpect(jsonPath("$.content[0].allergenName").value("Amoxicillin"))
                .andExpect(jsonPath("$.content[0].severity").value("SEVERE"))
                .andExpect(jsonPath("$.totalElements").value(1));
    }

    @Test
    @DisplayName("POST /prescriptions - 409 Conflict when allergy confirmation required")
    void createPrescriptionThrowsAllergyConfirmationRequiredReturns409() throws Exception {
        UUID medicalRecordId = UUID.randomUUID();
        UUID medicineId = UUID.randomUUID();
        UUID allergyId = UUID.randomUUID();
        UUID patientId = UUID.randomUUID();

        when(createPrescriptionUseCase.create(any()))
                .thenThrow(new PrescriptionAllergyConfirmationRequiredException(List.of(
                        new PrescriptionAllergyConfirmationRequiredException.AllergyWarning(
                                allergyId,
                                patientId,
                                medicineId,
                                "Amoxicillin 500mg",
                                "Amoxicillin",
                                "Amoxicillin",
                                AllergySeverity.SEVERE,
                                "Anaphylaxis"
                        )
                )));

        mockMvc.perform(post("/prescriptions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "medicalRecordId": "%s",
                                  "items": [{
                                    "medicineId": "%s",
                                    "dosage": "1 tablet",
                                    "frequency": 2,
                                    "route": "ORAL",
                                    "durationDays": 5,
                                    "quantity": 10
                                  }]
                                }
                                """.formatted(medicalRecordId, medicineId)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("ALLERGY_CONFIRMATION_REQUIRED"))
                .andExpect(jsonPath("$.details.warnings[0].allergyId").value(allergyId.toString()))
                .andExpect(jsonPath("$.details.warnings[0].allergenName").value("Amoxicillin"))
                .andExpect(jsonPath("$.details.warnings[0].severity").value("SEVERE"));
    }

    @Test
    @DisplayName("PATCH /prescriptions/{id} - 409 Conflict when allergy confirmation required")
    void amendPrescriptionThrowsAllergyConfirmationRequiredReturns409() throws Exception {
        UUID prescriptionId = UUID.randomUUID();
        UUID medicineId = UUID.randomUUID();
        UUID allergyId = UUID.randomUUID();
        UUID patientId = UUID.randomUUID();

        when(amendPrescriptionUseCase.amend(any()))
                .thenThrow(new PrescriptionAllergyConfirmationRequiredException(List.of(
                        new PrescriptionAllergyConfirmationRequiredException.AllergyWarning(
                                allergyId,
                                patientId,
                                medicineId,
                                "Amoxicillin 500mg",
                                "Amoxicillin",
                                "Amoxicillin",
                                AllergySeverity.SEVERE,
                                "Anaphylaxis"
                        )
                )));

        mockMvc.perform(patch("/prescriptions/{id}", prescriptionId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "changeReason": "Dose adjustment",
                                  "items": [{
                                    "medicineId": "%s",
                                    "dosage": "2 tablets",
                                    "frequency": 2,
                                    "route": "ORAL",
                                    "durationDays": 5,
                                    "quantity": 10
                                  }]
                                }
                                """.formatted(medicineId)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("ALLERGY_CONFIRMATION_REQUIRED"))
                .andExpect(jsonPath("$.details.warnings[0].allergyId").value(allergyId.toString()))
                .andExpect(jsonPath("$.details.warnings[0].allergenName").value("Amoxicillin"))
                .andExpect(jsonPath("$.details.warnings[0].severity").value("SEVERE"));
    }

    @Test
    @DisplayName("FINDING-02: GET /prescriptions/allergy-warning-logs masks patient name when anonymization is enabled")
    void getAllergyWarningLogsWhenAnonymizationEnabledReturnsMaskedPatientName() throws Exception {
        anonymizationModeState.setEnabled(true);
        try {
            UUID logId = UUID.randomUUID();
            UUID prescriptionId = UUID.randomUUID();
            when(getPrescriptionAllergyWarningLogsUseCase.search(any())).thenReturn(
                    new PageImpl<>(List.of(
                            new PrescriptionAllergyWarningLogResult(
                                    logId,
                                    prescriptionId,
                                    "RX000001",
                                    UUID.randomUUID(),
                                    "PAT-001",
                                    "Nguyen Van A",
                                    UUID.randomUUID(),
                                    "Dr. Nguyen",
                                    UUID.randomUUID(),
                                    "Amoxicillin 500mg",
                                    "Amoxicillin",
                                    "Amoxicillin",
                                    AllergySeverity.SEVERE,
                                    "Anaphylaxis",
                                    "Critical benefit outweighs risk",
                                    NOW
                            )
                    ), PageRequest.of(0, 20), 1)
            );

            mockMvc.perform(get("/prescriptions/allergy-warning-logs")
                            .param("page", "0")
                            .param("size", "20"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.content[0].patientName").value("BỆNH NHÂN #PAT-001"))
                    .andExpect(jsonPath("$.content[0].patientCode").value("PAT-001"));
        } finally {
            anonymizationModeState.setEnabled(false);
        }
    }

    @Test
    @DisplayName("POST /prescriptions/{id}/cancel - 200 cancels prescription with valid reason (TC-01, QTN-27)")
    void cancel_returns200WithCancelledPrescription() throws Exception {
        UUID prescriptionId = UUID.randomUUID();
        PrescriptionResult cancelledResult = new PrescriptionResult(
                prescriptionId, "RX000001", UUID.randomUUID(), UUID.randomUUID(), "VISIT-001",
                UUID.randomUUID(), "PAT-001", "Nguyen Van A", PrescriptionStatus.CANCELLED,
                "Clinical note", "Bệnh nhân đổi phác đồ điều trị", UUID.randomUUID(), "Dr. B",
                NOW, UUID.randomUUID(), NOW.plusSeconds(300), List.of(), List.of()
        );

        when(cancelPrescriptionUseCase.cancel(any(CancelPrescriptionCommand.class))).thenReturn(cancelledResult);

        String requestBody = """
                {
                  "cancelReason": "Bệnh nhân đổi phác đồ điều trị"
                }
                """;

        mockMvc.perform(post("/prescriptions/{id}/cancel", prescriptionId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(requestBody))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(prescriptionId.toString()))
                .andExpect(jsonPath("$.status").value("CANCELLED"))
                .andExpect(jsonPath("$.cancelReason").value("Bệnh nhân đổi phác đồ điều trị"))
                .andExpect(jsonPath("$.note").value("Clinical note"));
    }

    @Test
    @DisplayName("POST /prescriptions/{id}/cancel - 400 when cancel reason is missing or blank (TC-02, QTN-27)")
    void cancel_returns400WhenMissingReason() throws Exception {
        UUID prescriptionId = UUID.randomUUID();

        // Empty json
        mockMvc.perform(post("/prescriptions/{id}/cancel", prescriptionId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isBadRequest());

        // Blank cancelReason
        mockMvc.perform(post("/prescriptions/{id}/cancel", prescriptionId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"cancelReason\":\"   \"}"))
                .andExpect(status().isBadRequest());

        verify(cancelPrescriptionUseCase, never()).cancel(any(CancelPrescriptionCommand.class));
    }

    @Test
    @DisplayName("POST /prescriptions/{id}/cancel - 409 when prescription already dispensed (TC-03, QTN-27)")
    void cancel_returns409WhenAlreadyDispensed() throws Exception {
        UUID prescriptionId = UUID.randomUUID();
        when(cancelPrescriptionUseCase.cancel(any(CancelPrescriptionCommand.class)))
                .thenThrow(new PrescriptionAlreadyDispensedException());

        String requestBody = """
                {
                  "cancelReason": "Bệnh nhân muốn đổi thuốc"
                }
                """;

        mockMvc.perform(post("/prescriptions/{id}/cancel", prescriptionId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(requestBody))
                .andExpect(status().isConflict());
    }

    @Test
    @DisplayName("POST /prescriptions/{id}/cancel - 404 when prescription not found")
    void cancel_returns404WhenNotFound() throws Exception {
        UUID prescriptionId = UUID.randomUUID();
        when(cancelPrescriptionUseCase.cancel(any(CancelPrescriptionCommand.class)))
                .thenThrow(new PrescriptionNotFoundException(prescriptionId));

        String requestBody = """
                {
                  "cancelReason": "Lý do hủy"
                }
                """;

        mockMvc.perform(post("/prescriptions/{id}/cancel", prescriptionId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(requestBody))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("POST /prescriptions/{id}/cancel - 403 when unauthorized doctor attempts cancellation (P3-02, TC-04)")
    void cancel_returns403WhenUnauthorizedDoctor() throws Exception {
        UUID prescriptionId = UUID.randomUUID();
        when(cancelPrescriptionUseCase.cancel(any(CancelPrescriptionCommand.class)))
                .thenThrow(new com.benhsoan.domain.prescription.exception.UnauthorizedPrescriptionCancellationException());

        String requestBody = """
                {
                  "cancelReason": "Lý do hủy"
                }
                """;

        mockMvc.perform(post("/prescriptions/{id}/cancel", prescriptionId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(requestBody))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("UNAUTHORIZED_PRESCRIPTION_CANCELLATION"));
    }

    @Test
    @DisplayName("POST /prescriptions/{id}/partial-dispense - 200 with partial dispense result")
    void partialDispense_returnsResult() throws Exception {
        UUID prescriptionId = UUID.randomUUID();
        UUID pharmacistId = UUID.randomUUID();
        PrescriptionResult prescription = pendingPrescription(prescriptionId);
        when(dispensePrescriptionItemsUseCase.dispense(any()))
                .thenReturn(new PartialDispensePrescriptionResult(
                        prescription, pharmacistId, NOW, List.of(), List.of()));

        mockMvc.perform(post("/prescriptions/{id}/partial-dispense", prescriptionId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"items\":[]}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.prescription.id").value(prescriptionId.toString()))
                .andExpect(jsonPath("$.dispensedBy").value(pharmacistId.toString()));
    }

    @Test
    @DisplayName("GET /prescriptions/{id}/dispense-history - 200 with history list")
    void getDispenseHistory_returnsList() throws Exception {
        UUID prescriptionId = UUID.randomUUID();
        UUID itemId = UUID.randomUUID();
        UUID medicineId = UUID.randomUUID();
        UUID batchId = UUID.randomUUID();
        UUID dispenserId = UUID.randomUUID();
        when(getPrescriptionDispenseHistoryUseCase.getHistory(prescriptionId))
                .thenReturn(List.of(new PrescriptionDispenseHistoryResult(
                        UUID.randomUUID(), prescriptionId, itemId, medicineId, batchId,
                        12, dispenserId, NOW,
                        "Paracetamol", "BATCH-A", "Vo Thanh Nam")));

        mockMvc.perform(get("/prescriptions/{id}/dispense-history", prescriptionId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].prescriptionItemId").value(itemId.toString()))
                .andExpect(jsonPath("$[0].medicineBatchId").value(batchId.toString()))
                .andExpect(jsonPath("$[0].dispensedQuantity").value(12))
                .andExpect(jsonPath("$[0].medicineName").value("Paracetamol"))
                .andExpect(jsonPath("$[0].batchNumber").value("BATCH-A"))
                .andExpect(jsonPath("$[0].dispenserName").value("Vo Thanh Nam"));
    }

    private PrescriptionResult pendingPrescription(UUID prescriptionId) {
        return new PrescriptionResult(
                prescriptionId, "RX-001", UUID.randomUUID(), UUID.randomUUID(), "VISIT-001",
                UUID.randomUUID(), "PAT-001", "Nguyen Van A", PrescriptionStatus.PENDING_DISPENSE,
                null, UUID.randomUUID(), "Dr. B", NOW, null, null, List.of(), List.of());
    }

    @Test
    @DisplayName("POST /prescriptions/{id}/replacement - 201 issues the replacement and replaces the original")
    void replacement_returns201WithBothPrescriptions() throws Exception {
        UUID originalId = UUID.randomUUID();
        UUID replacementId = UUID.randomUUID();
        PrescriptionResult original = replacedPrescription(originalId);
        PrescriptionResult replacement = new PrescriptionResult(
                replacementId, "RX-002", UUID.randomUUID(), UUID.randomUUID(), "VISIT-001",
                UUID.randomUUID(), "PAT-001", "Nguyen Van A", PrescriptionStatus.PENDING_DISPENSE,
                null, UUID.randomUUID(), "Dr. B", NOW, null, null, List.of(), List.of())
                .withReplacementLink(originalId, "RX-001", "Sai liều lượng", null, null);
        PrescriptionInterconnectionResult interconnection = new PrescriptionInterconnectionResult(
                replacementId, "RX-002", InterconnectionStatus.SUCCESS, "LT-20260925-000123", null, NOW);

        when(replaceInterconnectedPrescriptionUseCase.replace(any(ReplacePrescriptionCommand.class)))
                .thenReturn(new PrescriptionReplacementResult(original, replacement, interconnection));

        mockMvc.perform(post("/prescriptions/{id}/replacement", originalId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(replacementRequestBody()))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.originalPrescription.id").value(originalId.toString()))
                .andExpect(jsonPath("$.originalPrescription.status").value("REPLACED"))
                .andExpect(jsonPath("$.replacementPrescription.id").value(replacementId.toString()))
                .andExpect(jsonPath("$.replacementPrescription.prescriptionCode").value("RX-002"))
                .andExpect(jsonPath("$.replacementPrescription.replacesPrescriptionId")
                        .value(originalId.toString()))
                .andExpect(jsonPath("$.replacementPrescription.replacesPrescriptionCode").value("RX-001"))
                .andExpect(jsonPath("$.replacementPrescription.replacementReason").value("Sai liều lượng"))
                .andExpect(jsonPath("$.interconnection.status").value("SUCCESS"))
                .andExpect(jsonPath("$.interconnection.receiptCode").value("LT-20260925-000123"));

        ArgumentCaptor<ReplacePrescriptionCommand> captor =
                ArgumentCaptor.forClass(ReplacePrescriptionCommand.class);
        verify(replaceInterconnectedPrescriptionUseCase).replace(captor.capture());
        assertEquals(originalId, captor.getValue().originalPrescriptionId());
        assertEquals("Sai liều lượng", captor.getValue().replacementReason());
        assertNull(captor.getValue().prescription().medicalRecordId());
    }

    @Test
    @DisplayName("POST /prescriptions/{id}/replacement - 400 when the replacement reason is missing")
    void replacement_returns400WhenReasonIsMissing() throws Exception {
        UUID originalId = UUID.randomUUID();

        mockMvc.perform(post("/prescriptions/{id}/replacement", originalId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "items": [
                                    { "medicineId": "%s", "dosage": "1 vien", "frequency": 2,
                                      "route": "ORAL", "durationDays": 5, "quantity": 10 }
                                  ]
                                }
                                """.formatted(UUID.randomUUID())))
                .andExpect(status().isBadRequest());

        verify(replaceInterconnectedPrescriptionUseCase, never()).replace(any());
    }

    @Test
    @DisplayName("POST /prescriptions/{id}/replacement - 400 when no medicine is supplied")
    void replacement_returns400WhenItemsAreEmpty() throws Exception {
        UUID originalId = UUID.randomUUID();

        mockMvc.perform(post("/prescriptions/{id}/replacement", originalId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "replacementReason": "Sai liều lượng",
                                  "items": []
                                }
                                """))
                .andExpect(status().isBadRequest());

        verify(replaceInterconnectedPrescriptionUseCase, never()).replace(any());
    }

    @Test
    @DisplayName("POST /prescriptions/{id}/replacement - 404 when the original prescription is unknown")
    void replacement_returns404WhenOriginalIsUnknown() throws Exception {
        UUID originalId = UUID.randomUUID();
        when(replaceInterconnectedPrescriptionUseCase.replace(any(ReplacePrescriptionCommand.class)))
                .thenThrow(new PrescriptionNotFoundException(originalId));

        mockMvc.perform(post("/prescriptions/{id}/replacement", originalId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(replacementRequestBody()))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("POST /prescriptions/{id}/replacement - 409 when the original cannot be replaced")
    void replacement_returns409WhenOriginalCannotBeReplaced() throws Exception {
        UUID originalId = UUID.randomUUID();
        when(replaceInterconnectedPrescriptionUseCase.replace(any(ReplacePrescriptionCommand.class)))
                .thenThrow(new PrescriptionInvalidStatusException(
                        "Only successfully interconnected prescriptions can be replaced."));

        mockMvc.perform(post("/prescriptions/{id}/replacement", originalId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(replacementRequestBody()))
                .andExpect(status().isConflict());
    }

    @Test
    @DisplayName("POST /prescriptions/{id}/replacement - 409 when the original was already dispensed (TC-02)")
    void replacement_returns409WhenOriginalWasDispensed() throws Exception {
        UUID originalId = UUID.randomUUID();
        when(replaceInterconnectedPrescriptionUseCase.replace(any(ReplacePrescriptionCommand.class)))
                .thenThrow(new PrescriptionAlreadyDispensedException(
                        "Dispensed prescriptions cannot be replaced. "
                                + "Please prescribe a new prescription for the visit instead."));

        mockMvc.perform(post("/prescriptions/{id}/replacement", originalId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(replacementRequestBody()))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("PRESCRIPTION_ALREADY_DISPENSED"));
    }

    @Test
    @DisplayName("POST /prescriptions/{id}/replacement - 403 when the doctor does not own the prescription")
    void replacement_returns403WhenAnotherDoctorsPrescription() throws Exception {
        UUID originalId = UUID.randomUUID();
        when(replaceInterconnectedPrescriptionUseCase.replace(any(ReplacePrescriptionCommand.class)))
                .thenThrow(new UnauthorizedPrescriptionReplacementException());

        mockMvc.perform(post("/prescriptions/{id}/replacement", originalId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(replacementRequestBody()))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("UNAUTHORIZED_PRESCRIPTION_REPLACEMENT"));
    }

    @Test
    @DisplayName("POST /prescriptions/{id}/replacement - 403 when the caller is not a doctor")
    void replacement_returns403WhenCallerIsNotADoctor() throws Exception {
        UUID originalId = UUID.randomUUID();
        when(replaceInterconnectedPrescriptionUseCase.replace(any(ReplacePrescriptionCommand.class)))
                .thenThrow(new AccessDeniedException("Only doctors can replace prescriptions."));

        mockMvc.perform(post("/prescriptions/{id}/replacement", originalId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(replacementRequestBody()))
                .andExpect(status().isForbidden());
    }

    private String replacementRequestBody() {
        return """
                {
                  "replacementReason": "Sai liều lượng",
                  "note": "Đơn thay thế",
                  "items": [
                    { "medicineId": "%s", "dosage": "1 vien", "frequency": 2,
                      "route": "ORAL", "durationDays": 5, "quantity": 10 }
                  ]
                }
                """.formatted(UUID.randomUUID());
    }

    private PrescriptionResult replacedPrescription(UUID prescriptionId) {
        return new PrescriptionResult(
                prescriptionId, "RX-001", UUID.randomUUID(), UUID.randomUUID(), "VISIT-001",
                UUID.randomUUID(), "PAT-001", "Nguyen Van A", PrescriptionStatus.REPLACED,
                null, UUID.randomUUID(), "Dr. B", NOW, null, null, List.of(), List.of());
    }

    @Test
    @DisplayName("GET /prescriptions/code/{code} - 200 with pending prescription for dispensation (TC-01)")
    void getByCode_whenFoundPending_returnsPrescriptionResponse() throws Exception {
        UUID prescriptionId = UUID.randomUUID();
        String code = "RX000003";
        PrescriptionResult result = new PrescriptionResult(
                prescriptionId, code, UUID.randomUUID(), UUID.randomUUID(), "VISIT-001",
                UUID.randomUUID(), "PAT-001", "Nguyen Van A", PrescriptionStatus.PENDING_DISPENSE,
                "Uong sau an", UUID.randomUUID(), "Dr. B", NOW, null, null, List.of(), List.of());
        when(getPrescriptionByCodeUseCase.getByCode(code)).thenReturn(result);

        mockMvc.perform(get("/prescriptions/code/{prescriptionCode}", code))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(prescriptionId.toString()))
                .andExpect(jsonPath("$.prescriptionCode").value(code))
                .andExpect(jsonPath("$.status").value("PENDING_DISPENSE"))
                .andExpect(jsonPath("$.patientName").value("Nguyen Van A"));
    }

    @Test
    @DisplayName("GET /prescriptions/code/{code} - 200 with cancelled prescription and reason (TC-02)")
    void getByCode_whenFoundCancelled_returnsPrescriptionWithCancelReason() throws Exception {
        UUID prescriptionId = UUID.randomUUID();
        String code = "RX000004";
        PrescriptionResult result = new PrescriptionResult(
                prescriptionId, code, UUID.randomUUID(), UUID.randomUUID(), "VISIT-002",
                UUID.randomUUID(), "PAT-002", "Tran Thi C", PrescriptionStatus.CANCELLED,
                null, "Bac si doi phac do dieu tri", UUID.randomUUID(), "Dr. D", NOW, UUID.randomUUID(), NOW, List.of(), List.of());
        when(getPrescriptionByCodeUseCase.getByCode(code)).thenReturn(result);

        mockMvc.perform(get("/prescriptions/code/{prescriptionCode}", code))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(prescriptionId.toString()))
                .andExpect(jsonPath("$.prescriptionCode").value(code))
                .andExpect(jsonPath("$.status").value("CANCELLED"))
                .andExpect(jsonPath("$.cancelReason").value("Bac si doi phac do dieu tri"));
    }

    @Test
    @DisplayName("GET /prescriptions/code/{code} - 404 when prescription code does not exist (TC-03)")
    void getByCode_whenNotFound_returns404() throws Exception {
        String code = "RX999999";
        when(getPrescriptionByCodeUseCase.getByCode(code))
                .thenThrow(new PrescriptionNotFoundException(code));

        mockMvc.perform(get("/prescriptions/code/{prescriptionCode}", code))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("PRESCRIPTION_NOT_FOUND"));
    }

    @Test
    @DisplayName("GET /prescriptions/code/{code} - 200 with URL-encoded whitespace in path variable")
    void getByCode_whenUrlEncoded_handlesCorrectly() throws Exception {
        UUID prescriptionId = UUID.randomUUID();
        String code = "RX000003";
        PrescriptionResult result = new PrescriptionResult(
                prescriptionId, code, UUID.randomUUID(), UUID.randomUUID(), "VISIT-001",
                UUID.randomUUID(), "PAT-001", "Nguyen Van A", PrescriptionStatus.PENDING_DISPENSE,
                "Uong sau an", UUID.randomUUID(), "Dr. B", NOW, null, null, List.of(), List.of());
        when(getPrescriptionByCodeUseCase.getByCode("RX000003 ")).thenReturn(result);

        mockMvc.perform(get("/prescriptions/code/{prescriptionCode}", "RX000003 "))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(prescriptionId.toString()))
                .andExpect(jsonPath("$.prescriptionCode").value(code));
    }

    @Test
    @DisplayName("GET /prescriptions/code/{code} - 404 when code format is malformed (P3 Fast-fail)")
    void getByCode_whenMalformedFormat_returns404() throws Exception {
        String malformedCode = "INVALID_CODE";
        when(getPrescriptionByCodeUseCase.getByCode(malformedCode))
                .thenThrow(new PrescriptionNotFoundException(malformedCode));

        mockMvc.perform(get("/prescriptions/code/{prescriptionCode}", malformedCode))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("PRESCRIPTION_NOT_FOUND"));
    }

}
