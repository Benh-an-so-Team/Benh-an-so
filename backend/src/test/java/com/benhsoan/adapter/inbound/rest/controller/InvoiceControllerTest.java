package com.benhsoan.adapter.inbound.rest.controller;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import com.benhsoan.port.dto.command.billing.RecordPaymentCommand;
import com.benhsoan.adapter.inbound.rest.mapper.BillingRestMapper;
import com.benhsoan.application.ucservice.anonymization.AnonymizationModeState;
import com.benhsoan.domain.billing.enums.InvoiceLineType;
import com.benhsoan.domain.billing.enums.InvoiceType;
import com.benhsoan.domain.billing.enums.PaymentMethod;
import com.benhsoan.domain.billing.enums.PaymentStatus;
import com.benhsoan.domain.billing.exception.InvoiceAlreadyIssuedException;
import com.benhsoan.domain.billing.exception.InvoiceNotFoundException;
import com.benhsoan.domain.billing.exception.PaymentNotAllowedException;
import com.benhsoan.domain.billing.exception.PaymentNotFoundException;
import com.benhsoan.port.dto.command.billing.PayableEncounterQuery;
import com.benhsoan.port.dto.result.InvoiceLineResult;
import com.benhsoan.port.dto.result.InvoiceResult;
import com.benhsoan.port.dto.result.PayableEncounterResult;
import com.benhsoan.port.dto.result.PaymentDetailResult;
import com.benhsoan.port.dto.result.PaymentMethodItemResult;
import com.benhsoan.port.dto.result.PaymentResult;
import com.benhsoan.port.dto.result.PaymentQuoteResult;
import com.benhsoan.port.dto.result.PaymentServiceFeeQuoteResult;
import com.benhsoan.port.dto.result.RefundPaymentResult;
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
import com.benhsoan.port.outbound.authSecurity.JwtTokenPort;
import com.benhsoan.port.outbound.repository.auth.UserRepository;
import com.benhsoan.port.outbound.repository.auth.UserSessionRepository;
import com.benhsoan.port.outbound.security.CurrentUserPort;
import com.benhsoan.port.outbound.time.ClockPort;

@WebMvcTest(controllers = InvoiceController.class)
@AutoConfigureMockMvc(addFilters = false)
@Import({BillingRestMapper.class, AnonymizationModeState.class, com.benhsoan.exception.GlobalExceptionHandler.class})
class InvoiceControllerTest {

    @Autowired private MockMvc mockMvc;

    @MockitoBean private RecordPaymentUseCase recordPaymentUseCase;
    @MockitoBean private CreateInvoiceUseCase createInvoiceUseCase;
    @MockitoBean private AdjustInvoiceUseCase adjustInvoiceUseCase;
    @MockitoBean private RefundPaymentUseCase refundPaymentUseCase;
    @MockitoBean private GetPayableEncountersUseCase getPayableEncountersUseCase;
    @MockitoBean private GetPaymentQuoteUseCase getPaymentQuoteUseCase;
    @MockitoBean private SearchInvoicesUseCase searchInvoicesUseCase;
    @MockitoBean private GetInvoiceByIdUseCase getInvoiceByIdUseCase;
    @MockitoBean private GetInvoiceAdjustmentsUseCase getInvoiceAdjustmentsUseCase;
    @MockitoBean private RecordInvoiceReprintUseCase recordInvoiceReprintUseCase;
    @MockitoBean private com.benhsoan.port.inbound.billing.PrintInvoiceUseCase printInvoiceUseCase;
    @MockitoBean private CurrentUserPort currentUserPort;
    @MockitoBean private UserRepository userRepository;
    @MockitoBean private UserSessionRepository userSessionRepository;
    @MockitoBean private JwtTokenPort jwtTokenPort;
    @MockitoBean private ClockPort clockPort;

    @Test
    void recordsPayment() throws Exception {
        UUID visitId = UUID.randomUUID();
        when(recordPaymentUseCase.record(any())).thenReturn(new PaymentResult(
                UUID.randomUUID(),
                visitId,
                new BigDecimal("100000"),
                new BigDecimal("150000"),
                BigDecimal.ZERO,
                new BigDecimal("250000"),
                new BigDecimal("250000"),
                PaymentMethod.CASH,
                PaymentStatus.RECORDED,
                UUID.randomUUID(),
                Instant.parse("2026-08-12T01:00:00Z"),
                Instant.parse("2026-08-12T01:00:00Z")
        ));

        mockMvc.perform(post("/invoices/payments")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "visitId":"%s",
                                  "examFee":100000,
                                  "medicineFee":150000,
                                  "amountPaid":250000,
                                  "paymentMethod":"CASH"
                                }
                                """.formatted(visitId)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.visitId").value(visitId.toString()))
                .andExpect(jsonPath("$.totalAmount").value(250000))
                .andExpect(jsonPath("$.status").value("RECORDED"));
    }

    @Test
    void recordsPaymentWithMultipleMethods() throws Exception {
        UUID visitId = UUID.randomUUID();
        UUID paymentId = UUID.randomUUID();
        when(recordPaymentUseCase.record(any())).thenReturn(new PaymentResult(
                paymentId,
                visitId,
                new BigDecimal("100000"),
                new BigDecimal("150000"),
                BigDecimal.ZERO,
                new BigDecimal("250000"),
                new BigDecimal("250000"),
                PaymentMethod.MULTIPLE,
                PaymentStatus.RECORDED,
                UUID.randomUUID(),
                Instant.parse("2026-08-12T01:00:00Z"),
                Instant.parse("2026-08-12T01:00:00Z"),
                List.of(
                        new PaymentMethodItemResult(UUID.randomUUID(), paymentId, PaymentMethod.CASH, new BigDecimal("100000"), null, Instant.parse("2026-08-12T01:00:00Z")),
                        new PaymentMethodItemResult(UUID.randomUUID(), paymentId, PaymentMethod.BANK_TRANSFER, new BigDecimal("150000"), "TXN123456", Instant.parse("2026-08-12T01:00:00Z"))
                )
        ));

        mockMvc.perform(post("/invoices/payments")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "visitId":"%s",
                                  "examFee":100000,
                                  "medicineFee":150000,
                                  "amountPaid":250000,
                                  "paymentMethods":[
                                    {"paymentMethod":"CASH","amount":100000},
                                    {"paymentMethod":"BANK_TRANSFER","amount":150000,"referenceNumber":"TXN123456"}
                                  ]
                                }
                                """.formatted(visitId)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.paymentMethod").value("MULTIPLE"))
                .andExpect(jsonPath("$.paymentMethods.length()").value(2))
                .andExpect(jsonPath("$.paymentMethods[0].paymentMethod").value("CASH"))
                .andExpect(jsonPath("$.paymentMethods[0].amount").value(100000))
                .andExpect(jsonPath("$.paymentMethods[1].paymentMethod").value("BANK_TRANSFER"))
                .andExpect(jsonPath("$.paymentMethods[1].amount").value(150000))
                .andExpect(jsonPath("$.paymentMethods[1].referenceNumber").value("TXN123456"));
    }

    @Test
    void getInvoiceByIdReturnsPaymentBreakdown() throws Exception {
        UUID invoiceId = UUID.randomUUID();
        UUID visitId = UUID.randomUUID();
        UUID paymentId = UUID.randomUUID();
        UUID collectorId = UUID.randomUUID();
        Instant paidAt = Instant.parse("2026-08-12T02:00:00Z");

        PaymentDetailResult paymentDetail = new PaymentDetailResult(
                paymentId,
                visitId,
                PaymentStatus.RECORDED,
                new BigDecimal("250000"),
                new BigDecimal("250000"),
                PaymentMethod.MULTIPLE,
                collectorId,
                "Nguyen Van Thu Ngan",
                paidAt,
                paidAt,
                List.of(
                        new PaymentMethodItemResult(UUID.randomUUID(), paymentId, PaymentMethod.CASH, new BigDecimal("100000"), null, paidAt),
                        new PaymentMethodItemResult(UUID.randomUUID(), paymentId, PaymentMethod.BANK_TRANSFER, new BigDecimal("150000"), "TXN123456", paidAt)
                )
        );

        InvoiceResult result = new InvoiceResult(
                invoiceId,
                "HD000010",
                visitId,
                paymentId,
                InvoiceType.ORIGINAL,
                null,
                null,
                new BigDecimal("250000"),
                collectorId,
                paidAt,
                0,
                null,
                List.of(),
                paymentDetail
        );

        when(getInvoiceByIdUseCase.getById(invoiceId)).thenReturn(result);

        mockMvc.perform(get("/invoices/{invoiceId}", invoiceId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(invoiceId.toString()))
                .andExpect(jsonPath("$.payment.collectorName").value("Nguyen Van Thu Ngan"))
                .andExpect(jsonPath("$.payment.paymentMethod").value("MULTIPLE"))
                .andExpect(jsonPath("$.payment.paymentMethods.length()").value(2))
                .andExpect(jsonPath("$.payment.paymentMethods[0].paymentMethod").value("CASH"))
                .andExpect(jsonPath("$.payment.paymentMethods[1].paymentMethod").value("BANK_TRANSFER"))
                .andExpect(jsonPath("$.payment.paymentMethods[1].referenceNumber").value("TXN123456"));
    }

    @Test
    void returnsPaymentQuoteWithClinicalServiceFees() throws Exception {
        UUID visitId = UUID.randomUUID();
        when(getPaymentQuoteUseCase.quote(any())).thenReturn(new PaymentQuoteResult(
                visitId,
                new BigDecimal("100000"),
                new BigDecimal("150000"),
                new BigDecimal("95000"),
                new BigDecimal("345000"),
                List.of(new PaymentServiceFeeQuoteResult(
                        UUID.randomUUID(), "Blood test", new BigDecimal("95000")
                )),
                Instant.parse("2026-08-18T08:00:00Z")
        ));

        mockMvc.perform(post("/invoices/payment-quotes")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "visitId":"%s",
                                  "examFee":100000,
                                  "medicineFee":150000
                                }
                                """.formatted(visitId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.serviceFee").value(95000))
                .andExpect(jsonPath("$.totalAmount").value(345000))
                .andExpect(jsonPath("$.serviceFees[0].serviceName").value("Blood test"));
    }

    @Test
    void createsOriginalInvoice() throws Exception {
        UUID visitId = UUID.randomUUID();
        UUID paymentId = UUID.randomUUID();
        UUID invoiceId = UUID.randomUUID();
        when(createInvoiceUseCase.create(any())).thenReturn(originalInvoice(invoiceId, visitId, paymentId));

        mockMvc.perform(post("/invoices")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "visitId":"%s"
                                }
                                """.formatted(visitId)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(invoiceId.toString()))
                .andExpect(jsonPath("$.invoiceCode").value("HD000010"))
                .andExpect(jsonPath("$.type").value("ORIGINAL"))
                .andExpect(jsonPath("$.lines[0].lineType").value("EXAM_FEE"));
    }

    @Test
    void returnsPayableEncounters() throws Exception {
        UUID visitId = UUID.randomUUID();
        when(getPayableEncountersUseCase.get(any())).thenReturn(new PageImpl<>(
                List.of(new PayableEncounterResult(
                        visitId,
                        "VIS000010",
                        UUID.randomUUID(),
                        "BN000010",
                        "Nguyen Van A",
                        "Kham tong quat",
                        Instant.parse("2026-08-12T01:30:00Z"),
                        new BigDecimal("100000"),
                        BigDecimal.ZERO,
                        new BigDecimal("50000"),
                        new BigDecimal("150000"),
                        true,
                        false
                )),
                PageRequest.of(0, 20),
                1
        ));

        mockMvc.perform(get("/invoices/payable")
                        .param("page", "0")
                        .param("size", "20"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].visitId").value(visitId.toString()))
                .andExpect(jsonPath("$.content[0].visitCode").value("VIS000010"))
                .andExpect(jsonPath("$.content[0].patientName").value("Nguyen Van A"))
                .andExpect(jsonPath("$.content[0].examFee").value(100000))
                .andExpect(jsonPath("$.content[0].medicineFee").value(0))
                .andExpect(jsonPath("$.content[0].serviceFee").value(50000))
                .andExpect(jsonPath("$.content[0].totalEstimatedAmount").value(150000))
                .andExpect(jsonPath("$.content[0].hasPrescription").value(true))
                .andExpect(jsonPath("$.content[0].hasPendingDispense").value(false));
    }

    @Test
    void filtersPayableEncountersByDateAndSearch() throws Exception {
        ArgumentCaptor<PayableEncounterQuery> captor = ArgumentCaptor.forClass(PayableEncounterQuery.class);
        when(getPayableEncountersUseCase.get(captor.capture())).thenReturn(Page.empty());

        mockMvc.perform(get("/invoices/payable")
                        .param("date", "2026-09-21")
                        .param("search", "BN000010")
                        .param("page", "1")
                        .param("size", "10"))
                .andExpect(status().isOk());

        PayableEncounterQuery query = captor.getValue();
        assertEquals(LocalDate.of(2026, 9, 21), query.date());
        assertEquals("BN000010", query.search());
        assertEquals(1, query.pageable().getPageNumber());
        assertEquals(10, query.pageable().getPageSize());
    }

    @Test
    void validatesPaginationOnPayableEncounters() throws Exception {
        mockMvc.perform(get("/invoices/payable")
                        .param("page", "-1")
                        .param("size", "20"))
                .andExpect(status().isBadRequest());

        mockMvc.perform(get("/invoices/payable")
                        .param("page", "0")
                        .param("size", "101"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void searchesInvoices() throws Exception {
        UUID visitId = UUID.randomUUID();
        UUID paymentId = UUID.randomUUID();
        when(searchInvoicesUseCase.search(any())).thenReturn(new PageImpl<>(
                List.of(originalInvoice(UUID.randomUUID(), visitId, paymentId)),
                PageRequest.of(0, 20),
                1
        ));

        mockMvc.perform(get("/invoices")
                        .param("invoiceType", "ORIGINAL")
                        .param("page", "0")
                        .param("size", "20"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].invoiceCode").value("HD000010"))
                .andExpect(jsonPath("$.content[0].type").value("ORIGINAL"))
                .andExpect(jsonPath("$.totalElements").value(1));
    }

    @Test
    void getsInvoiceById() throws Exception {
        UUID invoiceId = UUID.randomUUID();
        UUID visitId = UUID.randomUUID();
        UUID paymentId = UUID.randomUUID();
        when(getInvoiceByIdUseCase.getById(invoiceId)).thenReturn(originalInvoice(invoiceId, visitId, paymentId));

        mockMvc.perform(get("/invoices/{invoiceId}", invoiceId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(invoiceId.toString()))
                .andExpect(jsonPath("$.invoiceCode").value("HD000010"));
    }

    @Test
    void adjustsInvoice() throws Exception {
        UUID originalInvoiceId = UUID.randomUUID();
        when(adjustInvoiceUseCase.adjust(any())).thenReturn(adjustmentInvoice(originalInvoiceId));

        mockMvc.perform(post("/invoices/{invoiceId}/adjustments", originalInvoiceId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "adjustmentReason":"Dieu chinh giam tien thuoc",
                                  "lines":[
                                    {
                                      "itemName":"Dieu chinh dong 1",
                                      "quantity":1,
                                      "unitPrice":-20000
                                    }
                                  ]
                                }
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.invoiceCode").value("HDDC000002"))
                .andExpect(jsonPath("$.type").value("ADJUSTMENT"))
                .andExpect(jsonPath("$.originalInvoiceId").value(originalInvoiceId.toString()))
                .andExpect(jsonPath("$.totalAmount").value(-20000));
    }

    @Test
    void refundsPayment() throws Exception {
        UUID paymentId = UUID.randomUUID();
        UUID visitId = UUID.randomUUID();
        UUID actorId = UUID.randomUUID();
        UUID originalInvoiceId = UUID.randomUUID();
        Instant refundedAt = Instant.parse("2026-08-18T04:00:00Z");
        when(refundPaymentUseCase.refund(any())).thenReturn(new RefundPaymentResult(
                paymentId,
                visitId,
                PaymentStatus.REFUNDED,
                new BigDecimal("250000"),
                "Patient cancelled",
                actorId,
                refundedAt,
                adjustmentInvoice(originalInvoiceId)
        ));

        mockMvc.perform(post("/invoices/payments/{paymentId}/refund", paymentId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"reason":"Patient cancelled"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.paymentId").value(paymentId.toString()))
                .andExpect(jsonPath("$.visitId").value(visitId.toString()))
                .andExpect(jsonPath("$.status").value("REFUNDED"))
                .andExpect(jsonPath("$.amountRefunded").value(250000))
                .andExpect(jsonPath("$.refundReason").value("Patient cancelled"))
                .andExpect(jsonPath("$.refundedBy").value(actorId.toString()))
                .andExpect(jsonPath("$.refundedAt").value("2026-08-18T04:00:00Z"))
                .andExpect(jsonPath("$.adjustmentInvoice.type").value("ADJUSTMENT"))
                .andExpect(jsonPath("$.adjustmentInvoice.totalAmount").value(-20000));
    }

    @Test
    void rejectsRefundWithBlankReason() throws Exception {
        mockMvc.perform(post("/invoices/payments/{paymentId}/refund", UUID.randomUUID())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"reason":" "}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.details.fields.reason").exists());

        verifyNoInteractions(refundPaymentUseCase);
    }

    @Test
    void mapsMissingPaymentDuringRefundTo404() throws Exception {
        UUID paymentId = UUID.randomUUID();
        when(refundPaymentUseCase.refund(any())).thenThrow(new PaymentNotFoundException(paymentId));

        mockMvc.perform(post("/invoices/payments/{paymentId}/refund", paymentId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"reason":"Patient cancelled"}
                                """))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.message").value("Payment not found: " + paymentId));
    }

    @Test
    void mapsMissingOriginalInvoiceDuringRefundTo404() throws Exception {
        UUID paymentId = UUID.randomUUID();
        when(refundPaymentUseCase.refund(any()))
                .thenThrow(new InvoiceNotFoundException(paymentId, true));

        mockMvc.perform(post("/invoices/payments/{paymentId}/refund", paymentId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"reason":"Patient cancelled"}
                                """))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.message").value(
                        "Original invoice not found for payment: " + paymentId
                ));
    }

    @Test
    void mapsInvalidRefundStateTo409() throws Exception {
        UUID paymentId = UUID.randomUUID();
        when(refundPaymentUseCase.refund(any())).thenThrow(
                new PaymentNotAllowedException("Payment has already been refunded.")
        );

        mockMvc.perform(post("/invoices/payments/{paymentId}/refund", paymentId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"reason":"Patient cancelled"}
                                """))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value("Payment has already been refunded."));
    }

    @Test
    void rejectsSearchWhenCreatedRangeIsInvalid() throws Exception {
        mockMvc.perform(get("/invoices")
                        .param("createdFrom", "2026-08-12T03:00:00Z")
                        .param("createdTo", "2026-08-12T01:00:00Z"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("createdFrom must be before or equal to createdTo."));

        verifyNoInteractions(searchInvoicesUseCase);
    }

    @Test
    void mapsNotFoundExceptionTo404() throws Exception {
        UUID invoiceId = UUID.randomUUID();
        when(getInvoiceByIdUseCase.getById(invoiceId)).thenThrow(new InvoiceNotFoundException(invoiceId));

        mockMvc.perform(get("/invoices/{invoiceId}", invoiceId))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.message").value("Invoice not found: " + invoiceId));
    }

    @Test
    void mapsBusinessConflictTo409() throws Exception {
        UUID visitId = UUID.randomUUID();
        when(createInvoiceUseCase.create(any())).thenThrow(new InvoiceAlreadyIssuedException(visitId));

        mockMvc.perform(post("/invoices")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "visitId":"%s"
                                }
                                """.formatted(visitId)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value("An invoice already exists for visit: " + visitId));
    }

    private static InvoiceResult originalInvoice(UUID invoiceId, UUID visitId, UUID paymentId) {
        Instant now = Instant.parse("2026-08-12T02:00:00Z");
        return new InvoiceResult(
                invoiceId,
                "HD000010",
                visitId,
                paymentId,
                InvoiceType.ORIGINAL,
                null,
                null,
                new BigDecimal("250000"),
                UUID.randomUUID(),
                now,
                0,
                null,
                List.of(
                        new InvoiceLineResult(
                                UUID.randomUUID(),
                                invoiceId,
                                InvoiceLineType.EXAM_FEE,
                                "Phi kham",
                                visitId,
                                1,
                                new BigDecimal("100000"),
                                new BigDecimal("100000"),
                                now
                        ),
                        new InvoiceLineResult(
                                UUID.randomUUID(),
                                invoiceId,
                                InvoiceLineType.MEDICINE_FEE,
                                "Tien thuoc",
                                paymentId,
                                1,
                                new BigDecimal("150000"),
                                new BigDecimal("150000"),
                                now
                        )
                )
        );
    }

    private static InvoiceResult adjustmentInvoice(UUID originalInvoiceId) {
        UUID invoiceId = UUID.randomUUID();
        Instant now = Instant.parse("2026-08-12T03:00:00Z");
        return new InvoiceResult(
                invoiceId,
                "HDDC000002",
                UUID.randomUUID(),
                null,
                InvoiceType.ADJUSTMENT,
                originalInvoiceId,
                "Dieu chinh giam tien thuoc",
                new BigDecimal("-20000"),
                UUID.randomUUID(),
                now,
                0,
                null,
                List.of(
                        new InvoiceLineResult(
                                UUID.randomUUID(),
                                invoiceId,
                                InvoiceLineType.ADJUSTMENT,
                                "Dieu chinh dong 1",
                                originalInvoiceId,
                                1,
                                new BigDecimal("-20000"),
                                new BigDecimal("-20000"),
                                now
                        )
                )
        );
    }

    @Test
    void rejectsReferenceNumberExceeding100Chars() throws Exception {
        UUID visitId = UUID.randomUUID();
        String longRef = "R".repeat(101);

        mockMvc.perform(post("/invoices/payments")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "visitId":"%s",
                                  "examFee":100000,
                                  "medicineFee":150000,
                                  "amountPaid":250000,
                                  "paymentMethods":[
                                    {
                                      "paymentMethod":"BANK_TRANSFER",
                                      "amount":250000,
                                      "referenceNumber":"%s"
                                    }
                                  ]
                                }
                                """.formatted(visitId, longRef)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));

        verifyNoInteractions(recordPaymentUseCase);
    }

    @Test
    void recordsLegacyBankTransferWithReferenceNumber() throws Exception {
        UUID visitId = UUID.randomUUID();
        UUID paymentId = UUID.randomUUID();
        when(recordPaymentUseCase.record(any())).thenReturn(new PaymentResult(
                paymentId,
                visitId,
                new BigDecimal("100000"),
                new BigDecimal("150000"),
                BigDecimal.ZERO,
                new BigDecimal("250000"),
                new BigDecimal("250000"),
                PaymentMethod.BANK_TRANSFER,
                PaymentStatus.RECORDED,
                UUID.randomUUID(),
                Instant.parse("2026-08-12T01:00:00Z"),
                Instant.parse("2026-08-12T01:00:00Z"),
                List.of(
                        new PaymentMethodItemResult(
                                UUID.randomUUID(),
                                paymentId,
                                PaymentMethod.BANK_TRANSFER,
                                new BigDecimal("250000"),
                                "VCB-LEGACY-001",
                                Instant.parse("2026-08-12T01:00:00Z")
                        )
                )
        ));

        mockMvc.perform(post("/invoices/payments")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "visitId":"%s",
                                  "examFee":100000,
                                  "medicineFee":150000,
                                  "amountPaid":250000,
                                  "paymentMethod":"BANK_TRANSFER",
                                  "referenceNumber":"VCB-LEGACY-001"
                                }
                                """.formatted(visitId)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.visitId").value(visitId.toString()))
                .andExpect(jsonPath("$.totalAmount").value(250000));

        ArgumentCaptor<RecordPaymentCommand> captor = ArgumentCaptor.forClass(RecordPaymentCommand.class);
        verify(recordPaymentUseCase).record(captor.capture());

        RecordPaymentCommand cmd = captor.getValue();
        assertEquals(PaymentMethod.BANK_TRANSFER, cmd.paymentMethod());
        assertEquals(1, cmd.paymentMethods().size());
        assertEquals("VCB-LEGACY-001", cmd.paymentMethods().get(0).referenceNumber());
    }

    @Test
    void printsInvoiceReturnsPdf() throws Exception {
        UUID invoiceId = UUID.randomUUID();
        when(printInvoiceUseCase.print(invoiceId)).thenReturn(
                new com.benhsoan.port.dto.result.portal.InvoicePrintResult(
                        "hoa-don-INV-001.pdf",
                        "application/pdf",
                        "%PDF-1.7 mock content".getBytes()
                )
        );

        mockMvc.perform(get("/invoices/{invoiceId}/print", invoiceId))
                .andExpect(status().isOk())
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.header().string("Content-Disposition", "attachment; filename=\"hoa-don-INV-001.pdf\""))
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.content().contentType(MediaType.APPLICATION_PDF));
    }
}
