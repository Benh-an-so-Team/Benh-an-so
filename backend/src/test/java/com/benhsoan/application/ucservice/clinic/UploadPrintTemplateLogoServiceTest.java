package com.benhsoan.application.ucservice.clinic;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.Map;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import com.benhsoan.domain.shared.exception.ValidationException;
import com.benhsoan.port.dto.command.clinic.UploadPrintTemplateLogoCommand;
import com.cloudinary.Cloudinary;
import com.cloudinary.Uploader;

class UploadPrintTemplateLogoServiceTest {

    @Test
    @DisplayName("Ném ValidationException khi command hoặc nội dung file rỗng")
    void uploadLogo_ThrowsValidationException_WhenContentNullOrEmpty() {
        UploadPrintTemplateLogoService service = new UploadPrintTemplateLogoService(null);

        assertThrows(ValidationException.class, () -> service.uploadLogo(null));

        UploadPrintTemplateLogoCommand emptyCmd = new UploadPrintTemplateLogoCommand(
                new byte[0], "logo.png", "image/png", 0
        );
        assertThrows(ValidationException.class, () -> service.uploadLogo(emptyCmd));
    }

    @Test
    @DisplayName("Ném ValidationException khi dung lượng file vượt quá 2MB")
    void uploadLogo_ThrowsValidationException_WhenOversized() {
        UploadPrintTemplateLogoService service = new UploadPrintTemplateLogoService(null);

        UploadPrintTemplateLogoCommand oversizedCmd = new UploadPrintTemplateLogoCommand(
                new byte[10], "logo.png", "image/png", 3 * 1024 * 1024 // 3MB
        );
        ValidationException ex = assertThrows(ValidationException.class, () -> service.uploadLogo(oversizedCmd));
        assertTrue(ex.getMessage().contains("vượt quá giới hạn tối đa cho phép (2MB)"));
    }

    @Test
    @DisplayName("Ném ValidationException khi định dạng file không được hỗ trợ")
    void uploadLogo_ThrowsValidationException_WhenInvalidFormat() {
        UploadPrintTemplateLogoService service = new UploadPrintTemplateLogoService(null);

        UploadPrintTemplateLogoCommand invalidCmd = new UploadPrintTemplateLogoCommand(
                "dummy".getBytes(), "document.pdf", "application/pdf", 500
        );
        ValidationException ex = assertThrows(ValidationException.class, () -> service.uploadLogo(invalidCmd));
        assertTrue(ex.getMessage().contains("Định dạng ảnh không hợp lệ"));
    }

    @Test
    @DisplayName("Ném ValidationException khi Cloudinary chưa được cấu hình / kích hoạt")
    void uploadLogo_ThrowsValidationException_WhenCloudinaryNull() {
        UploadPrintTemplateLogoService service = new UploadPrintTemplateLogoService(null);

        UploadPrintTemplateLogoCommand validCmd = new UploadPrintTemplateLogoCommand(
                "image-data".getBytes(), "logo.png", "image/png", 100
        );
        ValidationException ex = assertThrows(ValidationException.class, () -> service.uploadLogo(validCmd));
        assertTrue(ex.getMessage().contains("Cloudinary chưa được kích hoạt"));
    }

    @Test
    @DisplayName("Upload thành công lên Cloudinary và trả về secure_url")
    void uploadLogo_Success_ReturnsSecureUrl() throws Exception {
        Cloudinary cloudinary = mock(Cloudinary.class);
        Uploader uploader = mock(Uploader.class);
        when(cloudinary.uploader()).thenReturn(uploader);

        when(uploader.upload(any(byte[].class), anyMap())).thenReturn(Map.of(
                "public_id", "benh-soan/clinic-assets/logos/logo123",
                "secure_url", "https://res.cloudinary.com/test-cloud/image/upload/v12345/logo.png"
        ));

        UploadPrintTemplateLogoService service = new UploadPrintTemplateLogoService(cloudinary);

        UploadPrintTemplateLogoCommand validCmd = new UploadPrintTemplateLogoCommand(
                "valid-png-data".getBytes(), "clinic_logo.png", "image/png", 1024
        );
        String url = service.uploadLogo(validCmd);

        assertEquals("https://res.cloudinary.com/test-cloud/image/upload/v12345/logo.png", url);
    }
}
