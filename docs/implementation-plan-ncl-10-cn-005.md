# Kế hoạch triển khai chi tiết (Implementation Plan) - NCL-10-CN-005
**Tính năng:** Khảo sát hài lòng sau khám  
**User Story:** `NCL-10-CN-005` (Epic `NCL-10` - Chăm sóc sau khám và cổng tra cứu bệnh nhân)  
**Quy tắc nghiệp vụ:** `QTN-23` (Bảo mật phạm vi dữ liệu bệnh nhân), Quy tắc trạng thái lượt khám, Quy tắc chống trùng đánh giá  
**Vai trò tham gia:** Bệnh nhân (`ROLE_PATIENT`), Quản lý phòng khám (`ROLE_MANAGER` / `ROLE_ADMIN`)  
**Người phụ trách đề xuất:** Thành viên ba (Backend)  
**Chu kỳ (Sprint):** Chu kỳ số mười hai (Sprint 12)  
**Trạng thái kế hoạch:** Sẵn sàng triển khai (Ready for Implementation) - Giai đoạn phân tích và lập kế hoạch kỹ thuật  

---

## 1. Phân tích yêu cầu nghiệp vụ và các điều kiện áp dụng

### 1.1. Thông tin nghiệp vụ từ Product Workbook
- **User Story:** Là quản lý phòng khám, tôi muốn thu thập đánh giá của người bệnh sau lượt khám, để biết chất lượng phục vụ và xử lý phản ánh sớm.
- **Giá trị nghiệp vụ:** Có dữ liệu phản hồi có hệ thống thay vì chỉ nghe phản ánh trực tiếp tại quầy hoặc để sót các trải nghiệm không hài lòng của bệnh nhân.
- **Mô tả chi tiết:** Sau khi lượt khám hoàn tất, bệnh nhân đánh giá theo thang điểm và ghi nhận xét trên cổng bệnh nhân; quản lý phòng khám xem báo cáo tổng hợp theo kỳ và theo bác sĩ.
- **Điều kiện bắt đầu (Preconditions):**
  1. Lượt khám đã ở trạng thái hoàn tất (`status = COMPLETED`).
  2. Bệnh nhân có tài khoản trên cổng (`patients.user_id IS NOT NULL`).
  3. Bệnh nhân đã đăng nhập cổng bệnh nhân (`ROLE_PATIENT`) và chỉ được đánh giá lượt khám của chính mình (`QTN-23`).
- **Kết quả sau hoàn thành (Postconditions):**
  1. Đánh giá và nhận xét được lưu trữ gắn chặt với mã lượt khám (`visit_id`).
  2. Báo cáo tổng hợp số liệu và điểm trung bình hiển thị chính xác theo khoảng thời gian và theo từng bác sĩ phụ trách khám.
- **Phụ thuộc vào (Dependencies):**
  - `NCL-14-CN-002`: Đăng nhập cổng bệnh nhân (cung cấp ngữ cảnh xác thực `ROLE_PATIENT` và `userId`).
  - `NCL-07-CN-001`: Thu phí khám bệnh (luồng kết thúc khám và thanh toán chuyển trạng thái lượt khám sang `COMPLETED`).

### 1.2. Phân tích vai trò và phân quyền (User Roles & Permissions)
| Vai trò | Mã vai trò | Quyền hạn trong tính năng | Kênh truy cập | Cơ chế bảo vệ & Ràng buộc |
| :--- | :---: | :--- | :---: | :--- |
| **Bệnh nhân** | `ROLE_PATIENT`<br>(`VT-06`) | - Gửi đánh giá và nhận xét cho lượt khám đã hoàn tất.<br>- Xem đánh giá đã gửi của lượt khám.<br>- Chỉnh sửa lại đánh giá cũ nếu gửi lần 2 (theo `TC-02`). | Cổng bệnh nhân (`/patient-portal/**`) | - `SecurityConfig`: Yêu cầu `ROLE_PATIENT`.<br>- `QTN-23`: Kiểm tra quyền sở hữu qua `PatientAccessGuard.requirePatientOwnership`. Từ chối 403 Forbidden và ghi nhật ký `ACCESS_DENIED` nếu vi phạm. |
| **Quản lý phòng khám** | `ROLE_MANAGER`<br>(`VT-01`) | - Xem báo cáo tổng hợp điểm đánh giá trung bình theo kỳ.<br>- Xem tổng hợp điểm đánh giá theo từng bác sĩ.<br>- Xem chi tiết phản ánh/nhận xét để xử lý sớm. | Hệ thống quản trị nội bộ (`/reports/**`) | - `SecurityConfig`: Đã xác thực (`authenticated()`).<br>- `@RequirePermission("REPORT_VIEW")`: Đã cấp cho `ROLE_MANAGER` và `ROLE_ADMIN` tại migration `V2__seed_auth_data.sql`. |
| **Quản trị viên** | `ROLE_ADMIN` | Có toàn quyền xem báo cáo như Quản lý phòng khám. | Hệ thống nội bộ | Kế thừa toàn bộ quyền của `ROLE_MANAGER`. |

### 1.3. Ma trận Acceptance Criteria & Quy tắc nghiệp vụ liên quan
| Mã tiêu chí | Loại kịch bản | Điều kiện ban đầu (Given) | Hành động (When) | Kết quả mong đợi (Then) | Dữ liệu kiểm thử | Quy tắc áp dụng |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **`NCL-10-CN-005-TC-01`** | Luồng thành công | Lượt khám đã hoàn tất (`COMPLETED`) và bệnh nhân có tài khoản cổng. | Bệnh nhân gửi đánh giá kèm nhận xét. | Đánh giá được lưu gắn với lượt khám đó. Phản hồi HTTP 201 Created. | Điểm: `1 - 5`, Nhận xét: chuỗi ký tự hợp lệ. | `QTN-23`, Ràng buộc trạng thái lượt khám `COMPLETED`. |
| **`NCL-10-CN-005-TC-02`** | Dữ liệu trùng lặp / Sửa đánh giá | Bệnh nhân đã đánh giá lượt khám này trước đó. | Bệnh nhân gửi yêu cầu đánh giá lần hai. | Hệ thống chặn tạo mới (HTTP 409 Conflict) và cho phép sửa đánh giá cũ (HTTP 200 OK qua `PUT`) thay vì tạo thêm bản ghi mới. | Gửi trùng `visit_id`, payload cập nhật mới. | Khóa duy nhất `UNIQUE(visit_id)` trong CSDL, Idempotency. |
| **`NCL-10-CN-005-TC-03`** | Luồng thành công | Trong kỳ đã có nhiều đánh giá của các lượt khám khác nhau. | Quản lý phòng khám xem báo cáo tổng hợp. | Báo cáo hiển thị điểm trung bình toàn phòng khám và điểm trung bình theo từng bác sĩ. | Khoảng thời gian `from`, `to`, danh sách bác sĩ, điểm trung bình. | `REPORT_VIEW`, Công thức tính `AVG(score)` và `COUNT(id)`. |

---

## 2. Rà soát hiện trạng Codebase và Khoảng trống triển khai (Gap Analysis)

### 2.1. Hiện trạng Codebase theo từng Layer
```
                                 HIỆN TRẠNG KIẾN TRÚC TỒN TẠI
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ [API / Security]                                                                       │
│  - SecurityConfig: /patient-portal/** -> hasRole("PATIENT") (ĐÃ CÓ)                   │
│  - SecurityConfig: /reports/** -> authenticated() (ĐÃ CÓ)                              │
│  - PatientAccessGuard: Kiểm soát QTN-23 + ghi log ACCESS_DENIED (ĐÃ CÓ)               │
│  - ReportsController: Báo cáo vận hành chung với @RequirePermission("REPORT_VIEW")   │
│  - THIẾU: PatientPortalSatisfactionSurveyController & endpoint báo cáo khảo sát       │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │
┌───────────────────────────────────────────▼────────────────────────────────────────────┐
│ [Use Case / Service]                                                                   │
│  - Đã có các service portal: Invoice, Appointment, MedicalHistory, ClinicalResult...   │
│  - Đã có OperationalReportQueryRepositoryAdapter tổng hợp theo bác sĩ                 │
│  - THIẾU: SubmitSatisfactionSurveyService, UpdateSatisfactionSurveyService,            │
│           GetPatientSatisfactionSurveyService, GetSatisfactionReportService            │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │
┌───────────────────────────────────────────▼────────────────────────────────────────────┐
│ [Domain]                                                                               │
│  - Visit: Quản lý trạng thái COMPLETED, patientId, doctorId (ĐÃ CÓ)                   │
│  - DomainErrorCode: Đã có VISIT_INVALID_STATUS, VISIT_NOT_FOUND (ĐÃ CÓ)                │
│  - THIẾU: Domain Entity PatientSatisfactionSurvey, Exceptions khảo sát                 │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │
┌───────────────────────────────────────────▼────────────────────────────────────────────┐
│ [Persistence / Database]                                                               │
│  - Bảng visits: Đã có khóa ngoại patient_id, doctor_id, completed_at, status (ĐÃ CÓ)  │
│  - Flyway migration hiện tại: V99 (ĐÃ CÓ)                                              │
│  - THIẾU: Migration V104, Bảng patient_satisfaction_surveys, Entity, JPA Repository   │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

### 2.2. Điểm đã đáp ứng (Existing Capabilities)
1. **Hạ tầng phân quyền và ngữ cảnh Bệnh nhân**: Đã có `PatientAccessGuard` với phương thức `requirePatientOwnership(patientId, resourceType, resourceId)`, tích hợp sẵn `denialAuditWriter` ghi nhận log từ chối vi phạm `QTN-23`.
2. **Khung báo cáo vận hành**: `ReportsController` đã có cơ chế chuẩn mực phân tích tham số `from`/`to`, kiểm tra khoảng thời gian hợp lệ (`validateRange` tối đa 366 ngày), và phân quyền `@RequirePermission("REPORT_VIEW")`.
3. **Cơ sở dữ liệu lượt khám**: `VisitEntity` và `JpaVisitRepository` lưu trữ đầy đủ `status`, `doctorId`, `patientId`, `completedAt`.
4. **Chuẩn hóa Exception & Mã lỗi**: Đã có `DomainExceptionHttpStatusMapper` và `GlobalExceptionHandler` tuân thủ nghiêm ngặt `docs/exception-conventions.md`.

### 2.3. Điểm còn thiếu (Missing Components)
1. **Database Schema**: Chưa có bảng lưu trữ khảo sát hài lòng sau khám. Cần tạo migration script `V104__create_patient_satisfaction_surveys_table.sql`.
2. **Domain Layer**: Chưa có entity `PatientSatisfactionSurvey`, các domain exceptions `SatisfactionSurveyAlreadyExistsException`, `SatisfactionSurveyNotFoundException`, và các mã lỗi `SATISFACTION_SURVEY_ALREADY_EXISTS`, `SATISFACTION_SURVEY_NOT_FOUND` trong `DomainErrorCode`.
3. **Persistence Layer**: Chưa có `SatisfactionSurveyEntity`, `JpaSatisfactionSurveyRepository`, mapper và adapter cài đặt `SatisfactionSurveyRepository`.
4. **Application Services**:
   - `SubmitSatisfactionSurveyService`: tiếp nhận khảo sát, validate điều kiện hoàn tất và QTN-23, bắt lỗi trùng lặp.
   - `UpdateSatisfactionSurveyService`: cho phép chỉnh sửa khảo sát đã có theo `TC-02`.
   - `GetPatientSatisfactionSurveyService`: lấy khảo sát của lượt khám cho bệnh nhân.
   - `GetSatisfactionReportService`: tính toán thống kê điểm trung bình theo kỳ và theo từng bác sĩ cho quản lý.
5. **REST API Controllers**:
   - `PatientPortalSatisfactionSurveyController` trên `/patient-portal/satisfaction-surveys`.
   - Bổ sung endpoint `GET /reports/satisfaction` trong `ReportsController`.
6. **Tài liệu & Contract**: Chưa có file đặc tả API contract `docs/api/patient-satisfaction-survey-contract.md`.
7. **Test Suites**: Chưa có kiểm thử cho cả 3 tiêu chí chấp nhận `TC-01`, `TC-02`, `TC-03` và quy tắc `QTN-23`.

---

## 3. Các quyết định kỹ thuật và Nghiệp vụ cần thống nhất (Key Technical & Business Decisions)

### Quyết định 1: Thiết kế API xử lý dữ liệu trùng lặp (`TC-02`)
- **Vấn đề:** Khi bệnh nhân gửi đánh giá lần 2 cho một lượt khám đã đánh giá trước đó, hệ thống ứng xử như thế nào?
- **Phương án lựa chọn:**
  - `POST /patient-portal/satisfaction-surveys` nhận request tạo mới. Nếu lượt khám đã có khảo sát trong DB, service sẽ ném `SatisfactionSurveyAlreadyExistsException`, mapper trả về **HTTP 409 Conflict** với mã lỗi `SATISFACTION_SURVEY_ALREADY_EXISTS` và đính kèm `surveyId` hiện tại trong chi tiết lỗi.
  - Cung cấp thêm API `PUT /patient-portal/satisfaction-surveys/{id}` (hoặc `PUT /patient-portal/satisfaction-surveys/by-visit/{visitId}`) cho phép bệnh nhân cập nhật điểm đánh giá và nhận xét mới.
  - Đồng thời cung cấp `GET /patient-portal/satisfaction-surveys/by-visit/{visitId}` để frontend cổng bệnh nhân có thể chủ động kiểm tra trạng thái lượt khám đã đánh giá hay chưa để hiển thị nút "Sửa đánh giá" thay vì "Gửi đánh giá".
- **Lý do:** Tuân thủ đúng ngữ nghĩa của HTTP POST/PUT, đáp ứng trọn vẹn yêu cầu của `TC-02`: *"Hệ thống chặn và cho phép sửa đánh giá cũ thay vì tạo mới"*.

### Quyết định 2: Quy chuẩn thang điểm đánh giá (Rating Scale)
- **Vấn đề:** Workbook chỉ ghi "theo thang điểm" mà không chỉ rõ giá trị cụ thể.
- **Phương án lựa chọn:** Áp dụng thang điểm tiêu chuẩn y tế quốc tế **1 đến 5 sao** (Số nguyên: `1 = Rất không hài lòng`, `2 = Không hài lòng`, `3 = Bình thường`, `4 = Hài lòng`, `5 = Rất hài lòng`).
- **Ràng buộc:** Validate ở cả 3 tầng: DTO (`@Min(1) @Max(5)`), Domain Model (`Guard.requireRange(1, 5)`), và Database Check Constraint (`CHECK (score BETWEEN 1 AND 5)`).

### Quyết định 3: Ràng buộc độ dài và tính chất của nhận xét (Comments)
- **Vấn đề:** Nhận xét có bắt buộc không và giới hạn độ dài là bao nhiêu?
- **Phương án lựa chọn:**
  - Điểm đánh giá (`score`): Bắt buộc (`NOT NULL`).
  - Nhận xét (`comment`): Tùy chọn (`NULL` hoặc chuỗi rỗng được chấp nhận), tối đa **1000 ký tự**. Được cắt tỉa khoảng trắng (`trim()`).

### Quyết định 4: Bác sĩ được ghi nhận trong khảo sát
- **Vấn đề:** Lượt khám có thể có `doctorId` (bác sĩ kết thúc) và `initialDoctorId` (bác sĩ tiếp nhận ban đầu nếu có bàn giao). Khảo sát sẽ gán cho ai?
- **Phương án lựa chọn:** Khảo sát lưu snapshot `doctor_id` từ `visit.doctorId` (bác sĩ phụ trách chính/bác sĩ kết thúc lượt khám). Điều này bảo đảm khi quản lý xem báo cáo theo bác sĩ, điểm số phản ánh đúng người trực tiếp hoàn thành điều trị cho bệnh nhân.

### Quyết định 5: Định danh ResourceType trong Kiểm toán (Audit Log)
- **Vấn đề:** Hệ thống kiểm toán `ResourceType` enum hiện tại chưa có giá trị định danh riêng cho khảo sát hài lòng.
- **Phương án lựa chọn:** Bổ sung `PATIENT_SATISFACTION_SURVEY` vào `com.benhsoan.domain.auditlog.enums.ResourceType`. Mọi hành động gửi mới (`CREATE`), cập nhật (`UPDATE`) khảo sát và từ chối truy cập (`ACCESS_DENIED`) đều ghi nhận loại tài nguyên chuẩn xác này.

---

## 4. Thiết kế Kỹ thuật Chi tiết (Detailed Technical Design)

### 4.1. Thiết kế Cơ sở dữ liệu (Flyway Migration `V104`)
File: `backend/src/main/resources/db/migration/V104__create_patient_satisfaction_surveys_table.sql`
```sql
-- =====================================================
-- V104__create_patient_satisfaction_surveys_table.sql
-- NCL-10-CN-005: Khảo sát hài lòng sau khám
-- =====================================================

CREATE TABLE patient_satisfaction_surveys (
    id BINARY(16) NOT NULL,
    visit_id BINARY(16) NOT NULL,
    patient_id BINARY(16) NOT NULL,
    doctor_id BINARY(16) NOT NULL,
    score TINYINT NOT NULL,
    comment VARCHAR(1000) NULL,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NULL,
    PRIMARY KEY (id),
    CONSTRAINT uk_satisfaction_survey_visit UNIQUE (visit_id),
    CONSTRAINT fk_satisfaction_survey_visit FOREIGN KEY (visit_id) REFERENCES visits (id),
    CONSTRAINT fk_satisfaction_survey_patient FOREIGN KEY (patient_id) REFERENCES patients (id),
    CONSTRAINT fk_satisfaction_survey_doctor FOREIGN KEY (doctor_id) REFERENCES users (id),
    CONSTRAINT chk_satisfaction_survey_score CHECK (score >= 1 AND score <= 5)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_satisfaction_surveys_doctor_created ON patient_satisfaction_surveys (doctor_id, created_at);
CREATE INDEX idx_satisfaction_surveys_created_at ON patient_satisfaction_surveys (created_at);
CREATE INDEX idx_satisfaction_surveys_patient ON patient_satisfaction_surveys (patient_id);
```

### 4.2. Thiết kế Domain Model & Exceptions
1. **Domain Entity:** `com.benhsoan.domain.survey.PatientSatisfactionSurvey`
   - Fields:
     - `UUID id`
     - `UUID visitId`
     - `UUID patientId`
     - `UUID doctorId`
     - `int score` (1 - 5)
     - `String comment` (<= 1000 chars)
     - `Instant createdAt`
     - `Instant updatedAt`
   - Invariants:
     - `score` phải nằm trong đoạn `[1, 5]`.
     - `comment` nếu có không được vượt quá 1000 ký tự.
     - `update(int newScore, String newComment, Instant now)`: kiểm tra hợp lệ, gán giá trị mới và cập nhật `updatedAt`.
2. **Domain Exceptions & Error Codes:**
   - Thêm vào `DomainErrorCode`:
     - `SATISFACTION_SURVEY_ALREADY_EXISTS` -> Map tới `HttpStatus.CONFLICT` (409).
     - `SATISFACTION_SURVEY_NOT_FOUND` -> Map tới `HttpStatus.NOT_FOUND` (404).
   - Domain Exception classes:
     - `SatisfactionSurveyAlreadyExistsException extends DomainException`
     - `SatisfactionSurveyNotFoundException extends DomainException`

### 4.3. Thiết kế Outbound Ports & Persistence
1. **Outbound Port:** `com.benhsoan.port.outbound.repository.survey.SatisfactionSurveyRepository`
   - `PatientSatisfactionSurvey save(PatientSatisfactionSurvey survey);`
   - `Optional<PatientSatisfactionSurvey> findById(UUID id);`
   - `Optional<PatientSatisfactionSurvey> findByVisitId(UUID visitId);`
   - `boolean existsByVisitId(UUID visitId);`
2. **Outbound Query Port cho Báo cáo:** `com.benhsoan.port.outbound.repository.survey.SatisfactionReportQueryRepository`
   - `SatisfactionOverallSummary getOverallSummary(Instant fromInclusive, Instant toExclusive, UUID doctorId);`
   - `List<DoctorSatisfactionSummaryItem> getDoctorSummaries(Instant fromInclusive, Instant toExclusive);`
   - `Map<Integer, Long> getScoreDistribution(Instant fromInclusive, Instant toExclusive, UUID doctorId);`
3. **JPA Entity & Repository:**
   - `SatisfactionSurveyEntity` mapping với bảng `patient_satisfaction_surveys`.
   - `JpaSatisfactionSurveyRepository` với các query JPQL tổng hợp sử dụng `COUNT()`, `AVG(survey.score)`, `GROUP BY survey.doctorId`, `GROUP BY survey.score`.

### 4.4. Thiết kế Use Cases & Application Services
1. **Use Case 1: Gửi đánh giá lần đầu (`TC-01`)**
   - Inbound Port: `SubmitSatisfactionSurveyUseCase`
   - Service: `SubmitSatisfactionSurveyService`
   - Luồng xử lý:
     1. Tìm `Visit` theo `visitId`. Nếu không tìm thấy: ném `VisitNotFoundException`.
     2. Xác thực quyền sở hữu của bệnh nhân đang đăng nhập: `patientAccessGuard.requirePatientOwnership(visit.getPatientId(), ResourceType.PATIENT_SATISFACTION_SURVEY, visitId)`.
     3. Kiểm tra trạng thái lượt khám: nếu `visit.getStatus() != VisitStatus.COMPLETED`, ném `VisitInvalidStatusException("Chỉ có thể đánh giá lượt khám đã hoàn tất.")`.
     4. Kiểm tra chống trùng lặp (`TC-02`): nếu `satisfactionSurveyRepository.existsByVisitId(visitId)`, ném `SatisfactionSurveyAlreadyExistsException(visitId)`.
     5. Khởi tạo `PatientSatisfactionSurvey.create(visitId, visit.getPatientId(), visit.getDoctorId(), score, comment, clockPort.now())`.
     6. Lưu entity vào CSDL và ghi nhận `AuditLog` (`ActionType.CREATE`, `ResourceType.PATIENT_SATISFACTION_SURVEY`).
     7. Trả về kết quả `SatisfactionSurveyResult`.
2. **Use Case 2: Sửa đánh giá cũ (`TC-02`)**
   - Inbound Port: `UpdateSatisfactionSurveyUseCase`
   - Service: `UpdateSatisfactionSurveyService`
   - Luồng xử lý:
     1. Tìm `PatientSatisfactionSurvey` theo `surveyId` (hoặc `visitId`). Nếu không có: ném `SatisfactionSurveyNotFoundException`.
     2. Xác thực quyền sở hữu: `patientAccessGuard.requirePatientOwnership(survey.getPatientId(), ResourceType.PATIENT_SATISFACTION_SURVEY, survey.getId())`.
     3. Thực hiện `survey.update(newScore, newComment, clockPort.now())`.
     4. Lưu entity vào CSDL và ghi nhận `AuditLog` (`ActionType.UPDATE`, `ResourceType.PATIENT_SATISFACTION_SURVEY`).
     5. Trả về kết quả `SatisfactionSurveyResult`.
3. **Use Case 3: Tra cứu đánh giá của lượt khám**
   - Inbound Port: `GetPatientSatisfactionSurveyUseCase`
   - Service: `GetPatientSatisfactionSurveyService`
   - Trả về khảo sát gắn với lượt khám của chính bệnh nhân, phục vụ hiển thị trên giao diện cổng.
4. **Use Case 4: Xem báo cáo tổng hợp theo kỳ và theo bác sĩ (`TC-03`)**
   - Inbound Port: `GetSatisfactionReportUseCase`
   - Service: `GetSatisfactionReportService`
   - Tham số: `LocalDate from`, `LocalDate to`, `UUID doctorId` (optional).
   - Luồng xử lý:
     1. Chuyển đổi `from`, `to` thành khoảng thời gian `Instant` (từ đầu ngày `from` 00:00:00 đến đầu ngày `to + 1` 00:00:00 theo múi giờ hệ thống).
     2. Truy vấn tổng số khảo sát, điểm trung bình toàn phòng khám, và phân bố số lượng điểm từ 1 đến 5 sao.
     3. Truy vấn danh sách tổng hợp theo từng bác sĩ: `doctorId`, `doctorName`, số lượng đánh giá, điểm trung bình, phân bố điểm.
     4. Tổng hợp và trả về `SatisfactionReportResult`.

### 4.5. Thiết kế REST API Contracts
#### 4.5.1. APIs Cổng Bệnh nhân (Yêu cầu `ROLE_PATIENT`)
- **Gửi khảo sát mới:**
  - `POST /patient-portal/satisfaction-surveys`
  - Body:
    ```json
    {
      "visitId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "score": 5,
      "comment": "Bác sĩ tư vấn rất kỹ lưỡng và ân cần."
    }
    ```
  - Response: HTTP 201 Created
    ```json
    {
      "id": "7ca85f64-5717-4562-b3fc-2c963f66afb7",
      "visitId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "visitCode": "KB-20260925-001",
      "doctorId": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2",
      "doctorName": "Dr. Nguyen Minh Anh",
      "score": 5,
      "comment": "Bác sĩ tư vấn rất kỹ lưỡng và ân cần.",
      "createdAt": "2026-09-25T14:30:00Z",
      "updatedAt": null
    }
    ```
  - Lỗi trùng lặp (TC-02): HTTP 409 Conflict
    ```json
    {
      "code": "SATISFACTION_SURVEY_ALREADY_EXISTS",
      "message": "Lượt khám này đã được gửi đánh giá hài lòng trước đó.",
      "details": {
        "existingSurveyId": "7ca85f64-5717-4562-b3fc-2c963f66afb7"
      }
    }
    ```
- **Sửa khảo sát cũ:**
  - `PUT /patient-portal/satisfaction-surveys/{id}`
  - Body:
    ```json
    {
      "score": 4,
      "comment": "Bác sĩ nhiệt tình, thời gian chờ thuốc hơi lâu một chút."
    }
    ```
  - Response: HTTP 200 OK
- **Lấy thông tin khảo sát theo lượt khám:**
  - `GET /patient-portal/satisfaction-surveys/by-visit/{visitId}`
  - Response: HTTP 200 OK (thông tin khảo sát) hoặc HTTP 404 Not Found (nếu chưa đánh giá).

#### 4.5.2. API Báo cáo Quản lý phòng khám (Yêu cầu `REPORT_VIEW`)
- **Xem báo cáo tổng hợp:**
  - `GET /reports/satisfaction?from=2026-09-01&to=2026-09-25&doctorId=`
  - Response: HTTP 200 OK
    ```json
    {
      "from": "2026-09-01",
      "to": "2026-09-25",
      "generatedAt": "2026-09-25T14:35:00Z",
      "totalSurveys": 150,
      "averageScore": 4.65,
      "scoreDistribution": {
        "1": 2,
        "2": 3,
        "3": 10,
        "4": 45,
        "5": 90
      },
      "doctors": [
        {
          "doctorId": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2",
          "doctorName": "Dr. Nguyen Minh Anh",
          "totalSurveys": 80,
          "averageScore": 4.80,
          "scoreDistribution": {
            "1": 0,
            "2": 1,
            "3": 3,
            "4": 16,
            "5": 60
          }
        },
        {
          "doctorId": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3",
          "doctorName": "Dr. Tran Quang Huy",
          "totalSurveys": 70,
          "averageScore": 4.48,
          "scoreDistribution": {
            "1": 2,
            "2": 2,
            "3": 7,
            "4": 29,
            "5": 30
          }
        }
      ]
    }
    ```

---

## 5. Kế hoạch triển khai theo từng giai đoạn (Step-by-Step Implementation Phases)

Thứ tự phụ thuộc kiến trúc:  
`Giai đoạn 1: Database & Persistence Layer` ──► `Giai đoạn 2: Domain Layer & Error Codes` ──► `Giai đoạn 3: Application Services & Use Cases` ──► `Giai đoạn 4: REST Controllers, Mappers & Security` ──► `Giai đoạn 5: Test Suite Toàn diện & Tài liệu`

```
┌────────────────────────────────────────────────────────┐
│ Giai đoạn 1: Database & Persistence Layer               │
│ - Migration V104, Entity, JpaRepository, Adapter       │
└──────────────────────────┬─────────────────────────────┘
                           │
┌──────────────────────────▼─────────────────────────────┐
│ Giai đoạn 2: Domain Layer & Exception Catalog          │
│ - Domain Entity, Invariants, Exceptions, ErrorCode     │
└──────────────────────────┬─────────────────────────────┘
                           │
┌──────────────────────────▼─────────────────────────────┐
│ Giai đoạn 3: Application Services & Use Cases          │
│ - Submit, Update, Get Survey & Reporting Services      │
└──────────────────────────┬─────────────────────────────┘
                           │
┌──────────────────────────▼─────────────────────────────┐
│ Giai đoạn 4: REST Controllers & Security Binding       │
│ - PatientPortalSurveyController, ReportsController ext │
└──────────────────────────┬─────────────────────────────┘
                           │
┌──────────────────────────▼─────────────────────────────┐
│ Giai đoạn 5: Testing Suite & API Contract Document     │
│ - Unit, Integration, QTN-23 Security Tests, Docs       │
└────────────────────────────────────────────────────────┘
```

---

### Giai đoạn 1: Cơ sở dữ liệu và Tầng Persistence
- **Mục tiêu:** Tạo cấu trúc bảng lưu trữ với ràng buộc toàn vẹn dữ liệu, các chỉ mục truy vấn hiệu năng cao, entity JPA và adapter persistence.
- **File / Layer dự kiến tác động:**
  - `backend/src/main/resources/db/migration/V104__create_patient_satisfaction_surveys_table.sql`
  - `backend/src/main/java/com/benhsoan/persistence/entity/survey/SatisfactionSurveyEntity.java`
  - `backend/src/main/java/com/benhsoan/persistence/jpaRepository/survey/JpaSatisfactionSurveyRepository.java`
  - `backend/src/main/java/com/benhsoan/persistence/mapper/survey/SatisfactionSurveyPersistenceMapper.java`
  - `backend/src/main/java/com/benhsoan/persistence/adapterRepository/survey/SatisfactionSurveyRepositoryAdapter.java`
- **Quy tắc nghiệp vụ cần đảm bảo:**
  - Tính toàn vẹn: Khóa ngoại trỏ đúng tới `visits(id)`, `patients(id)`, `users(id)`.
  - Chống trùng lặp tuyệt đối: Ràng buộc duy nhất `UNIQUE KEY uk_satisfaction_survey_visit (visit_id)`.
  - Miền giá trị điểm: Ràng buộc kiểm tra `CHECK (score >= 1 AND score <= 5)`.
  - Tối ưu truy vấn báo cáo theo kỳ và bác sĩ: Index trên `(doctor_id, created_at)` và `(created_at)`.
- **Tiêu chí verify / test:**
  - Chạy `mvn compile` và kiểm tra migration Flyway thực thi thành công không lỗi cú pháp.
  - Kiểm tra các query aggregation tính `COUNT` và `AVG` trên `JpaSatisfactionSurveyRepository`.

---

### Giai đoạn 2: Tầng Domain và Danh mục Mã lỗi (Domain & Error Catalog)
- **Mục tiêu:** Xây dựng mô hình nghiệp vụ trung tâm `PatientSatisfactionSurvey`, các domain exception và đăng ký mã lỗi HTTP.
- **File / Layer dự kiến tác động:**
  - `backend/src/main/java/com/benhsoan/domain/survey/PatientSatisfactionSurvey.java`
  - `backend/src/main/java/com/benhsoan/domain/survey/exception/SatisfactionSurveyException.java`
  - `backend/src/main/java/com/benhsoan/domain/survey/exception/SatisfactionSurveyAlreadyExistsException.java`
  - `backend/src/main/java/com/benhsoan/domain/survey/exception/SatisfactionSurveyNotFoundException.java`
  - `backend/src/main/java/com/benhsoan/domain/shared/exception/DomainErrorCode.java`
  - `backend/src/main/java/com/benhsoan/exception/DomainExceptionHttpStatusMapper.java`
  - `backend/src/main/java/com/benhsoan/domain/auditlog/enums/ResourceType.java`
- **Quy tắc nghiệp vụ cần đảm bảo:**
  - Bất biến Domain: `score` hợp lệ từ 1 đến 5; `comment` không quá 1000 ký tự.
  - Tuân thủ quy ước exception (`docs/exception-conventions.md`): `SATISFACTION_SURVEY_ALREADY_EXISTS` map tới HTTP 409 Conflict; `SATISFACTION_SURVEY_NOT_FOUND` map tới HTTP 404 Not Found.
  - Cập nhật enum `ResourceType` thêm `PATIENT_SATISFACTION_SURVEY`.
- **Tiêu chí verify / test:**
  - Unit tests cho `PatientSatisfactionSurveyTest`: kiểm tra việc tạo, validate điểm ngoài khoảng (0, 6), độ dài chuỗi nhận xét vượt 1000 ký tự.
  - Kiểm tra `DomainExceptionRegistryContractTest` chạy pass.

---

### Giai đoạn 3: Tầng Ứng dụng & Dịch vụ (Application Services & Use Cases)
- **Mục tiêu:** Cài đặt toàn bộ luồng xử lý nghiệp vụ cho cả Bệnh nhân (gửi/sửa khảo sát) và Quản lý phòng khám (tổng hợp báo cáo).
- **File / Layer dự kiến tác động:**
  - Ports Inbound:
    - `backend/src/main/java/com/benhsoan/port/inbound/survey/SubmitSatisfactionSurveyUseCase.java`
    - `backend/src/main/java/com/benhsoan/port/inbound/survey/UpdateSatisfactionSurveyUseCase.java`
    - `backend/src/main/java/com/benhsoan/port/inbound/survey/GetPatientSatisfactionSurveyUseCase.java`
    - `backend/src/main/java/com/benhsoan/port/inbound/survey/GetSatisfactionReportUseCase.java`
  - Ports Outbound & DTOs:
    - `backend/src/main/java/com/benhsoan/port/outbound/repository/survey/SatisfactionSurveyRepository.java`
    - `backend/src/main/java/com/benhsoan/port/dto/result/survey/SatisfactionSurveyResult.java`
    - `backend/src/main/java/com/benhsoan/port/dto/result/survey/SatisfactionReportResult.java`
  - Services:
    - `backend/src/main/java/com/benhsoan/application/ucservice/survey/SubmitSatisfactionSurveyService.java`
    - `backend/src/main/java/com/benhsoan/application/ucservice/survey/UpdateSatisfactionSurveyService.java`
    - `backend/src/main/java/com/benhsoan/application/ucservice/survey/GetPatientSatisfactionSurveyService.java`
    - `backend/src/main/java/com/benhsoan/application/ucservice/survey/GetSatisfactionReportService.java`
- **Quy tắc nghiệp vụ cần đảm bảo:**
  - `QTN-23`: Luôn kiểm tra quyền sở hữu qua `PatientAccessGuard.requirePatientOwnership` trước khi truy cập hoặc chỉnh sửa khảo sát.
  - Trạng thái lượt khám: Bắt buộc lượt khám ở trạng thái `COMPLETED`. Nếu không hoàn tất -> ném lỗi không cho phép đánh giá.
  - Chống trùng lặp (`TC-02`): Khi gửi lần 2 -> chặn tạo mới và yêu cầu sửa đánh giá cũ.
  - Báo cáo (`TC-03`): Tính đúng số lượng và điểm trung bình theo khoảng thời gian và theo từng bác sĩ.
  - Kiểm toán: Ghi nhận bản ghi `AuditLog` cho các thao tác thành công và từ chối.
- **Tiêu chí verify / test:**
  - Unit tests cho từng service với mock dependencies. Đạt 100% kịch bản bao phủ cho `TC-01`, `TC-02`, `TC-03`, và vi phạm `QTN-23`.

---

### Giai đoạn 4: Tầng Giao tiếp REST, Mappers và Tích hợp Bảo mật (Adapter Layer)
- **Mục tiêu:** Mở các endpoint REST chuẩn mực cho Cổng bệnh nhân và Báo cáo quản lý, cấu hình phân quyền và validation request.
- **File / Layer dự kiến tác động:**
  - `backend/src/main/java/com/benhsoan/adapter/inbound/rest/request/survey/SubmitSatisfactionSurveyRequest.java`
  - `backend/src/main/java/com/benhsoan/adapter/inbound/rest/request/survey/UpdateSatisfactionSurveyRequest.java`
  - `backend/src/main/java/com/benhsoan/adapter/inbound/rest/response/survey/SatisfactionSurveyResponse.java`
  - `backend/src/main/java/com/benhsoan/adapter/inbound/rest/response/survey/SatisfactionReportResponse.java`
  - `backend/src/main/java/com/benhsoan/adapter/inbound/rest/mapper/SatisfactionSurveyRestMapper.java`
  - `backend/src/main/java/com/benhsoan/adapter/inbound/rest/controller/PatientPortalSatisfactionSurveyController.java`
  - `backend/src/main/java/com/benhsoan/adapter/inbound/rest/controller/ReportsController.java` (thêm `@GetMapping("/satisfaction")`)
  - `backend/src/main/java/com/benhsoan/config/SecurityConfig.java` (kiểm tra khớp đường dẫn `/patient-portal/**` và `/reports/**`)
- **Quy tắc nghiệp vụ cần đảm bảo:**
  - Cổng bệnh nhân: Chỉ cho phép `ROLE_PATIENT` gọi `/patient-portal/satisfaction-surveys/**`.
  - Báo cáo: Chỉ cho phép tài khoản có quyền `REPORT_VIEW` (`ROLE_MANAGER`, `ROLE_ADMIN`) gọi `/reports/satisfaction`.
  - Validate dữ liệu đầu vào: Điểm 1-5, nhận xét <= 1000 ký tự, định dạng ngày `yyyy-MM-dd`.
- **Tiêu chí verify / test:**
  - MockMvc Controller tests kiểm tra phân quyền HTTP 401 (chưa đăng nhập), HTTP 403 (sai vai trò), HTTP 400 (dữ liệu không hợp lệ), HTTP 409 (đánh giá trùng).

---

### Giai đoạn 5: Bộ Kiểm thử Toàn diện & Hoàn thiện Tài liệu (Testing & Documentation)
- **Mục tiêu:** Xây dựng đầy đủ Unit Test, Integration Test và xuất bản tài liệu API Contract.
- **File / Layer dự kiến tác động:**
  - `docs/api/patient-satisfaction-survey-contract.md`
  - `docs/permission-matrix.md` (cập nhật bảng ma trận phân quyền)
  - `backend/src/test/java/com/benhsoan/application/ucservice/survey/SubmitSatisfactionSurveyServiceTest.java`
  - `backend/src/test/java/com/benhsoan/application/ucservice/survey/UpdateSatisfactionSurveyServiceTest.java`
  - `backend/src/test/java/com/benhsoan/application/ucservice/survey/GetSatisfactionReportServiceTest.java`
  - `backend/src/test/java/com/benhsoan/adapter/inbound/rest/controller/PatientPortalSatisfactionSurveyControllerTest.java`
  - `backend/src/test/java/com/benhsoan/adapter/inbound/rest/controller/ReportsControllerSatisfactionTest.java`
- **Quy tắc nghiệp vụ cần đảm bảo:**
  - Khớp 100% dữ liệu thử nghiệm của AC: `TC-01` (điểm, nhận xét), `TC-02` (gửi lần 2 -> chặn 409 & cho phép sửa qua PUT), `TC-03` (tính điểm trung bình theo kỳ và bác sĩ).
  - Khớp nguyên tắc `QTN-23`: kiểm tra bệnh nhân truy cập chéo lượt khám của bệnh nhân khác bị chặn và ghi log kiểm toán.
- **Tiêu chí verify / test:**
  - Toàn bộ test suite chạy thành công (`mvn clean test`).
  - Không có lỗi kiểm tra tĩnh (linter, checkstyle nếu có).

---

## 6. Kế hoạch triển khai khắc phục các Findings sau Review (Post-Review Fix Implementation Plan)

### 6.1. Tóm tắt quyết định kỹ thuật
- **Danh sách findings sẽ xử lý (8/8 findings):**
  1. `[P1]` Regression làm vỡ 26 bài test trong `ReportsSecurityIntegrationTest` do thiếu Mock Bean `GetSatisfactionReportUseCase`.
  2. `[P2]` Race condition khi gửi trùng khảo sát đồng thời dẫn đến mã lỗi generic `DATA_INTEGRITY_VIOLATION` thay vì `SATISFACTION_SURVEY_ALREADY_EXISTS`.
  3. `[P2]` Bỏ lỡ index và lọc `doctorId` dưới database trong truy vấn `getDoctorSummaries`.
  4. `[P2]` Thiếu Integration Test thực tế cho Adapter Persistence với Database (H2).
  5. `[P3]` Mâu thuẫn giữa API Contract và Controller về tính bắt buộc của tham số `from` và `to`.
  6. `[P3]` Sai lệch cấu trúc JSON Response báo cáo giữa API Contract và DTO Backend.
  7. `[P3]` Tài liệu API Contract mô tả sai mã lỗi và HTTP status khi lượt khám chưa hoàn tất (`VISIT_NOT_COMPLETED` 422 vs `VISIT_INVALID_STATUS` 409).
  8. `[P3]` Endpoint `GET /patient-portal/satisfaction-surveys/{id}` đã triển khai nhưng chưa được đặc tả trong Contract.
- **Danh sách findings không xử lý trong đợt này:**
  - Lỗi tại `DoctorWeeklyTableControllerTest` (5 errors) và `ContraindicationRuleControllerTest` (3 failures): Do thuộc về các module khác (lịch bác sĩ và luật chống chỉ định) đã tồn tại từ trước trên nhánh base, không liên quan đến chức năng Khảo sát hài lòng sau khám (`NCL-10-CN-005`).
- **Giả định kỹ thuật:**
  - *Giả định 1 (Đã xác minh):* Giữ nguyên convention của toàn bộ `ReportsController` là `from` và `to` bắt buộc dạng `yyyy-MM-dd`, không đổi sang optional để bảo toàn tính nhất quán kiến trúc của cụm API báo cáo quản trị. Sửa API Contract cho khớp chuẩn này.
  - *Giả định 2 (Đã xác minh):* Giữ nguyên DTO Backend `SatisfactionReportResponse` (với mảng `doctors`, trường `doctorUsername`, `doctorName`, `totalSurveys`, `averageScore`, `generatedAt`), cập nhật API Contract cho khớp hoàn toàn thay vì sửa DTO để bảo toàn backward compatibility cho code backend đã ổn định.

---

### 6.2. Kế hoạch triển khai theo thứ tự dependency

| Bước | Layer / Module | File dự kiến thay đổi | Mục tiêu & Thay đổi kỹ thuật cụ thể | Finding liên quan | Tiêu chí hoàn thành (DoD) |
| :---: | :--- | :--- | :--- | :---: | :--- |
| **B1** | **Port (Outbound)** | `backend/src/main/java/com/benhsoan/port/outbound/repository/survey/SatisfactionReportQueryRepository.java` | Bổ sung tham số `UUID doctorId` vào phương thức: `List<DoctorSatisfactionSummary> getDoctorSummaries(Instant fromInclusive, Instant toExclusive, UUID doctorId)`. | `[P2]` Query Index | Compile thành công, signature port rõ ràng. |
| **B2** | **Persistence** | `backend/src/main/java/com/benhsoan/persistence/adapterRepository/survey/SatisfactionSurveyRepositoryAdapter.java` | Cập nhật câu JPQL trong `getDoctorSummaries` bổ sung điều kiện `and s.doctorId = :doctorId` khi `doctorId != null`. Đẩy bộ lọc xuống DB để tận dụng index `(doctor_id, created_at)`. | `[P2]` Query Index | JPQL cú pháp chuẩn, query đúng điều kiện lọc. |
| **B3** | **Application** | `backend/src/main/java/com/benhsoan/application/ucservice/reporting/GetSatisfactionReportService.java` | Truyền `doctorId` vào lời gọi `reportQueryRepository.getDoctorSummaries(timeRange.fromInclusive(), timeRange.toExclusive(), doctorId)`. Bỏ logic stream filter thừa trong bộ nhớ. | `[P2]` Query Index | Service gọi đúng tham số, không còn filter lặp lại. |
| **B4** | **Adapter (Exception)** | `backend/src/main/java/com/benhsoan/exception/GlobalExceptionHandler.java` | Trong `handleDataIntegrityViolation`, bổ sung kiểm tra chuỗi `uq_patient_satisfaction_surveys_visit` để trả về `HTTP 409 CONFLICT` với mã `SATISFACTION_SURVEY_ALREADY_EXISTS`. | `[P2]` Race Condition | Khi DB ném lỗi duplicate key, response trả về đúng mã nghiệp vụ 409. |
| **B5** | **Test (Regression Fix)** | `backend/src/test/java/com/benhsoan/adapter/inbound/rest/controller/ReportsSecurityIntegrationTest.java` | Khai báo bổ sung `@MockitoBean private GetSatisfactionReportUseCase getSatisfactionReportUseCase;` vào danh sách mock bean của test class. | `[P1]` Regression | Toàn bộ 26/26 tests trong `ReportsSecurityIntegrationTest` chuyển sang trạng thái PASSED. |
| **B6** | **Test (Unit & Integration)** | - `backend/src/test/java/com/benhsoan/application/ucservice/reporting/GetSatisfactionReportServiceTest.java`<br>- `backend/src/test/java/com/benhsoan/persistence/adapterRepository/survey/SatisfactionSurveyRepositoryAdapterIntegrationTest.java` | - Cập nhật mock invocation trong `GetSatisfactionReportServiceTest`.<br>- Tạo mới file test tích hợp `SatisfactionSurveyRepositoryAdapterIntegrationTest` chạy trên H2/Test context kiểm tra các câu JPQL và constraints. | `[P2]` Thiếu Test Persistence | Unit test & Integration test mới pass 100%. |
| **B7** | **Documentation** | `docs/api/patient-satisfaction-survey-contract.md` | - Sửa tham số `from`, `to` thành bắt buộc (Required).<br>- Đồng bộ cấu trúc JSON response (`doctors`, `totalSurveys`, `LocalDate`, `generatedAt`).<br>- Sửa mã lỗi lượt khám chưa hoàn tất thành `409 VISIT_INVALID_STATUS`.<br>- Bổ sung đặc tả endpoint `GET /patient-portal/satisfaction-surveys/{id}`. | `[P3]` 4 findings Contract | Tài liệu API Contract khớp 100% với Backend implementation. |

---

### 6.3. Thiết kế chi tiết cho từng Finding

#### Finding 1: [P1] Regression trong `ReportsSecurityIntegrationTest`
- **Root Cause:** `ReportsController` được thêm constructor parameter `GetSatisfactionReportUseCase`. Test class `@WebMvcTest(controllers = ReportsController.class)` khởi tạo Spring context bị thiếu mock bean tương ứng.
- **Phương án chọn:** Thêm `@MockitoBean private GetSatisfactionReportUseCase getSatisfactionReportUseCase;` vào `ReportsSecurityIntegrationTest.java`. Đây là chuẩn quy ước kiểm thử Controller slice test của Spring Boot.
- **Biên & Tác động:** Không ảnh hưởng đến production code, khôi phục toàn bộ 26 tests bảo mật của phân hệ báo cáo.

#### Finding 2: [P2] Race condition gửi trùng khảo sát đồng thời
- **Root Cause:** `existsByVisitId` kiểm tra tại application layer không chặn được race condition khi 2 request đến cùng thời điểm. Cơ sở dữ liệu kích hoạt unique constraint `uq_patient_satisfaction_surveys_visit` và ném `DataIntegrityViolationException`, nhưng `GlobalExceptionHandler` chỉ ánh xạ chung về `DATA_INTEGRITY_VIOLATION`.
- **Phương án chọn:** Bổ sung kiểm tra `uq_patient_satisfaction_surveys_visit` trong `GlobalExceptionHandler.handleDataIntegrityViolation` để ánh xạ thành HTTP 409 với mã `SATISFACTION_SURVEY_ALREADY_EXISTS` và thông điệp "Lượt khám này đã được gửi khảo sát hài lòng".
- **Biên & Tác động:** Đảm bảo idempotency và tính nhất quán của mã lỗi bất kể xung đột được phát hiện ở tầng ứng dụng hay tầng database.

#### Finding 3: [P2] Tối ưu hóa truy vấn `getDoctorSummaries`
- **Root Cause:** Signature port không nhận `doctorId`, câu JPQL gom nhóm toàn bộ bác sĩ trong khoảng thời gian, sau đó lọc lại bằng Java Stream.
- **Phương án chọn:** Đẩy điều kiện lọc xuống JPQL:
  ```sql
  WHERE s.createdAt >= :fromInclusive AND s.createdAt < :toExclusive
  [AND s.doctorId = :doctorId]
  GROUP BY d.id, d.username, d.fullName
  ```
  Tận dụng chỉ mục tổng hợp `idx_satisfaction_surveys_doctor_created (doctor_id, created_at)`.
- **Biên & Tác động:** Nếu `doctorId == null`, giữ nguyên logic thống kê cho tất cả bác sĩ; nếu `doctorId != null`, chỉ quét dữ liệu của bác sĩ đó. Thời gian phản hồi giảm từ $O(N)$ sang $O(\log N)$.

#### Finding 4: [P2] Thiếu Integration Test Persistence
- **Root Cause:** Giai đoạn trước chỉ viết Mockito unit tests cho tầng Service và WebMvcTest cho Controller.
- **Phương án chọn:** Tạo `SatisfactionSurveyRepositoryAdapterIntegrationTest` kiểm thử trực tiếp trên H2 Database:
  - Kiểm tra `save` và đọc lại qua `findById`, `findByVisitId`.
  - Kiểm tra ném exception khi vi phạm unique `visit_id`.
  - Kiểm tra tính toán `getOverallSummary`, `getScoreDistribution`, `getDoctorSummaries` với dữ liệu thực tế.

#### Findings 5, 6, 7, 8: [P3] Đồng bộ API Contract & Documentation
- **Root Cause:** Tài liệu API Contract được soạn thảo dựa trên bản phác thảo ban đầu, chưa được đối chiếu cập nhật sau khi hoàn thành code DTO và Controller.
- **Phương án chọn:** Cập nhật trực tiếp `docs/api/patient-satisfaction-survey-contract.md`:
  - Mục 3.1: Mã lỗi 409 `VISIT_INVALID_STATUS` thay cho 422 `VISIT_NOT_COMPLETED`.
  - Mục 3.4: Tham số `from`, `to` đánh dấu `Bắt buộc`, định dạng `yyyy-MM-dd`. Cấu trúc JSON response khớp với DTO `SatisfactionReportResponse`.
  - Bổ sung Mục 3.5: `GET /patient-portal/satisfaction-surveys/{id}` tra cứu chi tiết khảo sát theo ID.

---

### 6.4. Kế hoạch kiểm thử chi tiết (Test Plan)

| Test Case | Loại test | Given | When | Then | Finding / AC |
| :--- | :---: | :--- | :--- | :--- | :---: |
| `testReportsSecurityIntegration_ContextLoads` | Security / Controller | MockMvc context của `ReportsController` với đầy đủ mock use cases. | Chạy toàn bộ 26 test cases trong `ReportsSecurityIntegrationTest`. | Context khởi tạo thành công, 26/26 tests pass 100%. | `[P1]` Regression |
| `testDataIntegrityViolation_SatisfactionSurveyDuplicate` | Exception / Integration | Hai request submit cùng 1 `visit_id` vượt qua check app, DB ném `DataIntegrityViolationException` với constraint `uq_patient_satisfaction_surveys_visit`. | `GlobalExceptionHandler` xử lý ngoại lệ. | Trả về HTTP 409 Conflict, errorCode: `SATISFACTION_SURVEY_ALREADY_EXISTS`. | `[P2]` Race Condition |
| `testGetDoctorSummaries_FilteredByDoctorId_AtDbLevel` | Persistence / Query | CSDL có khảo sát của Bác sĩ A và Bác sĩ B trong kỳ. | Gọi `reportQueryRepository.getDoctorSummaries(from, to, doctorAId)`. | Câu truy vấn chỉ trả về đúng 1 bản ghi của Bác sĩ A với điểm chính xác. | `[P2]` Query Index |
| `testSatisfactionSurveyRepositoryAdapter_Integration` | Persistence / H2 | Cấu hình H2 Database với bảng `patient_satisfaction_surveys`. | Thực hiện CRUD và aggregate queries. | Dữ liệu lưu đúng kiểu binary UUID, score 1-5, tính đúng average score và count. | `[P2]` Test Persistence |
| `testReportsController_GetSatisfaction_MissingParams_Returns400` | Controller / MockMvc | Gọi `GET /reports/satisfaction` không truyền tham số `from` hoặc `to`. | Gửi request lên Controller. | Trả về HTTP 400 Bad Request, báo thiếu tham số bắt buộc. | `[P3]` Contract |

---

### 6.5. Chiến lược Rollout & Tiêu chí nghiệm thu (Acceptance Criteria)

1. **Thứ tự triển khai an toàn:**
   - Bước 1: Sửa Port & Service logic (`doctorId` filter).
   - Bước 2: Sửa Exception Handler (`uq_patient_satisfaction_surveys_visit`).
   - Bước 3: Sửa Regression test `ReportsSecurityIntegrationTest` và thêm test persistence mới.
   - Bước 4: Đồng bộ tài liệu `patient-satisfaction-survey-contract.md`.
2. **Lệnh kiểm chứng bắt buộc:**
   - Chạy kiểm thử riêng cụm bảo mật báo cáo:
     `mvn test -Dtest=ReportsSecurityIntegrationTest` $\rightarrow$ Kết quả mong đợi: **26/26 PASSED**.
   - Chạy toàn bộ test suites khảo sát & liên quan:
     `mvn test "-Dtest=PatientSatisfactionSurveyTest,DomainExceptionRegistryContractTest,SubmitSatisfactionSurveyServiceTest,UpdateSatisfactionSurveyServiceTest,GetPatientSatisfactionSurveyServiceTest,GetSatisfactionReportServiceTest,PatientPortalSatisfactionSurveyControllerTest,ReportsControllerTest,ReportsSecurityIntegrationTest,SatisfactionSurveyRepositoryAdapterIntegrationTest"` $\rightarrow$ Kết quả mong đợi: **100% PASSED**.
3. **Tiêu chí chuyển trạng thái sang "FIXED":**
   - Không còn bất kỳ lỗi context load nào liên quan đến `GetSatisfactionReportUseCase`.
   - Tất cả 8 findings (1 P1, 3 P2, 4 P3) đều có code/test/tài liệu tương ứng giải quyết triệt để.
   - Trạng thái review chuyển từ **REQUEST CHANGES** sang **APPROVED**.

