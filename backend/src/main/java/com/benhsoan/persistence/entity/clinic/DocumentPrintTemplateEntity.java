package com.benhsoan.persistence.entity.clinic;

import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "document_print_templates")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DocumentPrintTemplateEntity {

    @Id
    @Column(name = "id", columnDefinition = "BINARY(16)", nullable = false)
    private UUID id;

    @Column(name = "document_type", nullable = false, length = 50, unique = true)
    private String documentType;

    @Column(name = "template_name", nullable = false, length = 150)
    private String templateName;

    @Column(name = "title", nullable = false, length = 255)
    private String title;

    @Column(name = "logo_url", length = 1000)
    private String logoUrl;

    @Column(name = "legal_info", length = 1000)
    private String legalInfo;

    @Column(name = "footer_text", length = 1000)
    private String footerText;

    @Column(name = "show_logo", nullable = false)
    private boolean showLogo;

    @Column(name = "field_visibility", columnDefinition = "TEXT")
    private String fieldVisibility;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}
