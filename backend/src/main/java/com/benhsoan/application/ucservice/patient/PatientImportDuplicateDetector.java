package com.benhsoan.application.ucservice.patient;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Component;

import com.benhsoan.domain.patient.Patient;
import com.benhsoan.domain.shared.VietnameseTextNormalizer;
import com.benhsoan.port.dto.result.patient.SuspectedDuplicateResult;
import com.benhsoan.port.outbound.repository.patient.PatientRepository;

import lombok.RequiredArgsConstructor;

@Component
@RequiredArgsConstructor
public class PatientImportDuplicateDetector {

    private final PatientRepository patientRepository;

    private record GroupKey(String normalizedName, LocalDate dob, String phone) {}

    public record DuplicateCheckResult(
            List<ValidatedPatientRowDto> nonDuplicateRows,
            List<SuspectedDuplicateResult> suspectedDuplicates
    ) {}

    public DuplicateCheckResult detectDuplicates(List<ValidatedPatientRowDto> validRows) {
        List<ValidatedPatientRowDto> nonDuplicateRows = new ArrayList<>();
        List<SuspectedDuplicateResult> suspectedDuplicates = new ArrayList<>();

        Map<String, ValidatedPatientRowDto> seenIdentityNumbers = new HashMap<>();
        Map<GroupKey, ValidatedPatientRowDto> seenGroupKeys = new HashMap<>();
        Map<String, Patient> identityPatientCache = new HashMap<>();
        Map<String, List<Patient>> phonePatientsCache = new HashMap<>();
        Map<String, List<Patient>> nameDobPatientsCache = new HashMap<>();

        for (ValidatedPatientRowDto row : validRows) {
            String normName = row.getFullName() == null ? "" : VietnameseTextNormalizer.normalize(row.getFullName());
            String phone = row.getPhone() == null ? "" : row.getPhone();
            GroupKey key = new GroupKey(normName, row.getDateOfBirth(), phone);

            // 1. Check Internal Duplicates within the same file
            if (row.getIdentityNumber() != null && seenIdentityNumbers.containsKey(row.getIdentityNumber())) {
                ValidatedPatientRowDto firstRow = seenIdentityNumbers.get(row.getIdentityNumber());
                suspectedDuplicates.add(new SuspectedDuplicateResult(
                        row.getRowNumber(),
                        row.getFullName(),
                        row.getDateOfBirth(),
                        row.getPhone(),
                        row.getIdentityNumber(),
                        null,
                        "Dòng " + firstRow.getRowNumber(),
                        firstRow.getFullName(),
                        "Trùng số CCCD/CMND với dòng " + firstRow.getRowNumber() + " (" + firstRow.getFullName() + ") trong cùng tệp tải lên."
                ));
                continue;
            }

            if (seenGroupKeys.containsKey(key)) {
                ValidatedPatientRowDto firstRow = seenGroupKeys.get(key);
                suspectedDuplicates.add(new SuspectedDuplicateResult(
                        row.getRowNumber(),
                        row.getFullName(),
                        row.getDateOfBirth(),
                        row.getPhone(),
                        row.getIdentityNumber(),
                        null,
                        "Dòng " + firstRow.getRowNumber(),
                        firstRow.getFullName(),
                        phone.isEmpty()
                                ? "Trùng Họ tên và Ngày sinh với dòng " + firstRow.getRowNumber() + " (" + firstRow.getFullName() + ") trong cùng tệp tải lên."
                                : "Trùng Họ tên, Ngày sinh và Số điện thoại với dòng " + firstRow.getRowNumber() + " (" + firstRow.getFullName() + ") trong cùng tệp tải lên."
                ));
                continue;
            }

            // 2. Check Database Duplicates by CCCD/CMND (using cache to avoid repeated queries)
            if (row.getIdentityNumber() != null) {
                if (!identityPatientCache.containsKey(row.getIdentityNumber())) {
                    identityPatientCache.put(
                            row.getIdentityNumber(),
                            patientRepository.findByIdentityNumber(row.getIdentityNumber()).orElse(null)
                    );
                }
                Patient matchedPatient = identityPatientCache.get(row.getIdentityNumber());
                if (matchedPatient != null) {
                    suspectedDuplicates.add(new SuspectedDuplicateResult(
                            row.getRowNumber(),
                            row.getFullName(),
                            row.getDateOfBirth(),
                            row.getPhone(),
                            row.getIdentityNumber(),
                            matchedPatient.getId(),
                            matchedPatient.getPatientCode(),
                            matchedPatient.getFullName(),
                            "Số CCCD/CMND trùng khớp với bệnh nhân " + matchedPatient.getPatientCode() + " (" + matchedPatient.getFullName() + ") đã có trong hệ thống."
                    ));
                    continue;
                } else if (patientRepository.existsByIdentityNumber(row.getIdentityNumber())) {
                    suspectedDuplicates.add(new SuspectedDuplicateResult(
                            row.getRowNumber(),
                            row.getFullName(),
                            row.getDateOfBirth(),
                            row.getPhone(),
                            row.getIdentityNumber(),
                            null,
                            null,
                            null,
                            "Số CCCD/CMND đã tồn tại trên hệ thống."
                    ));
                    continue;
                }
            }

            // 3. Check Database Duplicates by (Name + DOB + Phone) or (Name + DOB) for patients without phone
            boolean matchedDb = false;
            if (!phone.isEmpty()) {
                List<Patient> existingByPhone = phonePatientsCache.computeIfAbsent(
                        phone,
                        patientRepository::findAllByPhone
                );
                for (Patient p : existingByPhone) {
                    if (p.isMerged()) {
                        continue;
                    }
                    boolean dobMatch = p.getDateOfBirth() != null && p.getDateOfBirth().equals(row.getDateOfBirth());
                    String existingNormName = p.getFullName() == null ? "" : VietnameseTextNormalizer.normalize(p.getFullName());
                    boolean nameMatch = normName.equalsIgnoreCase(existingNormName);

                    if (dobMatch && nameMatch) {
                        suspectedDuplicates.add(new SuspectedDuplicateResult(
                                row.getRowNumber(),
                                row.getFullName(),
                                row.getDateOfBirth(),
                                row.getPhone(),
                                row.getIdentityNumber(),
                                p.getId(),
                                p.getPatientCode(),
                                p.getFullName(),
                                "Hồ sơ trùng khớp Họ tên, Ngày sinh và Số điện thoại với bệnh nhân " + p.getPatientCode() + " đã có trong hệ thống."
                        ));
                        matchedDb = true;
                        break;
                    }
                }
            } else {
                // For minors or patients without personal phone: check via guardianPhone or Name+DOB search
                String guardianPhone = row.getGuardianPhone() != null ? row.getGuardianPhone().trim() : "";
                if (!guardianPhone.isEmpty()) {
                    List<Patient> existingByGPhone = phonePatientsCache.computeIfAbsent(
                            guardianPhone,
                            patientRepository::findAllByPhone
                    );
                    for (Patient p : existingByGPhone) {
                        if (p.isMerged()) {
                            continue;
                        }
                        boolean dobMatch = p.getDateOfBirth() != null && p.getDateOfBirth().equals(row.getDateOfBirth());
                        String existingNormName = p.getFullName() == null ? "" : VietnameseTextNormalizer.normalize(p.getFullName());
                        boolean nameMatch = normName.equalsIgnoreCase(existingNormName);

                        if (dobMatch && nameMatch) {
                            suspectedDuplicates.add(new SuspectedDuplicateResult(
                                    row.getRowNumber(),
                                    row.getFullName(),
                                    row.getDateOfBirth(),
                                    row.getPhone(),
                                    row.getIdentityNumber(),
                                    p.getId(),
                                    p.getPatientCode(),
                                    p.getFullName(),
                                    "Hồ sơ trùng khớp Họ tên, Ngày sinh và Số điện thoại người giám hộ với bệnh nhân " + p.getPatientCode() + " đã có trong hệ thống."
                            ));
                            matchedDb = true;
                            break;
                        }
                    }
                }

                if (!matchedDb && !normName.isEmpty() && row.getDateOfBirth() != null) {
                    String nameDobKey = normName + "_" + row.getDateOfBirth();
                    List<Patient> byNameDob = nameDobPatientsCache.computeIfAbsent(
                            nameDobKey,
                            k -> {
                                var searchCmd = com.benhsoan.port.dto.command.patient.SearchPatientCommand.builder()
                                        .fullName(row.getFullName())
                                        .dateOfBirth(row.getDateOfBirth())
                                        .pageable(PageRequest.of(0, 20))
                                        .build();
                                var searchPage = patientRepository.search(searchCmd);
                                return searchPage != null && searchPage.getContent() != null ? searchPage.getContent() : List.of();
                            }
                    );
                    for (Patient p : byNameDob) {
                        if (p.isMerged()) {
                            continue;
                        }
                        boolean dobMatch = p.getDateOfBirth() != null && p.getDateOfBirth().equals(row.getDateOfBirth());
                        String existingNormName = p.getFullName() == null ? "" : VietnameseTextNormalizer.normalize(p.getFullName());
                        boolean nameMatch = normName.equalsIgnoreCase(existingNormName);

                        if (dobMatch && nameMatch) {
                            suspectedDuplicates.add(new SuspectedDuplicateResult(
                                    row.getRowNumber(),
                                    row.getFullName(),
                                    row.getDateOfBirth(),
                                    row.getPhone(),
                                    row.getIdentityNumber(),
                                    p.getId(),
                                    p.getPatientCode(),
                                    p.getFullName(),
                                    "Hồ sơ trùng khớp Họ tên và Ngày sinh với bệnh nhân " + p.getPatientCode() + " đã có trong hệ thống."
                            ));
                            matchedDb = true;
                            break;
                        }
                    }
                }
            }

            if (matchedDb) {
                continue;
            }

            // Record as seen
            if (row.getIdentityNumber() != null) {
                seenIdentityNumbers.put(row.getIdentityNumber(), row);
            }
            seenGroupKeys.put(key, row);

            nonDuplicateRows.add(row);
        }

        return new DuplicateCheckResult(nonDuplicateRows, suspectedDuplicates);
    }
}
