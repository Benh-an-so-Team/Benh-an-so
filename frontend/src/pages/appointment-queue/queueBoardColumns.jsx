import React from 'react'
import { Avatar, Badge, Button, Dropdown, Space, Tag, Tooltip, Typography } from 'antd'
import {
  AlertOutlined,
  CloseCircleOutlined,
  EyeOutlined,
  HistoryOutlined,
  MoreOutlined,
  ReloadOutlined,
  StarOutlined,
  StepForwardOutlined,
  StopOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { getAvatarStyle, getInitials } from '../../utils/appointmentQueueUiHelpers'
import { QUEUE_STATUS_META } from '../../utils/queueHelpers'
import { canUserCloseVisit } from '../../utils/closeVisitHelpers'
import { canPrioritize, getPriorityTag } from '../../utils/queuePriorityHelpers.js'

const { Text } = Typography

export const getQueueBoardColumns = ({
  getPatientInfo,
  getDoctorInfo,
  permissions = {},
  user,
  reQueuingId,
  onOpenDetail,
  onCallNext,
  onUpdateStatus,
  onSkip,
  onReQueue,
  onOpenHistory,
  onCloseVisit,
  onPrioritize,
}) => [
  {
    title: 'STT',
    dataIndex: 'queueNumber',
    key: 'queueNumber',
    width: 70,
    render: (num, _, idx) => <Badge count={num || idx + 1} style={{ backgroundColor: '#2563eb' }} />,
  },
  {
    title: 'Bệnh nhân',
    dataIndex: 'patientName',
    key: 'patientName',
    width: 250,
    render: (_, record) => {
      const pInfo = getPatientInfo(record.patientId, record.patientName, record.patientCode, record.phone)
      const callCount = Number(record.callCount) || 0
      const priorityTag = getPriorityTag(record.priority)

      return (
        <Space align="center" size="small">
          <Avatar style={getAvatarStyle(pInfo.name)}>{getInitials(pInfo.name)}</Avatar>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 150 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <Text strong style={{ fontSize: 14, color: '#0f172a', lineHeight: '1.4' }}>
                {pInfo.name}
              </Text>
              {priorityTag && (
                <Tooltip title={record.priorityReason ? `Lý do: ${record.priorityReason}` : priorityTag.label}>
                  <Tag
                    color={priorityTag.color}
                    style={{
                      margin: 0,
                      fontWeight: 700,
                      fontSize: 11,
                      padding: '1px 6px',
                      borderRadius: 4,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      backgroundColor: priorityTag.bgColor,
                      borderColor: priorityTag.borderColor,
                      color: priorityTag.textColor,
                    }}
                  >
                    {priorityTag.isEmergency ? (
                      <AlertOutlined style={{ fontSize: 12 }} />
                    ) : (
                      <StarOutlined style={{ fontSize: 12 }} />
                    )}
                    {priorityTag.label}
                  </Tag>
                </Tooltip>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <Text type="secondary" style={{ fontSize: 12, lineHeight: '1.2' }}>
                Mã: {pInfo.code}
              </Text>
              {callCount > 0 && (
                <Tag color="orange" style={{ margin: 0, fontSize: 10, padding: '0 4px', lineHeight: '16px', borderRadius: 4 }}>
                  Đã gọi: {callCount} lần
                </Tag>
              )}
            </div>
          </div>
        </Space>
      )
    },
  },
  {
    title: 'Mã lượt khám',
    dataIndex: 'visitCode',
    key: 'visitCode',
    width: 150,
    render: (val, record) => {
      const rawCode = val || record.visitId || record.id || 'Chưa có'
      let displayCode = rawCode
      if (displayCode.length > 20) {
        displayCode = `VIS-${String(rawCode).slice(-6).toUpperCase()}`
      }
      return (
        <Text code style={{ whiteSpace: 'nowrap', display: 'inline-block', fontSize: 13 }}>
          {displayCode}
        </Text>
      )
    },
  },
  {
    title: 'Nguồn',
    dataIndex: 'sourceType',
    key: 'sourceType',
    width: 150,
    render: (src) =>
      src === 'WALK_IN' ? (
        <Tag color="orange" style={{ whiteSpace: 'nowrap' }}>
          Bệnh nhân tự đến
        </Tag>
      ) : (
        <Tag color="blue" style={{ whiteSpace: 'nowrap' }}>
          Hẹn trước
        </Tag>
      ),
  },
  {
    title: 'Bác sĩ',
    dataIndex: 'doctorName',
    key: 'doctorName',
    width: 180,
    render: (_, record) => {
      const dInfo = getDoctorInfo(record.doctorId, record.doctorName, record.department)
      return <span style={{ whiteSpace: 'nowrap' }}>{dInfo.name}</span>
    },
  },
  {
    title: 'Phòng',
    dataIndex: 'roomName',
    key: 'roomName',
    width: 140,
    render: (room, record) => (
      <span style={{ whiteSpace: 'nowrap' }}>
        {room || record.roomNumber || record.roomCode || 'Chưa phân phòng'}
      </span>
    ),
  },
  {
    title: 'Trạng thái',
    dataIndex: 'status',
    key: 'status',
    width: 170,
    render: (st, record) => {
      const meta = QUEUE_STATUS_META[st] || { label: 'Không xác định', tone: 'gray' }
      return (
        <Space direction="vertical" size={2}>
          <Tag color={meta.tone} style={{ whiteSpace: 'nowrap' }}>{meta.label}</Tag>
          {st === 'SKIPPED' && record?.skipReason && (
            <Text type="secondary" style={{ fontSize: 11, display: 'block', maxWidth: 150 }} ellipsis={{ tooltip: record.skipReason }}>
              {record.skipReason}
            </Text>
          )}
        </Space>
      )
    },
  },
  {
    title: 'Thời gian đến',
    dataIndex: 'checkedInAt',
    key: 'checkedInAt',
    width: 160,
    render: (time) => (
      <span style={{ whiteSpace: 'nowrap' }}>
        {time ? dayjs(time).format('HH:mm DD/MM/YYYY') : '—'}
      </span>
    ),
  },
  {
    title: 'Thao tác',
    key: 'action',
    width: 90,
    align: 'center',
    render: (_, record) => {
      const pInfo = getPatientInfo(record.patientId, record.patientName)
      const dInfo = getDoctorInfo(record.doctorId, record.doctorName)

      const canManageReQueue =
        permissions.canCheckIn ||
        permissions.canUpdateQueueStatus ||
        permissions.isAdmin ||
        permissions.isReceptionist

      const canManagePrioritize = Boolean(permissions.isAdmin || permissions.isReceptionist)
      const hasCallAction = permissions.canCallNext && record.status === 'WAITING'
      const hasReQueueAction = onReQueue && canManageReQueue && record.status === 'SKIPPED'
      const hasDeferAction = permissions.canSkip && record.status === 'IN_PROGRESS'

      const menuItems = [
        {
          key: 'detail',
          icon: <EyeOutlined />,
          label: 'Xem chi tiết lượt khám',
          onClick: () => onOpenDetail && onOpenDetail(record, pInfo, dInfo),
        },
        hasCallAction && {
          key: 'call',
          icon: <StepForwardOutlined style={{ color: '#2563eb' }} />,
          label: 'Gọi vào khám ngay',
          onClick: () => onCallNext && onCallNext(record.medicalQueueId || record.queueId || record.id),
        },
        canManagePrioritize &&
          canPrioritize(record.status) && {
            key: 'prioritize_menu',
            icon: record.priority === 'EMERGENCY' ? <AlertOutlined style={{ color: '#dc2626' }} /> : <StarOutlined style={{ color: '#ea580c' }} />,
            label: record.priority === 'EMERGENCY' ? 'Cập nhật mức ưu tiên (Cấp cứu)' : record.priority === 'PRIORITY' ? 'Cập nhật mức ưu tiên (Ưu tiên)' : 'Đánh dấu ưu tiên khám',
            onClick: () => onPrioritize && onPrioritize(record),
          },
        hasReQueueAction && {
          key: 're_queue_menu',
          icon: <ReloadOutlined style={{ color: '#0284c7' }} />,
          label: 'Đưa lại vào hàng đợi',
          onClick: () => onReQueue && onReQueue(record),
        },
        permissions.canUpdateStatus &&
          record.status === 'IN_PROGRESS' && {
            key: 'wait_cdls',
            label: 'Chuyển sang Chờ kết quả CĐLS',
            onClick: () => onUpdateStatus && onUpdateStatus(record.id, 'WAITING_FOR_RESULT'),
          },
        permissions.canUpdateStatus &&
          record.status === 'WAITING_FOR_RESULT' && {
            key: 'resume',
            label: 'Tiếp tục khám bệnh',
            onClick: () => onUpdateStatus && onUpdateStatus(record.id, 'IN_PROGRESS'),
          },
        hasDeferAction && {
          type: 'divider',
        },
        hasDeferAction && {
          key: 'skip',
          icon: <CloseCircleOutlined />,
          danger: true,
          label: 'Tạm hoãn lượt khám (Vắng mặt)',
          onClick: () => onSkip && onSkip(record),
        },
        canUserCloseVisit(user, record.doctorId) &&
          record.status === 'IN_PROGRESS' && {
            key: 'close_visit',
            icon: <StopOutlined />,
            danger: true,
            label: 'Kết thúc sớm / Hủy ca',
            onClick: () => onCloseVisit && onCloseVisit(record),
          },
        {
          type: 'divider',
        },
        onOpenHistory && {
          key: 'queue_history',
          icon: <HistoryOutlined />,
          label: 'Lịch sử luân chuyển hàng đợi',
          onClick: () => onOpenHistory(record),
        },
      ].filter(Boolean)

      return (
        <Dropdown menu={{ items: menuItems }} trigger={['click']} placement="bottomRight">
          <Button
            size="small"
            style={{
              height: 32,
              width: 32,
              borderRadius: 6,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            icon={<MoreOutlined style={{ fontSize: 16 }} />}
            title="Thao tác"
          />
        </Dropdown>
      )
    },
  },
]
