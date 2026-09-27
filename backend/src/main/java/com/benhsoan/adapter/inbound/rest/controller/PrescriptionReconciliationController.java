package com.benhsoan.adapter.inbound.rest.controller;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import org.springframework.data.domain.Page;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.benhsoan.adapter.inbound.rest.mapper.PrescriptionReconciliationRestMapper;
import com.benhsoan.adapter.inbound.rest.request.prescription.RecordPrescriptionReconciliationNoteRequest;
import com.benhsoan.adapter.inbound.rest.response.prescription.PrescriptionReconciliationItemResponse;
import com.benhsoan.adapter.inbound.rest.response.prescription.PrescriptionReconciliationNoteResponse;
import com.benhsoan.domain.prescription.enums.PrescriptionReconciliationOutcome;
import com.benhsoan.infrastructure.security.annotation.RequirePermission;
import com.benhsoan.port.dto.command.prescription.RecordPrescriptionReconciliationNoteCommand;
import com.benhsoan.port.dto.command.prescription.SearchPrescriptionReconciliationQuery;
import com.benhsoan.port.inbound.prescription.GetPrescriptionReconciliationNotesUseCase;
import com.benhsoan.port.inbound.prescription.GetPrescriptionReconciliationUseCase;
import com.benhsoan.port.inbound.prescription.RecordPrescriptionReconciliationNoteUseCase;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import jakarta.validation.Valid;

import lombok.RequiredArgsConstructor;

/**
 * NCL-12-CN-007 CV-02 reconciliation API.
 *
 * Retransmission is deliberately not exposed here: the existing endpoint
 * POST /prescriptions/{id}/interconnection/retry is reused, and its authorization is
 * unchanged (PRESCRIPTION_INTERCONNECTION_RETRY, ADMIN only). The reconciliation list tells the
 * client when a row is retransmissionEligible so no second transmission mechanism is needed.
 */
@RestController
@RequestMapping("/prescription-reconciliation")
@RequiredArgsConstructor
public class PrescriptionReconciliationController {

    private final GetPrescriptionReconciliationUseCase getPrescriptionReconciliationUseCase;
    private final GetPrescriptionReconciliationNotesUseCase getPrescriptionReconciliationNotesUseCase;
    private final RecordPrescriptionReconciliationNoteUseCase recordPrescriptionReconciliationNoteUseCase;
    private final PrescriptionReconciliationRestMapper mapper;

    @GetMapping
    @RequirePermission("PRESCRIPTION_RECONCILIATION_VIEW")
    @Operation(summary = "Reconcile transmitted prescriptions against dispensed prescriptions")
    @ApiResponse(responseCode = "200", description = "Paginated reconciliation rows")
    @ApiResponse(responseCode = "403", description = "Requires reconciliation view permission")
    public Page<PrescriptionReconciliationItemResponse> search(
            @RequestParam(required = false) Instant from,
            @RequestParam(required = false) Instant to,
            @RequestParam(required = false) PrescriptionReconciliationOutcome outcome,
            @RequestParam(required = false) Boolean discrepanciesOnly,
            @RequestParam(required = false) String prescriptionCode,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        return getPrescriptionReconciliationUseCase.search(new SearchPrescriptionReconciliationQuery(
                        from, to, outcome, Boolean.TRUE.equals(discrepanciesOnly), prescriptionCode, page, size))
                .map(mapper::toItemResponse);
    }

    @GetMapping("/{prescriptionId}/notes")
    @RequirePermission("PRESCRIPTION_RECONCILIATION_VIEW")
    @Operation(summary = "Read the reconciliation note history of a prescription")
    @ApiResponse(responseCode = "200", description = "Append only note history, oldest first")
    @ApiResponse(responseCode = "403", description = "Requires reconciliation view permission")
    @ApiResponse(responseCode = "404", description = "Prescription not found")
    public List<PrescriptionReconciliationNoteResponse> getNotes(
            @PathVariable UUID prescriptionId
    ) {
        return getPrescriptionReconciliationNotesUseCase.getNotes(prescriptionId).stream()
                .map(mapper::toNoteResponse)
                .toList();
    }

    @PostMapping("/{prescriptionId}/notes")
    @RequirePermission("PRESCRIPTION_RECONCILIATION_NOTE")
    @Operation(summary = "Record a reason explaining a reconciliation discrepancy")
    @ApiResponse(responseCode = "200", description = "Recorded reconciliation note")
    @ApiResponse(responseCode = "400", description = "Blank or too long reason")
    @ApiResponse(responseCode = "403", description = "Requires reconciliation note permission")
    @ApiResponse(responseCode = "404", description = "Prescription not found")
    public PrescriptionReconciliationNoteResponse recordNote(
            @PathVariable UUID prescriptionId,
            @Valid @RequestBody RecordPrescriptionReconciliationNoteRequest request
    ) {
        return mapper.toNoteResponse(recordPrescriptionReconciliationNoteUseCase.record(
                new RecordPrescriptionReconciliationNoteCommand(prescriptionId, request.reason())));
    }
}
