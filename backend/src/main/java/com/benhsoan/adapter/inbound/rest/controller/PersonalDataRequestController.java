package com.benhsoan.adapter.inbound.rest.controller;

import java.time.Instant;
import java.util.UUID;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.benhsoan.adapter.inbound.rest.mapper.PersonalDataRequestRestMapper;
import com.benhsoan.adapter.inbound.rest.request.personaldata.CompletePersonalDataRequestRequest;
import com.benhsoan.adapter.inbound.rest.request.personaldata.RecordPersonalDataRequestRequest;
import com.benhsoan.adapter.inbound.rest.response.personaldata.PersonalDataRequestResponse;
import com.benhsoan.domain.personaldata.enums.PersonalDataRequestStatus;
import com.benhsoan.domain.shared.exception.ValidationException;
import com.benhsoan.infrastructure.security.annotation.RequirePermission;
import com.benhsoan.port.dto.command.personaldata.RecordPersonalDataRequestCommand;
import com.benhsoan.port.dto.query.personaldata.SearchPersonalDataRequestsQuery;
import com.benhsoan.port.dto.result.personaldata.PersonalDataRequestResult;
import com.benhsoan.port.inbound.personaldata.CompletePersonalDataRequestUseCase;
import com.benhsoan.port.inbound.personaldata.GetPersonalDataRequestUseCase;
import com.benhsoan.port.inbound.personaldata.RecordPersonalDataRequestUseCase;
import com.benhsoan.port.inbound.personaldata.SearchPersonalDataRequestsUseCase;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/personal-data-requests")
@RequiredArgsConstructor
@Validated
public class PersonalDataRequestController {

    private final RecordPersonalDataRequestUseCase recordUseCase;
    private final CompletePersonalDataRequestUseCase completeUseCase;
    private final GetPersonalDataRequestUseCase getUseCase;
    private final SearchPersonalDataRequestsUseCase searchUseCase;
    private final PersonalDataRequestRestMapper mapper;

    @PostMapping
    @RequirePermission("PERSONAL_DATA_REQUEST_UPDATE")
    public ResponseEntity<PersonalDataRequestResponse> record(
            @Valid @RequestBody RecordPersonalDataRequestRequest request) {
        PersonalDataRequestResult result = recordUseCase.record(new RecordPersonalDataRequestCommand(
                request.patientId(),
                request.requestType(),
                request.reason(),
                request.dueAt()
        ));
        return ResponseEntity.status(HttpStatus.CREATED).body(mapper.toResponse(result));
    }

    @GetMapping("/{id}")
    @RequirePermission("PERSONAL_DATA_REQUEST_READ")
    public PersonalDataRequestResponse getById(@PathVariable UUID id) {
        return mapper.toResponse(getUseCase.getById(id));
    }

    @PatchMapping("/{id}/complete")
    @RequirePermission("PERSONAL_DATA_REQUEST_UPDATE")
    public PersonalDataRequestResponse complete(
            @PathVariable UUID id,
            @Valid @RequestBody CompletePersonalDataRequestRequest request) {
        return mapper.toResponse(completeUseCase.complete(id, request.result()));
    }

    @GetMapping
    @RequirePermission("PERSONAL_DATA_REQUEST_READ")
    public Page<PersonalDataRequestResponse> search(
            @RequestParam(required = false) UUID patientId,
            @RequestParam(required = false) PersonalDataRequestStatus status,
            @RequestParam(required = false, defaultValue = "false") boolean overdue,
            @RequestParam(required = false) Instant dueFrom,
            @RequestParam(required = false) Instant dueTo,
            @PageableDefault(size = 20, sort = "dueAt", direction = Sort.Direction.ASC) Pageable pageable) {
        validateRange(dueFrom, dueTo);
        return searchUseCase.search(
                new SearchPersonalDataRequestsQuery(patientId, status, overdue, dueFrom, dueTo),
                pageable
        ).map(mapper::toResponse);
    }

    private void validateRange(Instant from, Instant to) {
        if (from != null && to != null && from.isAfter(to)) {
            throw new ValidationException("dueFrom must be before or equal to dueTo.");
        }
    }
}
