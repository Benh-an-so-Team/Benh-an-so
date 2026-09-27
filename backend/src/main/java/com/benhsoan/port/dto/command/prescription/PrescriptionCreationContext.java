package com.benhsoan.port.dto.command.prescription;

/**
 * NCL-12-CN-008: distinguishes the ordinary prescription creation flow from the
 * replacement creation flow without weakening the active-visit rule for normal
 * creation/amendment.
 *
 * <p>A {@link #REPLACEMENT} creation skips only the active-visit check while every
 * other rule (editable medical record, responsible doctor, diagnosis requirement,
 * medicine validity, warning confirmations, security and audit) stays enforced.
 */
public enum PrescriptionCreationContext {

    STANDARD,

    REPLACEMENT
}
