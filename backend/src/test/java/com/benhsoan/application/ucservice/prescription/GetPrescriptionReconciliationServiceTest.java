package com.benhsoan.application.ucservice.prescription;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.security.access.AccessDeniedException;

import com.benhsoan.application.ucservice.anonymization.AnonymizationModeState;
import com.benhsoan.domain.prescription.enums.InterconnectionStatus;
import com.benhsoan.domain.prescription.enums.PrescriptionReconciliationOutcome;
import com.benhsoan.domain.prescription.enums.PrescriptionStatus;
import com.benhsoan.domain.shared.exception.ValidationException;
import com.benhsoan.port.dto.command.prescription.SearchPrescriptionReconciliationQuery;
import com.benhsoan.port.dto.query.prescription.ReconciliationOutcomeGroup;
import com.benhsoan.port.dto.query.prescription.ReconciliationQueryFilter;
import com.benhsoan.port.dto.result.PrescriptionReconciliationItemResult;
import com.benhsoan.port.outbound.repository.prescription.PrescriptionReconciliationQueryRepository;

@DisplayName("GetPrescriptionReconciliationService - NCL-12-CN-007")
class GetPrescriptionReconciliationServiceTest {

    private static final Instant FROM = Instant.parse("2026-09-01T00:00:00Z");

    private static final Instant TO = Instant.parse("2026-10-01T00:00:00Z");

    private PrescriptionReconciliationQueryRepository repository;

    private PrescriptionReconciliationAccessValidator accessValidator;

    private AnonymizationModeState anonymizationModeState;

    private GetPrescriptionReconciliationService service;

    @BeforeEach
    void setUp() {
        repository = mock(PrescriptionReconciliationQueryRepository.class);
        accessValidator = mock(PrescriptionReconciliationAccessValidator.class);
        anonymizationModeState = new AnonymizationModeState();
        service = new GetPrescriptionReconciliationService(
                repository, accessValidator, anonymizationModeState);
        when(repository.findByFilter(any(), any())).thenReturn(Page.empty());
    }

    private SearchPrescriptionReconciliationQuery query(
            PrescriptionReconciliationOutcome outcome,
            boolean discrepanciesOnly
    ) {
        return new SearchPrescriptionReconciliationQuery(
                FROM, TO, outcome, discrepanciesOnly, null, 0, 20);
    }

    @Test
    void authorizedViewerIsCheckedAndPeriodIsPassedToTheQuery() {
        service.search(query(null, false));

        verify(accessValidator).requireCanView();
        ArgumentCaptor<ReconciliationQueryFilter> captor =
                ArgumentCaptor.forClass(ReconciliationQueryFilter.class);
        verify(repository).findByFilter(captor.capture(), any());
        assertEquals(FROM, captor.getValue().fromInclusive());
        assertEquals(TO, captor.getValue().toExclusive());
        assertFalse(captor.getValue().periodUnbounded());
        assertTrue(captor.getValue().outcomeGroups().isEmpty());
    }

    @Test
    void nullPeriodIsUnbounded() {
        service.search(new SearchPrescriptionReconciliationQuery(null, null, null, false, null, 0, 20));

        ArgumentCaptor<ReconciliationQueryFilter> captor =
                ArgumentCaptor.forClass(ReconciliationQueryFilter.class);
        verify(repository).findByFilter(captor.capture(), any());
        assertTrue(captor.getValue().periodUnbounded());
    }

    @Test
    void discrepanciesOnlyExpandsToExactlyTheTwoWorkbookCategories() {
        service.search(query(null, true));

        ArgumentCaptor<ReconciliationQueryFilter> captor =
                ArgumentCaptor.forClass(ReconciliationQueryFilter.class);
        verify(repository).findByFilter(captor.capture(), any());
        List<ReconciliationOutcomeGroup> groups = captor.getValue().outcomeGroups();

        assertEquals(2, groups.size());
        assertEquals(Set.of(PrescriptionStatus.PENDING_DISPENSE),
                Set.copyOf(groups.get(0).dispensingStatuses()));
        assertEquals(Set.of(InterconnectionStatus.SUCCESS),
                Set.copyOf(groups.get(0).interconnectionStatuses()));
        assertEquals(Set.of(PrescriptionStatus.DISPENSED, PrescriptionStatus.PARTIALLY_DISPENSED),
                Set.copyOf(groups.get(1).dispensingStatuses()));
        assertEquals(Set.of(InterconnectionStatus.NOT_SENT, InterconnectionStatus.FAILED),
                Set.copyOf(groups.get(1).interconnectionStatuses()));
    }

    @Test
    void explicitOutcomeWinsOverDiscrepanciesOnly() {
        service.search(query(PrescriptionReconciliationOutcome.CANCELLED, true));

        ArgumentCaptor<ReconciliationQueryFilter> captor =
                ArgumentCaptor.forClass(ReconciliationQueryFilter.class);
        verify(repository).findByFilter(captor.capture(), any());
        List<ReconciliationOutcomeGroup> groups = captor.getValue().outcomeGroups();

        assertEquals(1, groups.size());
        assertEquals(List.of(PrescriptionStatus.CANCELLED), groups.get(0).dispensingStatuses());
    }

    @Test
    void orderingIsLeftToTheQueryAndPageableIsUnsorted() {
        service.search(query(null, false));

        ArgumentCaptor<Pageable> captor = ArgumentCaptor.forClass(Pageable.class);
        verify(repository).findByFilter(any(), captor.capture());
        assertTrue(captor.getValue().getSort().isUnsorted());
        assertEquals(0, captor.getValue().getPageNumber());
        assertEquals(20, captor.getValue().getPageSize());
    }

    @Test
    void invertedRangeIsRejectedBeforeQuerying() {
        ValidationException exception = assertThrows(ValidationException.class, () -> service.search(
                new SearchPrescriptionReconciliationQuery(TO, FROM, null, false, null, 0, 20)));

        assertTrue(exception.getMessage().contains("from must be before or equal to to"));
        verifyNoInteractions(repository);
    }

    @Test
    void pageSizeIsValidated() {
        assertThrows(ValidationException.class,
                () -> new SearchPrescriptionReconciliationQuery(null, null, null, false, null, 0, 0));
        assertThrows(ValidationException.class,
                () -> new SearchPrescriptionReconciliationQuery(null, null, null, false, null, 0, 101));
        assertThrows(ValidationException.class,
                () -> new SearchPrescriptionReconciliationQuery(null, null, null, false, null, -1, 20));
    }

    @Test
    void prescriptionCodeFilterIsNormalized() {
        service.search(new SearchPrescriptionReconciliationQuery(
                null, null, null, false, "  RX000123  ", 0, 20));

        ArgumentCaptor<ReconciliationQueryFilter> captor =
                ArgumentCaptor.forClass(ReconciliationQueryFilter.class);
        verify(repository).findByFilter(captor.capture(), any());
        assertEquals("RX000123", captor.getValue().prescriptionCode());
    }

    @Test
    void blankPrescriptionCodeBecomesNull() {
        service.search(new SearchPrescriptionReconciliationQuery(
                null, null, null, false, "   ", 0, 20));

        ArgumentCaptor<ReconciliationQueryFilter> captor =
                ArgumentCaptor.forClass(ReconciliationQueryFilter.class);
        verify(repository).findByFilter(captor.capture(), any());
        assertTrue(captor.getValue().prescriptionCode() == null);
    }

    @Test
    void anonymizationMasksPatientName() {
        UUID prescriptionId = UUID.randomUUID();
        when(repository.findByFilter(any(), any())).thenReturn(
                new PageImpl<>(List.of(row(prescriptionId, "Nguyen Van A", "PA001"))));
        anonymizationModeState.setEnabled(true);

        Page<PrescriptionReconciliationItemResult> page = service.search(query(null, false));

        assertEquals("BỆNH NHÂN #PA001", page.getContent().get(0).patientName());
        assertEquals("PA001", page.getContent().get(0).patientCode());
    }

    @Test
    void anonymizationDisabledKeepsRealPatientName() {
        when(repository.findByFilter(any(), any())).thenReturn(
                new PageImpl<>(List.of(row(UUID.randomUUID(), "Nguyen Van A", "PA001"))));

        Page<PrescriptionReconciliationItemResult> page = service.search(query(null, false));

        assertEquals("Nguyen Van A", page.getContent().get(0).patientName());
    }

    @Test
    void deniedViewerIsRejected() {
        doThrowAccessDenied();

        assertThrows(AccessDeniedException.class, () -> service.search(query(null, false)));
        verifyNoInteractions(repository);
    }

    private void doThrowAccessDenied() {
        org.mockito.Mockito.doThrow(new AccessDeniedException("denied"))
                .when(accessValidator).requireCanView();
    }

    private static PrescriptionReconciliationItemResult row(
            UUID prescriptionId,
            String patientName,
            String patientCode
    ) {
        return new PrescriptionReconciliationItemResult(
                prescriptionId,
                "RX000001",
                UUID.randomUUID(),
                patientCode,
                patientName,
                UUID.randomUUID(),
                "Dr. B",
                PrescriptionStatus.DISPENSED,
                InterconnectionStatus.FAILED,
                PrescriptionReconciliationOutcome.DISPENSED_NOT_TRANSMITTED,
                true,
                true,
                Instant.parse("2026-09-10T02:00:00Z"),
                Instant.parse("2026-09-10T03:00:00Z"),
                Instant.parse("2026-09-11T02:00:00Z"),
                "gateway timeout",
                null,
                1L);
    }
}
