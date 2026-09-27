package com.benhsoan.adapter.inbound.rest.request.prescription;

import java.util.List;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;

@Schema(description = "Yêu cầu phát hành đơn thuốc thay thế cho đơn đã liên thông")
public record ReplacePrescriptionRequest(

        @Schema(
                description = "Lý do thay thế đơn thuốc",
                example = "Sai liều lượng so với chẩn đoán đã cập nhật",
                requiredMode = Schema.RequiredMode.REQUIRED)
        @NotBlank(message = "Lý do thay thế đơn thuốc là bắt buộc.")
        @Size(max = 500, message = "Lý do thay thế không được vượt quá 500 ký tự.")
        String replacementReason,

        @Schema(description = "Ghi chú của đơn thay thế")
        String note,

        @Schema(description = "Danh sách thuốc đã chỉnh sửa", requiredMode = Schema.RequiredMode.REQUIRED)
        @NotEmpty(message = "Đơn thay thế phải có ít nhất một loại thuốc.")
        @Valid
        List<CreatePrescriptionItemRequest> items,

        @Valid
        List<PrescriptionInteractionOverrideRequest> interactionOverrides,

        @Valid
        List<PrescriptionAllergyOverrideRequest> allergyOverrides,

        @Valid
        List<PrescriptionContraindicationOverrideRequest> contraindicationOverrides,

        @Valid
        List<PrescriptionMaxDailyDoseOverrideRequest> maxDailyDoseOverrides,

        boolean controlledMedicineConfirmed
) {
}
