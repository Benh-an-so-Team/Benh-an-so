package com.benhsoan.adapter.inbound.rest.controller;

import java.util.List;
import java.util.UUID;

import org.springframework.data.domain.Page;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.benhsoan.adapter.inbound.rest.mapper.PrescriptionRestMapper;
import com.benhsoan.adapter.inbound.rest.request.prescription.AmendPrescriptionRequest;
import com.benhsoan.adapter.inbound.rest.request.prescription.CancelPrescriptionRequest;
import com.benhsoan.adapter.inbound.rest.request.prescription.CheckDrugInteractionRequest;
import com.benhsoan.adapter.inbound.rest.request.prescription.CheckContraindicationRequest;
import com.benhsoan.adapter.inbound.rest.request.prescription.CheckMaxDailyDoseRequest;
import com.benhsoan.adapter.inbound.rest.request.prescription.CreatePrescriptionRequest;
import com.benhsoan.adapter.inbound.rest.request.prescription.DispensePrescriptionRequest;
import com.benhsoan.adapter.inbound.rest.request.prescription.PartialDispensePrescriptionRequest;
import com.benhsoan.adapter.inbound.rest.request.prescription.ReturnMedicationRequest;
import com.benhsoan.adapter.inbound.rest.response.prescription.ContraindicationCheckResponse;
import com.benhsoan.adapter.inbound.rest.response.prescription.MaxDailyDoseCheckResponse;
import com.benhsoan.adapter.inbound.rest.response.prescription.DispenseHistoryResponse;
import com.benhsoan.adapter.inbound.rest.response.prescription.DispensePrescriptionResponse;
import com.benhsoan.adapter.inbound.rest.response.prescription.DispenseSuggestionResponse;
import com.benhsoan.adapter.inbound.rest.response.prescription.DrugInteractionWarningResponse;
import com.benhsoan.adapter.inbound.rest.response.prescription.PartialDispensePrescriptionResponse;
import com.benhsoan.adapter.inbound.rest.response.prescription.PrescriptionResponse;
import com.benhsoan.adapter.inbound.rest.response.prescription.ReturnMedicationResponse;
import com.benhsoan.domain.prescription.enums.PrescriptionStatus;
import com.benhsoan.infrastructure.security.annotation.RequirePermission;
import com.benhsoan.port.dto.command.prescription.SearchPrescriptionsQuery;
import com.benhsoan.port.dto.result.PrescriptionResult;
import com.benhsoan.port.inbound.prescription.AmendPrescriptionUseCase;
import com.benhsoan.port.inbound.prescription.CancelPrescriptionUseCase;
import com.benhsoan.port.inbound.prescription.CheckDrugInteractionUseCase;
import com.benhsoan.port.inbound.prescription.CheckContraindicationUseCase;
import com.benhsoan.port.inbound.prescription.CheckMaxDailyDoseUseCase;
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
import com.benhsoan.port.inbound.prescription.ReturnMedicationUseCase;
import com.benhsoan.port.dto.result.PrescriptionInterconnectionResult;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;

import jakarta.validation.Valid;
import com.benhsoan.adapter.inbound.rest.request.prescription.CheckPatientDrugAllergyRequest;
import com.benhsoan.adapter.inbound.rest.response.prescription.PatientAllergyWarningResponse;
import com.benhsoan.adapter.inbound.rest.response.prescription.PrescriptionAllergyWarningLogResponse;
import com.benhsoan.port.dto.command.prescription.SearchPrescriptionAllergyWarningLogsQuery;
import com.benhsoan.port.inbound.prescription.CheckPatientDrugAllergyUseCase;
import com.benhsoan.port.inbound.prescription.GetPrescriptionAllergyWarningLogsUseCase;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/prescriptions")
@RequiredArgsConstructor
@Validated
public class PrescriptionController {

        private final CreatePrescriptionUseCase createPrescriptionUseCase;

        private final AmendPrescriptionUseCase amendPrescriptionUseCase;
        private final GetPrescriptionUseCase getPrescriptionUseCase;
        private final GetPrescriptionByCodeUseCase getPrescriptionByCodeUseCase;
        private final GetPrescriptionsByMedicalRecordUseCase getPrescriptionsByMedicalRecordUseCase;
        private final SearchPrescriptionsUseCase searchPrescriptionsUseCase;
        private final DispensePrescriptionUseCase dispensePrescriptionUseCase;
        private final DispensePrescriptionItemsUseCase dispensePrescriptionItemsUseCase;
        private final GetPrescriptionDispenseHistoryUseCase getPrescriptionDispenseHistoryUseCase;
        private final GetDispenseSuggestionUseCase getDispenseSuggestionUseCase;
        private final CancelPrescriptionUseCase cancelPrescriptionUseCase;
        private final CheckDrugInteractionUseCase checkDrugInteractionUseCase;
        private final CheckPatientDrugAllergyUseCase checkPatientDrugAllergyUseCase;
        private final CheckContraindicationUseCase checkContraindicationUseCase;
        private final CheckMaxDailyDoseUseCase checkMaxDailyDoseUseCase;
        private final GetPrescriptionAllergyWarningLogsUseCase getPrescriptionAllergyWarningLogsUseCase;
        private final ExportPrescriptionUseCase exportPrescriptionUseCase;
        private final SendPrescriptionInterconnectionUseCase sendPrescriptionInterconnectionUseCase;
        private final RetryPrescriptionInterconnectionUseCase retryPrescriptionInterconnectionUseCase;
        private final ReturnMedicationUseCase returnMedicationUseCase;

        private final PrescriptionRestMapper mapper;

        @GetMapping
        @RequirePermission("PRESCRIPTION_READ")
        public Page<PrescriptionResponse> search(
                        @RequestParam PrescriptionStatus status,
                        @RequestParam(defaultValue = "0") int page,
                        @RequestParam(defaultValue = "20") int size) {
                return searchPrescriptionsUseCase.search(new SearchPrescriptionsQuery(status, page, size))
                                .map(mapper::toResponse);
        }

        @PostMapping
        @ResponseStatus(HttpStatus.CREATED)
        @RequirePermission("PRESCRIPTION_CREATE")
        public PrescriptionResponse create(
                        @Valid @RequestBody CreatePrescriptionRequest request) {
                PrescriptionResult result = createPrescriptionUseCase.create(
                                mapper.toCommand(request));

                return mapper.toResponse(result);
        }

        @PatchMapping("/{id}")
        @RequirePermission("PRESCRIPTION_UPDATE")
        public PrescriptionResponse amend(
                        @PathVariable UUID id,
                        @Valid @RequestBody AmendPrescriptionRequest request) {
                PrescriptionResult result = amendPrescriptionUseCase.amend(
                                mapper.toCommand(id, request));

                return mapper.toResponse(result);
        }

        @GetMapping("/{id}")
        @RequirePermission("PRESCRIPTION_READ")
        public PrescriptionResponse getById(@PathVariable UUID id) {
                return mapper.toResponse(getPrescriptionUseCase.getById(id));
        }

        @GetMapping("/code/{prescriptionCode}")
        @RequirePermission("PRESCRIPTION_READ")
        @Operation(summary = "Tra cứu đơn thuốc bằng mã đơn khi cấp phát")
        @ApiResponse(responseCode = "200", description = "Tìm thấy đơn thuốc tương ứng")
        @ApiResponse(responseCode = "400", description = "Mã đơn thuốc không hợp lệ")
        @ApiResponse(responseCode = "403", description = "Không có quyền đọc đơn thuốc")
        @ApiResponse(responseCode = "404", description = "Không tìm thấy đơn thuốc theo mã")
        public PrescriptionResponse getByCode(@PathVariable String prescriptionCode) {
                return mapper.toResponse(getPrescriptionByCodeUseCase.getByCode(prescriptionCode));
        }

        @GetMapping("/{id}/print")
        @RequirePermission("PRESCRIPTION_PRINT")
        public ResponseEntity<ByteArrayResource> print(@PathVariable UUID id) {
                var printResult = exportPrescriptionUseCase.export(id);
                return ResponseEntity.ok()
                                .header(HttpHeaders.CONTENT_DISPOSITION,
                                                "attachment; filename=\"" + printResult.fileName() + "\"")
                                .contentType(MediaType.parseMediaType(printResult.contentType()))
                                .contentLength(printResult.content().length)
                                .body(new ByteArrayResource(printResult.content()));
        }

        @GetMapping("/medical-records/{medicalRecordId}")
        @RequirePermission("PRESCRIPTION_READ")
        public java.util.List<PrescriptionResponse> getByMedicalRecordId(
                        @PathVariable UUID medicalRecordId) {
                return getPrescriptionsByMedicalRecordUseCase.getByMedicalRecordId(medicalRecordId)
                                .stream()
                                .map(mapper::toResponse)
                                .toList();
        }

        @PostMapping("/{id}/dispense")
        @RequirePermission("PRESCRIPTION_UPDATE_STATUS")
        public DispensePrescriptionResponse dispense(
                        @PathVariable UUID id,
                        @RequestBody(required = false) DispensePrescriptionRequest request) {
                return mapper.toResponse(
                                dispensePrescriptionUseCase.dispense(mapper.toCommand(id, request)));
        }

        @PostMapping("/{id}/partial-dispense")
        @RequirePermission("PRESCRIPTION_UPDATE_STATUS")
        public PartialDispensePrescriptionResponse partialDispense(
                        @PathVariable UUID id,
                        @Valid @RequestBody(required = false) PartialDispensePrescriptionRequest request) {
                return mapper.toResponse(
                                dispensePrescriptionItemsUseCase.dispense(mapper.toCommand(id, request)));
        }

        @PostMapping("/{id}/return")
        @RequirePermission("PRESCRIPTION_UPDATE_STATUS")
        @Operation(summary = "Trả lại thuốc và hủy phiếu cấp phát kèm lý do")
        @ApiResponse(responseCode = "200", description = "Thuốc đã được trả lại và tồn kho được hoàn về đúng lô")
        @ApiResponse(responseCode = "403", description = "Không có quyền trả thuốc hoặc không phải dược sĩ")
        @ApiResponse(responseCode = "404", description = "Không tìm thấy đơn thuốc")
        @ApiResponse(responseCode = "409", description = "Lượt khám đã thu phí và chưa hoàn tiền")
        public ReturnMedicationResponse returnMedication(
                        @PathVariable UUID id,
                        @Valid @RequestBody ReturnMedicationRequest request) {
                return mapper.toResponse(
                                returnMedicationUseCase.returnMedication(mapper.toCommand(id, request)));
        }

        @GetMapping("/{id}/dispense-history")
        @RequirePermission("PRESCRIPTION_DISPENSE_HISTORY_READ")
        public java.util.List<DispenseHistoryResponse> getDispenseHistory(@PathVariable UUID id) {
                return mapper.toDispenseHistoryResponse(
                                getPrescriptionDispenseHistoryUseCase.getHistory(id));
        }

        @GetMapping("/{id}/dispense-suggestion")
        @RequirePermission("PRESCRIPTION_UPDATE_STATUS")
        @Operation(summary = "Gợi ý lô cấp phát theo nguyên tắc hạn dùng gần trước (FEFO)")
        public DispenseSuggestionResponse getDispenseSuggestion(@PathVariable UUID id) {
                return mapper.toResponse(getDispenseSuggestionUseCase.getSuggestion(id));
        }

        @PostMapping("/{id}/cancel")
        @RequirePermission("PRESCRIPTION_UPDATE")
        @Operation(summary = "Hủy đơn thuốc chưa cấp phát kèm lý do")
        @ApiResponse(responseCode = "200", description = "Đơn thuốc đã được hủy thành công")
        @ApiResponse(responseCode = "400", description = "Thiếu lý do hủy hoặc dữ liệu không hợp lệ")
        @ApiResponse(responseCode = "403", description = "Không có quyền hủy đơn thuốc hoặc không phải bác sĩ kê đơn")
        @ApiResponse(responseCode = "404", description = "Không tìm thấy đơn thuốc")
        @ApiResponse(responseCode = "409", description = "Đơn thuốc đã cấp phát hoặc đã hủy")
        public PrescriptionResponse cancel(
                        @PathVariable UUID id,
                        @Valid @RequestBody CancelPrescriptionRequest request) {
                return mapper.toResponse(cancelPrescriptionUseCase.cancel(mapper.toCommand(id, request)));
        }

        @PostMapping("/{id}/interconnection")
        @RequirePermission("PRESCRIPTION_INTERCONNECTION_SEND")
        @Operation(summary = "Send a prescription to the interconnection gateway")
        @ApiResponse(responseCode = "200", description = "Submission result")
        @ApiResponse(responseCode = "403", description = "Requires interconnection send permission")
        public PrescriptionInterconnectionResult sendToInterconnection(@PathVariable UUID id) {
                return sendPrescriptionInterconnectionUseCase.send(id);
        }

        @PostMapping("/{id}/interconnection/retry")
        @RequirePermission("PRESCRIPTION_INTERCONNECTION_RETRY")
        @Operation(summary = "Retry a failed prescription interconnection submission")
        @ApiResponse(responseCode = "200", description = "Retry result")
        @ApiResponse(responseCode = "403", description = "Requires interconnection retry permission")
        public PrescriptionInterconnectionResult retryInterconnection(@PathVariable UUID id) {
                return retryPrescriptionInterconnectionUseCase.retry(id);
        }

        @PostMapping("/check-interactions")
        @RequirePermission("PRESCRIPTION_CREATE")
        public List<DrugInteractionWarningResponse> checkInteractions(
                        @Valid @RequestBody CheckDrugInteractionRequest request) {
                return mapper.toResponse(
                                checkDrugInteractionUseCase.check(mapper.toCommand(request)));
        }

        @PostMapping("/check-allergy-warnings")
        @RequirePermission({ "PRESCRIPTION_CREATE", "PRESCRIPTION_UPDATE" })
        public List<PatientAllergyWarningResponse> checkAllergyWarnings(
                        @Valid @RequestBody CheckPatientDrugAllergyRequest request) {
                return mapper.toAllergyResponses(
                                checkPatientDrugAllergyUseCase.check(request.medicalRecordId(), request.medicineIds()));
        }

        @PostMapping("/check-contraindications")
        @RequirePermission({ "PRESCRIPTION_CREATE", "PRESCRIPTION_UPDATE" })
        @Operation(summary = "Check contraindication warnings by age, pregnancy and chronic disease")
        public ContraindicationCheckResponse checkContraindications(
                        @Valid @RequestBody CheckContraindicationRequest request) {
                return mapper.toResponse(
                                checkContraindicationUseCase.check(request.medicalRecordId(), request.medicineIds()));
        }

        @PostMapping("/check-max-daily-dose")
        @RequirePermission({ "PRESCRIPTION_CREATE", "PRESCRIPTION_UPDATE" })
        @Operation(summary = "Check total daily active-ingredient dose against the configured max (read-only)")
        public MaxDailyDoseCheckResponse checkMaxDailyDose(
                        @Valid @RequestBody CheckMaxDailyDoseRequest request) {
                return mapper.toResponse(
                                checkMaxDailyDoseUseCase.check(mapper.toCommand(request)));
        }

        @GetMapping("/allergy-warning-logs")
        @RequirePermission("PRESCRIPTION_ALLERGY_WARNING_VIEW")
        public Page<PrescriptionAllergyWarningLogResponse> searchAllergyWarningLogs(
                        @RequestParam(required = false) UUID doctorId,
                        @RequestParam(required = false) UUID patientId,
                        @RequestParam(required = false) java.time.Instant from,
                        @RequestParam(required = false) java.time.Instant to,
                        @RequestParam(defaultValue = "0") int page,
                        @RequestParam(defaultValue = "20") int size) {
                return getPrescriptionAllergyWarningLogsUseCase
                                .search(new SearchPrescriptionAllergyWarningLogsQuery(doctorId, patientId, from, to,
                                                page, size))
                                .map(mapper::toAllergyLogResponse);
        }
}
