package com.benhsoan.infrastructure.pdf;

import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.fasterxml.jackson.databind.ObjectMapper;

public final class PrintFieldVisibilityHelper {

    private static final Logger log = LoggerFactory.getLogger(PrintFieldVisibilityHelper.class);
    private static final ObjectMapper MAPPER = new ObjectMapper();

    private PrintFieldVisibilityHelper() {
    }

    public static boolean isVisible(String json, String fieldKey, boolean defaultValue) {
        if (json == null || json.isBlank() || fieldKey == null) {
            return defaultValue;
        }
        try {
            Map<?, ?> map = MAPPER.readValue(json, Map.class);
            Object val = map.get(fieldKey);
            if (val instanceof Boolean b) {
                return b;
            }
            if (val != null) {
                return Boolean.parseBoolean(val.toString());
            }
        } catch (Exception ex) {
            log.warn("Fail-safe: Unable to parse fieldVisibility JSON, defaulting to {}. Error: {}", defaultValue, ex.getMessage());
        }
        return defaultValue;
    }
}
