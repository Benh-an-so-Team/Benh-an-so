package com.benhsoan.adapter.inbound.rest.controller;

import java.io.IOException;
import java.util.List;
import java.util.Map;

import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import com.benhsoan.adapter.inbound.rest.mapper.DocumentPrintTemplateRestMapper;
import com.benhsoan.adapter.inbound.rest.request.clinic.PreviewDocumentPrintTemplateRequest;
import com.benhsoan.adapter.inbound.rest.request.clinic.UpdateDocumentPrintTemplateRequest;
import com.benhsoan.adapter.inbound.rest.response.clinic.DocumentPrintTemplateResponse;
import com.benhsoan.domain.clinic.enums.PrintDocumentType;
import com.benhsoan.domain.shared.exception.ValidationException;
import com.benhsoan.infrastructure.security.annotation.RequirePermission;
import com.benhsoan.port.dto.command.clinic.UploadPrintTemplateLogoCommand;
import com.benhsoan.port.inbound.clinic.GetDocumentPrintTemplatesUseCase;
import com.benhsoan.port.inbound.clinic.PreviewDocumentPrintTemplateUseCase;
import com.benhsoan.port.inbound.clinic.UpdateDocumentPrintTemplateUseCase;
import com.benhsoan.port.inbound.clinic.UploadPrintTemplateLogoUseCase;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@Validated
@RestController
@RequiredArgsConstructor
@RequestMapping("/system/print-templates")
public class DocumentPrintTemplateController {

    private final GetDocumentPrintTemplatesUseCase getUseCase;
    private final UpdateDocumentPrintTemplateUseCase updateUseCase;
    private final PreviewDocumentPrintTemplateUseCase previewUseCase;
    private final UploadPrintTemplateLogoUseCase uploadLogoUseCase;
    private final DocumentPrintTemplateRestMapper mapper;

    @GetMapping
    @RequirePermission("PRINT_TEMPLATE_READ")
    public List<DocumentPrintTemplateResponse> getAll() {
        return getUseCase.getAll().stream()
                .map(mapper::toResponse)
                .toList();
    }

    @GetMapping("/{documentType}")
    @RequirePermission("PRINT_TEMPLATE_READ")
    public DocumentPrintTemplateResponse getByDocumentType(@PathVariable PrintDocumentType documentType) {
        return mapper.toResponse(getUseCase.getByDocumentType(documentType));
    }

    @PutMapping("/{documentType}")
    @RequirePermission("PRINT_TEMPLATE_UPDATE")
    public DocumentPrintTemplateResponse update(
            @PathVariable PrintDocumentType documentType,
            @Valid @RequestBody UpdateDocumentPrintTemplateRequest request
    ) {
        return mapper.toResponse(updateUseCase.update(mapper.toCommand(documentType, request)));
    }

    @PostMapping("/preview")
    @RequirePermission({"PRINT_TEMPLATE_READ", "PRINT_TEMPLATE_UPDATE"})
    public ResponseEntity<ByteArrayResource> preview(@Valid @RequestBody PreviewDocumentPrintTemplateRequest request) {
        byte[] pdf = previewUseCase.preview(mapper.toCommand(request));
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"preview-" + request.documentType().name().toLowerCase() + ".pdf\"")
                .contentType(MediaType.APPLICATION_PDF)
                .contentLength(pdf.length)
                .body(new ByteArrayResource(pdf));
    }

    @PostMapping(value = "/logo", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @RequirePermission("PRINT_TEMPLATE_UPDATE")
    public ResponseEntity<Map<String, String>> uploadLogo(@RequestParam("file") MultipartFile file) {
        try {
            UploadPrintTemplateLogoCommand command = new UploadPrintTemplateLogoCommand(
                    file != null ? file.getBytes() : null,
                    file != null ? file.getOriginalFilename() : null,
                    file != null ? file.getContentType() : null,
                    file != null ? file.getSize() : 0
            );
            String logoUrl = uploadLogoUseCase.uploadLogo(command);
            return ResponseEntity.ok(Map.of("logoUrl", logoUrl));
        } catch (IOException ex) {
            throw new ValidationException("Không thể đọc nội dung tệp ảnh: " + ex.getMessage());
        }
    }
}
