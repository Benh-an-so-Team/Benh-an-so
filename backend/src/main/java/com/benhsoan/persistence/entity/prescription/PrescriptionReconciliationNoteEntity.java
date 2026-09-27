package com.benhsoan.persistence.entity.prescription;

import java.time.Instant;
import java.util.UUID;

import com.benhsoan.domain.prescription.enums.PrescriptionReconciliationOutcome;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Append only reconciliation note (NCL-12-CN-007, migration V102).
 *
 * The table is never updated, and application code only deletes from it through
 * {@code MedicalRecordCascadeDeleter}, which removes the notes of a medical record before its
 * prescriptions, exactly like the other prescription child tables.
 */
@Entity
@Table(name = "prescription_reconciliation_notes")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PrescriptionReconciliationNoteEntity {

    @Id
    @Column(name = "id", nullable = false, columnDefinition = "BINARY(16)")
    private UUID id;

    @Column(name = "prescription_id", nullable = false, columnDefinition = "BINARY(16)")
    private UUID prescriptionId;

    @Enumerated(EnumType.STRING)
    @Column(name = "reconciliation_outcome", nullable = false, length = 40)
    private PrescriptionReconciliationOutcome reconciliationOutcome;

    @Column(name = "reason", nullable = false, length = 500)
    private String reason;

    @Column(name = "noted_by", nullable = false, columnDefinition = "BINARY(16)")
    private UUID notedBy;

    @Column(name = "noted_at", nullable = false)
    private Instant notedAt;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;
}
