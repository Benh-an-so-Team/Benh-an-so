import React from 'react'
import { Avatar, Button, Dropdown, Space, Tag, Typography } from 'antd'
import {
  CalendarOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  EyeOutlined,
  MoreOutlined,
  SendOutlined,
  SwapOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { getAvatarStyle, getInitials } from '../../utils/appointmentQueueUiHelpers'
import { APPOINTMENT_STATUS_META } from '../../utils/queueHelpers'
import { canRescheduleAppointment } from '../../utils/appointmentRescheduleValidation'
import { canConfirmAppointment } from '../../utils/appointmentConfirmValidation'

const { Text } = Typography

export const getAppointmentColumns = ({
  getPatientInfo,
  getDoctorInfo,
  permissions = {},
  user,
  onOpenDetail,
  onOpenSeriesDetail,
  onConfirm,
  onCheckIn,
  onReschedule,
  onRemind,
  onMarkNoShow,
  onCancel,
}) => [
  {
    title: 'Mã lịch hẹn',
    dataIndex: 'appointmentCode',
    key: 'appointmentCode',
    width: 160,
    render: (code, record) => {
      const hasSeries = Boolean(record?.seriesId || record?.series_id)
      const seriesCode = record?.seriesCode || record?.series_code
      const seq = record?.sequenceNumber || record?.sequence_number
      const total = record?.totalSessions || record?.total_sessions
      const label = seriesCode
        ? `Liệu trình ${seriesCode}${seq ? ` · Buổi ${seq}${total ? `/${total}` : ''}` : ''}`
        : `Liệu trình${seq ? ` · Buổi ${seq}` : ''}`

      return (
        <div>
          <Text strong style={{ color: '#2563eb', whiteSpace: 'nowrap', display: 'inline-block' }}>
            {code || 'Chưa có'}
          </Text>
          {hasSeries && (
            <div style={{ marginTop: 4 }}>
              <Tag
                color="purple"
                style={{ cursor: 'pointer', fontSize: 11 }}
                onClick={(e) => {
                  e.stopPropagation()
                  if (onOpenSeriesDetail) {
                    onOpenSeriesDetail(record.seriesId || record.series_id)
                  }
                }}
                title="Bấm để xem toàn bộ liệu trình này"
              >
                {label}
              </Tag>
            </div>
          )}
        </div>
      )
    },
  },
  {
    title: 'Bệnh nhân',
    dataIndex: 'patientName',
    key: 'patientName',
    width: 240,
    render: (_, record) => {
      const pInfo = getPatientInfo(record.patientId, record.patientName, record.patientCode, record.phone)
      return (
        <Space align="center" size="small">
          <Avatar style={getAvatarStyle(pInfo.name)}>{getInitials(pInfo.name)}</Avatar>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 150 }}>
            <Text strong style={{ fontSize: 14, color: '#0f172a', lineHeight: '1.4', whiteSpace: 'nowrap' }}>
              {pInfo.name}
            </Text>
            <Text type="secondary" style={{ fontSize: 12, lineHeight: '1.2', whiteSpace: 'nowrap' }}>
              Mã: {pInfo.code}
            </Text>
          </div>
        </Space>
      )
    },
  },
  {
    title: 'Bác sĩ & Chuyên khoa',
    dataIndex: 'doctorName',
    key: 'doctorName',
    width: 200,
    render: (_, record) => {
      const dInfo = getDoctorInfo(record.doctorId, record.doctorName, record.department)
      return (
        <div>
          <Text strong style={{ color: '#0f172a', display: 'block', whiteSpace: 'nowrap' }}>
            {dInfo.name}
          </Text>
          <Tag color="cyan" style={{ whiteSpace: 'nowrap', marginTop: 2 }}>
            {dInfo.department}
          </Tag>
        </div>
      )
    },
  },
  {
    title: 'Khung giờ hẹn',
    dataIndex: 'appointmentAt',
    key: 'appointmentAt',
    width: 180,
    render: (at, record) => {
      const timeVal = at || record.startTime || record.date
      const appTime = dayjs(timeVal)
      const timeStr = timeVal ? appTime.format('HH:mm - DD/MM/YYYY') : record.slot || 'Trong ngày'
      const isOverdue15Min = timeVal && dayjs().isAfter(appTime.add(15, 'minute')) && record.status === 'SCHEDULED'
      return (
        <Space direction="vertical" size={2}>
          <Text style={{ whiteSpace: 'nowrap' }}>{timeStr}</Text>
          {isOverdue15Min && <Tag color="error" style={{ whiteSpace: 'nowrap' }}>Quá 15p giờ hẹn</Tag>}
        </Space>
      )
    },
  },
  {
    title: 'Trạng thái',
    dataIndex: 'status',
    key: 'status',
    width: 140,
    render: (st) => {
      const meta = APPOINTMENT_STATUS_META[st] || { label: 'Không xác định', tone: 'gray' }
      return <Tag color={meta.tone} style={{ whiteSpace: 'nowrap' }}>{meta.label}</Tag>
    },
  },
  {
    title: 'Thao tác',
    key: 'action',
    width: 110,
    align: 'center',
    render: (_, record) => {
      const timeVal = record.appointmentAt || record.startTime || record.date
      const appTime = dayjs(timeVal)
      const isOverdue15Min = timeVal && dayjs().isAfter(appTime.add(15, 'minute'))

      const pInfo = getPatientInfo(record.patientId, record.patientName, record.patientCode, record.phone)
      const dInfo = getDoctorInfo(record.doctorId, record.doctorName, record.department)

      const reschedCheck = canRescheduleAppointment(record, dayjs())
      const confirmCheck = canConfirmAppointment(record, dayjs())

      const menuItems = [
        {
          key: 'detail',
          icon: <EyeOutlined />,
          label: 'Xem chi tiết lịch hẹn',
          onClick: () => onOpenDetail && onOpenDetail(record, pInfo, dInfo),
        },
        (record.seriesId || record.series_id) && {
          key: 'series_detail',
          icon: <CalendarOutlined style={{ color: '#7c3aed' }} />,
          label: 'Xem toàn bộ liệu trình',
          onClick: () => onOpenSeriesDetail && onOpenSeriesDetail(record.seriesId || record.series_id),
        },
        permissions.canConfirmAppointment && record.status === 'SCHEDULED' && {
          key: 'confirm',
          icon: <CheckCircleOutlined style={{ color: '#16a34a' }} />,
          disabled: !confirmCheck.allowed,
          label: confirmCheck.allowed ? 'Xác nhận lịch hẹn' : `Không thể xác nhận (${confirmCheck.reason})`,
          onClick: () => onConfirm && onConfirm(record),
        },
        ['SCHEDULED', 'CONFIRMED'].includes(record.status) && permissions.canCheckIn && {
          key: 'checkin',
          icon: <CheckCircleOutlined />,
          label: 'Tiếp nhận khám (Check-in)',
          onClick: () => onCheckIn && onCheckIn(record.id),
        },
        permissions.canRescheduleAppointment && ['SCHEDULED', 'CONFIRMED'].includes(record.status) && {
          key: 'reschedule',
          icon: <SwapOutlined />,
          disabled: !reschedCheck.allowed,
          label: reschedCheck.allowed ? 'Đổi lịch hẹn (Dời giờ)' : `Không thể đổi (${reschedCheck.reason})`,
          onClick: () => onReschedule && onReschedule(record),
        },
        record.status !== 'CANCELLED' && {
          key: 'remind',
          icon: <SendOutlined />,
          label: 'Gửi nhắc lịch hẹn',
          onClick: () => onRemind && onRemind(record),
        },
        ['SCHEDULED', 'CONFIRMED'].includes(record.status) && {
          key: 'noshow',
          icon: <CloseCircleOutlined />,
          disabled: !isOverdue15Min || record.status === 'CHECKED_IN',
          label: 'Đánh dấu Không đến (Quá 15p)',
          onClick: () => onMarkNoShow && onMarkNoShow(record),
        },
        ['SCHEDULED', 'CONFIRMED'].includes(record.status) && {
          type: 'divider',
        },
        ['SCHEDULED', 'CONFIRMED'].includes(record.status) && {
          key: 'cancel',
          icon: <CloseCircleOutlined />,
          danger: true,
          label: 'Hủy lịch hẹn này',
          onClick: () => onCancel && onCancel(record),
        },
      ].filter(Boolean)

      return (
        <Dropdown menu={{ items: menuItems }} trigger={['click']} placement="bottomRight">
          <Button size="small" icon={<MoreOutlined style={{ fontSize: 16 }} />} title="Thao tác" />
        </Dropdown>
      )
    },
  },
]
