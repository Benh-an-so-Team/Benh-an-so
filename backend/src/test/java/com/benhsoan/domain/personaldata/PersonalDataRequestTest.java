package com.benhsoan.domain.personaldata;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Instant;
import java.util.UUID;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import com.benhsoan.domain.personaldata.enums.PersonalDataRequestStatus;
import com.benhsoan.domain.personaldata.exception.PersonalDataRequestAlreadyCompletedException;
import com.benhsoan.domain.shared.exception.ValidationException;

class PersonalDataRequestTest {

    private static final Instant NOW = Instant.parse("2026-09-26T08:00:00Z");

    @Test
    @DisplayName("TC-01: tạo yêu cầu lưu đúng loại, ngày tiếp nhận, hạn xử lý và trạng thái ban đầu RECEIVED")
    void createStoresTypeReceivedAtDueAtAndInitialStatus() {
        UUID patientId = UUID.randomUUID();
        Instant dueAt = NOW.plusSeconds(86400);

        PersonalDataRequest request = PersonalDataRequest.create(
                patientId, PersonalDataRequest.TYPE_MEDICAL_RECORD_COPY, "Xin bản sao hồ sơ", NOW, dueAt);

        assertEquals(patientId, request.getPatientId());
        assertEquals(PersonalDataRequest.TYPE_MEDICAL_RECORD_COPY, request.getRequestType());
        assertEquals(PersonalDataRequestStatus.RECEIVED, request.getStatus());
        assertEquals(NOW, request.getReceivedAt());
        assertEquals(dueAt, request.getDueAt());
        assertNull(request.getResult());
        assertNull(request.getCompletedAt());
        assertNull(request.getProcessedBy());
    }

    @Test
    @DisplayName("requestType trống bị từ chối")
    void createRejectsBlankRequestType() {
        assertThrows(ValidationException.class, () -> PersonalDataRequest.create(
                UUID.randomUUID(), "   ", null, NOW, NOW.plusSeconds(60)));
    }

    @Test
    @DisplayName("dueAt bắt buộc phải có")
    void createRejectsNullDueAt() {
        assertThrows(ValidationException.class, () -> PersonalDataRequest.create(
                UUID.randomUUID(), PersonalDataRequest.TYPE_MEDICAL_RECORD_COPY, null, NOW, null));
    }

    @Test
    @DisplayName("dueAt bằng đúng receivedAt được chấp nhận")
    void createAcceptsDueAtEqualToReceivedAt() {
        PersonalDataRequest request = PersonalDataRequest.create(
                UUID.randomUUID(), PersonalDataRequest.TYPE_MEDICAL_RECORD_COPY, null, NOW, NOW);

        assertEquals(NOW, request.getDueAt());
        assertEquals(NOW, request.getReceivedAt());
    }

    @Test
    @DisplayName("dueAt trước receivedAt bị từ chối ở tầng domain")
    void createRejectsDueAtBeforeReceivedAt() {
        assertThrows(ValidationException.class, () -> PersonalDataRequest.create(
                UUID.randomUUID(), PersonalDataRequest.TYPE_MEDICAL_RECORD_COPY, null, NOW, NOW.minusSeconds(1)));
    }

    @Test
    @DisplayName("TC-03: hoàn tất ghi kết quả và người xử lý, chuyển trạng thái COMPLETED")
    void completeRecordsResultAndProcessor() {
        PersonalDataRequest request = PersonalDataRequest.create(
                UUID.randomUUID(), PersonalDataRequest.TYPE_MEDICAL_RECORD_COPY, null, NOW, NOW.plusSeconds(60));
        UUID processorId = UUID.randomUUID();

        request.complete("Đã cấp bản sao hồ sơ", processorId, NOW.plusSeconds(30));

        assertEquals(PersonalDataRequestStatus.COMPLETED, request.getStatus());
        assertEquals("Đã cấp bản sao hồ sơ", request.getResult());
        assertEquals(processorId, request.getProcessedBy());
        assertEquals(NOW.plusSeconds(30), request.getCompletedAt());
    }

    @Test
    @DisplayName("hoàn tất lần hai bị từ chối")
    void completeTwiceThrows() {
        PersonalDataRequest request = PersonalDataRequest.create(
                UUID.randomUUID(), PersonalDataRequest.TYPE_MEDICAL_RECORD_COPY, null, NOW, NOW.plusSeconds(60));
        request.complete("Đã xử lý", UUID.randomUUID(), NOW.plusSeconds(30));

        assertThrows(PersonalDataRequestAlreadyCompletedException.class,
                () -> request.complete("Lần hai", UUID.randomUUID(), NOW.plusSeconds(60)));
    }

    @Test
    @DisplayName("TC-02: yêu cầu RECEIVED quá hạn được phát hiện")
    void isOverdueDetectsOpenRequestPastDue() {
        PersonalDataRequest request = PersonalDataRequest.create(
                UUID.randomUUID(), PersonalDataRequest.TYPE_MEDICAL_RECORD_COPY, null, NOW, NOW.plusSeconds(10));

        assertTrue(request.isOverdue(NOW.plusSeconds(60)));
        assertFalse(request.isOverdue(NOW));
    }

    @Test
    @DisplayName("yêu cầu đã COMPLETED không bao giờ bị báo quá hạn")
    void isOverdueFalseWhenCompleted() {
        PersonalDataRequest request = PersonalDataRequest.create(
                UUID.randomUUID(), PersonalDataRequest.TYPE_MEDICAL_RECORD_COPY, null, NOW, NOW.plusSeconds(10));
        request.complete("Đã xử lý", UUID.randomUUID(), NOW.plusSeconds(5));

        assertFalse(request.isOverdue(NOW.plusSeconds(3600)));
    }
}
