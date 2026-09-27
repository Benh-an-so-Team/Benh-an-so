package com.benhsoan.adapter.inbound.rest.mapper;

import org.springframework.stereotype.Component;

import com.benhsoan.adapter.inbound.rest.response.dashboard.DoctorDashboardResponse;
import com.benhsoan.application.ucservice.anonymization.AnonymizationModeState;
import com.benhsoan.domain.patient.PatientAnonymizer;
import com.benhsoan.port.dto.result.DoctorDashboardResult;

@Component
public class DoctorDashboardRestMapper {

    private final AnonymizationModeState anonymizationModeState;

    public DoctorDashboardRestMapper(AnonymizationModeState anonymizationModeState) {
        this.anonymizationModeState = anonymizationModeState;
    }

    public DoctorDashboardResponse toResponse(DoctorDashboardResult result) {
        if (result == null) {
            return null;
        }

        var summaryResponse = new DoctorDashboardResponse.SummaryResponse(
                result.summary().todayAppointmentsCount(),
                result.summary().waitingQueueCount(),
                result.summary().inProgressQueueCount(),
                result.summary().pendingSignaturesCount(),
                result.summary().overdueSignaturesCount(),
                result.summary().newClinicalResultsCount(),
                result.summary().abnormalClinicalResultsCount()
        );

        var appointments = result.appointments().stream()
                .map(a -> new DoctorDashboardResponse.AppointmentItemResponse(
                        a.appointmentId(),
                        a.appointmentCode(),
                        a.patientId(),
                        a.patientCode(),
                        resolvePatientName(a.patientCode(), a.patientName()),
                        a.patientPhone(),
                        a.startTime(),
                        a.endTime(),
                        a.status(),
                        a.reason()
                ))
                .toList();

        var queue = result.queue().stream()
                .map(q -> new DoctorDashboardResponse.QueueItemResponse(
                        q.queueItemId(),
                        q.medicalQueueId(),
                        q.queueNumber(),
                        q.patientId(),
                        q.patientCode(),
                        resolvePatientName(q.patientCode(), q.patientName()),
                        q.roomId(),
                        q.roomNumber(),
                        q.visitId(),
                        q.visitCode(),
                        q.status(),
                        q.priority(),
                        q.checkedInAt(),
                        q.calledAt()
                ))
                .toList();

        var pendingRecords = result.pendingMedicalRecords().stream()
                .map(p -> new DoctorDashboardResponse.PendingMedicalRecordResponse(
                        p.medicalRecordId(),
                        p.visitId(),
                        p.visitCode(),
                        p.patientId(),
                        p.patientCode(),
                        resolvePatientName(p.patientCode(), p.patientName()),
                        p.status(),
                        p.visitCompletedAt(),
                        p.deadlineAt(),
                        p.isOverdue(),
                        p.overdueHours(),
                        p.reminderCount()
                ))
                .toList();

        var clinicalResults = result.newClinicalResults().stream()
                .map(c -> new DoctorDashboardResponse.ClinicalResultResponse(
                        c.clinicalResultId(),
                        c.clinicalOrderItemId(),
                        c.serviceCode(),
                        c.serviceName(),
                        c.visitId(),
                        c.visitCode(),
                        c.patientId(),
                        c.patientCode(),
                        resolvePatientName(c.patientCode(), c.patientName()),
                        c.resultType(),
                        c.numericValue(),
                        c.textValue(),
                        c.unit(),
                        c.referenceRange(),
                        c.abnormalFlag(),
                        c.conclusion(),
                        c.status(),
                        c.enteredAt()
                ))
                .toList();

        return new DoctorDashboardResponse(
                summaryResponse,
                appointments,
                queue,
                pendingRecords,
                clinicalResults,
                result.asOf()
        );
    }

    private String resolvePatientName(String patientCode, String patientName) {
        if (anonymizationModeState != null && anonymizationModeState.isEnabled()) {
            return PatientAnonymizer.maskFullName(patientCode);
        }
        return patientName;
    }
}
