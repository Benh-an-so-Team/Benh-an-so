package com.benhsoan.application.ucservice.personaldata;

import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Component;

import com.benhsoan.port.outbound.security.CurrentUserPort;

import lombok.RequiredArgsConstructor;

/**
 * Kiểm soát phân quyền tại tầng Application Service cho yêu cầu dữ liệu cá nhân
 * (NCL-15-CN-006). Chỉ ADMIN có quyền tiếp nhận và xử lý yêu cầu.
 */
@Component
@RequiredArgsConstructor
public class PersonalDataRequestAuthorizer {

    public static final String PERMISSION_READ = "PERSONAL_DATA_REQUEST_READ";
    public static final String PERMISSION_UPDATE = "PERSONAL_DATA_REQUEST_UPDATE";
    public static final String ADMIN_ROLE = "ADMIN";

    private final CurrentUserPort currentUserPort;

    public void requireReadPermission() {
        if (!currentUserPort.hasPermission(PERMISSION_READ) && !currentUserPort.hasRole(ADMIN_ROLE)) {
            throw new AccessDeniedException("Bạn không có quyền xem yêu cầu dữ liệu cá nhân.");
        }
    }

    public void requireUpdatePermission() {
        if (!currentUserPort.hasPermission(PERMISSION_UPDATE) && !currentUserPort.hasRole(ADMIN_ROLE)) {
            throw new AccessDeniedException("Bạn không có quyền tiếp nhận hoặc xử lý yêu cầu dữ liệu cá nhân.");
        }
    }
}
