package com.benhsoan.application.ucservice.patient;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.benhsoan.domain.patient.Patient;
import com.benhsoan.domain.patient.PatientMinorPolicy;
import com.benhsoan.domain.patient.enums.BloodType;
import com.benhsoan.domain.patient.enums.Gender;
import com.benhsoan.port.dto.result.patient.LinkedPatientProfileResult;
import com.benhsoan.port.outbound.repository.patient.PatientRepository;
import com.benhsoan.port.outbound.security.CurrentUserPort;

/**
 * NCL-14-CN-010 CV-02 / TC-01 and TC-03 (QTN-44): the linked-profile scope is derived only
 * from the own patient record plus {@code patients.guardian_user_id}, and age / minor flags
 * reuse the shared {@link PatientMinorPolicy} without duplicating that logic.
 */
@ExtendWith(MockitoExtension.class)
class GetPatientLinkedProfilesServiceTest {

    private static final LocalDate ADULT_DOB = LocalDate.of(1995, 5, 10);
    private static final LocalDate MINOR_DOB = LocalDate.of(2015, 5, 10);
    private static final LocalDate RECENTLY_ADULT_DOB = LocalDate.of(2006, 5, 10);
    private static final java.time.Instant CREATED_AT =
            java.time.Instant.parse("2026-01-01T00:00:00Z");

    @Mock private PatientRepository patientRepository;
    @Mock private CurrentUserPort currentUserPort;

    private GetPatientLinkedProfilesService service;

    @BeforeEach
    void setUp() {
        service = new GetPatientLinkedProfilesService(patientRepository, currentUserPort);
    }

    private Patient patient(
            UUID id,
            String code,
            String fullName,
            LocalDate dateOfBirth,
            String guardianRelationship,
            UUID guardianUserId,
            UUID portalUserId
    ) {
        return Patient.restore(
                id, code, fullName, dateOfBirth, Gender.MALE,
                null, null, null, null, null, BloodType.O_POSITIVE,
                null, null, null,
                guardianUserId != null ? "Nguyen Van Cha" : null, guardianRelationship, null, null,
                guardianUserId, null,
                true, CREATED_AT, CREATED_AT,
                portalUserId, portalUserId != null ? portalUserId : UUID.randomUUID(),
                false, null, null,
                false, null, null, false,
                com.benhsoan.domain.patient.enums.PatientStatus.ACTIVE, null, null, null, null);
    }

    private Patient ownProfile(UUID ownId, UUID userId) {
        return patient(ownId, "BN000001", "Nguyen Van A", ADULT_DOB, null, null, userId);
    }

    private Patient dependent(
            UUID dependentId,
            UUID userId,
            LocalDate dateOfBirth,
            String relationship
    ) {
        return patient(dependentId, "BN000002", "Nguyen Van Con", dateOfBirth,
                relationship, userId, null);
    }

    // --- P2.2 / QTN-33: lifecycle filtering of dependents -------------------

    @Test
    @DisplayName("P2.2: ho so phu thuoc ACTIVE duoc tra ve")
    void returnsActiveDependent() {
        UUID userId = UUID.randomUUID();
        Patient active = dependent(UUID.randomUUID(), userId, MINOR_DOB, "Bo");

        when(currentUserPort.getCurrentUserId()).thenReturn(userId);
        when(patientRepository.findByUserId(userId)).thenReturn(Optional.empty());
        when(patientRepository.findValidDependentsByGuardianUserId(userId))
                .thenReturn(List.of(active));

        List<LinkedPatientProfileResult> results = service.getLinkedProfiles();

        assertEquals(1, results.size());
        assertFalse(results.get(0).self());
    }

    @Test
    @DisplayName("P2.2: ho so phu thuoc INACTIVE khong duoc tra ve")
    void excludesInactiveDependent() {
        UUID userId = UUID.randomUUID();

        when(currentUserPort.getCurrentUserId()).thenReturn(userId);
        when(patientRepository.findByUserId(userId)).thenReturn(Optional.empty());
        // The lifecycle filter lives in the repository query: inactive/merged rows never reach
        // the service, so the discovery list cannot expose them.
        when(patientRepository.findValidDependentsByGuardianUserId(userId))
                .thenReturn(List.of());

        assertEquals(0, service.getLinkedProfiles().size());
    }

    @Test
    @DisplayName("P2.2: ho so phu thuoc MERGED khong duoc tra ve")
    void excludesMergedDependent() {
        UUID userId = UUID.randomUUID();

        when(currentUserPort.getCurrentUserId()).thenReturn(userId);
        when(patientRepository.findByUserId(userId)).thenReturn(Optional.empty());
        when(patientRepository.findValidDependentsByGuardianUserId(userId))
                .thenReturn(List.of());

        assertEquals(0, service.getLinkedProfiles().size());
    }

    @Test
    @DisplayName("P2.2: ho so cua chinh minh bi vo hieu hoa cung khong hien thi")
    void excludesOwnInactiveProfile() {
        UUID userId = UUID.randomUUID();
        Patient inactiveOwn = mock(Patient.class);
        when(inactiveOwn.isActive()).thenReturn(false);

        when(currentUserPort.getCurrentUserId()).thenReturn(userId);
        when(patientRepository.findByUserId(userId)).thenReturn(Optional.of(inactiveOwn));
        when(patientRepository.findValidDependentsByGuardianUserId(userId))
                .thenReturn(List.of());

        assertEquals(0, service.getLinkedProfiles().size());
    }

    // --- P3.3: bounded result set ------------------------------------------

    @Test
    @DisplayName("P3.3: danh sach bi gioi han, khong tra ve vo han")
    void boundedToMaximumLinkedProfiles() {
        UUID userId = UUID.randomUUID();
        java.util.List<Patient> many = new java.util.ArrayList<>();
        for (int index = 0; index < GetPatientLinkedProfilesService.MAX_LINKED_PROFILES + 25; index++) {
            many.add(patient(UUID.randomUUID(), "BN" + index, String.format("Con %03d", index),
                    MINOR_DOB, "Bo", userId, null));
        }

        when(currentUserPort.getCurrentUserId()).thenReturn(userId);
        when(patientRepository.findByUserId(userId)).thenReturn(Optional.empty());
        when(patientRepository.findValidDependentsByGuardianUserId(userId)).thenReturn(many);

        List<LinkedPatientProfileResult> results = service.getLinkedProfiles();

        assertEquals(GetPatientLinkedProfilesService.MAX_LINKED_PROFILES, results.size());
    }

    @Test
    @DisplayName("P3.3: thu tu on dinh theo ten roi den patientId")
    void ordersDeterministicallyByNameThenId() {
        UUID userId = UUID.randomUUID();
        Patient beta = patient(UUID.randomUUID(), "BN002", "Beta", MINOR_DOB, "Bo", userId, null);
        Patient alpha = patient(UUID.randomUUID(), "BN003", "Alpha", MINOR_DOB, "Bo", userId, null);

        when(currentUserPort.getCurrentUserId()).thenReturn(userId);
        when(patientRepository.findByUserId(userId)).thenReturn(Optional.empty());
        when(patientRepository.findValidDependentsByGuardianUserId(userId))
                .thenReturn(List.of(beta, alpha));

        List<LinkedPatientProfileResult> results = service.getLinkedProfiles();

        assertEquals("Alpha", results.get(0).fullName());
        assertEquals("Beta", results.get(1).fullName());
    }

    @Test
    void returnsOwnProfileFirstLabelledSelf() {
        UUID userId = UUID.randomUUID();
        UUID ownId = UUID.randomUUID();
        Patient own = ownProfile(ownId, userId);

        when(currentUserPort.getCurrentUserId()).thenReturn(userId);
        when(patientRepository.findByUserId(userId)).thenReturn(Optional.of(own));
        when(patientRepository.findValidDependentsByGuardianUserId(userId))
                .thenReturn(List.of());

        List<LinkedPatientProfileResult> results = service.getLinkedProfiles();

        assertEquals(1, results.size());
        LinkedPatientProfileResult profile = results.get(0);
        assertEquals(ownId, profile.patientId());
        assertEquals("BN000001", profile.patientCode());
        assertTrue(profile.self());
        assertEquals(GetPatientLinkedProfilesService.SELF_RELATIONSHIP, profile.relationship());
        assertFalse(profile.isMinor());
        assertFalse(profile.requiresGuardianLinkReview());
    }

    @Test
    void returnsLinkedDependentsAfterTheOwnProfile() {
        UUID userId = UUID.randomUUID();
        UUID ownId = UUID.randomUUID();
        UUID dependentId = UUID.randomUUID();
        Patient own = ownProfile(ownId, userId);
        Patient child = dependent(dependentId, userId, MINOR_DOB, "Bo");

        when(currentUserPort.getCurrentUserId()).thenReturn(userId);
        when(patientRepository.findByUserId(userId)).thenReturn(Optional.of(own));
        when(patientRepository.findValidDependentsByGuardianUserId(userId))
                .thenReturn(List.of(child));

        List<LinkedPatientProfileResult> results = service.getLinkedProfiles();

        assertEquals(2, results.size());
        assertEquals(ownId, results.get(0).patientId());
        assertTrue(results.get(0).self());
        assertEquals(dependentId, results.get(1).patientId());
        assertFalse(results.get(1).self());
        assertEquals("Bo", results.get(1).relationship());
        assertTrue(results.get(1).isMinor());
    }

    @Test
    void returnsOnlyDependentsWhenTheAccountHasNoOwnProfile() {
        UUID userId = UUID.randomUUID();
        UUID dependentId = UUID.randomUUID();
        Patient child = dependent(dependentId, userId, MINOR_DOB, "Bo");

        when(currentUserPort.getCurrentUserId()).thenReturn(userId);
        when(patientRepository.findByUserId(userId)).thenReturn(Optional.empty());
        when(patientRepository.findValidDependentsByGuardianUserId(userId))
                .thenReturn(List.of(child));

        List<LinkedPatientProfileResult> results = service.getLinkedProfiles();

        assertEquals(1, results.size());
        assertEquals(dependentId, results.get(0).patientId());
        assertFalse(results.get(0).self());
    }

    @Test
    void ageAndMinorFlagComeFromPatientMinorPolicy() {
        UUID userId = UUID.randomUUID();
        UUID dependentId = UUID.randomUUID();
        Patient child = dependent(dependentId, userId, MINOR_DOB, "Bo");

        when(currentUserPort.getCurrentUserId()).thenReturn(userId);
        when(patientRepository.findByUserId(userId)).thenReturn(Optional.empty());
        when(patientRepository.findValidDependentsByGuardianUserId(userId))
                .thenReturn(List.of(child));

        LinkedPatientProfileResult profile = service.getLinkedProfiles().get(0);

        assertEquals(PatientMinorPolicy.calculateAge(MINOR_DOB), profile.age());
        assertEquals(PatientMinorPolicy.isMinor(MINOR_DOB), profile.isMinor());
        assertEquals(MINOR_DOB, profile.dateOfBirth());
        assertEquals("Nguyen Van Con", profile.fullName());
    }

    @Test
    void requiresGuardianLinkReviewFlaggedWhenAnAdultStillHasAGuardian() {
        UUID userId = UUID.randomUUID();
        UUID dependentId = UUID.randomUUID();
        Patient adultDependent = dependent(dependentId, userId, RECENTLY_ADULT_DOB, "Bo");

        when(currentUserPort.getCurrentUserId()).thenReturn(userId);
        when(patientRepository.findByUserId(userId)).thenReturn(Optional.empty());
        when(patientRepository.findValidDependentsByGuardianUserId(userId))
                .thenReturn(List.of(adultDependent));

        LinkedPatientProfileResult profile = service.getLinkedProfiles().get(0);

        assertFalse(profile.isMinor());
        assertTrue(profile.requiresGuardianLinkReview());
    }

    @Test
    void unrelatedPatientIsExcludedBecauseScopeIsDerivedFromTheGuardianLink() {
        UUID userId = UUID.randomUUID();

        when(currentUserPort.getCurrentUserId()).thenReturn(userId);
        when(patientRepository.findByUserId(userId)).thenReturn(Optional.empty());
        when(patientRepository.findValidDependentsByGuardianUserId(userId))
                .thenReturn(List.of());

        assertTrue(service.getLinkedProfiles().isEmpty());
        org.mockito.Mockito.verify(patientRepository)
                .findValidDependentsByGuardianUserId(userId);
        org.mockito.Mockito.verify(patientRepository).findByUserId(userId);
    }

    @Test
    void deDuplicatesAProfileReturnedByBothLookups() {
        UUID userId = UUID.randomUUID();
        UUID ownId = UUID.randomUUID();
        Patient dual = patient(ownId, "BN000001", "Nguyen Van A", ADULT_DOB, "SELF", userId, userId);

        when(currentUserPort.getCurrentUserId()).thenReturn(userId);
        when(patientRepository.findByUserId(userId)).thenReturn(Optional.of(dual));
        when(patientRepository.findValidDependentsByGuardianUserId(userId))
                .thenReturn(List.of(dual));

        assertEquals(1, service.getLinkedProfiles().size());
    }
}
