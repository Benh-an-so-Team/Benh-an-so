package com.benhsoan.domain.personaldata.enums;

public enum PersonalDataRequestStatus {
    RECEIVED("Đã tiếp nhận"),
    COMPLETED("Đã hoàn tất");

    private final String description;

    PersonalDataRequestStatus(String description) {
        this.description = description;
    }

    public String getDescription() {
        return description;
    }
}
