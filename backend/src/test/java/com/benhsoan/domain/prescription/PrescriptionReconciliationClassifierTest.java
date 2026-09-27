package com.benhsoan.domain.prescription;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.Arrays;
import java.util.List;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import com.benhsoan.domain.prescription.enums.InterconnectionStatus;
import com.benhsoan.domain.prescription.enums.PrescriptionReconciliationOutcome;
import com.benhsoan.domain.prescription.enums.PrescriptionStatus;
import com.benhsoan.domain.shared.exception.ValidationException;

/**
 * NCL-12-CN-007 CV-01: every row of the locked reconciliation matrix.
 */
@DisplayName("PrescriptionReconciliationClassifier - NCL-12-CN-007")
class PrescriptionReconciliationClassifierTest {

    private static PrescriptionReconciliationOutcome classify(
            PrescriptionStatus dispensingStatus,
            InterconnectionStatus interconnectionStatus
    ) {
        return PrescriptionReconciliationClassifier.classify(dispensingStatus, interconnectionStatus);
    }

    @Test
    void successAndDispensedIsConsistent() {
        assertEquals(PrescriptionReconciliationOutcome.CONSISTENT,
                classify(PrescriptionStatus.DISPENSED, InterconnectionStatus.SUCCESS));
        assertFalse(PrescriptionReconciliationClassifier.isDiscrepancy(
                PrescriptionStatus.DISPENSED, InterconnectionStatus.SUCCESS));
        assertFalse(PrescriptionReconciliationClassifier.isRetransmissionEligible(
                InterconnectionStatus.SUCCESS));
    }

    @Test
    void partialDispensingIsNotADiscrepancy() {
        assertEquals(PrescriptionReconciliationOutcome.CONSISTENT,
                classify(PrescriptionStatus.PARTIALLY_DISPENSED, InterconnectionStatus.SUCCESS));
        assertFalse(PrescriptionReconciliationClassifier.isDiscrepancy(
                PrescriptionStatus.PARTIALLY_DISPENSED, InterconnectionStatus.SUCCESS));
    }

    @Test
    void transmittedButNotDispensedIsADiscrepancy() {
        assertEquals(PrescriptionReconciliationOutcome.TRANSMITTED_NOT_DISPENSED,
                classify(PrescriptionStatus.PENDING_DISPENSE, InterconnectionStatus.SUCCESS));
        assertTrue(PrescriptionReconciliationClassifier.isDiscrepancy(
                PrescriptionStatus.PENDING_DISPENSE, InterconnectionStatus.SUCCESS));
        assertFalse(PrescriptionReconciliationClassifier.isRetransmissionEligible(
                InterconnectionStatus.SUCCESS));
    }

    @Test
    void failedAndDispensedIsADiscrepancyAndRetransmissionEligible() {
        assertEquals(PrescriptionReconciliationOutcome.DISPENSED_NOT_TRANSMITTED,
                classify(PrescriptionStatus.DISPENSED, InterconnectionStatus.FAILED));
        assertTrue(PrescriptionReconciliationClassifier.isDiscrepancy(
                PrescriptionStatus.DISPENSED, InterconnectionStatus.FAILED));
        assertTrue(PrescriptionReconciliationClassifier.isRetransmissionEligible(
                InterconnectionStatus.FAILED));
    }

    @Test
    void failedAndPartiallyDispensedIsADiscrepancyAndRetransmissionEligible() {
        assertEquals(PrescriptionReconciliationOutcome.DISPENSED_NOT_TRANSMITTED,
                classify(PrescriptionStatus.PARTIALLY_DISPENSED, InterconnectionStatus.FAILED));
        assertTrue(PrescriptionReconciliationClassifier.isDiscrepancy(
                PrescriptionStatus.PARTIALLY_DISPENSED, InterconnectionStatus.FAILED));
        assertTrue(PrescriptionReconciliationClassifier.isRetransmissionEligible(
                InterconnectionStatus.FAILED));
    }

    @Test
    void neverSentAndDispensedIsADiscrepancyButNotRetransmissionEligible() {
        assertEquals(PrescriptionReconciliationOutcome.DISPENSED_NOT_TRANSMITTED,
                classify(PrescriptionStatus.DISPENSED, InterconnectionStatus.NOT_SENT));
        assertTrue(PrescriptionReconciliationClassifier.isDiscrepancy(
                PrescriptionStatus.DISPENSED, InterconnectionStatus.NOT_SENT));
        assertFalse(PrescriptionReconciliationClassifier.isRetransmissionEligible(
                InterconnectionStatus.NOT_SENT));
    }

    @Test
    void neverSentAndPartiallyDispensedIsADiscrepancyButNotRetransmissionEligible() {
        assertEquals(PrescriptionReconciliationOutcome.DISPENSED_NOT_TRANSMITTED,
                classify(PrescriptionStatus.PARTIALLY_DISPENSED, InterconnectionStatus.NOT_SENT));
        assertTrue(PrescriptionReconciliationClassifier.isDiscrepancy(
                PrescriptionStatus.PARTIALLY_DISPENSED, InterconnectionStatus.NOT_SENT));
        assertFalse(PrescriptionReconciliationClassifier.isRetransmissionEligible(
                InterconnectionStatus.NOT_SENT));
    }

    @Test
    void pendingDispenseWithoutSuccessfulTransmissionIsNotADiscrepancy() {
        assertEquals(PrescriptionReconciliationOutcome.NOT_TRANSMITTED_NOT_DISPENSED,
                classify(PrescriptionStatus.PENDING_DISPENSE, InterconnectionStatus.FAILED));
        assertEquals(PrescriptionReconciliationOutcome.NOT_TRANSMITTED_NOT_DISPENSED,
                classify(PrescriptionStatus.PENDING_DISPENSE, InterconnectionStatus.NOT_SENT));
        assertFalse(PrescriptionReconciliationClassifier.isDiscrepancy(
                PrescriptionStatus.PENDING_DISPENSE, InterconnectionStatus.FAILED));
        assertFalse(PrescriptionReconciliationClassifier.isDiscrepancy(
                PrescriptionStatus.PENDING_DISPENSE, InterconnectionStatus.NOT_SENT));
    }

    @Test
    void cancelledIsVisibleAndOutsideScopeForEveryInterconnectionStatus() {
        for (InterconnectionStatus interconnectionStatus : InterconnectionStatus.values()) {
            assertEquals(PrescriptionReconciliationOutcome.CANCELLED,
                    classify(PrescriptionStatus.CANCELLED, interconnectionStatus));
            assertFalse(PrescriptionReconciliationClassifier.isDiscrepancy(
                    PrescriptionStatus.CANCELLED, interconnectionStatus));
        }
    }

    @Test
    void retransmissionEligibilityIsDerivedStrictlyFromFailed() {
        assertTrue(PrescriptionReconciliationClassifier.isRetransmissionEligible(
                InterconnectionStatus.FAILED));
        assertFalse(PrescriptionReconciliationClassifier.isRetransmissionEligible(
                InterconnectionStatus.NOT_SENT));
        assertFalse(PrescriptionReconciliationClassifier.isRetransmissionEligible(
                InterconnectionStatus.SUCCESS));
    }

    @Test
    void exactlyTwoOutcomesAreDiscrepancies() {
        List<PrescriptionReconciliationOutcome> discrepancies = Arrays
                .stream(PrescriptionReconciliationOutcome.values())
                .filter(PrescriptionReconciliationOutcome::isDiscrepancy)
                .toList();

        assertEquals(2, discrepancies.size());
        assertTrue(discrepancies.contains(PrescriptionReconciliationOutcome.TRANSMITTED_NOT_DISPENSED));
        assertTrue(discrepancies.contains(PrescriptionReconciliationOutcome.DISPENSED_NOT_TRANSMITTED));
    }

    @Test
    void everyDispensingAndInterconnectionCombinationIsClassified() {
        for (PrescriptionStatus dispensingStatus : PrescriptionStatus.values()) {
            for (InterconnectionStatus interconnectionStatus : InterconnectionStatus.values()) {
                PrescriptionReconciliationOutcome outcome = classify(dispensingStatus, interconnectionStatus);
                assertTrue(outcome.dispensingStatuses().contains(dispensingStatus),
                        "outcome " + outcome + " must cover dispensing status " + dispensingStatus);
                assertTrue(outcome.interconnectionStatuses().contains(interconnectionStatus),
                        "outcome " + outcome + " must cover interconnection status " + interconnectionStatus);
            }
        }
    }

    @Test
    void nullStatesAreRejected() {
        assertThrows(ValidationException.class,
                () -> classify(null, InterconnectionStatus.SUCCESS));
        assertThrows(ValidationException.class,
                () -> classify(PrescriptionStatus.DISPENSED, null));
        assertThrows(ValidationException.class,
                () -> PrescriptionReconciliationClassifier.isRetransmissionEligible(null));
    }
}
