package com.benhsoan.adapter.inbound.rest.mapper;

import org.springframework.stereotype.Component;

import com.benhsoan.adapter.inbound.rest.response.reporting.OperationalSummaryResponse;
import com.benhsoan.adapter.inbound.rest.response.reporting.OperationalTimelineItemResponse;
import com.benhsoan.adapter.inbound.rest.response.reporting.OperationalTimelineResponse;
import com.benhsoan.adapter.inbound.rest.response.reporting.DoctorVisitItemResponse;
import com.benhsoan.adapter.inbound.rest.response.reporting.DoctorVisitsReportResponse;
import com.benhsoan.port.dto.result.DoctorVisitSummaryResult;
import com.benhsoan.port.dto.result.DoctorVisitsReportResult;
import com.benhsoan.port.dto.result.OperationalSummaryResult;
import com.benhsoan.port.dto.result.OperationalTimelineItemResult;
import com.benhsoan.port.dto.result.OperationalTimelineResult;
import com.benhsoan.adapter.inbound.rest.response.reporting.AppointmentEffectivenessReportResponse;
import com.benhsoan.adapter.inbound.rest.response.reporting.AppointmentStatusCountResponse;
import com.benhsoan.adapter.inbound.rest.response.reporting.DiseasePatternItemResponse;
import com.benhsoan.adapter.inbound.rest.response.reporting.DiseasePatternReportResponse;
import com.benhsoan.adapter.inbound.rest.response.reporting.TopMedicineItemResponse;
import com.benhsoan.adapter.inbound.rest.response.reporting.TopMedicinesReportResponse;
import com.benhsoan.adapter.inbound.rest.response.reporting.DoctorRevenueResponse;
import com.benhsoan.adapter.inbound.rest.response.reporting.RevenueBreakdownReportResponse;
import com.benhsoan.adapter.inbound.rest.response.reporting.ServiceGroupRevenueResponse;
import com.benhsoan.port.dto.result.AppointmentEffectivenessReportResult;
import com.benhsoan.port.dto.result.AppointmentStatusCountResult;
import com.benhsoan.port.dto.result.DiseasePatternItemResult;
import com.benhsoan.port.dto.result.DiseasePatternReportResult;
import com.benhsoan.port.dto.result.DoctorRevenueResult;
import com.benhsoan.port.dto.result.RevenueBreakdownReportResult;
import com.benhsoan.port.dto.result.ServiceGroupRevenueResult;
import com.benhsoan.port.dto.result.TopMedicineItemResult;
import com.benhsoan.port.dto.result.TopMedicinesReportResult;
import com.benhsoan.adapter.inbound.rest.response.reporting.DoctorSatisfactionSummaryResponse;
import com.benhsoan.adapter.inbound.rest.response.reporting.SatisfactionReportResponse;
import com.benhsoan.port.dto.result.survey.DoctorSatisfactionItemResult;
import com.benhsoan.port.dto.result.survey.SatisfactionReportResult;

@Component
public class ReportingRestMapper {

    public OperationalSummaryResponse toResponse(OperationalSummaryResult result) {
        return new OperationalSummaryResponse(
                result.from(),
                result.to(),
                result.visitCount(),
                result.revenue(),
                result.currency()
        );
    }

    public OperationalTimelineResponse toResponse(OperationalTimelineResult result) {
        return new OperationalTimelineResponse(
                result.from(),
                result.to(),
                result.items().stream().map(this::toResponse).toList()
        );
    }

    public TopMedicinesReportResponse toResponse(TopMedicinesReportResult result) {
        return new TopMedicinesReportResponse(
                result.from(),
                result.to(),
                result.generatedAt(),
                result.items().stream().map(this::toResponse).toList()
        );
    }

    public DoctorVisitsReportResponse toResponse(DoctorVisitsReportResult result) {
        return new DoctorVisitsReportResponse(
                result.from(),
                result.to(),
                result.generatedAt(),
                result.items().stream().map(this::toResponse).toList()
        );
    }

    public AppointmentEffectivenessReportResponse toResponse(AppointmentEffectivenessReportResult result) {
        return new AppointmentEffectivenessReportResponse(
                result.from(),
                result.to(),
                result.generatedAt(),
                result.total(),
                result.items().stream().map(this::toResponse).toList()
        );
    }

    public RevenueBreakdownReportResponse toResponse(RevenueBreakdownReportResult result) {
        return new RevenueBreakdownReportResponse(
                result.from(),
                result.to(),
                result.totalNetRevenue(),
                result.totalExamRevenue(),
                result.totalClinicalServiceRevenue(),
                result.totalMedicationRevenue(),
                result.totalAdjustmentRevenue(),
                result.currency(),
                result.serviceGroups() == null ? java.util.List.of() : result.serviceGroups().stream().map(this::toResponse).toList(),
                result.doctors() == null ? java.util.List.of() : result.doctors().stream().map(this::toResponse).toList()
        );
    }

    private ServiceGroupRevenueResponse toResponse(ServiceGroupRevenueResult result) {
        return new ServiceGroupRevenueResponse(
                result.groupCode(),
                result.groupName(),
                result.revenue(),
                result.percentage()
        );
    }

    private DoctorRevenueResponse toResponse(DoctorRevenueResult result) {
        return new DoctorRevenueResponse(
                result.doctorId(),
                result.doctorCode(),
                result.doctorName(),
                result.examRevenue(),
                result.clinicalServiceRevenue(),
                result.medicationRevenue(),
                result.adjustmentRevenue(),
                result.totalRevenue(),
                result.percentage()
        );
    }

    public DiseasePatternReportResponse toResponse(DiseasePatternReportResult result) {
        if (result == null) {
            return null;
        }
        return new DiseasePatternReportResponse(
                result.from(),
                result.to(),
                result.doctorId(),
                result.doctorName(),
                result.totalDiagnoses(),
                result.generatedAt(),
                result.items().stream().map(this::toResponse).toList()
        );
    }

    private DiseasePatternItemResponse toResponse(DiseasePatternItemResult result) {
        return new DiseasePatternItemResponse(
                result.rank(),
                result.catalogId(),
                result.diseaseCode(),
                result.diseaseName(),
                result.diseaseGroup(),
                result.diagnosisCount(),
                result.percentage()
        );
    }

    private OperationalTimelineItemResponse toResponse(OperationalTimelineItemResult result) {
        return new OperationalTimelineItemResponse(
                result.date(),
                result.visitCount(),
                result.revenue()
        );
    }

    private TopMedicineItemResponse toResponse(TopMedicineItemResult result) {
        return new TopMedicineItemResponse(
                result.rank(),
                result.medicineId(),
                result.medicineCode(),
                result.medicineName(),
                result.totalDispensedQuantity()
        );
    }

    private DoctorVisitItemResponse toResponse(DoctorVisitSummaryResult result) {
        return new DoctorVisitItemResponse(
                result.rank(),
                result.doctorId(),
                result.doctorCode(),
                result.doctorName(),
                result.totalVisits()
        );
    }

    private AppointmentStatusCountResponse toResponse(AppointmentStatusCountResult result) {
        return new AppointmentStatusCountResponse(
                result.bookingChannel(),
                result.status(),
                result.count(),
                result.percentage()
        );
    }

    public SatisfactionReportResponse toResponse(SatisfactionReportResult result) {
        if (result == null) {
            return null;
        }
        return new SatisfactionReportResponse(
                result.from(),
                result.to(),
                result.generatedAt(),
                result.totalSurveys(),
                result.averageScore(),
                result.scoreDistribution(),
                result.doctors().stream().map(this::toResponse).toList()
        );
    }

    private DoctorSatisfactionSummaryResponse toResponse(DoctorSatisfactionItemResult item) {
        return new DoctorSatisfactionSummaryResponse(
                item.doctorId(),
                item.doctorUsername(),
                item.doctorName(),
                item.totalSurveys(),
                item.averageScore()
        );
    }
}
