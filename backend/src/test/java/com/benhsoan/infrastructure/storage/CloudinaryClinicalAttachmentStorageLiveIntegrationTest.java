package com.benhsoan.infrastructure.storage;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

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
import java.util.Map;
import java.util.UUID;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import com.benhsoan.port.outbound.storage.ClinicalAttachmentResourceType;
import com.benhsoan.port.outbound.storage.ClinicalAttachmentUpload;
import com.benhsoan.port.outbound.storage.SignedClinicalAttachmentUrl;
import com.benhsoan.port.outbound.storage.StoredClinicalAttachment;
import com.cloudinary.Cloudinary;
import com.cloudinary.utils.ObjectUtils;

/**
 * Live Integration Test for NCL-04-CN-003: Clinical Result Attachment Storage on Cloudinary.
 * Directly tests upload, signed download URL generation, HTTP download verification,
 * and deletion on real Cloudinary storage without mocking.
 */
@Tag("integration")
class CloudinaryClinicalAttachmentStorageLiveIntegrationTest {

    private static CloudinaryProperties properties;
    private static Cloudinary cloudinary;
    private static CloudinaryClinicalAttachmentStorageAdapter adapter;

    // Track uploaded publicIds to ensure cleanup even if assertions fail
    private final List<UploadedItem> uploadedItems = new ArrayList<>();

    private record UploadedItem(String publicId, ClinicalAttachmentResourceType resourceType) {}

    @BeforeAll
    static void setUpAll() {
        properties = resolveProperties();
        assumeTrue(properties != null && properties.enabled()
                        && properties.cloudName() != null && !properties.cloudName().isBlank()
                        && properties.apiKey() != null && !properties.apiKey().isBlank()
                        && properties.apiSecret() != null && !properties.apiSecret().isBlank(),
                "Cloudinary credentials not available in environment or .env file. Skipping live tests.");

        cloudinary = new Cloudinary(ObjectUtils.asMap(
                "cloud_name", properties.cloudName(),
                "api_key", properties.apiKey(),
                "api_secret", properties.apiSecret(),
                "secure", true
        ));
        adapter = new CloudinaryClinicalAttachmentStorageAdapter(cloudinary, properties);
    }

    @AfterEach
    void cleanUp() {
        for (UploadedItem item : uploadedItems) {
            try {
                adapter.delete(item.publicId(), item.resourceType());
            } catch (Exception ex) {
                System.err.println("Failed to clean up Cloudinary test asset " + item.publicId() + ": " + ex.getMessage());
            }
        }
        uploadedItems.clear();
    }

    @Test
    @DisplayName("NCL-04-CN-003-TC-01: Tải tệp ảnh PNG thật lên Cloudinary và sinh signed URL tải về")
    void uploadPngImage_RealCloudinary_Success() throws Exception {
        UUID clinicalResultId = UUID.randomUUID();
        // 1x1 transparent PNG file bytes
        byte[] pngContent = new byte[] {
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

        ClinicalAttachmentUpload upload = new ClinicalAttachmentUpload(
                clinicalResultId,
                "xray_lung_sample.png",
                "image/png",
                pngContent
        );

        // 1. Upload to Cloudinary
        StoredClinicalAttachment stored = adapter.upload(upload);
        assertNotNull(stored);
        assertNotNull(stored.publicId());
        uploadedItems.add(new UploadedItem(stored.publicId(), stored.resourceType()));

        assertTrue(stored.publicId().startsWith("benh-soan/clinical-results/" + clinicalResultId + "/"));
        assertEquals(ClinicalAttachmentResourceType.IMAGE, stored.resourceType());
        assertTrue(stored.secureUrl().startsWith("https://res.cloudinary.com/"));
        assertEquals(pngContent.length, stored.fileSize());

        // 2. Generate signed download URL
        SignedClinicalAttachmentUrl signedUrl = adapter.generateSignedDownloadUrl(
                stored.publicId(), stored.resourceType()
        );
        assertNotNull(signedUrl);
        assertNotNull(signedUrl.url());
        assertTrue(signedUrl.expiresAt().isAfter(Instant.now()));

        // 3. Verify download URL via HTTP GET
        HttpClient client = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();
        HttpRequest request = HttpRequest.newBuilder().uri(URI.create(signedUrl.url())).GET().build();
        HttpResponse<byte[]> response = client.send(request, HttpResponse.BodyHandlers.ofByteArray());
        assertEquals(200, response.statusCode(), "Cloudinary signed download URL should return HTTP 200");
        assertEquals(pngContent.length, response.body().length);
    }

    @Test
    @DisplayName("NCL-04-CN-003-TC-01: Tải tệp PDF kết quả cận lâm sàng thật lên Cloudinary")
    void uploadPdfDocument_RealCloudinary_Success() throws Exception {
        UUID clinicalResultId = UUID.randomUUID();
        // Valid minimal PDF bytes
        String pdfString = "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 3 3]>>endobj\nxref\n0 4\n0000000000 65535 f\n0000000009 00000 n\n0000000052 00000 n\n0000000101 00000 n\ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n160\n%%EOF";
        byte[] pdfContent = pdfString.getBytes(StandardCharsets.US_ASCII);

        ClinicalAttachmentUpload upload = new ClinicalAttachmentUpload(
                clinicalResultId,
                "blood_test_result.pdf",
                "application/pdf",
                pdfContent
        );

        // 1. Upload to Cloudinary
        StoredClinicalAttachment stored = adapter.upload(upload);
        assertNotNull(stored);
        uploadedItems.add(new UploadedItem(stored.publicId(), stored.resourceType()));

        assertTrue(stored.publicId().startsWith("benh-soan/clinical-results/" + clinicalResultId + "/"));
        assertEquals(ClinicalAttachmentResourceType.RAW, stored.resourceType());
        assertTrue(stored.secureUrl().startsWith("https://res.cloudinary.com/"));
        assertEquals(pdfContent.length, stored.fileSize());

        // 2. Generate signed download URL
        SignedClinicalAttachmentUrl signedUrl = adapter.generateSignedDownloadUrl(
                stored.publicId(), stored.resourceType()
        );
        assertNotNull(signedUrl.url());

        // 3. Verify HTTP GET returns 200
        HttpClient client = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();
        HttpRequest request = HttpRequest.newBuilder().uri(URI.create(signedUrl.url())).GET().build();
        HttpResponse<byte[]> response = client.send(request, HttpResponse.BodyHandlers.ofByteArray());
        assertEquals(200, response.statusCode());
    }

    @Test
    @DisplayName("NCL-04-CN-003: Xóa tệp khỏi Cloudinary dọn dẹp tài nguyên")
    void deleteAttachment_RealCloudinary_RemovesAsset() throws Exception {
        UUID clinicalResultId = UUID.randomUUID();
        byte[] content = new byte[] {
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

        StoredClinicalAttachment stored = adapter.upload(new ClinicalAttachmentUpload(
                clinicalResultId, "temp.png", "image/png", content
        ));
        assertNotNull(stored);

        // Delete from Cloudinary
        adapter.delete(stored.publicId(), stored.resourceType());

        // Subsequent download check or destroy confirmation
        Map<?, ?> destroyResult = cloudinary.uploader().destroy(stored.publicId(), Map.of(
                "resource_type", "image",
                "type", "authenticated"
        ));
        // Cloudinary returns "not found" if already deleted
        assertEquals("not found", destroyResult.get("result"));
    }

    private static CloudinaryProperties resolveProperties() {
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
