package com.benhsoan.persistence.entity.personaldata;

import java.time.Instant;
import java.util.UUID;

import com.benhsoan.domain.personaldata.enums.PersonalDataRequestStatus;

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
@Table(name = "personal_data_requests")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PersonalDataRequestEntity {

    @Id
    @Column(name = "id", nullable = false, columnDefinition = "BINARY(16)")
    private UUID id;

    @Column(name = "patient_id", nullable = false, columnDefinition = "BINARY(16)")
    private UUID patientId;

    @Column(name = "request_type", nullable = false, length = 50)
    private String requestType;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 30)
    private PersonalDataRequestStatus status;

    @Column(name = "reason", length = 2000)
    private String reason;

    @Column(name = "received_at", nullable = false)
    private Instant receivedAt;

    @Column(name = "due_at", nullable = false)
    private Instant dueAt;

    @Column(name = "result", length = 2000)
    private String result;

    @Column(name = "completed_at")
    private Instant completedAt;

    @Column(name = "processed_by", columnDefinition = "BINARY(16)")
    private UUID processedBy;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at")
    private Instant updatedAt;
}
