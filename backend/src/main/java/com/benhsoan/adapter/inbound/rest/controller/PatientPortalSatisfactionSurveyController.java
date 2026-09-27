package com.benhsoan.adapter.inbound.rest.controller;

import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.benhsoan.adapter.inbound.rest.mapper.SatisfactionSurveyRestMapper;
import com.benhsoan.adapter.inbound.rest.request.survey.SubmitSatisfactionSurveyRequest;
import com.benhsoan.adapter.inbound.rest.request.survey.UpdateSatisfactionSurveyRequest;
import com.benhsoan.adapter.inbound.rest.response.survey.SatisfactionSurveyResponse;
import com.benhsoan.port.dto.result.survey.SatisfactionSurveyResult;
import com.benhsoan.port.inbound.survey.GetPatientSatisfactionSurveyUseCase;
import com.benhsoan.port.inbound.survey.SubmitSatisfactionSurveyUseCase;
import com.benhsoan.port.inbound.survey.UpdateSatisfactionSurveyUseCase;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

/**
 * NCL-10-CN-005: Khảo sát hài lòng sau khám trên cổng bệnh nhân.
 * Yêu cầu ROLE_PATIENT (được bảo vệ bởi SecurityConfig cho /patient-portal/**)
 * và tuân thủ chặt chẽ QTN-23 qua PatientAccessGuard.
 */
@RestController
@RequestMapping("/patient-portal/satisfaction-surveys")
@RequiredArgsConstructor
@Validated
public class PatientPortalSatisfactionSurveyController {

    private final SubmitSatisfactionSurveyUseCase submitSatisfactionSurveyUseCase;
    private final UpdateSatisfactionSurveyUseCase updateSatisfactionSurveyUseCase;
    private final GetPatientSatisfactionSurveyUseCase getPatientSatisfactionSurveyUseCase;
    private final SatisfactionSurveyRestMapper mapper;

    @PostMapping
    public ResponseEntity<SatisfactionSurveyResponse> submitSurvey(
            @Valid @RequestBody SubmitSatisfactionSurveyRequest request
    ) {
        SatisfactionSurveyResult result = submitSatisfactionSurveyUseCase.submitSurvey(
                request.visitId(),
                request.score(),
                request.comment()
        );
        return ResponseEntity.status(HttpStatus.CREATED).body(mapper.toResponse(result));
    }

    @PutMapping("/{id}")
    public SatisfactionSurveyResponse updateSurvey(
            @PathVariable UUID id,
            @Valid @RequestBody UpdateSatisfactionSurveyRequest request
    ) {
        SatisfactionSurveyResult result = updateSatisfactionSurveyUseCase.updateSurvey(
                id,
                request.score(),
                request.comment()
        );
        return mapper.toResponse(result);
    }

    @GetMapping("/by-visit/{visitId}")
    public SatisfactionSurveyResponse getSurveyByVisitId(@PathVariable UUID visitId) {
        SatisfactionSurveyResult result = getPatientSatisfactionSurveyUseCase.getSurveyByVisitId(visitId);
        return mapper.toResponse(result);
    }

    @GetMapping("/{id}")
    public SatisfactionSurveyResponse getSurveyById(@PathVariable UUID id) {
        SatisfactionSurveyResult result = getPatientSatisfactionSurveyUseCase.getSurveyById(id);
        return mapper.toResponse(result);
    }
}
