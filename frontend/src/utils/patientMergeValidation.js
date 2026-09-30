/**
 * Tiện ích nghiệp vụ và kiểm tra hợp lệ cho chức năng Gộp hồ sơ bệnh nhân trùng (NCL-02-CN-006).
 * Quy tắc: QTN-33, QTN-10, QTN-02
 * Tiêu chí chấp thuận: TC-01, TC-02, TC-03, TC-04, TC-05
 */

export const MERGE_REASON_PRESETS = [
  'Hồ sơ trùng tiếp đón do bệnh nhân không mang CCCD/BHYT lần đầu',
  'Trùng hồ sơ do tiếp đón tạo mới thay vì tra cứu hồ sơ cũ',
  'Bệnh nhân đổi số điện thoại nên tiếp đón tạo hồ sơ mới',
  'Gộp hồ sơ nghi trùng từ hệ thống gợi ý tự động',
  'Khác',
]

/**
 * Danh mục các trường thông tin cá nhân cần so sánh và chọn lọc khi gộp hồ sơ
 */
export const MERGE_COMPARISON_FIELDS = [
  { key: 'fullName', label: 'Họ và tên', type: 'text', category: 'identity' },
  { key: 'dateOfBirth', label: 'Ngày sinh', type: 'date', category: 'identity' },
  { key: 'gender', label: 'Giới tính', type: 'gender', category: 'identity' },
  { key: 'identityNumber', label: 'Số CCCD / CMND', type: 'text', category: 'identity' },
  { key: 'phone', label: 'Số điện thoại', aliases: ['phone', 'phoneNumber'], type: 'phone', category: 'contact' },
  { key: 'address', label: 'Địa chỉ cư trú', type: 'text', category: 'contact' },
  { key: 'insuranceNumber', label: 'Số thẻ BHYT', type: 'text', category: 'insurance' },
  { key: 'bloodType', label: 'Nhóm máu', type: 'text', category: 'medical' },
  { key: 'guardianName', label: 'Họ tên người giám hộ', type: 'text', category: 'guardian' },
  { key: 'guardianRelationship', label: 'Mối quan hệ người giám hộ', type: 'text', category: 'guardian' },
  { key: 'guardianPhone', label: 'SĐT người giám hộ', type: 'phone', category: 'guardian' },
  { key: 'guardianIdentityNumber', label: 'CCCD người giám hộ', type: 'text', category: 'guardian' },
]

/**
 * Kiểm tra xem người dùng hiện tại có quyền thực hiện gộp hồ sơ hay không (TC-04, QTN-01)
 * Chỉ Lễ tân (RECEPTIONIST), Quản lý (MANAGER), và Quản trị viên (ADMIN) mới được gộp.
 * Bác sĩ (DOCTOR) và Dược sĩ (PHARMACIST) bị từ chối truy cập.
 * @param {string[]|string} [roles]
 * @param {string[]|string} [permissions]
 * @returns {boolean}
 */
export function canUserMergePatients(roles = [], permissions = []) {
  const normRoles = (Array.isArray(roles) ? roles : [roles])
    .map((r) => String(r || '').toLowerCase().replace(/^role_/, ''))

  const normPerms = (Array.isArray(permissions) ? permissions : [permissions])
    .map((p) => String(p || '').toUpperCase().replace(/^PERMISSION_/, ''))

  if (normPerms.includes('PATIENT_MERGE')) return true

  const isReceptionist = normRoles.includes('receptionist')
  const isManager = normRoles.includes('manager') || normRoles.includes('clinic_manager')
  const isAdmin = normRoles.includes('admin') || normRoles.includes('administrator')

  return isReceptionist || isManager || isAdmin
}

/**
 * Định dạng hiển thị giá trị ngày sinh hoặc ngày tháng
 * @param {string|Date} dateStr 
 * @returns {string}
 */
function formatDisplayDate(dateStr) {
  if (!dateStr) return ''
  try {
    const raw = String(dateStr).split('T')[0]
    const parts = raw.split('-')
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`
    }
    return raw
  } catch {
    return String(dateStr)
  }
}

/**
 * Định dạng hiển thị giới tính
 * @param {string} gender 
 * @returns {string}
 */
function formatDisplayGender(gender) {
  if (!gender) return ''
  const g = String(gender).toUpperCase()
  if (g === 'MALE' || g === 'NAM') return 'Nam'
  if (g === 'FEMALE' || g === 'NU' || g === 'NỮ') return 'Nữ'
  return 'Khác'
}

/**
 * Lấy giá trị của một trường từ đối tượng bệnh nhân
 * @param {Object} patient 
 * @param {Object} fieldDef 
 * @returns {any}
 */
function getPatientFieldValue(patient, fieldDef) {
  if (!patient) return null
  if (patient[fieldDef.key] !== undefined && patient[fieldDef.key] !== null) {
    return patient[fieldDef.key]
  }
  if (Array.isArray(fieldDef.aliases)) {
    for (const alias of fieldDef.aliases) {
      if (patient[alias] !== undefined && patient[alias] !== null) {
        return patient[alias]
      }
    }
  }
  return null
}

/**
 * Chuẩn hóa giá trị để so sánh tính tương đương
 * @param {any} val 
 * @param {string} type 
 * @returns {string}
 */
function normalizeForComparison(val, type) {
  if (val === undefined || val === null) return ''
  const str = String(val).trim()
  if (!str) return ''

  if (type === 'date') {
    return str.split('T')[0]
  }
  if (type === 'gender') {
    const upper = str.toUpperCase()
    if (upper === 'MALE' || upper === 'NAM') return 'MALE'
    if (upper === 'FEMALE' || upper === 'NU' || upper === 'NỮ') return 'FEMALE'
    return 'OTHER'
  }
  if (type === 'phone') {
    return str.replace(/\D/g, '')
  }
  return str.toLowerCase()
}

/**
 * Kiểm tra xem bệnh nhân có bệnh án đã ký khóa chuyên môn hay không
 * @param {Object} patient 
 * @param {boolean} [explicitFlag] 
 * @returns {boolean}
 */
export function patientHasSignedMedicalRecords(patient, explicitFlag) {
  if (typeof explicitFlag === 'boolean') return explicitFlag
  if (!patient) return false
  return Boolean(
    patient.hasSignedRecords ||
    patient.hasFinalizedMedicalRecords ||
    (Number(patient.signedMedicalRecordsCount || 0) > 0) ||
    (Number(patient.finalizedMedicalRecordsCount || 0) > 0) ||
    (Number(patient.signedRecordsCount || 0) > 0)
  )
}

/**
 * Kiểm tra mâu thuẫn danh tính cốt lõi giữa hai hồ sơ trước khi cho phép vào bước gộp
 * Quy tắc:
 * 1. Khác số CCCD/CMND (khi cả 2 đều có giá trị) -> Mâu thuẫn danh tính
 * 2. Cả hai hồ sơ đều đã có bệnh án ký khóa chuyên môn mà thông tin danh tính (họ tên, ngày sinh, giới tính) mâu thuẫn nhau -> Từ chối gộp hoàn toàn
 * 
 * @param {Object} patientA 
 * @param {Object} patientB 
 * @param {Object} [options] 
 * @param {boolean} [options.patientAHasSignedRecords]
 * @param {boolean} [options.patientBHasSignedRecords]
 * @returns {{ hasConflict: boolean, conflictType?: string, reason?: string, recommendation?: string, conflictingFields?: string[] }}
 */
export function checkIdentityConflict(patientA, patientB, options = {}) {
  if (!patientA || !patientB) {
    return { hasConflict: false }
  }

  // 1. Kiểm tra mâu thuẫn CCCD/CMND
  const idA = String(patientA.identityNumber || '').trim().toUpperCase()
  const idB = String(patientB.identityNumber || '').trim().toUpperCase()
  if (idA && idB && idA !== idB) {
    return {
      hasConflict: true,
      conflictType: 'IDENTITY_NUMBER_MISMATCH',
      conflictingFields: ['identityNumber'],
      reason: `Hai hồ sơ có số định danh cá nhân (CCCD/CMND) khác nhau: "${idA}" và "${idB}" (QTN-33).`,
      recommendation: 'Đây là hai công dân độc lập có mã định danh khác nhau. Hệ thống từ chối gộp tự động. Vui lòng kiểm tra lại căn cước công dân hoặc báo cáo Quản lý phòng khám xử lý thủ công.',
    }
  }

  // 2. Kiểm tra mâu thuẫn nhân khẩu trên bệnh án đã ký khóa chuyên môn
  const aHasSigned = patientHasSignedMedicalRecords(patientA, options.patientAHasSignedRecords)
  const bHasSigned = patientHasSignedMedicalRecords(patientB, options.patientBHasSignedRecords)

  if (aHasSigned && bHasSigned) {
    const dobA = patientA.dateOfBirth ? String(patientA.dateOfBirth).split('T')[0] : ''
    const dobB = patientB.dateOfBirth ? String(patientB.dateOfBirth).split('T')[0] : ''

    const genderA = normalizeForComparison(patientA.gender, 'gender')
    const genderB = normalizeForComparison(patientB.gender, 'gender')

    const nameA = normalizeForComparison(patientA.fullName, 'text')
    const nameB = normalizeForComparison(patientB.fullName, 'text')

    const conflicts = []
    const conflictingFields = []

    if (nameA && nameB && nameA !== nameB) {
      conflicts.push(`Họ và tên ("${patientA.fullName}" khác "${patientB.fullName}")`)
      conflictingFields.push('fullName')
    }

    if (dobA && dobB && dobA !== dobB) {
      conflicts.push(`Ngày sinh (${formatDisplayDate(patientA.dateOfBirth)} khác ${formatDisplayDate(patientB.dateOfBirth)})`)
      conflictingFields.push('dateOfBirth')
    }

    if (genderA && genderB && genderA !== genderB) {
      conflicts.push(`Giới tính (${formatDisplayGender(patientA.gender)} khác ${formatDisplayGender(patientB.gender)})`)
      conflictingFields.push('gender')
    }

    if (conflicts.length > 0) {
      return {
        hasConflict: true,
        conflictType: 'SIGNED_RECORDS_DEMOGRAPHIC_CONFLICT',
        conflictingFields,
        reason: `Hai hồ sơ đều đã có bệnh án đã ký khóa chuyên môn nhưng mâu thuẫn thông tin danh tính: ${conflicts.join('; ')}.`,
        recommendation: 'Hệ thống từ chối gộp tự động để đảm bảo an toàn pháp lý y khoa (đây có thể là 2 người bệnh khác nhau). Vui lòng không thực hiện gộp và báo cáo Quản lý phòng khám / Ban giám đốc kiểm tra hồ sơ bệnh án gốc.',
      }
    }
  }

  return { hasConflict: false }
}

/**
 * So sánh từng trường thông tin cá nhân giữa 2 hồ sơ bệnh nhân
 * @param {Object} patient1 - Hồ sơ 1 (p1)
 * @param {Object} patient2 - Hồ sơ 2 (p2)
 * @param {Object} [options]
 * @param {string} [options.preferredSide='p1'] - Bên ưu tiên nếu bằng nhau ('p1' hoặc 'p2')
 * @returns {{
 *   fields: Array<{
 *     key: string,
 *     label: string,
 *     type: string,
 *     category: string,
 *     val1: any,
 *     val2: any,
 *     displayVal1: string,
 *     displayVal2: string,
 *     isIdentical: boolean,
 *     isOneSideEmpty: boolean,
 *     emptySide: 'p1' | 'p2' | null,
 *     recommendedSide: 'p1' | 'p2',
 *     recommendedValue: any
 *   }>,
 *   identicalCount: number,
 *   differentCount: number,
 *   initialSelections: Record<string, 'p1' | 'p2'>
 * }}
 */
export function comparePatientFields(patient1, patient2, options = {}) {
  const preferredSide = options.preferredSide === 'p2' ? 'p2' : 'p1'

  // Xác định hồ sơ nào được cập nhật gần đây nhất (nếu có updatedAt)
  let recentSide = null
  if (patient1?.updatedAt && patient2?.updatedAt) {
    const t1 = new Date(patient1.updatedAt).getTime()
    const t2 = new Date(patient2.updatedAt).getTime()
    if (!isNaN(t1) && !isNaN(t2)) {
      if (t1 > t2) recentSide = 'p1'
      else if (t2 > t1) recentSide = 'p2'
    }
  }

  const initialSelections = {}
  let identicalCount = 0
  let differentCount = 0

  const fields = MERGE_COMPARISON_FIELDS.map((fieldDef) => {
    const rawVal1 = getPatientFieldValue(patient1, fieldDef)
    const rawVal2 = getPatientFieldValue(patient2, fieldDef)

    const norm1 = normalizeForComparison(rawVal1, fieldDef.type)
    const norm2 = normalizeForComparison(rawVal2, fieldDef.type)

    const hasVal1 = norm1.length > 0
    const hasVal2 = norm2.length > 0

    // Định dạng hiển thị
    let displayVal1 = rawVal1 ? String(rawVal1) : ''
    let displayVal2 = rawVal2 ? String(rawVal2) : ''
    if (fieldDef.type === 'date') {
      displayVal1 = formatDisplayDate(rawVal1)
      displayVal2 = formatDisplayDate(rawVal2)
    } else if (fieldDef.type === 'gender') {
      displayVal1 = formatDisplayGender(rawVal1)
      displayVal2 = formatDisplayGender(rawVal2)
    }

    // Kiểm tra giống nhau
    // Nếu cả hai cùng để trống hoặc có cùng giá trị chuẩn hóa -> Coi là giống nhau
    const isIdentical = (!hasVal1 && !hasVal2) || (norm1 === norm2)

    let isOneSideEmpty = false
    let emptySide = null
    let recommendedSide = preferredSide

    if (isIdentical) {
      identicalCount += 1
      recommendedSide = hasVal1 ? 'p1' : (hasVal2 ? 'p2' : preferredSide)
    } else {
      differentCount += 1
      if (hasVal1 && !hasVal2) {
        // Một bên có, bên kia để trống -> mặc định chọn bên có sẵn dữ liệu
        isOneSideEmpty = true
        emptySide = 'p2'
        recommendedSide = 'p1'
      } else if (!hasVal1 && hasVal2) {
        isOneSideEmpty = true
        emptySide = 'p1'
        recommendedSide = 'p2'
      } else {
        // Cả 2 đều có dữ liệu nhưng khác nhau:
        // Gợi ý chọn bên cập nhật gần đây hơn, nếu không rõ thì chọn preferredSide
        recommendedSide = recentSide || preferredSide
      }
    }

    initialSelections[fieldDef.key] = recommendedSide

    const recommendedValue = recommendedSide === 'p1' ? rawVal1 : rawVal2

    return {
      key: fieldDef.key,
      label: fieldDef.label,
      type: fieldDef.type,
      category: fieldDef.category,
      val1: rawVal1,
      val2: rawVal2,
      displayVal1: displayVal1 || '(Để trống)',
      displayVal2: displayVal2 || '(Để trống)',
      hasVal1,
      hasVal2,
      isIdentical,
      isOneSideEmpty,
      emptySide,
      recommendedSide,
      recommendedValue,
    }
  })

  return {
    fields,
    identicalCount,
    differentCount,
    initialSelections,
  }
}

/**
 * Tổng hợp thông tin hồ sơ bệnh nhân cuối cùng sau khi chọn từng trường (Preview Profile)
 * @param {Object} patient1 
 * @param {Object} patient2 
 * @param {string} retainedPatientId - ID của hồ sơ được chọn giữ lại (Target Patient)
 * @param {Record<string, 'p1'|'p2'>} fieldSelections - Lựa chọn từng trường
 * @returns {Object}
 */
export function buildMergedPatientProfile(patient1, patient2, retainedPatientId, fieldSelections = {}) {
  const isP1Retained = String(patient1?.id || patient1?.patientId) === String(retainedPatientId)
  const retainedPatient = isP1Retained ? patient1 : patient2
  const otherPatient = isP1Retained ? patient2 : patient1

  const profile = {
    ...retainedPatient,
    retainedPatientId: retainedPatient?.id || retainedPatient?.patientId,
    retainedPatientCode: retainedPatient?.patientCode,
    otherPatientId: otherPatient?.id || otherPatient?.patientId,
    otherPatientCode: otherPatient?.patientCode,
  }

  MERGE_COMPARISON_FIELDS.forEach((f) => {
    const selectedSide = fieldSelections[f.key] || 'p1'
    const chosenPatient = selectedSide === 'p1' ? patient1 : patient2
    const chosenValue = getPatientFieldValue(chosenPatient, f)
    profile[f.key] = chosenValue

    // Đồng bộ alias nếu có
    if (f.key === 'phone') {
      profile.phoneNumber = chosenValue
    }
  })

  return profile
}

/**
 * Kiểm tra tính hợp lệ trước khi thực hiện gộp 2 hồ sơ bệnh nhân (TC-01, TC-03)
 * @param {Object} sourcePatient - Hồ sơ bị gộp (phụ, sẽ chuyển sang trạng thái MERGED)
 * @param {Object} targetPatient - Hồ sơ giữ lại (chính, nhận toàn bộ dữ liệu)
 * @param {string} [reason] - Lý do gộp hồ sơ
 * @param {Object} [options]
 * @returns {{ allowed: boolean, message: string | null, conflictType?: string }}
 */
export function validatePatientMerge(sourcePatient, targetPatient, reason = '', options = {}) {
  if (!sourcePatient || !targetPatient) {
    return {
      allowed: false,
      message: 'Vui lòng chọn đầy đủ hồ sơ giữ lại và hồ sơ bị gộp.',
    }
  }

  const sourceId = String(sourcePatient.id || sourcePatient.patientId || '')
  const targetId = String(targetPatient.id || targetPatient.patientId || '')

  if (!sourceId || !targetId) {
    return {
      allowed: false,
      message: 'Không xác định được mã định danh của hồ sơ bệnh nhân.',
    }
  }

  // 1. Không thể gộp hồ sơ vào chính nó (CANNOT_MERGE_SAME_PATIENT)
  if (sourceId === targetId) {
    return {
      allowed: false,
      message: 'Không thể gộp một hồ sơ vào chính nó. Vui lòng chọn 2 hồ sơ khác nhau.',
    }
  }

  // 2. Kiểm tra trạng thái đã gộp (PATIENT_ALREADY_MERGED - TC-03)
  const isSourceMerged = Boolean(sourcePatient.isMerged || sourcePatient.status === 'MERGED' || sourcePatient.mergedIntoPatientId)
  if (isSourceMerged) {
    return {
      allowed: false,
      message: `Hồ sơ nguồn [${sourcePatient.patientCode || 'Nguồn'}] đã ở trạng thái đã gộp trước đó. Không thể gộp tiếp.`,
    }
  }

  const isTargetMerged = Boolean(targetPatient.isMerged || targetPatient.status === 'MERGED' || targetPatient.mergedIntoPatientId)
  if (isTargetMerged) {
    return {
      allowed: false,
      message: `Hồ sơ đích [${targetPatient.patientCode || 'Đích'}] đã ở trạng thái đã gộp. Vui lòng chọn hồ sơ chính đang hoạt động.`,
    }
  }

  // 3. Kiểm tra mâu thuẫn danh tính trên bệnh án đã ký hoặc CCCD (QTN-33)
  const identityConflict = checkIdentityConflict(sourcePatient, targetPatient, options)
  if (identityConflict.hasConflict) {
    return {
      allowed: false,
      conflictType: identityConflict.conflictType,
      message: identityConflict.reason,
      recommendation: identityConflict.recommendation,
    }
  }

  // 4. Kiểm tra độ dài lý do
  const trimmedReason = String(reason || '').trim()
  if (trimmedReason.length > 500) {
    return {
      allowed: false,
      message: 'Lý do gộp hồ sơ không được vượt quá 500 ký tự.',
    }
  }

  return {
    allowed: true,
    message: null,
  }
}

/**
 * Xử lý thông báo lỗi phản hồi từ API gộp hồ sơ sang tiếng Việt thân thiện
 * @param {any} error 
 * @param {string} defaultMessage 
 * @returns {string}
 */
export function cleanMergeErrorMessage(error, defaultMessage = 'Không thể thực hiện gộp hồ sơ bệnh nhân.') {
  if (!error) return defaultMessage
  const responseData = error?.response?.data || {}
  const errorCode = responseData.code || responseData.error || ''
  const responseMsg = responseData.message || error?.message || ''

  if (errorCode === 'CANNOT_MERGE_SAME_PATIENT') {
    return 'Không thể gộp hồ sơ vào chính nó.'
  }
  if (errorCode === 'PATIENT_ALREADY_MERGED') {
    return 'Một trong hai hồ sơ đã ở trạng thái đã gộp trước đó.'
  }
  if (errorCode === 'PATIENT_IDENTITY_CONFLICT') {
    return 'Xung đột định danh: Hai hồ sơ có thông tin định danh (CCCD hoặc thông tin nhân khẩu) mâu thuẫn đã được ký khóa bệnh án.'
  }
  if (error?.response?.status === 403 || errorCode === 'ACCESS_DENIED') {
    return 'Bạn không có quyền thực hiện thao tác gộp hồ sơ bệnh nhân (Yêu cầu quyền Lễ tân hoặc Quản lý).'
  }
  if (error?.response?.status === 404 || errorCode === 'PATIENT_NOT_FOUND') {
    return 'Không tìm thấy một trong hai hồ sơ bệnh nhân trong hệ thống.'
  }

  return responseMsg || defaultMessage
}
