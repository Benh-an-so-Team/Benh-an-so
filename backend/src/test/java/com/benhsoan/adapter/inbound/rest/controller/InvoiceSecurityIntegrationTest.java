package com.benhsoan.adapter.inbound.rest.controller;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.EnableAspectJAutoProxy;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import com.benhsoan.adapter.inbound.rest.mapper.BillingRestMapper;
import com.benhsoan.application.ucservice.anonymization.AnonymizationModeState;
import com.benhsoan.config.SecurityConfig;
import com.benhsoan.domain.billing.enums.InvoiceLineType;
import com.benhsoan.domain.billing.enums.InvoiceType;
import com.benhsoan.domain.billing.enums.PaymentMethod;
import com.benhsoan.domain.billing.enums.PaymentStatus;
import com.benhsoan.infrastructure.authSecurity.JwtAuthenticationFilter;
import com.benhsoan.exception.GlobalExceptionHandler;
import com.benhsoan.infrastructure.security.annotation.RequirePermissionAspect;
import com.benhsoan.infrastructure.security.service.PermissionEvaluator;
import com.benhsoan.port.dto.result.InvoiceAdjustmentsResult;
import com.benhsoan.port.dto.result.InvoiceLineResult;
import com.benhsoan.port.dto.result.InvoiceResult;
import com.benhsoan.port.dto.result.PayableEncounterResult;
import com.benhsoan.port.dto.result.PaymentResult;
import com.benhsoan.port.dto.result.PaymentQuoteResult;
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
import com.benhsoan.port.outbound.repository.auth.RoleRepository;
import com.benhsoan.port.outbound.repository.audit.AuditLogRepository;
import com.benhsoan.port.outbound.security.CurrentUserPort;
import com.benhsoan.port.outbound.time.ClockPort;

@WebMvcTest(controllers = InvoiceController.class)
@Import({AnonymizationModeState.class, BillingRestMapper.class, SecurityConfig.class, JwtAuthenticationFilter.class, GlobalExceptionHandler.class,
        RequirePermissionAspect.class, PermissionEvaluator.class, InvoiceSecurityIntegrationTest.AspectTestConfig.class})
class InvoiceSecurityIntegrationTest {

    @TestConfiguration
    @EnableAspectJAutoProxy(proxyTargetClass = true)
    static class AspectTestConfig {
    }

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
    @MockitoBean private JwtTokenPort jwtTokenPort;
    @MockitoBean private UserRepository userRepository;
    @MockitoBean private UserSessionRepository userSessionRepository;
    @MockitoBean private ClockPort clockPort;
    @MockitoBean private RoleRepository roleRepository;
    @MockitoBean private AuditLogRepository auditLogRepository;
    @MockitoBean private CurrentUserPort currentUserPort;

    @Test
    void allowsAdminsReceptionistsAndManagersToReadInvoices() throws Exception {
        when(searchInvoicesUseCase.search(any())).thenReturn(Page.empty());
        when(getPayableEncountersUseCase.get(any())).thenReturn(new PageImpl<>(
                List.of(new PayableEncounterResult(
                        UUID.randomUUID(),
                        "VIS000001",
                        UUID.randomUUID(),
                        "BN000001",
                        "Nguyen Van A",
                        "Kham tong quat",
                        Instant.parse("2026-08-12T02:00:00Z")
                )),
                PageRequest.of(0, 20),
                1
        ));
        when(getInvoiceByIdUseCase.getById(any())).thenReturn(new InvoiceResult(
                UUID.randomUUID(),
                "HD000001",
                UUID.randomUUID(),
                UUID.randomUUID(),
                InvoiceType.ORIGINAL,
                null,
                null,
                new BigDecimal("100000"),
                UUID.randomUUID(),
                Instant.parse("2026-08-12T02:00:00Z"),
                0,
                null,
                List.of()
        ));

        for (String role : new String[] {"ADMIN", "RECEPTIONIST", "MANAGER"}) {
            mockMvc.perform(get("/invoices/payable").with(user(role.toLowerCase()).authorities(new org.springframework.security.core.authority.SimpleGrantedAuthority("PERMISSION_INVOICE_READ"))))
                    .andExpect(status().isOk());

            mockMvc.perform(get("/invoices").with(user(role.toLowerCase()).authorities(new org.springframework.security.core.authority.SimpleGrantedAuthority("PERMISSION_INVOICE_READ"))))
                    .andExpect(status().isOk());

            mockMvc.perform(get("/invoices/{invoiceId}", "23100000-0000-0000-0000-000000000001")
                            .with(user("tester").authorities(new org.springframework.security.core.authority.SimpleGrantedAuthority("PERMISSION_INVOICE_READ"))))
                    .andExpect(status().isOk());
        }

        mockMvc.perform(get("/invoices/payable").with(user("doctor").authorities(new org.springframework.security.core.authority.SimpleGrantedAuthority("PERMISSION_INVOICE_CREATE"))))
                .andExpect(status().isForbidden());

        mockMvc.perform(get("/invoices").with(user("doctor").authorities(new org.springframework.security.core.authority.SimpleGrantedAuthority("PERMISSION_INVOICE_CREATE"))))
                .andExpect(status().isForbidden());

        mockMvc.perform(get("/invoices/{invoiceId}", "23100000-0000-0000-0000-000000000001")
                        .with(user("doctor").authorities(new org.springframework.security.core.authority.SimpleGrantedAuthority("PERMISSION_INVOICE_CREATE"))))
                .andExpect(status().isForbidden());
    }

    @Test
    void allowsAdminsAndReceptionistsToCreateInvoicesAndPayments() throws Exception {
        UUID visitId = UUID.fromString("d0000000-0000-0000-0000-000000000001");
        UUID paymentId = UUID.randomUUID();
        UUID invoiceId = UUID.randomUUID();
        Instant now = Instant.parse("2026-08-12T02:00:00Z");

        when(recordPaymentUseCase.record(any())).thenReturn(new PaymentResult(
                paymentId,
                visitId,
                new BigDecimal("100000"),
                new BigDecimal("150000"),
                BigDecimal.ZERO,
                new BigDecimal("250000"),
                new BigDecimal("250000"),
                PaymentMethod.CASH,
                PaymentStatus.RECORDED,
                UUID.randomUUID(),
                now,
                now
        ));
        when(createInvoiceUseCase.create(any())).thenReturn(new InvoiceResult(
                invoiceId,
                "HD000020",
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
                List.of(new InvoiceLineResult(
                        UUID.randomUUID(),
                        invoiceId,
                        InvoiceLineType.EXAM_FEE,
                        "Phi kham",
                        visitId,
                        1,
                        new BigDecimal("100000"),
                        new BigDecimal("100000"),
                        now
                ))
        ));
        when(getPaymentQuoteUseCase.quote(any())).thenReturn(new PaymentQuoteResult(
                visitId,
                new BigDecimal("100000"),
                new BigDecimal("150000"),
                BigDecimal.ZERO,
                new BigDecimal("250000"),
                List.of(),
                now
        ));

        String paymentBody = """
                {
                  "visitId":"d0000000-0000-0000-0000-000000000001",
                  "examFee":100000,
                  "medicineFee":150000,
                  "amountPaid":250000,
                  "paymentMethod":"CASH"
                }
                """;

        mockMvc.perform(post("/invoices/payments")
                        .with(user("receptionist").authorities(new org.springframework.security.core.authority.SimpleGrantedAuthority("PERMISSION_INVOICE_CREATE")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(paymentBody))
                .andExpect(status().isCreated());

        mockMvc.perform(post("/invoices/payments")
                        .with(user("doctor").authorities(new org.springframework.security.core.authority.SimpleGrantedAuthority("PERMISSION_INVOICE_READ")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(paymentBody))
                .andExpect(status().isForbidden());

        mockMvc.perform(post("/invoices/payments")
                        .with(user("manager").authorities(new org.springframework.security.core.authority.SimpleGrantedAuthority("PERMISSION_INVOICE_READ")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(paymentBody))
                .andExpect(status().isForbidden());

        String quoteBody = """
                {
                  "visitId":"d0000000-0000-0000-0000-000000000001",
                  "examFee":100000,
                  "medicineFee":150000
                }
                """;

        for (String role : new String[] {"ADMIN", "RECEPTIONIST"}) {
            mockMvc.perform(post("/invoices/payment-quotes")
                            .with(user(role.toLowerCase()).authorities(new org.springframework.security.core.authority.SimpleGrantedAuthority("PERMISSION_INVOICE_CREATE")))
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(quoteBody))
                    .andExpect(status().isOk());
        }

        mockMvc.perform(post("/invoices/payment-quotes")
                        .with(user("manager").authorities(new org.springframework.security.core.authority.SimpleGrantedAuthority("PERMISSION_INVOICE_READ")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(quoteBody))
                .andExpect(status().isForbidden());

        mockMvc.perform(post("/invoices")
                        .with(user("admin").authorities(new org.springframework.security.core.authority.SimpleGrantedAuthority("PERMISSION_INVOICE_CREATE")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"visitId":"d0000000-0000-0000-0000-000000000001"}
                                """))
                .andExpect(status().isCreated());

        mockMvc.perform(post("/invoices")
                        .with(user("manager").authorities(new org.springframework.security.core.authority.SimpleGrantedAuthority("PERMISSION_INVOICE_READ")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"visitId":"d0000000-0000-0000-0000-000000000001"}
                                """))
                .andExpect(status().isForbidden());
    }

    @Test
    void onlyAllowsManagerToAdjustInvoices() throws Exception {
        UUID originalInvoiceId = UUID.fromString("23100000-0000-0000-0000-000000000001");
        UUID adjustmentInvoiceId = UUID.randomUUID();
        Instant now = Instant.parse("2026-08-12T03:00:00Z");
        when(adjustInvoiceUseCase.adjust(any())).thenReturn(new InvoiceResult(
                adjustmentInvoiceId,
                "HDDC000010",
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
                List.of(new InvoiceLineResult(
                        UUID.randomUUID(),
                        adjustmentInvoiceId,
                        InvoiceLineType.ADJUSTMENT,
                        "Dieu chinh dong 1",
                        originalInvoiceId,
                        1,
                        new BigDecimal("-20000"),
                        new BigDecimal("-20000"),
                        now
                ))
        ));

        String body = """
                {
                  "adjustmentReason":"Dieu chinh giam tien thuoc",
                  "lines":[{"itemName":"Dieu chinh dong 1","quantity":1,"unitPrice":-20000}]
                }
                """;

        mockMvc.perform(post("/invoices/{invoiceId}/adjustments", "23100000-0000-0000-0000-000000000001")
                        .with(user("receptionist").authorities(new org.springframework.security.core.authority.SimpleGrantedAuthority("PERMISSION_INVOICE_READ")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isForbidden());

        mockMvc.perform(post("/invoices/{invoiceId}/adjustments", "23100000-0000-0000-0000-000000000001")
                        .with(user("admin").authorities(new org.springframework.security.core.authority.SimpleGrantedAuthority("PERMISSION_INVOICE_READ")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isForbidden());

        mockMvc.perform(post("/invoices/{invoiceId}/adjustments", "23100000-0000-0000-0000-000000000001")
                        .with(user("manager").authorities(new org.springframework.security.core.authority.SimpleGrantedAuthority("PERMISSION_INVOICE_UPDATE")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isCreated());
    }

    @Test
    void onlyAllowsManagerToRefundPayments() throws Exception {
        UUID paymentId = UUID.randomUUID();
        UUID originalInvoiceId = UUID.randomUUID();
        Instant now = Instant.parse("2026-08-18T04:00:00Z");
        InvoiceResult adjustment = new InvoiceResult(
                UUID.randomUUID(),
                "HDDC000011",
                UUID.randomUUID(),
                null,
                InvoiceType.ADJUSTMENT,
                originalInvoiceId,
                "Patient cancelled",
                new BigDecimal("-250000"),
                UUID.randomUUID(),
                now,
                0,
                null,
                List.of()
        );
        when(refundPaymentUseCase.refund(any())).thenReturn(new RefundPaymentResult(
                paymentId,
                adjustment.visitId(),
                PaymentStatus.REFUNDED,
                new BigDecimal("250000"),
                "Patient cancelled",
                UUID.randomUUID(),
                now,
                adjustment
        ));

        String body = """
                {"reason":"Patient cancelled"}
                """;

        mockMvc.perform(post("/invoices/payments/{paymentId}/refund", paymentId)
                        .with(user("manager").authorities(new org.springframework.security.core.authority.SimpleGrantedAuthority("PERMISSION_INVOICE_UPDATE")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk());

        for (String role : new String[] {"ADMIN", "RECEPTIONIST", "DOCTOR"}) {
            mockMvc.perform(post("/invoices/payments/{paymentId}/refund", paymentId)
                            .with(user(role.toLowerCase()).authorities(new org.springframework.security.core.authority.SimpleGrantedAuthority("PERMISSION_INVOICE_READ")))
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(body))
                    .andExpect(status().isForbidden());
        }
    }

    @Test
    void reprintRequiresInvoiceReadPermission() throws Exception {
        UUID invoiceId = UUID.fromString("23100000-0000-0000-0000-000000000001");
        when(recordInvoiceReprintUseCase.recordReprint(invoiceId)).thenReturn(new InvoiceResult(
                invoiceId, "HD000001", UUID.randomUUID(), UUID.randomUUID(), InvoiceType.ORIGINAL,
                null, null, new BigDecimal("100000"), UUID.randomUUID(),
                Instant.parse("2026-08-12T02:00:00Z"), 1, Instant.parse("2026-08-12T03:00:00Z"), List.of()));

        mockMvc.perform(post("/invoices/{invoiceId}/reprint", invoiceId)
                        .with(user("receptionist").authorities(
                                new org.springframework.security.core.authority.SimpleGrantedAuthority("PERMISSION_INVOICE_READ"))))
                .andExpect(status().isOk());

        mockMvc.perform(post("/invoices/{invoiceId}/reprint", invoiceId)
                        .with(user("pharmacist").authorities(
                                new org.springframework.security.core.authority.SimpleGrantedAuthority("PERMISSION_PRESCRIPTION_UPDATE_STATUS"))))
                .andExpect(status().isForbidden());
    }

    @Test
    void getAdjustmentsRequiresInvoiceReadPermission() throws Exception {
        UUID invoiceId = UUID.fromString("23100000-0000-0000-0000-000000000001");
        when(getInvoiceAdjustmentsUseCase.getAdjustments(invoiceId)).thenReturn(new InvoiceAdjustmentsResult(
                invoiceId, new BigDecimal("250000"), new BigDecimal("230000"), List.of()));

        mockMvc.perform(get("/invoices/{invoiceId}/adjustments", invoiceId)
                        .with(user("manager").authorities(
                                new org.springframework.security.core.authority.SimpleGrantedAuthority("PERMISSION_INVOICE_READ"))))
                .andExpect(status().isOk());

        mockMvc.perform(get("/invoices/{invoiceId}/adjustments", invoiceId)
                        .with(user("pharmacist").authorities(
                                new org.springframework.security.core.authority.SimpleGrantedAuthority("PERMISSION_PRESCRIPTION_UPDATE_STATUS"))))
                .andExpect(status().isForbidden());
    }

    @Test
    void printInvoiceRequiresInvoiceReadPermission() throws Exception {
        UUID invoiceId = UUID.randomUUID();
        when(printInvoiceUseCase.print(invoiceId)).thenReturn(
                new com.benhsoan.port.dto.result.portal.InvoicePrintResult(
                        "hoa-don-INV-001.pdf",
                        "application/pdf",
                        "%PDF-1.7 mock content".getBytes()
                )
        );

        mockMvc.perform(get("/invoices/{invoiceId}/print", invoiceId)
                        .with(user("receptionist").authorities(
                                new org.springframework.security.core.authority.SimpleGrantedAuthority("PERMISSION_INVOICE_READ"))))
                .andExpect(status().isOk());

        mockMvc.perform(get("/invoices/{invoiceId}/print", invoiceId)
                        .with(user("pharmacist").authorities(
                                new org.springframework.security.core.authority.SimpleGrantedAuthority("PERMISSION_PRESCRIPTION_UPDATE_STATUS"))))
                .andExpect(status().isForbidden());
    }
}
