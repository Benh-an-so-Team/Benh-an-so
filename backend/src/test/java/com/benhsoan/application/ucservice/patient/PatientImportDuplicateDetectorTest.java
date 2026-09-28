package com.benhsoan.application.ucservice.patient;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import org.springframework.data.domain.PageImpl;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import com.benhsoan.domain.patient.Patient;
import com.benhsoan.domain.patient.enums.Gender;
import com.benhsoan.port.outbound.repository.patient.PatientRepository;

class PatientImportDuplicateDetectorTest {

    private PatientRepository patientRepository;
    private PatientImportDuplicateDetector detector;

    @BeforeEach
    void setUp() {
        patientRepository = mock(PatientRepository.class);
        detector = new PatientImportDuplicateDetector(patientRepository);
    }

    @Test
    @DisplayName("Should detect internal duplicates in the same file by CCCD")
    void shouldDetectInternalDuplicateByCccd() {
        ValidatedPatientRowDto row1 = ValidatedPatientRowDto.builder()
                .rowNumber(2)
                .fullName("Nguyễn Văn A")
                .dateOfBirth(LocalDate.of(1990, 1, 1))
                .gender(Gender.MALE)
                .identityNumber("001090123456")
                .build();

        ValidatedPatientRowDto row2 = ValidatedPatientRowDto.builder()
                .rowNumber(3)
                .fullName("Nguyễn Văn B")
                .dateOfBirth(LocalDate.of(1992, 2, 2))
                .gender(Gender.MALE)
                .identityNumber("001090123456") // Same CCCD
                .build();

        var result = detector.detectDuplicates(List.of(row1, row2));

        assertThat(result.nonDuplicateRows()).hasSize(1);
        assertThat(result.nonDuplicateRows().get(0).getRowNumber()).isEqualTo(2);
        assertThat(result.suspectedDuplicates()).hasSize(1);
        assertThat(result.suspectedDuplicates().get(0).rowNumber()).isEqualTo(3);
        assertThat(result.suspectedDuplicates().get(0).duplicateReason()).contains("Trùng số CCCD/CMND");
    }

    @Test
    @DisplayName("Should detect database duplicate by CCCD")
    void shouldDetectDatabaseDuplicateByCccd() {
        ValidatedPatientRowDto row = ValidatedPatientRowDto.builder()
                .rowNumber(2)
                .fullName("Trần Thị C")
                .dateOfBirth(LocalDate.of(1985, 5, 5))
                .gender(Gender.FEMALE)
                .identityNumber("001085999999")
                .build();

        when(patientRepository.existsByIdentityNumber("001085999999")).thenReturn(true);

        var result = detector.detectDuplicates(List.of(row));

        assertThat(result.nonDuplicateRows()).isEmpty();
        assertThat(result.suspectedDuplicates()).hasSize(1);
        assertThat(result.suspectedDuplicates().get(0).duplicateReason()).contains("Số CCCD/CMND đã tồn tại trên hệ thống");
    }

    @Test
    @DisplayName("Should detect database duplicate by Name + DOB + Phone")
    void shouldDetectDatabaseDuplicateByNameDobPhone() {
        ValidatedPatientRowDto row = ValidatedPatientRowDto.builder()
                .rowNumber(2)
                .fullName("Lê Hoàng Nam")
                .dateOfBirth(LocalDate.of(1991, 10, 20))
                .gender(Gender.MALE)
                .phone("0903111222")
                .build();

        Patient existingPatient = mock(Patient.class);
        when(existingPatient.getId()).thenReturn(UUID.randomUUID());
        when(existingPatient.getPatientCode()).thenReturn("BN-000123");
        when(existingPatient.getFullName()).thenReturn("Lê Hoàng Nam");
        when(existingPatient.getDateOfBirth()).thenReturn(LocalDate.of(1991, 10, 20));
        when(existingPatient.isMerged()).thenReturn(false);

        when(patientRepository.findAllByPhone("0903111222")).thenReturn(List.of(existingPatient));

        var result = detector.detectDuplicates(List.of(row));

        assertThat(result.nonDuplicateRows()).isEmpty();
        assertThat(result.suspectedDuplicates()).hasSize(1);
        assertThat(result.suspectedDuplicates().get(0).matchedExistingPatientCode()).isEqualTo("BN-000123");
    }

    @Test
    @DisplayName("Should detect database duplicate by Name + DOB when phone is empty (e.g. minor)")
    void shouldDetectDatabaseDuplicateByNameDobWhenPhoneIsEmpty() {
        ValidatedPatientRowDto row = ValidatedPatientRowDto.builder()
                .rowNumber(3)
                .fullName("Nguyễn Minh Khang")
                .dateOfBirth(LocalDate.of(2015, 10, 20))
                .gender(Gender.MALE)
                .phone(null)
                .guardianPhone("0901234567")
                .build();

        Patient existingPatient = mock(Patient.class);
        when(existingPatient.getId()).thenReturn(UUID.randomUUID());
        when(existingPatient.getPatientCode()).thenReturn("BN-000456");
        when(existingPatient.getFullName()).thenReturn("Nguyễn Minh Khang");
        when(existingPatient.getDateOfBirth()).thenReturn(LocalDate.of(2015, 10, 20));
        when(existingPatient.isMerged()).thenReturn(false);

        when(patientRepository.findAllByPhone("0901234567")).thenReturn(List.of());
        when(patientRepository.search(any())).thenReturn(new PageImpl<>(List.of(existingPatient)));

        var result = detector.detectDuplicates(List.of(row));

        assertThat(result.nonDuplicateRows()).isEmpty();
        assertThat(result.suspectedDuplicates()).hasSize(1);
        assertThat(result.suspectedDuplicates().get(0).matchedExistingPatientCode()).isEqualTo("BN-000456");
        assertThat(result.suspectedDuplicates().get(0).duplicateReason()).containsIgnoringCase("trùng khớp Họ tên và Ngày sinh");
    }

    @Test
    @DisplayName("Should pass non-duplicate when phone is empty and no match exists in DB")
    void shouldPassNonDuplicateWhenPhoneIsEmptyAndNoMatchInDb() {
        ValidatedPatientRowDto row = ValidatedPatientRowDto.builder()
                .rowNumber(3)
                .fullName("Nguyễn Minh Khang")
                .dateOfBirth(LocalDate.of(2015, 10, 20))
                .gender(Gender.MALE)
                .phone(null)
                .guardianPhone("0901234567")
                .build();

        when(patientRepository.findAllByPhone("0901234567")).thenReturn(List.of());
        when(patientRepository.search(any())).thenReturn(new PageImpl<>(List.of()));

        var result = detector.detectDuplicates(List.of(row));

        assertThat(result.nonDuplicateRows()).hasSize(1);
        assertThat(result.nonDuplicateRows().get(0).getFullName()).isEqualTo("Nguyễn Minh Khang");
        assertThat(result.suspectedDuplicates()).isEmpty();
    }

    @Test
    @DisplayName("Should detect database duplicate by CCCD with full matched patient details")
    void shouldDetectDatabaseDuplicateByCccdWithPatientDetails() {
        ValidatedPatientRowDto row = ValidatedPatientRowDto.builder()
                .rowNumber(2)
                .fullName("Nguyễn Văn An")
                .dateOfBirth(LocalDate.of(1988, 5, 15))
                .gender(Gender.MALE)
                .identityNumber("001088012345")
                .build();

        Patient existing = mock(Patient.class);
        UUID pid = UUID.randomUUID();
        when(existing.getId()).thenReturn(pid);
        when(existing.getPatientCode()).thenReturn("BN000001");
        when(existing.getFullName()).thenReturn("Nguyễn Văn An");

        when(patientRepository.findByIdentityNumber("001088012345")).thenReturn(java.util.Optional.of(existing));

        var result = detector.detectDuplicates(List.of(row));

        assertThat(result.nonDuplicateRows()).isEmpty();
        assertThat(result.suspectedDuplicates()).hasSize(1);
        var dup = result.suspectedDuplicates().get(0);
        assertThat(dup.matchedExistingPatientId()).isEqualTo(pid);
        assertThat(dup.matchedExistingPatientCode()).isEqualTo("BN000001");
        assertThat(dup.matchedExistingFullName()).isEqualTo("Nguyễn Văn An");
        assertThat(dup.duplicateReason()).contains("BN000001");
    }

    @Test
    @DisplayName("Should detect internal duplicate with reference to first row")
    void shouldDetectInternalDuplicateWithReferenceRow() {
        ValidatedPatientRowDto row1 = ValidatedPatientRowDto.builder()
                .rowNumber(2)
                .fullName("Trần Văn An")
                .dateOfBirth(LocalDate.of(1990, 1, 1))
                .gender(Gender.MALE)
                .identityNumber("001090123456")
                .build();

        ValidatedPatientRowDto row2 = ValidatedPatientRowDto.builder()
                .rowNumber(4)
                .fullName("Trần Văn An")
                .dateOfBirth(LocalDate.of(1990, 1, 1))
                .gender(Gender.MALE)
                .identityNumber("001090123456")
                .build();

        var result = detector.detectDuplicates(List.of(row1, row2));

        assertThat(result.nonDuplicateRows()).hasSize(1);
        assertThat(result.suspectedDuplicates()).hasSize(1);
        var dup = result.suspectedDuplicates().get(0);
        assertThat(dup.rowNumber()).isEqualTo(4);
        assertThat(dup.matchedExistingPatientCode()).isEqualTo("Dòng 2");
        assertThat(dup.matchedExistingFullName()).isEqualTo("Trần Văn An");
    }
}
