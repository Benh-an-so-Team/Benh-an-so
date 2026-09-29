const DEFAULT_MESSAGE = 'Thao tác không thành công. Vui lòng thử lại.'

export const DOMAIN_ERROR_MESSAGES = {
  ACCOUNT_DISABLED: 'Tài khoản người dùng đã bị vô hiệu hóa trong hệ thống.',
  ACCOUNT_LOCKED: 'Tài khoản đã bị tạm khóa do nhập sai mật khẩu nhiều lần.',
  INVALID_CREDENTIALS: 'Tên đăng nhập hoặc mật khẩu không chính xác. Vui lòng kiểm tra lại.',
  TOKEN_INVALID: 'Phiên làm việc hoặc mã xác thực không hợp lệ. Vui lòng đăng nhập lại.',
  SESSION_EXPIRED: 'Phiên làm việc của bạn đã hết hạn. Vui lòng đăng nhập lại để tiếp tục.',
  TEMP_PASSWORD_EXPIRED: 'Mật khẩu tạm thời đã hết hạn. Vui lòng liên hệ Quản trị viên để được cấp lại.',
  TOO_MANY_LOGIN_ATTEMPTS: 'Bạn đã thử đăng nhập thất bại quá số lần quy định. Vui lòng thử lại sau ít phút.',
  LAST_ADMINISTRATOR_PERMISSION: 'Không thể xóa hoặc tước quyền của Quản trị viên hệ thống cuối cùng.',
  USER_ALREADY_EXISTS: 'Tên tài khoản người dùng đã tồn tại trên hệ thống.',
  USER_NOT_FOUND: 'Không tìm thấy thông tin người dùng trong hệ thống.',
  EMAIL_ALREADY_EXISTS: 'Địa chỉ email này đã được sử dụng cho một tài khoản khác.',
  PHONE_ALREADY_EXISTS: 'Số điện thoại này đã được sử dụng cho một tài khoản khác.',
  ROLE_NOT_FOUND: 'Không tìm thấy vai trò phân quyền người dùng trong hệ thống.',

  APPOINTMENT_ALREADY_CANCELLED: 'Lịch hẹn khám này đã bị hủy trước đó.',
  APPOINTMENT_ALREADY_COMPLETED: 'Lịch hẹn này đã hoàn tất quá trình khám bệnh.',
  APPOINTMENT_ALREADY_IN_PROGRESS: 'Lịch hẹn này hiện đang trong quá trình khám bệnh.',
  APPOINTMENT_INVALID_STATUS: 'Trạng thái lịch hẹn không hợp lệ để thực hiện thao tác này.',
  APPOINTMENT_NOT_FOUND: 'Không tìm thấy thông tin lịch hẹn trong hệ thống.',
  APPOINTMENT_NOT_OVERDUE: 'Lịch hẹn chưa đến thời gian quá hạn.',
  APPOINTMENT_PAST_CUTOFF: 'Đã quá thời hạn cho phép điều chỉnh lịch hẹn này.',
  APPOINTMENT_TIME_CONFLICT: 'Khung giờ này đã bị trùng lịch với một lịch hẹn khác của bác sĩ hoặc bệnh nhân.',
  APPOINTMENT_TIME_IN_PAST: 'Không thể đặt lịch hẹn ở thời điểm trong quá khứ.',
  CHECK_IN_CONFLICT: 'Bệnh nhân này đã được tiếp đón vào hàng đợi của lượt khám.',
  QUEUE_ITEM_INVALID_STATUS: 'Trạng thái lượt khám trong hàng đợi không hợp lệ để xử lý.',
  QUEUE_ITEM_NOT_FOUND: 'Không tìm thấy lượt khám trong hàng đợi phòng khám.',
  QUEUE_NOT_FOUND: 'Không tìm thấy danh sách hàng đợi của phòng khám.',
  UNAUTHORIZED_APPOINTMENT_OPERATION: 'Bạn không có quyền thực hiện thao tác trên lịch hẹn này.',
  UNAUTHORIZED_QUEUE_OPERATION: 'Bạn không có quyền thao tác trên hàng đợi của phòng khám này.',

  PATIENT_ALREADY_EXISTS: 'Thông tin bệnh nhân (Mã định danh/CCCD) đã tồn tại trên hệ thống.',
  PATIENT_INACTIVE: 'Hồ sơ bệnh nhân hiện đang tạm ngưng hoạt động.',
  PATIENT_NOT_FOUND: 'Không tìm thấy thông tin bệnh nhân trong hệ thống.',
  PATIENT_CONSENT_ACCESS_DENIED: 'Bệnh nhân chưa cấp quyền truy cập dữ liệu y tế.',
  PATIENT_CONSENT_REQUIRED: 'Yêu cầu có xác nhận đồng ý của người bệnh trước khi xử lý.',
  VISIT_ALREADY_CANCELLED: 'Lượt khám này đã bị hủy trước đó.',
  VISIT_ALREADY_COMPLETED: 'Lượt khám này đã hoàn tất toàn bộ quy trình, không thể thay đổi.',
  VISIT_ENCOUNTER_ACCESS_DENIED: 'Chỉ Bác sĩ được phân công phụ trách phòng khám mới có quyền khám cho lượt khám này.',
  VISIT_INVALID_STATUS: 'Trạng thái lượt khám không hợp lệ để thực hiện thao tác này.',
  VISIT_NOT_FOUND: 'Không tìm thấy thông tin lượt khám trong hệ thống.',

  DOCTOR_INACTIVE: 'Bác sĩ hiện đang tạm ngưng hoạt động trong hệ thống.',
  DOCTOR_NOT_FOUND: 'Không tìm thấy thông tin bác sĩ trong hệ thống.',
  DOCTOR_ROOM_ASSIGNMENT_CONFLICT: 'Bác sĩ đã được phân công vào một phòng khám khác trong cùng ca trực.',
  DOCTOR_NOT_ASSIGNED_TO_ROOM: 'Bác sĩ chưa được phân công vào phòng khám này.',
  DOCTOR_SCHEDULE_UNAVAILABLE: 'Lịch trực của bác sĩ hiện không khả dụng.',
  DOCTOR_NOT_WORKING: 'Bác sĩ không có lịch làm việc trong ngày này.',
  DOCTOR_TIMEOFF_CONFLICT: 'Khoảng thời gian nghỉ trùng lặp với khoảng nghỉ đã đăng ký trước đó của bác sĩ.',
  DOCTOR_TIMEOFF_NOT_FOUND: 'Không tìm thấy thông tin khoảng nghỉ của bác sĩ.',
  INVALID_DOCTOR_ROLE: 'Tài khoản không có chứng chỉ hành nghề hoặc vai trò Bác sĩ hợp lệ.',
  ROOM_CODE_ALREADY_EXISTS: 'Mã phòng khám đã tồn tại trong danh mục cơ sở vật chất.',
  ROOM_NOT_FOUND: 'Không tìm thấy thông tin phòng khám trong hệ thống.',
  SPECIALTY_NOT_FOUND: 'Không tìm thấy thông tin chuyên khoa trong hệ thống.',
  SPECIALTY_NAME_ALREADY_EXISTS: 'Tên chuyên khoa đã tồn tại trong danh mục hệ thống.',
  SPECIALTY_CODE_ALREADY_EXISTS: 'Mã chuyên khoa đã tồn tại trong danh mục hệ thống.',
  SPECIALTY_IN_USE: 'Chuyên khoa đang được gán cho bác sĩ hoặc mẫu bệnh án đang hoạt động. Cần xác nhận trước khi ngừng dùng.',
  CANNOT_DEACTIVATE_DEFAULT_SPECIALTY: 'Không thể ngừng dùng chuyên khoa mặc định hệ thống (GENERAL).',

  MEDICAL_RECORD_ALREADY_EXISTS_FOR_VISIT:
    'Lượt khám này đã có hồ sơ bệnh án được tạo trong hệ thống. Hệ thống sẽ tự động cập nhật vào hồ sơ hiện có thay vì tạo mới.',
  MEDICAL_RECORD_MISSING_DIAGNOSIS:
    'Bệnh án chưa có chẩn đoán. Vui lòng ghi nhận chẩn đoán ICD-10 trước khi ký xác nhận.',
  MEDICAL_RECORD_UNAUTHORIZED_SIGNER:
    'Chỉ bác sĩ phụ trách lượt khám mới có quyền ký xác nhận bệnh án này.',
  MEDICAL_RECORD_LOCKED:
    'Hồ sơ bệnh án đã được ký hoặc khóa, không thể chỉnh sửa trực tiếp.',
  MEDICAL_RECORD_ALREADY_LOCKED:
    'Hồ sơ bệnh án đã được ký hoặc khóa, không thể chỉnh sửa trực tiếp.',
  MEDICAL_RECORD_NOT_LOCKED:
    'Hồ sơ bệnh án phải ở trạng thái ĐÃ KÝ hoặc ĐÃ KHÓA mới có thể lập bản đính chính.',
  MEDICAL_RECORD_NOT_SIGNED:
    'Bệnh án chưa được ký xác nhận. Vui lòng ký bệnh án trước khi hoàn tất hoặc khóa.',
  MEDICAL_RECORD_INVALID_STATUS:
    'Trạng thái hồ sơ bệnh án không hợp lệ để thực hiện thao tác này.',
  MEDICAL_RECORD_INVALID_VISIT:
    'Lượt khám không ở trạng thái hợp lệ để ký hoặc xử lý hồ sơ bệnh án.',
  MEDICAL_RECORD_NOT_FOUND:
    'Không tìm thấy thông tin hồ sơ bệnh án trong hệ thống.',
  MEDICAL_RECORD_ACCESS_DENIED:
    'Bạn không có quyền truy cập hoặc chỉnh sửa hồ sơ bệnh án này.',
  MEDICAL_RECORD_AMENDMENT_REQUIRES_COMPLETED_VISIT:
    'Hồ sơ bệnh án chỉ có thể lập bản đính chính sau khi ca khám đã hoàn tất (COMPLETED).',
  MEDICAL_RECORD_IN_RETENTION_PERIOD:
    'Hồ sơ đang trong thời hạn lưu trữ bắt buộc, không thể xóa. Vui lòng dùng chức năng lưu trữ (Archive) nếu cần ẩn hồ sơ khỏi danh sách hoạt động.',
  MEDICAL_RECORD_MISSING_AUTHORIZATION:
    'Chưa có giấy ủy quyền hợp lệ để thực hiện sao lục hoặc trích xuất hồ sơ bệnh án.',
  MEDICAL_RECORD_UNAUTHORIZED_RECIPIENT:
    'Người nhận không đủ điều kiện pháp lý để nhận bản sao hồ sơ bệnh án.',

  MEDICAL_RECORD_TEMPLATE_CHANGE_WITH_CONTENT:
    'Bệnh án đã có nội dung khám, không thể đổi sang mẫu khác để bảo toàn dữ liệu. Vui lòng tiếp tục với mẫu hiện tại.',
  MEDICAL_RECORD_TEMPLATE_SPECIALTY_MISMATCH:
    'Mẫu bệnh án được chọn không khớp với chuyên khoa của lượt khám.',
  MEDICAL_RECORD_TEMPLATE_INACTIVE:
    'Mẫu bệnh án này hiện đang tạm ngưng hoạt động.',
  MEDICAL_RECORD_TEMPLATE_NOT_FOUND:
    'Không tìm thấy mẫu bệnh án trong hệ thống.',
  MEDICAL_RECORD_TEMPLATE_DEFAULT_NOT_CONFIGURED:
    'Chuyên khoa chưa được cấu hình mẫu bệnh án mặc định hợp lệ.',
  MEDICAL_RECORD_TEMPLATE_DEFAULT_REPLACEMENT_REQUIRED:
    'Cần chỉ định mẫu bệnh án mặc định thay thế trước khi gỡ bỏ mẫu hiện tại.',
  MEDICAL_RECORD_TEMPLATE_NAME_DUPLICATE:
    'Tên mẫu bệnh án đã tồn tại trong chuyên khoa này.',
  MEDICAL_RECORD_TEMPLATE_LAST_ACTIVE:
    'Đây là mẫu bệnh án đang hoạt động duy nhất của chuyên khoa, không thể vô hiệu hóa.',
  MEDICAL_RECORD_TEMPLATE_INVALID_REPLACEMENT:
    'Mẫu bệnh án thay thế không hợp lệ.',

  DIAGNOSIS_CATALOG_CODE_ALREADY_EXISTS:
    'Mã bệnh ICD-10 đã tồn tại trong danh mục hệ thống.',
  DIAGNOSIS_CATALOG_CODE_EXISTS:
    'Mã bệnh ICD-10 đã tồn tại trong danh mục hệ thống.',
  DIAGNOSIS_CATALOG_NAME_ALREADY_EXISTS:
    'Tên bệnh ICD-10 đã tồn tại trong danh mục hệ thống.',
  DIAGNOSIS_CATALOG_NOT_FOUND:
    'Không tìm thấy mã bệnh ICD-10 trong danh mục hệ thống.',
  DIAGNOSIS_CATALOG_IN_USE:
    'Mã bệnh ICD-10 này đang được sử dụng trong các hồ sơ bệnh án, không thể xóa.',
  DIAGNOSIS_CATALOG_DELETE_NOT_ALLOWED:
    'Không được phép xóa mã chẩn đoán ICD-10 chuẩn của hệ thống.',

  INSUFFICIENT_STOCK:
    'Không đủ số lượng thuốc tồn kho để thực hiện xuất cấp đơn thuốc.',
  INTERACTION_CONFIRMATION_REQUIRED:
    'Đơn thuốc phát hiện tương tác thuốc cần lưu ý. Bác sĩ vui lòng xác nhận lý do chuyên môn trước khi lưu.',
  DRUG_INTERACTION_ALREADY_EXISTS:
    'Cặp tương tác thuốc này đã được thiết lập trong cơ sở dữ liệu.',
  DRUG_INTERACTION_NOT_FOUND:
    'Không tìm thấy thông tin tương tác thuốc trong hệ thống.',
  SELF_DRUG_INTERACTION:
    'Không thể kê trùng lặp cùng một loại thuốc nhiều lần trong một đơn.',
  MEDICINE_CODE_ALREADY_EXISTS:
    'Mã thuốc đã tồn tại trong danh mục dược.',
  MEDICINE_INACTIVE:
    'Loại thuốc này hiện đang tạm ngưng sử dụng trong bệnh viện.',
  MEDICINE_NOT_FOUND:
    'Không tìm thấy thông tin thuốc trong danh mục dược.',
  PRESCRIPTION_ALREADY_CANCELLED:
    'Đơn thuốc này đã bị hủy trước đó.',
  PRESCRIPTION_ALREADY_DISPENSED:
    'Đơn thuốc đã được xuất cấp phát tại quầy dược, không thể chỉnh sửa hoặc hủy.',
  PRESCRIPTION_CLINICAL_CONTEXT_CONFLICT:
    'Bối cảnh lâm sàng của bệnh án không khớp với đơn thuốc chỉ định.',
  PRESCRIPTION_INVALID_STATUS:
    'Trạng thái đơn thuốc không hợp lệ để thực hiện thao tác này.',
  PRESCRIPTION_ITEM_NOT_FOUND:
    'Không tìm thấy thuốc này trong đơn thuốc chỉ định.',
  PRESCRIPTION_NO_CHANGES:
    'Nội dung đơn thuốc không có thay đổi nào so với bản đã lưu.',
  PRESCRIPTION_NOT_FOUND:
    'Không tìm thấy thông tin đơn thuốc trong hệ thống.',
  PRESCRIPTION_NOT_PRINTABLE:
    'Đơn thuốc chưa đủ điều kiện pháp lý để in ấn (cần lưu và ký trước).',
  UNAUTHORIZED_PRESCRIPTION_AMENDMENT:
    'Chỉ Bác sĩ kê đơn hoặc Bác sĩ phụ trách mới có quyền điều chỉnh đơn thuốc.',
  UNAUTHORIZED_PRESCRIPTION_REPLACEMENT:
    'Chỉ Bác sĩ trực tiếp kê đơn gốc mới có quyền phát hành đơn thuốc thay thế.',

  CLINICAL_ORDER_ALREADY_CANCELLED:
    'Phiếu chỉ định cận lâm sàng này đã bị hủy trước đó.',
  CLINICAL_ORDER_ALREADY_COMPLETED:
    'Phiếu chỉ định cận lâm sàng đã có kết quả hoàn tất, không thể chỉnh sửa.',
  CLINICAL_ORDER_INVALID_STATUS:
    'Trạng thái phiếu chỉ định cận lâm sàng không hợp lệ để xử lý.',
  CLINICAL_ORDER_INVALID_VISIT:
    'Lượt khám không hợp lệ để lập phiếu chỉ định cận lâm sàng.',
  CLINICAL_ORDER_ITEM_INVALID_STATUS:
    'Trạng thái dịch vụ chỉ định không hợp lệ để cập nhật.',
  CLINICAL_ORDER_ITEM_NOT_FOUND:
    'Không tìm thấy dịch vụ chỉ định trong phiếu cận lâm sàng.',
  CLINICAL_ORDER_LOCKED_MEDICAL_RECORD:
    'Bệnh án đã bị khóa nội dung, không thể tạo thêm hoặc sửa phiếu chỉ định.',
  CLINICAL_RESULT_ALREADY_FINALIZED:
    'Kết quả xét nghiệm/chẩn đoán hình ảnh đã được phê duyệt, không thể chỉnh sửa.',
  CLINICAL_RESULT_INVALID_STATUS:
    'Trạng thái kết quả cận lâm sàng không hợp lệ để thao tác.',
  CLINICAL_RESULT_NOT_FOUND:
    'Không tìm thấy kết quả cận lâm sàng trong hệ thống.',
  CLINICAL_ATTACHMENT_NOT_FOUND:
    'Không tìm thấy tệp đính kèm kết quả cận lâm sàng.',
  CLINICAL_SERVICE_UNAVAILABLE:
    'Dịch vụ cận lâm sàng này hiện đang tạm ngưng phục vụ.',
  SERVICE_CATALOG_NOT_FOUND:
    'Không tìm thấy thông tin dịch vụ kỹ thuật trong danh mục.',

  INVOICE_ALREADY_ISSUED:
    'Lượt khám này đã được lập hóa đơn thanh toán trước đó.',
  INVOICE_NOT_FOUND:
    'Không tìm thấy thông tin hóa đơn thanh toán trong hệ thống.',
  INVOICE_UNAUTHORIZED_ADJUSTMENT:
    'Bạn không có quyền điều chỉnh hóa đơn viện phí đã phát hành.',
  PAYMENT_ALREADY_EXISTS:
    'Giao dịch thanh toán cho lượt khám này đã được ghi nhận trước đó.',
  PAYMENT_AMOUNT_MISMATCH:
    'Số tiền thanh toán không khớp với tổng tiền trên hóa đơn viện phí.',
  PAYMENT_NOT_ALLOWED:
    'Trạng thái hóa đơn không cho phép thực hiện thanh toán.',
  PAYMENT_NOT_FOUND:
    'Không tìm thấy thông tin giao dịch thanh toán trong hệ thống.',
  PAYMENT_REQUIRED_FOR_INVOICE:
    'Lượt khám có hóa đơn viện phí chưa hoàn tất thanh toán.',

  BACKUP_EXECUTION_FAILED: 'Thực thi sao lưu dữ liệu hệ thống thất bại.',
  BACKUP_NOT_FOUND: 'Không tìm thấy bản sao lưu hệ thống yêu cầu.',
  INVALID_BACKUP_STATUS: 'Trạng thái bản sao lưu không hợp lệ.',
  CARE_LOG_NOT_FOUND: 'Không tìm thấy nhật ký chăm sóc người bệnh.',
  FOLLOW_UP_REMINDER_INVALID_STATUS: 'Trạng thái nhắc hẹn tái khám không hợp lệ.',
  FOLLOW_UP_REMINDER_NOT_FOUND: 'Không tìm thấy thông tin nhắc hẹn tái khám.',
  PORTAL_LOOKUP_NOT_FOUND: 'Không tìm thấy dữ liệu tra cứu trên cổng thông tin bệnh nhân.',
  REPORT_DATA_EMPTY: 'Không có dữ liệu báo cáo thống kê trong khoảng thời gian đã chọn.',
  REQUEST_TIMEOUT: 'Hệ thống đang bận hoặc phản hồi chậm. Vui lòng thử lại sau ít giây.',
  VALIDATION_FAILED: 'Dữ liệu nhập vào chưa hợp lệ hoặc thiếu thông tin bắt buộc. Vui lòng kiểm tra lại.',

  NO_UNSETTLED_PAYMENTS: 'Ca hiện tại chưa có khoản thu nào để thực hiện chốt ca.',
  CASHIER_SHIFT_NOTE_REQUIRED: 'Số tiền thực tế có chênh lệch so với hệ thống, bắt buộc phải nhập ghi chú giải trình.',
  CASHIER_SHIFT_SELF_CONFIRMATION_NOT_ALLOWED: 'Thu ngân không được phép tự duyệt phiếu chốt ca của chính mình.',
  PAYMENT_ALREADY_SETTLED: 'Khoản thu này đã nằm trong ca đã chốt, không thể chỉnh sửa hoặc hoàn tiền.',
  CASHIER_SHIFT_ALREADY_CONFIRMED: 'Phiếu chốt ca này đã được xác nhận trước đó.',
  CASHIER_SHIFT_NOT_FOUND: 'Không tìm thấy thông tin phiếu chốt ca.',
}

export const translateApiErrorMessage = (rawMessage) => {
  if (!rawMessage || typeof rawMessage !== 'string') return DEFAULT_MESSAGE
  const trimmed = rawMessage.trim()
  if (!trimmed) return DEFAULT_MESSAGE

  if (/timeout/i.test(trimmed) || /ECONNABORTED/i.test(trimmed)) {
    return 'Hệ thống đang bận hoặc quá thời gian chờ phản hồi. Vui lòng thử lại sau ít giây.'
  }

  if (/Network Error/i.test(trimmed) || /Failed to fetch/i.test(trimmed)) {
    return 'Lỗi kết nối mạng đến máy chủ. Vui lòng kiểm tra lại đường truyền internet.'
  }

  const statusMatch = trimmed.match(/status code (\d{3})/i)
  if (statusMatch) {
    const statusCode = statusMatch[1]
    const statusMessages = {
      '400': 'Dữ liệu gửi lên chưa hợp lệ hoặc thiếu thông tin bắt buộc.',
      '401': 'Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại.',
      '403': 'Bạn không có quyền thực hiện thao tác này.',
      '404': 'Không tìm thấy dữ liệu yêu cầu trên hệ thống.',
      '409': 'Dữ liệu bị trùng lặp hoặc xung đột với trạng thái hiện tại.',
      '500': 'Lỗi hệ thống máy chủ nội bộ. Vui lòng thử lại sau ít phút.',
      '502': 'Cổng kết nối máy chủ tạm thời gián đoạn. Vui lòng thử lại sau.',
      '503': 'Dịch vụ tạm thời không khả dụng. Vui lòng thử lại sau ít phút.',
      '504': 'Máy chủ phản hồi quá hạn. Vui lòng thử lại sau ít giây.',
    }
    if (statusMessages[statusCode]) {
      return statusMessages[statusCode]
    }
  }

  const recordExistsMatch = trimmed.match(/Medical record already exists for visit:\s*([a-f0-9-]+)/i)
  if (recordExistsMatch) {
    return 'Lượt khám này đã có hồ sơ bệnh án được tạo trong hệ thống. Vui lòng tiếp tục cập nhật hồ sơ hiện tại thay vì tạo mới.'
  }

  const invoiceExistsMatch = trimmed.match(/An invoice already exists for visit:\s*([a-f0-9-]+)/i)
  if (invoiceExistsMatch) {
    return 'Lượt khám này đã được lập hóa đơn thanh toán trước đó.'
  }

  const paymentExistsMatch = trimmed.match(/A payment already exists for visit:\s*([a-f0-9-]+)/i)
  if (paymentExistsMatch) {
    return 'Lượt khám này đã được ghi nhận thanh toán trước đó.'
  }

  const missingDiagMatch = trimmed.match(/Medical record requires at least one diagnosis before signing:\s*(.*)/i)
  if (missingDiagMatch) {
    return 'Bệnh án chưa có chẩn đoán. Vui lòng ghi nhận chẩn đoán ICD-10 trước khi ký xác nhận.'
  }

  const missingSectionMatch = trimmed.match(/Required template section is missing:\s*([A-Za-z0-9_]+)/i)
  if (missingSectionMatch) {
    const fieldCode = missingSectionMatch[1].toUpperCase()
    const sectionNames = {
      CHIEF_COMPLAINT: 'Lý do khám bệnh / Triệu chứng chính',
      SYMPTOMS: 'Triệu chứng bệnh',
      MEDICAL_HISTORY: 'Tiền sử bệnh',
      PHYSICAL_EXAMINATION: 'Khám lâm sàng / Thể lực',
      CLINICAL_PROGRESS: 'Diễn tiến lâm sàng',
      TREATMENT_PLAN: 'Kế hoạch điều trị',
      DOCTOR_INSTRUCTIONS: 'Lời dặn của bác sĩ',
      CONCLUSION: 'Kết luận / Chẩn đoán',
    }
    const vietnameseName = sectionNames[fieldCode] || fieldCode
    return `Mục bắt buộc trong mẫu bệnh án chưa có nội dung: ${vietnameseName} (${fieldCode}). Vui lòng bổ sung trước khi ký.`
  }

  const doctorRoomMatch = trimmed.match(/Doctor is not assigned to room:\s*(.*)/i)
  if (doctorRoomMatch) {
    return 'Bác sĩ chưa được phân công vào phòng khám này.'
  }

  if (/User is not doctor in charge/i.test(trimmed) || /Signature rejected/i.test(trimmed)) {
    return 'Chỉ Bác sĩ phụ trách lượt khám mới có quyền ký xác nhận hồ sơ bệnh án này.'
  }

  const EXACT_TRANSLATIONS = {
    'Medical record must be signed before locking':
      'Hồ sơ bệnh án bắt buộc phải được ký xác nhận trước khi khóa.',
    'Medical record not found':
      'Không tìm thấy thông tin hồ sơ bệnh án trong hệ thống.',
    'Medical record already locked':
      'Hồ sơ bệnh án đã được ký hoặc khóa trước đó.',
    'Medical record is already locked':
      'Hồ sơ bệnh án đã được ký hoặc khóa trước đó.',
    'Medical record not signed':
      'Bệnh án chưa được ký xác nhận. Vui lòng ký số trước khi hoàn tất hoặc khóa.',
    'Cannot modify signed medical record':
      'Hồ sơ bệnh án đã ký không thể chỉnh sửa nội dung trực tiếp.',
    'Finished visits cannot be updated.':
      'Lượt khám đã kết thúc, không thể chỉnh sửa.',
    'Finished visits cannot be updated':
      'Lượt khám đã kết thúc, không thể chỉnh sửa.',
    'Finished visits cannot be cancelled.':
      'Lượt khám đã kết thúc, không thể hủy.',
    'Finished visits cannot be cancelled':
      'Lượt khám đã kết thúc, không thể hủy.',
    'Invalid visit status transition.':
      'Chuyển trạng thái lượt khám không hợp lệ.',
    'Invalid visit status transition':
      'Chuyển trạng thái lượt khám không hợp lệ.',
    'Medical record requires an active visit':
      'Bệnh án yêu cầu lượt khám đang hoạt động để thực hiện thao tác này.',
    'Chief complaint is required before locking medical record.':
      'Vui lòng nhập lý do khám / triệu chứng chính trước khi ký khóa bệnh án.',
    'Conclusion is required before locking medical record.':
      'Vui lòng nhập kết luận khám / chẩn đoán trước khi ký khóa bệnh án.',
    'Primary diagnosis is required.':
      'Chẩn đoán chính ICD-10 là bắt buộc.',
    'Diagnosis catalog is required.':
      'Vui lòng chọn chẩn đoán từ danh mục ICD-10 chuẩn.',
    'Only WAITING_FOR_RESULT, IN_PROGRESS, or CANCELLED are supported updates.':
      'Chỉ hỗ trợ cập nhật trạng thái Chờ kết quả, Đang khám hoặc Đã hủy.',
    'You cannot deactivate your own account.':
      'Bạn không thể tự vô hiệu hóa tài khoản của chính mình.',
    'Queue date is required.':
      'Ngày của hàng đợi khám là bắt buộc.',
    'Queue date is required':
      'Ngày của hàng đợi khám là bắt buộc.',
    'Service catalog id is required.':
      'Mã danh mục dịch vụ là bắt buộc.',
    'Service catalog id is required':
      'Mã danh mục dịch vụ là bắt buộc.',
    'Service name already exists.':
      'Tên dịch vụ kỹ thuật đã tồn tại trong danh mục.',
    'Service code already exists.':
      'Mã dịch vụ kỹ thuật đã tồn tại trong danh mục.',
    'Service name is required.':
      'Tên dịch vụ kỹ thuật là bắt buộc.',
    'Patient id is required.':
      'Mã bệnh nhân là bắt buộc.',
    'Medical record id is required.':
      'Mã hồ sơ bệnh án là bắt buộc.',
    'Medicine id is required.':
      'Mã thuốc là bắt buộc.',
    'Drug id is required.':
      'Mã dược chất là bắt buộc.',
    'Prescription status is required.':
      'Trạng thái đơn thuốc là bắt buộc.',
    'Prescription code is required before interconnection.':
      'Cần có mã đơn thuốc điện tử hợp lệ trước khi gửi liên thông quốc gia.',
    'Cancelled prescriptions cannot be sent for interconnection.':
      'Đơn thuốc đã hủy không thể gửi liên thông quốc gia.',
    'Only failed prescription interconnections can be retried.':
      'Chỉ có thể gửi lại đối với các đơn thuốc liên thông thất bại.',
    'Prescription details are required for printing.':
      'Cần có thông tin chi tiết đơn thuốc để thực hiện in ấn.',
    'Access is denied':
      'Bạn không có quyền thực hiện thao tác này.',
    'Access denied':
      'Bạn không có quyền thực hiện thao tác này.',
    'Unauthorized':
      'Phiên làm việc đã hết hạn hoặc không có quyền truy cập.',
    'Forbidden':
      'Bạn không có quyền truy cập tài nguyên này.',
    'Internal Server Error':
      'Lỗi hệ thống máy chủ nội bộ. Vui lòng thử lại sau ít phút.',
    'Network Error':
      'Lỗi kết nối mạng đến máy chủ. Vui lòng kiểm tra lại đường truyền internet.',
    'Insufficient stock.':
      'Không đủ số lượng thuốc tồn kho để thực hiện cấp phát.',
    'Validation failed.':
      'Dữ liệu gửi lên chưa hợp lệ hoặc thiếu thông tin bắt buộc. Vui lòng kiểm tra lại.',
    'Bad credentials':
      'Tên đăng nhập hoặc mật khẩu không chính xác. Vui lòng thử lại.',
  }

  if (EXACT_TRANSLATIONS[trimmed]) {
    return EXACT_TRANSLATIONS[trimmed]
  }

  const hasVietnamese = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(trimmed)
  if (hasVietnamese) {
    return trimmed
  }

  return trimmed
}

export const normalizeApiError = (error, fallbackMessage = DEFAULT_MESSAGE) => {
  const response = error?.response
  const body = response?.data
  const responseMessage = typeof body === 'string' ? body : body?.message
  const details = body && typeof body.details === 'object' && !Array.isArray(body.details)
    ? body.details
    : {}
  const fields = details.fields && typeof details.fields === 'object' ? details.fields : {}

  const isTimeout =
    error?.code === 'ECONNABORTED' ||
    (typeof error?.message === 'string' && error.message.toLowerCase().includes('timeout'))

  const rawMessage = isTimeout
    ? 'Hệ thống đang bận hoặc phản hồi chậm. Dữ liệu đang được đồng bộ.'
    : (responseMessage || error?.message || fallbackMessage)

  return {
    status: body?.status || response?.status || 0,
    code: body?.code || (isTimeout ? 'REQUEST_TIMEOUT' : 'NETWORK_ERROR'),
    message: rawMessage,
    details,
    fields,
    firstFieldError: Object.values(fields)[0] || null,
  }
}

export const getApiErrorMessage = (error, fallbackMessage = DEFAULT_MESSAGE) => {
  const normalized = normalizeApiError(error, fallbackMessage)
  if (normalized.firstFieldError) {
    return normalized.firstFieldError
  }
  if (normalized.code && DOMAIN_ERROR_MESSAGES[normalized.code]) {
    return DOMAIN_ERROR_MESSAGES[normalized.code]
  }
  const rawMsg = normalized.message || fallbackMessage
  return translateApiErrorMessage(rawMsg)
}

export const isAccessDeniedApiError = (error) => {
  if (!error) return false
  const status = error?.status || error?.response?.status || error?.apiError?.status
  const code = error?.code || error?.response?.data?.code || error?.apiError?.code
  return status === 403 || code === 'ACCESS_DENIED'
}
