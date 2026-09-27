package com.benhsoan.application.ucservice.prescription;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;

import com.benhsoan.domain.medicalrecord.DiagnosisCatalog;
import com.benhsoan.domain.prescription.PrescriptionTemplate;
import com.benhsoan.port.dto.result.PrescriptionTemplateResult;
import com.benhsoan.port.outbound.repository.medicalrecord.DiagnosisCatalogRepository;
import com.benhsoan.port.outbound.repository.prescription.PrescriptionTemplateRepository;
import com.benhsoan.port.outbound.security.CurrentUserPort;

/**
 * NCL-05-CN-008: locks the doctor-scoped, empty-list semantics of
 * {@link GetPrescriptionTemplatesService}. Templates are personal to the calling
 * doctor; a diagnosis with no saved template (for example B34.9) correctly returns
 * an empty list rather than any shared/system template.
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("GetPrescriptionTemplatesService - NCL-05-CN-008")
class GetPrescriptionTemplatesServiceTest {

    private static final UUID DOCTOR_ID = UUID.randomUUID();
    private static final UUID DIAGNOSIS_ID = UUID.randomUUID();

    @Mock private PrescriptionTemplateRepository templateRepository;
    @Mock private DiagnosisCatalogRepository diagnosisCatalogRepository;
    @Mock private PrescriptionTemplateResultMapper resultMapper;
    @Mock private CurrentUserPort currentUserPort;

    private GetPrescriptionTemplatesService service;

    @BeforeEach
    void setUp() {
        service = new GetPrescriptionTemplatesService(
                templateRepository, diagnosisCatalogRepository, resultMapper, currentUserPort);
    }

    @Test
    void nonDoctorIsRejected() {
        when(currentUserPort.hasRole("DOCTOR")).thenReturn(false);

        assertThrows(AccessDeniedException.class, () -> service.getByDiagnosisCode("B34.9"));

        verify(currentUserPort, never()).getCurrentUserId();
        verify(diagnosisCatalogRepository, never()).findByCode("B34.9");
        verify(templateRepository, never())
                .findByDiagnosisCatalogIdAndCreatedBy(DIAGNOSIS_ID, DOCTOR_ID);
    }

    @Test
    void unknownDiagnosisCodeReturnsEmptyList() {
        when(currentUserPort.hasRole("DOCTOR")).thenReturn(true);
        when(currentUserPort.getCurrentUserId()).thenReturn(DOCTOR_ID);
        when(diagnosisCatalogRepository.findByCode("B34.9")).thenReturn(Optional.empty());

        assertTrue(service.getByDiagnosisCode("B34.9").isEmpty());

        verify(templateRepository, never())
                .findByDiagnosisCatalogIdAndCreatedBy(DIAGNOSIS_ID, DOCTOR_ID);
    }

    @Test
    void diagnosisWithoutSavedTemplateReturnsEmptyList() {
        DiagnosisCatalog diagnosis = diagnosis();

        when(currentUserPort.hasRole("DOCTOR")).thenReturn(true);
        when(currentUserPort.getCurrentUserId()).thenReturn(DOCTOR_ID);
        when(diagnosisCatalogRepository.findByCode("B34.9")).thenReturn(Optional.of(diagnosis));
        when(templateRepository.findByDiagnosisCatalogIdAndCreatedBy(DIAGNOSIS_ID, DOCTOR_ID))
                .thenReturn(List.of());

        assertTrue(service.getByDiagnosisCode("B34.9").isEmpty());
    }

    @Test
    void returnsOnlyCallingDoctorsTemplatesForDiagnosis() {
        DiagnosisCatalog diagnosis = diagnosis();

        when(currentUserPort.hasRole("DOCTOR")).thenReturn(true);
        when(currentUserPort.getCurrentUserId()).thenReturn(DOCTOR_ID);
        when(diagnosisCatalogRepository.findByCode("B34.9")).thenReturn(Optional.of(diagnosis));

        PrescriptionTemplate first = mock(PrescriptionTemplate.class);
        PrescriptionTemplate second = mock(PrescriptionTemplate.class);
        when(templateRepository.findByDiagnosisCatalogIdAndCreatedBy(DIAGNOSIS_ID, DOCTOR_ID))
                .thenReturn(List.of(first, second));

        PrescriptionTemplateResult firstResult = mock(PrescriptionTemplateResult.class);
        PrescriptionTemplateResult secondResult = mock(PrescriptionTemplateResult.class);
        when(resultMapper.toResult(first)).thenReturn(firstResult);
        when(resultMapper.toResult(second)).thenReturn(secondResult);

        List<PrescriptionTemplateResult> result = service.getByDiagnosisCode("B34.9");

        assertEquals(2, result.size());
        assertEquals(firstResult, result.get(0));
        assertEquals(secondResult, result.get(1));
        verify(templateRepository).findByDiagnosisCatalogIdAndCreatedBy(DIAGNOSIS_ID, DOCTOR_ID);
    }

    private DiagnosisCatalog diagnosis() {
        DiagnosisCatalog diagnosis = mock(DiagnosisCatalog.class);
        when(diagnosis.getId()).thenReturn(DIAGNOSIS_ID);
        return diagnosis;
    }
}
