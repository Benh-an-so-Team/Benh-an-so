# Patient Satisfaction Survey API Contract

> Epic: **NCL-10 - Báo cáo, thống kê và khảo sát**
>
> User Story: **NCL-10-CN-005 - Khảo sát hài lòng sau khám**
>
> Base URLs:
> - Cổng bệnh nhân: `/patient-portal/satisfaction-surveys`
> - Báo cáo quản lý: `/reports/satisfaction`
>
> Auth: Bearer Token (JWT)
>
> Phân quyền & Quy tắc liên quan: `ROLE_PATIENT` (`QTN-23`), `REPORT_VIEW` (`ROLE_MANAGER`, `ROLE_ADMIN`)
>
> Trạng thái: **Triển khai hoàn tất Backend**

---

## 1. Phạm vi & Mục tiêu Nghiệp vụ

Tài liệu này đặc tả API contract cho tính năng khảo sát mức độ hài lòng của người bệnh sau khi hoàn thành lượt khám bệnh (`NCL-10-CN-005`), bao gồm cả cổng tương tác trực tiếp của bệnh nhân và phân hệ báo cáo tổng hợp dành cho cấp quản lý phòng khám.

### 1.1 Mục tiêu nghiệp vụ
- **Gửi khảo sát (TC-01):** Bệnh nhân có thể đánh giá mức độ hài lòng (thang điểm từ 1 đến 5 sao) và để lại ý kiến đóng góp/nhận xét (tối đa 1000 ký tự) cho lượt khám đã hoàn tất.
- **Chống gửi trùng lặp & hỗ trợ cập nhật (TC-02):** Mỗi lượt khám (`visit_id`) chỉ cho phép tồn tại duy nhất 1 bản ghi khảo sát (`UNIQUE CONSTRAINT`). Khi bệnh nhân đã gửi đánh giá trước đó, hệ thống từ chối tạo mới với HTTP 409 Conflict (`SATISFACTION_SURVEY_ALREADY_EXISTS`) và cho phép cập nhật lại điểm số / nhận xét của khảo sát cũ.
- **Báo cáo tổng hợp hài lòng (TC-03):** Quản trị viên và Quản lý phòng khám (`ROLE_ADMIN`, `ROLE_MANAGER`) có thể tra cứu báo cáo tổng hợp mức độ hài lòng theo khoảng thời gian tùy chọn và lọc theo từng bác sĩ. Báo cáo thể hiện tổng số lượt khảo sát, điểm trung bình toàn phòng khám, biểu đồ phân bố điểm (1 đến 5 sao) và chi tiết số lượng / điểm trung bình của từng bác sĩ.
- **Bảo mật dữ liệu y tế cá nhân (QTN-23):** Bệnh nhân chỉ được quyền tạo, tra cứu và chỉnh sửa khảo sát thuộc về lượt khám và hồ sơ bệnh nhân của chính mình. Mọi hành vi truy cập chéo sẽ bị chặn với HTTP 403 Forbidden và ghi log kiểm toán bảo mật.

---

## 2. Phân quyền & Kiểm soát Truy cập (Roles & Permissions)

| Endpoint | Role bắt buộc | Quyền hạn (Permission) | Data Scoping & Ghi chú |
| :--- | :--- | :--- | :--- |
| `POST /patient-portal/satisfaction-surveys` | `ROLE_PATIENT` | Tự động qua Role Portal | Chỉ gửi khảo sát cho lượt khám thuộc sở hữu của bệnh nhân (`QTN-23`). Lượt khám phải ở trạng thái đã hoàn tất (`COMPLETED`). |
| `PUT /patient-portal/satisfaction-surveys/{id}` | `ROLE_PATIENT` | Tự động qua Role Portal | Chỉ sửa khảo sát do chính bệnh nhân đó tạo (`QTN-23`). |
| `GET /patient-portal/satisfaction-surveys/by-visit/{visitId}` | `ROLE_PATIENT` | Tự động qua Role Portal | Chỉ xem khảo sát thuộc lượt khám của chính bệnh nhân (`QTN-23`). |
| `GET /reports/satisfaction` | `ROLE_MANAGER`, `ROLE_ADMIN` | `REPORT_VIEW` | Xem dữ liệu thống kê tổng hợp toàn phòng khám hoặc theo bác sĩ. |

---

## 3. Danh sách Endpoints

### 3.1. Cổng bệnh nhân: Gửi khảo sát hài lòng sau khám

- **URL**: `POST /patient-portal/satisfaction-surveys`
- **Mô tả**: Bệnh nhân gửi biểu mẫu khảo sát hài lòng cho một lượt khám đã kết thúc.
- **Tiêu chuẩn kiểm thử**: `TC-01`, `TC-02`
- **Header**:
  - `Authorization: Bearer <patient_jwt_token>`
  - `Content-Type: application/json`

#### Request Body
```json
{
  "visitId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "score": 5,
  "comment": "Bác sĩ tư vấn rất tận tâm, dịch vụ phòng khám chu đáo."
}
```

| Trường dữ liệu | Kiểu | Bắt buộc | Ràng buộc validation | Mô tả |
| :--- | :--- | :--- | :--- | :--- |
| `visitId` | UUID | Có | Hợp lệ, tồn tại | ID lượt khám bệnh nhân đã khám |
| `score` | Integer | Có | `1 <= score <= 5` | Điểm hài lòng từ 1 đến 5 sao |
| `comment` | String | Không | Tối đa 1000 ký tự | Nhận xét hoặc ý kiến đóng góp |

#### Phản hồi thành công: `201 Created`
```json
{
  "id": "7b1c4e92-628d-4f1b-a95e-18d34e622b10",
  "visitId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "patientId": "e0b512e2-9b55-4a61-8e0f-90e633d289ab",
  "doctorId": "d2a3c4b5-1234-4567-89ab-cdef01234567",
  "score": 5,
  "comment": "Bác sĩ tư vấn rất tận tâm, dịch vụ phòng khám chu đáo.",
  "createdAt": "2026-09-25T14:00:00Z",
  "updatedAt": "2026-09-25T14:00:00Z"
}
```

#### Phản hồi lỗi
- `400 Bad Request`:
  - `score` nằm ngoài khoảng 1 - 5: `{"message": "Điểm đánh giá phải từ 1 đến 5"}`.
  - `comment` vượt quá 1000 ký tự: `{"message": "Nhận xét không được vượt quá 1000 ký tự"}`.
- `403 Forbidden` (`QTN-23`): Người dùng đang đăng nhập không phải là chủ sở hữu lượt khám `visitId`.
- `404 Not Found`: Lượt khám không tồn tại trong hệ thống.
- `409 Conflict`:
  - Lượt khám đã có bản ghi khảo sát trước đó (`TC-02`):
  ```json
  {
    "code": "SATISFACTION_SURVEY_ALREADY_EXISTS",
    "message": "Lượt khám này đã được gửi khảo sát hài lòng."
  }
  ```
  - Lượt khám chưa hoàn thành (`VISIT_INVALID_STATUS`):
  ```json
  {
    "code": "VISIT_INVALID_STATUS",
    "message": "Only completed visits can be surveyed."
  }
  ```

---

### 3.2. Cổng bệnh nhân: Cập nhật khảo sát hài lòng

- **URL**: `PUT /patient-portal/satisfaction-surveys/{id}`
- **Mô tả**: Bệnh nhân chỉnh sửa lại điểm đánh giá hoặc nhận xét của khảo sát đã gửi trước đó (theo giải pháp xử lý trùng `TC-02`).
- **Tiêu chuẩn kiểm thử**: `TC-02`
- **Header**:
  - `Authorization: Bearer <patient_jwt_token>`
  - `Content-Type: application/json`

#### Request Body
```json
{
  "score": 4,
  "comment": "Cập nhật lại nhận xét: Bác sĩ rất tốt, thời gian chờ lấy thuốc hơi lâu một chút."
}
```

| Trường dữ liệu | Kiểu | Bắt buộc | Ràng buộc validation | Mô tả |
| :--- | :--- | :--- | :--- | :--- |
| `score` | Integer | Có | `1 <= score <= 5` | Điểm hài lòng cập nhật mới |
| `comment` | String | Không | Tối đa 1000 ký tự | Nhận xét cập nhật mới |

#### Phản hồi thành công: `200 OK`
```json
{
  "id": "7b1c4e92-628d-4f1b-a95e-18d34e622b10",
  "visitId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "patientId": "e0b512e2-9b55-4a61-8e0f-90e633d289ab",
  "doctorId": "d2a3c4b5-1234-4567-89ab-cdef01234567",
  "score": 4,
  "comment": "Cập nhật lại nhận xét: Bác sĩ rất tốt, thời gian chờ lấy thuốc hơi lâu một chút.",
  "createdAt": "2026-09-25T14:00:00Z",
  "updatedAt": "2026-09-25T14:15:00Z"
}
```

#### Phản hồi lỗi
- `400 Bad Request`: `score` không hợp lệ hoặc `comment` quá dài.
- `403 Forbidden` (`QTN-23`): Khảo sát không thuộc sở hữu của bệnh nhân đang đăng nhập.
- `404 Not Found`: Khảo sát không tồn tại (`SATISFACTION_SURVEY_NOT_FOUND`).

---

### 3.3. Cổng bệnh nhân: Tra cứu khảo sát theo lượt khám

- **URL**: `GET /patient-portal/satisfaction-surveys/by-visit/{visitId}`
- **Mô tả**: Bệnh nhân kiểm tra xem lượt khám cụ thể đã được đánh giá hay chưa để hiển thị trạng thái hoặc nút sửa trên UI.
- **Tiêu chuẩn kiểm thử**: `TC-01`, `TC-02`
- **Header**:
  - `Authorization: Bearer <patient_jwt_token>`

#### Phản hồi thành công: `200 OK`
```json
{
  "id": "7b1c4e92-628d-4f1b-a95e-18d34e622b10",
  "visitId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "patientId": "e0b512e2-9b55-4a61-8e0f-90e633d289ab",
  "doctorId": "d2a3c4b5-1234-4567-89ab-cdef01234567",
  "score": 5,
  "comment": "Bác sĩ tư vấn rất tận tâm, dịch vụ phòng khám chu đáo.",
  "createdAt": "2026-09-25T14:00:00Z",
  "updatedAt": "2026-09-25T14:00:00Z"
}
```

#### Phản hồi khi chưa khảo sát
- `404 Not Found`: Lượt khám chưa có đánh giá nào (`SATISFACTION_SURVEY_NOT_FOUND`). UI cổng bệnh nhân có thể dựa vào mã này để hiển thị nút "Gửi khảo sát".

---

### 3.4. Cổng bệnh nhân: Tra cứu chi tiết khảo sát theo ID

- **URL**: `GET /patient-portal/satisfaction-surveys/{id}`
- **Mô tả**: Bệnh nhân tra cứu chi tiết một bản ghi khảo sát theo ID khảo sát.
- **Tiêu chuẩn kiểm thử**: `TC-01`, `TC-02`
- **Header**:
  - `Authorization: Bearer <patient_jwt_token>`

#### Phản hồi thành công: `200 OK`
```json
{
  "id": "7b1c4e92-628d-4f1b-a95e-18d34e622b10",
  "visitId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "patientId": "e0b512e2-9b55-4a61-8e0f-90e633d289ab",
  "doctorId": "d2a3c4b5-1234-4567-89ab-cdef01234567",
  "score": 5,
  "comment": "Bác sĩ tư vấn rất tận tâm, dịch vụ phòng khám chu đáo.",
  "createdAt": "2026-09-25T14:00:00Z",
  "updatedAt": "2026-09-25T14:00:00Z"
}
```

#### Phản hồi lỗi
- `403 Forbidden` (`QTN-23`): Khảo sát không thuộc sở hữu của bệnh nhân đang đăng nhập.
- `404 Not Found`: Khảo sát không tồn tại (`SATISFACTION_SURVEY_NOT_FOUND`).

---

### 3.5. Báo cáo quản lý: Báo cáo tổng hợp mức độ hài lòng

- **URL**: `GET /reports/satisfaction`
- **Mô tả**: Thống kê điểm số trung bình, tỷ lệ phân bố điểm và hiệu suất hài lòng theo từng bác sĩ trong kỳ báo cáo (TC-03).
- **Quyền hạn bắt buộc**: `REPORT_VIEW` (Thuộc các vai trò `ROLE_MANAGER`, `ROLE_ADMIN`).
- **Header**:
  - `Authorization: Bearer <staff_jwt_token>`

#### Tham số truy vấn (Query Parameters)
| Tham số | Kiểu | Bắt buộc | Mặc định | Mô tả |
| :--- | :--- | :--- | :--- | :--- |
| `from` | LocalDate (`yyyy-MM-dd`) | Có | Không | Ngày bắt đầu kỳ báo cáo (Asia/Ho_Chi_Minh) |
| `to` | LocalDate (`yyyy-MM-dd`) | Có | Không | Ngày kết thúc kỳ báo cáo (Asia/Ho_Chi_Minh) |
| `doctorId` | UUID | Không | null (toàn bộ) | Lọc riêng cho một bác sĩ cụ thể |

#### Phản hồi thành công: `200 OK`
```json
{
  "from": "2026-09-01",
  "to": "2026-09-25",
  "generatedAt": "2026-09-25T14:30:00Z",
  "totalSurveys": 150,
  "averageScore": 4.7,
  "scoreDistribution": {
    "1": 2,
    "2": 3,
    "3": 10,
    "4": 35,
    "5": 100
  },
  "doctors": [
    {
      "doctorId": "d2a3c4b5-1234-4567-89ab-cdef01234567",
      "doctorUsername": "dr.anh",
      "doctorName": "BS. Nguyễn Văn A",
      "totalSurveys": 50,
      "averageScore": 4.8
    },
    {
      "doctorId": "e5f6a7b8-2345-6789-01bc-def012345678",
      "doctorUsername": "dr.binh",
      "doctorName": "BS. Trần Thị B",
      "totalSurveys": 40,
      "averageScore": 4.5
    }
  ]
}
```

#### Phản hồi lỗi
- `400 Bad Request`: Thiếu tham số bắt buộc `from` hoặc `to`, hoặc định dạng ngày không hợp lệ.
- `401 Unauthorized`: Chưa truyền JWT Token hoặc token hết hạn.
- `403 Forbidden`: Tài khoản không có quyền `REPORT_VIEW`.
