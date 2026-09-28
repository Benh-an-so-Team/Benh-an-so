package com.benhsoan.adapter.inbound.rest.request.personaldata;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CompletePersonalDataRequestRequest(
        @NotBlank(message = "result is required.")
        @Size(max = 2000, message = "result must not exceed 2000 characters.")
        String result
) {
}
