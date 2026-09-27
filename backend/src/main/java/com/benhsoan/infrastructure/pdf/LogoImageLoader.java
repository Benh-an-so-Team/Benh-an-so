package com.benhsoan.infrastructure.pdf;

import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.net.InetAddress;
import java.net.URI;
import java.net.URL;
import java.net.URLConnection;
import java.util.Base64;

import javax.imageio.ImageIO;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public final class LogoImageLoader {

    private static final Logger log = LoggerFactory.getLogger(LogoImageLoader.class);

    private LogoImageLoader() {
    }

    public static BufferedImage load(String logoSource) {
        if (logoSource == null || logoSource.isBlank()) {
            return null;
        }

        String trimmed = logoSource.trim();
        try {
            if (trimmed.startsWith("data:image")) {
                int commaIndex = trimmed.indexOf(',');
                if (commaIndex != -1) {
                    byte[] bytes = Base64.getDecoder().decode(trimmed.substring(commaIndex + 1));
                    return ImageIO.read(new ByteArrayInputStream(bytes));
                }
            } else if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
                URI uri = new URI(trimmed);
                String host = uri.getHost();
                if (host == null || host.isBlank() || isInternalOrRestrictedHost(host)) {
                    log.warn("Blocked potentially unsafe logo URL (SSRF protection): {}", host);
                    return null;
                }

                URL url = uri.toURL();
                URLConnection conn = url.openConnection();
                conn.setConnectTimeout(3000);
                conn.setReadTimeout(3000);
                try (InputStream in = conn.getInputStream()) {
                    return ImageIO.read(in);
                }
            }
        } catch (Exception ex) {
            log.warn("Fail-safe: Unable to load logo image from source, proceeding without logo. Error: {}",
                    ex.getMessage());
        }

        return null;
    }

    static boolean isInternalOrRestrictedHost(String host) {
        if ("localhost".equalsIgnoreCase(host) || "127.0.0.1".equals(host) || "::1".equals(host)) {
            return true;
        }
        try {
            InetAddress[] addresses = InetAddress.getAllByName(host);
            for (InetAddress addr : addresses) {
                if (addr.isLoopbackAddress()
                        || addr.isSiteLocalAddress()
                        || addr.isLinkLocalAddress()
                        || addr.isMulticastAddress()
                        || addr.isAnyLocalAddress()) {
                    return true;
                }
                byte[] raw = addr.getAddress();
                if (raw.length == 4 && (raw[0] & 0xFF) == 169 && (raw[1] & 0xFF) == 254) {
                    return true;
                }
            }
        } catch (Exception ex) {
            log.warn("Unable to resolve host for SSRF check, blocking host: {}", host);
            return true;
        }
        return false;
    }
}
