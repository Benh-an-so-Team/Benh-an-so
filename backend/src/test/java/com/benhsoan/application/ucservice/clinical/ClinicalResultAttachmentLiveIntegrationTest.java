package com.benhsoan.application.ucservice.clinical;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assumptions.assumeTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.util.unit.DataSize;

import com.benhsoan.config.ClinicalAttachmentProperties;
import com.benhsoan.domain.clinical.ClinicalOrderItem;
import com.benhsoan.domain.clinical.ClinicalResult;
import com.benhsoan.domain.clinical.ClinicalServiceCatalog;
import com.benhsoan.domain.clinical.MedicalAttachment;
import com.benhsoan.domain.clinical.enums.ClinicalOrderItemStatus;
import com.benhsoan.domain.clinical.enums.ClinicalResultAbnormalFlag;
import com.benhsoan.domain.clinical.enums.ClinicalResultStatus;
import com.benhsoan.domain.clinical.enums.ClinicalResultType;
import com.benhsoan.domain.clinical.enums.ClinicalServiceType;
import com.benhsoan.domain.clinical.enums.MedicalAttachmentType;
import com.benhsoan.domain.medicalrecord.MedicalRecord;
import com.benhsoan.domain.medicalrecord.enums.MedicalRecordAccessAction;
import com.benhsoan.domain.shared.exception.ValidationException;
import com.benhsoan.domain.visit.Visit;
import com.benhsoan.domain.visit.enums.VisitStatus;
import com.benhsoan.domain.visit.enums.VisitType;
import com.benhsoan.infrastructure.storage.CloudinaryClinicalAttachmentStorageAdapter;
import com.benhsoan.infrastructure.storage.CloudinaryProperties;
import com.benhsoan.port.dto.command.clinical.UploadClinicalResultAttachmentCommand;
import com.benhsoan.port.dto.result.ClinicalAttachmentDownloadResult;
import com.benhsoan.port.dto.result.ClinicalResultResult;
import com.benhsoan.port.outbound.repository.clinical.ClinicalOrderItemRepository;
import com.benhsoan.port.outbound.repository.clinical.ClinicalResultRepository;
import com.benhsoan.port.outbound.repository.clinical.ClinicalServiceCatalogRepository;
import com.benhsoan.port.outbound.repository.clinical.MedicalAttachmentRepository;
import com.benhsoan.port.outbound.repository.medicalrecord.MedicalRecordRepository;
import com.benhsoan.port.outbound.repository.visit.VisitRepository;
import com.benhsoan.port.outbound.storage.ClinicalAttachmentResourceType;
import com.benhsoan.port.outbound.time.ClockPort;
import com.cloudinary.Cloudinary;
import com.cloudinary.utils.ObjectUtils;

/**
 * End-to-End Service Integration Test for NCL-04-CN-003.
 * Tests ClinicalResultAttachmentService wired with the REAL CloudinaryClinicalAttachmentStorageAdapter
 * (NO mock on ClinicalAttachmentStoragePort).
 *
 * Verifies Acceptance Criteria:
 * - NCL-04-CN-003-TC-01: Luồng thành công - Tải và đính kèm tệp lên Cloudinary thật, lưu DB và sinh Signed URL tải về.
 * - NCL-04-CN-003-TC-02: Dữ liệu không hợp lệ - File sai định dạng hoặc vượt quá kích thước bị chặn trước khi tải.
 * - NCL-04-CN-003-TC-03: Không có quyền - Người dùng không đủ quyền bị chặn từ tầng ủy quyền.
 * - Rollback Compensation: Tự động xóa tệp trên Cloudinary nếu transaction rollback.
 */
@Tag("integration")
@ExtendWith(MockitoExtension.class)
class ClinicalResultAttachmentLiveIntegrationTest {

    private static final Instant NOW = Instant.parse("2026-09-29T10:00:00Z");

    private static CloudinaryProperties cloudinaryProperties;
    private static Cloudinary cloudinary;
    private static CloudinaryClinicalAttachmentStorageAdapter realStorageAdapter;

    @Mock private ClinicalResultRepository clinicalResultRepository;
    @Mock private ClinicalOrderItemRepository clinicalOrderItemRepository;
    @Mock private ClinicalServiceCatalogRepository clinicalServiceCatalogRepository;
    @Mock private MedicalAttachmentRepository medicalAttachmentRepository;
    @Mock private VisitRepository visitRepository;
    @Mock private MedicalRecordRepository medicalRecordRepository;
    @Mock private ClinicalOrderAuthorizationService authorizationService;
    @Mock private ClinicalResultAuditService auditService;
    @Mock private ClockPort clock;

    private final List<UploadedCleanItem> uploadedAssets = new ArrayList<>();
    private record UploadedCleanItem(String publicId, ClinicalAttachmentResourceType resourceType) {}

    @BeforeAll
    static void initCloudinary() {
        cloudinaryProperties = resolveCloudinaryProperties();
        assumeTrue(cloudinaryProperties != null && cloudinaryProperties.enabled()
                        && cloudinaryProperties.cloudName() != null && !cloudinaryProperties.cloudName().isBlank()
                        && cloudinaryProperties.apiKey() != null && !cloudinaryProperties.apiKey().isBlank()
                        && cloudinaryProperties.apiSecret() != null && !cloudinaryProperties.apiSecret().isBlank(),
                "Cloudinary credentials missing. Skipping live integration test.");

        cloudinary = new Cloudinary(ObjectUtils.asMap(
                "cloud_name", cloudinaryProperties.cloudName(),
                "api_key", cloudinaryProperties.apiKey(),
                "api_secret", cloudinaryProperties.apiSecret(),
                "secure", true
        ));
        realStorageAdapter = new CloudinaryClinicalAttachmentStorageAdapter(cloudinary, cloudinaryProperties);
    }

    @AfterEach
    void tearDown() {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.clearSynchronization();
        }
        for (UploadedCleanItem item : uploadedAssets) {
            try {
                realStorageAdapter.delete(item.publicId(), item.resourceType());
            } catch (Exception ex) {
                System.err.println("Clean up failed for " + item.publicId() + ": " + ex.getMessage());
            }
        }
        uploadedAssets.clear();
    }

    @Test
    @DisplayName("NCL-04-CN-003-TC-01: Bác sĩ đính kèm tệp kết quả cận lâm sàng thật lên Cloudinary, lưu DB và tải về")
    void uploadAndDownload_RealCloudinary_Success() throws Exception {
        Fixture f = createFixture();
        ClinicalResultAttachmentService service = createService();

        // 1x1 valid PNG bytes
        byte[] pngBytes = new byte[] {
                (byte) 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
                0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
                0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
                0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, (byte) 0xC4,
                (byte) 0x89, 0x00, 0x00, 0x00, 0x0A, 0x49, 0x44, 0x41,
                0x54, 0x78, (byte) 0x9C, 0x63, 0x00, 0x01, 0x00, 0x00,
                0x05, 0x00, 0x01, 0x0D, 0x0A, 0x2D, (byte) 0xB4, 0x00,
                0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, (byte) 0xAE,
                0x42, 0x60, (byte) 0x82
        };
        UploadClinicalResultAttachmentCommand command = new UploadClinicalResultAttachmentCommand(
                "sieu_am_bung.png", "image/png", pngBytes
        );

        when(authorizationService.requireWriteAccess()).thenReturn(f.actorId());
        when(clinicalResultRepository.findById(f.result().getId())).thenReturn(Optional.of(f.result()));
        when(visitRepository.findById(f.visit().getId())).thenReturn(Optional.of(f.visit()));
        when(medicalRecordRepository.findByVisitId(f.visit().getId())).thenReturn(Optional.of(f.record()));
        when(clinicalOrderItemRepository.findById(f.item().getId())).thenReturn(Optional.of(f.item()));
        when(clinicalServiceCatalogRepository.findById(f.item().getClinicalServiceId())).thenReturn(Optional.of(f.service()));
        when(clock.now()).thenReturn(NOW);
        when(medicalAttachmentRepository.save(any(MedicalAttachment.class))).thenAnswer(call -> call.getArgument(0));

        // 1. Thực hiện tải lên (Gửi request thật lên Cloudinary)
        ClinicalResultResult.Attachment attachmentResult = service.upload(f.result().getId(), command);

        assertNotNull(attachmentResult);
        assertEquals("sieu_am_bung.png", attachmentResult.fileName());
        assertEquals("image/png", attachmentResult.contentType());
        assertEquals(pngBytes.length, attachmentResult.fileSize());
        assertEquals(MedicalAttachmentType.IMAGING_RESULT, attachmentResult.attachmentType());

        // Kiểm tra MedicalAttachment được lưu trong cơ sở dữ liệu
        ArgumentCaptor<MedicalAttachment> captor = ArgumentCaptor.forClass(MedicalAttachment.class);
        verify(medicalAttachmentRepository).save(captor.capture());
        MedicalAttachment saved = captor.getValue();

        assertNotNull(saved.getStorageKey());
        assertTrue(saved.getStorageKey().startsWith("benh-soan/clinical-results/" + f.result().getId() + "/"));
        assertEquals(64, saved.getChecksum().length(), "Checksum SHA-256 64 ký tự");
        uploadedAssets.add(new UploadedCleanItem(saved.getStorageKey(), ClinicalAttachmentResourceType.IMAGE));

        // Kiểm tra nhật ký truy cập được ghi
        verify(auditService).recordWrite(eq(f.result().getId()), eq(f.visit().getPatientId()), eq(f.visit().getId()),
                eq(f.record().getId()), eq(f.actorId()), eq(MedicalRecordAccessAction.UPDATE), eq(NOW));

        // 2. Tạo đường dẫn tải về (Signed URL từ Cloudinary)
        when(authorizationService.requireReadAccess()).thenReturn(f.actorId());
        when(medicalAttachmentRepository.findById(saved.getId())).thenReturn(Optional.of(saved));

        ClinicalAttachmentDownloadResult downloadResult = service.createDownloadUrl(saved.getId());

        assertNotNull(downloadResult);
        assertNotNull(downloadResult.url());
        assertTrue(downloadResult.url().contains("cloudinary.com/"));
        assertTrue(downloadResult.expiresAt().isAfter(Instant.now()));

        // 3. Tải tệp thực tế qua HTTP GET để xác nhận tệp có mặt trên Cloudinary
        HttpClient client = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();
        HttpRequest httpReq = HttpRequest.newBuilder().uri(URI.create(downloadResult.url())).GET().build();
        HttpResponse<byte[]> httpResp = client.send(httpReq, HttpResponse.BodyHandlers.ofByteArray());

        assertEquals(200, httpResp.statusCode(), "Cloudinary URL phải trả về HTTP 200");
        assertEquals(pngBytes.length, httpResp.body().length, "Nội dung tải về khớp số byte đã upload");
    }

    @Test
    @DisplayName("NCL-04-CN-003-TC-02: Dữ liệu không hợp lệ - File sai magic bytes bị từ chối trước khi upload Cloudinary")
    void upload_InvalidMagicBytes_RejectedBeforeCloudinary() {
        Fixture f = createFixture();
        ClinicalResultAttachmentService service = createService();

        // Pretend to be a PDF but content is arbitrary plain text
        UploadClinicalResultAttachmentCommand badCommand = new UploadClinicalResultAttachmentCommand(
                "fake.pdf", "application/pdf", "THIS IS NOT A VALID PDF CONTENT".getBytes(StandardCharsets.UTF_8)
        );

        when(authorizationService.requireWriteAccess()).thenReturn(f.actorId());

        assertThrows(ValidationException.class, () -> service.upload(f.result().getId(), badCommand));

        // Database and repositories must never be contacted
        verify(clinicalResultRepository, never()).findById(any());
        verify(medicalAttachmentRepository, never()).save(any());
    }

    @Test
    @DisplayName("NCL-04-CN-003-TC-03: Không có quyền - Bị từ chối truy cập không thể tải tệp lên Cloudinary")
    void upload_Unauthorized_ThrowsSecurityException() {
        Fixture f = createFixture();
        ClinicalResultAttachmentService service = createService();

        UploadClinicalResultAttachmentCommand command = new UploadClinicalResultAttachmentCommand(
                "doc.pdf", "application/pdf", "%PDF-1.4\nbody".getBytes(StandardCharsets.UTF_8)
        );

        when(authorizationService.requireWriteAccess())
                .thenThrow(new org.springframework.security.access.AccessDeniedException("Truy cập bị từ chối theo QTN-17"));

        assertThrows(org.springframework.security.access.AccessDeniedException.class,
                () -> service.upload(f.result().getId(), command));

        verify(clinicalResultRepository, never()).findById(any());
    }

    @Test
    @DisplayName("NCL-04-CN-003: Rollback Transaction tự động xóa dọn dẹp tệp trên Cloudinary")
    void upload_TransactionRollback_CleansUpCloudinaryAsset() throws Exception {
        Fixture f = createFixture();
        ClinicalResultAttachmentService service = createService();

        byte[] validPdf = "%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\nxref\n0 2\ntrailer<</Root 1 0 R>>\n%%EOF"
                .getBytes(StandardCharsets.US_ASCII);
        UploadClinicalResultAttachmentCommand command = new UploadClinicalResultAttachmentCommand(
                "report.pdf", "application/pdf", validPdf
        );

        when(authorizationService.requireWriteAccess()).thenReturn(f.actorId());
        when(clinicalResultRepository.findById(f.result().getId())).thenReturn(Optional.of(f.result()));
        when(visitRepository.findById(f.visit().getId())).thenReturn(Optional.of(f.visit()));
        when(medicalRecordRepository.findByVisitId(f.visit().getId())).thenReturn(Optional.of(f.record()));
        when(clinicalOrderItemRepository.findById(f.item().getId())).thenReturn(Optional.of(f.item()));
        when(clinicalServiceCatalogRepository.findById(f.item().getClinicalServiceId())).thenReturn(Optional.of(f.service()));
        when(clock.now()).thenReturn(NOW);
        when(medicalAttachmentRepository.save(any(MedicalAttachment.class))).thenAnswer(call -> call.getArgument(0));

        TransactionSynchronizationManager.initSynchronization();

        // Upload to Cloudinary
        service.upload(f.result().getId(), command);

        ArgumentCaptor<MedicalAttachment> captor = ArgumentCaptor.forClass(MedicalAttachment.class);
        verify(medicalAttachmentRepository).save(captor.capture());
        String uploadedPublicId = captor.getValue().getStorageKey();

        // Simulate database transaction failure -> STATUS_ROLLED_BACK
        TransactionSynchronizationManager.getSynchronizations().forEach(
                sync -> sync.afterCompletion(TransactionSynchronization.STATUS_ROLLED_BACK)
        );

        // Verify the asset was deleted from Cloudinary
        var destroyResponse = cloudinary.uploader().destroy(uploadedPublicId, ObjectUtils.asMap(
                "resource_type", "raw",
                "type", "authenticated"
        ));
        assertEquals("not found", destroyResponse.get("result"), "Asset should have been deleted by rollback compensation");
    }

    private ClinicalResultAttachmentService createService() {
        ClinicalAttachmentProperties attachmentProps = new ClinicalAttachmentProperties(
                DataSize.ofMegabytes(10),
                List.of("image/jpeg", "image/png", "application/pdf")
        );
        return new ClinicalResultAttachmentService(
                clinicalResultRepository,
                clinicalOrderItemRepository,
                clinicalServiceCatalogRepository,
                medicalAttachmentRepository,
                visitRepository,
                medicalRecordRepository,
                authorizationService,
                auditService,
                new ClinicalAttachmentValidator(attachmentProps),
                realStorageAdapter, // REAL ADAPTER - NOT MOCKED
                clock
        );
    }

    private Fixture createFixture() {
        UUID actorId = UUID.randomUUID();
        UUID visitId = UUID.randomUUID();
        UUID itemId = UUID.randomUUID();
        UUID serviceId = UUID.randomUUID();
        Visit visit = Visit.restore(visitId, "VIS-001", UUID.randomUUID(), UUID.randomUUID(), null, null,
                VisitType.WALK_IN, VisitStatus.IN_PROGRESS, NOW, NOW, null, "Consultation", null, actorId, NOW, null);
        MedicalRecord record = MedicalRecord.create(visitId, "Pain", null, null, null, null, null, null,
                "Stable", actorId, NOW);
        ClinicalResult result = ClinicalResult.create(itemId, visitId, ClinicalResultType.FILE, null, null, null,
                null, ClinicalResultAbnormalFlag.UNKNOWN, null, actorId, NOW);
        ClinicalOrderItem item = ClinicalOrderItem.restore(itemId, UUID.randomUUID(), serviceId, "IMAGING-01",
                "Siêu âm ổ bụng", null, ClinicalOrderItemStatus.PENDING, NOW, null);
        ClinicalServiceCatalog service = ClinicalServiceCatalog.restore(serviceId, UUID.randomUUID(), "IMAGING-01",
                "Siêu âm ổ bụng", ClinicalServiceType.IMAGING, com.benhsoan.domain.clinical.enums.ClinicalResultDataType.FILE,
                null, null, null, true, NOW, null);
        return new Fixture(actorId, visit, record, result, item, service);
    }

    private record Fixture(UUID actorId, Visit visit, MedicalRecord record, ClinicalResult result,
            ClinicalOrderItem item, ClinicalServiceCatalog service) {}

    private static CloudinaryProperties resolveCloudinaryProperties() {
        String cloudName = System.getenv("CLOUDINARY_CLOUD_NAME");
        String apiKey = System.getenv("CLOUDINARY_API_KEY");
        String apiSecret = System.getenv("CLOUDINARY_API_SECRET");
        String folderPrefix = System.getenv("CLOUDINARY_FOLDER_PREFIX");
        boolean enabled = Boolean.parseBoolean(System.getenv().getOrDefault("CLOUDINARY_ENABLED", "true"));

        if (cloudName == null || apiKey == null || apiSecret == null) {
            Path[] potentialPaths = new Path[] {
                    Path.of(".env"),
                    Path.of("backend/.env"),
                    Path.of("../backend/.env"),
                    Path.of("f:/Java/Benh-so-an/backend/.env")
            };
            for (Path path : potentialPaths) {
                if (Files.exists(path)) {
                    try {
                        List<String> lines = Files.readAllLines(path, StandardCharsets.UTF_8);
                        for (String line : lines) {
                            line = line.trim();
                            if (line.isEmpty() || line.startsWith("#") || !line.contains("=")) {
                                continue;
                            }
                            String[] parts = line.split("=", 2);
                            String k = parts[0].trim();
                            String v = parts[1].trim();
                            if ("CLOUDINARY_ENABLED".equals(k)) enabled = Boolean.parseBoolean(v);
                            if ("CLOUDINARY_CLOUD_NAME".equals(k) && cloudName == null) cloudName = v;
                            if ("CLOUDINARY_API_KEY".equals(k) && apiKey == null) apiKey = v;
                            if ("CLOUDINARY_API_SECRET".equals(k) && apiSecret == null) apiSecret = v;
                            if ("CLOUDINARY_FOLDER_PREFIX".equals(k) && folderPrefix == null) folderPrefix = v;
                        }
                        if (cloudName != null && apiKey != null && apiSecret != null) {
                            break;
                        }
                    } catch (IOException ignored) {}
                }
            }
        }

        if (folderPrefix == null || folderPrefix.isBlank()) {
            folderPrefix = "benh-soan/clinical-results";
        }

        return new CloudinaryProperties(
                enabled,
                cloudName,
                apiKey,
                apiSecret,
                folderPrefix,
                Duration.ofMinutes(5)
        );
    }
}
