package com.benhsoan.persistence.entity.prescription;

import java.time.Instant;
import java.util.UUID;

import com.benhsoan.domain.prescription.enums.PrescriptionStatus;
import com.benhsoan.domain.prescription.enums.InterconnectionStatus;

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

@Entity
@Table(name = "prescriptions")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PrescriptionEntity {

    @Id
    @Column(name = "id", nullable = false, columnDefinition = "BINARY(16)")
    private UUID id;

    @Column(name = "prescription_code", nullable = false, unique = true, length = 30)
    private String prescriptionCode;

    @Column(name = "medical_record_id", nullable = false, columnDefinition = "BINARY(16)")
    private UUID medicalRecordId;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 30)
    private PrescriptionStatus status;

    @Column(name = "note", columnDefinition = "TEXT")
    private String note;

    @Column(name = "cancel_reason", length = 500)
    private String cancelReason;

    @Column(name = "prescribed_by", nullable = false, columnDefinition = "BINARY(16)")
    private UUID prescribedBy;

    @Column(name = "prescribed_at", nullable = false)
    private Instant prescribedAt;

    @Column(name = "updated_by", columnDefinition = "BINARY(16)")
    private UUID updatedBy;

    @Column(name = "updated_at")
    private Instant updatedAt;

    @Enumerated(EnumType.STRING)
    @Column(name = "interconnection_status", nullable = false, length = 20)
    private InterconnectionStatus interconnectionStatus;

    @Column(name = "last_interconnection_at")
    private Instant lastInterconnectionAt;

    @Column(name = "last_interconnection_error", columnDefinition = "TEXT")
    private String lastInterconnectionError;

    @Column(name = "interconnection_receipt_code", length = 50)
    private String interconnectionReceiptCode;

    @Column(name = "replaces_prescription_id", columnDefinition = "BINARY(16)")
    private UUID replacesPrescriptionId;

    @Column(name = "replaces_prescription_code", length = 30)
    private String replacesPrescriptionCode;

    @Column(name = "replacement_reason", length = 500)
    private String replacementReason;
}
