/**
 * Tiện ích hỗ trợ Quản lý thuốc kiểm soát đặc biệt (NCL-06-CN-014).
 * Tuân thủ QTN-39 (Bắt buộc xác nhận bổ sung khi kê đơn và cấp phát, ghi sổ theo dõi bất biến)
 * và QTN-06 (Kiểm tra tồn kho khả dụng khi cấp phát).
 */

export const SPECIAL_CONTROL_GROUPS = {
  NARCOTIC: {
    code: 'NARCOTIC',
    label: 'Thuốc gây nghiện',
    shortLabel: 'Gây nghiện',
    tagColor: 'red',
    textColor: '#b91c1c',
    bgColor: '#fef2f2',
    borderColor: '#fca5a5',
    severity: 'critical',
  },
  PSYCHOTROPIC: {
    code: 'PSYCHOTROPIC',
    label: 'Thuốc hướng thần',
    shortLabel: 'Hướng thần',
    tagColor: 'volcano',
    textColor: '#c2410c',
    bgColor: '#fff7ed',
    borderColor: '#fdba74',
    severity: 'critical',
  },
  PRECURSOR: {
    code: 'PRECURSOR',
    label: 'Thuốc tiền chất',
    shortLabel: 'Tiền chất',
    tagColor: 'orange',
    textColor: '#b45309',
    bgColor: '#fffbeb',
    borderColor: '#fcd34d',
    severity: 'warning',
  },
  RADIOACTIVE: {
    code: 'RADIOACTIVE',
    label: 'Thuốc phóng xạ',
    shortLabel: 'Phóng xạ',
    tagColor: 'purple',
    textColor: '#7e22ce',
    bgColor: '#faf5ff',
    borderColor: '#d8b4fe',
    severity: 'warning',
  },
  TOXIC: {
    code: 'TOXIC',
    label: 'Thuốc độc / Dược chất độc',
    shortLabel: 'Thuốc độc',
    tagColor: 'magenta',
    textColor: '#be185d',
    bgColor: '#fdf2f8',
    borderColor: '#fbcfe8',
    severity: 'warning',
  },
  COMBINED: {
    code: 'COMBINED',
    label: 'Thuốc dạng phối hợp',
    shortLabel: 'Dạng phối hợp',
    tagColor: 'blue',
    textColor: '#1d4ed8',
    bgColor: '#eff6ff',
    borderColor: '#93c5fd',
    severity: 'info',
  },
}

export const SPECIAL_CONTROL_ACTION_TYPES = {
  PRESCRIBED: {
    code: 'PRESCRIBED',
    label: 'Kê đơn',
    tagColor: 'blue',
  },
  DISPENSED: {
    code: 'DISPENSED',
    label: 'Cấp phát',
    tagColor: 'green',
  },
  RETURNED: {
    code: 'RETURNED',
    label: 'Trả thuốc',
    tagColor: 'orange',
  },
  DISPOSED: {
    code: 'DISPOSED',
    label: 'Hủy / Tiêu hủy',
    tagColor: 'red',
  },
}

export const PRESET_SPECIAL_CONTROL_PRESCRIBE_REASONS = [
  'Đau cấp tính nặng sau phẫu thuật / chấn thương',
  'Đau do ung thư giai đoạn muộn (chăm sóc giảm nhẹ)',
  'Động kinh kháng trị cần phối hợp thuốc hướng thần',
  'Rối loạn tâm thần nặng có chỉ định chuyên khoa',
  'Gây mê / hồi sức tích cực theo phác đồ',
]

export const PRESET_SPECIAL_CONTROL_DISPENSE_REASONS = [
  'Đã đối chiếu đơn thuốc hợp lệ, kiểm tra CCCD/CMND người nhận thuốc',
  'Người nhà bệnh nhân nhận thay, đã xuất trình giấy tờ tùy thân và cam kết',
  'Cấp phát trực tiếp tại buồng bệnh có chữ ký xác nhận của điều dưỡng',
  'Cấp phát ngoại trú đủ điều kiện theo quy định của Bộ Y tế',
]

/**
 * Lấy metadata cấu hình cho nhóm kiểm soát đặc biệt
 * @param {string} group Mã nhóm (NARCOTIC, PSYCHOTROPIC, ...)
 * @returns {object | null}
 */
export function getSpecialControlMeta(group) {
  if (!group) return null
  const key = String(group).toUpperCase()
  return SPECIAL_CONTROL_GROUPS[key] || null
}

/**
 * Kiểm tra tính hợp lệ của form đánh dấu thuốc kiểm soát đặc biệt
 * @param {object} values
 * @returns {{ valid: boolean, error: string | null }}
 */
export function validateSpecialControlMedicineForm(values = {}) {
  const isSpecial = Boolean(values.isSpecialControl)
  if (!isSpecial) {
    return { valid: true, isValid: true, error: null }
  }

  if (!values.specialControlGroup) {
    return {
      valid: false,
      isValid: false,
      error: 'Vui lòng chọn nhóm thuốc kiểm soát đặc biệt cho thuốc (Gây nghiện, Hướng thần, Tiền chất...).',
    }
  }

  const validGroups = Object.keys(SPECIAL_CONTROL_GROUPS)
  if (!validGroups.includes(String(values.specialControlGroup).toUpperCase())) {
    return {
      valid: false,
      isValid: false,
      error: 'Nhóm thuốc kiểm soát đặc biệt không hợp lệ.',
    }
  }

  if (values.specialControlNote && typeof values.specialControlNote === 'string') {
    if (values.specialControlNote.trim().length > 500) {
      return {
        valid: false,
        isValid: false,
        error: 'Ghi chú cảnh báo lâm sàng specialControlNote không được vượt quá 500 ký tự.',
      }
    }
  }

  return { valid: true, isValid: true, error: null }
}

/**
 * Kiểm tra tính hợp lệ của lý do xác nhận kê đơn (Bác sĩ)
 * @param {string} reason
 * @returns {{ valid: boolean, isValid: boolean, error: string | null, trimmedReason: string }}
 */
export function validatePrescribeConfirmReason(reason) {
  if (typeof reason !== 'string') {
    return {
      valid: false,
      isValid: false,
      error: 'Vui lòng nhập lý do chỉ định lâm sàng bắt buộc.',
      trimmedReason: '',
    }
  }

  const trimmed = reason.trim()
  if (!trimmed) {
    return {
      valid: false,
      isValid: false,
      error: 'Vui lòng nhập lý do chỉ định lâm sàng khi kê thuốc kiểm soát đặc biệt (1 - 500 ký tự).',
      trimmedReason: '',
    }
  }

  if (trimmed.length > 500) {
    return {
      valid: false,
      isValid: false,
      error: 'Lý do chỉ định không được vượt quá 500 ký tự.',
      trimmedReason: trimmed.slice(0, 500),
    }
  }

  return {
    valid: true,
    isValid: true,
    error: null,
    trimmedReason: trimmed,
  }
}

/**
 * Kiểm tra tính hợp lệ khi Dược sĩ cấp phát thuốc kiểm soát đặc biệt
 * Tuân thủ QTN-06 (không cấp phát vượt tồn kho) và QTN-39 (xác nhận)
 * @param {object} params { batchId, quantity, availableStock, reason, receiverName, receiverIdCard, confirmed }
 * @returns {{ valid: boolean, isValid: boolean, error: string | null, trimmedReason?: string }}
 */
export function validateDispenseConfirm(params = {}) {
  if (
    params.receiverName !== undefined ||
    params.receiverIdCard !== undefined ||
    params.confirmed !== undefined
  ) {
    const receiverName = typeof params.receiverName === 'string' ? params.receiverName.trim() : ''
    if (!receiverName) {
      return {
        valid: false,
        isValid: false,
        error: 'Vui lòng nhập họ tên người nhận thuốc.',
      }
    }

    const idCard = typeof params.receiverIdCard === 'string' ? params.receiverIdCard.trim() : String(params.receiverIdCard || '').trim()
    if (!idCard) {
      return {
        valid: false,
        isValid: false,
        error: 'Vui lòng nhập số CCCD hoặc CMND của người nhận thuốc.',
      }
    }

    if (!/^\d+$/.test(idCard) || (idCard.length !== 9 && idCard.length !== 12)) {
      return {
        valid: false,
        isValid: false,
        error: 'Số CCCD hoặc CMND không hợp lệ (phải gồm 9 chữ số đối với CMND hoặc 12 chữ số đối với CCCD).',
      }
    }

    if (!params.confirmed) {
      return {
        valid: false,
        isValid: false,
        error: 'Vui lòng xác nhận cam kết đối chiếu trước khi thực hiện cấp phát thuốc kiểm soát đặc biệt.',
      }
    }

    return {
      valid: true,
      isValid: true,
      error: null,
    }
  }

  const { batchId, quantity, availableStock, reason } = params

  if (!batchId) {
    return {
      valid: false,
      isValid: false,
      error: 'Vui lòng chọn lô thuốc để xuất cấp phát.',
      trimmedReason: '',
    }
  }

  const numQty = Number(quantity)
  const numStock = Number(availableStock)

  if (isNaN(numQty) || numQty <= 0) {
    return {
      valid: false,
      isValid: false,
      error: 'Số lượng thuốc cấp phát phải lớn hơn 0.',
      trimmedReason: '',
    }
  }

  // QTN-06: Không cấp phát vượt tồn kho khả dụng
  if (!isNaN(numStock) && numQty > numStock) {
    return {
      valid: false,
      isValid: false,
      error: `Số lượng yêu cầu (${numQty}) vượt quá tồn kho khả dụng của lô (${numStock}). Không thể cấp phát theo quy định tồn kho.`,
      trimmedReason: '',
    }
  }

  if (typeof reason !== 'string' || !reason.trim()) {
    return {
      valid: false,
      isValid: false,
      error: 'Nội dung xác nhận cấp phát thuốc kiểm soát đặc biệt là bắt buộc.',
      trimmedReason: '',
    }
  }

  const trimmed = reason.trim()
  if (trimmed.length > 500) {
    return {
      valid: false,
      isValid: false,
      error: 'Nội dung xác nhận không được vượt quá 500 ký tự.',
      trimmedReason: trimmed.slice(0, 500),
    }
  }

  return {
    valid: true,
    isValid: true,
    error: null,
    trimmedReason: trimmed,
  }
}

/**
 * Ánh xạ mã lỗi HTTP từ Backend sang thông điệp tiếng Việt thân thiện
 * @param {object} error Lỗi Axios
 * @returns {string}
 */
export function mapSpecialControlErrorMessage(error) {
  const status = error?.response?.status
  const serverMsg = error?.response?.data?.message || ''

  if (status === 400) {
    if (serverMsg) return serverMsg
    return 'Thông tin thuốc kiểm soát đặc biệt không hợp lệ hoặc thiếu lý do xác nhận bắt buộc.'
  }

  if (status === 403) {
    return 'Bạn không có quyền thao tác trên danh mục hoặc đơn thuốc kiểm soát đặc biệt (yêu cầu vai trò Bác sĩ hoặc Dược sĩ).'
  }

  if (status === 404) {
    return 'Không tìm thấy thuốc hoặc bút toán trong sổ theo dõi.'
  }

  if (status === 409) {
    if (serverMsg?.toLowerCase().includes('stock') || serverMsg?.toLowerCase().includes('tồn')) {
      return 'Số lượng cấp phát vượt quá tồn kho khả dụng của lô thuốc (QTN-06).'
    }
    return serverMsg || 'Xung đột dữ liệu cấp phát thuốc. Vui lòng kiểm tra lại trạng thái đơn thuốc.'
  }

  return serverMsg || 'Không thể thực hiện thao tác. Vui lòng thử lại sau ít phút hoặc liên hệ quản trị viên.'
}
