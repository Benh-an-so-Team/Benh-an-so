package com.benhsoan.infrastructure.interconnection.mock;

import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.atomic.AtomicLong;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import com.benhsoan.config.MockInterconnectionGatewayProperties;
import com.benhsoan.port.outbound.interconnection.PrescriptionInterconnectionGatewayRequest;
import com.benhsoan.port.outbound.interconnection.PrescriptionInterconnectionGatewayResponse;
import com.benhsoan.port.outbound.interconnection.PrescriptionInterconnectionGatewayPort;
import com.benhsoan.port.outbound.time.ClockPort;

@Service
public class MockPrescriptionInterconnectionGatewayService implements PrescriptionInterconnectionGatewayPort {

    private static final DateTimeFormatter RECEIPT_DATE_FORMAT = DateTimeFormatter.BASIC_ISO_DATE
            .withZone(ZoneOffset.UTC);

    /** Mirrors the {@code DatabasePrescriptionCodeGenerator} format. */
    private static final String PRESCRIPTION_CODE_PATTERN = "RX\\d{6,}";

    private final ClockPort clockPort;
    private final MockInterconnectionGatewayProperties properties;
    private final AtomicLong receiptSequence = new AtomicLong();
    private final Map<String, AcceptedSubmission> acceptedByPrescriptionCode = new LinkedHashMap<>();

    /**
     * Prescription codes this gateway was told were cancelled by a replacement.
     */
    private final Set<String> cancelledByPrescriptionCode = new LinkedHashSet<>();

    public MockPrescriptionInterconnectionGatewayService(
            ClockPort clockPort,
            MockInterconnectionGatewayProperties properties
    ) {
        this.clockPort = clockPort;
        this.properties = properties;
    }

    public synchronized SubmissionResult submit(
            String idempotencyKey,
            PrescriptionInterconnectionGatewayRequest request
    ) {
        validateRequest(idempotencyKey, request);

        AcceptedSubmission existing = acceptedByPrescriptionCode.get(idempotencyKey);
        if (existing != null) {
            if (!existing.request().equals(request)) {
                throw error(HttpStatus.CONFLICT, "IDEMPOTENCY_KEY_REUSED",
                        "Idempotency key was previously accepted with a different request body.");
            }
            return new SubmissionResult(existing.response(), true);
        }

        if (cancelledByPrescriptionCode.contains(request.prescriptionCode())) {
            throw error(HttpStatus.CONFLICT, "PRESCRIPTION_CANCELLED",
                    "This prescription was cancelled on the interconnection system because it was replaced.");
        }

        applyConfiguredMode();

        var receivedAt = clockPort.now();
        var response = new PrescriptionInterconnectionGatewayResponse(
                "LT-" + RECEIPT_DATE_FORMAT.format(receivedAt) + "-"
                        + String.format("%06d", receiptSequence.incrementAndGet()),
                "ACCEPTED",
                receivedAt
        );
        acceptedByPrescriptionCode.put(idempotencyKey, new AcceptedSubmission(request, response));
        if (request.replacesPrescriptionCode() != null) {
            cancelledByPrescriptionCode.add(request.replacesPrescriptionCode());
        }
        return new SubmissionResult(response, false);
    }

    @Override
    public PrescriptionInterconnectionGatewayResponse submit(
            PrescriptionInterconnectionGatewayRequest request
    ) {
        return submit(request.prescriptionCode(), request).response();
    }

    private void applyConfiguredMode() {
        switch (properties.mode()) {
            case ACCEPT -> {
            }
            case VALIDATION_ERROR -> throw error(HttpStatus.BAD_REQUEST, "VALIDATION_FAILED",
                    "Mock gateway rejected the prescription payload.");
            case SERVER_ERROR -> throw error(HttpStatus.INTERNAL_SERVER_ERROR, "MOCK_GATEWAY_ERROR",
                    "Mock gateway failed while processing the prescription.");
            case NO_RESPONSE -> waitWithoutResponding();
        }
    }

    private void waitWithoutResponding() {
        try {
            Thread.sleep(properties.noResponseDelay().toMillis());
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
        }
        throw error(HttpStatus.GATEWAY_TIMEOUT, "MOCK_GATEWAY_NO_RESPONSE",
                "Mock gateway did not respond before the configured timeout.");
    }

    private void validateRequest(String idempotencyKey, PrescriptionInterconnectionGatewayRequest request) {
        if (request == null) {
            throw error(HttpStatus.BAD_REQUEST, "VALIDATION_FAILED", "Request body is required.");
        }
        requireText(idempotencyKey, "X-Idempotency-Key is required.");
        requireText(request.prescriptionCode(), "prescriptionCode is required.");
        if (!request.prescriptionCode().matches(PRESCRIPTION_CODE_PATTERN)) {
            throw error(HttpStatus.BAD_REQUEST, "VALIDATION_FAILED", "prescriptionCode has an invalid format.");
        }
        if (!idempotencyKey.equals(request.prescriptionCode())) {
            throw error(HttpStatus.BAD_REQUEST, "IDEMPOTENCY_KEY_MISMATCH",
                    "X-Idempotency-Key must equal prescriptionCode.");
        }
        if (request.replacesPrescriptionCode() != null) {
            if (!request.replacesPrescriptionCode().matches(PRESCRIPTION_CODE_PATTERN)) {
                throw error(HttpStatus.BAD_REQUEST, "VALIDATION_FAILED",
                        "replacesPrescriptionCode has an invalid format.");
            }
            if (request.replacesPrescriptionCode().equals(request.prescriptionCode())) {
                throw error(HttpStatus.BAD_REQUEST, "VALIDATION_FAILED",
                        "replacesPrescriptionCode must differ from prescriptionCode.");
            }
        }
        if (request.prescribedAt() == null) {
            throw error(HttpStatus.BAD_REQUEST, "VALIDATION_FAILED", "prescribedAt is required.");
        }
        if (request.clinic() == null || request.doctor() == null || request.patient() == null
                || request.items() == null || request.items().isEmpty()) {
            throw error(HttpStatus.BAD_REQUEST, "VALIDATION_FAILED",
                    "clinic, doctor, patient, and at least one item are required.");
        }
        requireText(request.clinic().id(), "clinic.id is required.");
        requireText(request.clinic().name(), "clinic.name is required.");
        if (request.doctor().id() == null || request.patient().id() == null) {
            throw error(HttpStatus.BAD_REQUEST, "VALIDATION_FAILED", "doctor.id and patient.id are required.");
        }
        requireText(request.doctor().name(), "doctor.name is required.");
        requireText(request.patient().code(), "patient.code is required.");
        requireText(request.patient().name(), "patient.name is required.");
        for (PrescriptionInterconnectionGatewayRequest.Item item : request.items()) {
            if (item == null || item.medicineId() == null || item.frequencyPerDay() <= 0
                    || item.durationDays() <= 0 || item.quantity() <= 0) {
                throw error(HttpStatus.BAD_REQUEST, "VALIDATION_FAILED", "Prescription item is invalid.");
            }
            requireText(item.medicineName(), "item.medicineName is required.");
            requireText(item.activeIngredient(), "item.activeIngredient is required.");
            requireText(item.strength(), "item.strength is required.");
            requireText(item.unit(), "item.unit is required.");
            requireText(item.dosage(), "item.dosage is required.");
            requireText(item.route(), "item.route is required.");
        }
    }

    private void requireText(String value, String message) {
        if (value == null || value.isBlank()) {
            throw error(HttpStatus.BAD_REQUEST, "VALIDATION_FAILED", message);
        }
    }

    private MockInterconnectionGatewayException error(HttpStatus status, String code, String message) {
        return new MockInterconnectionGatewayException(status, code, message);
    }

    public record SubmissionResult(PrescriptionInterconnectionGatewayResponse response, boolean idempotentReplay) {
    }

    private record AcceptedSubmission(
            PrescriptionInterconnectionGatewayRequest request,
            PrescriptionInterconnectionGatewayResponse response
    ) {
    }
}
