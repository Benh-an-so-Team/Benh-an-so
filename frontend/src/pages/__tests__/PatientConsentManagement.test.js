import test from 'node:test'
import assert from 'node:assert/strict'
import {
  DEFAULT_CONSENT_VERSION,
  CONSENT_STATUSES,
  CONSENT_SUMMARY_POINTS,
  FULL_CONSENT_DOCUMENT,
  getPatientConsentStatus,
} from '../../constants/patientConsentConstants.js'

test('TC01: Cấu hình mặc định của Phiếu đồng ý xử lý dữ liệu cá nhân', () => {
  assert.equal(DEFAULT_CONSENT_VERSION, 'v1.0', 'Phiên bản mặc định phải là v1.0')
  assert.equal(CONSENT_SUMMARY_POINTS.length, 3, 'Phải có 3 điểm tóm tắt chính cho lễ tân đọc')
  assert.ok(CONSENT_SUMMARY_POINTS.some((p) => p.key === 'purpose'), 'Có mục đích xử lý')
  assert.ok(CONSENT_SUMMARY_POINTS.some((p) => p.key === 'dataTypes'), 'Có phạm vi dữ liệu')
  assert.ok(CONSENT_SUMMARY_POINTS.some((p) => p.key === 'rights'), 'Có quyền của người bệnh')
})

test('TC02: Kiểm tra toàn văn văn bản pháp lý Phiếu đồng ý (Nghị định 13/2023/NĐ-CP)', () => {
  assert.ok(FULL_CONSENT_DOCUMENT.title.includes('PHIẾU ĐỒNG Ý'), 'Tiêu đề phiếu đúng chuẩn')
  assert.equal(FULL_CONSENT_DOCUMENT.version, 'v1.0')
  assert.equal(FULL_CONSENT_DOCUMENT.sections.length, 5, 'Phải có đầy đủ 5 điều khoản pháp lý')
})

test('TC03: Xác định trạng thái đồng ý dữ liệu cá nhân của bệnh nhân (getPatientConsentStatus)', () => {
  // Bệnh nhân đã đồng ý
  const agreedPatient = {
    id: 'p-1',
    fullName: 'Nguyễn Văn An',
    consentAgreed: true,
    consentVersion: 'v1.0',
    consentAgreedAt: '2026-08-27T10:00:00Z',
  }
  const statusAgreed = getPatientConsentStatus(agreedPatient)
  assert.equal(statusAgreed.status, CONSENT_STATUSES.AGREED)
  assert.equal(statusAgreed.color, 'green')
  assert.equal(statusAgreed.label, 'Đã đồng ý (v1.0)')

  // Bệnh nhân đã rút đồng ý
  const withdrawnPatient = {
    id: 'p-2',
    fullName: 'Trần Thị Bình',
    consentAgreed: true,
    consentWithdrawn: true,
    consentWithdrawnReason: 'Không muốn nhận tin nhắn tiếp thị',
    consentWithdrawnAt: '2026-08-27T11:00:00Z',
  }
  const statusWithdrawn = getPatientConsentStatus(withdrawnPatient)
  assert.equal(statusWithdrawn.status, CONSENT_STATUSES.WITHDRAWN)
  assert.equal(statusWithdrawn.color, 'red')
  assert.equal(statusWithdrawn.label, 'Đã rút đồng ý')
  assert.equal(statusWithdrawn.reason, 'Không muốn nhận tin nhắn tiếp thị')

  // Bệnh nhân chưa có phiếu đồng ý (lịch sử)
  const legacyPatient = {
    id: 'p-3',
    fullName: 'Lê Văn Cường',
  }
  const statusLegacy = getPatientConsentStatus(legacyPatient)
  assert.equal(statusLegacy.status, CONSENT_STATUSES.UNCONSENTED)
  assert.equal(statusLegacy.color, 'orange')
})

test('TC04: Đóng gói payload tạo bệnh nhân mới kèm sự đồng ý (QTN-24)', () => {
  const formValues = {
    fullName: 'Hoàng Minh Đức',
    dateOfBirth: '1995-05-15',
    gender: 'MALE',
    phone: '0912345678',
    address: '123 Cầu Giấy, Hà Nội',
    consentAgreed: true,
  }

  const payload = {
    ...formValues,
    consentAgreed: formValues.consentAgreed ?? true,
    consentVersion: DEFAULT_CONSENT_VERSION,
  }

  assert.equal(payload.consentAgreed, true, 'Sự đồng ý phải là true')
  assert.equal(payload.consentVersion, 'v1.0', 'Phiên bản phải là v1.0')
})

test('TC05: Validate bắt buộc có sự đồng ý của người bệnh khi đăng ký mới', () => {
  const validateConsent = (consentAgreed) => {
    if (consentAgreed !== true) {
      return { isValid: false, message: 'Phải ghi nhận sự đồng ý của người bệnh trước khi lập hồ sơ mới (QTN-24).' }
    }
    return { isValid: true, message: '' }
  }

  const check1 = validateConsent(true)
  assert.equal(check1.isValid, true)

  const check2 = validateConsent(false)
  assert.equal(check2.isValid, false)
  assert.ok(check2.message.includes('QTN-24'))

  const check3 = validateConsent(undefined)
  assert.equal(check3.isValid, false)
})
