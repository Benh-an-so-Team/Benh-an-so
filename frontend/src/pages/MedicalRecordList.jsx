import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { Alert, Table, Button, Tag, Typography, Space, Popconfirm, message, Modal, Tooltip, Select, Card, Dropdown } from 'antd'
import {
  EyeOutlined,
  InboxOutlined,
  DeleteOutlined,
  HistoryOutlined,
  EditOutlined,
  LockOutlined,
  DownloadOutlined,
  ReloadOutlined,
  MoreOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import medicalRecordApi from '../api/medicalRecordApi.js'
import patientApi from '../api/patientApi.js'
import medicalRecordExportApi from '../api/medicalRecordExportApi.js'
import MedicalRecordVersionHistoryModal from '../components/clinical/MedicalRecordVersionHistoryModal.jsx'
import AmendMedicalRecordModal from '../components/clinical/AmendMedicalRecordModal.jsx'
import ExportMedicalRecordModal from '../components/medicalRecord/ExportMedicalRecordModal.jsx'
import { formatDateTime, formatRecordStatus } from '../utils/helpers.js'
import { isMedicalRecordSigned } from '../utils/medicalRecordSignHelpers.js'
import { normalizeMedicalRecordDetail } from '../utils/workflowContract.js'
import { useAuthContext } from '../context/AuthContext.jsx'
import { getApiErrorMessage } from '../utils/apiError.js'
import { canViewMedicalRecordVersionHistory } from '../utils/medicalRecordVersionHelpers.js'
import {
  canExportRecord,
  canUserExportMedicalRecords,
  downloadBlobFile,
  extractBlobErrorMessage,
  mapExportErrorMessage,
} from '../utils/medicalRecordExportHelpers.js'

const { Title, Text } = Typography

function MedicalRecordList({ patientId }) {
  const navigate = useNavigate()
  const { user } = useAuthContext()
  const [loading, setLoading] = useState(false)
  const [records, setRecords] = useState([])
  const [actionLoadingId, setActionLoadingId] = useState(null)
  const [selectedRecordForVersion, setSelectedRecordForVersion] = useState(null)
  const [versionModalOpen, setVersionModalOpen] = useState(false)

  // NCL-11-CN-007: State & permissions for exporting medical records
  const [searchPatientId, setSearchPatientId] = useState(!patientId ? 'ALL' : null)
  const [patients, setPatients] = useState([])
  const [patientLoading, setPatientLoading] = useState(false)
  const [selectedRowKeys, setSelectedRowKeys] = useState([])
  const [selectedRecords, setSelectedRecords] = useState([])
  const [batchExportModalOpen, setBatchExportModalOpen] = useState(false)
  const [singleExportingId, setSingleExportingId] = useState(null)

  const effectivePatientId = patientId || searchPatientId

  const userPermissions = useMemo(() => {
    return (user?.permissions || []).map((p) => String(p || '').toUpperCase().replace(/^PERMISSION_/, ''))
  }, [user])

  const userRoles = useMemo(() => {
    return (user?.roles || []).map((r) => String(r || '').toLowerCase().replace(/^role_/, ''))
  }, [user])

  const canDeleteRecord = userPermissions.includes('MEDICAL_RECORD_DELETE') || userPermissions.includes('RECORD_DELETE') || userRoles.includes('admin')
  const canArchiveRecord = userPermissions.includes('MEDICAL_RECORD_UPDATE_STATUS') || userPermissions.includes('MEDICAL_RECORD_UPDATE') || userPermissions.includes('RECORD_UPDATE_STATUS') || userRoles.includes('admin') || userRoles.includes('doctor')
  const canViewVersionHistory = canViewMedicalRecordVersionHistory(userRoles, userPermissions)
  const canExport = canUserExportMedicalRecords(userRoles, userPermissions)

  useEffect(() => {
    if (!patientId) {
      setPatientLoading(true)
      patientApi
        .getAll({ page: 0, size: 50 })
        .then((res) => {
          const list = Array.isArray(res?.data?.content)
            ? res.data.content
            : (Array.isArray(res?.data) ? res.data : (Array.isArray(res?.data?.items) ? res.data.items : []))
          setPatients(list)
        })
        .catch(() => setPatients([]))
        .finally(() => setPatientLoading(false))
    }
  }, [patientId])

  const fetchRecords = useCallback(async () => {
    setLoading(true)
    try {
      if (effectivePatientId && effectivePatientId !== 'ALL') {
        const response = await medicalRecordApi.getByPatient(effectivePatientId)
        const list = Array.isArray(response?.data)
          ? response.data.map(normalizeMedicalRecordDetail).filter(Boolean)
          : []
        setRecords(list)
      } else {
        // Chế độ xem tổng hợp toàn hệ thống cho trang Xuất hồ sơ
        let combined = []
        if (patients.length > 0) {
          const targetPatients = patients.slice(0, 10)
          const results = await Promise.allSettled(
            targetPatients.map((p) => medicalRecordApi.getByPatient(p.id))
          )
          results.forEach((res, idx) => {
            if (res.status === 'fulfilled' && Array.isArray(res.value?.data)) {
              const pInfo = targetPatients[idx]
              res.value.data.forEach((item) => {
                const norm = normalizeMedicalRecordDetail(item)
                if (norm) {
                  if (!norm.patientName && pInfo) norm.patientName = pInfo.fullName
                  if (!norm.patientCode && pInfo) norm.patientCode = pInfo.patientCode
                  combined.push(norm)
                }
              })
            }
          })
        }

        setRecords(combined)
      }
    } catch {
      setRecords([])
    } finally {
      setLoading(false)
    }
  }, [effectivePatientId, patients])

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
      width: 180,
      ellipsis: { showTitle: true },
      render: (text) => <Text strong style={{ color: '#0f172a' }}>{text || '---'}</Text>,
    },
    {
      title: 'Bác sĩ',
      dataIndex: 'doctorName',
      key: 'doctorName',
      width: 180,
      ellipsis: { showTitle: true },
      render: (text) => text || '---',
    },
    {
      title: 'Chẩn đoán',
      dataIndex: 'diagnosis',
      key: 'diagnosis',
      width: 260,
      ellipsis: { showTitle: true },
      render: (text) => (
        <Tooltip title={text} placement="topLeft">
          <span>{text || '---'}</span>
        </Tooltip>
      ),
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
      width: 80,
      align: 'center',
      fixed: 'right',
      render: (_, record) => {
        const recordId = record.id || record.medicalRecordId
        const isArchived = record.status === 'ARCHIVED'
        const isSigned = isMedicalRecordSigned(record.status)
        const isBusy = actionLoadingId === recordId || singleExportingId === recordId

        const menuItems = [
          {
            key: 'view',
            icon: <EyeOutlined style={{ color: '#2563eb' }} />,
            label: 'Xem chi tiết',
            disabled: !record.visitId || isBusy,
            onClick: () => navigate(`/medical-records/visits/${record.visitId}`),
          },
        ]

        if (canExport && canExportRecord(record)) {
          menuItems.push({
            key: 'export',
            icon: <DownloadOutlined style={{ color: '#059669' }} />,
            label: <span style={{ color: '#059669', fontWeight: 500 }}>Xuất hồ sơ trao đổi DL</span>,
            disabled: isBusy,
            onClick: () => handleExportSingle(record),
          })
        }

        if (canViewVersionHistory || isSigned) {
          menuItems.push({
            key: 'version',
            icon: <HistoryOutlined style={{ color: '#4f46e5' }} />,
            label: 'Lịch sử phiên bản',
            disabled: isBusy,
            onClick: () => {
              setSelectedRecordForVersion(recordId)
              setVersionModalOpen(true)
            },
          })
        }

        if (canArchiveRecord && !isArchived) {
          menuItems.push({
            key: 'archive',
            icon: <InboxOutlined style={{ color: '#7c3aed' }} />,
            label: 'Lưu trữ hồ sơ',
            disabled: isBusy,
            onClick: () => {
              Modal.confirm({
                title: 'Lưu trữ hồ sơ bệnh án?',
                content: 'Hồ sơ sẽ được đóng băng và chuyển sang trạng thái Lưu trữ (Archived).',
                okText: 'Lưu trữ',
                cancelText: 'Hủy',
                onOk: () => handleArchive(record),
              })
            },
          })
        }

        if (canDeleteRecord && !isArchived) {
          menuItems.push({ type: 'divider' })
          menuItems.push({
            key: 'delete',
            danger: true,
            icon: <DeleteOutlined />,
            label: 'Xóa hồ sơ',
            disabled: isBusy,
            onClick: () => {
              Modal.confirm({
                title: 'Xóa hồ sơ bệnh án?',
                content: 'Bạn có chắc chắn muốn xóa hồ sơ này? (Lưu ý: Chỉ hồ sơ ngoài thời hạn lưu trữ mới xóa được).',
                okText: 'Xóa',
                okType: 'danger',
                cancelText: 'Hủy',
                onOk: () => handleDelete(record),
              })
            },
          })
        }

        return (
          <Dropdown
            menu={{ items: menuItems }}
            trigger={['click']}
            placement="bottomRight"
          >
            <Button
              type="text"
              size="small"
              icon={<MoreOutlined style={{ fontSize: 18, color: '#475569' }} />}
              loading={singleExportingId === recordId}
              disabled={isBusy}
              title="Thao tác"
              style={{
                width: 32,
                height: 32,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 6,
              }}
            />
          </Dropdown>
        )
      },
    },
  ]

  const handleExportSingle = async (record) => {
    const recordId = record.id || record.medicalRecordId
    if (!recordId) return
    if (!canExportRecord(record)) {
      message.warning('Chỉ xuất được hồ sơ đã ký theo quy định QTN-41.')
      return
    }
    setSingleExportingId(recordId)
    try {
      const response = await medicalRecordExportApi.exportSingle(recordId)
      const patientCode = record.patientCode || 'BN'
      const visitCode = record.visitCode || (record.visitId ? `VS-${String(record.visitId).substring(0, 8)}` : 'VS')
      const fallbackName = `emr-exchange-${patientCode}-${visitCode}.json`
      const downloadedName = downloadBlobFile(response.data, fallbackName, response.headers)
      message.success(`Đã xuất hồ sơ bệnh án thành công [${downloadedName}].`)
    } catch (err) {
      const parsed = await extractBlobErrorMessage(err)
      const friendly = mapExportErrorMessage(parsed || err, record)
      message.error(friendly)
    } finally {
      setSingleExportingId(null)
    }
  }

  const rowSelection = canExport
    ? {
        selectedRowKeys,
        onChange: (keys, rows) => {
          setSelectedRowKeys(keys)
          setSelectedRecords(rows)
        },
        getCheckboxProps: (record) => {
          const exportable = canExportRecord(record)
          return {
            disabled: !exportable,
            name: record.recordCode || record.id,
            title: !exportable ? 'Chỉ xuất được hồ sơ đã ký' : 'Chọn để xuất hồ sơ theo cấu trúc chuẩn',
          }
        },
        renderCell: (checked, record, index, originNode) => {
          if (!canExportRecord(record)) {
            return (
              <Tooltip title="Chỉ xuất được hồ sơ đã ký">
                <span>{originNode}</span>
              </Tooltip>
            )
          }
          return (
            <Tooltip title="Chọn để xuất">
              <span>{originNode}</span>
            </Tooltip>
          )
        },
      }
    : undefined

  return (
    <div>
      <div className="page-header" style={{ marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>
          {patientId ? 'Lịch sử bệnh án theo bệnh nhân' : 'Xuất hồ sơ bệnh án theo cấu trúc trao đổi dữ liệu'}
        </Title>
      </div>

      {!patientId && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message="Xuất hồ sơ bệnh án theo cấu trúc trao đổi dữ liệu y tế"
          description="Chỉ các hồ sơ đã ký số và chẩn đoán đã gắn mã bệnh mới đủ điều kiện xuất. Bạn có thể chọn từng hồ sơ đơn lẻ hoặc chọn nhiều hồ sơ (tối đa 100 hồ sơ) để xuất tệp trao đổi dữ liệu chuẩn."
        />
      )}

      {!patientId && (
        <Card size="small" style={{ marginBottom: 16 }}>
          <Space wrap align="center" style={{ width: '100%', justifyContent: 'space-between' }}>
            <Space align="center" wrap>
              <Text strong>Nguồn dữ liệu:</Text>
              <Select
                showSearch
                placeholder="Chọn bệnh nhân hoặc xem tất cả hồ sơ..."
                style={{ width: 420 }}
                loading={patientLoading}
                value={searchPatientId}
                onChange={(val) => {
                  setSearchPatientId(val)
                  setSelectedRowKeys([])
                  setSelectedRecords([])
                }}
                filterOption={(input, option) =>
                  (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                }
                options={[
                  {
                    value: 'ALL',
                    label: 'Tất cả hồ sơ sẵn sàng xuất (Tổng hợp)',
                  },
                  ...patients.map((p) => ({
                    value: p.id,
                    label: `${p.patientCode || ''} - ${p.fullName || ''} (${p.phone || 'Chưa có SĐT'})`,
                  })),
                ]}
              />
            </Space>
            <Button
              icon={<ReloadOutlined />}
              onClick={() => {
                fetchRecords()
              }}
              loading={loading}
            >
              Làm mới
            </Button>
          </Space>
        </Card>
      )}

      {canExport && selectedRowKeys.length > 0 && (
        <div
          style={{
            marginBottom: 16,
            padding: '12px 16px',
            background: '#eef2ff',
            border: '1px solid #c7d2fe',
            borderRadius: 8,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <Space>
            <Text strong style={{ color: '#3730a3' }}>
              Đã chọn {selectedRowKeys.length} hồ sơ
            </Text>
            {selectedRowKeys.length > 100 && (
              <Tag color="error">Vui lòng chọn tối đa 100 hồ sơ</Tag>
            )}
          </Space>
          <Space>
            <Button
              size="small"
              onClick={() => {
                setSelectedRowKeys([])
                setSelectedRecords([])
              }}
            >
              Bỏ chọn
            </Button>
            <Tooltip
              title={
                selectedRowKeys.length > 100
                  ? 'Vui lòng chọn tối đa 100 hồ sơ mỗi lần xuất'
                  : ''
              }
            >
              <Button
                type="primary"
                icon={<DownloadOutlined />}
                disabled={selectedRowKeys.length === 0 || selectedRowKeys.length > 100}
                onClick={() => setBatchExportModalOpen(true)}
                style={{ background: '#4f46e5', borderColor: '#4f46e5' }}
              >
                Xuất theo cấu trúc chuẩn
              </Button>
            </Tooltip>
          </Space>
        </div>
      )}

      <Table
        rowSelection={rowSelection}
        columns={columns}
        dataSource={records}
        rowKey="id"
        loading={loading}
        scroll={{ x: 1100 }}
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

      {batchExportModalOpen && (
        <ExportMedicalRecordModal
          open={batchExportModalOpen}
          onClose={() => setBatchExportModalOpen(false)}
          records={selectedRecords}
          onSuccess={() => {
            setSelectedRowKeys([])
            setSelectedRecords([])
          }}
        />
      )}
    </div>
  )
}

export default MedicalRecordList
