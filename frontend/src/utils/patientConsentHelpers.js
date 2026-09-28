import dayjs from 'dayjs'

/**
 * Danh mục phạm vi xử lý dữ liệu cá nhân (Chuẩn hóa từ NCL-15-CN-001 / ConsentScope)
 */
export const CONSENT_SCOPES = {
  TREATMENT: {
    key: 'TREATMENT',
    name: 'Khám chữa bệnh và lưu trữ bệnh án',
    shortName: 'Khám chữa bệnh',
    required: true,
    tagColor: 'green',
    description:
      'Sử dụng thông tin hành chính và dữ liệu y tế phục vụ khám bệnh, chẩn đoán, kê đơn, điều trị, theo dõi phác đồ và lưu trữ hồ sơ bệnh án theo Luật Khám bệnh, chữa bệnh.',
    impactWhenRemoved:
      'Phạm vi này là cốt lõi bắt buộc để phòng khám có thể tiếp nhận và điều trị. Nếu bệnh nhân không đồng ý cho mục đích này, phải thực hiện "Rút lại toàn bộ sự đồng ý".',
  },
  COMMUNICATION: {
    key: 'COMMUNICATION',
    name: 'Thông báo nhắc lịch hẹn và chăm sóc khách hàng',
    shortName: 'Nhắc lịch & Liên lạc',
    required: false,
    tagColor: 'blue',
    description:
      'Sử dụng số điện thoại, tin nhắn SMS, Zalo hoặc Email để gửi thông báo nhắc lịch tái khám, dặn dò uống thuốc, hướng dẫn sau khám và khảo sát chất lượng dịch vụ y tế.',
    impactWhenRemoved:
      'Dừng gửi toàn bộ tin nhắn SMS, Zalo, Email nhắc lịch tái khám, thông báo kết quả và ngừng mọi cuộc gọi khảo sát chăm sóc người bệnh sau khám.',
  },
  RESEARCH: {
    key: 'RESEARCH',
    name: 'Nghiên cứu khoa học và đào tạo y khoa nội bộ',
    shortName: 'Nghiên cứu & Thống kê',
    required: false,
    tagColor: 'purple',
    description:
      'Sử dụng dữ liệu sức khỏe đã được mã hóa/ẩn danh (anonymized) phục vụ công tác thống kê mô hình bệnh tật, nghiên cứu khoa học y học và nâng cao chất lượng phác đồ điều trị.',
    impactWhenRemoved:
      'Loại trừ toàn bộ dữ liệu y tế của người bệnh khỏi các báo cáo thống kê nghiên cứu khoa học, mô hình bệnh tật và hoạt động đào tạo chuyên môn nội bộ của phòng khám.',
  },
}

/**
 * Danh mục trạng thái của phiên bản phiếu đồng ý (ConsentHistoryStatus)
 */
export const CONSENT_HISTORY_STATUS = {
  AGREED: {
    code: 'AGREED',
    label: 'Đồng ý toàn bộ',
    color: 'success',
    tagColor: 'green',
    badgeStatus: 'success',
    description: 'Người bệnh đồng ý cho toàn bộ các phạm vi xử lý dữ liệu tiêu chuẩn.',
  },
  PARTIALLY_WITHDRAWN: {
    code: 'PARTIALLY_WITHDRAWN',
    label: 'Đã thu hẹp phạm vi',
    color: 'processing',
    tagColor: 'blue',
    badgeStatus: 'processing',
    description: 'Người bệnh đã chủ động rút bớt một hoặc nhiều mục phạm vi, chỉ duy trì các mục còn lại.',
  },
  WITHDRAWN: {
    code: 'WITHDRAWN',
    label: 'Đã rút lại toàn bộ',
    color: 'error',
    tagColor: 'red',
    badgeStatus: 'error',
    description: 'Người bệnh đã rút lại toàn bộ sự đồng ý. Phòng khám hạn chế sử dụng dữ liệu cho mục đích ngoài khám chữa bệnh.',
  },
}

/**
 * Tính toán tác động nghiệp vụ khi thu hẹp hoặc rút lại sự đồng ý
 * Dùng để hiển thị bản xem trước đối soát trước khi chốt lưu phiên bản mới
 *
 * @param {Array<string>} currentScopes - Mảng các mã phạm vi hiện tại (vd: ['TREATMENT', 'COMMUNICATION', 'RESEARCH'])
 * @param {Array<string>} newScopes - Mảng các mã phạm vi mới được chọn
 * @param {boolean} isWithdrawingAll - Có phải đang rút lại toàn bộ hay không
 * @returns {Object} { newScopesList, removedScopesList, activeScopesText, stoppedActivities }
 */
export function calculateConsentImpact(currentScopes = [], newScopes = [], isWithdrawingAll = false) {
  if (isWithdrawingAll) {
    return {
      newScopesList: [],
      removedScopesList: Object.keys(CONSENT_SCOPES),
      activeScopesText: ['Không có (Đã rút lại toàn bộ sự đồng ý)'],
      stoppedActivities: [
        'Dừng gửi tin nhắn SMS, Zalo, Email nhắc lịch khám và thông báo y tế.',
        'Dừng các cuộc gọi khảo sát chăm sóc khách hàng và hướng dẫn sau khám.',
        'Loại trừ dữ liệu khỏi mọi báo cáo nghiên cứu khoa học, thống kê mô hình bệnh tật.',
        'Hạn chế tối đa việc truy xuất thông tin cá nhân cho các mục đích ngoài quy định khám chữa bệnh bắt buộc.',
      ],
      legalRetentionNotice:
        'Lưu ý: Dữ liệu hồ sơ bệnh án đã phát sinh trong các lượt khám trước đây vẫn được lưu trữ bảo mật tối thiểu 10 năm theo Luật Khám bệnh, chữa bệnh.',
    }
  }

  const currentSet = new Set(currentScopes || [])
  const newSet = new Set(newScopes || [])

  const keptScopes = []
  const removedScopes = []
  const stoppedActivities = []

  Object.values(CONSENT_SCOPES).forEach((scope) => {
    if (newSet.has(scope.key)) {
      keptScopes.push(scope)
    } else if (currentSet.has(scope.key)) {
      removedScopes.push(scope)
      stoppedActivities.push(scope.impactWhenRemoved)
    }
  })

  // Nếu người bệnh bỏ cả các mục không có trong currentScopes (ví dụ từ chối trước)
  if (stoppedActivities.length === 0 && removedScopes.length === 0 && keptScopes.length < Object.keys(CONSENT_SCOPES).length) {
    Object.values(CONSENT_SCOPES).forEach((scope) => {
      if (!newSet.has(scope.key) && scope.key !== 'TREATMENT') {
        stoppedActivities.push(scope.impactWhenRemoved)
      }
    })
  }

  return {
    newScopesList: keptScopes,
    removedScopesList: removedScopes,
    activeScopesText: keptScopes.map((s) => s.name),
    stoppedActivities:
      stoppedActivities.length > 0
        ? stoppedActivities
        : ['Không có hoạt động nào bị dừng lại (giữ nguyên toàn bộ phạm vi).'],
    legalRetentionNotice:
      'Các hoạt động khám chữa bệnh trực tiếp vẫn được bảo đảm thực hiện bình thường theo phạm vi bắt buộc.',
  }
}

/**
 * Kiểm tra tính hợp lệ khi điều chỉnh phạm vi đồng ý
 *
 * @param {Array<string>} selectedScopes - Các phạm vi được chọn
 * @param {boolean} isWithdrawingAll - Rút lại toàn bộ
 * @returns {Object} { valid, message }
 */
export function validateScopeAdjustment(selectedScopes = [], isWithdrawingAll = false) {
  if (isWithdrawingAll) {
    return { valid: true, message: '' }
  }

  if (!Array.isArray(selectedScopes) || selectedScopes.length === 0) {
    return {
      valid: false,
      message: 'Vui lòng chọn ít nhất một phạm vi đồng ý hoặc sử dụng chức năng "Rút lại toàn bộ sự đồng ý".',
    }
  }

  if (!selectedScopes.includes('TREATMENT')) {
    return {
      valid: false,
      message:
        'Phạm vi "Khám chữa bệnh và lưu trữ bệnh án" là bắt buộc khi duy trì phiếu đồng ý. Nếu người bệnh không muốn cho phép khám chữa bệnh, vui lòng chọn "Rút lại toàn bộ sự đồng ý".',
    }
  }

  return { valid: true, message: '' }
}

/**
 * Lấy thông tin hiển thị trạng thái của một phiên bản phiếu đồng ý
 */
export function getConsentStatusMeta(statusStr) {
  const norm = String(statusStr || '').toUpperCase()
  return CONSENT_HISTORY_STATUS[norm] || {
    code: norm,
    label: statusStr || 'Không xác định',
    color: 'default',
    tagColor: 'default',
    badgeStatus: 'default',
    description: '',
  }
}

/**
 * Giải thích ngắn gọn, dễ hiểu về quy định không thể xóa ngay hồ sơ bệnh án theo QTN-19
 * để lễ tân truyền đạt trực tiếp cho bệnh nhân
 */
export const QTN19_PLAIN_EXPLANATION = {
  title: 'Quy định lưu trữ hồ sơ bệnh án (Luật Khám bệnh, chữa bệnh)',
  summaryForPatient:
    'Theo Luật Khám bệnh, chữa bệnh của Bộ Y tế, hồ sơ bệnh án là tài liệu y khoa bắt buộc cơ sở khám chữa bệnh phải lưu trữ bảo mật tối thiểu 10 năm kể từ ngày lượt khám kết thúc. Quy định này nhằm bảo vệ quyền lợi y tế trọn đời, phục vụ theo dõi tiền sử bệnh lý và đối soát pháp lý khi cần thiết. Vì vậy, phòng khám không thể xóa ngay hồ sơ bệnh án trước thời hạn pháp luật quy định.',
  actionTakenText:
    'Hệ thống sẽ ghi nhận yêu cầu của quý khách, đồng thời lập tức thu hồi mọi quyền đồng ý đối với các hoạt động ngoài khám chữa bệnh (ngừng gửi tin nhắn nhắc hẹn, ngừng khảo sát, nghiên cứu) và bảo mật tuyệt đối dữ liệu y tế của quý khách.',
}

/**
 * Định dạng ngày giờ
 */
export function formatDateTime(dateStr) {
  if (!dateStr) return '—'
  const d = dayjs(dateStr)
  return d.isValid() ? d.format('DD/MM/YYYY HH:mm') : '—'
}

/**
 * Định dạng ngày
 */
export function formatDate(dateStr) {
  if (!dateStr) return '—'
  const d = dayjs(dateStr)
  return d.isValid() ? d.format('DD/MM/YYYY') : '—'
}
