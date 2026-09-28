package com.benhsoan.adapter.inbound.rest.controller;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

import org.springframework.core.io.ByteArrayResource;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.benhsoan.adapter.inbound.rest.mapper.BillingRestMapper;
import com.benhsoan.adapter.inbound.rest.request.billing.AdjustInvoiceRequest;
import com.benhsoan.adapter.inbound.rest.request.billing.CreateInvoiceRequest;
import com.benhsoan.adapter.inbound.rest.request.billing.GetPaymentQuoteRequest;
import com.benhsoan.adapter.inbound.rest.request.billing.RecordPaymentRequest;
import com.benhsoan.adapter.inbound.rest.request.billing.RefundPaymentRequest;
import com.benhsoan.adapter.inbound.rest.response.billing.InvoiceAdjustmentsResponse;
import com.benhsoan.adapter.inbound.rest.response.billing.InvoiceResponse;
import com.benhsoan.adapter.inbound.rest.response.billing.PayableEncounterResponse;
import com.benhsoan.adapter.inbound.rest.response.billing.PaymentResponse;
import com.benhsoan.adapter.inbound.rest.response.billing.PaymentQuoteResponse;
import com.benhsoan.adapter.inbound.rest.response.billing.RefundPaymentResponse;
import com.benhsoan.domain.billing.enums.InvoiceType;
import com.benhsoan.domain.shared.exception.ValidationException;
import com.benhsoan.infrastructure.security.annotation.RequirePermission;
import com.benhsoan.port.dto.command.billing.PayableEncounterQuery;
import com.benhsoan.port.dto.command.billing.SearchInvoicesQuery;
import com.benhsoan.port.inbound.billing.AdjustInvoiceUseCase;
import com.benhsoan.port.inbound.billing.CreateInvoiceUseCase;
import com.benhsoan.port.inbound.billing.GetInvoiceAdjustmentsUseCase;
import com.benhsoan.port.inbound.billing.GetInvoiceByIdUseCase;
import com.benhsoan.port.inbound.billing.GetPayableEncountersUseCase;
import com.benhsoan.port.inbound.billing.GetPaymentQuoteUseCase;
import com.benhsoan.port.inbound.billing.RecordInvoiceReprintUseCase;
import com.benhsoan.port.inbound.billing.RecordPaymentUseCase;
import com.benhsoan.port.inbound.billing.RefundPaymentUseCase;
import com.benhsoan.port.inbound.billing.SearchInvoicesUseCase;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/invoices")
@RequiredArgsConstructor
@Validated
public class InvoiceController {

    private final RecordPaymentUseCase recordPaymentUseCase;
    private final CreateInvoiceUseCase createInvoiceUseCase;
    private final AdjustInvoiceUseCase adjustInvoiceUseCase;
    private final RefundPaymentUseCase refundPaymentUseCase;
    private final GetPayableEncountersUseCase getPayableEncountersUseCase;
    private final GetPaymentQuoteUseCase getPaymentQuoteUseCase;
    private final SearchInvoicesUseCase searchInvoicesUseCase;
    private final GetInvoiceByIdUseCase getInvoiceByIdUseCase;
    private final GetInvoiceAdjustmentsUseCase getInvoiceAdjustmentsUseCase;
    private final RecordInvoiceReprintUseCase recordInvoiceReprintUseCase;
    private final com.benhsoan.port.inbound.billing.PrintInvoiceUseCase printInvoiceUseCase;
    private final BillingRestMapper mapper;

    @PostMapping("/payments")
    @ResponseStatus(HttpStatus.CREATED)
    @RequirePermission("INVOICE_CREATE")
    public PaymentResponse recordPayment(@Valid @RequestBody RecordPaymentRequest request) {
        return mapper.toResponse(recordPaymentUseCase.record(mapper.toCommand(request)));
    }

    @PostMapping("/payment-quotes")
    @RequirePermission("INVOICE_CREATE")
    public PaymentQuoteResponse quotePayment(@Valid @RequestBody GetPaymentQuoteRequest request) {
        return mapper.toResponse(getPaymentQuoteUseCase.quote(mapper.toCommand(request)));
    }

    @PostMapping("/payments/{paymentId}/refund")
    @RequirePermission("INVOICE_UPDATE")
    public RefundPaymentResponse refundPayment(
            @PathVariable UUID paymentId,
            @Valid @RequestBody RefundPaymentRequest request
    ) {
        return mapper.toResponse(
                refundPaymentUseCase.refund(mapper.toCommand(paymentId, request))
        );
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @RequirePermission("INVOICE_CREATE")
    public InvoiceResponse createInvoice(@Valid @RequestBody CreateInvoiceRequest request) {
        return mapper.toResponse(createInvoiceUseCase.create(mapper.toCommand(request)));
    }

    @GetMapping("/payable")
    @RequirePermission("INVOICE_READ")
    public Page<PayableEncounterResponse> getPayableEncounters(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        validatePage(page, size);

        PageRequest pageable = PageRequest.of(
                page,
                size,
                Sort.by(Sort.Direction.DESC, "completedAt")
        );

        return mapper.toPayableResponse(getPayableEncountersUseCase.get(
                new PayableEncounterQuery(date, search, pageable)
        ));
    }

    @GetMapping
    @RequirePermission("INVOICE_READ")
    public Page<InvoiceResponse> search(
            @RequestParam(required = false) String invoiceCode,
            @RequestParam(required = false) InvoiceType invoiceType,
            @RequestParam(required = false) UUID visitId,
            @RequestParam(required = false) String patientName,
            @RequestParam(required = false) Instant createdFrom,
            @RequestParam(required = false) Instant createdTo,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        validatePage(page, size);
        if (createdFrom != null && createdTo != null && createdFrom.isAfter(createdTo)) {
            throw new ValidationException("createdFrom must be before or equal to createdTo.");
        }

        PageRequest pageable = PageRequest.of(
                page,
                size,
                Sort.by(Sort.Direction.DESC, "createdAt")
        );

        return mapper.toInvoiceResponse(searchInvoicesUseCase.search(
                new SearchInvoicesQuery(
                        invoiceCode,
                        invoiceType,
                        visitId,
                        patientName,
                        createdFrom,
                        createdTo,
                        pageable
                )
        ));
    }

    @GetMapping("/{invoiceId}")
    @RequirePermission("INVOICE_READ")
    public InvoiceResponse getById(@PathVariable UUID invoiceId) {
        return mapper.toResponse(getInvoiceByIdUseCase.getById(invoiceId));
    }

    @GetMapping("/{invoiceId}/adjustments")
    @RequirePermission("INVOICE_READ")
    public InvoiceAdjustmentsResponse getAdjustments(@PathVariable UUID invoiceId) {
        return mapper.toResponse(getInvoiceAdjustmentsUseCase.getAdjustments(invoiceId));
    }

    @PostMapping("/{invoiceId}/reprint")
    @RequirePermission("INVOICE_READ")
    public InvoiceResponse reprint(@PathVariable UUID invoiceId) {
        return mapper.toResponse(recordInvoiceReprintUseCase.recordReprint(invoiceId));
    }

    @GetMapping("/{invoiceId}/print")
    @RequirePermission("INVOICE_READ")
    public ResponseEntity<ByteArrayResource> print(@PathVariable UUID invoiceId) {
        var printResult = printInvoiceUseCase.print(invoiceId);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + printResult.fileName() + "\"")
                .contentType(MediaType.parseMediaType(printResult.contentType()))
                .contentLength(printResult.content().length)
                .body(new ByteArrayResource(printResult.content()));
    }

    @PostMapping("/{invoiceId}/adjustments")
    @ResponseStatus(HttpStatus.CREATED)
    @RequirePermission("INVOICE_UPDATE")
    public InvoiceResponse adjust(
            @PathVariable UUID invoiceId,
            @Valid @RequestBody AdjustInvoiceRequest request
    ) {
        return mapper.toResponse(adjustInvoiceUseCase.adjust(mapper.toCommand(invoiceId, request)));
    }

    private void validatePage(int page, int size) {
        if (page < 0 || size < 1 || size > 100) {
            throw new ValidationException("Page must be non-negative and size must be between 1 and 100.");
        }
    }
}
