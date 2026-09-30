import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Alert,
  App,
  Badge,
  Button,
  Form,
  Input,
  Modal,
  Popconfirm,
  Radio,
  Space,
  Spin,
  Switch,
  Table,
  Tabs,
  Tag,
  Tooltip,
  Typography,
  Upload,
} from 'antd'
import {
  AuditOutlined,
  CheckCircleOutlined,
  DeleteOutlined,
  DiffOutlined,
  ExclamationCircleOutlined,
  EyeOutlined,
  FileDoneOutlined,
  FileTextOutlined,
  HistoryOutlined,
  InfoCircleOutlined,
  PictureOutlined,
  PrinterOutlined,
  QuestionCircleOutlined,
  SaveOutlined,
  UploadOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'

import { useAuthContext } from '../context/AuthContext'
import systemApi from '../api/systemApi'
import documentPrintTemplateApi from '../api/documentPrintTemplateApi'
import {
  DOCUMENT_FIELDS,
  DOCUMENT_TYPES,
  DOCUMENT_TYPE_LABELS,
  SAMPLE_DATA,
  buildDefaultTemplateValues,
  compareTemplateDiff,
  parseFieldVisibility,
  serializeFieldVisibility,
  validateLogoFile,
} from '../utils/documentPrintTemplateHelpers'
import '../styles/documentPrintTemplate.css'

const { Title, Text, Paragraph } = Typography
const { TextArea } = Input

export default function DocumentPrintTemplatePage() {
  const { user } = useAuthContext()
  const { message, modal } = App.useApp()

  // User roles check - Admin only
  const isAdmin = useMemo(() => {
    const roles = (user?.roles || []).map((r) =>
      String(r || '').toLowerCase().replace(/^role_/, '')
    )
    return roles.includes('admin')
  }, [user?.roles])

  // Current active tab (INVOICE, PRESCRIPTION, VISIT_SUMMARY, HISTORY)
  const [activeTab, setActiveTab] = useState(DOCUMENT_TYPES.INVOICE)

  // Loading states
  const [initialLoading, setInitialLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [previewPdfLoading, setPreviewPdfLoading] = useState(false)

  // Base Clinic info from NCL-09-CN-002
  const [clinicConfig, setClinicConfig] = useState({})

  // Template form states stored per document type
  const [templates, setTemplates] = useState({
    [DOCUMENT_TYPES.INVOICE]: buildDefaultTemplateValues(DOCUMENT_TYPES.INVOICE, {}),
    [DOCUMENT_TYPES.PRESCRIPTION]: buildDefaultTemplateValues(DOCUMENT_TYPES.PRESCRIPTION, {}),
    [DOCUMENT_TYPES.VISIT_SUMMARY]: buildDefaultTemplateValues(DOCUMENT_TYPES.VISIT_SUMMARY, {}),
  })

  // Original pristine templates from server for dirty-checking
  const [pristineTemplates, setPristineTemplates] = useState({})

  // Local logo upload error
  const [logoError, setLogoError] = useState('')

  // Fullscreen modal preview
  const [fullscreenPreviewOpen, setFullscreenPreviewOpen] = useState(false)

  // Audit history state
  const [auditLogs, setAuditLogs] = useState([])
  const [auditLoading, setAuditLoading] = useState(false)
  const [diffModalVisible, setDiffModalVisible] = useState(false)
  const [selectedDiff, setSelectedDiff] = useState(null)

  // Check if current form is dirty (modified)
  const isCurrentFormDirty = useMemo(() => {
    if (activeTab === 'HISTORY') return false
    const current = templates[activeTab]
    const pristine = pristineTemplates[activeTab]
    if (!current || !pristine) return false

    return (
      current.templateName !== pristine.templateName ||
      current.title !== pristine.title ||
      current.logoUrl !== pristine.logoUrl ||
      Boolean(current.showLogo) !== Boolean(pristine.showLogo) ||
      current.legalInfo !== pristine.legalInfo ||
      current.footerText !== pristine.footerText ||
      serializeFieldVisibility(current.fieldVisibility) !==
        serializeFieldVisibility(pristine.fieldVisibility)
    )
  }, [activeTab, templates, pristineTemplates])

  // 1. Initial Load: Base clinic config & existing print templates
  const loadInitialData = useCallback(async () => {
    setInitialLoading(true)
    let fetchedClinic = {}

    // A. Fetch basic clinic config (prerequisite)
    try {
      const clinicRes = await systemApi.clinic()
      if (clinicRes?.data) {
        fetchedClinic = clinicRes.data
        setClinicConfig(fetchedClinic)
      }
    } catch {
      // Non-fatal: fallback to default clinic details
    }

    // B. Fetch print templates from backend
    try {
      const tplRes = await documentPrintTemplateApi.getAll()
      const serverList = Array.isArray(tplRes?.data) ? tplRes.data : []

      const nextTemplates = {
        [DOCUMENT_TYPES.INVOICE]: buildDefaultTemplateValues(DOCUMENT_TYPES.INVOICE, fetchedClinic),
        [DOCUMENT_TYPES.PRESCRIPTION]: buildDefaultTemplateValues(
          DOCUMENT_TYPES.PRESCRIPTION,
          fetchedClinic
        ),
        [DOCUMENT_TYPES.VISIT_SUMMARY]: buildDefaultTemplateValues(
          DOCUMENT_TYPES.VISIT_SUMMARY,
          fetchedClinic
        ),
      }

      serverList.forEach((item) => {
        const type = item.documentType
        if (nextTemplates[type]) {
          nextTemplates[type] = {
            id: item.id,
            documentType: type,
            templateName: item.templateName || nextTemplates[type].templateName,
            title: item.title || nextTemplates[type].title,
            logoUrl: item.logoUrl || '',
            showLogo: item.showLogo !== undefined ? item.showLogo : true,
            legalInfo: item.legalInfo || nextTemplates[type].legalInfo,
            footerText: item.footerText || nextTemplates[type].footerText,
            fieldVisibility: parseFieldVisibility(item.fieldVisibility, type),
          }
        }
      })

      setTemplates(nextTemplates)
      setPristineTemplates(JSON.parse(JSON.stringify(nextTemplates)))
    } catch {
      message.error('Không thể tải cấu hình mẫu in từ máy chủ. Sử dụng cấu hình mặc định.')
      const defTemplates = {
        [DOCUMENT_TYPES.INVOICE]: buildDefaultTemplateValues(DOCUMENT_TYPES.INVOICE, fetchedClinic),
        [DOCUMENT_TYPES.PRESCRIPTION]: buildDefaultTemplateValues(
          DOCUMENT_TYPES.PRESCRIPTION,
          fetchedClinic
        ),
        [DOCUMENT_TYPES.VISIT_SUMMARY]: buildDefaultTemplateValues(
          DOCUMENT_TYPES.VISIT_SUMMARY,
          fetchedClinic
        ),
      }
      setTemplates(defTemplates)
      setPristineTemplates(JSON.parse(JSON.stringify(defTemplates)))
    } finally {
      setInitialLoading(false)
    }
  }, [])

  useEffect(() => {
    loadInitialData()
  }, [loadInitialData])

  // 2. Fetch Audit History
  const fetchAuditHistory = useCallback(async () => {
    setAuditLoading(true)
    try {
      const res = await documentPrintTemplateApi.getAuditHistory({ size: 50 })
      const data = res?.data
      const content = data?.content || (Array.isArray(data) ? data : [])
      setAuditLogs(content)
    } catch {
      // non-fatal
    } finally {
      setAuditLoading(false)
    }
  }, [])

  useEffect(() => {
    if (activeTab === 'HISTORY') {
      fetchAuditHistory()
    }
  }, [activeTab, fetchAuditHistory])

  // Warn on window unload if dirty
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (isCurrentFormDirty) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [isCurrentFormDirty])

  // Handle Tab Switch with Unsaved Confirmation
  const handleTabChange = (nextKey) => {
    if (isCurrentFormDirty) {
      modal.confirm({
        title: 'Bạn có thay đổi chưa áp dụng',
        icon: <ExclamationCircleOutlined />,
        content:
          'Bạn đang có thay đổi cấu hình mẫu in chưa lưu. Rời khỏi tab này sẽ làm mất các thay đổi chưa áp dụng. Bạn có chắc muốn chuyển tab?',
        okText: 'Tiếp tục chuyển',
        cancelText: 'Ở lại lưu mẫu',
        okButtonProps: { danger: true },
        onOk: () => {
          // Reset current tab to pristine state
          setTemplates((prev) => ({
            ...prev,
            [activeTab]: JSON.parse(JSON.stringify(pristineTemplates[activeTab])),
          }))
          setLogoError('')
          setActiveTab(nextKey)
        },
      })
    } else {
      setLogoError('')
      setActiveTab(nextKey)
    }
  }

  // Update field in current active template
  const updateCurrentField = (fieldName, value) => {
    setTemplates((prev) => ({
      ...prev,
      [activeTab]: {
        ...prev[activeTab],
        [fieldName]: value,
      },
    }))
  }

  // Update specific field visibility toggle
  const updateFieldVisibilityToggle = (fieldKey, checked) => {
    setTemplates((prev) => {
      const current = prev[activeTab]
      return {
        ...prev,
        [activeTab]: {
          ...current,
          fieldVisibility: {
            ...current.fieldVisibility,
            [fieldKey]: checked,
          },
        },
      }
    })
  }

  // Handle Logo Upload (Client-side validation & Cloudinary upload)
  const handleLogoUpload = async (file) => {
    setLogoError('')
    const validation = validateLogoFile(file)
    if (!validation.isValid) {
      setLogoError(validation.error || 'Ảnh không hợp lệ.')
      return false
    }

    try {
      message.loading({ content: 'Đang tải ảnh logo lên Cloudinary...', key: 'logoUpload' })
      const res = await documentPrintTemplateApi.uploadLogo(file)
      const uploadedUrl = res?.data?.logoUrl
      if (uploadedUrl) {
        updateCurrentField('logoUrl', uploadedUrl)
        message.success({ content: 'Đã tải ảnh logo lên Cloudinary thành công!', key: 'logoUpload' })
      } else {
        message.error({ content: 'Không nhận được đường dẫn ảnh từ máy chủ.', key: 'logoUpload' })
      }
    } catch (err) {
      const errMsg =
        err?.response?.data?.message || err?.message || 'Không thể tải ảnh logo lên máy chủ.'
      setLogoError(errMsg)
      message.error({ content: errMsg, key: 'logoUpload' })
    }
    return false // prevent automatic POST upload
  }

  // Remove Logo
  const handleRemoveLogo = () => {
    updateCurrentField('logoUrl', '')
    setLogoError('')
    message.info('Đã gỡ bỏ ảnh logo khỏi mẫu in.')
  }

  // Apply Template (Main Action)
  const handleApplyTemplate = async () => {
    const current = templates[activeTab]
    if (!current.templateName?.trim()) {
      message.error('Vui lòng nhập tên mẫu in.')
      return
    }
    if (!current.title?.trim()) {
      message.error('Vui lòng nhập tiêu đề chứng từ.')
      return
    }

    if (current.logoUrl && current.logoUrl.startsWith('data:')) {
      modal.error({
        title: 'Định dạng logo chưa hợp lệ',
        content:
          'Ảnh logo đang ở dạng dữ liệu cục bộ (Base64) chưa được tải lên hệ thống. Vui lòng bấm "Tải ảnh logo lên" để tải ảnh lên máy chủ hoặc nhập liên kết ảnh hợp lệ trước khi áp dụng mẫu.',
      })
      return
    }

    if (current.logoUrl && current.logoUrl.length > 1000) {
      modal.error({
        title: 'Đường dẫn logo vượt quá giới hạn',
        content: 'Đường dẫn ảnh logo không được vượt quá 1000 ký tự.',
      })
      return
    }

    if (current.legalInfo && current.legalInfo.length > 1000) {
      message.error('Thông tin pháp lý không được vượt quá 1000 ký tự.')
      return
    }

    if (current.footerText && current.footerText.length > 1000) {
      message.error('Nội dung chân trang không được vượt quá 1000 ký tự.')
      return
    }

    setSaving(true)
    try {
      const payload = {
        templateName: current.templateName.trim(),
        title: current.title.trim(),
        logoUrl: current.logoUrl ? current.logoUrl.trim() : null,
        legalInfo: current.legalInfo ? current.legalInfo.trim() : null,
        footerText: current.footerText ? current.footerText.trim() : null,
        showLogo: Boolean(current.showLogo),
        fieldVisibility: serializeFieldVisibility(current.fieldVisibility),
      }

      const res = await documentPrintTemplateApi.update(activeTab, payload)

      if (res?.data) {
        message.success(
          `Đã áp dụng mẫu in "${DOCUMENT_TYPE_LABELS[activeTab]}" thành công và ghi nhật ký quản trị.`
        )
        // Update pristine copy
        setPristineTemplates((prev) => ({
          ...prev,
          [activeTab]: JSON.parse(JSON.stringify(templates[activeTab])),
        }))
        // Refresh audit logs
        fetchAuditHistory()
      }
    } catch (err) {
      const fieldErrors = err?.response?.data?.details?.fields || err?.response?.data?.fields
      const fieldMsg = fieldErrors ? Object.values(fieldErrors).join(', ') : null
      const errMsg =
        fieldMsg ||
        err?.response?.data?.message ||
        'Không thể áp dụng mẫu in hoặc lỗi ghi nhật ký thao tác. Hệ thống đã giữ nguyên mẫu in cũ.'
      modal.error({
        title: 'Áp dụng mẫu in thất bại',
        content: errMsg,
      })
    } finally {
      setSaving(false)
    }
  }

  // Trigger Backend PDF preview demo
  const handlePreviewPdf = async () => {
    const current = templates[activeTab]
    setPreviewPdfLoading(true)
    try {
      const payload = {
        documentType: activeTab,
        templateName: current.templateName || 'Preview Template',
        title: current.title || 'PREVIEW',
        logoUrl: current.logoUrl || null,
        legalInfo: current.legalInfo || null,
        footerText: current.footerText || null,
        showLogo: Boolean(current.showLogo),
        fieldVisibility: serializeFieldVisibility(current.fieldVisibility),
      }

      const res = await documentPrintTemplateApi.previewPdf(payload)
      const blob = new Blob([res.data], { type: 'application/pdf' })
      const url = window.URL.createObjectURL(blob)
      window.open(url, '_blank')
    } catch {
      message.info('Đang mở bản xem trước đồ họa chi tiết theo tỷ lệ thực.')
      setFullscreenPreviewOpen(true)
    } finally {
      setPreviewPdfLoading(false)
    }
  }

  // Current template data for live preview
  const currentTemplate = templates[activeTab] || {}
  const availableFields = DOCUMENT_FIELDS[activeTab] || []

  // Renders the Paper Sheet preview
  const renderPaperSheet = (isModal = false) => {
    const { title, logoUrl, showLogo, legalInfo, footerText, fieldVisibility } = currentTemplate
    const vis = fieldVisibility || {}

    return (
      <div className={`print-paper-sheet ${isModal ? 'print-fullscreen-sheet' : ''}`}>
        <div className="print-watermark">DỮ LIỆU MẪU MINH HỌA</div>

        {/* Paper Top Header */}
        <div className="paper-header">
          <div className="paper-logo-brand">
            {showLogo && logoUrl ? (
              <img src={logoUrl} alt="Logo phòng khám" className="paper-logo" />
            ) : (
              <div
                style={{
                  width: 60,
                  height: 48,
                  background: '#f1f5f9',
                  borderRadius: 6,
                  display: 'grid',
                  placeItems: 'center',
                  fontSize: 10,
                  color: '#94a3b8',
                }}
              >
                [LOGO]
              </div>
            )}
            <div className="paper-clinic-info">
              <h4>{clinicConfig.clinicName || 'PHÒNG KHÁM ĐA KHOA QUỐC TẾ'}</h4>
              <p>{legalInfo || 'Địa chỉ: Số 123 Đường Y Dược, Quận 1, TP. HCM\nĐiện thoại: 028 3822 1234'}</p>
            </div>
          </div>

          <div className="paper-barcode-box">
            {vis.showBarcode && (
              <div className="paper-barcode">
                ||| | |||| | ||| {activeTab === DOCUMENT_TYPES.INVOICE ? 'HD-2026-0814' : activeTab === DOCUMENT_TYPES.PRESCRIPTION ? 'DT-2026-0042' : 'PK-2026-1102'}
              </div>
            )}
            {vis.showQrCode && (
              <div className="paper-qr-box">
                <div className="paper-qr-mini">[QR Code]</div>
              </div>
            )}
          </div>
        </div>

        {/* Paper Title */}
        <div className="paper-title">
          <h2>{title || 'CHỨNG TỪ Y KHOA'}</h2>
          <span>(Bản in mẫu giả lập dữ liệu khám chữa bệnh)</span>
        </div>

        {/* Patient / Metadata */}
        <div className="paper-meta-grid">
          <div className="paper-meta-item">
            <strong>Họ tên bệnh nhân:</strong> {SAMPLE_DATA.patient.name}
          </div>
          <div className="paper-meta-item">
            <strong>Mã hồ sơ:</strong> {SAMPLE_DATA.patient.code}
          </div>
          {vis.showPatientAge !== false && (
            <div className="paper-meta-item">
              <strong>Tuổi:</strong> {SAMPLE_DATA.patient.age} ({SAMPLE_DATA.patient.dob})
            </div>
          )}
          {vis.showPatientPhone !== false && (
            <div className="paper-meta-item">
              <strong>Điện thoại:</strong> {SAMPLE_DATA.patient.phone}
            </div>
          )}
          <div className="paper-meta-item">
            <strong>Thời điểm lập:</strong> {SAMPLE_DATA.patient.visitDate}
          </div>
          {vis.showDiagnosis !== false && (
            <div className="paper-meta-item" style={{ gridColumn: 'span 2' }}>
              <strong>Chẩn đoán:</strong> {SAMPLE_DATA.patient.diagnosis}
            </div>
          )}
          {vis.showVitalSigns && (
            <div className="paper-meta-item" style={{ gridColumn: 'span 2' }}>
              <strong>Chỉ số sinh hiệu:</strong> {SAMPLE_DATA.patient.vitalSigns}
            </div>
          )}
        </div>

        {/* Main Document Content based on Type */}
        {activeTab === DOCUMENT_TYPES.PRESCRIPTION && (
          <table className="paper-table">
            <thead>
              <tr>
                <th style={{ width: 40 }}>STT</th>
                <th>Tên thuốc / Hàm lượng</th>
                <th style={{ width: 90 }}>Số lượng</th>
                {vis.showUsageInstructions !== false && <th>Cách dùng & Hướng dẫn</th>}
              </tr>
            </thead>
            <tbody>
              {SAMPLE_DATA.prescriptionMedicines.map((m) => (
                <tr key={m.stt}>
                  <td>{m.stt}</td>
                  <td><strong>{m.name}</strong></td>
                  <td>{m.quantity}</td>
                  {vis.showUsageInstructions !== false && <td>{m.usage}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {activeTab === DOCUMENT_TYPES.INVOICE && (
          <table className="paper-table">
            <thead>
              <tr>
                <th style={{ width: 40 }}>STT</th>
                <th>Dịch vụ / Danh mục thanh toán</th>
                <th style={{ width: 50 }}>ĐVT</th>
                <th style={{ width: 50 }}>SL</th>
                <th style={{ width: 90, textAlign: 'right' }}>Đơn giá (đ)</th>
                <th style={{ width: 100, textAlign: 'right' }}>Thành tiền (đ)</th>
              </tr>
            </thead>
            <tbody>
              {SAMPLE_DATA.invoiceItems.map((item) => (
                <tr key={item.stt}>
                  <td>{item.stt}</td>
                  <td>{item.serviceName}</td>
                  <td>{item.unit}</td>
                  <td>{item.qty}</td>
                  <td style={{ textAlign: 'right' }}>{item.price.toLocaleString('vi-VN')}</td>
                  <td style={{ textAlign: 'right' }}><strong>{item.amount.toLocaleString('vi-VN')}</strong></td>
                </tr>
              ))}
              {vis.showDiscount && (
                <tr style={{ background: '#ffffff' }}>
                  <td colSpan={5} style={{ textAlign: 'right', color: '#64748b' }}>Chiết khấu / Ưu đãi:</td>
                  <td style={{ textAlign: 'right', color: '#16a34a', fontWeight: 'bold' }}>- 0 đ</td>
                </tr>
              )}
              <tr style={{ background: '#f8fafc' }}>
                <td colSpan={5} style={{ textAlign: 'right', fontWeight: 'bold', color: '#0f172a' }}>TỔNG CỘNG THANH TOÁN:</td>
                <td style={{ textAlign: 'right', fontWeight: 'bold', fontSize: 13, color: '#0284c7' }}>
                  1.520.000 đ
                </td>
              </tr>
              {vis.showPaymentMethod !== false && (
                <tr style={{ background: '#ffffff' }}>
                  <td colSpan={6} style={{ fontStyle: 'italic', fontSize: 11, color: '#475569' }}>
                    Hình thức thanh toán: <strong style={{ color: '#0f172a' }}>Chuyển khoản VietQR</strong> (Đã thanh toán đủ)
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}

        {activeTab === DOCUMENT_TYPES.VISIT_SUMMARY && (
          <div>
            {vis.showClinicalOrders !== false && (
              <div style={{ marginBottom: 12 }}>
                <strong style={{ fontSize: 12 }}>CẬN LÂM SÀNG ĐÃ THỰC HIỆN:</strong>
                <table className="paper-table" style={{ marginTop: 4 }}>
                  <thead>
                    <tr>
                      <th style={{ width: 40 }}>STT</th>
                      <th>Tên chỉ định cận lâm sàng</th>
                      <th>Kết quả ghi nhận</th>
                    </tr>
                  </thead>
                  <tbody>
                    {SAMPLE_DATA.clinicalOrders.map((c) => (
                      <tr key={c.stt}>
                        <td>{c.stt}</td>
                        <td>{c.name}</td>
                        <td>{c.result}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {vis.showTreatmentPlan !== false && (
              <div style={{ marginBottom: 10, fontSize: 11.5 }}>
                <strong>Hướng điều trị:</strong> {SAMPLE_DATA.patient.treatmentPlan}
              </div>
            )}

            {vis.showRevisitDate !== false && (
              <div style={{ marginBottom: 10, fontSize: 11.5, color: '#0369a1' }}>
                <strong>Lịch hẹn tái khám:</strong> {SAMPLE_DATA.patient.revisitDate}
              </div>
            )}
          </div>
        )}

        {/* Doctor Advice if Prescription */}
        {activeTab === DOCUMENT_TYPES.PRESCRIPTION && vis.showDoctorAdvice !== false && (
          <div style={{ margin: '8px 0', fontSize: 11.5 }}>
            <strong>Lời dặn của bác sĩ:</strong> Kiêng ăn đồ chua, cay, dầu mỡ. Uống nhiều nước ấm và ngủ đủ giấc.
          </div>
        )}

        {/* Footer text */}
        {footerText && (
          <div className="paper-footer-content">
            {footerText}
          </div>
        )}

        {/* Signatures */}
        <div className="paper-signatures">
          <div className="paper-sign-box">
            <strong>BỆNH NHÂN / NGƯỜI NHẬN</strong>
            <span className="paper-sign-hint">(Ký, ghi rõ họ tên)</span>
            <div className="paper-sign-space" />
            <span className="paper-sign-name">{SAMPLE_DATA.patient.name}</span>
          </div>

          <div className="paper-sign-box">
            {activeTab === DOCUMENT_TYPES.INVOICE && vis.showCashierSignature !== false && (
              <>
                <strong>NGƯỜI THU TIỀN</strong>
                <span className="paper-sign-hint">(Ký, ghi rõ họ tên)</span>
                <div className="paper-sign-space" />
                <span className="paper-sign-name">{SAMPLE_DATA.patient.cashierName}</span>
              </>
            )}
            {activeTab !== DOCUMENT_TYPES.INVOICE && vis.showDoctorSignature !== false && (
              <>
                <strong>BÁC SĨ ĐIỀU TRỊ</strong>
                <span className="paper-sign-hint">(Ký, ghi rõ họ tên)</span>
                <div className="paper-sign-space" />
                <span className="paper-sign-name">{SAMPLE_DATA.patient.doctorName}</span>
              </>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Audit history table columns
  const auditColumns = [
    {
      title: 'Thời điểm',
      dataIndex: 'timestamp',
      key: 'timestamp',
      width: 170,
      render: (val) => (val ? dayjs(val).format('DD/MM/YYYY HH:mm:ss') : '—'),
    },
    {
      title: 'Loại chứng từ',
      dataIndex: 'details',
      key: 'documentType',
      width: 140,
      render: (details) => {
        const type = details?.documentType
        const label = DOCUMENT_TYPE_LABELS[type] || type || 'Mẫu in'
        return <Tag color="blue">{label}</Tag>
      },
    },
    {
      title: 'Người thực hiện',
      dataIndex: 'actorUsername',
      key: 'actor',
      width: 160,
      render: (text) => text || 'Quản trị viên',
    },
    {
      title: 'Tóm tắt thay đổi',
      dataIndex: 'description',
      key: 'desc',
      render: (text, record) => record?.details?.summary || text || 'Cập nhật cấu hình mẫu in',
    },
    {
      title: 'Thao tác',
      key: 'actions',
      width: 130,
      align: 'center',
      render: (_, record) => {
        const hasBeforeAfter = record?.details?.before && record?.details?.after
        return (
          <Button
            type="link"
            icon={<DiffOutlined />}
            disabled={!hasBeforeAfter}
            onClick={() => {
              setSelectedDiff({
                title: `Chi tiết thay đổi lúc ${dayjs(record.timestamp).format('HH:mm:ss DD/MM/YYYY')}`,
                diffs: compareTemplateDiff(record.details.before, record.details.after),
              })
              setDiffModalVisible(true)
            }}
          >
            So sánh
          </Button>
        )
      },
    },
  ]

  // Guard for Admin Only
  if (!isAdmin) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <Alert
          type="error"
          showIcon
          message="Từ chối truy cập"
          description="Chức năng Cấu hình mẫu in chứng từ chỉ dành riêng cho Quản trị viên hệ thống (Admin). Vui lòng kiểm tra lại tài khoản."
        />
      </div>
    )
  }

  if (initialLoading) {
    return (
      <div style={{ padding: 60, textAlign: 'center' }}>
        <Spin size="large" tip="Đang tải thông tin cấu hình mẫu in..." />
      </div>
    )
  }

  return (
    <div className="print-template-page" aria-label="Cấu hình mẫu in chứng từ">
      {/* Header */}
      <header className="print-template-header">
        <h1>Cấu hình mẫu in chứng từ</h1>
        <p>
          Thiết lập logo, thông tin pháp lý, chân trang và các trường hiển thị khi in chứng từ y khoa
          (Hóa đơn, Đơn thuốc, Phiếu khám).
        </p>
      </header>

      {/* Tabs */}
      <Tabs
        activeKey={activeTab}
        onChange={handleTabChange}
        type="card"
        style={{ marginBottom: 20 }}
        items={[
          {
            key: DOCUMENT_TYPES.INVOICE,
            label: (
              <span>
                <FileTextOutlined /> Hóa đơn
              </span>
            ),
          },
          {
            key: DOCUMENT_TYPES.PRESCRIPTION,
            label: (
              <span>
                <FileDoneOutlined /> Đơn thuốc
              </span>
            ),
          },
          {
            key: DOCUMENT_TYPES.VISIT_SUMMARY,
            label: (
              <span>
                <PrinterOutlined /> Phiếu khám
              </span>
            ),
          },
          {
            key: 'HISTORY',
            label: (
              <span>
                <HistoryOutlined /> Lịch sử thay đổi mẫu in
              </span>
            ),
          },
        ]}
      />

      {/* View Tab 1-3: Configuration Form + Live Preview */}
      {activeTab !== 'HISTORY' && (
        <div className="print-template-split">
          {/* LEFT COLUMN: FORM */}
          <div className="print-template-form-col">
            {/* Card 1: Logo & General */}
            <div className="print-form-card">
              <div className="print-card-title">
                <PictureOutlined />
                <h3>Logo phòng khám trên chứng từ</h3>
              </div>

              <div className="print-logo-uploader">
                <div className="print-logo-preview-box">
                  {currentTemplate.logoUrl ? (
                    <img
                      src={currentTemplate.logoUrl}
                      alt="Logo xem trước"
                      className="print-logo-img"
                    />
                  ) : (
                    <div className="print-logo-placeholder">Chưa có logo</div>
                  )}
                </div>

                <div className="print-logo-actions">
                  <Upload
                    beforeUpload={handleLogoUpload}
                    showUploadList={false}
                    accept=".png,.jpg,.jpeg,.webp,.svg"
                  >
                    <Button icon={<UploadOutlined />}>Tải ảnh logo lên</Button>
                  </Upload>

                  {currentTemplate.logoUrl && (
                    <Button
                      danger
                      icon={<DeleteOutlined />}
                      size="small"
                      onClick={handleRemoveLogo}
                      style={{ width: 'fit-content' }}
                    >
                      Xóa logo
                    </Button>
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
                    <Switch
                      checked={Boolean(currentTemplate.showLogo)}
                      onChange={(checked) => updateCurrentField('showLogo', checked)}
                      id="toggle-show-logo"
                    />
                    <label htmlFor="toggle-show-logo" style={{ fontSize: 13, cursor: 'pointer' }}>
                      Bật hiển thị logo trên bản in
                    </label>
                  </div>

                  <div style={{ marginTop: 8, width: '100%', maxWidth: 400 }}>
                    <Input
                      size="small"
                      placeholder="Đường dẫn URL ảnh logo (Cloudinary hoặc link ảnh)..."
                      value={currentTemplate.logoUrl}
                      onChange={(e) => updateCurrentField('logoUrl', e.target.value)}
                      allowClear
                      maxLength={1000}
                      id="input-logo-url"
                    />
                  </div>

                  <span className="print-logo-tip">
                    Hỗ trợ định dạng PNG, JPG, JPEG, WEBP, SVG. Dung lượng tối đa: 2MB. Ảnh sẽ được tự động lưu lên Cloudinary.
                  </span>

                  {logoError && <div className="print-logo-error">{logoError}</div>}
                </div>
              </div>
            </div>

            {/* Card 2: Legal Info & Titles */}
            <div className="print-form-card">
              <div className="print-card-title">
                <AuditOutlined />
                <h3>Thông tin pháp lý & Tiêu đề</h3>
              </div>

              <Form layout="vertical">
                <Form.Item label="Tên mẫu in cấu hình" required>
                  <Input
                    value={currentTemplate.templateName}
                    onChange={(e) => updateCurrentField('templateName', e.target.value)}
                    placeholder="Ví dụ: Mẫu đơn thuốc chuẩn phòng khám"
                    maxLength={150}
                    id="input-template-name"
                  />
                </Form.Item>

                <Form.Item label="Tiêu đề in đậm trên chứng từ" required>
                  <Input
                    value={currentTemplate.title}
                    onChange={(e) => updateCurrentField('title', e.target.value)}
                    placeholder="Ví dụ: ĐƠN THUỐC, HÓA ĐƠN THU TIỀN"
                    maxLength={255}
                    id="input-template-title"
                  />
                </Form.Item>

                <Form.Item
                  label="Thông tin pháp lý phòng khám (Địa chỉ, SĐT, Giấy phép HĐ / MST)"
                  extra="Kéo sẵn từ cấu hình chung phòng khám. Bạn có thể bổ sung số giấy phép hoặc mã số thuế theo mẫu."
                >
                  <TextArea
                    rows={4}
                    value={currentTemplate.legalInfo}
                    onChange={(e) => updateCurrentField('legalInfo', e.target.value)}
                    placeholder="Tên cơ sở khám chữa bệnh, địa chỉ, số điện thoại, giấy phép hoạt động..."
                    maxLength={1000}
                    id="input-legal-info"
                  />
                </Form.Item>

                <Form.Item
                  label="Nội dung chân trang (Footer)"
                  extra="Lời cảm ơn, hướng dẫn sử dụng, thời hạn đơn thuốc, lưu ý tái khám hoặc hotline hỗ trợ."
                >
                  <TextArea
                    rows={3}
                    value={currentTemplate.footerText}
                    onChange={(e) => updateCurrentField('footerText', e.target.value)}
                    placeholder="Nhập nội dung chân trang hiển thị cuối chứng từ..."
                    maxLength={1000}
                    id="input-footer-text"
                  />
                </Form.Item>
              </Form>
            </div>

            {/* Card 3: Checklist Data Fields */}
            <div className="print-form-card">
              <div className="print-card-title">
                <CheckCircleOutlined />
                <h3>Tùy chọn hiển thị các trường dữ liệu</h3>
              </div>
              <p style={{ fontSize: 12.5, color: '#64748b', marginTop: -6, marginBottom: 14 }}>
                Bật hoặc tắt các trường hiển thị trên bản in chứng từ loại này. Bản xem trước bên phải
                sẽ cập nhật tương ứng ngay lập tức.
              </p>

              <div className="print-fields-grid">
                {availableFields.map((field) => {
                  const isChecked = currentTemplate.fieldVisibility?.[field.key] !== false
                  return (
                    <div key={field.key} className="print-field-item">
                      <div className="print-field-info">
                        <span className="print-field-label">{field.label}</span>
                        <span className="print-field-desc" title={field.description}>
                          {field.description}
                        </span>
                      </div>
                      <Switch
                        checked={isChecked}
                        onChange={(checked) => updateFieldVisibilityToggle(field.key, checked)}
                        aria-label={`Bật tắt trường ${field.label}`}
                      />
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Action Bar */}
            <div className="print-actions-card">
              <div className="print-notice-text">
                <InfoCircleOutlined />
                <span>
                  Lưu ý: Mẫu mới sẽ có hiệu lực ngay cho <strong>MỌI lần in sau đó</strong>, kể cả
                  khi in lại các chứng từ cũ đã tạo trước đây.
                </span>
              </div>

              <div className="print-buttons-group">
                <Button
                  icon={<EyeOutlined />}
                  onClick={handlePreviewPdf}
                  loading={previewPdfLoading}
                  id="btn-preview-fullscreen"
                >
                  Xem trước toàn trang
                </Button>

                <Popconfirm
                  title="Xác nhận áp dụng mẫu in mới"
                  description="Mẫu mới sẽ có hiệu lực ngay lập tức cho toàn bộ các lần in tiếp theo (bao gồm in lại chứng từ cũ). Bạn có chắc chắn muốn áp dụng?"
                  onConfirm={handleApplyTemplate}
                  okText="Đồng ý áp dụng"
                  cancelText="Xem lại"
                  icon={<QuestionCircleOutlined style={{ color: '#0284c7' }} />}
                  okButtonProps={{ loading: saving }}
                >
                  <Button
                    type="primary"
                    icon={<SaveOutlined />}
                    loading={saving}
                    id="btn-apply-template"
                    style={{ background: '#123b6d', borderColor: '#123b6d' }}
                  >
                    Áp dụng mẫu
                  </Button>
                </Popconfirm>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: STICKY LIVE PREVIEW */}
          <div className="print-template-preview-col" aria-label="Khung xem trước mẫu in">
            <div className="print-preview-header">
              <span>
                <EyeOutlined /> Khung xem trước trực tiếp (Live Preview)
              </span>
              <div className="print-sample-badge">Dữ liệu mẫu minh họa</div>
            </div>

            {renderPaperSheet(false)}
          </div>
        </div>
      )}

      {/* View Tab 4: Audit Change History */}
      {activeTab === 'HISTORY' && (
        <div className="print-form-card">
          <div className="print-card-title">
            <HistoryOutlined />
            <h3>Lịch sử thay đổi mẫu in chứng từ</h3>
          </div>
          <p style={{ fontSize: 13, color: '#64748b', marginTop: -6, marginBottom: 16 }}>
            Ghi nhận toàn bộ các lần thay đổi mẫu in, bao gồm người thực hiện, thời điểm và nội dung
            so sánh Trước / Sau.
          </p>

          <Table
            dataSource={auditLogs}
            columns={auditColumns}
            rowKey={(r) => r.id || `${r.timestamp}-${r.resourceId}`}
            loading={auditLoading}
            pagination={{ pageSize: 10, showSizeChanger: true }}
            locale={{ emptyText: 'Chưa có ghi nhận thay đổi mẫu in nào' }}
          />
        </div>
      )}

      {/* Fullscreen Preview Modal */}
      <Modal
        open={fullscreenPreviewOpen}
        onCancel={() => setFullscreenPreviewOpen(false)}
        footer={[
          <Button key="close" type="primary" onClick={() => setFullscreenPreviewOpen(false)}>
            Đóng
          </Button>,
        ]}
        width={880}
        title="Xem trước mẫu in khổ A4 tiêu chuẩn"
        destroyOnClose
      >
        <div style={{ maxHeight: '72vh', overflowY: 'auto', padding: '10px 0' }}>
          {renderPaperSheet(true)}
        </div>
      </Modal>

      {/* Diff Before / After Modal */}
      <Modal
        open={diffModalVisible}
        onCancel={() => setDiffModalVisible(false)}
        footer={[
          <Button key="close" type="primary" onClick={() => setDiffModalVisible(false)}>
            Đóng
          </Button>,
        ]}
        width={760}
        title={selectedDiff?.title || 'So sánh chi tiết thay đổi'}
        destroyOnClose
      >
        {selectedDiff?.diffs?.length > 0 ? (
          <table className="print-diff-table">
            <thead>
              <tr>
                <th style={{ width: 180 }}>Thuộc tính</th>
                <th>Giá trị trước khi đổi</th>
                <th>Giá trị sau khi đổi</th>
              </tr>
            </thead>
            <tbody>
              {selectedDiff.diffs.map((d) => (
                <tr key={d.field}>
                  <td>
                    <strong>{d.label}</strong>
                  </td>
                  <td className="diff-before" style={{ whiteSpace: 'pre-wrap' }}>
                    {d.beforeVal}
                  </td>
                  <td className="diff-after" style={{ whiteSpace: 'pre-wrap' }}>
                    {d.afterVal}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <Alert
            type="info"
            message="Không có sự khác biệt về mặt văn bản giữa hai phiên bản."
            style={{ margin: 16 }}
          />
        )}
      </Modal>
    </div>
  )
}
