import React, { useState, useEffect, useCallback } from 'react'
import {
  Drawer,
  Timeline,
  Typography,
  Input,
  Button,
  Space,
  Tag,
  Alert,
  Spin,
  Empty,
  Divider,
  message,
} from 'antd'
import {
  ClockCircleOutlined,
  CheckCircleOutlined,
  FileTextOutlined,
  PlusOutlined,
  ExclamationCircleOutlined,
  SendOutlined,
  UserOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import prescriptionReconciliationApi from '../../api/prescriptionReconciliationApi.js'
import {
  getOutcomeTag,
  validateNote,
} from '../../utils/prescriptionReconciliationHelpers.js'

const { Title, Text, Paragraph } = Typography
const { TextArea } = Input

/**
 * ReconciliationNotesDrawer.jsx
 * 
 * Drawer displaying append-only note history (oldest first)
 * and form to record a new reconciliation reason/note (NCL-12-CN-007).
 */
export default function ReconciliationNotesDrawer({
  open,
  onClose,
  prescription,
  canAddNote,
  onNoteAdded,
}) {
  const [notes, setNotes] = useState([])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [newReason, setNewReason] = useState('')
  const [validationError, setValidationError] = useState('')

  const prescriptionId = prescription?.prescriptionId

  // Fetch note history
  const fetchNotes = useCallback(async () => {
    if (!prescriptionId) return
    setLoading(true)
    try {
      const response = await prescriptionReconciliationApi.getNotes(prescriptionId)
      // Backend returns notes sorted oldest-first. Preserve exact backend order.
      setNotes(Array.isArray(response?.data) ? response.data : [])
    } catch (err) {
      console.error('Lỗi khi tải lịch sử ghi chú đối chiếu:', err)
      message.error(err.response?.data?.message || 'Không thể tải lịch sử ghi chú đối chiếu.')
    } finally {
      setLoading(false)
    }
  }, [prescriptionId])

  useEffect(() => {
    if (open && prescriptionId) {
      setNewReason('')
      setValidationError('')
      fetchNotes()
    } else {
      setNotes([])
    }
  }, [open, prescriptionId, fetchNotes])

  // Handle submit note
  const handleSubmitNote = async () => {
    const valResult = validateNote(newReason)
    if (!valResult.valid) {
      setValidationError(valResult.error)
      return
    }
    setValidationError('')
    setSubmitting(true)

    try {
      const res = await prescriptionReconciliationApi.addNote(prescriptionId, valResult.trimmed)
      const recordedNote = res?.data || {
        id: Date.now(),
        reason: valResult.trimmed,
        reconciliationOutcome: prescription.outcome,
        notedAt: new Date().toISOString(),
      }

      // Append to local list
      setNotes((prev) => [...prev, recordedNote])
      setNewReason('')
      message.success('Đã lưu ghi chú giải trình thành công.')

      // Notify parent to increment badge count locally
      if (typeof onNoteAdded === 'function') {
        onNoteAdded(recordedNote, prescriptionId)
      }
    } catch (err) {
      const errMsg = err.response?.data?.message || 'Lỗi khi lưu ghi chú giải trình.'
      setValidationError(errMsg)
      message.error(errMsg)
    } finally {
      setSubmitting(false)
    }
  }

  const outcomeInfo = getOutcomeTag(prescription?.outcome)

  return (
    <Drawer
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <FileTextOutlined style={{ color: '#2563eb', fontSize: 18 }} />
          <span>
            Lịch sử ghi chú đối chiếu đơn: <strong>{prescription?.prescriptionCode || '---'}</strong>
          </span>
        </div>
      }
      placement="right"
      width={520}
      open={open}
      onClose={onClose}
      destroyOnClose
    >
      {/* Header Info Card */}
      {prescription && (
        <div
          style={{
            backgroundColor: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: 8,
            padding: '12px 16px',
            marginBottom: 20,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontWeight: 600, color: '#1e293b' }}>
              Mã đơn: <Tag color="blue" style={{ fontWeight: 700 }}>{prescription.prescriptionCode}</Tag>
            </span>
            <Tag color={outcomeInfo.antdColor} style={{ fontWeight: 600 }}>
              {outcomeInfo.label}
            </Tag>
          </div>
          <div style={{ fontSize: 13, color: '#475569', marginBottom: 4 }}>
            Bệnh nhân: <strong>{prescription.patientName || '---'}</strong> ({prescription.patientCode || '---'})
          </div>
          {prescription.doctorName && (
            <div style={{ fontSize: 12, color: '#64748b' }}>
              Bác sĩ kê đơn: BS. {prescription.doctorName}
            </div>
          )}
          {prescription.lastInterconnectionError && (
            <Alert
              type="error"
              showIcon
              message="Lỗi liên thông gần nhất"
              description={prescription.lastInterconnectionError}
              style={{ marginTop: 8, fontSize: 12 }}
            />
          )}
        </div>
      )}

      {/* Note History Section */}
      <div style={{ marginBottom: 24 }}>
        <Title level={5} style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '0 0 16px 0' }}>
          <ClockCircleOutlined style={{ color: '#64748b' }} />
          <span>Lịch sử giải trình ({notes.length})</span>
        </Title>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '32px 0' }}>
            <Spin tip="Đang tải lịch sử ghi chú..." />
          </div>
        ) : notes.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="Chưa có ghi chú giải trình nào cho đơn này."
            style={{ padding: '16px 0' }}
          />
        ) : (
          <Timeline
            items={notes.map((noteItem, idx) => {
              const noteOutcome = getOutcomeTag(noteItem.reconciliationOutcome || prescription?.outcome)
              const formattedTime = noteItem.notedAt
                ? dayjs(noteItem.notedAt).format('DD/MM/YYYY HH:mm:ss')
                : '---'

              return {
                key: noteItem.id || idx,
                color: idx === notes.length - 1 ? 'blue' : 'gray',
                children: (
                  <div
                    style={{
                      backgroundColor: '#ffffff',
                      border: '1px solid #e2e8f0',
                      borderRadius: 8,
                      padding: '10px 14px',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <span style={{ fontSize: 11, color: '#64748b' }}>
                        <ClockCircleOutlined style={{ marginRight: 4 }} />
                        {formattedTime}
                      </span>
                      <Tag color={noteOutcome.antdColor} style={{ fontSize: 10 }}>
                        {noteOutcome.label}
                      </Tag>
                    </div>
                    <Paragraph style={{ margin: 0, fontSize: 13, color: '#1e293b', whiteSpace: 'pre-wrap' }}>
                      {noteItem.reason || noteItem.note || '---'}
                    </Paragraph>
                  </div>
                ),
              }
            })}
          />
        )}
      </div>

      <Divider style={{ margin: '16px 0' }} />

      {/* Add Note Form */}
      <div>
        <Title level={5} style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '0 0 12px 0' }}>
          <PlusOutlined style={{ color: '#2563eb' }} />
          <span>Thêm ghi chú giải trình mới</span>
        </Title>

        {!canAddNote ? (
          <Alert
            type="info"
            showIcon
            message="Không thể ghi chú"
            description="Chỉ những đơn có trạng thái lệch dữ liệu (discrepancy = true) và chưa bị hủy mới được phép ghi nhận lý do giải trình theo quy định."
            style={{ fontSize: 13 }}
          />
        ) : (
          <div>
            <TextArea
              rows={4}
              maxLength={500}
              showCount
              value={newReason}
              onChange={(e) => {
                setNewReason(e.target.value)
                if (validationError) setValidationError('')
              }}
              placeholder="Nhập lý do/ghi chú giải trình cho trường hợp lệch này (tối đa 500 ký tự)..."
              disabled={submitting}
              style={{ borderRadius: 8, marginBottom: 8 }}
            />

            {validationError && (
              <div style={{ color: '#dc2626', fontSize: 12, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 4 }}>
                <ExclamationCircleOutlined />
                <span>{validationError}</span>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
              <Button
                type="primary"
                icon={<SendOutlined />}
                onClick={handleSubmitNote}
                loading={submitting}
                disabled={!newReason.trim()}
                style={{ backgroundColor: '#2563eb', borderRadius: 6 }}
              >
                Lưu ghi chú
              </Button>
            </div>
          </div>
        )}
      </div>
    </Drawer>
  )
}
