package com.benhsoan.adapter.inbound.rest.response.dashboard;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

import com.benhsoan.domain.appointment.enums.AppointmentStatus;
import com.benhsoan.domain.clinical.enums.ClinicalResultAbnormalFlag;
import com.benhsoan.domain.clinical.enums.ClinicalResultStatus;
import com.benhsoan.domain.clinical.enums.ClinicalResultType;
import com.benhsoan.domain.medicalrecord.enums.MedicalRecordStatus;
import com.benhsoan.domain.queue.enums.QueueItemStatus;
import com.benhsoan.domain.queue.enums.QueuePriority;

public record DoctorDashboardResponse(
        SummaryResponse summary,
        List<AppointmentItemResponse> appointments,
        List<QueueItemResponse> queue,
        List<PendingMedicalRecordResponse> pendingMedicalRecords,
        List<ClinicalResultResponse> newClinicalResults,
        Instant generatedAt
) {

    public record SummaryResponse(
            int todayAppointmentsCount,
            int waitingQueueCount,
            int inProgressQueueCount,
            int pendingSignaturesCount,
            int overdueSignaturesCount,
            int newClinicalResultsCount,
            int abnormalClinicalResultsCount
    ) {
    }

    public record AppointmentItemResponse(
            UUID appointmentId,
            String appointmentCode,
            UUID patientId,
            String patientCode,
            String patientName,
            String patientPhone,
            Instant startTime,
            Instant endTime,
            AppointmentStatus status,
            String reason
    ) {
    }

    public record QueueItemResponse(
            UUID queueItemId,
            UUID medicalQueueId,
            int queueNumber,
            UUID patientId,
            String patientCode,
            String patientName,
            UUID roomId,
            String roomNumber,
            UUID visitId,
            String visitCode,
            QueueItemStatus status,
            QueuePriority priority,
            Instant checkedInAt,
            Instant calledAt
    ) {
    }

    public record PendingMedicalRecordResponse(
            UUID medicalRecordId,
            UUID visitId,
            String visitCode,
            UUID patientId,
            String patientCode,
            String patientName,
            MedicalRecordStatus status,
            Instant visitCompletedAt,
            Instant deadlineAt,
            boolean isOverdue,
            long overdueHours,
            long reminderCount
    ) {
    }

    public record ClinicalResultResponse(
            UUID clinicalResultId,
            UUID clinicalOrderItemId,
            String serviceCode,
            String serviceName,
            UUID visitId,
            String visitCode,
            UUID patientId,
            String patientCode,
            String patientName,
            ClinicalResultType resultType,
            BigDecimal numericValue,
            String textValue,
            String unit,
            String referenceRange,
            ClinicalResultAbnormalFlag abnormalFlag,
            String conclusion,
            ClinicalResultStatus status,
            Instant enteredAt
    ) {
    }
}
