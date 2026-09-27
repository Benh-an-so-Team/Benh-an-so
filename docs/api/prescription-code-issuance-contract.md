# Prescription Code Issuance API Contract

> Module: **NCL-12 — Đơn thuốc điện tử và liên thông quốc gia**
>
> User Story: **NCL-12-CN-002 — Cấp mã đơn thuốc điện tử**
>
> Base URL: `http://localhost:8080/api/v1`
>
> Auth: Bearer Token (JWT)

## Scope

Tài liệu này quy định ý nghĩa và vòng đời của hai trường response:

- `prescriptionCode`: mã định danh duy nhất của đơn thuốc điện tử.
- `prescribedAt`: thời điểm backend cấp mã đơn thuốc.

Không có endpoint cấp mã riêng. Backend cấp mã trong lần tạo đơn thành công đầu
tiên và lưu đơn ở trạng thái `PENDING_DISPENSE`.

## Endpoints

| Method | Path | Quy tắc mã đơn |
|---|---|---|
| `POST` | `/prescriptions` | Cấp mã lần đầu; trả `201 Created`. |
| `PATCH` | `/prescriptions/{id}` | Giữ nguyên mã và thời điểm cấp mã. |
| `POST` | `/prescriptions/{id}/replacement` | Cấp **mã mới** cho đơn thay thế; đơn gốc giữ nguyên mã cũ. |
| `GET` | `/prescriptions/{id}` | Trả mã và thời điểm cấp mã đã lưu. |
| `GET` | `/prescriptions/medical-records/{medicalRecordId}` | Trả các mã và thời điểm tương ứng. |
| `GET` | `/prescriptions?status={status}` | Trả các mã và thời điểm tương ứng. |

## `POST /prescriptions`

Chỉ bác sĩ được phép tạo đơn trong ngữ cảnh bệnh án/lượt khám hợp lệ. Khi dữ
liệu thuốc thỏa NCL-12-CN-001, backend lấy số kế tiếp từ sequence `RX`, sinh
mã dạng `RX` cộng tối thiểu sáu chữ số, rồi trả mã cùng thời điểm cấp.

Ví dụ response `201 Created`:

```json
{
  "id": "16200000-0000-0000-0000-000000000007",
  "prescriptionCode": "RX000007",
  "medicalRecordId": "e0000000-0000-0000-0000-000000000001",
  "status": "PENDING_DISPENSE",
  "prescribedBy": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2",
  "prescribedAt": "2026-08-20T02:55:00Z",
  "updatedBy": null,
  "updatedAt": null,
  "items": [],
  "warnings": []
}
```

## Immutability Contract

`prescriptionCode` và `prescribedAt` là trường do server quản lý:

- Client không gửi hai trường này trong request tạo hoặc sửa đơn.
- `PATCH /prescriptions/{id}` chỉ cho phép thay đổi nội dung đơn khi đơn còn
  `PENDING_DISPENSE`; response vẫn trả chính mã và `prescribedAt` ban đầu.
- Hủy hoặc cấp phát đơn không làm thay đổi mã hay thời điểm cấp mã.
- Đơn đã liên thông không sửa nội dung tại chỗ (QTN-42). Khi cần sửa, backend cấp
  một mã mới cho đơn thay thế và đơn gốc giữ nguyên mã cũ ở trạng thái `REPLACED`
  (NCL-12-CN-008). Mã đơn không bao giờ được dùng lại cho hai đơn khác nhau.
- Database áp dụng unique constraint cho `prescriptionCode`; mã không được
  dùng cho hai đơn khác nhau.

Ví dụ sau khi sửa đơn thành công, response vẫn giữ nguyên định danh:

```json
{
  "id": "16200000-0000-0000-0000-000000000007",
  "prescriptionCode": "RX000007",
  "prescribedAt": "2026-08-20T02:55:00Z",
  "updatedAt": "2026-08-20T03:10:00Z"
}
```

## Audit

Mỗi lần cấp mã thành công tạo audit log kiểu `CREATE` cho resource
`PRESCRIPTION`. Audit detail chứa `prescriptionCode`; `createdAt` của audit log
cùng thời điểm với `prescribedAt` để truy vết nhất quán.
