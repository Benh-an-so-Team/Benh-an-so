package com.benhsoan.domain.personaldata.enums;

/**
 * NCL-15-CN-006 TC-02: distinguishes the two administrator-visible deadline
 * conditions so an operator can tell whether a request is approaching its
 * processing deadline or has already missed it.
 */
public enum PersonalDataRequestDeadlineAlertType {
    UPCOMING,
    OVERDUE
}
