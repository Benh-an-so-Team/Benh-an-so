import React, { useState, useEffect } from 'react'
import { Modal, Select, Button, Alert, Space, Typography, message, Spin, Descriptions, Tag } from 'antd'
import { BookOutlined, CheckCircleOutlined, ExclamationCircleOutlined, MedicineBoxOutlined } from '@ant-design/icons'
import prescriptionTemplateApi from '../../api/prescriptionTemplateApi.js'
import medicalRecordApi from '../../api/medicalRecordApi.js'
import { mapTemplateErrorMessage } from '../../utils/prescriptionTemplateHelpers.js'
import { fixMojibake } from '../../utils/serviceCatalogValidation.js'

const { Text, Paragraph } = Typography

/**
 * NCL-05-CN-008: Modal lưu đơn thuốc đã kê thành bộ đơn mẫu theo chẩn đoán
 */
function SaveAsTemplateModal({
  open,
  onClose,
  prescription,
  diagnoses = [],
  onSuccess,
}) {
  const [selectedDiagnosisCode, setSelectedDiagnosisCode] = useState(null)
  const [availableDiagnoses, setAvailableDiagnoses] = useState([])
  const [loadingDiagnoses, setLoadingDiagnoses] = useState(false)
  const [saving, setSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    if (!open || !prescription) {
      setSelectedDiagnosisCode(null)
      setAvailableDiagnoses([])
      setErrorMessage('')
      return
    }

    const initDiagnoses = async () => {
      setErrorMessage('')
      // 1. Nếu component cha đã truyền sẵn danh sách chẩn đoán hợp lệ
      if (Array.isArray(diagnoses) && diagnoses.length > 0) {
        normalizeAndSetDiagnoses(diagnoses)
        return
      }

      // 2. Nếu chưa có, tự động truy vấn danh sách chẩn đoán từ bệnh án nguồn
      if (prescription.medicalRecordId) {
        setLoadingDiagnoses(true)
        try {
          const res = await medicalRecordApi.getDiagnosis(prescription.medicalRecordId)
          const list = Array.isArray(res?.data) ? res.data : []
          normalizeAndSetDiagnoses(list)
        } catch (err) {
          console.warn('Không thể nạp chẩn đoán bệnh án:', err)
          setErrorMessage('Không thể tải danh sách chẩn đoán của bệnh án. Vui lòng kiểm tra lại kết nối.')
        } finally {
          setLoadingDiagnoses(false)
        }
      } else {
        setAvailableDiagnoses([])
      }
    }

    initDiagnoses()
  }, [open, prescription, diagnoses])

  const normalizeAndSetDiagnoses = (rawList) => {
    const map = new Map()
    rawList.forEach((d) => {
      const code = (d.diagnosisCode || d.code || '').trim().toUpperCase()
      const name = fixMojibake(d.diagnosisName || d.name || '').trim()
      if (code && !map.has(code)) {
        map.set(code, {
          code,
          name: name || code,
          type: d.diagnosisType || d.type || 'DIAGNOSIS',
        })
      }
    })

    const list = Array.from(map.values())
    setAvailableDiagnoses(list)

    if (list.length === 1) {
      setSelectedDiagnosisCode(list[0].code)
    } else if (list.length > 1) {
      const primary = list.find((item) => item.type === 'PRIMARY') || list[0]
      setSelectedDiagnosisCode(primary.code)
    } else {
      setSelectedDiagnosisCode(null)
    }
  }

  const handleSave = async () => {
    if (!prescription?.id) {
      message.error('Không tìm thấy thông tin đơn thuốc nguồn.')
      return
    }

    if (!selectedDiagnosisCode) {
      message.warning('Vui lòng chọn một chẩn đoán trong bệnh án để gắn với đơn thuốc mẫu.')
      return
    }

    setSaving(true)
    setErrorMessage('')

    try {
      const response = await prescriptionTemplateApi.save(prescription.id, selectedDiagnosisCode)
      const selectedDiag = availableDiagnoses.find((d) => d.code === selectedDiagnosisCode)
      const diagDisplay = selectedDiag ? `${selectedDiag.name} (${selectedDiag.code})` : selectedDiagnosisCode

      message.success(`Đã lưu đơn thuốc thành mẫu cho chẩn đoán ${diagDisplay}.`)

      if (onSuccess) {
        onSuccess(response?.data)
      }
      onClose()
    } catch (error) {
      const userMsg = mapTemplateErrorMessage(error)
      setErrorMessage(userMsg)
      message.error(userMsg)
    } finally {
      setSaving(false)
    }
  }

  const selectedDiagnosis = availableDiagnoses.find((d) => d.code === selectedDiagnosisCode)
  const itemCount = prescription?.items?.length || 0

  return (
    <Modal
      open={open}
      title={
        <Space>
          <BookOutlined style={{ color: '#2563eb', fontSize: 18 }} />
          <span style={{ fontWeight: 600 }}>Lưu đơn thuốc thành bộ mẫu theo chẩn đoán</span>
        </Space>
      }
      onCancel={onClose}
      destroyOnClose
      width={580}
      footer={[
        <Button key="cancel" onClick={onClose} disabled={saving}>
          Hủy
        </Button>,
        <Button
          key="submit"
          type="primary"
          icon={<CheckCircleOutlined />}
          loading={saving}
          disabled={loadingDiagnoses || availableDiagnoses.length === 0 || !selectedDiagnosisCode}
          onClick={handleSave}
          id="btn-confirm-save-as-template"
        >
          Lưu thành mẫu
        </Button>,
      ]}
    >
      <div style={{ marginTop: 12 }}>
        <Descriptions size="small" bordered column={1} style={{ marginBottom: 16 }}>
          <Descriptions.Item label="Đơn thuốc nguồn">
            <Text strong>{prescription?.prescriptionCode || prescription?.id || '—'}</Text>{' '}
            <Tag color="blue">{itemCount} loại thuốc</Tag>
          </Descriptions.Item>
          {prescription?.doctorName && (
            <Descriptions.Item label="Bác sĩ kê đơn">
              {prescription.doctorName}
            </Descriptions.Item>
          )}
        </Descriptions>

        <Alert
          type="info"
          showIcon
          message="Gắn mẫu đơn thuốc theo mã bệnh"
          description="Đơn thuốc mẫu được lưu sẽ gắn trực tiếp với mã chẩn đoán đã chọn. Khi khám các lượt sau có cùng chẩn đoán, bạn có thể áp dụng nhanh mẫu này để dựng sẵn danh sách thuốc."
          style={{ marginBottom: 16 }}
        />

        {errorMessage && (
          <Alert
            type="error"
            showIcon
            message={errorMessage}
            style={{ marginBottom: 16 }}
          />
        )}

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', marginBottom: 6, fontWeight: 600, color: '#334155' }}>
            Chẩn đoán gắn với mẫu <span style={{ color: '#ef4444' }}>*</span>:
          </label>

          {loadingDiagnoses ? (
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <Spin tip="Đang kiểm tra chẩn đoán bệnh án..." size="small" />
            </div>
          ) : availableDiagnoses.length === 0 ? (
            <Alert
              type="warning"
              showIcon
              icon={<ExclamationCircleOutlined />}
              message="Không có chẩn đoán hợp lệ"
              description="Bệnh án của đơn thuốc này chưa có dữ liệu chẩn đoán ICD để gắn mẫu. Bạn chỉ có thể lưu mẫu cho các chẩn đoán đã ghi trong bệnh án."
            />
          ) : (
            <Select
              style={{ width: '100%' }}
              value={selectedDiagnosisCode}
              onChange={(value) => {
                setSelectedDiagnosisCode(value)
                setErrorMessage('')
              }}
              placeholder="Chọn chẩn đoán từ bệnh án..."
              options={availableDiagnoses.map((d) => ({
                value: d.code,
                label: (
                  <Space>
                    <Tag color="cyan">{d.code}</Tag>
                    <span>{d.name}</span>
                  </Space>
                ),
              }))}
              id="select-template-diagnosis-code"
            />
          )}

          <div style={{ marginTop: 6, fontSize: 12, color: '#64748b' }}>
            * Theo quy định y tế, mã bệnh bắt buộc phải nằm trong danh mục chẩn đoán của lượt khám nguồn.
          </div>
        </div>

        {selectedDiagnosis && (
          <div
            style={{
              padding: '10px 14px',
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: 6,
              fontSize: 13,
            }}
          >
            <Text type="secondary">Mẫu sẽ được lưu với chẩn đoán:</Text>{' '}
            <Text strong style={{ color: '#0284c7' }}>
              [{selectedDiagnosis.code}] {selectedDiagnosis.name}
            </Text>
          </div>
        )}
      </div>
    </Modal>
  )
}

export default SaveAsTemplateModal
