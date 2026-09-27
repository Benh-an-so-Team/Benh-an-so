package com.benhsoan.application.ucservice.prescription;

import java.util.List;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.benhsoan.application.ucservice.anonymization.AnonymizationModeState;
import com.benhsoan.domain.patient.PatientAnonymizer;
import com.benhsoan.domain.shared.exception.ValidationException;
import com.benhsoan.port.dto.command.prescription.SearchPrescriptionReconciliationQuery;
import com.benhsoan.port.dto.query.prescription.ReconciliationOutcomeGroup;
import com.benhsoan.port.dto.query.prescription.ReconciliationQueryFilter;
import com.benhsoan.port.dto.result.PrescriptionReconciliationItemResult;
import com.benhsoan.port.inbound.prescription.GetPrescriptionReconciliationUseCase;
import com.benhsoan.port.outbound.repository.prescription.PrescriptionReconciliationQueryRepository;

import lombok.RequiredArgsConstructor;

/**
 * NCL-12-CN-007 CV-02: reconciliation listing service.
 *
 * Reconciliation state is derived from persisted interconnection and dispensing state; no
 * reconciliation status is stored. Actor identity is never taken from the request.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class GetPrescriptionReconciliationService implements GetPrescriptionReconciliationUseCase {

    private final PrescriptionReconciliationQueryRepository reconciliationQueryRepository;
    private final PrescriptionReconciliationAccessValidator accessValidator;
    private final AnonymizationModeState anonymizationModeState;

    @Override
    public Page<PrescriptionReconciliationItemResult> search(
            SearchPrescriptionReconciliationQuery query
    ) {
        accessValidator.requireCanView();
        validatePeriod(query);

        ReconciliationQueryFilter filter = new ReconciliationQueryFilter(
                query.from(),
                query.to(),
                query.normalizedPrescriptionCode(),
                toOutcomeGroups(query));

        Page<PrescriptionReconciliationItemResult> page = reconciliationQueryRepository.findByFilter(
                filter, PageRequest.of(query.page(), query.size()));

        if (!anonymizationModeState.isEnabled()) {
            return page;
        }
        return page.map(GetPrescriptionReconciliationService::maskPatientName);
    }

    private void validatePeriod(SearchPrescriptionReconciliationQuery query) {
        if (query.from() != null && query.to() != null && query.from().isAfter(query.to())) {
            throw new ValidationException("from must be before or equal to to.");
        }
    }

    private List<ReconciliationOutcomeGroup> toOutcomeGroups(
            SearchPrescriptionReconciliationQuery query
    ) {
        return query.requestedOutcomes().stream()
                .map(outcome -> new ReconciliationOutcomeGroup(
                        List.copyOf(outcome.dispensingStatuses()),
                        List.copyOf(outcome.interconnectionStatuses())))
                .toList();
    }

    private static PrescriptionReconciliationItemResult maskPatientName(
            PrescriptionReconciliationItemResult row
    ) {
        return new PrescriptionReconciliationItemResult(
                row.prescriptionId(),
                row.prescriptionCode(),
                row.patientId(),
                row.patientCode(),
                PatientAnonymizer.maskFullName(row.patientCode()),
                row.doctorId(),
                row.doctorName(),
                row.prescriptionStatus(),
                row.interconnectionStatus(),
                row.outcome(),
                row.discrepancy(),
                row.retransmissionEligible(),
                row.prescribedAt(),
                row.lastInterconnectionAt(),
                row.lastDispensedAt(),
                row.lastInterconnectionError(),
                row.interconnectionReceiptCode(),
                row.reconciliationNoteCount());
    }
}
