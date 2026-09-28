package com.benhsoan.port.inbound.billing;

import java.util.UUID;

import com.benhsoan.port.dto.result.portal.InvoicePrintResult;

public interface PrintInvoiceUseCase {

    InvoicePrintResult print(UUID invoiceId);
}
