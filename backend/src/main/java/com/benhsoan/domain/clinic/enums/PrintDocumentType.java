package com.benhsoan.domain.clinic.enums;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

@Getter
@RequiredArgsConstructor
public enum PrintDocumentType {
    PRESCRIPTION("Đơn thuốc"),
    INVOICE("Hóa đơn"),
    VISIT_SUMMARY("Phiếu tổng kết khám"),
    CLINICAL_RESULT("Kết quả cận lâm sàng");

    private final String description;
}

