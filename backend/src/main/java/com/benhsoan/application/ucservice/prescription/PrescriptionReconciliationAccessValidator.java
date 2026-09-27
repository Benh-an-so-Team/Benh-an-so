package com.benhsoan.application.ucservice.prescription;

import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Component;

import com.benhsoan.port.outbound.security.CurrentUserPort;

import lombok.RequiredArgsConstructor;

/**
 * Service level authorization for NCL-12-CN-007.
 *
 * Authorization is permission based (not role name based) and shares the exact permission
 * codes used by the REST layer, so a reachable endpoint and a reachable use case always
 * agree. The workbook allows only ADMIN and PHARMACIST to reconcile and record reasons.
 *
 * This validator never grants retransmission: retransmission stays with the untouched
 * NCL-12-CN-004 retry flow (PRESCRIPTION_INTERCONNECTION_RETRY, ADMIN only).
 *
 * Denial auditing is not repeated here. The existing RequirePermissionAspect already writes
 * the ACCESS_DENIED audit entry, and duplicating it would create two records for one denial.
 */
@Component
@RequiredArgsConstructor
public class PrescriptionReconciliationAccessValidator {

    public static final String VIEW_PERMISSION = "PRESCRIPTION_RECONCILIATION_VIEW";

    public static final String NOTE_PERMISSION = "PRESCRIPTION_RECONCILIATION_NOTE";

    private final CurrentUserPort currentUserPort;

    public void requireCanView() {
        if (!currentUserPort.hasPermission(VIEW_PERMISSION)) {
            throw new AccessDeniedException(
                    "Only administrators and pharmacists can view prescription reconciliation.");
        }
    }

    public void requireCanRecordNote() {
        if (!currentUserPort.hasPermission(NOTE_PERMISSION)) {
            throw new AccessDeniedException(
                    "Only administrators and pharmacists can record reconciliation reasons.");
        }
    }
}
