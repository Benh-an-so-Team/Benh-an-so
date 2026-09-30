import React, { useState, useEffect, useMemo, useRef } from 'react'
import {
  Modal,
  Button,
  Input,
  Space,
  Tag,
  Alert,
  Card,
  Typography,
  Table,
  Select,
  Row,
  Col,
  Form,
  Spin,
  Tooltip,
  Divider,
  Result,
  InputNumber,
  Checkbox,
  message,
} from 'antd'
import {
  SwapOutlined,
  WarningOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  CloseCircleOutlined,
  PlusOutlined,
  DeleteOutlined,
  MedicineBoxOutlined,
  CloudServerOutlined,
  CloudUploadOutlined,
  CopyOutlined,
  UserOutlined,
  SafetyCertificateOutlined,
  BarcodeOutlined,
  RollbackOutlined,
  InfoCircleOutlined,
  FireOutlined,
  SyncOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import pharmacyApi from '../../api/pharmacyApi.js'
import prescriptionApi from '../../api/prescriptionApi.js'
import {
  PRESET_REPLACEMENT_REASONS,
  validateReplacementReason,
  mapReplacementErrorMessage,
} from '../../utils/prescriptionReplacementHelpers.js'
import { formatPrescriptionCode } from '../../utils/electronicPrescriptionValidation.js'
import { fixMojibake } from '../../utils/serviceCatalogValidation.js'

const { Text, Paragraph, Title } = Typography

const ROUTE_OPTIONS = [
  { value: 'ORAL', label: 'Uống' },
  { value: 'TOPICAL', label: 'Bôi ngoài da' },
  { value: 'INHALATION', label: 'Hít / Khí dung' },
  { value: 'OPHTHALMIC', label: 'Nhỏ / Tra mắt' },
  { value: 'NASAL', label: 'Xịt / Nhỏ mũi' },
  { value: 'OTIC', label: 'Nhỏ tai' },
  { value: 'SUBLINGUAL', label: 'Ngậm dưới lưỡi' },
  { value: 'RECTAL', label: 'Đặt trực tràng / Hậu môn' },
  { value: 'INTRAVENOUS', label: 'Tiêm tĩnh mạch' },
  { value: 'INTRAMUSCULAR', label: 'Tiêm bắp' },
  { value: 'SUBCUTANEOUS', label: 'Tiêm dưới da' },
  { value: 'TRANSDERMAL', label: 'Dán ngoài da' },
  { value: 'VAGINAL', label: 'Đặt âm đạo' },
  { value: 'OTHER', label: 'Cách dùng khác' },
]

export default function ReplacePrescriptionModal({
  open,
  onClose,
  prescription,
  medicines = [],
  patientAllergies = [],
  diagnoses = [],
  medicalRecordId,
  currentUser,
  onSuccess,
}) {
  const [replacementReason, setReplacementReason] = useState('')
  const [note, setNote] = useState('')
  const [items, setItems] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)
  const [resultData, setResultData] = useState(null)

  // Clinical safety checks
  const [checkingSafety, setCheckingSafety] = useState(false)
  const [interactions, setInteractions] = useState([])
  const [interactionOverrides, setInteractionOverrides] = useState({})
  const [allergyWarnings, setAllergyWarnings] = useState([])
  const [allergyOverrides, setAllergyOverrides] = useState({})
  const [contraindications, setContraindications] = useState([])
  const [contraindicationOverrides, setContraindicationOverrides] = useState({})
  const [maxDoseWarnings, setMaxDoseWarnings] = useState([])
  const [maxDoseOverrides, setMaxDoseOverrides] = useState({})
  const [controlledMedicineConfirmed, setControlledMedicineConfirmed] = useState(false)

  // Khởi tạo form khi modal mở
  useEffect(() => {
    if (open && prescription) {
      setReplacementReason('')
      setNote(prescription.note || '')
      setSubmitError(null)
      setResultData(null)
      setControlledMedicineConfirmed(false)

      const initialItems = (prescription.items || []).map((it, idx) => ({
        clientId: `item-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 5)}`,
        medicineId: it.medicineId || it.id,
        dosage: it.dosage || '1 viên',
        frequency: Number(it.frequency) || 2,
        route: it.route || 'ORAL',
        durationDays: Number(it.durationDays) || 5,
        quantity: Number(it.quantity) || 10,
        instructions: it.instructions || 'Uống sau ăn',
        singleDoseQuantity: Number(it.singleDoseQuantity) || 1,
        isOriginal: true,
      }))

      setItems(
        initialItems.length > 0
          ? initialItems
          : [
              {
                clientId: `item-${Date.now()}-0`,
                medicineId: medicines[0]?.id || '',
                dosage: '1 viên',
                frequency: 2,
                route: 'ORAL',
                durationDays: 5,
                quantity: 10,
                instructions: 'Uống sau ăn',
                singleDoseQuantity: 1,
                isOriginal: false,
              },
            ],
      )

      // Chạy kiểm tra an toàn ban đầu
      runClinicalSafetyChecks(initialItems)
    }
  }, [open, prescription])

  const effectiveMedicalRecordId =
    medicalRecordId || prescription?.medicalRecordId

  // Tra cứu thông tin thuốc theo ID
  const medicineMap = useMemo(() => {
    const map = new Map()
    medicines.forEach((m) => {
      map.set(String(m.id), m)
    })
    return map
  }, [medicines])

  // Kiểm tra xem đơn có thuốc kiểm soát đặc biệt không
  const hasSpecialControl = useMemo(() => {
    return items.some((it) => {
      const med = medicineMap.get(String(it.medicineId))
      return Boolean(med?.isSpecialControl)
    })
  }, [items, medicineMap])

  // Chạy kiểm tra 4 loại an toàn lâm sàng
  const runClinicalSafetyChecks = async (currentItems = items) => {
    const validItems = (currentItems || []).filter((it) => it.medicineId)
    if (validItems.length === 0) return

    setCheckingSafety(true)
    const drugIds = validItems.map((it) => it.medicineId).filter(Boolean)

    try {
      // 1. Tương tác thuốc
      if (drugIds.length >= 2) {
        try {
          const res = await pharmacyApi.checkInteractions(drugIds)
          const data = res.data || {}
          setInteractions(data.interactions || data.warnings || [])
        } catch {
          setInteractions([])
        }
      } else {
        setInteractions([])
      }

      // 2. Dị ứng thuốc
      if (effectiveMedicalRecordId && drugIds.length > 0) {
        try {
          const res = await pharmacyApi.checkAllergyWarnings(
            effectiveMedicalRecordId,
            drugIds,
          )
          const data = res.data || {}
          setAllergyWarnings(data.warnings || (Array.isArray(data) ? data : []))
        } catch {
          setAllergyWarnings([])
        }
      }

      // 3. Chống chỉ định
      if (effectiveMedicalRecordId && drugIds.length > 0) {
        try {
          const res = await pharmacyApi.checkContraindications(
            effectiveMedicalRecordId,
            drugIds,
          )
          const data = res.data || {}
          setContraindications(
            data.warnings || data.contraindications || (Array.isArray(data) ? data : []),
          )
        } catch {
          setContraindications([])
        }
      }

      // 4. Vượt liều tối đa hàng ngày
      if (effectiveMedicalRecordId && validItems.length > 0) {
        try {
          const formattedItems = validItems.map((it) => ({
            medicineId: it.medicineId,
            dosage: it.dosage,
            frequency: Number(it.frequency),
            durationDays: Number(it.durationDays),
            quantity: Number(it.quantity),
            singleDoseQuantity: Number(it.singleDoseQuantity) || 1,
            route: it.route,
            instructions: it.instructions,
          }))
          const res = await prescriptionApi.checkMaxDailyDose(
            effectiveMedicalRecordId,
            formattedItems,
          )
          const data = res.data || {}
          setMaxDoseWarnings(data.warnings || [])
        } catch {
          setMaxDoseWarnings([])
        }
      }
    } finally {
      setCheckingSafety(false)
    }
  }

  // Thêm thuốc mới vào đơn
  const handleAddItem = () => {
    const newItem = {
      clientId: `item-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      medicineId: medicines[0]?.id || '',
      dosage: '1 viên',
      frequency: 2,
      route: 'ORAL',
      durationDays: 5,
      quantity: 10,
      instructions: 'Uống sau ăn',
      singleDoseQuantity: 1,
      isOriginal: false,
    }
    const nextItems = [...items, newItem]
    setItems(nextItems)
    runClinicalSafetyChecks(nextItems)
  }

  // Xóa thuốc khỏi đơn
  const handleRemoveItem = (clientId) => {
    if (items.length <= 1) {
      message.warning('Đơn thuốc thay thế phải có ít nhất một loại thuốc.')
      return
    }
    const nextItems = items.filter((it) => it.clientId !== clientId)
    setItems(nextItems)
    runClinicalSafetyChecks(nextItems)
  }

  // Cập nhật giá trị trường thuốc
  const handleItemChange = (clientId, field, value) => {
    const nextItems = items.map((it) => {
      if (it.clientId !== clientId) return it
      const updated = { ...it, [field]: value }
      if (field === 'frequency' || field === 'durationDays' || field === 'singleDoseQuantity') {
        const freq = Number(field === 'frequency' ? value : it.frequency) || 1
        const days = Number(field === 'durationDays' ? value : it.durationDays) || 1
        const single = Number(field === 'singleDoseQuantity' ? value : it.singleDoseQuantity) || 1
        updated.quantity = Math.max(1, freq * days * single)
      }
      return updated
    })
    setItems(nextItems)
    if (field === 'medicineId' || field === 'frequency' || field === 'dosage') {
      runClinicalSafetyChecks(nextItems)
    }
  }

  // Kiểm tra tính hợp lệ trước khi gửi
  const validateBeforeSubmit = () => {
    const reasonCheck = validateReplacementReason(replacementReason)
    if (!reasonCheck.valid) {
      setSubmitError(reasonCheck.error)
      return false
    }

    if (items.length === 0) {
      setSubmitError('Đơn thuốc thay thế phải có ít nhất một loại thuốc.')
      return false
    }

    for (let i = 0; i < items.length; i++) {
      const it = items[i]
      if (!it.medicineId) {
        setSubmitError(`Thuốc hàng #${i + 1} chưa chọn loại thuốc.`)
        return false
      }
      if (!it.dosage || !String(it.dosage).trim()) {
        setSubmitError(`Thuốc hàng #${i + 1} chưa nhập liều dùng (VD: 1 viên, 5ml...).`)
        return false
      }
      if (!it.frequency || Number(it.frequency) <= 0) {
        setSubmitError(`Thuốc hàng #${i + 1} số lần dùng/ngày phải lớn hơn 0.`)
        return false
      }
      if (!it.durationDays || Number(it.durationDays) <= 0) {
        setSubmitError(`Thuốc hàng #${i + 1} số ngày dùng phải lớn hơn 0.`)
        return false
      }
      if (!it.quantity || Number(it.quantity) <= 0) {
        setSubmitError(`Thuốc hàng #${i + 1} số lượng thuốc phải lớn hơn 0.`)
        return false
      }
    }

    // Kiểm tra các override cảnh báo
    for (const inter of interactions) {
      const ruleId = inter.ruleId || inter.id
      if (!interactionOverrides[ruleId] || !interactionOverrides[ruleId].trim()) {
        setSubmitError(
          `Vui lòng nhập lý do lâm sàng xác nhận tương tác giữa ${inter.drugNameA} và ${inter.drugNameB}.`,
        )
        return false
      }
    }

    for (const allergy of allergyWarnings) {
      const key = `${allergy.allergyId}_${allergy.medicineId}`
      if (!allergyOverrides[key] || !allergyOverrides[key].trim()) {
        setSubmitError(
          `Vui lòng nhập lý do lâm sàng xác nhận cảnh báo dị ứng cho ${allergy.allergenName || 'thuốc'}.`,
        )
        return false
      }
    }

    for (const contra of contraindications) {
      const key = `${contra.ruleId || contra.id}_${contra.medicineId}`
      if (!contraindicationOverrides[key] || !contraindicationOverrides[key].trim()) {
        setSubmitError(
          `Vui lòng nhập lý do lâm sàng xác nhận chống chỉ định cho ${contra.medicineName || 'thuốc'}.`,
        )
        return false
      }
    }

    for (const dose of maxDoseWarnings) {
      const ing = dose.activeIngredient
      if (!maxDoseOverrides[ing] || !maxDoseOverrides[ing].trim()) {
        setSubmitError(
          `Vui lòng nhập lý do lâm sàng xác nhận vượt liều tối đa hàng ngày cho hoạt chất ${ing}.`,
        )
        return false
      }
    }

    if (hasSpecialControl && !controlledMedicineConfirmed) {
      setSubmitError(
        'Đơn thuốc có thuốc kiểm soát đặc biệt. Bác sĩ vui lòng tích chọn xác nhận trách nhiệm chuyên môn.',
      )
      return false
    }

    setSubmitError(null)
    return true
  }

  // Thực thi phát hành đơn thay thế
  const handleConfirmSubmit = () => {
    if (!validateBeforeSubmit()) return

    const originalCode = formatPrescriptionCode(
      prescription.prescriptionCode || prescription.id,
    )

    Modal.confirm({
      title: 'Xác nhận phát hành đơn thuốc thay thế',
      icon: <ExclamationCircleOutlined style={{ color: '#7c3aed' }} />,
      content: (
        <div>
          <Paragraph>
            Bạn có chắc chắn muốn phát hành đơn thuốc thay thế cho đơn gốc{' '}
            <strong style={{ color: '#1d4ed8' }}>{originalCode}</strong>?
          </Paragraph>
          <div
            style={{
              padding: '10px 12px',
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: 6,
              color: '#991b1b',
              fontSize: 13,
            }}
          >
            ⚠️ <strong>Hành động không thể hoàn tác:</strong> Đơn gốc sẽ chuyển sang trạng thái{' '}
            <strong>Đã bị thay thế (REPLACED)</strong> và không thể cấp phát, sửa đổi hay in ấn.
          </div>
        </div>
      ),
      okText: 'Xác nhận phát hành',
      cancelText: 'Xem lại',
      okButtonProps: {
        style: { backgroundColor: '#7c3aed', borderColor: '#7c3aed' },
        loading: submitting,
      },
      onOk: async () => {
        setSubmitting(true)
        setSubmitError(null)

        const payload = {
          replacementReason: replacementReason.trim(),
          note: note ? note.trim() : '',
          items: items.map((it) => ({
            medicineId: it.medicineId,
            dosage: String(it.dosage || '').trim(),
            frequency: Number(it.frequency) || 1,
            route: it.route || 'ORAL',
            durationDays: Number(it.durationDays) || 1,
            quantity: Number(it.quantity) || 1,
            instructions: (it.instructions || '').trim(),
            singleDoseQuantity:
              Number(it.singleDoseQuantity) > 0
                ? Number(it.singleDoseQuantity)
                : 1,
          })),
          interactionOverrides: Object.entries(interactionOverrides)
            .map(([ruleId, overrideReason]) => ({
              ruleId,
              overrideReason: String(overrideReason).trim(),
            }))
            .filter((o) => o.overrideReason),
          allergyOverrides: Object.entries(allergyOverrides)
            .map(([key, overrideReason]) => {
              const [allergyId, medicineId] = key.split('_')
              return {
                allergyId,
                medicineId,
                overrideReason: String(overrideReason).trim(),
              }
            })
            .filter((o) => o.overrideReason),
          contraindicationOverrides: Object.entries(contraindicationOverrides)
            .map(([key, overrideReason]) => {
              const [ruleId, medicineId] = key.split('_')
              return {
                ruleId,
                medicineId,
                overrideReason: String(overrideReason).trim(),
              }
            })
            .filter((o) => o.overrideReason),
          maxDailyDoseOverrides: Object.entries(maxDoseOverrides)
            .map(([activeIngredient, overrideReason]) => ({
              activeIngredient,
              overrideReason: String(overrideReason).trim(),
            }))
            .filter((o) => o.overrideReason),
          controlledMedicineConfirmed: Boolean(
            hasSpecialControl ? controlledMedicineConfirmed : false,
          ),
        }

        try {
          const res = await pharmacyApi.replacePrescription(
            prescription.id,
            payload,
          )
          const data = res.data || {}
          setResultData(data)
          message.success('Phát hành đơn thuốc thay thế thành công!')
          if (onSuccess) {
            onSuccess(data)
          }
        } catch (err) {
          const mappedMsg = mapReplacementErrorMessage(err)
          setSubmitError(mappedMsg)
        } finally {
          setSubmitting(false)
        }
      },
    })
  }

  if (!prescription) return null

  const originalDisplayCode = formatPrescriptionCode(
    prescription.prescriptionCode || prescription.id,
  )

  return (
    <Modal
      open={open}
      onCancel={() => {
        if (!submitting) {
          onClose()
        }
      }}
      maskClosable={!submitting}
      title={
        <Space align="center" size={8}>
          <SwapOutlined style={{ color: '#7c3aed', fontSize: 20 }} />
          <span style={{ fontSize: 16, fontWeight: 700, color: '#4c1d95' }}>
            Phát hành Đơn thuốc Thay thế
          </span>
        </Space>
      }
      width={920}
      style={{ top: 20 }}
      footer={
        resultData ? (
          <Button
            type="primary"
            style={{ backgroundColor: '#7c3aed', borderColor: '#7c3aed' }}
            onClick={() => {
              onClose()
            }}
          >
            Đóng
          </Button>
        ) : (
          <Space>
            <Button disabled={submitting} onClick={onClose}>
              Hủy bỏ
            </Button>
            <Button
              type="primary"
              icon={<SwapOutlined />}
              loading={submitting}
              disabled={submitting}
              onClick={handleConfirmSubmit}
              style={{ backgroundColor: '#7c3aed', borderColor: '#7c3aed' }}
              id="btn-confirm-replace-prescription"
            >
              Phát hành đơn thay thế
            </Button>
          </Space>
        )
      }
    >
      {/* Màn hình kết quả khi thành công */}
      {resultData ? (
        <Result
          status="success"
          title="Phát hành đơn thuốc thay thế thành công!"
          subTitle="Đơn thuốc thay thế đã được tạo hợp lệ trên hệ thống và đơn gốc đã chuyển sang trạng thái Đã bị thay thế."
          extra={[
            <div
              key="detail-box"
              style={{
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: 8,
                padding: 16,
                textAlign: 'left',
                marginBottom: 16,
              }}
            >
              <Row gutter={[16, 12]}>
                <Col span={12}>
                  <Text type="secondary">Mã đơn thay thế mới:</Text>
                  <div>
                    <Tag color="green" style={{ fontSize: 14, fontWeight: 700, padding: '2px 8px' }}>
                      {resultData.replacementPrescription?.prescriptionCode || '—'}
                    </Tag>
                  </div>
                </Col>
                <Col span={12}>
                  <Text type="secondary">Mã đơn gốc đã thay thế:</Text>
                  <div>
                    <Tag color="purple" style={{ fontSize: 14, fontWeight: 700, padding: '2px 8px' }}>
                      {resultData.originalPrescription?.prescriptionCode || originalDisplayCode}
                    </Tag>
                  </div>
                </Col>
                <Col span={24}>
                  <Text type="secondary">Lý do thay thế đã ghi nhận:</Text>
                  <div style={{ fontWeight: 600, color: '#334155' }}>
                    {resultData.replacementPrescription?.replacementReason || replacementReason}
                  </div>
                </Col>
              </Row>

              <Divider style={{ margin: '12px 0' }} />

              <div>
                <Text strong style={{ display: 'block', marginBottom: 6 }}>
                  Trạng thái liên thông Cổng Quốc gia của đơn thay thế:
                </Text>
                {resultData.interconnection?.status === 'SUCCESS' ? (
                  <Alert
                    type="success"
                    showIcon
                    icon={<CheckCircleOutlined />}
                    message="Đã liên thông Cổng Quốc gia thành công"
                    description={
                      <div>
                        Mã biên nhận liên thông:{' '}
                        <Text code strong style={{ color: '#15803d' }}>
                          {resultData.interconnection?.receiptCode}
                        </Text>
                        <div style={{ fontSize: 12, color: '#166534', marginTop: 2 }}>
                          Đơn gốc đã được Cổng Quốc gia tự động đánh dấu hủy hiệu lực.
                        </div>
                      </div>
                    }
                  />
                ) : (
                  <Alert
                    type="warning"
                    showIcon
                    icon={<WarningOutlined />}
                    message="Gửi lên Cổng liên thông thất bại"
                    description={
                      <div>
                        <div style={{ color: '#b45309' }}>
                          Lý do:{' '}
                          {resultData.interconnection?.failureReason ||
                            'Lỗi kết nối cổng liên thông mô phỏng'}
                        </div>
                        <div style={{ marginTop: 4, fontSize: 12, color: '#78350f' }}>
                          👉 <strong>Lưu ý:</strong> Đơn thay thế đã được tạo thành công trên hệ thống nội bộ.
                          Bác sĩ hoặc Quản trị viên có thể sử dụng chức năng <strong>"Gửi lại liên thông"</strong> sẵn có
                          trong danh sách đơn thuốc để truyền lại dữ liệu sau mà không cần tạo lại đơn.
                        </div>
                      </div>
                    }
                  />
                )}
              </div>
            </div>,
          ]}
        />
      ) : (
        <div>
          {/* Thông báo lỗi nếu có */}
          {submitError && (
            <Alert
              type="error"
              showIcon
              icon={<CloseCircleOutlined />}
              message="Không thể phát hành đơn thay thế"
              description={submitError}
              style={{ marginBottom: 16 }}
              closable
              onClose={() => setSubmitError(null)}
            />
          )}

          {/* Banner thông tin đơn gốc & Cảnh báo bất biến */}
          <Card
            size="small"
            style={{
              marginBottom: 16,
              backgroundColor: '#f5f3ff',
              border: '1px solid #ddd6fe',
              borderRadius: 8,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
              <div>
                <Space size={6} align="center">
                  <BarcodeOutlined style={{ fontSize: 18, color: '#7c3aed' }} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#6d28d9', textTransform: 'uppercase' }}>
                    Đơn thuốc gốc cần thay thế:
                  </span>
                  <Text code strong style={{ fontSize: 15, color: '#6d28d9' }}>
                    {originalDisplayCode}
                  </Text>
                  {prescription.interconnectionReceiptCode && (
                    <Tag color="green" style={{ fontSize: 11, fontWeight: 600 }}>
                      Đã liên thông: {prescription.interconnectionReceiptCode}
                    </Tag>
                  )}
                </Space>
                <div style={{ fontSize: 12, color: '#5b21b6', marginTop: 4 }}>
                  <span>Bệnh nhân: <strong>{fixMojibake(prescription.patientName)}</strong> ({prescription.patientCode || '—'})</span>
                  <span style={{ margin: '0 8px' }}>•</span>
                  <span>Bác sĩ kê: <strong>{fixMojibake(prescription.doctorName)}</strong></span>
                  <span style={{ margin: '0 8px' }}>•</span>
                  <span>Ngày kê: {prescription.prescribedAt ? dayjs(prescription.prescribedAt).format('HH:mm DD/MM/YYYY') : '—'}</span>
                </div>
              </div>
            </div>

            <div
              style={{
                marginTop: 10,
                padding: '8px 12px',
                backgroundColor: '#fff1f2',
                border: '1px solid #fecdd3',
                borderRadius: 6,
                color: '#9f1239',
                fontSize: 12.5,
              }}
            >
              ⚠️ <strong>Cảnh báo nghiệp vụ:</strong> Sau khi phát hành, đơn gốc{' '}
              <strong>{originalDisplayCode}</strong> sẽ chuyển sang trạng thái{' '}
              <strong>ĐÃ BỊ THAY THẾ</strong> và không thể cấp phát, không thể sửa đổi hay in ấn.
              Cổng Quốc gia sẽ ghi nhận hủy đơn gốc và đồng bộ đơn thay thế mới.
            </div>
          </Card>

          {/* Ô nhập Lý do thay thế đơn thuốc */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <label style={{ fontWeight: 700, color: '#1e293b' }}>
                Lý do thay thế đơn thuốc <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <span style={{ fontSize: 12, color: replacementReason.length > 500 ? '#ef4444' : '#64748b' }}>
                {replacementReason.length}/500 ký tự
              </span>
            </div>

            <Input.TextArea
              rows={2}
              maxLength={500}
              disabled={submitting}
              value={replacementReason}
              onChange={(e) => setReplacementReason(e.target.value)}
              placeholder="Nhập lý do chuyên môn thay thế đơn thuốc (VD: Sai liều lượng so với chẩn đoán đã cập nhật...)"
              style={{ borderRadius: 6 }}
            />

            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginTop: 6 }}>
              <Text type="secondary" style={{ fontSize: 11 }}>Gợi ý lý do nhanh:</Text>
              {PRESET_REPLACEMENT_REASONS.map((preset, idx) => (
                <Tag
                  key={idx}
                  color="purple"
                  style={{ cursor: submitting ? 'not-allowed' : 'pointer', fontSize: 11, margin: 0 }}
                  onClick={() => {
                    if (!submitting) {
                      setReplacementReason(preset)
                    }
                  }}
                >
                  + {preset}
                </Tag>
              ))}
            </div>
          </div>

          <Divider style={{ margin: '14px 0' }} />

          {/* Danh sách thuốc thay thế */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
              <span style={{ fontWeight: 700, fontSize: 14, color: '#1e293b' }}>
                <MedicineBoxOutlined /> Danh sách thuốc của đơn thay thế ({items.length})
              </span>
              <Space>
                <Button
                  size="small"
                  type="dashed"
                  icon={<PlusOutlined />}
                  onClick={handleAddItem}
                  disabled={submitting}
                >
                  Thêm thuốc
                </Button>
                <Button
                  size="small"
                  icon={<SyncOutlined spin={checkingSafety} />}
                  onClick={() => runClinicalSafetyChecks(items)}
                  disabled={submitting || checkingSafety}
                >
                  Kiểm tra an toàn lâm sàng
                </Button>
              </Space>
            </div>

            {items.map((it, idx) => {
              const med = medicineMap.get(String(it.medicineId))
              return (
                <Card
                  key={it.clientId}
                  size="small"
                  style={{
                    marginBottom: 10,
                    borderRadius: 6,
                    border: '1px solid #e2e8f0',
                    borderLeft: it.isOriginal ? '4px solid #7c3aed' : '4px solid #0284c7',
                    backgroundColor: '#ffffff',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <Space size={6} align="center">
                      <Tag color="purple" style={{ fontWeight: 700, margin: 0 }}>
                        Thuốc #{idx + 1}
                      </Tag>
                      <Tag color={it.isOriginal ? 'default' : 'cyan'} style={{ margin: 0, fontSize: 11 }}>
                        {it.isOriginal ? 'Từ đơn gốc' : 'Thêm mới'}
                      </Tag>
                      {med?.isSpecialControl && (
                        <Tag color="red" style={{ fontWeight: 700, margin: 0, fontSize: 11 }}>
                          [Kiểm soát đặc biệt]
                        </Tag>
                      )}
                    </Space>

                    <Tooltip title={items.length <= 1 ? 'Đơn phải có ít nhất 1 loại thuốc' : 'Bỏ thuốc này'}>
                      <Button
                        type="text"
                        danger
                        size="small"
                        icon={<DeleteOutlined />}
                        disabled={submitting || items.length <= 1}
                        onClick={() => handleRemoveItem(it.clientId)}
                      >
                        Bỏ thuốc
                      </Button>
                    </Tooltip>
                  </div>

                  <Row gutter={[10, 8]}>
                    <Col xs={24} md={9}>
                      <div style={{ fontSize: 11, color: '#64748b', marginBottom: 2 }}>Thuốc *</div>
                      <Select
                        showSearch
                        style={{ width: '100%' }}
                        popupMatchSelectWidth={false}
                        dropdownStyle={{ minWidth: 360 }}
                        optionFilterProp="label"
                        disabled={submitting}
                        value={it.medicineId}
                        onChange={(val) => handleItemChange(it.clientId, 'medicineId', val)}
                        options={medicines.map((m) => ({
                          value: m.id,
                          label: `${m.isSpecialControl ? '[KSĐB] ' : ''}${fixMojibake(m.medicineName || m.name)} — ${m.strength || ''} (${m.unit || 'viên'})`,
                        }))}
                        placeholder="Chọn thuốc..."
                      />
                    </Col>

                    <Col xs={12} md={3}>
                      <div style={{ fontSize: 11, color: '#64748b', marginBottom: 2 }}>Liều dùng *</div>
                      <Input
                        disabled={submitting}
                        value={it.dosage}
                        onChange={(e) => handleItemChange(it.clientId, 'dosage', e.target.value)}
                        placeholder="VD: 1 viên"
                      />
                    </Col>

                    <Col xs={12} md={3}>
                      <div style={{ fontSize: 11, color: '#64748b', marginBottom: 2 }}>Lần/ngày *</div>
                      <InputNumber
                        min={1}
                        style={{ width: '100%' }}
                        disabled={submitting}
                        value={it.frequency}
                        onChange={(val) => handleItemChange(it.clientId, 'frequency', val)}
                      />
                    </Col>

                    <Col xs={12} md={6}>
                      <div style={{ fontSize: 11, color: '#64748b', marginBottom: 2 }}>Cách dùng *</div>
                      <Select
                        style={{ width: '100%' }}
                        popupMatchSelectWidth={false}
                        dropdownStyle={{ minWidth: 320 }}
                        disabled={submitting}
                        value={it.route}
                        onChange={(val) => handleItemChange(it.clientId, 'route', val)}
                        options={ROUTE_OPTIONS}
                      />
                    </Col>

                    <Col xs={12} md={3}>
                      <div style={{ fontSize: 11, color: '#64748b', marginBottom: 2 }}>Số ngày *</div>
                      <InputNumber
                        min={1}
                        style={{ width: '100%' }}
                        disabled={submitting}
                        value={it.durationDays}
                        onChange={(val) => handleItemChange(it.clientId, 'durationDays', val)}
                      />
                    </Col>

                    <Col xs={12} md={4}>
                      <div style={{ fontSize: 11, color: '#64748b', marginBottom: 2 }}>Số lượng tổng *</div>
                      <InputNumber
                        min={1}
                        style={{ width: '100%' }}
                        disabled={submitting}
                        value={it.quantity}
                        onChange={(val) => handleItemChange(it.clientId, 'quantity', val)}
                      />
                    </Col>

                    <Col xs={24} md={20}>
                      <div style={{ fontSize: 11, color: '#64748b', marginBottom: 2 }}>Cách dùng & Dặn dò</div>
                      <Input
                        disabled={submitting}
                        value={it.instructions}
                        onChange={(e) => handleItemChange(it.clientId, 'instructions', e.target.value)}
                        placeholder="VD: Uống sau bữa ăn sáng và tối..."
                      />
                    </Col>
                  </Row>
                </Card>
              )
            })}
          </div>

          {/* Cảnh báo an toàn lâm sàng (nếu có) */}
          {checkingSafety && (
            <div style={{ marginBottom: 12 }}>
              <Spin size="small" /> <Text type="secondary" style={{ fontSize: 12 }}>Đang kiểm tra an toàn lâm sàng...</Text>
            </div>
          )}

          {/* 1. Tương tác thuốc */}
          {interactions.length > 0 && (
            <Alert
              type="warning"
              showIcon
              icon={<WarningOutlined />}
              style={{ marginBottom: 12 }}
              message={`Phát hiện ${interactions.length} tương tác thuốc`}
              description={
                <div>
                  {interactions.map((inter, idx) => {
                    const ruleId = inter.ruleId || inter.id
                    return (
                      <div key={idx} style={{ marginBottom: 6 }}>
                        <div>
                          <strong>{inter.drugNameA}</strong> — <strong>{inter.drugNameB}</strong> ({inter.severity}): {inter.description}
                        </div>
                        <Input
                          size="small"
                          placeholder="Nhập lý do lâm sàng xác nhận bỏ qua cảnh báo tương tác..."
                          value={interactionOverrides[ruleId] || ''}
                          onChange={(e) =>
                            setInteractionOverrides((prev) => ({
                              ...prev,
                              [ruleId]: e.target.value,
                            }))
                          }
                          style={{ marginTop: 2, maxWidth: 500 }}
                        />
                      </div>
                    )
                  })}
                </div>
              }
            />
          )}

          {/* 2. Dị ứng thuốc */}
          {allergyWarnings.length > 0 && (
            <Alert
              type="error"
              showIcon
              icon={<FireOutlined />}
              style={{ marginBottom: 12 }}
              message={`Phát hiện ${allergyWarnings.length} cảnh báo dị ứng thuốc`}
              description={
                <div>
                  {allergyWarnings.map((al, idx) => {
                    const key = `${al.allergyId}_${al.medicineId}`
                    return (
                      <div key={idx} style={{ marginBottom: 6 }}>
                        <div>
                          <strong>{al.allergenName}</strong> ({al.severity}): {al.warningMessage || 'Thuốc trùng hoạt chất với tiền sử dị ứng'}
                        </div>
                        <Input
                          size="small"
                          placeholder="Nhập lý do lâm sàng xác nhận bỏ qua cảnh báo dị ứng..."
                          value={allergyOverrides[key] || ''}
                          onChange={(e) =>
                            setAllergyOverrides((prev) => ({
                              ...prev,
                              [key]: e.target.value,
                            }))
                          }
                          style={{ marginTop: 2, maxWidth: 500 }}
                        />
                      </div>
                    )
                  })}
                </div>
              }
            />
          )}

          {/* 3. Chống chỉ định */}
          {contraindications.length > 0 && (
            <Alert
              type="error"
              showIcon
              icon={<WarningOutlined />}
              style={{ marginBottom: 12 }}
              message={`Phát hiện ${contraindications.length} cảnh báo chống chỉ định`}
              description={
                <div>
                  {contraindications.map((ct, idx) => {
                    const key = `${ct.ruleId || ct.id}_${ct.medicineId}`
                    return (
                      <div key={idx} style={{ marginBottom: 6 }}>
                        <div>
                          <strong>{ct.medicineName}</strong>: {ct.description || ct.reason || 'Chống chỉ định theo tiền sử bệnh'}
                        </div>
                        <Input
                          size="small"
                          placeholder="Nhập lý do lâm sàng xác nhận vượt qua chống chỉ định..."
                          value={contraindicationOverrides[key] || ''}
                          onChange={(e) =>
                            setContraindicationOverrides((prev) => ({
                              ...prev,
                              [key]: e.target.value,
                            }))
                          }
                          style={{ marginTop: 2, maxWidth: 500 }}
                        />
                      </div>
                    )
                  })}
                </div>
              }
            />
          )}

          {/* 4. Vượt liều tối đa ngày */}
          {maxDoseWarnings.length > 0 && (
            <Alert
              type="warning"
              showIcon
              icon={<WarningOutlined />}
              style={{ marginBottom: 12 }}
              message={`Phát hiện ${maxDoseWarnings.length} hoạt chất vượt liều tối đa hàng ngày`}
              description={
                <div>
                  {maxDoseWarnings.map((dose, idx) => {
                    const ing = dose.activeIngredient
                    return (
                      <div key={idx} style={{ marginBottom: 6 }}>
                        <div>
                          <strong>{ing}</strong>: Tổng liều {dose.totalDailyDoseMg}mg vượt ngưỡng cho phép ({dose.maxDailyDoseMg}mg/ngày).
                        </div>
                        <Input
                          size="small"
                          placeholder={`Nhập lý do lâm sàng cho hoạt chất ${ing}...`}
                          value={maxDoseOverrides[ing] || ''}
                          onChange={(e) =>
                            setMaxDoseOverrides((prev) => ({
                              ...prev,
                              [ing]: e.target.value,
                            }))
                          }
                          style={{ marginTop: 2, maxWidth: 500 }}
                        />
                      </div>
                    )
                  })}
                </div>
              }
            />
          )}

          {/* Xác nhận thuốc kiểm soát đặc biệt */}
          {hasSpecialControl && (
            <div
              style={{
                marginBottom: 12,
                padding: '8px 12px',
                backgroundColor: '#fff7ed',
                border: '1px solid #ffedd5',
                borderRadius: 6,
              }}
            >
              <Checkbox
                checked={controlledMedicineConfirmed}
                onChange={(e) => setControlledMedicineConfirmed(e.target.checked)}
                disabled={submitting}
              >
                <span style={{ fontWeight: 600, color: '#c2410c' }}>
                  Xác nhận kê đơn thuốc kiểm soát đặc biệt và chịu trách nhiệm chuyên môn theo quy định Bộ Y tế.
                </span>
              </Checkbox>
            </div>
          )}

          {/* Ghi chú đơn thay thế */}
          <div style={{ marginTop: 12 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>
              Ghi chú của đơn thay thế
            </label>
            <Input.TextArea
              rows={2}
              disabled={submitting}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ghi chú thêm dặn dò cho người bệnh hoặc dược sĩ quầy thuốc..."
            />
          </div>
        </div>
      )}
    </Modal>
  )
}
