import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Empty,
  Form,
  Input,
  message,
  Modal,
  Row,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd'
import {
  CloudDownloadOutlined,
  CloudUploadOutlined,
  ClockCircleOutlined,
  DatabaseOutlined,
  DownloadOutlined,
  ExclamationCircleOutlined,
  EyeOutlined,
  LockOutlined,
  PlusOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  SyncOutlined,
} from '@ant-design/icons'
import backupApi from '../api/backupApi'
import { useAuthContext } from '../context/AuthContext'

const { Title, Text, Paragraph } = Typography

const formatDateTime = (val) => {
  if (!val) return '—'
  const date = new Date(val)
  if (isNaN(date.getTime())) return '—'
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const seconds = String(date.getSeconds()).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const year = date.getFullYear()
  return `${hours}:${minutes}:${seconds} ${day}/${month}/${year}`
}

const formatFileSize = (bytes) => {
  if (bytes === null || bytes === undefined || isNaN(bytes) || bytes < 0) return '—'
  if (bytes === 0) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

function BackupRestorePage() {
  const { user } = useAuthContext()

  const userPermissions = useMemo(() => {
    return (user?.permissions || []).map((p) => String(p || '').toUpperCase().replace(/^PERMISSION_/, ''))
  }, [user])

  const canReadBackup = userPermissions.includes('BACKUP_READ')
  const canCreateBackup = userPermissions.includes('BACKUP_CREATE')
  const canRestoreBackup = userPermissions.includes('BACKUP_RESTORE')

  const [backups, setBackups] = useState(null)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [creating, setCreating] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [downloadingId, setDownloadingId] = useState(null)
  const [apiError, setApiError] = useState('')
  const [isBackendAvailable, setIsBackendAvailable] = useState(true)

  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [backupType, setBackupType] = useState('FULL')
  const [backupNote, setBackupNote] = useState('')
  const [restoreTargetBackup, setRestoreTargetBackup] = useState(null)
  const [detailModalBackup, setDetailModalBackup] = useState(null)

  const loadBackups = useCallback(async () => {
    setLoading(true)
    setApiError('')
    setLoadError(false)
    try {
      const res = await backupApi.getAll()
      const data = res?.data
      const list = Array.isArray(data) ? data : Array.isArray(data?.content) ? data.content : []
      setBackups(list)
      setIsBackendAvailable(true)
      setLoadError(false)
      setApiError('')
    } catch (err) {
      console.error('[BackupRestorePage] Lỗi loadBackups:', err?.response?.status, err?.message)
      const status = err?.response?.status
      const msg = err?.response?.data?.message

      if (status === 403) {
        setLoadError(false)
        setBackups([])
        setApiError('')
      } else {
        setLoadError(true)
        setBackups(null)
        if (status === 404) {
          setIsBackendAvailable(false)
          setApiError('Hệ thống Backend hiện tại chưa tìm thấy REST Endpoint /backups (404 Not Found).')
        } else if (status === 409) {
          setApiError('Hệ thống đang thực hiện một tiến trình sao lưu/phục hồi khác (409 Conflict).')
        } else {
          setApiError(msg || 'Không thể tải danh sách bản sao lưu từ hệ thống. Backend phản hồi lỗi xử lý.')
        }
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadBackups()
  }, [loadBackups])

  const handleConfirmCreateBackup = async () => {
    if (!canCreateBackup) {
      message.error('Bạn không có quyền tạo bản sao lưu dữ liệu (Yêu cầu quyền BACKUP_CREATE).')
      return
    }

    setCreating(true)
    setApiError('')
    try {
      const payload = {
        backupType: backupType || 'FULL',
        description: backupNote.trim() || undefined,
      }
      await backupApi.createBackup(payload)

      message.success('Đã tạo bản sao lưu dữ liệu thành công!')
      setCreateModalOpen(false)
      setBackupNote('')

      await loadBackups()
    } catch (err) {
      console.error('[BackupRestorePage] Lỗi createBackup:', err?.response?.status, err?.message)
      const status = err?.response?.status
      const msg = err?.response?.data?.message

      if (status === 403) {
        setApiError('Bạn không có quyền tạo bản sao lưu dữ liệu (403 Forbidden).')
        message.error('Bạn không có quyền tạo bản sao lưu dữ liệu (403 Forbidden).')
      } else if (status === 409) {
        setApiError('Hệ thống đang thực hiện một tiến trình sao lưu/phục hồi khác (409 Conflict).')
        message.error('Hệ thống đang bận thực hiện sao lưu khác (409 Conflict).')
      } else {
        const errorMsg = msg || 'Không thể tạo bản sao lưu. Backend đang gặp lỗi xử lý.'
        setApiError(errorMsg)
        message.error(errorMsg)
      }
    } finally {
      setCreating(false)
    }
  }

  const handleConfirmRestore = async () => {
    if (!restoreTargetBackup || !restoreTargetBackup.id) {
      message.error('Mã bản sao lưu không hợp lệ.')
      return
    }
    if (!canRestoreBackup) {
      message.error('Bạn không có quyền phục hồi dữ liệu (Yêu cầu quyền BACKUP_RESTORE).')
      return
    }

    const backupId = restoreTargetBackup.id
    setRestoring(true)
    setApiError('')

    try {
      await backupApi.restoreBackup(backupId)
      message.success('Phục hồi dữ liệu thành công về thời điểm bản sao lưu!')
      setRestoreTargetBackup(null)

      await loadBackups()
    } catch (err) {
      console.error('[BackupRestorePage] Lỗi restoreBackup:', err?.response?.status, err?.message)
      const status = err?.response?.status
      const msg = err?.response?.data?.message

      if (status === 403) {
        setApiError('Bạn không có quyền phục hồi dữ liệu hệ thống (403 Forbidden).')
        message.error('Bạn không có quyền phục hồi dữ liệu hệ thống (403 Forbidden).')
      } else if (status === 404) {
        setApiError('Không tìm thấy bản sao lưu trên Backend (404 Not Found).')
        message.error('Không tìm thấy bản sao lưu trên Backend (404 Not Found).')
      } else if (status === 409) {
        setApiError('Hệ thống đang bận hoặc bản sao lưu không ở trạng thái sẵn sàng để phục hồi (409 Conflict).')
        message.error('Bản sao lưu không ở trạng thái sẵn sàng để phục hồi (409 Conflict).')
      } else {
        const errorMsg = msg || 'Phục hồi dữ liệu thất bại từ Backend. Vui lòng thử lại.'
        setApiError(errorMsg)
        message.error(errorMsg)
      }
    } finally {
      setRestoring(false)
    }
  }

  const handleDownload = async (record) => {
    if (!record || !record.id) return
    setDownloadingId(record.id)
    try {
      const res = await backupApi.downloadBackup(record.id)
      const blob = new Blob([res.data], { type: res.headers['content-type'] || 'application/octet-stream' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = record.fileName || `backup_${record.backupCode || record.id}.json`
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
      message.success('Đã tải bản sao lưu thành công!')
    } catch (err) {
      console.error('[BackupRestorePage] Lỗi downloadBackup:', err)
      const status = err?.response?.status
      if (status === 403) {
        message.error('Bạn không có quyền tải bản sao lưu.')
      } else {
        message.error('Tải file bản sao lưu thất bại.')
      }
    } finally {
      setDownloadingId(null)
    }
  }

  const latestBackup = useMemo(() => {
    if (loadError || !backups || !Array.isArray(backups) || backups.length === 0) return null
    return [...backups].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))[0]
  }, [backups, loadError])

  const columns = [
    {
      title: 'Mã bản sao',
      dataIndex: 'backupCode',
      key: 'backupCode',
      render: (val, record) => (
        <Space direction="vertical" size={0}>
          <Text strong>{val || '—'}</Text>
          <Text type="secondary" style={{ fontSize: 11 }}>
            ID: {record.id || '—'}
          </Text>
        </Space>
      ),
    },
    {
      title: 'Thời gian tạo',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (val) => formatDateTime(val),
    },
    {
      title: 'Tên file',
      dataIndex: 'fileName',
      key: 'fileName',
      render: (val) => <Text code style={{ fontSize: 12 }}>{val || '—'}</Text>,
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      align: 'center',
      render: (status) => {
        const st = String(status || '').toUpperCase()
        if (st === 'SUCCESS' || st === 'COMPLETED') {
          return <Tag color="green" icon={<SafetyCertificateOutlined />}>Hoàn thành</Tag>
        }
        if (st === 'IN_PROGRESS' || st === 'PROCESSING' || st === 'PENDING') {
          return <Tag color="processing" icon={<SyncOutlined spin />}>Đang xử lý</Tag>
        }
        if (st === 'FAILED' || st === 'ERROR') {
          return <Tag color="error" icon={<ExclamationCircleOutlined />}>Thất bại</Tag>
        }
        return <Tag color="default">{status || '—'}</Tag>
      },
    },
    {
      title: 'Dung lượng',
      dataIndex: 'fileSize',
      key: 'fileSize',
      align: 'right',
      render: (val) => formatFileSize(val),
    },
    {
      title: 'Ghi chú',
      dataIndex: 'description',
      key: 'description',
      render: (val) => val || '—',
    },
    {
      title: 'Thao tác',
      key: 'actions',
      align: 'center',
      render: (_, record) => {
        const isSuccess = String(record.status || '').toUpperCase() === 'SUCCESS' || String(record.status || '').toUpperCase() === 'COMPLETED'
        return (
          <Space size="small">
            <Button
              size="small"
              icon={<EyeOutlined />}
              onClick={() => setDetailModalBackup(record)}
            >
              Chi tiết
            </Button>
            <Button
              size="small"
              icon={<DownloadOutlined />}
              disabled={!canReadBackup || !isSuccess || downloadingId === record.id}
              loading={downloadingId === record.id}
              onClick={() => handleDownload(record)}
            >
              Tải file
            </Button>
            <Button
              size="small"
              type="primary"
              danger
              icon={<CloudDownloadOutlined />}
              disabled={!canRestoreBackup || !isSuccess || restoring || loading}
              onClick={() => setRestoreTargetBackup(record)}
            >
              Phục hồi
            </Button>
          </Space>
        )
      },
    },
  ]

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <Title level={3} style={{ margin: 0, color: '#0f172a' }}>
            <DatabaseOutlined style={{ color: '#2563eb', marginRight: 8 }} />
            SAO LƯU & PHỤC HỒI DỮ LIỆU
          </Title>
        </div>
        <Space wrap>
          <Button icon={<ClockCircleOutlined />} href="/system/scheduled-backup">
            Lịch sao lưu tự động
          </Button>
          <Button icon={<ReloadOutlined />} loading={loading} onClick={loadBackups}>
            Làm mới
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            disabled={!canCreateBackup || loading || creating}
            onClick={() => setCreateModalOpen(true)}
          >
            + Tạo bản sao lưu
          </Button>
        </Space>
      </div>

      {!canReadBackup && (
        <Alert
          type="error"
          showIcon
          icon={<LockOutlined />}
          message="Bạn không có quyền thực hiện sao lưu hoặc phục hồi dữ liệu."
          description="Chức năng quản trị an toàn dữ liệu yêu cầu quyền BACKUP_READ, BACKUP_CREATE hoặc BACKUP_RESTORE."
          style={{ marginBottom: 20 }}
        />
      )}

      {loadError && (
        <Alert
          type="error"
          showIcon
          message="Không thể tải danh sách bản sao lưu từ hệ thống."
          description={apiError || 'Máy chủ Backend phản hồi lỗi xử lý nội bộ (Internal Server Error).'}
          action={
            <Button size="small" type="primary" danger onClick={loadBackups}>
              Thử kết nối lại
            </Button>
          }
          style={{ marginBottom: 20 }}
        />
      )}

      {!loadError && apiError && (
        <Alert
          type={isBackendAvailable ? 'warning' : 'info'}
          showIcon
          message="Thông báo từ Backend REST API"
          description={apiError}
          action={<Button size="small" onClick={loadBackups}>Thử kết nối lại</Button>}
          style={{ marginBottom: 20 }}
        />
      )}

      <Row gutter={16} style={{ marginBottom: 20 }}>
        <Col span={8}>
          <Card size="small" style={{ background: '#f8fafc', borderColor: '#e2e8f0' }}>
            <Text type="secondary" style={{ fontSize: 12 }}>Tổng số bản sao lưu</Text>
            <div style={{ fontSize: 24, fontWeight: 700, color: loadError || backups === null ? '#94a3b8' : '#1e293b' }}>
              {loadError || backups === null ? '—' : `${backups.length} bản`}
            </div>
          </Card>
        </Col>
        <Col span={8}>
          <Card size="small" style={{ background: '#f8fafc', borderColor: '#e2e8f0' }}>
            <Text type="secondary" style={{ fontSize: 12 }}>Bản sao gần nhất</Text>
            <div style={{ fontSize: 14, fontWeight: 600, color: loadError || backups === null ? '#94a3b8' : '#2563eb' }}>
              {loadError || backups === null ? '—' : latestBackup ? formatDateTime(latestBackup.createdAt) : '— Chưa có'}
            </div>
          </Card>
        </Col>
        <Col span={8}>
          <Card size="small" style={{ background: '#f8fafc', borderColor: '#e2e8f0' }}>
            <Text type="secondary" style={{ fontSize: 12 }}>Trạng thái gần nhất</Text>
            <div>
              {loadError ? (
                <Text type="secondary">Không thể tải dữ liệu</Text>
              ) : backups === null || !latestBackup ? (
                <Text type="secondary">—</Text>
              ) : (
                <Tag color={String(latestBackup.status).toUpperCase() === 'SUCCESS' ? 'green' : 'red'} icon={<SafetyCertificateOutlined />}>
                  {String(latestBackup.status).toUpperCase() === 'SUCCESS' ? 'Hoàn thành' : (latestBackup.status || '—')}
                </Tag>
              )}
            </div>
          </Card>
        </Col>
      </Row>

      <Card title="Danh sách bản sao lưu hệ thống" styles={{ body: { padding: 0 } }}>
        <Table
          rowKey={(r) => r.id || r.backupCode || Math.random()}
          columns={columns}
          dataSource={loadError || backups === null ? [] : backups}
          loading={loading}
          pagination={{ pageSize: 10 }}
          locale={{
            emptyText: loadError ? (
              <div style={{ padding: 32, textAlign: 'center' }}>
                <ExclamationCircleOutlined style={{ fontSize: 32, color: '#ff4d4f', marginBottom: 12 }} />
                <div style={{ color: '#cf1322', fontWeight: 600, fontSize: 15, marginBottom: 4 }}>
                  Không thể tải danh sách bản sao lưu từ hệ thống.
                </div>
                <Text type="secondary" style={{ fontSize: 13, display: 'block', marginBottom: 16 }}>
                  Máy chủ Backend phản hồi lỗi xử lý nội bộ. Vui lòng kiểm tra lại kết nối.
                </Text>
                <Button type="primary" icon={<ReloadOutlined />} onClick={loadBackups}>
                  Thử kết nối lại
                </Button>
              </div>
            ) : (
              <Empty
                description={
                  !isBackendAvailable
                    ? 'Backend chưa kết nối được REST Controller /backups'
                    : 'Chưa có bản sao lưu nào.'
                }
              />
            ),
          }}
        />
      </Card>

      <Modal
        title={
          <Space>
            <CloudUploadOutlined style={{ color: '#2563eb' }} />
            <span>Tạo bản sao lưu dữ liệu?</span>
          </Space>
        }
        open={createModalOpen}
        onCancel={() => setCreateModalOpen(false)}
        footer={[
          <Button key="cancel" onClick={() => setCreateModalOpen(false)}>
            Hủy
          </Button>,
          <Button
            key="submit"
            type="primary"
            loading={creating}
            disabled={!canCreateBackup || creating}
            onClick={handleConfirmCreateBackup}
          >
            Xác nhận sao lưu
          </Button>,
        ]}
      >
        <Paragraph>
          Hệ thống sẽ tiến hành đóng gói và tạo một bản sao lưu toàn bộ dữ liệu CSDL tại thời điểm hiện tại.
        </Paragraph>
        <Form layout="vertical">
          <Form.Item label="Loại bản sao lưu">
            <Select value={backupType} onChange={(v) => setBackupType(v)}>
              <Select.Option value="FULL">FULL (Toàn bộ CSDL vận hành)</Select.Option>
              <Select.Option value="MANUAL">MANUAL (Sao lưu thủ công)</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item label="Ghi chú bản sao lưu (Tùy chọn)">
            <Input.TextArea
              rows={2}
              placeholder="Nhập ghi chú mục đích sao lưu (vd: Sao lưu định kỳ trước khi nâng cấp hệ thống...)"
              value={backupNote}
              onChange={(e) => setBackupNote(e.target.value)}
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={
          <Space>
            <ExclamationCircleOutlined style={{ color: '#dc2626' }} />
            <span style={{ color: '#dc2626', fontWeight: 700 }}>XÁC NHẬN PHỤC HỒI DỮ LIỆU?</span>
          </Space>
        }
        open={!!restoreTargetBackup}
        onCancel={() => setRestoreTargetBackup(null)}
        footer={[
          <Button key="cancel" onClick={() => setRestoreTargetBackup(null)}>
            Hủy
          </Button>,
          <Button
            key="submit"
            type="primary"
            danger
            loading={restoring}
            disabled={!canRestoreBackup || restoring}
            onClick={handleConfirmRestore}
          >
            Phục hồi
          </Button>,
        ]}
      >
        {restoreTargetBackup && (
          <Space direction="vertical" style={{ width: '100%' }}>
            <Alert
              type="warning"
              showIcon
              message="CẢNH BÁO PHỤC HỒI DỮ LIỆU"
              description="Dữ liệu hệ thống sẽ được phục hồi về trạng thái tại thời điểm của bản sao lưu này."
            />
            <Card size="small" style={{ background: '#f8fafc', marginTop: 12 }}>
              <Descriptions size="small" column={1} labelStyle={{ fontWeight: 600, width: 140 }}>
                <Descriptions.Item label="Mã bản sao">
                  <Text code>{restoreTargetBackup.backupCode || restoreTargetBackup.id}</Text>
                </Descriptions.Item>
                <Descriptions.Item label="Tên file">
                  {restoreTargetBackup.fileName || '—'}
                </Descriptions.Item>
                <Descriptions.Item label="Thời gian tạo">
                  {formatDateTime(restoreTargetBackup.createdAt)}
                </Descriptions.Item>
                <Descriptions.Item label="Ghi chú">
                  {restoreTargetBackup.description || 'Không có ghi chú'}
                </Descriptions.Item>
              </Descriptions>
            </Card>
          </Space>
        )}
      </Modal>

      <Modal
        title="Chi tiết bản sao lưu"
        open={!!detailModalBackup}
        onCancel={() => setDetailModalBackup(null)}
        footer={[
          <Button key="close" onClick={() => setDetailModalBackup(null)}>
            Đóng
          </Button>,
        ]}
      >
        {detailModalBackup && (
          <Descriptions column={1} bordered size="small" labelStyle={{ fontWeight: 600, width: 160 }}>
            <Descriptions.Item label="ID bản sao">
              <Text code>{detailModalBackup.id}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="Mã bản sao lưu">
              <Text strong>{detailModalBackup.backupCode || '—'}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="Tên file">
              <Text code>{detailModalBackup.fileName || '—'}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="Loại bản sao">
              {detailModalBackup.backupType || 'FULL'}
            </Descriptions.Item>
            <Descriptions.Item label="Thời gian tạo">
              {formatDateTime(detailModalBackup.createdAt)}
            </Descriptions.Item>
            <Descriptions.Item label="Người khởi tạo">
              {detailModalBackup.createdBy || 'Hệ thống'}
            </Descriptions.Item>
            <Descriptions.Item label="Trạng thái">
              {String(detailModalBackup.status).toUpperCase() === 'SUCCESS' ? (
                <Tag color="green">Hoàn thành</Tag>
              ) : String(detailModalBackup.status).toUpperCase() === 'IN_PROGRESS' ? (
                <Tag color="processing">Đang xử lý</Tag>
              ) : (
                <Tag color="red">Thất bại</Tag>
              )}
            </Descriptions.Item>
            <Descriptions.Item label="Dung lượng file">
              {formatFileSize(detailModalBackup.fileSize)}
            </Descriptions.Item>
            <Descriptions.Item label="Phục hồi lần cuối">
              {detailModalBackup.restoredAt ? formatDateTime(detailModalBackup.restoredAt) : 'Chưa phục hồi'}
            </Descriptions.Item>
            <Descriptions.Item label="Ghi chú">
              {detailModalBackup.description || 'Không có ghi chú'}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </div>
  )
}

export default BackupRestorePage
