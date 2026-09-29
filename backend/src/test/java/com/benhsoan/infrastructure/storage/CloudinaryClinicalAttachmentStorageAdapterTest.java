package com.benhsoan.infrastructure.storage;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.io.IOException;
import java.time.Duration;
import java.util.Map;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import com.benhsoan.port.outbound.storage.ClinicalAttachmentResourceType;
import com.benhsoan.port.outbound.storage.ClinicalAttachmentUpload;
import com.benhsoan.port.outbound.storage.SignedClinicalAttachmentUrl;
import com.benhsoan.port.outbound.storage.StoredClinicalAttachment;
import com.cloudinary.Cloudinary;
import com.cloudinary.Uploader;

class CloudinaryClinicalAttachmentStorageAdapterTest {

    private Cloudinary cloudinary;
    private Uploader uploader;
    private CloudinaryProperties properties;
    private CloudinaryClinicalAttachmentStorageAdapter adapter;

    @BeforeEach
    void setUp() {
        cloudinary = mock(Cloudinary.class);
        uploader = mock(Uploader.class);
        when(cloudinary.uploader()).thenReturn(uploader);

        properties = new CloudinaryProperties(
                true,
                "test-cloud",
                "test-key",
                "test-secret",
                "benh-soan/clinical-results",
                Duration.ofMinutes(5)
        );
        adapter = new CloudinaryClinicalAttachmentStorageAdapter(cloudinary, properties);
    }

    @Test
    @DisplayName("Upload tệp ảnh JPEG phân loại đúng resource_type=image và delivery_type=authenticated")
    void upload_JpegImage_CallsCloudinaryWithImageResourceType() throws Exception {
        UUID resultId = UUID.randomUUID();
        byte[] content = new byte[] {1, 2, 3};
        ClinicalAttachmentUpload upload = new ClinicalAttachmentUpload(
                resultId, "scan.jpg", "image/jpeg", content
        );

        when(uploader.upload(eq(content), anyMap())).thenReturn(Map.of(
                "public_id", "benh-soan/clinical-results/" + resultId + "/file-uuid",
                "secure_url", "https://res.cloudinary.com/test-cloud/image/upload/v1/scan.jpg",
                "bytes", 1024L
        ));

        StoredClinicalAttachment stored = adapter.upload(upload);

        assertNotNull(stored);
        assertEquals(ClinicalAttachmentResourceType.IMAGE, stored.resourceType());
        assertEquals(1024L, stored.fileSize());

        @SuppressWarnings("unchecked")
        ArgumentCaptor<Map<String, Object>> optionsCaptor = ArgumentCaptor.forClass(Map.class);
        verify(uploader).upload(eq(content), optionsCaptor.capture());
        Map<String, Object> options = optionsCaptor.getValue();
        assertEquals("image", options.get("resource_type"));
        assertEquals("authenticated", options.get("type"));
        assertEquals(false, options.get("overwrite"));
        assertTrue(((String) options.get("public_id")).startsWith("benh-soan/clinical-results/" + resultId + "/"));
    }

    @Test
    @DisplayName("Upload tệp PDF phân loại đúng resource_type=raw")
    void upload_PdfDocument_CallsCloudinaryWithRawResourceType() throws Exception {
        UUID resultId = UUID.randomUUID();
        byte[] content = new byte[] {4, 5, 6};
        ClinicalAttachmentUpload upload = new ClinicalAttachmentUpload(
                resultId, "ket_qua.pdf", "application/pdf", content
        );

        when(uploader.upload(eq(content), anyMap())).thenReturn(Map.of(
                "public_id", "benh-soan/clinical-results/" + resultId + "/pdf-uuid",
                "secure_url", "https://res.cloudinary.com/test-cloud/raw/upload/v1/ket_qua.pdf",
                "bytes", 2048L
        ));

        StoredClinicalAttachment stored = adapter.upload(upload);

        assertEquals(ClinicalAttachmentResourceType.RAW, stored.resourceType());

        @SuppressWarnings("unchecked")
        ArgumentCaptor<Map<String, Object>> optionsCaptor = ArgumentCaptor.forClass(Map.class);
        verify(uploader).upload(eq(content), optionsCaptor.capture());
        assertEquals("raw", optionsCaptor.getValue().get("resource_type"));
    }

    @Test
    @DisplayName("Upload thất bại khi định dạng MIME không được hỗ trợ")
    void upload_UnsupportedContentType_ThrowsIllegalArgumentException() {
        ClinicalAttachmentUpload upload = new ClinicalAttachmentUpload(
                UUID.randomUUID(), "notes.txt", "text/plain", new byte[] {1}
        );

        assertThrows(IllegalArgumentException.class, () -> adapter.upload(upload));
    }

    @Test
    @DisplayName("Upload ném CloudinaryAttachmentStorageException khi Cloudinary SDK gặp lỗi")
    void upload_CloudinaryThrowsException_WrapsInCloudinaryAttachmentStorageException() throws Exception {
        when(uploader.upload(any(byte[].class), anyMap())).thenThrow(new IOException("Cloudinary timeout"));

        ClinicalAttachmentUpload upload = new ClinicalAttachmentUpload(
                UUID.randomUUID(), "photo.png", "image/png", new byte[] {1, 2}
        );

        CloudinaryAttachmentStorageException ex = assertThrows(
                CloudinaryAttachmentStorageException.class,
                () -> adapter.upload(upload)
        );
        assertTrue(ex.getMessage().contains("Unable to upload clinical attachment"));
    }

    @Test
    @DisplayName("Upload ném IllegalStateException khi phản hồi Cloudinary thiếu public_id hoặc dung lượng file")
    void upload_MissingResponseFields_ThrowsIllegalStateException() throws Exception {
        when(uploader.upload(any(byte[].class), anyMap())).thenReturn(Map.of(
                "secure_url", "https://res.cloudinary.com/test-cloud/image/upload/v1/scan.jpg"
                // missing public_id and bytes
        ));

        ClinicalAttachmentUpload upload = new ClinicalAttachmentUpload(
                UUID.randomUUID(), "photo.png", "image/png", new byte[] {1, 2}
        );

        CloudinaryAttachmentStorageException ex = assertThrows(
                CloudinaryAttachmentStorageException.class,
                () -> adapter.upload(upload)
        );
        assertTrue(ex.getCause() instanceof IllegalStateException);
    }

    @Test
    @DisplayName("Delete gọi uploader.destroy với publicId, resourceType và invalidate=true")
    void delete_CallsCloudinaryDestroyWithCorrectParams() throws Exception {
        String publicId = "benh-soan/clinical-results/res-123/file-456";

        adapter.delete(publicId, ClinicalAttachmentResourceType.IMAGE);

        @SuppressWarnings("unchecked")
        ArgumentCaptor<Map<String, Object>> optionsCaptor = ArgumentCaptor.forClass(Map.class);
        verify(uploader).destroy(eq(publicId), optionsCaptor.capture());
        Map<String, Object> options = optionsCaptor.getValue();
        assertEquals("image", options.get("resource_type"));
        assertEquals("authenticated", options.get("type"));
        assertEquals(true, options.get("invalidate"));
    }

    @Test
    @DisplayName("Delete ném CloudinaryAttachmentStorageException khi Cloudinary gặp lỗi")
    void delete_CloudinaryThrowsException_WrapsInCloudinaryAttachmentStorageException() throws Exception {
        when(uploader.destroy(any(), anyMap())).thenThrow(new RuntimeException("Cloudinary network error"));

        assertThrows(
                CloudinaryAttachmentStorageException.class,
                () -> adapter.delete("test-id", ClinicalAttachmentResourceType.RAW)
        );
    }

    @Test
    @DisplayName("Tạo Signed Download URL gọi privateDownload với thời gian hết hạn (expires_at)")
    void generateSignedDownloadUrl_CallsPrivateDownloadWithExpiration() throws Exception {
        String publicId = "benh-soan/clinical-results/res-123/doc-789";
        String expectedSignedUrl = "https://res.cloudinary.com/test-cloud/image/authenticated/s--sign--/v1/doc";
        when(cloudinary.privateDownload(eq(publicId), isNull(), anyMap())).thenReturn(expectedSignedUrl);

        SignedClinicalAttachmentUrl result = adapter.generateSignedDownloadUrl(
                publicId, ClinicalAttachmentResourceType.IMAGE
        );

        assertEquals(expectedSignedUrl, result.url());
        assertNotNull(result.expiresAt());

        @SuppressWarnings("unchecked")
        ArgumentCaptor<Map<String, Object>> optionsCaptor = ArgumentCaptor.forClass(Map.class);
        verify(cloudinary).privateDownload(eq(publicId), isNull(), optionsCaptor.capture());
        Map<String, Object> options = optionsCaptor.getValue();
        assertEquals("image", options.get("resource_type"));
        assertEquals("authenticated", options.get("type"));
        assertNotNull(options.get("expires_at"));
    }

    @Test
    @DisplayName("Tiền tố thư mục folderPrefix được chuẩn hóa loại bỏ dấu gạch chéo đầu cuối")
    void upload_NormalizesFolderPrefix() throws Exception {
        CloudinaryProperties customProps = new CloudinaryProperties(
                true, "cloud", "key", "secret", "///custom/prefix///", Duration.ofMinutes(5)
        );
        CloudinaryClinicalAttachmentStorageAdapter customAdapter =
                new CloudinaryClinicalAttachmentStorageAdapter(cloudinary, customProps);

        UUID resultId = UUID.randomUUID();
        when(uploader.upload(any(byte[].class), anyMap())).thenReturn(Map.of(
                "public_id", "custom/prefix/" + resultId + "/test",
                "secure_url", "https://res.cloudinary.com/...",
                "bytes", 100L
        ));

        customAdapter.upload(new ClinicalAttachmentUpload(
                resultId, "pic.png", "image/png", new byte[] {1}
        ));

        @SuppressWarnings("unchecked")
        ArgumentCaptor<Map<String, Object>> optionsCaptor = ArgumentCaptor.forClass(Map.class);
        verify(uploader).upload(any(byte[].class), optionsCaptor.capture());
        String generatedPublicId = (String) optionsCaptor.getValue().get("public_id");
        assertTrue(generatedPublicId.startsWith("custom/prefix/" + resultId + "/"));
    }
}
