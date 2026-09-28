import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Card,
  Table,
  Button,
  InputNumber,
  Input,
  Switch,
  Tag,
  Tooltip,
  Modal,
  Alert,
  Avatar,
  Space,
  Badge,
  Typography,
  message,
} from 'antd'
import {
  SafetyCertificateOutlined,
  ReloadOutlined,
  SearchOutlined,
  StopOutlined,
  DesktopOutlined,
  MobileOutlined,
  ClockCircleOutlined,
  SettingOutlined,
  UserOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons'
import { useAuthContext } from '../context/AuthContext.jsx'
import sessionApi from '../api/sessionApi.js'
import {
  formatRelativeTime,
  formatDateTimeVi,
  parseUserAgent,
  getRoleBadgeConfig,
  validateIdleTimeout,
  DEFAULT_IDLE_TIMEOUT_MINUTES,
  SESSION_IDLE_CONFIG_KEY,
} from '../utils/sessionManagementHelpers.js'
import './sessionManagement.css'

const { Title, Text, Paragraph } = Typography

export default function SessionManagementPage() {
  const { user } = useAuthContext()

  // Verify permission
  const isAdmin = useMemo(() => {
    const roles = (user?.roles || []).map((r) => String(r).toLowerCase().replace(/^role_/, ''))
    const permissions = user?.permissions || []
    return (
      roles.includes('admin') ||
      permissions.includes('SESSION_READ') ||
      permissions.includes('SESSION_TERMINATE')
    )
  }, [user])

  // Config state
  const [idleTimeoutMinutes, setIdleTimeoutMinutes] = useState(DEFAULT_IDLE_TIMEOUT_MINUTES)
  const [configLoading, setConfigLoading] = useState(false)
  const [savingConfig, setSavingConfig] = useState(false)

  // Sessions state
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [searchKeyword, setSearchKeyword] = useState('')
  const [lastRefreshedAt, setLastRefreshedAt] = useState(new Date())

  // Terminate Modal State
  const [terminatingSession, setTerminatingSession] = useState(null)
  const [terminateLoading, setTerminateLoading] = useState(false)

  // 1. Fetch clinic config
  const fetchConfig = useCallback(async () => {
    setConfigLoading(true)
    try {
      const res = await sessionApi.getClinicConfiguration()
      const minutes = res.data?.sessionIdleTimeoutMinutes
      if (minutes && !isNaN(Number(minutes))) {
        setIdleTimeoutMinutes(Number(minutes))
        localStorage.setItem(SESSION_IDLE_CONFIG_KEY, String(minutes))
      }
    } catch (err) {
      console.warn('Could not load clinic config:', err)
    } finally {
      setConfigLoading(false)
    }
  }, [])

  // 2. Fetch active sessions list
  const fetchSessions = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true)
    try {
      const res = await sessionApi.getActiveSessions({ page: 0, size: 100 })
      const data = res.data?.content || (Array.isArray(res.data) ? res.data : [])
      setSessions(data)
      setLastRefreshedAt(new Date())
    } catch (err) {
      if (!isSilent) {
        message.error('Không thể tải danh sách phiên làm việc. Vui lòng thử lại.')
      }
    } finally {
      if (!isSilent) setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isAdmin) {
      fetchConfig()
      fetchSessions()
    }
  }, [isAdmin, fetchConfig, fetchSessions])

  // Auto-refresh interval (every 30 seconds)
  useEffect(() => {
    if (!isAdmin || !autoRefresh) return undefined

    const interval = setInterval(() => {
      fetchSessions(true)
    }, 30000)

    return () => clearInterval(interval)
  }, [isAdmin, autoRefresh, fetchSessions])

  // Save Idle Timeout Configuration
  const handleSaveConfig = async () => {
    const valResult = validateIdleTimeout(idleTimeoutMinutes)
    if (!valResult.valid) {
      message.error(valResult.error)
      return
    }

    setSavingConfig(true)
    try {
      await sessionApi.updateSessionIdleTimeout(idleTimeoutMinutes)
      localStorage.setItem(SESSION_IDLE_CONFIG_KEY, String(idleTimeoutMinutes))

      // Emit event for local warning modal to update immediately
      window.dispatchEvent(
        new CustomEvent('clinic-config:updated', {
          detail: { sessionIdleTimeoutMinutes: idleTimeoutMinutes },
        })
      )

      message.success(
        `Đã lưu cấu hình! Hệ thống sẽ tự động đăng xuất máy trạm sau ${idleTimeoutMinutes} phút không thao tác.`
      )
    } catch (err) {
      const msg = err.response?.data?.message || 'Không thể lưu cấu hình. Vui lòng thử lại.'
      message.error(msg)
    } finally {
      setSavingConfig(false)
    }
  }

  // Handle Terminate Session Confirmation
  const handleConfirmTerminate = async () => {
    if (!terminatingSession) return
    setTerminateLoading(true)
    try {
      await sessionApi.terminateSession(terminatingSession.sessionId)
      message.success(
        `Đã kết thúc phiên làm việc của người dùng ${terminatingSession.fullName || terminatingSession.username} thành công.`
      )
      setTerminatingSession(null)
      fetchSessions()
    } catch (err) {
      const msg = err.response?.data?.message || 'Không thể kết thúc phiên làm việc. Vui lòng thử lại.'
      message.error(msg)
    } finally {
      setTerminateLoading(false)
    }
  }

  // Filter sessions by keyword
  const filteredSessions = useMemo(() => {
    if (!searchKeyword.trim()) return sessions
    const kw = searchKeyword.toLowerCase().trim()
    return sessions.filter((s) => {
      const username = (s.username || '').toLowerCase()
      const fullName = (s.fullName || '').toLowerCase()
      const roleName = (s.roleName || '').toLowerCase()
      const ip = (s.ipAddress || '').toLowerCase()
      return username.includes(kw) || fullName.includes(kw) || roleName.includes(kw) || ip.includes(kw)
    })
  }, [sessions, searchKeyword])

  const otherSessionsCount = useMemo(() => {
    return sessions.filter((s) => !s.isCurrentSession).length
  }, [sessions])

  // Deny access if not admin
  if (!isAdmin) {
    return (
      <div className="bsa-session-page">
        <Alert
          type="error"
          showIcon
          message="Từ chối truy cập"
          description="Chức năng Quản lý phiên làm việc chỉ dành riêng cho Quản trị viên (ADMIN). Hành vi truy cập trái phép đã được ghi nhận vào nhật ký an ninh hệ thống."
          style={{ maxWidth: 640, margin: '40px auto', borderRadius: 12 }}
        />
      </div>
    )
  }

  const columns = [
    {
      title: 'Người dùng',
      key: 'user',
      render: (_, record) => {
        const roleConfig = getRoleBadgeConfig(record.roleName)
        return (
          <div className="bsa-session-user-cell">
            <Avatar
              icon={<UserOutlined />}
              style={{
                backgroundColor: roleConfig.bg,
                color: roleConfig.color,
                border: `1px solid ${roleConfig.border}`,
              }}
            >
              {(record.fullName || record.username || 'U').charAt(0).toUpperCase()}
            </Avatar>
            <div className="bsa-session-user-info">
              <span className="bsa-session-user-name">
                {record.fullName || record.username}
              </span>
              <span className="bsa-session-username">@{record.username}</span>
            </div>
          </div>
        )
      },
    },
    {
      title: 'Vai trò',
      dataIndex: 'roleName',
      key: 'roleName',
      render: (roleName) => {
        const config = getRoleBadgeConfig(roleName)
        return (
          <Tag
            style={{
              color: config.color,
              backgroundColor: config.bg,
              borderColor: config.border,
              borderRadius: 6,
              fontWeight: 600,
              padding: '2px 8px',
            }}
          >
            {config.label}
          </Tag>
        )
      },
    },
    {
      title: 'Thiết bị & Máy trạm',
      key: 'device',
      render: (_, record) => {
        const uaInfo = parseUserAgent(record.userAgent)
        const isLocal = record.ipAddress === '127.0.0.1' || record.ipAddress === '0:0:0:0:0:0:0:1'
        return (
          <div className="bsa-session-device-cell">
            <span className="bsa-session-ip">
              {record.ipAddress || '—'} {isLocal && <Text type="secondary">(Nội bộ)</Text>}
            </span>
            <span className="bsa-session-device-name">
              {uaInfo.deviceType === 'mobile' ? <MobileOutlined /> : <DesktopOutlined />}
              {uaInfo.label}
            </span>
          </div>
        )
      },
    },
    {
      title: 'Đăng nhập lúc',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (createdAt) => (
        <span style={{ fontSize: 13, color: '#334155' }}>
          {formatDateTimeVi(createdAt)}
        </span>
      ),
    },
    {
      title: 'Hoạt động gần nhất',
      dataIndex: 'lastUsedAt',
      key: 'lastUsedAt',
      render: (lastUsedAt) => (
        <Tooltip title={`Thời điểm: ${formatDateTimeVi(lastUsedAt)}`}>
          <Space orientation="horizontal" size={6}>
            <div className="bsa-session-active-pulse" />
            <span style={{ fontWeight: 500, color: '#0F172A', fontSize: 13 }}>
              {formatRelativeTime(lastUsedAt)}
            </span>
          </Space>
        </Tooltip>
      ),
    },
    {
      title: 'Trạng thái',
      key: 'status',
      render: (_, record) => {
        if (record.isCurrentSession) {
          return (
            <span className="bsa-session-badge-current">
              <CheckCircleOutlined /> Phiên của bạn
            </span>
          )
        }
        return (
          <Badge status="processing" text={<span style={{ color: '#059669', fontWeight: 500 }}>Đang mở</span>} />
        )
      },
    },
    {
      title: 'Thao tác',
      key: 'action',
      align: 'right',
      render: (_, record) => {
        if (record.isCurrentSession) {
          return (
            <Tooltip title="Đây là phiên bạn đang dùng. Không thể kết thúc phiên của chính mình tại đây.">
              <Button size="small" disabled icon={<StopOutlined />}>
                Kết thúc phiên
              </Button>
            </Tooltip>
          )
        }

        return (
          <Button
            danger
            size="small"
            icon={<StopOutlined />}
            onClick={() => setTerminatingSession(record)}
            id={`btn-terminate-${record.sessionId}`}
          >
            Kết thúc phiên
          </Button>
        )
      },
    },
  ]

  return (
    <div className="bsa-session-page">
      {/* Page Header */}
      <div className="bsa-session-header">
        <div className="bsa-session-header-title">
          <div className="bsa-session-header-icon">
            <SafetyCertificateOutlined />
          </div>
          <div>
            <h2>Quản lý phiên làm việc & Tự động đăng xuất</h2>
            <p>
              Giám sát máy trạm, cấu hình thời gian chờ không thao tác và ngắt phiên từ xa nhằm bảo vệ dữ liệu bệnh án.
            </p>
          </div>
        </div>

        <Space>
          <Button
            icon={<ReloadOutlined spin={loading} />}
            onClick={() => fetchSessions()}
            disabled={loading}
          >
            Làm mới danh sách
          </Button>
        </Space>
      </div>

      {/* Configuration Card */}
      <div className="bsa-session-config-card">
        <div className="bsa-session-config-header">
          <div className="bsa-session-config-title">
            <SettingOutlined /> Cấu hình thời gian chờ không thao tác (Session Idle Timeout)
          </div>
          <span style={{ fontSize: 12.5, color: '#64748B' }}>
            Áp dụng cho tất cả tài khoản đăng nhập trên hệ thống
          </span>
        </div>

        <div className="bsa-session-config-body">
          <div className="bsa-session-config-grid">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontWeight: 500, color: '#334155', fontSize: 13.5 }}>
                Thời gian không thao tác trước khi tự đăng xuất:
              </span>
              <InputNumber
                min={5}
                max={1440}
                step={5}
                value={idleTimeoutMinutes}
                onChange={(val) => setIdleTimeoutMinutes(val || DEFAULT_IDLE_TIMEOUT_MINUTES)}
                addonAfter="phút"
                style={{ width: 140 }}
                disabled={configLoading || savingConfig}
                id="input-idle-timeout"
              />
            </div>

            <Button
              type="primary"
              loading={savingConfig}
              onClick={handleSaveConfig}
              id="btn-save-idle-timeout"
            >
              Lưu cấu hình
            </Button>
          </div>

          {/* Quick presets */}
          <div className="bsa-session-quick-presets">
            <span style={{ fontSize: 12.5, color: '#64748B' }}>Gợi ý nhanh:</span>
            {[15, 30, 60, 120].map((mins) => (
              <button
                key={mins}
                type="button"
                className={`bsa-session-preset-btn ${idleTimeoutMinutes === mins ? 'is-active' : ''}`}
                onClick={() => setIdleTimeoutMinutes(mins)}
              >
                {mins} phút {mins === 30 ? '(Khuyến nghị)' : ''}
              </button>
            ))}
          </div>

          <div className="bsa-session-hint-text">
            <InfoCircleOutlined />
            <span>
              Trước khi hết thời gian {idleTimeoutMinutes} phút đúng 60 giây, máy trạm sẽ hiển thị hộp thoại cảnh báo đếm ngược kèm nút <b>"Tiếp tục làm việc"</b>. Nếu không có phản hồi, máy trạm sẽ tự động đăng xuất để bảo mật.
            </span>
          </div>
        </div>
      </div>

      {/* Active Sessions Card */}
      <div className="bsa-session-table-card">
        <div className="bsa-session-toolbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Input
              className="bsa-session-search-box"
              placeholder="Tìm theo tên, tài khoản, vai trò, IP..."
              prefix={<SearchOutlined style={{ color: '#94A3B8' }} />}
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              allowClear
              id="input-search-sessions"
            />
            <Tag color="blue" style={{ borderRadius: 999, padding: '2px 10px', fontWeight: 600 }}>
              Tổng cộng: {sessions.length} phiên đang mở
            </Tag>
          </div>

          <div className="bsa-session-actions-group">
            <Space align="center" size={8}>
              <span style={{ fontSize: 13, color: '#475569' }}>Tự động làm mới (30s):</span>
              <Switch
                size="small"
                checked={autoRefresh}
                onChange={setAutoRefresh}
                id="switch-auto-refresh"
              />
            </Space>
            <span style={{ fontSize: 12, color: '#94A3B8' }}>
              Cập nhật: {lastRefreshedAt.toLocaleTimeString('vi-VN')}
            </span>
          </div>
        </div>

        {/* Empty State when no other sessions */}
        {sessions.length === 1 && sessions[0].isCurrentSession && !searchKeyword ? (
          <div>
            <Table
              dataSource={filteredSessions}
              columns={columns}
              rowKey="sessionId"
              pagination={false}
              loading={loading}
            />
            <div className="bsa-session-empty-card" style={{ borderTop: '1px solid #F1F5F9' }}>
              <div className="bsa-session-empty-icon">
                <CheckCircleOutlined style={{ color: '#10B981' }} />
              </div>
              <div className="bsa-session-empty-title">
                Không có phiên nào khác đang mở
              </div>
              <p className="bsa-session-empty-sub">
                Hiện tại chỉ có duy nhất phiên làm việc của bạn đang hoạt động trên hệ thống. Tất cả các máy trạm khác đều đã đăng xuất an toàn.
              </p>
            </div>
          </div>
        ) : sessions.length === 0 && !loading ? (
          <div className="bsa-session-empty-card">
            <div className="bsa-session-empty-icon">
              <DesktopOutlined />
            </div>
            <div className="bsa-session-empty-title">
              Không có phiên làm việc nào đang mở
            </div>
            <p className="bsa-session-empty-sub">
              Hiện tại không ghi nhận phiên làm việc nào đang hoạt động trên hệ thống.
            </p>
          </div>
        ) : (
          <Table
            dataSource={filteredSessions}
            columns={columns}
            rowKey="sessionId"
            loading={loading}
            pagination={{
              pageSize: 10,
              showTotal: (total) => `Tổng số ${total} phiên`,
            }}
          />
        )}
      </div>

      {/* Confirmation Modal for Terminate Session */}
      <Modal
        title={
          <Space>
            <ExclamationCircleOutlined style={{ color: '#DC2626', fontSize: 20 }} />
            <span>Xác nhận kết thúc phiên làm việc từ xa</span>
          </Space>
        }
        open={Boolean(terminatingSession)}
        onCancel={() => setTerminatingSession(null)}
        footer={[
          <Button key="cancel" onClick={() => setTerminatingSession(null)}>
            Hủy bỏ
          </Button>,
          <Button
            key="confirm"
            danger
            type="primary"
            loading={terminateLoading}
            onClick={handleConfirmTerminate}
            id="btn-confirm-terminate-session"
          >
            Kết thúc ngay
          </Button>,
        ]}
      >
        {terminatingSession && (
          <div style={{ marginTop: 16 }}>
            <Paragraph>
              Bạn có chắc chắn muốn kết thúc phiên làm việc của người dùng{' '}
              <Text strong>
                {terminatingSession.fullName || terminatingSession.username} (@{terminatingSession.username})
              </Text>
              ?
            </Paragraph>
            <Alert
              type="warning"
              showIcon
              message="Hệ quả hành động"
              description="Người dùng này sẽ bị ngắt kết nối và đăng xuất ngay lập tức ở phía máy trạm của họ. Mọi thao tác chưa lưu có thể bị gián đoạn."
              style={{ borderRadius: 8 }}
            />
          </div>
        )}
      </Modal>
    </div>
  )
}
