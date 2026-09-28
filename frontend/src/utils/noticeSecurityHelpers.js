/**
 * noticeSecurityHelpers.js
 * Tiện ích bảo mật, lọc dữ liệu cá nhân y tế và chuẩn hóa thông điệp cho hệ thống thông báo.
 */

// Danh sách các từ khóa lỗi kỹ thuật thô cần lọc bỏ
const TECHNICAL_ERROR_PATTERNS = [
  /java\.lang\.[A-Za-z0-9_]+/i,
  /org\.springframework\.[A-Za-z0-9_]+/i,
  /org\.hibernate\.[A-Za-z0-9_]+/i,
  /com\.benhsoan\.[A-Za-z0-9_]+/i,
  /SQLException|SQLSyntaxErrorException|DataIntegrityViolationException/i,
  /ConstraintViolationException|NullPointerException|BadSqlGrammarException/i,
  /foreign key constraint|Duplicate entry|cannot be null|syntax error at or near/i,
  /tbl_[a-z0-9_]+/i,
  /SELECT .+ FROM|INSERT INTO|UPDATE .+ SET|DELETE FROM/i,
  /at [a-zA-Z0-9_$.]+\([A-Za-z0-9_]+.java:\d+\)/i, // Stack trace line
  /HTTP\s*(500|502|503|504)\b/i,
  /AxiosError|Network Error|ERR_CONNECTION_REFUSED/i,
]

// Nhận diện mã bệnh nhân / mã hồ sơ hợp lệ (BN-..., BA-..., LK-..., DT-...)
const VALID_CODE_PATTERN = /\b(BN|BA|LK|DT|HD|CD|CLS|HS|XL)-\d{4,}[A-Za-z0-9-]*\b/g

/**
 * Tạo mã tham chiếu ngắn gọn cho lỗi để Quản trị viên tiện tra cứu
 * Ví dụ: ERR-7F3A
 */
export function generateReferenceCode(prefix = 'ERR') {
  const chars = '0123456789ABCDEFGHJKLMNPQRSTUVWXYZ'
  let code = ''
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return `${prefix}-${code}`
}

/**
 * Kiểm tra xem chuỗi có chứa lỗi kỹ thuật thô hay không
 */
export function hasTechnicalError(text) {
  if (!text || typeof text !== 'string') return false
  return TECHNICAL_ERROR_PATTERNS.some((pattern) => pattern.test(text))
}

/**
 * Làm sạch và lọc bỏ thông tin nhạy cảm (tên đầy đủ bệnh nhân, chẩn đoán chi tiết),
 * đồng thời loại bỏ lỗi kỹ thuật thô, chuyển sang tiếng Việt thân thiện.
 */
export function sanitizeNoticeMessage(message, options = {}) {
  if (!message || typeof message !== 'string') {
    return 'Thao tác không thể hoàn tất. Vui lòng thử lại sau.'
  }

  let text = message.trim()

  // 1. Kiểm tra nếu chứa lỗi kỹ thuật thô (SQL, stack trace, class Java)
  if (hasTechnicalError(text)) {
    const refCode = options.referenceCode || generateReferenceCode('ERR')
    return `Đã xảy ra lỗi xử lý trên hệ thống. Vui lòng thử lại sau ít phút hoặc liên hệ Quản trị viên. [Mã tham chiếu: ${refCode}]`
  }

  // 2. Bảo vệ dữ liệu cá nhân bệnh nhân:
  // Nếu có cụm "Bệnh nhân [Họ Tên]" (3-4 từ viết hoa tiếng Việt), thay bằng mã bệnh nhân nếu có hoặc ẩn tên
  // Tránh hiển thị tên đầy đủ tại quầy tiếp đón nơi người khác có thể thấy màn hình
  const patientNameRegex = /(?:bệnh nhân|người bệnh|bn|patient)\s*[:：\-]?\s*([A-ZÀ-Ỹ][a-zà-ỹ]+(?:\s+[A-ZÀ-Ỹ][a-zà-ỹ]+){1,3})/gi
  text = text.replace(patientNameRegex, (match, name) => {
    // Tìm xem trong chuỗi có mã BN kèm theo không
    const codes = text.match(VALID_CODE_PATTERN)
    if (codes && codes.length > 0) {
      return `Bệnh nhân (${codes[0]})`
    }
    return 'Bệnh nhân'
  })

  // 3. Ẩn số CMND/CCCD nếu xuất hiện trong thông báo góc (12 số)
  text = text.replace(/\b\d{9}\b|\b\d{12}\b/g, (id) => `${id.slice(0, 3)}***${id.slice(-3)}`)

  // 4. Nếu chuỗi quá dài (vượt quá 180 ký tự), cắt tỉa gọn gàng kèm dấu "..."
  if (text.length > 180) {
    text = text.slice(0, 177).trim() + '...'
  }

  return text
}

/**
 * Chuẩn hóa tiêu đề thông báo
 */
export function sanitizeNoticeTitle(title, fallback = 'Thông báo hệ thống') {
  if (!title || typeof title !== 'string') return fallback
  const trimmed = title.trim()
  if (hasTechnicalError(trimmed)) {
    return 'Lỗi hệ thống'
  }
  return trimmed.slice(0, 80)
}

/**
 * Xử lý thông báo từ chối truy cập (403 / Access Denied)
 * Phân biệt cổng Bệnh nhân (thông điệp trung lập, không tiết lộ dữ liệu tồn tại)
 * và giao diện nội bộ phòng khám (ngắn gọn, thân thiện).
 */
export function resolveAccessDeniedNotice(isPatientPortal = false) {
  if (isPatientPortal) {
    return {
      title: 'Yêu cầu không khả dụng',
      message: 'Không tìm thấy nội dung yêu cầu hoặc thông tin chưa được kích hoạt.',
      role: 'alert',
    }
  }
  return {
    title: 'Từ chối truy cập',
    message: 'Bạn không có quyền thực hiện thao tác này. Vui lòng liên hệ Quản lý nếu cần hỗ trợ.',
    role: 'alert',
  }
}

/**
 * Định dạng tóm tắt lỗi nhập liệu biểu mẫu:
 * Chỉ hiển thị 1 dòng tóm tắt ở góc dưới phải ("Có N trường cần chỉnh sửa")
 */
export function formatValidationSummary(errorCount = 1) {
  const count = Math.max(1, Number(errorCount) || 1)
  return `Có ${count} trường thông tin cần chỉnh sửa. Vui lòng kiểm tra lại biểu mẫu.`
}

/**
 * Định dạng tóm tắt lỗi tệp bảng tính (Excel import):
 * Danh sách dòng lỗi hiển thị trong trang, thông báo góc chỉ tóm tắt số lượng.
 */
export function formatExcelValidationSummary(errorRowsCount = 1) {
  const count = Math.max(1, Number(errorRowsCount) || 1)
  return `Tệp dữ liệu tải lên có ${count} dòng chưa hợp lệ. Vui lòng kiểm tra danh sách chi tiết bên dưới.`
}
