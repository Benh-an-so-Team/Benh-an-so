package com.benhsoan.application.ucservice.prescription;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.security.access.AccessDeniedException;

import com.benhsoan.domain.medicine.enums.AdministrationRoute;
import com.benhsoan.domain.prescription.Prescription;
import com.benhsoan.domain.prescription.PrescriptionItem;
import com.benhsoan.domain.prescription.enums.InterconnectionStatus;
import com.benhsoan.domain.prescription.enums.PrescriptionStatus;
import com.benhsoan.domain.prescription.exception.PrescriptionNotFoundException;
import com.benhsoan.domain.shared.exception.ValidationException;
import com.benhsoan.port.dto.result.PrescriptionResult;
import com.benhsoan.port.outbound.repository.prescription.PrescriptionRepository;
import com.benhsoan.port.outbound.repository.prescription.PrescriptionWarningLogRepository;

@DisplayName("GetPrescriptionService Unit Tests")
class GetPrescriptionServiceTest {

    private static final Instant NOW = Instant.parse("2026-08-20T08:00:00Z");

    private final PrescriptionRepository prescriptionRepository = mock(PrescriptionRepository.class);
    private final PrescriptionWarningLogRepository warningLogRepository = mock(PrescriptionWarningLogRepository.class);
    private final PrescriptionReadAccessValidator accessValidator = mock(PrescriptionReadAccessValidator.class);
    private final PrescriptionResultMapper resultMapper = mock(PrescriptionResultMapper.class);

    private GetPrescriptionService service;

    @BeforeEach
    void setUp() {
        service = new GetPrescriptionService(
                prescriptionRepository,
                warningLogRepository,
                accessValidator,
                resultMapper
        );
    }

    @Test
    @DisplayName("getById - returns PrescriptionResult when prescription exists")
    void getById_whenFound_returnsResult() {
        UUID prescriptionId = UUID.randomUUID();
        Prescription prescription = createSamplePrescription(prescriptionId, "RX000001", PrescriptionStatus.PENDING_DISPENSE, null);
        PrescriptionResult expectedResult = createSampleResult(prescriptionId, "RX000001", PrescriptionStatus.PENDING_DISPENSE, null);

        when(prescriptionRepository.findById(prescriptionId)).thenReturn(Optional.of(prescription));
        when(warningLogRepository.findByPrescriptionId(prescriptionId)).thenReturn(List.of());
        when(resultMapper.toResult(prescription, List.of())).thenReturn(expectedResult);

        PrescriptionResult actual = service.getById(prescriptionId);

        assertNotNull(actual);
        assertEquals(prescriptionId, actual.id());
        assertEquals("RX000001", actual.prescriptionCode());
        verify(accessValidator).requireCanRead(prescription);
    }

    @Test
    @DisplayName("getById - throws PrescriptionNotFoundException when ID does not exist")
    void getById_whenNotFound_throwsException() {
        UUID prescriptionId = UUID.randomUUID();
        when(prescriptionRepository.findById(prescriptionId)).thenReturn(Optional.empty());

        assertThrows(PrescriptionNotFoundException.class, () -> service.getById(prescriptionId));
        verify(accessValidator, never()).requireCanRead(any());
    }

    @Test
    @DisplayName("getByCode - returns pending prescription ready for dispensation (TC-01)")
    void getByCode_whenFoundPending_returnsResult() {
        UUID prescriptionId = UUID.randomUUID();
        String code = "RX000003";
        Prescription prescription = createSamplePrescription(prescriptionId, code, PrescriptionStatus.PENDING_DISPENSE, null);
        PrescriptionResult expectedResult = createSampleResult(prescriptionId, code, PrescriptionStatus.PENDING_DISPENSE, null);

        when(prescriptionRepository.findByPrescriptionCode(code)).thenReturn(Optional.of(prescription));
        when(warningLogRepository.findByPrescriptionId(prescriptionId)).thenReturn(List.of());
        when(resultMapper.toResult(prescription, List.of())).thenReturn(expectedResult);

        PrescriptionResult actual = service.getByCode(code);

        assertNotNull(actual);
        assertEquals(code, actual.prescriptionCode());
        assertEquals(PrescriptionStatus.PENDING_DISPENSE, actual.status());
        verify(accessValidator).requireCanRead(prescription);
    }

    @Test
    @DisplayName("getByCode - returns cancelled prescription with cancelReason (TC-02)")
    void getByCode_whenFoundCancelled_returnsResultWithCancelReason() {
        UUID prescriptionId = UUID.randomUUID();
        String code = "RX000004";
        String cancelReason = "Bac si doi phac do dieu tri";
        Prescription prescription = createSamplePrescription(prescriptionId, code, PrescriptionStatus.CANCELLED, cancelReason);
        PrescriptionResult expectedResult = createSampleResult(prescriptionId, code, PrescriptionStatus.CANCELLED, cancelReason);

        when(prescriptionRepository.findByPrescriptionCode(code)).thenReturn(Optional.of(prescription));
        when(warningLogRepository.findByPrescriptionId(prescriptionId)).thenReturn(List.of());
        when(resultMapper.toResult(prescription, List.of())).thenReturn(expectedResult);

        PrescriptionResult actual = service.getByCode(code);

        assertNotNull(actual);
        assertEquals(code, actual.prescriptionCode());
        assertEquals(PrescriptionStatus.CANCELLED, actual.status());
        assertEquals(cancelReason, actual.cancelReason());
        verify(accessValidator).requireCanRead(prescription);
    }

    @Test
    @DisplayName("getByCode - throws PrescriptionNotFoundException when code does not exist (TC-03)")
    void getByCode_whenNotFound_throwsException() {
        String code = "RX999999";
        when(prescriptionRepository.findByPrescriptionCode(code)).thenReturn(Optional.empty());

        PrescriptionNotFoundException ex = assertThrows(
                PrescriptionNotFoundException.class,
                () -> service.getByCode(code)
        );
        assertEquals("Prescription not found with code: " + code, ex.getMessage());
        verify(accessValidator, never()).requireCanRead(any());
    }

    @Test
    @DisplayName("getByCode - normalizes input code with whitespace, control characters and lowercase")
    void getByCode_normalizesCodeWithTrimmingAndUpperCase() {
        UUID prescriptionId = UUID.randomUUID();
        String inputCode = "\r\n\t  rx000005  \t\r\n";
        String normalizedCode = "RX000005";
        Prescription prescription = createSamplePrescription(prescriptionId, normalizedCode, PrescriptionStatus.PENDING_DISPENSE, null);
        PrescriptionResult expectedResult = createSampleResult(prescriptionId, normalizedCode, PrescriptionStatus.PENDING_DISPENSE, null);

        when(prescriptionRepository.findByPrescriptionCode(normalizedCode)).thenReturn(Optional.of(prescription));
        when(warningLogRepository.findByPrescriptionId(prescriptionId)).thenReturn(List.of());
        when(resultMapper.toResult(prescription, List.of())).thenReturn(expectedResult);

        PrescriptionResult actual = service.getByCode(inputCode);

        assertNotNull(actual);
        assertEquals(normalizedCode, actual.prescriptionCode());
        verify(prescriptionRepository).findByPrescriptionCode(normalizedCode);
    }

    @Test
    @DisplayName("getByCode - fast-fails with PrescriptionNotFoundException when code does not match QTN-21 format without hitting repository")
    void getByCode_whenCodeMalformed_throwsNotFoundImmediatelyWithoutHittingDatabase() {
        String[] malformedCodes = {"INVALID", "RX12345", "RX1234567", "BN000001", "12345678", "RX-00001"};

        for (String malformedCode : malformedCodes) {
            PrescriptionNotFoundException ex = assertThrows(
                    PrescriptionNotFoundException.class,
                    () -> service.getByCode(malformedCode)
            );
            assertEquals("Prescription not found with code: " + malformedCode, ex.getMessage());
        }

        verify(prescriptionRepository, never()).findByPrescriptionCode(any());
        verify(accessValidator, never()).requireCanRead(any());
    }

    @Test
    @DisplayName("getByCode - throws ValidationException when code is null or blank")
    void getByCode_whenBlankOrNull_throwsValidationException() {
        assertThrows(ValidationException.class, () -> service.getByCode(null));
        assertThrows(ValidationException.class, () -> service.getByCode(""));
        assertThrows(ValidationException.class, () -> service.getByCode("   "));
        verify(prescriptionRepository, never()).findByPrescriptionCode(any());
    }

    @Test
    @DisplayName("getByCode - throws AccessDeniedException when accessValidator denies permission")
    void getByCode_whenAccessValidatorDenies_throwsAccessDenied() {
        UUID prescriptionId = UUID.randomUUID();
        String code = "RX000006";
        Prescription prescription = createSamplePrescription(prescriptionId, code, PrescriptionStatus.PENDING_DISPENSE, null);

        when(prescriptionRepository.findByPrescriptionCode(code)).thenReturn(Optional.of(prescription));
        doThrow(new AccessDeniedException("Doctors can only view prescriptions of their own visits."))
                .when(accessValidator).requireCanRead(prescription);

        assertThrows(AccessDeniedException.class, () -> service.getByCode(code));
        verify(resultMapper, never()).toResult(any(), any());
    }

    @Test
    @DisplayName("getById - enriches a REPLACED prescription with the replacement link")
    void getById_whenReplaced_enrichesReplacementLink() {
        UUID originalId = UUID.randomUUID();
        UUID replacementId = UUID.randomUUID();
        Prescription original = createSamplePrescription(originalId, "RX000001", PrescriptionStatus.REPLACED, null);
        PrescriptionResult mappedResult = createSampleResult(originalId, "RX000001", PrescriptionStatus.REPLACED, null);
        Prescription replacement = createSamplePrescription(replacementId, "RX000002", PrescriptionStatus.PENDING_DISPENSE, null);

        when(prescriptionRepository.findById(originalId)).thenReturn(Optional.of(original));
        when(warningLogRepository.findByPrescriptionId(originalId)).thenReturn(List.of());
        when(resultMapper.toResult(original, List.of())).thenReturn(mappedResult);
        when(prescriptionRepository.findReplacementOf(originalId)).thenReturn(Optional.of(replacement));

        PrescriptionResult actual = service.getById(originalId);

        assertEquals(replacementId, actual.replacedByPrescriptionId());
        assertEquals("RX000002", actual.replacedByPrescriptionCode());
        verify(prescriptionRepository).findReplacementOf(originalId);
    }

    @Test
    @DisplayName("getByCode - enriches a REPLACED prescription with the replacement link")
    void getByCode_whenReplaced_enrichesReplacementLink() {
        String originalCode = "RX000001";
        UUID originalId = UUID.randomUUID();
        UUID replacementId = UUID.randomUUID();
        Prescription original = createSamplePrescription(originalId, originalCode, PrescriptionStatus.REPLACED, null);
        PrescriptionResult mappedResult = createSampleResult(originalId, originalCode, PrescriptionStatus.REPLACED, null);
        Prescription replacement = createSamplePrescription(replacementId, "RX000002", PrescriptionStatus.PENDING_DISPENSE, null);

        when(prescriptionRepository.findByPrescriptionCode(originalCode)).thenReturn(Optional.of(original));
        when(warningLogRepository.findByPrescriptionId(originalId)).thenReturn(List.of());
        when(resultMapper.toResult(original, List.of())).thenReturn(mappedResult);
        when(prescriptionRepository.findReplacementOf(originalId)).thenReturn(Optional.of(replacement));

        PrescriptionResult actual = service.getByCode(originalCode);

        assertEquals(replacementId, actual.replacedByPrescriptionId());
        assertEquals("RX000002", actual.replacedByPrescriptionCode());
        verify(prescriptionRepository).findReplacementOf(originalId);
    }

    @Test
    @DisplayName("getById - leaves the replacement link empty when no replacement exists")
    void getById_whenReplacedWithoutReplacement_leavesLinkEmpty() {
        UUID originalId = UUID.randomUUID();
        Prescription original = createSamplePrescription(originalId, "RX000001", PrescriptionStatus.REPLACED, null);
        PrescriptionResult mappedResult = createSampleResult(originalId, "RX000001", PrescriptionStatus.REPLACED, null);

        when(prescriptionRepository.findById(originalId)).thenReturn(Optional.of(original));
        when(warningLogRepository.findByPrescriptionId(originalId)).thenReturn(List.of());
        when(resultMapper.toResult(original, List.of())).thenReturn(mappedResult);
        when(prescriptionRepository.findReplacementOf(originalId)).thenReturn(Optional.empty());

        PrescriptionResult actual = service.getById(originalId);

        assertEquals(originalId, actual.id());
        assertEquals(null, actual.replacedByPrescriptionId());
        assertEquals(null, actual.replacedByPrescriptionCode());
    }

    private Prescription createSamplePrescription(UUID id, String code, PrescriptionStatus status, String cancelReason) {
        UUID medicineId = UUID.randomUUID();
        PrescriptionItem item = PrescriptionItem.create(
                UUID.randomUUID(), id, medicineId, "Paracetamol 500mg", "Paracetamol",
                "500mg", "vien", "1 vien", 2, AdministrationRoute.ORAL, 5, 10, "Uong sau an", NOW
        );
        return Prescription.restore(
                id, code, UUID.randomUUID(), status, "Ghi chu don", cancelReason,
                UUID.randomUUID(), NOW, null, null, InterconnectionStatus.NOT_SENT, null, null, null, List.of(item)
        );
    }

    private PrescriptionResult createSampleResult(UUID id, String code, PrescriptionStatus status, String cancelReason) {
        return new PrescriptionResult(
                id, code, UUID.randomUUID(), UUID.randomUUID(), "VISIT-001",
                UUID.randomUUID(), "PAT-001", "Nguyen Van A", status,
                "Ghi chu don", cancelReason, UUID.randomUUID(), "Dr. B", NOW, null, null, List.of(), List.of()
        );
    }
}
