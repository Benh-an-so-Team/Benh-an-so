/**
 * Dữ liệu mô phỏng cho tính năng Sao lưu tự động theo lịch & Kiểm tra bản sao lưu
 * Ghi chú: Dữ liệu phục vụ kiểm thử và hiển thị trực quan trong môi trường phát triển/thử nghiệm.
 */

export const SAMPLE_BACKUP_SCHEDULE = {
  id: 'a0000000-0000-0000-0000-000000000001',
  enabled: true,
  dailyTime: '23:00',
  cronExpression: '0 0 23 * * *',
  lastRunAt: '2026-09-26T23:00:00Z',
  lastStatus: 'SUCCESS',
  lastFailureReason: null,
  alertActive: false,
  lastVerifiedAt: '2026-09-27T08:15:00Z',
  lastVerificationStatus: 'VALID',
  updatedBy: 'u0000000-0000-0000-0000-000000000001',
  updatedAt: '2026-09-26T14:30:00Z',
}

export const SAMPLE_FAILED_SCHEDULE_ALERT = {
  id: 'a0000000-0000-0000-0000-000000000001',
  enabled: true,
  dailyTime: '23:00',
  cronExpression: '0 0 23 * * *',
  lastRunAt: '2026-09-26T23:00:15Z',
  lastStatus: 'FAILED',
  lastFailureReason: 'Lỗi ghi đĩa: Dung lượng phân vùng lưu trữ sao lưu còn dưới 500MB hoặc tiến trình trích xuất bảng medical_records bị timeout sau 60 giây.',
  alertActive: true,
  lastVerifiedAt: '2026-09-25T08:00:00Z',
  lastVerificationStatus: 'VALID',
  updatedBy: 'u0000000-0000-0000-0000-000000000001',
  updatedAt: '2026-09-26T14:30:00Z',
}

export const SAMPLE_BACKUP_HISTORY = [
  {
    id: 'b1111111-1111-1111-1111-111111111111',
    backupCode: 'BKP-20260926-230001',
    fileName: 'backup_clinic_20260926_230001.json',
    fileSize: 18454937, // ~17.60 MB
    status: 'SUCCESS',
    executionType: 'SCHEDULED',
    backupType: 'FULL',
    description: 'Sao lưu tự động theo lịch hệ thống hàng ngày lúc 23:00',
    createdBy: null, // Hệ thống tự động
    createdAt: '2026-09-26T23:00:00Z',
    completedAt: '2026-09-26T23:02:18Z',
    failureReason: null,
  },
  {
    id: 'b2222222-2222-2222-2222-222222222222',
    backupCode: 'BKP-20260925-230001',
    fileName: 'backup_clinic_20260925_230001.json',
    fileSize: 0,
    status: 'FAILED',
    executionType: 'SCHEDULED',
    backupType: 'FULL',
    description: 'Sao lưu tự động theo lịch hệ thống hàng ngày lúc 23:00',
    createdBy: null,
    createdAt: '2026-09-25T23:00:00Z',
    completedAt: '2026-09-25T23:00:45Z',
    failureReason: 'Lỗi kết nối cơ sở dữ liệu: Database connection pool bị quá tải, không thể khởi tạo transaction cô lập để snapshot dữ liệu.',
  },
  {
    id: 'b3333333-3333-3333-3333-333333333333',
    backupCode: 'BKP-20260925-143000',
    fileName: 'backup_clinic_20260925_143000.json',
    fileSize: 18290176, // ~17.44 MB
    status: 'SUCCESS',
    executionType: 'MANUAL',
    backupType: 'FULL',
    description: 'Sao lưu thủ công do Quản trị viên kích hoạt trước khi nâng cấp',
    createdBy: 'u0000000-0000-0000-0000-000000000001',
    createdAt: '2026-09-25T14:30:00Z',
    completedAt: '2026-09-25T14:31:55Z',
    failureReason: null,
  },
  {
    id: 'b4444444-4444-4444-4444-444444444444',
    backupCode: 'BKP-20260924-230001',
    fileName: 'backup_clinic_20260924_230001.json',
    fileSize: 18129408, // ~17.29 MB
    status: 'SUCCESS',
    executionType: 'SCHEDULED',
    backupType: 'FULL',
    description: 'Sao lưu tự động theo lịch hệ thống hàng ngày lúc 23:00',
    createdBy: null,
    createdAt: '2026-09-24T23:00:00Z',
    completedAt: '2026-09-24T23:02:10Z',
    failureReason: null,
  },
  {
    id: 'b5555555-5555-5555-5555-555555555555',
    backupCode: 'BKP-20260923-230001',
    fileName: 'backup_clinic_20260923_230001.json',
    fileSize: 17825792, // ~17.00 MB
    status: 'SUCCESS',
    executionType: 'SCHEDULED',
    backupType: 'FULL',
    description: 'Sao lưu tự động theo lịch hệ thống hàng ngày lúc 23:00',
    createdBy: null,
    createdAt: '2026-09-23T23:00:00Z',
    completedAt: '2026-09-23T23:02:05Z',
    failureReason: null,
  },
  {
    id: 'b6666666-6666-6666-6666-666666666666',
    backupCode: 'BKP-20260922-230001',
    fileName: 'backup_clinic_20260922_230001.json',
    fileSize: 0,
    status: 'FAILED',
    executionType: 'SCHEDULED',
    backupType: 'FULL',
    description: 'Sao lưu tự động theo lịch hệ thống hàng ngày lúc 23:00',
    createdBy: null,
    createdAt: '2026-09-22T23:00:00Z',
    completedAt: '2026-09-22T23:01:12Z',
    failureReason: 'Hết dung lượng lưu trữ trên thư mục đệm /tmp/backup_spool.',
  },
]


export const SAMPLE_VERIFICATION_SUCCESS = {
  backupId: 'b1111111-1111-1111-1111-111111111111',
  backupCode: 'BKP-20260926-230001',
  fileName: 'backup_clinic_20260926_230001.json',
  valid: true,
  readable: true,
  dataIntact: true,
  tableCount: 28,
  rowCount: 1845,
  schemaVersion: '90',
  verifiedAt: '2026-09-27T08:15:00Z',
  message: 'Bản sao lưu đọc được và đầy đủ dữ liệu.',
  issues: [],
}

export const SAMPLE_VERIFICATION_FAILED = {
  backupId: 'b2222222-2222-2222-2222-222222222222',
  backupCode: 'BKP-20260925-230001',
  fileName: 'backup_clinic_20260925_230001.json',
  valid: false,
  readable: false,
  dataIntact: false,
  tableCount: 0,
  rowCount: 0,
  schemaVersion: '90',
  verifiedAt: '2026-09-27T08:20:00Z',
  message: 'Phát hiện 2 lỗi nghiêm trọng trong tệp sao lưu: Không thể đọc định dạng JSON và thiếu toàn bộ cấu trúc bảng.',
  issues: [
    'Tệp sao lưu bị rỗng (0 bytes) do tiến trình trước đó bị gián đoạn giữa chừng.',
    'Không tìm thấy danh sách 28 bảng dữ liệu cốt lõi của hệ thống.',
  ],
}
