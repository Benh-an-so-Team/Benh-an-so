package com.benhsoan.infrastructure.pdf;

import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.awt.image.BufferedImage;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class LogoImageLoaderTest {

    @Test
    @DisplayName("SSRF protection: isInternalOrRestrictedHost blocks loopback, private LAN and metadata IPs")
    void isInternalOrRestrictedHost_blocksDangerousHosts() {
        assertTrue(LogoImageLoader.isInternalOrRestrictedHost("localhost"));
        assertTrue(LogoImageLoader.isInternalOrRestrictedHost("127.0.0.1"));
        assertTrue(LogoImageLoader.isInternalOrRestrictedHost("::1"));
        assertTrue(LogoImageLoader.isInternalOrRestrictedHost("169.254.169.254"));
        assertTrue(LogoImageLoader.isInternalOrRestrictedHost("10.0.0.1"));
        assertTrue(LogoImageLoader.isInternalOrRestrictedHost("192.168.1.1"));
        assertTrue(LogoImageLoader.isInternalOrRestrictedHost("172.16.0.1"));
    }

    @Test
    @DisplayName("load: returns null for null or blank source")
    void load_nullOrBlank_returnsNull() {
        assertNull(LogoImageLoader.load(null));
        assertNull(LogoImageLoader.load(""));
        assertNull(LogoImageLoader.load("   "));
    }

    @Test
    @DisplayName("load: blocks SSRF URLs by returning null")
    void load_ssrfUrls_returnsNull() {
        assertNull(LogoImageLoader.load("http://127.0.0.1:8080/logo.png"));
        assertNull(LogoImageLoader.load("http://localhost/secret.png"));
        assertNull(LogoImageLoader.load("http://169.254.169.254/latest/meta-data/"));
    }

    @Test
    @DisplayName("load: blocks local file scheme by returning null")
    void load_fileScheme_returnsNull() {
        assertNull(LogoImageLoader.load("file:///etc/passwd"));
        assertNull(LogoImageLoader.load("C:\\Windows\\win.ini"));
    }

    @Test
    @DisplayName("load: successfully decodes valid base64 data URI image")
    void load_validBase64_returnsBufferedImage() {
        // 1x1 transparent PNG
        String base64Png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
        BufferedImage img = LogoImageLoader.load(base64Png);
        assertNotNull(img);
        assertTrue(img.getWidth() > 0);
        assertTrue(img.getHeight() > 0);
    }

    @Test
    @DisplayName("load: malformed base64 fails safely and returns null")
    void load_malformedBase64_returnsNull() {
        assertNull(LogoImageLoader.load("data:image/png;base64,not-valid-base64!!!"));
    }
}
