import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { Alert, Table, Button, Tag, Typography, Space, Popconfirm, message, Modal, Tooltip } from 'antd'
import { EyeOutlined, InboxOutlined, DeleteOutlined, HistoryOutlined, EditOutlined, LockOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import medicalRecordApi from '../api/medicalRecordApi'
import MedicalRecordVersionHistoryModal from '../components/clinical/MedicalRecordVersionHistoryModal'
import AmendMedicalRecordModal from '../components/clinical/AmendMedicalRecordModal'
import { formatDateTime, formatRecordStatus } from '../utils/helpers'
import { isMedicalRecordSigned } from '../utils/medicalRecordSignHelpers'
import { normalizeMedicalRecordDetail } from '../utils/workflowContract'
import { useAuthContext } from '../context/AuthContext'
import { getApiErrorMessage } from '../utils/apiError'
import { canViewMedicalRecordVersionHistory } from '../utils/medicalRecordVersionHelpers'

const { Title } = Typography

function MedicalRecordList({ patientId }) {
  const navigate = useNavigate()
  const { user } = useAuthContext()
  const [loading, setLoading] = useState(false)
  const [records, setRecords] = useState([])
  const [actionLoadingId, setActionLoadingId] = useState(null)
  const [selectedRecordForVersion, setSelectedRecordForVersion] = useState(null)
  const [versionModalOpen, setVersionModalOpen] = useState(false)

  const userPermissions = useMemo(() => {
    return (user?.permissions || []).map((p) => String(p || '').toUpperCase().replace(/^PERMISSION_/, ''))
  }, [user])

  const userRoles = useMemo(() => {
    return (user?.roles || []).map((r) => String(r || '').toLowerCase().replace(/^role_/, ''))
  }, [user])

  const canDeleteRecord = userPermissions.includes('MEDICAL_RECORD_DELETE') || userPermissions.includes('RECORD_DELETE') || userRoles.includes('admin')
  const canArchiveRecord = userPermissions.includes('MEDICAL_RECORD_UPDATE_STATUS') || userPermissions.includes('MEDICAL_RECORD_UPDATE') || userPermissions.includes('RECORD_UPDATE_STATUS') || userRoles.includes('admin') || userRoles.includes('doctor')
  const canViewVersionHistory = canViewMedicalRecordVersionHistory(userRoles, userPermissions)

  const fetchRecords = useCallback(async () => {
    if (!patientId) {
      setRecords([])
      return
    }
    setLoading(true)
    try {
      const response = await medicalRecordApi.getByPatient(patientId)
      const list = Array.isArray(response?.data)
        ? response.data.map(normalizeMedicalRecordDetail).filter(Boolean)
        : []
      setRecords(list)
    } catch {
      setRecords([])
    } finally {
      setLoading(false)
    }
  }, [patientId])

  useEffect(() => {
    fetchRecords()
  }, [fetchRecords])

  const handleArchive = async (record) => {
    const recordId = record.id || record.medicalRecordId
    if (!recordId) return
    setActionLoadingId(recordId)
    try {
      await medicalRecordApi.archive(recordId)
      message.success('Đã lưu trữ hồ sơ bệnh án thành công.')
      setRecords((prev) =>
        prev.map((item) => ((item.id === recordId || item.medicalRecordId === recordId) ? { ...item, status: 'ARCHIVED' } : item)),
      )
    } catch (err) {
      const msg = getApiErrorMessage(err, 'Không thể lưu trữ hồ sơ bệnh án.')
      message.error(msg)
    } finally {
      setActionLoadingId(null)
    }
  }

  const handleDelete = async (record) => {
    const recordId = record.id || record.medicalRecordId
    if (!recordId) return
    setActionLoadingId(recordId)
    try {
      await medicalRecordApi.delete(recordId)
      message.success('Đã xóa hồ sơ bệnh án thành công.')
      setRecords((prev) => prev.filter((item) => item.id !== recordId && item.medicalRecordId !== recordId))
    } catch (err) {
      const code = err?.response?.data?.code
      if (code === 'MEDICAL_RECORD_IN_RETENTION_PERIOD') {
        Modal.warning({
          title: 'Không thể xóa hồ sơ bệnh án',
          content: 'Hồ sơ đang trong thời hạn lưu trữ bắt buộc, không thể xóa. Vui lòng dùng chức năng lưu trữ (Archive) nếu cần ẩn hồ sơ khỏi danh sách hoạt động.',
          okText: 'Đã hiểu',
        })
      } else {
        const msg = getApiErrorMessage(err, 'Không thể xóa hồ sơ bệnh án.')
        message.error(msg)
      }
    } finally {
      setActionLoadingId(null)
    }
  }

  const columns = [
    {
      title: 'Mã hồ sơ',
      dataIndex: 'recordCode',
      key: 'recordCode',
      width: 140,
      render: (text, record) => {
        const fullId = record.medicalRecordId || record.id || text || ''
        const displayCode = text && text.startsWith('BA-')
          ? text
          : (fullId ? `BA-${String(fullId).substring(0, 8).toUpperCase()}` : '---')
        return (
          <Tooltip title={`ID đầy đủ: ${fullId}`} placement="topLeft">
            <Tag color="cyan" style={{ fontWeight: 600, fontFamily: 'monospace', margin: 0 }}>
              {displayCode}
            </Tag>
          </Tooltip>
        )
      },
    },
    {
      title: 'Mã bệnh nhân',
      dataIndex: 'patientCode',
      key: 'patientCode',
      width: 130,
      render: (text) => (text ? <Tag color="blue" style={{ fontWeight: 500, margin: 0 }}>{text}</Tag> : '---'),
    },
    {
      title: 'Tên bệnh nhân',
      dataIndex: 'patientName',
      key: 'patientName',
      ellipsis: true,
    },
    {
      title: 'Bác sĩ',
      dataIndex: 'doctorName',
      key: 'doctorName',
      width: 150,
      render: (text) => text || '---',
    },
    {
      title: 'Chẩn đoán',
      dataIndex: 'diagnosis',
      key: 'diagnosis',
      ellipsis: true,
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      width: 130,
      align: 'center',
      render: (status) => {
        if (status === 'ARCHIVED') {
          return (
            <Tag color="purple" icon={<LockOutlined />} style={{ fontWeight: 600 }}>
              Hồ sơ lưu trữ
            </Tag>
          )
        }
        const formatted = formatRecordStatus(status)
        return <Tag color={formatted.color}>{formatted.label}</Tag>
      },
    },
    {
      title: 'Ngày tạo',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 170,
      align: 'center',
      render: (date) => formatDateTime(date),
    },
    {
      title: 'Thao tác',
      key: 'actions',
      width: 280,
      render: (_, record) => {
        const recordId = record.id || record.medicalRecordId
        const isArchived = record.status === 'ARCHIVED'
        const isSigned = isMedicalRecordSigned(record.status)
        const isBusy = actionLoadingId === recordId

        return (
          <Space size="small">
            <Button
              type="link"
              size="small"
              icon={<EyeOutlined />}
              disabled={!record.visitId || isBusy}
              onClick={() => navigate(`/medical-records/visits/${record.visitId}`)}
            >
              Xem
            </Button>
            {(canViewVersionHistory || isSigned) && (
              <Button
                type="link"
                size="small"
                icon={<HistoryOutlined />}
                style={{ color: '#4f46e5' }}
                onClick={() => {
                  setSelectedRecordForVersion(recordId)
                  setVersionModalOpen(true)
                }}
              >
                Phiên bản
              </Button>
            )}
            {canArchiveRecord && !isArchived && (
              <Popconfirm
                title="Lưu trữ hồ sơ bệnh án?"
                description="Hồ sơ sẽ được đóng băng và chuyển sang trạng thái Lưu trữ (Archived)."
                onConfirm={() => handleArchive(record)}
                okText="Lưu trữ"
                cancelText="Hủy"
                disabled={isBusy}
              >
                <Button
                  type="link"
                  size="small"
                  icon={<InboxOutlined />}
                  loading={isBusy}
                  style={{ color: '#7c3aed' }}
                >
                  Lưu trữ
                </Button>
              </Popconfirm>
            )}
            {canDeleteRecord && !isArchived && (
              <Popconfirm
                title="Xóa hồ sơ bệnh án?"
                description="Bạn có chắc chắn muốn xóa hồ sơ này? (Lưu ý: Chỉ hồ sơ ngoài thời hạn lưu trữ mới xóa được)."
                onConfirm={() => handleDelete(record)}
                okText="Xóa"
                cancelText="Hủy"
                okButtonProps={{ danger: true }}
                disabled={isBusy}
              >
                <Button
                  type="link"
                  size="small"
                  danger
                  icon={<DeleteOutlined />}
                  loading={isBusy}
                >
                  Xóa
                </Button>
              </Popconfirm>
            )}
          </Space>
        )
      },
    },
  ]

  return (
    <div>
      <div className="page-header">
        <Title level={4} style={{ margin: 0 }}>Lịch sử bệnh án theo bệnh nhân</Title>
      </div>

      {!patientId && (
        <Alert
          type="info"
          showIcon
          message="Cần patientId để tải lịch sử bệnh án"
          description="Backend không cung cấp danh sách bệnh án toàn hệ thống; hãy mở lịch sử từ hồ sơ một bệnh nhân cụ thể."
          style={{ marginBottom: 16 }}
        />
      )}

      <Table
        columns={columns}
        dataSource={records}
        rowKey="id"
        loading={loading}
        pagination={{
          pageSize: 10,
          showSizeChanger: true,
          showTotal: (total) => `Tổng số: ${total} hồ sơ`,
        }}
      />

      {versionModalOpen && selectedRecordForVersion && (
        <MedicalRecordVersionHistoryModal
          open={versionModalOpen}
          onClose={() => {
            setVersionModalOpen(false)
            setSelectedRecordForVersion(null)
          }}
          recordId={selectedRecordForVersion}
          canAmend={false}
        />
      )}
    </div>
  )
}

export default MedicalRecordList
