/**
 * Helpers & Specifications for Document Print Templates Configuration (NCL-09-CN-008).
 * Quản trị viên cấu hình mẫu in chứng từ: Hóa đơn, Đơn thuốc, Phiếu khám.
 */

export const DOCUMENT_TYPES = {
  INVOICE: 'INVOICE',
  PRESCRIPTION: 'PRESCRIPTION',
  VISIT_SUMMARY: 'VISIT_SUMMARY',
}

export const DOCUMENT_TYPE_LABELS = {
  [DOCUMENT_TYPES.INVOICE]: 'Hóa đơn',
  [DOCUMENT_TYPES.PRESCRIPTION]: 'Đơn thuốc',
  [DOCUMENT_TYPES.VISIT_SUMMARY]: 'Phiếu khám',
}

export const MAX_LOGO_SIZE_BYTES = 2 * 1024 * 1024 // 2MB
export const ALLOWED_LOGO_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml']

/**
 * Validate logo file before upload or preview
 * @param {File} file
 * @returns {{ isValid: boolean, error?: string }}
 */
export const validateLogoFile = (file) => {
  if (!file) {
    return { isValid: false, error: 'Vui lòng chọn tệp ảnh logo.' }
  }

  const fileType = file.type?.toLowerCase() || ''
  const fileName = file.name?.toLowerCase() || ''
  const isValidType =
    ALLOWED_LOGO_TYPES.includes(fileType) ||
    fileName.endsWith('.png') ||
    fileName.endsWith('.jpg') ||
    fileName.endsWith('.jpeg') ||
    fileName.endsWith('.webp') ||
    fileName.endsWith('.svg')

  if (!isValidType) {
    return {
      isValid: false,
      error: 'Định dạng ảnh không hợp lệ. Chỉ chấp nhận định dạng PNG, JPG, JPEG, WEBP hoặc SVG.',
    }
  }

  if (file.size > MAX_LOGO_SIZE_BYTES) {
    const sizeInMb = (file.size / (1024 * 1024)).toFixed(1)
    return {
      isValid: false,
      error: `Dung lượng ảnh (${sizeInMb}MB) vượt quá giới hạn tối đa cho phép (2MB).`,
    }
  }

  return { isValid: true }
}

/**
 * Field visibility definitions per document type
 */
export const DOCUMENT_FIELDS = {
  [DOCUMENT_TYPES.PRESCRIPTION]: [
    { key: 'showDoctorSignature', label: 'Chữ ký bác sĩ điều trị', description: 'Hiển thị vùng ký tên và họ tên bác sĩ kê đơn' },
    { key: 'showDiagnosis', label: 'Chẩn đoán bệnh (ICD-10)', description: 'Hiển thị mã ICD-10 và tên chẩn đoán xác định' },
    { key: 'showPatientPhone', label: 'Số điện thoại bệnh nhân', description: 'Hiển thị số điện thoại liên lạc của người bệnh' },
    { key: 'showPatientAge', label: 'Tuổi / Năm sinh bệnh nhân', description: 'Hiển thị số tuổi hoặc ngày tháng năm sinh của bệnh nhân' },
    { key: 'showUsageInstructions', label: 'Cách dùng chi tiết thuốc', description: 'Hiển thị liều dùng, số lần uống, thời điểm uống thuốc' },
    { key: 'showDoctorAdvice', label: 'Lời dặn dò của bác sĩ', description: 'Hiển thị chế độ ăn uống, vận động và lưu ý khi dùng thuốc' },
    { key: 'showBarcode', label: 'Mã vạch đơn thuốc (Barcode)', description: 'In mã vạch tương ứng mã đơn thuốc ở đầu trang' },
    { key: 'showQrCode', label: 'Mã QR tra cứu trực tuyến', description: 'Mã QR quét để tra cứu đơn thuốc điện tử trên cổng bệnh nhân' },
  ],

  [DOCUMENT_TYPES.INVOICE]: [
    { key: 'showCashierSignature', label: 'Chữ ký thu ngân / người lập', description: 'Hiển thị vị trí ký của nhân viên thu ngân' },
    { key: 'showPatientPhone', label: 'Số điện thoại bệnh nhân', description: 'Hiển thị số điện thoại của người thanh toán' },
    { key: 'showPaymentMethod', label: 'Phương thức thanh toán', description: 'Hiển thị hình thức: Tiền mặt, Chuyển khoản hoặc Thẻ' },
    { key: 'showDiscount', label: 'Chiết khấu / Giảm giá', description: 'Hiển thị dòng chiết khấu, miễn giảm viện phí (nếu có)' },
    { key: 'showTaxInfo', label: 'Mã số thuế & Pháp lý', description: 'Hiển thị mã số thuế của phòng khám trên hóa đơn' },
    { key: 'showBarcode', label: 'Mã vạch hóa đơn (Barcode)', description: 'In mã vạch số hóa đơn để quét nhanh' },
    { key: 'showQrCode', label: 'Mã QR thanh toán / tra cứu', description: 'Mã QR chuyển khoản VietQR hoặc tra cứu hóa đơn điện tử' },
  ],

  [DOCUMENT_TYPES.VISIT_SUMMARY]: [
    { key: 'showDoctorSignature', label: 'Chữ ký bác sĩ khám', description: 'Hiển thị vị trí ký và họ tên bác sĩ phụ trách khám' },
    { key: 'showDiagnosis', label: 'Chẩn đoán sơ bộ & xác định', description: 'Hiển thị chẩn đoán bệnh chính và các bệnh kèm theo' },
    { key: 'showClinicalOrders', label: 'Chỉ định cận lâm sàng', description: 'Danh sách các xét nghiệm, siêu âm, X-quang đã thực hiện' },
    { key: 'showRevisitDate', label: 'Lịch hẹn tái khám', description: 'Hiển thị ngày hẹn quay lại kiểm tra sức khỏe' },
    { key: 'showVitalSigns', label: 'Chỉ số sinh hiệu', description: 'Hiển thị huyết áp, mạch, nhiệt độ, nhịp thở, SpO2' },
    { key: 'showTreatmentPlan', label: 'Hướng điều trị & theo dõi', description: 'Hiển thị tóm tắt phác đồ điều trị và cách tự theo dõi' },
    { key: 'showBarcode', label: 'Mã vạch phiếu khám (Barcode)', description: 'In mã vạch số hồ sơ hoặc mã lượt khám' },
    { key: 'showQrCode', label: 'Mã QR hồ sơ sức khỏe', description: 'Mã QR quét để mở tóm tắt khám trên cổng bệnh nhân' },
  ],
}

/**
 * Parse fieldVisibility JSON string into a boolean map.
 * @param {string|Object} rawJson
 * @param {string} documentType
 * @returns {Record<string, boolean>}
 */
export const parseFieldVisibility = (rawJson, documentType) => {
  const fields = DOCUMENT_FIELDS[documentType] || []
  const result = {}

  // Set default values (all default to true)
  fields.forEach((f) => {
    result[f.key] = true
  })

  if (!rawJson) return result

  let parsed = {}
  if (typeof rawJson === 'object') {
    parsed = rawJson
  } else {
    try {
      parsed = JSON.parse(rawJson)
    } catch {
      return result
    }
  }

  fields.forEach((f) => {
    if (typeof parsed[f.key] === 'boolean') {
      result[f.key] = parsed[f.key]
    }
  })

  return result
}

/**
 * Serialize field visibility map into clean JSON string
 * @param {Record<string, boolean>} map
 * @returns {string}
 */
export const serializeFieldVisibility = (map = {}) => {
  return JSON.stringify(map)
}

/**
 * Build default template values pre-populated from basic clinic configuration
 * @param {string} documentType
 * @param {Object} clinicConfig
 * @returns {Object}
 */
export const buildDefaultTemplateValues = (documentType, clinicConfig = {}) => {
  const clinicName = clinicConfig.clinicName || 'PHÒNG KHÁM ĐA KHOA QUỐC TẾ'
  const address = clinicConfig.address || 'Số 123 Đường Y Dược, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh'
  const phone = clinicConfig.phone || '028 3822 1234'
  const opening = clinicConfig.openingTime || '07:30'
  const closing = clinicConfig.closingTime || '17:30'

  const defaultLegal = `Tên cơ sở: ${clinicName}\nĐịa chỉ: ${address}\nĐiện thoại: ${phone} | Giờ làm việc: ${opening} - ${closing}\nGiấy phép hoạt động: 01234/SYT-GPHĐ | MST: 0101234567`

  switch (documentType) {
    case DOCUMENT_TYPES.PRESCRIPTION:
      return {
        documentType: DOCUMENT_TYPES.PRESCRIPTION,
        templateName: 'Mẫu đơn thuốc chuẩn',
        title: 'ĐƠN THUỐC',
        logoUrl: '',
        showLogo: true,
        legalInfo: defaultLegal,
        footerText: 'Đơn thuốc có giá trị mua trong vòng 05 ngày kể từ ngày kê. Tái khám xin mang theo đơn này.',
        fieldVisibility: parseFieldVisibility('{"showDoctorSignature":true,"showDiagnosis":true,"showPatientPhone":true}', DOCUMENT_TYPES.PRESCRIPTION),
      }

    case DOCUMENT_TYPES.INVOICE:
      return {
        documentType: DOCUMENT_TYPES.INVOICE,
        templateName: 'Mẫu hóa đơn thu tiền chuẩn',
        title: 'HÓA ĐƠN THU TIỀN KHÁM CHỮA BỆNH',
        logoUrl: '',
        showLogo: true,
        legalInfo: defaultLegal,
        footerText: 'Cảm ơn Quý khách đã tin tưởng và sử dụng dịch vụ tại phòng khám. Chúc Quý khách nhiều sức khỏe!',
        fieldVisibility: parseFieldVisibility('{"showCashierSignature":true,"showPaymentMethod":true,"showPatientPhone":true}', DOCUMENT_TYPES.INVOICE),
      }

    case DOCUMENT_TYPES.VISIT_SUMMARY:
    default:
      return {
        documentType: DOCUMENT_TYPES.VISIT_SUMMARY,
        templateName: 'Mẫu phiếu tóm tắt lượt khám chuẩn',
        title: 'PHIẾU TỔNG KẾT LƯỢT KHÁM',
        logoUrl: '',
        showLogo: true,
        legalInfo: defaultLegal,
        footerText: 'Phiếu tóm tắt lượt khám dùng để theo dõi quá trình điều trị ngoại trú và tái khám.',
        fieldVisibility: parseFieldVisibility('{"showDoctorSignature":true,"showDiagnosis":true,"showRevisitDate":true,"showClinicalOrders":true}', DOCUMENT_TYPES.VISIT_SUMMARY),
      }
  }
}

/**
 * Sample mock data for realistic live preview
 */
export const SAMPLE_DATA = {
  patient: {
    code: 'BN-2026-0089',
    name: 'Nguyễn Văn An',
    gender: 'Nam',
    age: '38 tuổi',
    dob: '15/06/1988',
    phone: '0912 345 678',
    address: 'Quận 3, TP. Hồ Chí Minh',
    diagnosis: 'K29.7 - Viêm dạ dày không đặc hiệu / Trào ngược dạ dày thực quản (GERD)',
    doctorName: 'BS. CKII. Trần Minh Tuấn',
    cashierName: 'Thu ngân Lê Thị Thảo',
    visitDate: '29/09/2026 08:30',
    revisitDate: '06/10/2026 (Sau 7 ngày)',
    vitalSigns: 'Mạch: 76 l/p | Huyết áp: 120/80 mmHg | Nhiệt độ: 36.8°C | SpO2: 98%',
    treatmentPlan: 'Uống thuốc đúng giờ trước bữa ăn 30 phút. Tránh đồ cay nóng, cà phê, rượu bia. Tái khám sau khi hết thuốc.',
  },

  prescriptionMedicines: [
    { stt: 1, name: 'Nexium 40mg (Esomeprazole)', quantity: '14 viên', usage: 'Uống 1 viên/lần, ngày 1 lần vào buổi sáng trước ăn 30 phút' },
    { stt: 2, name: 'Gaviscon Dual Action', quantity: '20 gói', usage: 'Uống 1 gói sau bữa ăn và trước khi đi ngủ' },
    { stt: 3, name: 'Motilium-M 10mg (Domperidone)', quantity: '20 viên', usage: 'Uống 1 viên/lần, ngày 2 lần trước ăn 15 phút' },
  ],

  invoiceItems: [
    { stt: 1, serviceName: 'Khám bệnh chuyên khoa Nội tiêu hóa', unit: 'Lượt', qty: 1, price: 150000, amount: 150000 },
    { stt: 2, serviceName: 'Nội soi dạ dày tá tràng không đau', unit: 'Lần', qty: 1, price: 950000, amount: 950000 },
    { stt: 3, serviceName: 'Thuốc theo đơn điều trị (Nexium, Gaviscon...)', unit: 'Đơn', qty: 1, price: 420000, amount: 420000 },
  ],

  clinicalOrders: [
    { stt: 1, name: 'Nội soi thực quản - dạ dày - tá tràng', result: 'Viêm xung huyết hang vị mức độ vừa' },
    { stt: 2, name: 'Test vi khuẩn Helicobacter pylori (Urease)', result: 'Âm tính (-)' },
    { stt: 3, name: 'Siêu âm màu tổng quát ổ bụng', result: 'Chưa phát hiện bất thường' },
  ],
}

/**
 * Compare two template configurations and produce detailed diff list
 * @param {Object} before
 * @param {Object} after
 * @returns {Array<{ field: string, label: string, beforeVal: string, afterVal: string }>}
 */
export const compareTemplateDiff = (before = {}, after = {}) => {
  const diffs = []

  const fieldsToCheck = [
    { key: 'templateName', label: 'Tên mẫu in' },
    { key: 'title', label: 'Tiêu đề chứng từ' },
    { key: 'showLogo', label: 'Hiển thị Logo' },
    { key: 'logoUrl', label: 'Ảnh Logo' },
    { key: 'legalInfo', label: 'Thông tin pháp lý' },
    { key: 'footerText', label: 'Nội dung chân trang' },
    { key: 'fieldVisibility', label: 'Tùy chọn trường in' },
  ]

  fieldsToCheck.forEach(({ key, label }) => {
    let bVal = before[key]
    let aVal = after[key]

    if (key === 'showLogo') {
      bVal = bVal ? 'Có bật' : 'Tắt'
      aVal = aVal ? 'Có bật' : 'Tắt'
    } else if (key === 'logoUrl') {
      bVal = bVal ? (bVal.startsWith('data:') ? '[Ảnh mới]' : bVal) : '(Trống)'
      aVal = aVal ? (aVal.startsWith('data:') ? '[Ảnh mới]' : aVal) : '(Trống)'
    } else if (key === 'fieldVisibility') {
      bVal = typeof bVal === 'object' ? JSON.stringify(bVal) : (bVal || '{}')
      aVal = typeof aVal === 'object' ? JSON.stringify(aVal) : (aVal || '{}')
    } else {
      bVal = bVal || '(Trống)'
      aVal = aVal || '(Trống)'
    }

    if (bVal !== aVal) {
      diffs.push({
        field: key,
        label,
        beforeVal: String(bVal),
        afterVal: String(aVal),
      })
    }
  })

  return diffs
}
