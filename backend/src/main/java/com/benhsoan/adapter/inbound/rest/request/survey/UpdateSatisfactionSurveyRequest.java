package com.benhsoan.adapter.inbound.rest.request.survey;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record UpdateSatisfactionSurveyRequest(
        @NotNull(message = "score is required.")
        @Min(value = 1, message = "score must be between 1 and 5.")
        @Max(value = 5, message = "score must be between 1 and 5.")
        Integer score,

        @Size(max = 1000, message = "comment must not exceed 1000 characters.")
        String comment
) {
}
