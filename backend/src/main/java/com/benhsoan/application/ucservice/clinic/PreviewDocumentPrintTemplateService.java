package com.benhsoan.application.ucservice.clinic;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import org.springframework.stereotype.Service;

import com.benhsoan.domain.clinic.ClinicConfiguration;
import com.benhsoan.domain.medicine.enums.AdministrationRoute;
import com.benhsoan.domain.shared.exception.ValidationException;
import com.benhsoan.infrastructure.pdf.PdfBoxClinicalResultPdfRenderer;
import com.benhsoan.port.dto.command.clinic.PreviewDocumentPrintTemplateCommand;
import com.benhsoan.port.dto.result.PrescriptionPrintDocument;
import com.benhsoan.port.dto.result.VisitSummaryPrintDocument;
import com.benhsoan.port.dto.result.billing.InvoicePrintDocument;
import com.benhsoan.port.dto.result.billing.InvoicePrintDocument.InvoicePrintLine;
import com.benhsoan.port.dto.result.portal.ClinicalResultPrintDocument;
import com.benhsoan.port.inbound.clinic.PreviewDocumentPrintTemplateUseCase;
import com.benhsoan.port.outbound.pdf.ClinicalResultPdfRenderer;
import com.benhsoan.port.outbound.pdf.InvoicePdfRenderer;
import com.benhsoan.port.outbound.pdf.PrescriptionPdfRenderer;
import com.benhsoan.port.outbound.pdf.VisitSummaryPdfRenderer;
import com.benhsoan.port.outbound.repository.clinic.ClinicConfigurationRepository;
import com.benhsoan.port.outbound.time.ClockPort;

@Service
public class PreviewDocumentPrintTemplateService implements PreviewDocumentPrintTemplateUseCase {

    private final ClinicConfigurationRepository clinicConfigurationRepository;
    private final PrescriptionPdfRenderer prescriptionPdfRenderer;
    private final VisitSummaryPdfRenderer visitSummaryPdfRenderer;
    private final InvoicePdfRenderer invoicePdfRenderer;
    private final ClinicalResultPdfRenderer clinicalResultPdfRenderer;
    private final ClockPort clockPort;

    public PreviewDocumentPrintTemplateService(
            ClinicConfigurationRepository clinicConfigurationRepository,
            PrescriptionPdfRenderer prescriptionPdfRenderer,
            VisitSummaryPdfRenderer visitSummaryPdfRenderer,
            InvoicePdfRenderer invoicePdfRenderer,
            ClockPort clockPort
    ) {
        this(
                clinicConfigurationRepository,
                prescriptionPdfRenderer,
                visitSummaryPdfRenderer,
                invoicePdfRenderer,
                new PdfBoxClinicalResultPdfRenderer(),
                clockPort
        );
    }

    @org.springframework.beans.factory.annotation.Autowired
    public PreviewDocumentPrintTemplateService(
            ClinicConfigurationRepository clinicConfigurationRepository,
            PrescriptionPdfRenderer prescriptionPdfRenderer,
            VisitSummaryPdfRenderer visitSummaryPdfRenderer,
            InvoicePdfRenderer invoicePdfRenderer,
            ClinicalResultPdfRenderer clinicalResultPdfRenderer,
            ClockPort clockPort
    ) {
        this.clinicConfigurationRepository = clinicConfigurationRepository;
        this.prescriptionPdfRenderer = prescriptionPdfRenderer;
        this.visitSummaryPdfRenderer = visitSummaryPdfRenderer;
        this.invoicePdfRenderer = invoicePdfRenderer;
        this.clinicalResultPdfRenderer = clinicalResultPdfRenderer;
        this.clockPort = clockPort;
    }

    @Override
    public byte[] preview(PreviewDocumentPrintTemplateCommand command) {
        if (command == null) {
            throw new ValidationException("Preview document print template command is required.");
        }
        if (command.documentType() == null) {
            throw new ValidationException("Document type is required.");
        }

        ClinicConfiguration clinic = clinicConfigurationRepository.find().orElse(null);
        String clinicName = clinic != null ? clinic.getClinicName() : "Phòng khám Đa khoa Tiêu chuẩn";
        String clinicAddress = clinic != null ? clinic.getAddress() : "123 Đường Sức Khỏe, Quận Trung Tâm";
        String clinicPhone = clinic != null ? clinic.getPhone() : "02838999999";

        Instant now = clockPort.now();
        boolean showLogo = command.showLogo() == null || command.showLogo();

        return switch (command.documentType()) {
            case PRESCRIPTION -> previewPrescription(clinicName, clinicAddress, clinicPhone, command, showLogo, now);
            case INVOICE -> previewInvoice(clinicName, clinicAddress, clinicPhone, command, showLogo, now);
            case VISIT_SUMMARY -> previewVisitSummary(clinicName, clinicAddress, clinicPhone, command, showLogo, now);
            case CLINICAL_RESULT -> previewClinicalResult(clinicName, clinicAddress, clinicPhone, command, showLogo, now);
        };
    }

    private byte[] previewPrescription(
            String clinicName, String clinicAddress, String clinicPhone,
            PreviewDocumentPrintTemplateCommand command, boolean showLogo, Instant now
    ) {
        PrescriptionPrintDocument doc = new PrescriptionPrintDocument(
                clinicName,
                clinicAddress,
                clinicPhone,
                "DT-20260925-MOCK01",
                UUID.randomUUID(),
                "BN-2026-0001",
                "Nguyễn Văn Người Bệnh (Xem trước)",
                UUID.randomUUID(),
                "BS. Trần Văn Bác Sĩ",
                now,
                List.of(
                        new PrescriptionPrintDocument.Item(
                                "Amoxicillin 500mg", "500 mg", "Viên", "1 viên/lần",
                                2, 7, AdministrationRoute.ORAL, 14, "Uống sau khi ăn sáng và tối"
                        ),
                        new PrescriptionPrintDocument.Item(
                                "Paracetamol 500mg", "500 mg", "Viên", "1 viên/lần",
                                3, 5, AdministrationRoute.ORAL, 15, "Uống khi có sốt trên 38.5 độ C"
                        )
                ),
                command.title(),
                command.logoUrl(),
                command.legalInfo(),
                command.footerText(),
                showLogo,
                command.fieldVisibility()
        );
        return prescriptionPdfRenderer.render(doc);
    }

    private byte[] previewInvoice(
            String clinicName, String clinicAddress, String clinicPhone,
            PreviewDocumentPrintTemplateCommand command, boolean showLogo, Instant now
    ) {
        List<InvoicePrintLine> lines = List.of(
                new InvoicePrintLine(1, "Khám chuyên khoa Nội tổng quát", "SERVICE", 1, new BigDecimal("150000"), new BigDecimal("150000")),
                new InvoicePrintLine(2, "Xét nghiệm tổng phân tích tế bào máu", "SERVICE", 1, new BigDecimal("120000"), new BigDecimal("120000")),
                new InvoicePrintLine(3, "Amoxicillin 500mg (14 viên)", "MEDICINE", 1, new BigDecimal("70000"), new BigDecimal("70000"))
        );
        BigDecimal total = new BigDecimal("340000");

        InvoicePrintDocument doc = new InvoicePrintDocument(
                clinicName,
                clinicAddress,
                clinicPhone,
                "HD-20260925-MOCK01",
                "ORIGINAL",
                null,
                null,
                "BN-2026-0001",
                "Nguyễn Văn Người Bệnh (Xem trước)",
                "15/06/1990",
                "NAM",
                "0912345678",
                "KB-20260925-001",
                now,
                "BS. Trần Văn Bác Sĩ",
                "Khoa Nội",
                now,
                "Lễ tân Thu Ngân",
                lines,
                total,
                now,
                command.title(),
                command.logoUrl(),
                command.legalInfo(),
                command.footerText(),
                showLogo,
                0,
                command.fieldVisibility()
        );
        return invoicePdfRenderer.render(doc);
    }

    private byte[] previewVisitSummary(
            String clinicName, String clinicAddress, String clinicPhone,
            PreviewDocumentPrintTemplateCommand command, boolean showLogo, Instant now
    ) {
        VisitSummaryPrintDocument doc = new VisitSummaryPrintDocument(
                clinicName,
                clinicAddress,
                clinicPhone,
                "BN-2026-0001",
                "Nguyễn Văn Người Bệnh (Xem trước)",
                "15/06/1990",
                "NAM",
                "0912345678",
                "KB-20260925-001",
                now,
                "BS. Trần Văn Bác Sĩ",
                List.of(
                        new VisitSummaryPrintDocument.Diagnosis("J02", "Viêm họng cấp", true),
                        new VisitSummaryPrintDocument.Diagnosis("R50", "Sốt không rõ nguyên nhân", false)
                ),
                List.of(
                        new VisitSummaryPrintDocument.ClinicalOrder("CLS-001", "XN-MAU", "Tổng phân tích tế bào máu", "Lấy máu buổi sáng", "COMPLETED")
                ),
                "Uống thuốc đầy đủ theo đơn, nghỉ ngơi hợp lý, tránh thức ăn cay nóng.",
                "Điều trị nội khoa ngoại trú.",
                LocalDate.now().plusDays(7),
                "BS. Trần Văn Bác Sĩ",
                now,
                "BS. Trần Văn Bác Sĩ",
                now,
                command.title(),
                command.logoUrl(),
                command.legalInfo(),
                command.footerText(),
                showLogo,
                command.fieldVisibility()
        );
        return visitSummaryPdfRenderer.render(doc);
    }

    private byte[] previewClinicalResult(
            String clinicName, String clinicAddress, String clinicPhone,
            PreviewDocumentPrintTemplateCommand command, boolean showLogo, Instant now
    ) {
        ClinicalResultPrintDocument doc = new ClinicalResultPrintDocument(
                clinicName,
                clinicAddress,
                clinicPhone,
                "BN-2026-0001",
                "Nguyễn Văn Người Bệnh (Xem trước)",
                "15/06/1990",
                "NAM",
                "0912345678",
                "KB-20260925-001",
                now,
                "BS. Trần Văn Bác Sĩ",
                "Khoa Xét Nghiệm",
                "XN-20260925-001",
                "Kiểm tra định kỳ tổng quát",
                List.of(
                        new ClinicalResultPrintDocument.ClinicalResultPrintItem(
                                1, "GLU", "Đường huyết (Glucose)", "NUMERIC", "5.4", "mmol/L", "3.9 - 6.4", "NORMAL", "Bình thường"
                        ),
                        new ClinicalResultPrintDocument.ClinicalResultPrintItem(
                                2, "CHOL", "Cholesterol toàn phần", "NUMERIC", "5.8", "mmol/L", "3.6 - 5.2", "HIGH", "Tăng nhẹ"
                        )
                ),
                "Các chỉ số cơ bản ổn định, theo dõi mỡ máu nhẹ.",
                now,
                command.title(),
                command.logoUrl(),
                command.legalInfo(),
                command.footerText(),
                showLogo,
                command.fieldVisibility()
        );
        return clinicalResultPdfRenderer.render(doc);
    }
}
