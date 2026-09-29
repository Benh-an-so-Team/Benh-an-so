package com.benhsoan.application.ucservice.clinic;

import java.util.List;
import java.util.Locale;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.benhsoan.domain.shared.exception.ValidationException;
import com.benhsoan.port.dto.command.clinic.UploadPrintTemplateLogoCommand;
import com.benhsoan.port.inbound.clinic.UploadPrintTemplateLogoUseCase;
import com.cloudinary.Cloudinary;
import com.cloudinary.utils.ObjectUtils;

@Service
public class UploadPrintTemplateLogoService implements UploadPrintTemplateLogoUseCase {

    private static final Logger log = LoggerFactory.getLogger(UploadPrintTemplateLogoService.class);
    private static final long MAX_LOGO_SIZE_BYTES = 2 * 1024 * 1024; // 2MB
    private static final List<String> ALLOWED_CONTENT_TYPES = List.of(
            "image/png", "image/jpeg", "image/jpg", "image/webp", "image/svg+xml"
    );
    private static final String CLOUDINARY_LOGO_FOLDER = "benh-soan/clinic-assets/logos";

    private final Cloudinary cloudinary;

    public UploadPrintTemplateLogoService(@Autowired(required = false) Cloudinary cloudinary) {
        this.cloudinary = cloudinary;
    }

    @Override
    public String uploadLogo(UploadPrintTemplateLogoCommand command) {
        if (command == null || command.content() == null || command.content().length == 0) {
            throw new ValidationException("Vui lòng chọn tệp ảnh logo.");
        }
        if (command.size() > MAX_LOGO_SIZE_BYTES || command.content().length > MAX_LOGO_SIZE_BYTES) {
            throw new ValidationException("Dung lượng ảnh vượt quá giới hạn tối đa cho phép (2MB).");
        }

        validateContentTypeAndExtension(command);

        if (cloudinary == null) {
            throw new ValidationException("Dịch vụ lưu trữ đám mây Cloudinary chưa được kích hoạt. "
                    + "Vui lòng cấu hình CLOUDINARY_ENABLED=true và các khóa API trong cấu hình hệ thống.");
        }

        try {
            Map<?, ?> response = cloudinary.uploader().upload(command.content(), ObjectUtils.asMap(
                    "folder", CLOUDINARY_LOGO_FOLDER,
                    "resource_type", "image",
                    "type", "upload",
                    "overwrite", true,
                    "unique_filename", true
            ));
            String secureUrl = (String) response.get("secure_url");
            if (secureUrl == null || secureUrl.isBlank()) {
                throw new IllegalStateException("Cloudinary không trả về đường dẫn secure_url.");
            }
            return secureUrl;
        } catch (Exception ex) {
            log.error("Lỗi khi tải logo lên Cloudinary: {}", ex.getMessage(), ex);
            throw new ValidationException("Không thể tải ảnh logo lên Cloudinary: " + ex.getMessage());
        }
    }

    private void validateContentTypeAndExtension(UploadPrintTemplateLogoCommand command) {
        String ct = command.contentType() != null ? command.contentType().toLowerCase(Locale.ROOT) : "";
        String filename = command.originalFilename() != null ? command.originalFilename().toLowerCase(Locale.ROOT) : "";

        boolean isValidType = ALLOWED_CONTENT_TYPES.contains(ct)
                || filename.endsWith(".png")
                || filename.endsWith(".jpg")
                || filename.endsWith(".jpeg")
                || filename.endsWith(".webp")
                || filename.endsWith(".svg");

        if (!isValidType) {
            throw new ValidationException("Định dạng ảnh không hợp lệ. Chỉ chấp nhận định dạng PNG, JPG, JPEG, WEBP hoặc SVG.");
        }
    }
}
