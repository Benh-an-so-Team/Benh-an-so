package com.benhsoan.application.ucservice.medicalrecord;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;

import com.benhsoan.domain.medicalrecord.MedicalRecord;
import com.benhsoan.domain.medicalrecord.enums.MedicalRecordAccessAction;
import com.benhsoan.domain.medicalrecord.enums.MedicalRecordStatus;
import com.benhsoan.domain.medicalrecord.exception.MedicalRecordArchivedReadOnlyException;
import com.benhsoan.domain.medicalrecord.exception.MedicalRecordNotSignedException;
import com.benhsoan.domain.shared.exception.ValidationException;
import com.benhsoan.domain.visit.Visit;
import com.benhsoan.domain.visit.enums.VisitStatus;
import com.benhsoan.domain.visit.enums.VisitType;
import com.benhsoan.port.dto.query.SearchArchivedMedicalRecordsQuery;
import com.benhsoan.port.dto.result.ArchivedMedicalRecordResult;
import com.benhsoan.port.dto.result.BatchArchiveMedicalRecordResult;
import com.benhsoan.port.dto.result.MedicalRecordResult;
import com.benhsoan.port.outbound.repository.clinic.ClinicConfigurationRepository;
import com.benhsoan.port.outbound.repository.medicalrecord.ArchiveMedicalRecordQueryRepository;
import com.benhsoan.port.outbound.repository.medicalrecord.MedicalRecordRepository;
import com.benhsoan.port.outbound.repository.visit.VisitRepository;
import com.benhsoan.port.outbound.security.CurrentUserPort;
import com.benhsoan.port.outbound.time.ClockPort;

@ExtendWith(MockitoExtension.class)
class MedicalRecordArchiveIntegrationTest {

        private static final Instant NOW = Instant.parse("2026-09-24T10:00:00Z");
        private static final UUID RECORD_ID = UUID.randomUUID();
        private static final UUID VISIT_ID = UUID.randomUUID();
        private static final UUID PATIENT_ID = UUID.randomUUID();
        private static final UUID DOCTOR_ID = UUID.randomUUID();
        private static final UUID ADMIN_ID = UUID.randomUUID();

        @Mock
        private MedicalRecordRepository medicalRecordRepository;
        @Mock
        private VisitRepository visitRepository;
        @Mock
        private ClinicConfigurationRepository clinicConfigurationRepository;
        @Mock
        private ArchiveMedicalRecordQueryRepository archiveQueryRepository;
        @Mock
        private MedicalRecordAuthorizationService authorizationService;
        @Mock
        private MedicalRecordAccessAuditService accessAuditService;
        @Mock
        private MedicalRecordDeletionAuditWriter deletionAuditWriter;
        @Mock
        private MedicalRecordTemplateApplicationMapper templateMapper;
        @Mock
        private MedicalRecordResultMapper resultMapper;
        @Mock
        private CurrentUserPort currentUserPort;
        @Mock
        private ClockPort clockPort;

        private ArchiveMedicalRecordService archiveService;
        private BatchArchiveMedicalRecordService batchArchiveService;
        private SearchArchivedMedicalRecordsService searchService;
        private DeleteMedicalRecordService deleteService;

        @BeforeEach
        void setUp() {
                archiveService = new ArchiveMedicalRecordService(
                                medicalRecordRepository, visitRepository, clinicConfigurationRepository,
                                authorizationService, accessAuditService, templateMapper, resultMapper, clockPort);

                batchArchiveService = new BatchArchiveMedicalRecordService(
                                medicalRecordRepository, visitRepository, clinicConfigurationRepository,
                                archiveQueryRepository, authorizationService, accessAuditService, clockPort);

                searchService = new SearchArchivedMedicalRecordsService(
                                archiveQueryRepository, authorizationService);

                MedicalRecordRetentionPolicy retentionPolicy = new MedicalRecordRetentionPolicy(
                                clinicConfigurationRepository);
                deleteService = new DeleteMedicalRecordService(
                                medicalRecordRepository, visitRepository, deletionAuditWriter,
                                currentUserPort, clockPort, retentionPolicy);
        }

        @Test
        @DisplayName("NCL-11-CN-008-TC-01: Chuyển lưu trữ hồ sơ đã ký và quá hạn hoạt động thành công")
        void tc01_successfulArchiveEligibleRecord() {
                when(clockPort.now()).thenReturn(NOW);
                when(authorizationService.requireArchiveManageAccess()).thenReturn(ADMIN_ID);
                when(clinicConfigurationRepository.find()).thenReturn(Optional.empty()); // default 12 months

                MedicalRecord signedRecord = MedicalRecord.restore(
                                RECORD_ID, VISIT_ID, "Ho sốt", "Sốt cao", "Không", "Bình thường",
                                "Tiến triển tốt", "Kê đơn", "Nghỉ ngơi", "Viêm họng cấp",
                                LocalDate.now().plusDays(7), MedicalRecordStatus.SIGNED, "SIG_DATA",
                                NOW.minusSeconds(10000), DOCTOR_ID, null, null, DOCTOR_ID,
                                NOW.minusSeconds(10000), null, null, null, null, null, null, null);
                when(medicalRecordRepository.findByIdForUpdate(RECORD_ID)).thenReturn(Optional.of(signedRecord));
                when(medicalRecordRepository.save(signedRecord)).thenReturn(signedRecord);

                // Completed 13 months ago (> 12 months)
                Instant completedAt = NOW.atZone(ZoneOffset.UTC).minusMonths(13).toInstant();
                Visit completedVisit = Visit.restore(
                                VISIT_ID, "VIS-001", PATIENT_ID, DOCTOR_ID, null, null, VisitType.WALK_IN,
                                VisitStatus.COMPLETED, completedAt.minusSeconds(3600), completedAt.minusSeconds(1800),
                                completedAt,
                                "Lý do khám", null, DOCTOR_ID, completedAt.minusSeconds(3600), completedAt);
                when(visitRepository.findById(VISIT_ID)).thenReturn(Optional.of(completedVisit));

                when(resultMapper.toResult(signedRecord, null)).thenReturn(new MedicalRecordResult(
                                RECORD_ID, VISIT_ID, "Ho sốt", "Sốt cao", "Không", "Bình thường",
                                "Tiến triển tốt", "Kê đơn", "Nghỉ ngơi", "Viêm họng cấp",
                                MedicalRecordStatus.ARCHIVED, null, null, null, NOW, ADMIN_ID, ADMIN_ID, NOW, ADMIN_ID,
                                NOW));

                MedicalRecordResult result = archiveService.archive(RECORD_ID);

                assertEquals(MedicalRecordStatus.ARCHIVED, result.status());
                assertEquals(MedicalRecordStatus.ARCHIVED, signedRecord.getStatus());
                assertEquals(ADMIN_ID, signedRecord.getArchivedBy());
                assertEquals(NOW, signedRecord.getArchivedAt());

                verify(accessAuditService).recordRecordAccess(
                                PATIENT_ID, VISIT_ID, RECORD_ID, ADMIN_ID,
                                MedicalRecordAccessAction.ARCHIVE, "Medical record archived", NOW);
        }

        @Test
        @DisplayName("NCL-11-CN-008-TC-02: Thử sửa hoặc xóa hồ sơ trong kho lưu trữ bị từ chối và ghi nhật ký")
        void tc02_denyEditOrDeleteOnArchivedRecord() {
                when(clockPort.now()).thenReturn(NOW);
                when(currentUserPort.getCurrentUserId()).thenReturn(ADMIN_ID);

                MedicalRecord archivedRecord = MedicalRecord.restore(
                                RECORD_ID, VISIT_ID, "Ho sốt", "Sốt cao", "Không", "Bình thường",
                                "Tiến triển tốt", "Kê đơn", "Nghỉ ngơi", "Viêm họng cấp",
                                LocalDate.now().plusDays(7), MedicalRecordStatus.ARCHIVED, "SIG_DATA",
                                NOW.minusSeconds(10000), DOCTOR_ID, null, null, DOCTOR_ID,
                                NOW.minusSeconds(10000), null, null, null, null, null, NOW.minusSeconds(5000),
                                ADMIN_ID);

                when(medicalRecordRepository.findById(RECORD_ID)).thenReturn(Optional.of(archivedRecord));

                // 1. Thử xóa hồ sơ lưu trữ: phải ném MedicalRecordArchivedReadOnlyException và
                // ghi nhật ký từ chối
                assertThrows(MedicalRecordArchivedReadOnlyException.class, () -> deleteService.delete(RECORD_ID));
                verify(medicalRecordRepository, never()).deleteById(RECORD_ID);
                verify(deletionAuditWriter).writeDenied(ADMIN_ID, RECORD_ID, NOW);

                // 2. Thử sửa hồ sơ lưu trữ: ensureEditable() phải ném
                // MedicalRecordArchivedReadOnlyException
                assertThrows(MedicalRecordArchivedReadOnlyException.class, archivedRecord::ensureEditable);
        }

        @Test
        @DisplayName("NCL-11-CN-008-TC-03: Tra cứu kho lưu trữ trả về đầy đủ nội dung nguyên vẹn")
        void tc03_searchArchivedRecordsReturnsFullContent() {
                when(authorizationService.requireArchiveReadAccess()).thenReturn(DOCTOR_ID);

                ArchivedMedicalRecordResult item = ArchivedMedicalRecordResult.builder()
                                .medicalRecordId(RECORD_ID)
                                .visitId(VISIT_ID)
                                .visitCode("VIS-999")
                                .patientId(PATIENT_ID)
                                .patientCode("BN-0001")
                                .patientFullName("Nguyễn Văn An")
                                .patientPhone("0987654321")
                                .doctorId(DOCTOR_ID)
                                .doctorFullName("Bác sĩ Nguyễn")
                                .conclusion("Viêm phổi cấp đã khỏi")
                                .revisitDate(LocalDate.of(2025, 1, 10))
                                .status("ARCHIVED")
                                .completedAt(NOW.minusSeconds(86400 * 400))
                                .signedAt(NOW.minusSeconds(86400 * 400))
                                .archivedAt(NOW.minusSeconds(86400 * 30))
                                .archivedBy(ADMIN_ID)
                                .build();

                PageRequest pageable = PageRequest.of(0, 10);
                when(archiveQueryRepository.searchArchivedRecords("BN-0001", null, null, null, pageable))
                                .thenReturn(new PageImpl<>(List.of(item), pageable, 1));

                SearchArchivedMedicalRecordsQuery query = new SearchArchivedMedicalRecordsQuery("BN-0001", null, null,
                                null);
                Page<ArchivedMedicalRecordResult> page = searchService.search(query, pageable);

                assertNotNull(page);
                assertEquals(1, page.getTotalElements());
                ArchivedMedicalRecordResult found = page.getContent().get(0);
                assertEquals("BN-0001", found.getPatientCode());
                assertEquals("Viêm phổi cấp đã khỏi", found.getConclusion());
                assertEquals("ARCHIVED", found.getStatus());
        }

        @Test
        @DisplayName("QTN-41: Từ chối chuyển lưu trữ nếu bệnh án chưa được ký (DRAFT hoặc OPEN)")
        void qtn41_rejectArchiveForUnsignedRecord() {
                when(clockPort.now()).thenReturn(NOW);
                when(authorizationService.requireArchiveManageAccess()).thenReturn(ADMIN_ID);
                when(clinicConfigurationRepository.find()).thenReturn(Optional.empty());

                MedicalRecord draftRecord = MedicalRecord.restore(
                                RECORD_ID, VISIT_ID, "Ho", "Sốt", "Không", "Bình thường",
                                null, null, null, null,
                                null, MedicalRecordStatus.DRAFT, null,
                                null, null, null, null, DOCTOR_ID,
                                NOW, null, null, null, null, null, null, null);
                when(medicalRecordRepository.findByIdForUpdate(RECORD_ID)).thenReturn(Optional.of(draftRecord));

                Instant completedAt = NOW.atZone(ZoneOffset.UTC).minusMonths(15).toInstant();
                Visit completedVisit = Visit.restore(
                                VISIT_ID, "VIS-001", PATIENT_ID, DOCTOR_ID, null, null, VisitType.WALK_IN,
                                VisitStatus.COMPLETED, completedAt.minusSeconds(3600), completedAt.minusSeconds(1800),
                                completedAt,
                                "Lý do", null, DOCTOR_ID, completedAt.minusSeconds(3600), completedAt);
                when(visitRepository.findById(VISIT_ID)).thenReturn(Optional.of(completedVisit));

                assertThrows(MedicalRecordNotSignedException.class, () -> archiveService.archive(RECORD_ID));
        }

        @Test
        @DisplayName("Lưu trữ hàng loạt (batchArchive) hoạt động chính xác cho các hồ sơ hợp lệ")
        void batchArchive_archivesEligibleRecords() {
                when(clockPort.now()).thenReturn(NOW);
                when(authorizationService.requireArchiveManageAccess()).thenReturn(ADMIN_ID);
                when(clinicConfigurationRepository.find()).thenReturn(Optional.empty());

                MedicalRecord record1 = MedicalRecord.restore(
                                RECORD_ID, VISIT_ID, "c", "s", "h", "p", "cp", "tp", "di", "co",
                                LocalDate.now(), MedicalRecordStatus.SIGNED, "SIG", NOW, DOCTOR_ID,
                                null, null, DOCTOR_ID, NOW, null, null, null, null, null, null, null);
                when(medicalRecordRepository.findByIdForUpdate(RECORD_ID)).thenReturn(Optional.of(record1));
                when(medicalRecordRepository.save(record1)).thenReturn(record1);

                Instant completedAt = NOW.atZone(ZoneOffset.UTC).minusMonths(13).toInstant();
                Visit visit1 = Visit.restore(
                                VISIT_ID, "VIS-001", PATIENT_ID, DOCTOR_ID, null, null, VisitType.WALK_IN,
                                VisitStatus.COMPLETED, completedAt.minusSeconds(3600), completedAt.minusSeconds(1800),
                                completedAt,
                                "Lý do", null, DOCTOR_ID, completedAt.minusSeconds(3600), completedAt);
                when(visitRepository.findById(VISIT_ID)).thenReturn(Optional.of(visit1));

                BatchArchiveMedicalRecordResult batchResult = batchArchiveService.batchArchive(List.of(RECORD_ID),
                                false);

                assertEquals(1, batchResult.getTotalRequested());
                assertEquals(1, batchResult.getArchivedCount());
                assertEquals(0, batchResult.getSkippedCount());
                assertEquals(MedicalRecordStatus.ARCHIVED, record1.getStatus());
        }

        @Test
        @DisplayName("F-06: Batch archive rejects when requested records exceed 100")
        void batchArchive_rejectsWhenExceedingMaxBatchSize() {
                List<UUID> excessiveList = java.util.stream.IntStream.range(0, 101)
                                .mapToObj(i -> UUID.randomUUID())
                                .toList();

                assertThrows(ValidationException.class, () -> batchArchiveService.batchArchive(excessiveList, false));
        }
}
