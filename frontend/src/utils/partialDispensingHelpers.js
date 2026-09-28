export const getRemainingQuantity = (item) => {
  if (!item) return 0
  if (typeof item.remainingQuantity === 'number') {
    return Math.max(0, item.remainingQuantity)
  }
  const prescribed = Number(item.quantity || 0)
  const dispensed = Number(item.dispensedQuantity || 0)
  return Math.max(0, prescribed - dispensed)
}

export const validateDispenseQuantity = (inputQty, remainingQty) => {
  if (inputQty === null || inputQty === undefined || inputQty === '') {
    return { isValid: false, error: 'Số lượng không được để trống.' }
  }
  const num = Number(inputQty)
  if (isNaN(num)) {
    return { isValid: false, error: 'Số lượng phải là một số hợp lệ.' }
  }
  if (num < 0) {
    return { isValid: false, error: 'Số lượng không được âm (tối thiểu là 0).' }
  }
  if (num > remainingQty) {
    return {
      isValid: false,
      error: `Số lượng thực cấp (${num}) không được vượt quá số lượng còn lại (${remainingQty}).`,
    }
  }
  return { isValid: true, error: null }
}

export const calculateItemShortage = (inputQty, remainingQty) => {
  const validRemaining = Math.max(0, Number(remainingQty || 0))
  const validDispensed = Math.max(0, Number(inputQty || 0))
  return Math.max(0, validRemaining - validDispensed)
}

export const buildPartialDispensePayload = (quantities = {}, items = []) => {
  if (!Array.isArray(items) || items.length === 0) {
    return { payloadItems: [], hasAnyItemToDispense: false }
  }

  const payloadItems = []

  items.forEach((item) => {
    const itemId = item.id || item.prescriptionItemId
    if (!itemId) return

    const remaining = getRemainingQuantity(item)
    const rawValue = quantities[itemId] !== undefined ? quantities[itemId] : remaining
    const qty = Math.floor(Number(rawValue || 0))

    if (qty > 0) {
      payloadItems.push({
        prescriptionItemId: itemId,
        quantity: Math.min(qty, remaining),
      })
    }
  })

  return {
    payloadItems,
    hasAnyItemToDispense: payloadItems.length > 0,
  }
}

export const hasShortageAfterDispense = (quantities = {}, items = []) => {
  if (!Array.isArray(items) || items.length === 0) return false

  return items.some((item) => {
    const itemId = item.id || item.prescriptionItemId
    const remaining = getRemainingQuantity(item)
    if (remaining <= 0) return false

    const rawValue = quantities[itemId] !== undefined ? quantities[itemId] : remaining
    const qty = Math.floor(Number(rawValue || 0))
    return qty < remaining
  })
}

export const mapDispenseError = (error, prescriptionId, payloadItems = []) => {
  const status = error?.response?.status || error?.status || 0
  const responseData = error?.response?.data || error?.data || {}
  const code = responseData?.code || ''
  const details = responseData?.details || {}

  if (status === 409 && (code === 'INSUFFICIENT_STOCK' || Array.isArray(details.shortages))) {
    const shortages = Array.isArray(details.shortages) ? details.shortages : []
    return {
      status: 409,
      code: 'INSUFFICIENT_STOCK',
      message: 'Không đủ số lượng thuốc tồn kho khả dụng để thực hiện cấp phát.',
      shortages,
    }
  }

  if (code === 'DATA_INTEGRITY_VIOLATION' || (status === 409 && code === 'DATA_INTEGRITY_VIOLATION')) {
    return {
      status: 409,
      code: 'DATA_INTEGRITY_VIOLATION',
      message:
        'Dữ liệu cấp phát không hợp lệ hoặc bị xung đột ràng buộc hệ thống. Vui lòng tải lại trang và thử lại. Nếu lỗi vẫn tiếp diễn, liên hệ quản trị viên hệ thống.',
      shortages: [],
    }
  }

  if (status === 409) {
    const isDispensedOrCancelled =
      code === 'PRESCRIPTION_ALREADY_DISPENSED' ||
      code === 'PRESCRIPTION_CANCELLED' ||
      code === 'PRESCRIPTION_INVALID_STATUS' ||
      String(responseData?.message || '').toLowerCase().includes('already dispensed')
    return {
      status: 409,
      code: code || 'PRESCRIPTION_INVALID_STATUS',
      message: isDispensedOrCancelled
        ? 'Đơn thuốc đã được cấp phát đầy đủ hoặc đã bị hủy, không thể tiếp tục cấp phát.'
        : (responseData?.message || 'Đơn thuốc đã được cấp phát đầy đủ hoặc đã bị hủy, không thể tiếp tục cấp phát.'),
      shortages: [],
    }
  }

  if (status === 400) {
    return {
      status: 400,
      code: code || 'VALIDATION_FAILED',
      message: responseData?.message || 'Số lượng cấp phát không hợp lệ.',
      shortages: [],
    }
  }

  if (status === 403) {
    return {
      status: 403,
      code: 'FORBIDDEN',
      message: 'Bạn không có quyền thực hiện cấp phát thuốc.',
      shortages: [],
    }
  }

  if (status === 500) {
    console.error('[PartialDispense 500 Error]', {
      prescriptionId,
      payload: payloadItems,
      response: responseData,
    })
    return {
      status: 500,
      code: 'INTERNAL_SERVER_ERROR',
      message:
        'Hệ thống đang gặp sự cố khi xử lý cấp phát một phần. Vui lòng liên hệ quản trị viên hệ thống (bộ phận kỹ thuật) để được hỗ trợ trước khi thử lại.',
      shortages: [],
    }
  }

  return {
    status,
    code: code || 'UNKNOWN_ERROR',
    message: responseData?.message || 'Thao tác cấp phát một phần không thành công. Vui lòng thử lại.',
    shortages: [],
  }
}

export const canUserDispense = (roles = [], permissions = []) => {
  const normalizedRoles = (roles || []).map((r) => String(r || '').toLowerCase().replace(/^role_/, ''))
  const normalizedPermissions = (permissions || []).map((p) => String(p || '').toUpperCase().replace(/^PERMISSION_/, ''))

  const isPharmacist = normalizedRoles.includes('pharmacist')
  const isAdmin = normalizedRoles.includes('admin')
  const hasPerm = normalizedPermissions.includes('PRESCRIPTION_UPDATE_STATUS') || normalizedPermissions.includes('PHARMACY_READ')

  const isPureDoctor = normalizedRoles.includes('doctor') && !isPharmacist && !isAdmin
  return (isPharmacist || isAdmin || hasPerm) && !isPureDoctor
}

export const canUserViewDispenseHistory = (roles = [], permissions = []) => {
  const normalizedRoles = (roles || []).map((r) => String(r || '').toLowerCase().replace(/^role_/, ''))
  const normalizedPermissions = (permissions || []).map((p) => String(p || '').toUpperCase().replace(/^PERMISSION_/, ''))

  return (
    normalizedRoles.includes('doctor') ||
    normalizedRoles.includes('pharmacist') ||
    normalizedRoles.includes('admin') ||
    normalizedRoles.includes('manager') ||
    normalizedPermissions.includes('PRESCRIPTION_DISPENSE_HISTORY_READ') ||
    normalizedPermissions.includes('PRESCRIPTION_READ')
  )
}

export const calculateBillingItemAmount = (item, prescriptionStatus) => {
  if (!item) return { effectiveQty: 0, unitPrice: 0, amount: 0 }

  const unitPrice = Number(item.unitPrice || item.price || 0)
  let effectiveQty = 0

  if (prescriptionStatus === 'PARTIALLY_DISPENSED') {
    effectiveQty = Math.max(0, Number(item.dispensedQuantity || 0))
  } else if (prescriptionStatus === 'DISPENSED') {
    effectiveQty = Math.max(0, Number(item.dispensedQuantity != null ? item.dispensedQuantity : item.quantity || 0))
  } else {
    effectiveQty = Math.max(0, Number(item.quantity || 0))
  }

  return {
    effectiveQty,
    unitPrice,
    amount: effectiveQty * unitPrice,
  }
}

export const getDaysUntilExpiry = (expiryDate, referenceDate = new Date()) => {
  if (!expiryDate) return null
  const expiry = new Date(expiryDate)
  if (isNaN(expiry.getTime())) return null
  const ref = new Date(referenceDate)
  const expiryUtc = Date.UTC(expiry.getFullYear(), expiry.getMonth(), expiry.getDate())
  const refUtc = Date.UTC(ref.getFullYear(), ref.getMonth(), ref.getDate())
  const msPerDay = 1000 * 60 * 60 * 24
  return Math.round((expiryUtc - refUtc) / msPerDay)
}

export const getExpiryStatusTag = (expiryDate, referenceDate = new Date()) => {
  const days = getDaysUntilExpiry(expiryDate, referenceDate)
  if (days === null) {
    return { color: 'default', label: 'Không rõ HSD', isExpired: false, isNearExpiry: false, days: null }
  }
  if (days < 0) {
    return { color: 'red', label: `Đã hết hạn (${Math.abs(days)} ngày trước)`, isExpired: true, isNearExpiry: false, days }
  }
  if (days <= 30) {
    return { color: 'orange', label: `Sắp hết hạn (còn ${days} ngày)`, isExpired: false, isNearExpiry: true, days }
  }
  return { color: 'green', label: `Còn hạn (${days} ngày)`, isExpired: false, isNearExpiry: false, days }
}

export const validateBatchChangeReason = (reason, isDifferentFromFefo = false) => {
  if (!isDifferentFromFefo) {
    return { isValid: true, error: null }
  }
  if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
    return {
      isValid: false,
      error: 'Vui lòng nhập lý do khi đổi sang lô thuốc khác với đề xuất FEFO.',
    }
  }
  return { isValid: true, error: null }
}

export const buildFefoDispensePayload = (
  quantities = {},
  items = [],
  selectedBatches = {},
  batchChangeReasons = {},
  suggestionsMap = {}
) => {
  if (!Array.isArray(items) || items.length === 0) {
    return { payloadItems: [], hasAnyItemToDispense: false, validationErrors: {}, isValid: true }
  }

  const payloadItems = []
  const validationErrors = {}

  items.forEach((item) => {
    const itemId = item.id || item.prescriptionItemId
    if (!itemId) return

    const remaining = getRemainingQuantity(item)
    const rawValue = quantities[itemId] !== undefined ? quantities[itemId] : remaining
    const qty = Math.floor(Number(rawValue || 0))

    if (qty > 0) {
      const payloadItem = {
        prescriptionItemId: itemId,
        quantity: Math.min(qty, remaining),
      }

      const suggestion = suggestionsMap[itemId]
      const fefoBatches = suggestion?.batches || []
      const fefoFirstBatchId = fefoBatches[0]?.batchId || null
      const selectedBatchId = selectedBatches[itemId] || fefoFirstBatchId

      if (selectedBatchId) {
        payloadItem.batchId = selectedBatchId

        const isOverridden = fefoFirstBatchId && String(selectedBatchId) !== String(fefoFirstBatchId)
        if (isOverridden) {
          const reason = (batchChangeReasons[itemId] || '').trim()
          const check = validateBatchChangeReason(reason, true)
          if (!check.isValid) {
            validationErrors[itemId] = check.error
          } else {
            payloadItem.batchChangeReason = reason
          }
        }
      }

      payloadItems.push(payloadItem)
    }
  })

  return {
    payloadItems,
    hasAnyItemToDispense: payloadItems.length > 0,
    validationErrors,
    isValid: Object.keys(validationErrors).length === 0,
  }
}
