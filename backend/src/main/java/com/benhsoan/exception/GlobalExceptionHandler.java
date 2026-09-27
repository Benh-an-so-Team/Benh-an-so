package com.benhsoan.exception;

import java.util.HashMap;
import java.util.Map;

import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.transaction.TransactionSystemException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.multipart.support.MissingServletRequestPartException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

import com.fasterxml.jackson.databind.JsonMappingException;
import com.benhsoan.domain.auth.exception.TooManyLoginAttemptsException;
import com.benhsoan.domain.prescription.exception.PrescriptionInteractionConfirmationRequiredException;
import com.benhsoan.domain.prescription.exception.PrescriptionInsufficientStockException;
import com.benhsoan.domain.prescription.exception.PrescriptionMaxDailyDoseConfirmationRequiredException;

import com.benhsoan.domain.reporting.exception.OperationalReportDataEmptyException;
import com.benhsoan.domain.shared.exception.DomainException;
import com.benhsoan.domain.shared.exception.ValidationException;

import jakarta.servlet.http.HttpServletRequest;

import org.springframework.http.ResponseEntity;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(OperationalReportDataEmptyException.class)
    public ResponseEntity<ApiErrorResponse> handleOperationalReportDataEmpty(
            OperationalReportDataEmptyException ex,
            HttpServletRequest request
    ) {
        return build(DomainExceptionHttpStatusMapper.statusFor(ex.getCode()), ex.getCode().name(), ex.getMessage(), request.getRequestURI());
    }

    @ExceptionHandler(com.benhsoan.domain.patient.exception.PatientConsentAccessDeniedException.class)
    public ResponseEntity<ApiErrorResponse> handlePatientConsentAccessDenied(
            com.benhsoan.domain.patient.exception.PatientConsentAccessDeniedException ex,
            HttpServletRequest request
    ) {
        return build(HttpStatus.FORBIDDEN, ex.getCode().name(), ex.getMessage(), request.getRequestURI());
    }

    @ExceptionHandler(ValidationException.class)
    public ResponseEntity<ApiErrorResponse> handleValidationException(
            ValidationException ex,
            HttpServletRequest request
    ) {
        String message = ex.getMessage();
        Map<String, Object> details = new HashMap<>();

        if (ex.getFieldErrors() != null && !ex.getFieldErrors().isEmpty()) {
            details.put("fields", ex.getFieldErrors());
        } else if (message != null && message.contains(":")) {
            int colonIdx = message.indexOf(':');
            String field = message.substring(0, colonIdx).trim();
            String error = message.substring(colonIdx + 1).trim();
            if (!field.isEmpty() && !field.contains(" ") && !error.isEmpty()) {
                details.put("fields", Map.of(field, error));
            }
        }
        return build(
                HttpStatus.BAD_REQUEST,
                ex.getCode().name(),
                message,
                request.getRequestURI(),
                details
        );
    }

    @ExceptionHandler(DomainException.class)
    public ResponseEntity<ApiErrorResponse> handleDomainException(
            DomainException ex,
            HttpServletRequest request
    ) {
        if (ex instanceof ValidationException validationEx) {
            return handleValidationException(validationEx, request);
        }
        return build(DomainExceptionHttpStatusMapper.statusFor(ex.getCode()), ex.getCode().name(), ex.getMessage(), request.getRequestURI());
    }

    @ExceptionHandler(com.benhsoan.domain.appointment.exception.AppointmentSeriesConflictException.class)
    public ResponseEntity<ApiErrorResponse> handleAppointmentSeriesConflict(
            com.benhsoan.domain.appointment.exception.AppointmentSeriesConflictException ex,
            HttpServletRequest request
    ) {
        HttpStatus status = DomainExceptionHttpStatusMapper.statusFor(ex.getCode());
        Map<String, Object> details = new HashMap<>();
        if (ex.getConflicts() != null) {
            details.put("conflicts", ex.getConflicts().stream().map(c -> {
                Map<String, Object> item = new HashMap<>();
                item.put("sequenceNumber", c.sequenceNumber());
                item.put("startTime", c.startTime());
                item.put("endTime", c.endTime());
                item.put("conflictType", c.conflictType());
                item.put("reason", c.reason());
                item.put("conflictReason", c.reason());
                return item;
            }).toList());
        }
        return build(status, ex.getCode().name(), ex.getMessage(), request.getRequestURI(), details);
    }

    @ExceptionHandler(com.benhsoan.domain.patient.exception.PatientAlreadyMergedException.class)
    public ResponseEntity<ApiErrorResponse> handlePatientAlreadyMerged(
            com.benhsoan.domain.patient.exception.PatientAlreadyMergedException ex,
            HttpServletRequest request
    ) {
        Map<String, Object> details = new HashMap<>();
        if (ex.getMergedIntoPatientId() != null) {
            details.put("mergedIntoPatientId", ex.getMergedIntoPatientId().toString());
        }
        return build(
                DomainExceptionHttpStatusMapper.statusFor(ex.getCode()),
                ex.getCode().name(),
                ex.getMessage(),
                request.getRequestURI(),
                details.isEmpty() ? null : details
        );
    }

    @ExceptionHandler(com.benhsoan.domain.medicalrecord.exception.PendingClinicalOrdersWarningException.class)
    public ResponseEntity<ApiErrorResponse> handlePendingClinicalOrdersWarning(
            com.benhsoan.domain.medicalrecord.exception.PendingClinicalOrdersWarningException ex,
            HttpServletRequest request
    ) {
        Map<String, Object> details = new HashMap<>();
        if (ex.getPendingServices() != null) {
            details.put("pendingServices", ex.getPendingServices());
        }
        return build(
                DomainExceptionHttpStatusMapper.statusFor(ex.getCode()),
                ex.getCode().name(),
                ex.getMessage(),
                request.getRequestURI(),
                details.isEmpty() ? null : details
        );
    }

    @ExceptionHandler(com.benhsoan.domain.auth.exception.WeakPasswordException.class)
    public ResponseEntity<ApiErrorResponse> handleWeakPassword(
            com.benhsoan.domain.auth.exception.WeakPasswordException ex,
            HttpServletRequest request
    ) {
        HttpStatus status = DomainExceptionHttpStatusMapper.statusFor(ex.getCode());
        Map<String, Object> details = new HashMap<>();
        details.put("violations", ex.getViolations());
        details.put("fields", Map.of("newPassword", String.join("; ", ex.getViolations())));
        return build(status, ex.getCode().name(), ex.getMessage(), request.getRequestURI(), details);
    }

    @ExceptionHandler(TooManyLoginAttemptsException.class)
    public ResponseEntity<ApiErrorResponse> handleTooManyLoginAttempts(
            TooManyLoginAttemptsException ex,
            HttpServletRequest request
    ) {

        HttpStatus status = DomainExceptionHttpStatusMapper.statusFor(ex.getCode());
        long retryAfterSeconds = Math.max(0, ex.getRetryAfterSeconds());

        Map<String, Object> details = new HashMap<>();
        details.put("retryAfterSeconds", retryAfterSeconds);
        if (ex.getBlockedUntil() != null) {
            details.put("blockedUntil", ex.getBlockedUntil().toString());
        }

        return ResponseEntity
                .status(status)
                .header(HttpHeaders.RETRY_AFTER, Long.toString(retryAfterSeconds))
                .body(ApiErrorResponseFactory.create(
                        status,
                        ex.getCode().name(),
                        ex.getMessage(),
                        request.getRequestURI(),
                        details));
    }

    @ExceptionHandler(PrescriptionInteractionConfirmationRequiredException.class)
    public ResponseEntity<ApiErrorResponse> handleInteractionConfirmationRequired(
            PrescriptionInteractionConfirmationRequiredException ex,
            HttpServletRequest request
    ) {
        return build(
                DomainExceptionHttpStatusMapper.statusFor(ex.getCode()),
                ex.getCode().name(),
                ex.getMessage(),
                request.getRequestURI(),
                Map.of("warnings", ex.getWarnings().stream().map(warning -> Map.<String, Object>of(
                        "ruleId", warning.ruleId(),
                        "firstMedicineId", warning.firstMedicineId(),
                        "secondMedicineId", warning.secondMedicineId(),
                        "severity", warning.severity(),
                        "description", warning.description(),
                        "recommendation", warning.recommendation()
                )).toList())
        );
    }

    @ExceptionHandler(com.benhsoan.domain.prescription.exception.PrescriptionAllergyConfirmationRequiredException.class)
    public ResponseEntity<ApiErrorResponse> handleAllergyConfirmationRequired(
            com.benhsoan.domain.prescription.exception.PrescriptionAllergyConfirmationRequiredException ex,
            HttpServletRequest request
    ) {
        return build(
                DomainExceptionHttpStatusMapper.statusFor(ex.getCode()),
                ex.getCode().name(),
                ex.getMessage(),
                request.getRequestURI(),
                Map.of("warnings", ex.getWarnings().stream().map(warning -> Map.<String, Object>of(
                        "allergyId", warning.allergyId(),
                        "patientId", warning.patientId(),
                        "medicineId", warning.medicineId(),
                        "medicineName", warning.medicineName() != null ? warning.medicineName() : "",
                        "activeIngredient", warning.activeIngredient(),
                        "allergenName", warning.allergenName(),
                        "severity", warning.severity(),
                        "reaction", warning.reaction() != null ? warning.reaction() : ""
                )).toList())
        );
    }

    @ExceptionHandler(PrescriptionMaxDailyDoseConfirmationRequiredException.class)
    public ResponseEntity<ApiErrorResponse> handleMaxDailyDoseConfirmationRequired(
            PrescriptionMaxDailyDoseConfirmationRequiredException ex,
            HttpServletRequest request
    ) {
        return build(
                DomainExceptionHttpStatusMapper.statusFor(ex.getCode()),
                ex.getCode().name(),
                ex.getMessage(),
                request.getRequestURI(),
                Map.of("warnings", ex.getWarnings().stream().map(warning -> Map.<String, Object>of(
                        "activeIngredient", warning.activeIngredient(),
                        "totalDailyDoseMg", warning.totalDailyDoseMg(),
                        "maxDailyDoseMg", warning.maxDailyDoseMg()
                )).toList())
        );
    }

    @ExceptionHandler(PrescriptionInsufficientStockException.class)
    public ResponseEntity<ApiErrorResponse> handleInsufficientStock(
            PrescriptionInsufficientStockException ex,
            HttpServletRequest request
    ) {
        return build(
                DomainExceptionHttpStatusMapper.statusFor(ex.getCode()),
                ex.getCode().name(),
                ex.getMessage(),
                request.getRequestURI(),
                Map.of(
                        "prescriptionId", ex.getPrescriptionId(),
                        "shortages", ex.getDetails().stream().map(shortage -> Map.<String, Object>of(
                                "prescriptionItemId", shortage.prescriptionItemId(),
                                "medicineId", shortage.medicineId(),
                                "medicineCode", shortage.medicineCode(),
                                "medicineName", shortage.medicineName(),
                                "requiredQuantity", shortage.requiredQuantity(),
                                "availableQuantity", shortage.availableQuantity(),
                                "shortageQuantity", shortage.shortageQuantity()
                        )).toList()
                )
        );
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiErrorResponse> handleValidation(
            MethodArgumentNotValidException ex,
            HttpServletRequest request
    ) {

        Map<String, String> errors = new HashMap<>();

        for (FieldError error : ex.getBindingResult().getFieldErrors()) {
            errors.put(
                    error.getField(),
                    error.getDefaultMessage()
            );
        }

        return build(
                HttpStatus.BAD_REQUEST,
                "VALIDATION_FAILED",
                "Validation failed.",
                request.getRequestURI(),
                Map.of("fields", errors)
        );
    }

    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<ApiErrorResponse> handleTypeMismatch(
            MethodArgumentTypeMismatchException ex,
            HttpServletRequest request
    ) {

        return build(
                HttpStatus.BAD_REQUEST,
                "INVALID_PARAMETER",
                "Invalid parameter: " + ex.getName(),
                request.getRequestURI()
        );
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ApiErrorResponse> handleUnreadable(
            HttpMessageNotReadableException ex,
            HttpServletRequest request
    ) {

        if (ex.getCause() instanceof JsonMappingException mappingException
                && !mappingException.getPath().isEmpty()) {
            String field = toFieldPath(mappingException);
            return build(
                    HttpStatus.BAD_REQUEST,
                    "VALIDATION_FAILED",
                    "Validation failed.",
                    request.getRequestURI(),
                    Map.of("fields", Map.of(field, "Invalid value."))
            );
        }

        return build(
                HttpStatus.BAD_REQUEST,
                "MALFORMED_JSON",
                "Malformed JSON request.",
                request.getRequestURI()
        );
    }

    private String toFieldPath(JsonMappingException exception) {
        StringBuilder field = new StringBuilder();
        for (JsonMappingException.Reference reference : exception.getPath()) {
            if (reference.getFieldName() != null) {
                if (!field.isEmpty()) {
                    field.append('.');
                }
                field.append(reference.getFieldName());
            } else if (reference.getIndex() >= 0) {
                field.append('[').append(reference.getIndex()).append(']');
            }
        }
        return field.toString();
    }

    @ExceptionHandler(MissingServletRequestParameterException.class)
    public ResponseEntity<ApiErrorResponse> handleMissingParam(
            MissingServletRequestParameterException ex,
            HttpServletRequest request
    ) {

        return build(
                HttpStatus.BAD_REQUEST,
                "MISSING_PARAMETER",
                ex.getParameterName() + " is required.",
                request.getRequestURI()
        );
    }

    @ExceptionHandler(AuthenticationException.class)
    public ResponseEntity<ApiErrorResponse> handleAuthentication(
            AuthenticationException ex,
            HttpServletRequest request
    ) {

        return build(
                HttpStatus.UNAUTHORIZED,
                "AUTHENTICATION_FAILED",
                ex.getMessage(),
                request.getRequestURI()
        );
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ApiErrorResponse> handleAccessDenied(
            AccessDeniedException ex,
            HttpServletRequest request
    ) {
        String message = resolveAccessDeniedMessage(ex);
        return build(
                HttpStatus.FORBIDDEN,
                "ACCESS_DENIED",
                message,
                request.getRequestURI()
        );
    }

    private String resolveAccessDeniedMessage(AccessDeniedException ex) {
        if (ex.getMessage() == null || ex.getMessage().isBlank()) {
            return "Access denied.";
        }
        String trimmed = ex.getMessage().trim();
        if ("Denied".equalsIgnoreCase(trimmed)
                || "Access is denied".equalsIgnoreCase(trimmed)
                || "Access denied".equalsIgnoreCase(trimmed)
                || "Access denied.".equalsIgnoreCase(trimmed)) {
            return "Access denied.";
        }
        return trimmed;
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ApiErrorResponse> handleIllegalArgument(
            IllegalArgumentException ex,
            HttpServletRequest request
    ) {
        return build(
                HttpStatus.BAD_REQUEST,
                "INVALID_ARGUMENT",
                ex.getMessage() != null && !ex.getMessage().isBlank() ? ex.getMessage() : "Invalid argument provided.",
                request.getRequestURI()
        );
    }

    @ExceptionHandler(MissingServletRequestPartException.class)
    public ResponseEntity<ApiErrorResponse> handleMissingRequestPart(
            MissingServletRequestPartException ex,
            HttpServletRequest request
    ) {
        return build(HttpStatus.BAD_REQUEST, "MISSING_REQUEST_PART", ex.getRequestPartName() + " is required.", request.getRequestURI());
    }

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<ApiErrorResponse> handleUploadTooLarge(
            MaxUploadSizeExceededException ex,
            HttpServletRequest request
    ) {
        return build(HttpStatus.PAYLOAD_TOO_LARGE, "PAYLOAD_TOO_LARGE", "Uploaded file exceeds the allowed size.", request.getRequestURI());
    }

    @ExceptionHandler(NoResourceFoundException.class)
    public ResponseEntity<ApiErrorResponse> handleNoResourceFound(
            NoResourceFoundException ex,
            HttpServletRequest request
    ) {
        return build(HttpStatus.NOT_FOUND, "RESOURCE_NOT_FOUND", "Resource not found.", request.getRequestURI());
    }

    @ExceptionHandler(org.springframework.dao.DataIntegrityViolationException.class)
    public ResponseEntity<ApiErrorResponse> handleDataIntegrityViolation(
            org.springframework.dao.DataIntegrityViolationException ex,
            HttpServletRequest request
    ) {
        String msg = extractIntegrityViolationMessage(ex).toLowerCase();
        if (msg.contains("uq_patient_satisfaction_surveys_visit")) {
            return build(
                    HttpStatus.CONFLICT,
                    "SATISFACTION_SURVEY_ALREADY_EXISTS",
                    "Lượt khám này đã được gửi khảo sát hài lòng.",
                    request.getRequestURI()
            );
        }

        if (msg.contains("uk_patient_active_allergen")
                || (msg.contains("duplicate entry") && msg.contains("active_normalized_name"))) {
            return build(
                    HttpStatus.CONFLICT,
                    "PATIENT_ALLERGY_ALREADY_EXISTS",
                    "Hoạt chất hoặc dị nguyên này đã tồn tại trong danh sách dị ứng của bệnh nhân.",
                    request.getRequestURI()
            );
        }

        log.error("Data integrity violation for {}", request.getRequestURI(), ex);
        return build(
                HttpStatus.CONFLICT,
                "DATA_INTEGRITY_VIOLATION",
                "Dữ liệu không hợp lệ hoặc bị xung đột ràng buộc hệ thống.",
                request.getRequestURI()
        );
    }

    @ExceptionHandler(TransactionSystemException.class)
    public ResponseEntity<ApiErrorResponse> handleTransactionSystemException(
            TransactionSystemException ex,
            HttpServletRequest request
    ) {
        org.springframework.dao.DataIntegrityViolationException integrityViolation =
                findCause(ex, org.springframework.dao.DataIntegrityViolationException.class);
        if (integrityViolation != null) {
            return handleDataIntegrityViolation(integrityViolation, request);
        }

        log.error("Transaction system failure for {}", request.getRequestURI(), ex);
        return build(
                HttpStatus.INTERNAL_SERVER_ERROR,
                "INTERNAL_SERVER_ERROR",
                "Internal server error.",
                request.getRequestURI()
        );
    }

    private static <T extends Throwable> T findCause(Throwable throwable, Class<T> type) {
        Throwable current = throwable;
        while (current != null) {
            if (type.isInstance(current)) {
                return type.cast(current);
            }
            current = current.getCause();
        }
        return null;
    }

    private String extractIntegrityViolationMessage(Throwable throwable) {
        StringBuilder builder = new StringBuilder();
        Throwable current = throwable;
        while (current != null) {
            if (current.getMessage() != null) {
                builder.append(current.getMessage()).append(' ');
            }
            current = current.getCause();
        }
        return builder.toString();
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiErrorResponse> handleUnknown(
            Exception ex,
            HttpServletRequest request
    ) {
        log.error("Unhandled request failure for {}", request.getRequestURI(), ex);

        return build(
                HttpStatus.INTERNAL_SERVER_ERROR,
                "INTERNAL_SERVER_ERROR",
                "Internal server error.",
                request.getRequestURI()
        );
    }

    private ResponseEntity<ApiErrorResponse> build(
            HttpStatus status,
            String code,
            String message,
            String path
    ) {
        return build(status, code, message, path, Map.of());
    }

    private ResponseEntity<ApiErrorResponse> build(
            HttpStatus status,
            String code,
            String message,
            String path,
            Map<String, Object> details
    ) {

        return ResponseEntity
                .status(status)
                .body(ApiErrorResponseFactory.create(status, code, message, path, details));
    }

}
