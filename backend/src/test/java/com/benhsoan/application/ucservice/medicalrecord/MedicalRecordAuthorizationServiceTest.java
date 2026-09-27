package com.benhsoan.application.ucservice.medicalrecord;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.util.UUID;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.benhsoan.domain.medicalrecord.MedicalRecord;
import com.benhsoan.domain.medicalrecord.exception.MedicalRecordAccessDeniedException;
import com.benhsoan.domain.medicalrecord.exception.MedicalRecordArchivedReadOnlyException;
import com.benhsoan.infrastructure.security.service.PermissionEvaluator;
import com.benhsoan.port.outbound.security.CurrentUserPort;

@ExtendWith(MockitoExtension.class)
class MedicalRecordAuthorizationServiceTest {

    @Mock
    private CurrentUserPort currentUserPort;

    @Mock
    private PermissionEvaluator permissionEvaluator;

    @Mock
    private MedicalRecordAuthorizationAuditService authorizationAuditService;

    @InjectMocks
    private MedicalRecordAuthorizationService service;

    @Test
    @DisplayName("audit log access is allowed when current user has AUDIT_READ")
    void allowsAuditReadPermission() {
        UUID userId = UUID.randomUUID();
        when(permissionEvaluator.hasPermission("AUDIT_READ")).thenReturn(true);
        when(currentUserPort.getCurrentUserId()).thenReturn(userId);

        assertEquals(userId, service.requireAuditReadAccess());
    }

    @Test
    @DisplayName("audit log access is denied without AUDIT_READ")
    void deniesWithoutAuditReadPermission() {
        when(permissionEvaluator.hasPermission("AUDIT_READ")).thenReturn(false);

        assertThrows(MedicalRecordAccessDeniedException.class, () -> service.requireAuditReadAccess());
    }

    @Test
    @DisplayName("read access is allowed for DOCTOR")
    void allowsDoctorReadAccess() {
        when(currentUserPort.hasRole("ADMIN")).thenReturn(false);
        when(currentUserPort.hasRole("DOCTOR")).thenReturn(true);
        UUID userId = UUID.randomUUID();
        when(currentUserPort.getCurrentUserId()).thenReturn(userId);

        assertEquals(userId, service.requireReadAccess());
    }

    @Test
    @DisplayName("read access is allowed for ADMIN")
    void allowsAdminReadAccess() {
        when(currentUserPort.hasRole("ADMIN")).thenReturn(true);
        UUID userId = UUID.randomUUID();
        when(currentUserPort.getCurrentUserId()).thenReturn(userId);

        assertEquals(userId, service.requireReadAccess());
    }

    @Test
    @DisplayName("read access is denied for non-doctor roles (e.g. RECEPTIONIST)")
    void deniesNonDoctorReadAccess() {
        when(currentUserPort.hasRole("ADMIN")).thenReturn(false);
        when(currentUserPort.hasRole("DOCTOR")).thenReturn(false);

        assertThrows(MedicalRecordAccessDeniedException.class, service::requireReadAccess);
    }

    @Test
    @DisplayName("content write access is allowed for DOCTOR only")
    void allowsDoctorContentWriteAccess() {
        UUID userId = UUID.randomUUID();
        UUID medicalRecordId = UUID.randomUUID();
        when(currentUserPort.hasRole("DOCTOR")).thenReturn(true);
        when(currentUserPort.hasRole("ADMIN")).thenReturn(false);
        when(currentUserPort.getCurrentUserId()).thenReturn(userId);

        assertEquals(userId, service.requireContentWriteAccess(medicalRecordId));
    }

    @Test
    @DisplayName("content write access is denied for ADMIN and non-DOCTOR roles")
    void deniesAdminAndNonDoctorContentWriteAccess() {
        UUID userId = UUID.randomUUID();
        UUID medicalRecordId = UUID.randomUUID();
        when(currentUserPort.hasRole("DOCTOR")).thenReturn(true);
        when(currentUserPort.hasRole("ADMIN")).thenReturn(true);
        when(currentUserPort.getCurrentUserId()).thenReturn(userId);

        assertThrows(MedicalRecordAccessDeniedException.class,
                () -> service.requireContentWriteAccess(medicalRecordId));
        verify(authorizationAuditService).recordContentWriteDenied(userId, medicalRecordId);
    }

    @Test
    @DisplayName("content write access is denied for unassigned doctor")
    void deniesUnassignedDoctorContentVisitWriteAccess() {
        UUID actorId = UUID.randomUUID();
        UUID visitDoctorId = UUID.randomUUID();
        UUID medicalRecordId = UUID.randomUUID();

        assertThrows(MedicalRecordAccessDeniedException.class,
                () -> service.requireContentVisitWriteAccess(actorId, visitDoctorId, medicalRecordId));

        verify(authorizationAuditService).recordContentWriteDenied(actorId, medicalRecordId);
    }

    @Test
    @DisplayName("diagnosis write access is allowed for DOCTOR only")
    void allowsDoctorDiagnosisWriteAccess() {
        UUID userId = UUID.randomUUID();
        UUID medicalRecordId = UUID.randomUUID();
        when(currentUserPort.hasRole("DOCTOR")).thenReturn(true);
        when(currentUserPort.hasRole("ADMIN")).thenReturn(false);
        when(currentUserPort.getCurrentUserId()).thenReturn(userId);

        assertEquals(userId, service.requireDiagnosisWriteAccess(medicalRecordId));
    }

    @Test
    @DisplayName("template write access is allowed for DOCTOR only")
    void allowsDoctorTemplateWriteAccess() {
        UUID userId = UUID.randomUUID();
        UUID medicalRecordId = UUID.randomUUID();
        when(currentUserPort.hasRole("DOCTOR")).thenReturn(true);
        when(currentUserPort.hasRole("ADMIN")).thenReturn(false);
        when(currentUserPort.getCurrentUserId()).thenReturn(userId);

        assertEquals(userId, service.requireTemplateWriteAccess(medicalRecordId));
    }

    @Test
    @DisplayName("template write access denies an ADMIN even with DOCTOR role")
    void deniesAdminTemplateWriteAccess() {
        UUID userId = UUID.randomUUID();
        UUID medicalRecordId = UUID.randomUUID();
        when(currentUserPort.hasRole("DOCTOR")).thenReturn(true);
        when(currentUserPort.hasRole("ADMIN")).thenReturn(true);
        when(currentUserPort.getCurrentUserId()).thenReturn(userId);

        assertThrows(MedicalRecordAccessDeniedException.class,
                () -> service.requireTemplateWriteAccess(medicalRecordId));
        verify(authorizationAuditService).recordTemplateAccessDenied(userId, medicalRecordId,
                "Medical record template access denied");
    }

    @Test
    @DisplayName("diagnosis write access is denied when an ADMIN also has the DOCTOR role")
    void deniesAdminDiagnosisWriteAccessEvenWithDoctorRole() {
        UUID userId = UUID.randomUUID();
        UUID medicalRecordId = UUID.randomUUID();
        when(currentUserPort.hasRole("DOCTOR")).thenReturn(true);
        when(currentUserPort.hasRole("ADMIN")).thenReturn(true);
        when(currentUserPort.getCurrentUserId()).thenReturn(userId);

        assertThrows(MedicalRecordAccessDeniedException.class,
                () -> service.requireDiagnosisWriteAccess(medicalRecordId));
        verify(authorizationAuditService).recordDiagnosisWriteDenied(userId, medicalRecordId);
    }

    @Test
    @DisplayName("diagnosis write access is denied for ADMIN, RECEPTIONIST, and PHARMACIST")
    void deniesNonDoctorDiagnosisWriteAccess() {
        UUID userId = UUID.randomUUID();
        UUID medicalRecordId = UUID.randomUUID();
        when(currentUserPort.hasRole("DOCTOR")).thenReturn(false);
        when(currentUserPort.getCurrentUserId()).thenReturn(userId);

        assertThrows(MedicalRecordAccessDeniedException.class,
                () -> service.requireDiagnosisWriteAccess(medicalRecordId));
        verify(authorizationAuditService).recordDiagnosisWriteDenied(userId, medicalRecordId);
    }

    @Test
    @DisplayName("diagnosis write access is denied and audited for a doctor assigned to another visit")
    void deniesUnassignedDoctorDiagnosisWriteAccess() {
        UUID actorId = UUID.randomUUID();
        UUID visitDoctorId = UUID.randomUUID();
        UUID medicalRecordId = UUID.randomUUID();

        assertThrows(MedicalRecordAccessDeniedException.class,
                () -> service.requireDiagnosisVisitWriteAccess(actorId, visitDoctorId, medicalRecordId));

        verify(authorizationAuditService).recordDiagnosisWriteDenied(actorId, medicalRecordId);
    }

    @Test
    @DisplayName("amend access is allowed for the assigned doctor")
    void allowsAssignedDoctorAmendAccess() {
        UUID userId = UUID.randomUUID();
        when(currentUserPort.hasRole("DOCTOR")).thenReturn(true);
        when(currentUserPort.getCurrentUserId()).thenReturn(userId);

        assertEquals(userId, service.requireAmendAccess(userId));
    }

    @Test
    @DisplayName("amend access is denied for a non-assigned doctor")
    void deniesNonAssignedDoctorAmendAccess() {
        UUID userId = UUID.randomUUID();
        UUID assignedDoctorId = UUID.randomUUID();
        when(currentUserPort.hasRole("DOCTOR")).thenReturn(true);
        when(currentUserPort.getCurrentUserId()).thenReturn(userId);

        assertThrows(MedicalRecordAccessDeniedException.class, () -> service.requireAmendAccess(assignedDoctorId));
    }

    @Test
    @DisplayName("amend access is denied for ADMIN (VT-05 does not participate in clinical care)")
    void deniesAdminAmendAccess() {
        UUID userId = UUID.randomUUID();
        when(currentUserPort.hasRole("DOCTOR")).thenReturn(false);
        when(currentUserPort.getCurrentUserId()).thenReturn(userId);

        assertThrows(MedicalRecordAccessDeniedException.class, () -> service.requireAmendAccess(userId));
    }

    @Test
    @DisplayName("amend access is denied for non-doctor roles (e.g. MANAGER)")
    void deniesNonDoctorAmendAccess() {
        when(currentUserPort.hasRole("DOCTOR")).thenReturn(false);

        assertThrows(MedicalRecordAccessDeniedException.class, () -> service.requireAmendAccess(UUID.randomUUID()));
    }

    @Test
    @DisplayName("visit template read access is allowed for DOCTOR")
    void allowsDoctorVisitTemplateReadAccess() {
        UUID userId = UUID.randomUUID();
        UUID visitId = UUID.randomUUID();
        when(currentUserPort.hasRole("DOCTOR")).thenReturn(true);
        when(currentUserPort.hasRole("ADMIN")).thenReturn(false);
        when(currentUserPort.getCurrentUserId()).thenReturn(userId);

        assertEquals(userId, service.requireVisitTemplateReadAccess(visitId));
    }

    @Test
    @DisplayName("visit template read access is denied for non-DOCTOR and audits ResourceType.VISIT")
    void deniesNonDoctorVisitTemplateReadAccessAndAudits() {
        UUID userId = UUID.randomUUID();
        UUID visitId = UUID.randomUUID();
        when(currentUserPort.hasRole("DOCTOR")).thenReturn(false);
        when(currentUserPort.getCurrentUserId()).thenReturn(userId);

        assertThrows(MedicalRecordAccessDeniedException.class, () -> service.requireVisitTemplateReadAccess(visitId));

        verify(authorizationAuditService).recordVisitTemplateAccessDenied(userId, visitId,
                "Medical record template access denied");
    }

    @Test
    @DisplayName("visit template access by visit doctor is allowed")
    void allowsResponsibleDoctorVisitTemplateAccess() {
        UUID doctorId = UUID.randomUUID();
        UUID visitId = UUID.randomUUID();

        service.requireVisitTemplateVisitAccess(doctorId, doctorId, visitId);
    }

    @Test
    @DisplayName("visit template access by non-responsible doctor is denied and audits ResourceType.VISIT")
    void deniesNonResponsibleDoctorVisitTemplateAccessAndAudits() {
        UUID actorId = UUID.randomUUID();
        UUID doctorId = UUID.randomUUID();
        UUID visitId = UUID.randomUUID();

        assertThrows(MedicalRecordAccessDeniedException.class,
                () -> service.requireVisitTemplateVisitAccess(actorId, doctorId, visitId));

        verify(authorizationAuditService).recordVisitTemplateAccessDenied(actorId, visitId,
                "Medical record template access denied");
    }

    @Test
    @DisplayName("allows archive manage access when user has MEDICAL_RECORD_ARCHIVE_MANAGE permission")
    void allowsArchiveManageAccess() {
        UUID userId = UUID.randomUUID();
        when(permissionEvaluator.hasPermission("MEDICAL_RECORD_ARCHIVE_MANAGE")).thenReturn(true);
        when(currentUserPort.getCurrentUserId()).thenReturn(userId);

        assertEquals(userId, service.requireArchiveManageAccess());
    }

    @Test
    @DisplayName("denies archive manage access without permission and audits")
    void deniesArchiveManageAccessWithoutPermission() {
        UUID userId = UUID.randomUUID();
        when(permissionEvaluator.hasPermission("MEDICAL_RECORD_ARCHIVE_MANAGE")).thenReturn(false);
        when(currentUserPort.getCurrentUserId()).thenReturn(userId);

        assertThrows(MedicalRecordAccessDeniedException.class, service::requireArchiveManageAccess);
        verify(authorizationAuditService).recordArchiveAccessDenied(userId,
                "Medical record archive manage access denied");
    }

    @Test
    @DisplayName("allows archive read access when user has MEDICAL_RECORD_ARCHIVE_READ permission")
    void allowsArchiveReadAccess() {
        UUID userId = UUID.randomUUID();
        when(permissionEvaluator.hasPermission("MEDICAL_RECORD_ARCHIVE_READ")).thenReturn(true);
        when(currentUserPort.getCurrentUserId()).thenReturn(userId);

        assertEquals(userId, service.requireArchiveReadAccess());
    }

    @Test
    @DisplayName("denies archive read access without permission and audits")
    void deniesArchiveReadAccessWithoutPermission() {
        UUID userId = UUID.randomUUID();
        when(permissionEvaluator.hasPermission("MEDICAL_RECORD_ARCHIVE_READ")).thenReturn(false);
        when(currentUserPort.getCurrentUserId()).thenReturn(userId);

        assertThrows(MedicalRecordAccessDeniedException.class, service::requireArchiveReadAccess);
        verify(authorizationAuditService).recordArchiveAccessDenied(userId,
                "Medical record archive read access denied");
    }

    @Test
    @DisplayName("ensureNotArchived throws MedicalRecordArchivedReadOnlyException and audits when record is ARCHIVED")
    void ensureNotArchived_throwsWhenRecordIsArchived() {
        UUID actorId = UUID.randomUUID();
        UUID recordId = UUID.randomUUID();
        MedicalRecord record = mock(MedicalRecord.class);
        when(record.isArchived()).thenReturn(true);
        when(record.getId()).thenReturn(recordId);

        assertThrows(MedicalRecordArchivedReadOnlyException.class,
                () -> service.ensureNotArchived(record, actorId, "Chỉnh sửa bệnh án"));

        verify(authorizationAuditService).recordArchiveAccessDenied(actorId, recordId,
                "Medical record modification denied: record is archived (QTN-19). Action: Chỉnh sửa bệnh án");
    }

    @Test
    @DisplayName("ensureNotArchived does nothing when record is not ARCHIVED")
    void ensureNotArchived_doesNothingWhenRecordIsNotArchived() {
        UUID actorId = UUID.randomUUID();
        MedicalRecord record = mock(MedicalRecord.class);
        when(record.isArchived()).thenReturn(false);

        service.ensureNotArchived(record, actorId, "Chỉnh sửa bệnh án");

        verifyNoInteractions(authorizationAuditService);
    }
}
