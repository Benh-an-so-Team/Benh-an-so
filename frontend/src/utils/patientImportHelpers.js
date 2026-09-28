import * as XLSX from 'xlsx'

/**
 * Các hàm tiện ích hỗ trợ nghiệp vụ Nhập hồ sơ bệnh nhân từ tệp bảng tính
 */

export const MAX_IMPORT_FILE_SIZE_BYTES = 10 * 1024 * 1024 // 10MB
export const ALLOWED_EXTENSIONS = ['.xlsx', '.xls']

/**
 * Kiểm tra tính hợp lệ sơ bộ của tệp bảng tính tải lên
 * @param {File} file Đối tượng tệp từ input/dragger
 * @returns {{ isValid: boolean, error: string | null }}
 */
export const validateSpreadsheetFile = (file) => {
  if (!file) {
    return {
      isValid: false,
      error: 'Vui lòng chọn tệp bảng tính cần tải lên.',
    }
  }

  const fileName = file.name || ''
  const lowerName = fileName.toLowerCase()
  const hasValidExt = ALLOWED_EXTENSIONS.some((ext) => lowerName.endsWith(ext))

  if (!hasValidExt) {
    if (lowerName.endsWith('.csv')) {
      return {
        isValid: false,
        error: 'Tệp CSV hiện chưa được hỗ trợ trực tiếp. Vui lòng mở và lưu lại dưới dạng Excel (.xlsx) theo tệp mẫu chuẩn.',
      }
    }
    return {
      isValid: false,
      error: 'Định dạng tệp không hợp lệ. Hệ thống chỉ chấp nhận tệp bảng tính Excel (.xlsx hoặc .xls).',
    }
  }

  if (file.size === 0) {
    return {
      isValid: false,
      error: 'Tệp tải lên không có dữ liệu (kích thước 0 byte). Vui lòng kiểm tra lại.',
    }
  }

  if (file.size > MAX_IMPORT_FILE_SIZE_BYTES) {
    return {
      isValid: false,
      error: `Kích thước tệp (${formatFileSize(file.size)}) vượt quá giới hạn tối đa cho phép là 10MB.`,
    }
  }

  return { isValid: true, error: null }
}

/**
 * Định dạng kích thước tệp thân thiện
 * @param {number} bytes Dung lượng byte
 */
export const formatFileSize = (bytes) => {
  if (bytes === null || bytes === undefined || isNaN(bytes) || bytes < 0) return '—'
  if (bytes === 0) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

/**
 * Định dạng thời gian theo chuẩn Việt Nam DD/MM/YYYY HH:mm:ss
 * @param {string|Date} dateVal 
 */
export const formatDateTime = (dateVal) => {
  if (!dateVal) return '—'
  const d = new Date(dateVal)
  if (isNaN(d.getTime())) return '—'
  const pad = (n) => String(n).padStart(2, '0')
  const day = pad(d.getDate())
  const month = pad(d.getMonth() + 1)
  const year = d.getFullYear()
  const hours = pad(d.getHours())
  const minutes = pad(d.getMinutes())
  const seconds = pad(d.getSeconds())
  return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`
}

/**
 * Xuất danh sách dòng lỗi ra tệp CSV kèm UTF-8 BOM để Excel hiển thị tiếng Việt không bị lỗi font
 * @param {Array} errors Danh sách các dòng lỗi từ phản hồi preview/import
 * @param {string} sourceFileName Tên tệp gốc
 */
export const exportErrorsToCsv = (errors = [], sourceFileName = 'danh_sach') => {
  if (!errors || errors.length === 0) return ''

  const headers = ['STT Dòng Trong Tệp', 'Trường Bị Lỗi', 'Chi Tiết Lý Do Lỗi', 'Dữ Liệu Dòng Gốc']
  
  const escapeCsvValue = (val) => {
    if (val === null || val === undefined) return '""'
    const str = String(val).replace(/"/g, '""')
    return `"${str}"`
  }

  const rows = errors.map((err) => [
    escapeCsvValue(err.rowNumber || '—'),
    escapeCsvValue(err.errorField || 'Chung'),
    escapeCsvValue(err.errorMessage || 'Lỗi không xác định'),
    escapeCsvValue(err.rawData || '—'),
  ])

  const csvContent = [headers.map(escapeCsvValue).join(','), ...rows.map((r) => r.join(','))].join('\r\n')
  
  // UTF-8 BOM (\uFEFF) giúp Excel tự nhận diện encoding UTF-8 khi mở trực tiếp
  const fullCsvWithBom = '\uFEFF' + csvContent

  if (typeof window !== 'undefined' && window.document && window.URL && window.Blob) {
    const blob = new Blob([fullCsvWithBom], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    const baseName = (sourceFileName || 'danh_sach').replace(/\.[^/.]+$/, '')
    link.href = url
    link.setAttribute('download', `danh_sach_dong_loi_${baseName}_${Date.now()}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  return fullCsvWithBom
}

/**
 * Cung cấp dữ liệu xem trước mô phỏng (Demo / Sample Data)
 * Giúp nhân viên phòng khám / quản trị viên trải nghiệm tính năng kiểm thử Bước 2 và Bước 3
 */
export const getSamplePreviewData = () => {
  return {
    isDemo: true,
    demoNote: 'Dữ liệu mẫu mô phỏng phục vụ chạy thử nghiệm giao diện, không phải dữ liệu bệnh nhân thật.',
    fileName: 'danh_sach_benh_nhan_mau_demo.xlsx',
    totalRows: 10,
    validCount: 5,
    errorCount: 3,
    duplicateCount: 2,
    validRows: [
      {
        rowNumber: 2,
        fullName: 'Nguyễn Văn An',
        dateOfBirth: '1988-05-14',
        gender: 'Nam',
        phone: '0912345678',
        identityNumber: '001088012345',
        insuranceNumber: 'DN4010123456789',
        address: '123 Đường Giải Phóng, Hai Bà Trưng, Hà Nội',
        note: 'Hồ sơ đầy đủ thông tin chuẩn',
      },
      {
        rowNumber: 3,
        fullName: 'Trần Thị Mai Phương',
        dateOfBirth: '1995-11-20',
        gender: 'Nữ',
        phone: '0987654321',
        identityNumber: '001195098765',
        insuranceNumber: 'DN4010987654321',
        address: '45 Lê Duẩn, Hoàn Kiếm, Hà Nội',
        note: 'Hồ sơ đầy đủ thông tin chuẩn',
      },
      {
        rowNumber: 4,
        fullName: 'Lê Hoàng Long',
        dateOfBirth: '2012-08-01',
        gender: 'Nam',
        phone: '0903456789',
        identityNumber: '',
        insuranceNumber: 'TE1010345678901',
        address: '88 Cầu Giấy, Cầu Giấy, Hà Nội',
        note: 'Bệnh nhân dưới 18 tuổi, có người giám hộ',
      },
      {
        rowNumber: 7,
        fullName: 'Phạm Thị Lan Hương',
        dateOfBirth: '1975-03-12',
        gender: 'Nữ',
        phone: '0918765432',
        identityNumber: '001175001234',
        insuranceNumber: '',
        address: '12 Khâm Thiên, Đống Đa, Hà Nội',
        note: 'Hồ sơ hợp lệ',
      },
      {
        rowNumber: 10,
        fullName: 'Vũ Đức Thịnh',
        dateOfBirth: '2001-09-30',
        gender: 'Nam',
        phone: '0977112233',
        identityNumber: '001201004567',
        insuranceNumber: 'GD4010456789123',
        address: '25 Nguyễn Trãi, Thanh Xuân, Hà Nội',
        note: 'Hồ sơ hợp lệ',
      },
    ],
    errors: [
      {
        rowNumber: 5,
        errorField: 'Họ và tên',
        errorMessage: 'Dòng 5: Thiếu họ tên bệnh nhân (Cột Họ và tên là bắt buộc).',
        rawData: '; 1990-01-01; Nữ; 0933112233; ; ; Hà Nội',
      },
      {
        rowNumber: 6,
        errorField: 'Ngày sinh',
        errorMessage: 'Dòng 6: Sai định dạng ngày sinh "31/02/1985" (Yêu cầu định dạng YYYY-MM-DD hoặc ngày hợp lệ trong lịch).',
        rawData: 'Hoàng Văn Dũng; 31/02/1985; Nam; 0944556677; ; ; Nam Định',
      },
      {
        rowNumber: 9,
        errorField: 'Số điện thoại',
        errorMessage: 'Dòng 9: Số điện thoại "09123" không hợp lệ (Phải là số điện thoại Việt Nam gồm 10 chữ số).',
        rawData: 'Đỗ Thị Quyên; 1993-07-15; Nữ; 09123; 001193005678; ; Bắc Ninh',
      },
    ],
    suspectedDuplicates: [
      {
        rowNumber: 8,
        fullName: 'Nguyễn Văn An',
        dateOfBirth: '1988-05-14',
        phone: '0912345678',
        identityNumber: '001088012345',
        matchedExistingPatientId: '11111111-2222-3333-4444-555555555555',
        matchedExistingPatientCode: 'BN-00042',
        matchedExistingFullName: 'Nguyễn Văn An',
        duplicateReason: 'Trùng khớp cả 3 tiêu chí: Họ tên, Ngày sinh (14/05/1988) và Số điện thoại (0912345678) với hồ sơ BN-00042',
        actionChoice: 'SKIP', // SKIP or MERGE
      },
      {
        rowNumber: 11,
        fullName: 'Bùi Thị Thu Hà',
        dateOfBirth: '1982-12-05',
        phone: '0982233445',
        identityNumber: '001182009876',
        matchedExistingPatientId: '22222222-3333-4444-5555-666666666666',
        matchedExistingPatientCode: 'BN-00108',
        matchedExistingFullName: 'Bùi Thị Thu Hà',
        duplicateReason: 'Trùng khớp Số CCCD/CMND (001182009876) và Họ tên với hồ sơ BN-00108',
        actionChoice: 'SKIP',
      },
    ],
  }
}

/**
 * Giả lập kết quả nhập thành công khi chạy thử nghiệm chế độ demo
 */
export const getSampleImportResult = (validCount = 5, duplicateCount = 2, errorCount = 3) => {
  const generatedCodes = []
  for (let i = 1; i <= validCount; i++) {
    generatedCodes.push(`BN-${String(1040 + i).padStart(5, '0')}`)
  }

  return {
    importLogId: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
    fileName: 'danh_sach_benh_nhan_mau_demo.xlsx',
    totalRows: validCount + duplicateCount + errorCount,
    successCount: validCount,
    errorCount: errorCount,
    duplicateCount: duplicateCount,
    createdPatientCodes: generatedCodes,
    errors: [
      {
        rowNumber: 5,
        errorField: 'Họ và tên',
        errorMessage: 'Dòng 5: Thiếu họ tên bệnh nhân (Cột Họ và tên là bắt buộc).',
        rawData: '; 1990-01-01; Nữ; 0933112233; ; ; Hà Nội',
      },
      {
        rowNumber: 6,
        errorField: 'Ngày sinh',
        errorMessage: 'Dòng 6: Sai định dạng ngày sinh "31/02/1985".',
        rawData: 'Hoàng Văn Dũng; 31/02/1985; Nam; 0944556677; ; ; Nam Định',
      },
      {
        rowNumber: 9,
        errorField: 'Số điện thoại',
        errorMessage: 'Dòng 9: Số điện thoại "09123" không hợp lệ.',
        rawData: 'Đỗ Thị Quyên; 1993-07-15; Nữ; 09123; 001193005678; ; Bắc Ninh',
      },
    ],
  }
}

/**
 * Chuẩn hóa chuỗi tiếng Việt (loại bỏ dấu, khoảng trắng thừa) để so khớp trùng lặp
 */
export const normalizeVietnameseText = (str) => {
  if (!str) return ''
  return String(str)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim()
}

/**
 * Chuyển đổi giá trị ô bảng tính thành chuỗi định dạng ngày YYYY-MM-DD
 */
export const parseSpreadsheetDateCell = (val) => {
  if (!val) return null

  // Đã là Date object
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return null
    const y = val.getFullYear()
    const m = String(val.getMonth() + 1).padStart(2, '0')
    const d = String(val.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }

  // Số nguyên tuần tự Excel (Serial date)
  if (typeof val === 'number') {
    if (val < 1 || val > 100000) return null
    const utcDays = Math.floor(val - 25569)
    const dateObj = new Date(utcDays * 86400 * 1000)
    if (isNaN(dateObj.getTime())) return null
    const y = dateObj.getUTCFullYear()
    const m = String(dateObj.getUTCMonth() + 1).padStart(2, '0')
    const d = String(dateObj.getUTCDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }

  const str = String(val).trim()
  if (!str) return null

  // Khớp dd/MM/yyyy hoặc dd-MM-yyyy
  const dmyMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/)
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10)
    const month = parseInt(dmyMatch[2], 10)
    const year = parseInt(dmyMatch[3], 10)
    if (month < 1 || month > 12 || day < 1 || day > 31) return null

    // Kiểm tra tính hợp lệ của ngày trong tháng (vd: 31/02 là sai)
    const checkDate = new Date(year, month - 1, day)
    if (
      checkDate.getFullYear() !== year ||
      checkDate.getMonth() !== month - 1 ||
      checkDate.getDate() !== day
    ) {
      return null
    }

    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  }

  // Khớp yyyy-MM-dd
  const ymdMatch = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/)
  if (ymdMatch) {
    const year = parseInt(ymdMatch[1], 10)
    const month = parseInt(ymdMatch[2], 10)
    const day = parseInt(ymdMatch[3], 10)
    if (month < 1 || month > 12 || day < 1 || day > 31) return null

    const checkDate = new Date(year, month - 1, day)
    if (
      checkDate.getFullYear() !== year ||
      checkDate.getMonth() !== month - 1 ||
      checkDate.getDate() !== day
    ) {
      return null
    }

    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  }

  return null
}

/**
 * Tính số tuổi dựa trên ngày sinh YYYY-MM-DD
 */
export const calculateAgeFromDob = (dobStr) => {
  if (!dobStr) return null
  const dob = new Date(dobStr)
  if (isNaN(dob.getTime())) return null
  const today = new Date()
  let age = today.getFullYear() - dob.getFullYear()
  const m = today.getMonth() - dob.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
    age--
  }
  return age
}

/**
 * Tạo tệp mẫu Excel chuẩn (.xlsx) trực tiếp trên Client
 * Đảm bảo 15 cột tiêu chuẩn cùng 2 dòng dữ liệu mẫu (1 người lớn, 1 trẻ em có người giám hộ)
 */
export const generateExcelTemplateBlob = () => {
  const headers = [
    'Họ và tên (*)',
    'Ngày sinh (*) (dd/MM/yyyy)',
    'Giới tính (*) (Nam/Nữ)',
    'Số điện thoại',
    'Số CCCD/CMND',
    'Số thẻ BHYT',
    'Địa chỉ',
    'Email',
    'Nhóm máu (A/B/AB/O)',
    'Người liên hệ khẩn cấp',
    'Quan hệ người liên hệ',
    'SĐT người liên hệ',
    'Tên người giám hộ (<18t bắt buộc)',
    'Quan hệ người giám hộ (<18t bắt buộc)',
    'SĐT người giám hộ (<18t bắt buộc)',
  ]

  const sampleRows = [
    headers,
    [
      'Nguyễn Văn An',
      '15/05/1988',
      'Nam',
      '0901234567',
      '001088012345',
      'DN4010123456789',
      '123 Đường Giải Phóng, Hà Nội',
      'nguyenvanan@example.com',
      'O',
      'Trần Thị Bình',
      'Vợ',
      '0912345678',
      '',
      '',
      '',
    ],
    [
      'Nguyễn Minh Khang',
      '20/10/2015',
      'Nam',
      '',
      '',
      '',
      '123 Đường Giải Phóng, Hà Nội',
      '',
      '',
      '',
      '',
      '',
      'Nguyễn Văn An',
      'Bố',
      '0901234567',
    ],
  ]

  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet(sampleRows)

  // Explicitly enforce string type 's' on all cells so Excel preserves leading zeros
  Object.keys(ws).forEach((key) => {
    if (!key.startsWith('!') && ws[key]) {
      ws[key].t = 's'
    }
  })

  ws['!cols'] = [
    { wch: 24 }, // Họ và tên
    { wch: 22 }, // Ngày sinh
    { wch: 16 }, // Giới tính
    { wch: 16 }, // SĐT
    { wch: 18 }, // CCCD
    { wch: 18 }, // BHYT
    { wch: 32 }, // Địa chỉ
    { wch: 26 }, // Email
    { wch: 16 }, // Nhóm máu
    { wch: 22 }, // Người liên hệ khẩn cấp
    { wch: 20 }, // Quan hệ NLH
    { wch: 18 }, // SĐT NLH
    { wch: 26 }, // Người giám hộ
    { wch: 22 }, // Quan hệ NGH
    { wch: 20 }, // SĐT NGH
  ]

  XLSX.utils.book_append_sheet(wb, ws, 'Danh_sach_benh_nhan')
  const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' })
  return new Blob([out], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
}

/**
 * Đọc và kiểm tra toàn diện tệp bảng tính trực tiếp trên Client
 * Phòng tránh triệt để lỗi sập máy chủ 500 khi nạp tệp rỗng hoặc lệch định dạng
 * @param {File|Blob|ArrayBuffer} fileOrBuffer Tệp bảng tính tải lên
 * @param {Array} existingPatients Danh sách bệnh nhân đã có trong hệ thống (phục vụ đối soát trùng lặp)
 */
export const parseAndValidateSpreadsheet = async (fileOrBuffer, existingPatients = []) => {

  let readData = fileOrBuffer
  let readType = 'array'
  let fileName = 'danh_sach.xlsx'

  if (fileOrBuffer instanceof ArrayBuffer) {
    readData = fileOrBuffer
    readType = 'array'
  } else if (fileOrBuffer && typeof fileOrBuffer.arrayBuffer === 'function') {
    readData = await fileOrBuffer.arrayBuffer()
    readType = 'array'
    fileName = fileOrBuffer.name || fileName
  } else if (typeof Buffer !== 'undefined' && Buffer.isBuffer && Buffer.isBuffer(fileOrBuffer)) {
    readData = fileOrBuffer
    readType = 'buffer'
  } else if (fileOrBuffer instanceof Uint8Array) {
    readData = fileOrBuffer
    readType = 'buffer'
  } else {
    throw new Error('Dữ liệu tệp không hợp lệ.')
  }

  const workbook = XLSX.read(readData, { type: readType, cellDates: true })
  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    return {
      isEmpty: true,
      error: 'Tệp bảng tính không có bất kỳ trang tính (sheet) nào.',
    }
  }

  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })

  if (!rawRows || rawRows.length === 0) {
    return {
      isEmpty: true,
      error: 'Tệp bảng tính hoàn toàn trống.',
    }
  }

  // Lọc các dòng dữ liệu không rỗng (bắt đầu từ dòng 2, index 1)
  const dataRowsWithIndex = []
  for (let r = 1; r < rawRows.length; r++) {
    const row = rawRows[r]
    if (!Array.isArray(row)) continue
    // Kiểm tra dòng có ít nhất 1 ô có dữ liệu không rỗng
    const hasData = row.some((cell) => cell !== null && cell !== undefined && String(cell).trim() !== '')
    if (hasData) {
      dataRowsWithIndex.push({
        rowNumber: r + 1, // 1-indexed
        cells: row,
      })
    }
  }

  if (dataRowsWithIndex.length === 0) {
    return {
      isEmpty: true,
      fileName,
      totalRows: 0,
      validCount: 0,
      errorCount: 0,
      duplicateCount: 0,
      validRows: [],
      errors: [],
      suspectedDuplicates: [],
      error: 'Tệp bảng tính chưa có dòng dữ liệu bệnh nhân nào. Vui lòng mở tệp mẫu và nhập dữ liệu từ dòng số 2 trở đi trước khi tải lên.',
    }
  }

  const validRows = []
  const errors = []
  const suspectedDuplicates = []

  // Bản đồ theo dõi trùng lặp nội bộ trong cùng tệp
  const seenIdentities = new Map() // identity -> rowNumber
  const seenPhones = new Map() // phone -> rowNumber
  const seenNameDobs = new Map() // normName_dob -> rowNumber

  for (const item of dataRowsWithIndex) {
    const rNum = item.rowNumber
    const c = item.cells

    const rawDataStr = c.map((cell) => String(cell || '').trim()).filter(Boolean).join('; ')

    // Trích xuất các trường theo thứ tự 15 cột
    const fullName = String(c[0] || '').trim()
    const rawDob = c[1]
    const rawGender = String(c[2] || '').trim()

    let rawPhone = String(c[3] || '').replace(/[\s.-]/g, '').trim()
    if (rawPhone && /^[35789]\d{8}$/.test(rawPhone)) {
      rawPhone = '0' + rawPhone
    }

    let rawIdentity = String(c[4] || '').replace(/[\s.-]/g, '').trim()
    if (rawIdentity && /^\d{10,11}$/.test(rawIdentity)) {
      rawIdentity = rawIdentity.padStart(12, '0')
    } else if (rawIdentity && /^\d{8}$/.test(rawIdentity)) {
      rawIdentity = rawIdentity.padStart(9, '0')
    }

    const rawInsurance = String(c[5] || '').trim()
    const address = String(c[6] || '').trim()
    const email = String(c[7] || '').trim()
    const bloodType = String(c[8] || '').trim().toUpperCase()
    const emergencyContact = String(c[9] || '').trim()
    const emergencyRelationship = String(c[10] || '').trim()

    let emergencyPhone = String(c[11] || '').replace(/[\s.-]/g, '').trim()
    if (emergencyPhone && /^[35789]\d{8}$/.test(emergencyPhone)) {
      emergencyPhone = '0' + emergencyPhone
    }

    const guardianName = String(c[12] || '').trim()
    const guardianRelationship = String(c[13] || '').trim()

    let guardianPhone = String(c[14] || '').replace(/[\s.-]/g, '').trim()
    if (guardianPhone && /^[35789]\d{8}$/.test(guardianPhone)) {
      guardianPhone = '0' + guardianPhone
    }

    // 1. Kiểm tra Họ và tên (*)
    if (!fullName) {
      errors.push({
        rowNumber: rNum,
        errorField: 'Họ và tên',
        errorMessage: `Dòng ${rNum}: Thiếu họ tên bệnh nhân (Cột Họ và tên là bắt buộc).`,
        rawData: rawDataStr,
      })
      continue
    }

    if (fullName.length > 100) {
      errors.push({
        rowNumber: rNum,
        errorField: 'Họ và tên',
        errorMessage: `Dòng ${rNum}: Họ và tên không được vượt quá 100 ký tự.`,
        rawData: rawDataStr,
      })
      continue
    }

    // 2. Kiểm tra Ngày sinh (*)
    const parsedDob = parseSpreadsheetDateCell(rawDob)
    if (!parsedDob) {
      errors.push({
        rowNumber: rNum,
        errorField: 'Ngày sinh',
        errorMessage: `Dòng ${rNum}: Ngày sinh "${rawDob || ''}" không hợp lệ. Vui lòng nhập theo định dạng dd/MM/yyyy hoặc ngày hợp lệ trong lịch.`,
        rawData: rawDataStr,
      })
      continue
    }

    const birthDate = new Date(parsedDob)
    const today = new Date()
    today.setHours(23, 59, 59, 999)
    if (birthDate > today) {
      errors.push({
        rowNumber: rNum,
        errorField: 'Ngày sinh',
        errorMessage: `Dòng ${rNum}: Ngày sinh "${parsedDob}" không được ở tương lai.`,
        rawData: rawDataStr,
      })
      continue
    }

    const age = calculateAgeFromDob(parsedDob)
    if (age !== null && (age < 0 || age > 130)) {
      errors.push({
        rowNumber: rNum,
        errorField: 'Ngày sinh',
        errorMessage: `Dòng ${rNum}: Tuổi tính từ ngày sinh "${parsedDob}" (${age} tuổi) không hợp lệ (từ 0 đến 130 tuổi).`,
        rawData: rawDataStr,
      })
      continue
    }

    // 3. Kiểm tra Giới tính (*)
    let standardizedGender = null
    const lowerGender = rawGender.toLowerCase()
    if (lowerGender === 'nam' || lowerGender === 'male' || lowerGender === 'm') {
      standardizedGender = 'Nam'
    } else if (lowerGender === 'nữ' || lowerGender === 'nu' || lowerGender === 'female' || lowerGender === 'f') {
      standardizedGender = 'Nữ'
    } else if (lowerGender === 'khác' || lowerGender === 'other') {
      standardizedGender = 'Khác'
    }

    if (!standardizedGender) {
      errors.push({
        rowNumber: rNum,
        errorField: 'Giới tính',
        errorMessage: `Dòng ${rNum}: Giới tính "${rawGender || ''}" không hợp lệ. Chỉ chấp nhận: Nam hoặc Nữ.`,
        rawData: rawDataStr,
      })
      continue
    }

    // 4. Kiểm tra SĐT (nếu có)
    if (rawPhone && !/^0[35789]\d{8}$/.test(rawPhone)) {
      errors.push({
        rowNumber: rNum,
        errorField: 'Số điện thoại',
        errorMessage: `Dòng ${rNum}: Số điện thoại "${rawPhone}" không hợp lệ. Phải là số điện thoại Việt Nam 10 chữ số bắt đầu bằng 03, 05, 07, 08, 09.`,
        rawData: rawDataStr,
      })
      continue
    }

    // 5. Kiểm tra CCCD/CMND (nếu có)
    if (rawIdentity && !/^\d{9}$|^\d{12}$/.test(rawIdentity)) {
      errors.push({
        rowNumber: rNum,
        errorField: 'Số CCCD/CMND',
        errorMessage: `Dòng ${rNum}: Số định danh "${rawIdentity}" không hợp lệ (Phải gồm 9 chữ số CMND hoặc 12 chữ số CCCD).`,
        rawData: rawDataStr,
      })
      continue
    }

    // 6. Kiểm tra Người giám hộ nếu tuổi < 18 (QTN-44)
    if (age !== null && age < 18) {
      if (!guardianName || !guardianRelationship || !guardianPhone) {
        errors.push({
          rowNumber: rNum,
          errorField: 'Người giám hộ',
          errorMessage: `Dòng ${rNum}: Bệnh nhân ${fullName} dưới 18 tuổi (${age} tuổi), bắt buộc phải có đủ Họ tên, Quan hệ và SĐT người giám hộ (QTN-44).`,
          rawData: rawDataStr,
        })
        continue
      }
      if (!/^0[35789]\d{8}$/.test(guardianPhone)) {
        errors.push({
          rowNumber: rNum,
          errorField: 'SĐT người giám hộ',
          errorMessage: `Dòng ${rNum}: Số điện thoại người giám hộ "${guardianPhone}" không đúng định dạng 10 chữ số.`,
          rawData: rawDataStr,
        })
        continue
      }
    }

    // 7. Kiểm tra Email (nếu có)
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.push({
        rowNumber: rNum,
        errorField: 'Email',
        errorMessage: `Dòng ${rNum}: Địa chỉ email "${email}" không hợp lệ.`,
        rawData: rawDataStr,
      })
      continue
    }

    // --- RÀ SOÁT TRÙNG LẶP (DUPLICATE DETECTION) ---
    const normName = normalizeVietnameseText(fullName)
    const nameDobKey = `${normName}_${parsedDob}`
    let isDuplicate = false
    let dupReason = ''
    let matchedCode = 'Đã có'
    let matchedName = fullName

    // a. Trùng lặp nội bộ trong cùng tệp tải lên
    if (rawIdentity && seenIdentities.has(rawIdentity)) {
      isDuplicate = true
      dupReason = `Trùng khớp Số CCCD/CMND (${rawIdentity}) với dòng ${seenIdentities.get(rawIdentity)} trong cùng tệp.`
    } else if (rawPhone && seenPhones.has(rawPhone)) {
      isDuplicate = true
      dupReason = `Trùng khớp Số điện thoại (${rawPhone}) với dòng ${seenPhones.get(rawPhone)} trong cùng tệp.`
    } else if (seenNameDobs.has(nameDobKey)) {
      isDuplicate = true
      dupReason = `Trùng khớp cả Họ tên ("${fullName}") và Ngày sinh (${parsedDob}) với dòng ${seenNameDobs.get(nameDobKey)} trong cùng tệp.`
    }

    // b. Trùng lặp với bệnh nhân hiện có trong hệ thống (nếu có)
    if (!isDuplicate && Array.isArray(existingPatients) && existingPatients.length > 0) {
      const matchByIdentity = rawIdentity
        ? existingPatients.find((p) => p.identityNumber === rawIdentity)
        : null
      const matchByPhone = rawPhone
        ? existingPatients.find((p) => p.phone === rawPhone)
        : null
      const matchByNameDob = existingPatients.find(
        (p) => normalizeVietnameseText(p.fullName) === normName && p.dateOfBirth === parsedDob
      )

      if (matchByIdentity) {
        isDuplicate = true
        matchedCode = matchByIdentity.patientCode || 'BN-00xxx'
        matchedName = matchByIdentity.fullName || fullName
        dupReason = `Trùng khớp Số CCCD/CMND với bệnh nhân ${matchedCode} (${matchedName}) đã có trong hệ thống.`
      } else if (matchByPhone) {
        isDuplicate = true
        matchedCode = matchByPhone.patientCode || 'BN-00xxx'
        matchedName = matchByPhone.fullName || fullName
        dupReason = `Trùng khớp Số điện thoại với bệnh nhân ${matchedCode} (${matchedName}) đã có trong hệ thống.`
      } else if (matchByNameDob) {
        isDuplicate = true
        matchedCode = matchByNameDob.patientCode || 'BN-00xxx'
        matchedName = matchByNameDob.fullName || fullName
        dupReason = `Trùng khớp cả Họ tên và Ngày sinh (${parsedDob}) với bệnh nhân ${matchedCode} (${matchedName}) đã có trong hệ thống.`
      }
    }

    if (isDuplicate) {
      suspectedDuplicates.push({
        rowNumber: rNum,
        fullName,
        dateOfBirth: parsedDob,
        phone: rawPhone,
        identityNumber: rawIdentity,
        matchedExistingPatientCode: matchedCode,
        matchedExistingFullName: matchedName,
        duplicateReason: dupReason,
        actionChoice: 'SKIP',
      })
    } else {
      // Ghi nhận vào bản đồ nội bộ để phát hiện các dòng trùng phía sau
      if (rawIdentity) seenIdentities.set(rawIdentity, rNum)
      if (rawPhone) seenPhones.set(rawPhone, rNum)
      seenNameDobs.set(nameDobKey, rNum)

      validRows.push({
        rowNumber: rNum,
        fullName,
        dateOfBirth: parsedDob,
        gender: standardizedGender,
        phone: rawPhone,
        identityNumber: rawIdentity,
        insuranceNumber: rawInsurance,
        address,
        email,
        bloodType,
        emergencyContact,
        emergencyRelationship,
        emergencyPhone,
        guardianName,
        guardianRelationship,
        guardianPhone,
      })
    }
  }

  const totalRows = validRows.length + errors.length + suspectedDuplicates.length

  return {
    isEmpty: false,
    fileName,
    totalRows,
    validCount: validRows.length,
    errorCount: errors.length,
    duplicateCount: suspectedDuplicates.length,
    validRows,
    errors,
    suspectedDuplicates,
  }
}

