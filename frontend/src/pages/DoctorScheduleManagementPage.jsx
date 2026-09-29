import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Avatar,
  Badge,
  Breadcrumb,
  Button,
  Card,
  Divider,
  Empty,
  Modal,
  Popconfirm,
  Radio,
  Select,
  Space,
  Spin,
  Switch,
  Table,
  Tabs,
  Tag,
  TimePicker,
  Tooltip,
  Typography,
  message,
} from 'antd'
import {
  CalendarOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CopyOutlined,
  DeleteOutlined,
  ExclamationCircleOutlined,
  PlusOutlined,
  ReloadOutlined,
  SaveOutlined,
  ShopOutlined,
  UserOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'

import doctorScheduleApi from '../api/doctorScheduleApi.js'
import userApi from '../api/userApi.js'
import systemApi from '../api/systemApi.js'
import appointmentApi from '../api/appointmentApi.js'
import {
  DAYS_OF_WEEK,
  cleanDoctorScheduleErrorMessage,
  detectAffectedAppointments,
  formatDuration,
  formatTimeOffStatus,
  getDayLabel,
  getDayShortLabel,
  isTimeWithinClinicHours,
  normalizeTimeDisplay,
  toBackendTime,
} from '../utils/doctorScheduleHelpers.js'
import { getApiErrorMessage } from '../utils/apiError.js'
import { useAuthContext } from '../context/AuthContext.jsx'
import AffectedAppointmentsModal from '../components/doctor-schedule/AffectedAppointmentsModal.jsx'
import RegisterTimeOffModal from '../components/doctor-schedule/RegisterTimeOffModal.jsx'
import './styles/doctorScheduleManagement.css'

const { Title, Text } = Typography

function DoctorScheduleManagementPage() {
  const { user } = useAuthContext()

  const [doctors, setDoctors] = useState([])
  const [selectedDoctorId, setSelectedDoctorId] = useState(null)
  const [doctorsLoading, setDoctorsLoading] = useState(false)

  const [clinicConfig, setClinicConfig] = useState(null)
  const [clinicLoading, setClinicLoading] = useState(false)

  // Tab 1: Weekly Schedule
  const [weeklySchedules, setWeeklySchedules] = useState([])
  const [loadingWeekly, setLoadingWeekly] = useState(false)
  const [savingWeekly, setSavingWeekly] = useState(false)
  const [isDirty, setIsDirty] = useState(false)
  const [hasExistingSchedule, setHasExistingSchedule] = useState(true)

  // Tab 2: Time Offs
  const [timeOffs, setTimeOffs] = useState([])
  const [loadingTimeOffs, setLoadingTimeOffs] = useState(false)
  const [timeOffFilter, setTimeOffFilter] = useState('ALL')
  const [cancellingId, setCancellingId] = useState(null)

  // Modals
  const [registerModalOpen, setRegisterModalOpen] = useState(false)
  const [affectedModalOpen, setAffectedModalOpen] = useState(false)
  const [activeAffectedAppointments, setActiveAffectedAppointments] = useState([])
  const [activeAffectedTimeOffRange, setActiveAffectedTimeOffRange] = useState('')

  const [isFallbackActive, setIsFallbackActive] = useState(false)
  const [weekOffset, setWeekOffset] = useState(0)

  // 1. Fetch clinic config & doctors on mount
  useEffect(() => {
    setClinicLoading(true)
    systemApi.clinic()
      .then((res) => {
        setClinicConfig(res.data || null)
      })
      .catch(() => {
        // Fallback standard clinic hours if not configured yet
        setClinicConfig({
          clinicName: 'Phòng khám Bệnh Án Số',
          openingTime: '07:30:00',
          closingTime: '17:30:00',
        })
      })
      .finally(() => setClinicLoading(false))

    setDoctorsLoading(true)
    userApi.getDoctors()
      .then((res) => {
        const list = Array.isArray(res.data) ? res.data : []
        setDoctors(list)
        if (list.length > 0 && !selectedDoctorId) {
          setSelectedDoctorId(list[0].id)
        }
      })
      .catch(() => {
        message.error('Không thể tải danh sách bác sĩ.')
      })
      .finally(() => setDoctorsLoading(false))
  }, [])

  // Currently selected doctor object
  const currentDoctor = useMemo(() => {
    return doctors.find((d) => String(d.id) === String(selectedDoctorId)) || null
  }, [doctors, selectedDoctorId])

  // RBAC permissions based on logged-in user and selected doctor
  const userRoles = useMemo(() => {
    const raw = Array.isArray(user?.roles)
      ? user.roles
      : user?.role
      ? [user.role]
      : []
    return raw.map((r) => String(r || '').toUpperCase().replace(/^ROLE_/, ''))
  }, [user])

  const userPermissions = useMemo(() => {
    const raw = Array.isArray(user?.permissions) ? user.permissions : []
    return raw.map((p) => String(p || '').toUpperCase().replace(/^PERMISSION_/, ''))
  }, [user])

  const isAdminOrManager = useMemo(() => {
    return (
      userRoles.includes('ADMIN') ||
      userRoles.includes('CLINIC_MANAGER') ||
      userRoles.includes('MANAGER')
    )
  }, [userRoles])

  const isSelfDoctor = useMemo(() => {
    if (!user || !selectedDoctorId) return false
    const matchId = user.id && String(user.id) === String(selectedDoctorId)
    const matchDoctorId = user.doctorId && String(user.doctorId) === String(selectedDoctorId)
    const matchUsername = user.username && currentDoctor?.username && user.username === currentDoctor.username
    return Boolean(matchId || matchDoctorId || matchUsername)
  }, [user, selectedDoctorId, currentDoctor])

  const canUpdateWeeklySchedule = useMemo(() => {
    return isAdminOrManager || isSelfDoctor || userPermissions.includes('DOCTOR_SCHEDULE_UPDATE')
  }, [isAdminOrManager, isSelfDoctor, userPermissions])

  const canCreateTimeOff = useMemo(() => {
    return isAdminOrManager || isSelfDoctor || userPermissions.includes('DOCTOR_TIMEOFF_CREATE')
  }, [isAdminOrManager, isSelfDoctor, userPermissions])

  const canCancelTimeOff = useMemo(() => {
    return isAdminOrManager || isSelfDoctor || userPermissions.includes('DOCTOR_TIMEOFF_CANCEL')
  }, [isAdminOrManager, isSelfDoctor, userPermissions])

  // 2. Fetch Weekly Schedule when doctor changes
  const fetchWeeklySchedule = useCallback(async (doctorId) => {
    if (!doctorId) return
    setLoadingWeekly(true)
    setIsDirty(false)
    try {
      const res = await doctorScheduleApi.getWeeklySchedule(doctorId)
      if (res?.isFallback) {
        setIsFallbackActive(true)
      } else {
        setIsFallbackActive(false)
      }
      const data = Array.isArray(res.data) ? res.data : []
      setHasExistingSchedule(data.length > 0)

      // Build complete 7-day list
      const fullWeek = DAYS_OF_WEEK.map((d) => {
        const existing = data.find((item) => item.dayOfWeek === d.key)
        if (existing) {
          return {
            dayOfWeek: d.key,
            startTime: normalizeTimeDisplay(existing.startTime),
            endTime: normalizeTimeDisplay(existing.endTime),
            active: existing.active !== false,
          }
        }
        return {
          dayOfWeek: d.key,
          startTime: '08:00',
          endTime: '17:00',
          active: d.key !== 'SUNDAY', // default Sunday off
        }
      })
      setWeeklySchedules(fullWeek)
    } catch (err) {
      if (err.response?.status === 403) {
        message.error('Bạn không có quyền xem hoặc tải lịch làm việc của bác sĩ này.')
      }
      setHasExistingSchedule(false)
      setWeeklySchedules(DAYS_OF_WEEK.map((d) => ({
        dayOfWeek: d.key,
        startTime: '08:00',
        endTime: '17:00',
        active: d.key !== 'SUNDAY',
      })))
    } finally {
      setLoadingWeekly(false)
    }
  }, [])

  // 3. Fetch Time Offs when doctor changes
  const fetchTimeOffs = useCallback(async (doctorId) => {
    if (!doctorId) return
    setLoadingTimeOffs(true)
    try {
      const res = await doctorScheduleApi.getTimeOffs(doctorId)
      if (res?.isFallback) {
        setIsFallbackActive(true)
      }
      setTimeOffs(Array.isArray(res.data) ? res.data : [])
    } catch (err) {
      if (err.response?.status === 403) {
        message.error('Bạn không có quyền xem danh sách khoảng nghỉ của bác sĩ này.')
      }
      setTimeOffs([])
    } finally {
      setLoadingTimeOffs(false)
    }
  }, [])

  useEffect(() => {
    if (selectedDoctorId) {
      fetchWeeklySchedule(selectedDoctorId)
      fetchTimeOffs(selectedDoctorId)
    }
  }, [selectedDoctorId, fetchWeeklySchedule, fetchTimeOffs])

  // Switch doctor with unsaved changes guard (Review Note 2)
  const handleSelectDoctor = (newDoctorId) => {
    if (newDoctorId === selectedDoctorId) return
    if (isDirty) {
      Modal.confirm({
        title: 'Chưa lưu thay đổi lịch làm việc',
        icon: <ExclamationCircleOutlined />,
        content: 'Bạn có các thay đổi chưa lưu trên lịch làm việc của bác sĩ hiện tại. Nếu chuyển bác sĩ khác, các thay đổi chưa lưu sẽ bị mất. Bạn có chắc chắn muốn chuyển không?',
        okText: 'Rời đi (Không lưu)',
        cancelText: 'Ở lại tiếp tục sửa',
        okButtonProps: { danger: true },
        onOk: () => {
          setIsDirty(false)
          setSelectedDoctorId(newDoctorId)
        },
      })
      return
    }
    setSelectedDoctorId(newDoctorId)
  }

  // --- Handlers for Tab 1: Weekly Schedule ---
  const handleDayToggle = (dayOfWeek, active) => {
    if (!canUpdateWeeklySchedule) return
    setWeeklySchedules((prev) =>
      prev.map((item) => (item.dayOfWeek === dayOfWeek ? { ...item, active } : item))
    )
    setIsDirty(true)
  }

  const handleTimeChange = (dayOfWeek, timeStrings) => {
    if (!canUpdateWeeklySchedule) return
    if (!timeStrings || timeStrings.length < 2) return
    const [start, end] = timeStrings
    setWeeklySchedules((prev) =>
      prev.map((item) =>
        item.dayOfWeek === dayOfWeek ? { ...item, startTime: start, endTime: end } : item
      )
    )
    setIsDirty(true)
  }

  const handleApplyPreset = (dayOfWeek, preset) => {
    if (!canUpdateWeeklySchedule) return
    let start = '08:00'
    let end = '17:00'
    if (preset === 'morning') {
      start = '08:00'
      end = '12:00'
    } else if (preset === 'afternoon') {
      start = '13:00'
      end = '17:00'
    }

    setWeeklySchedules((prev) =>
      prev.map((item) =>
        item.dayOfWeek === dayOfWeek
          ? { ...item, startTime: start, endTime: end, active: true }
          : item
      )
    )
    setIsDirty(true)
  }

  const handleCopyMondayToWeekdays = () => {
    if (!canUpdateWeeklySchedule) return
    const monday = weeklySchedules.find((d) => d.dayOfWeek === 'MONDAY')
    if (!monday) return

    setWeeklySchedules((prev) =>
      prev.map((item) => {
        if (['TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'].includes(item.dayOfWeek)) {
          return {
            ...item,
            startTime: monday.startTime,
            endTime: monday.endTime,
            active: monday.active,
          }
        }
        return item
      })
    )
    setIsDirty(true)
    message.success('Đã sao chép khung giờ Thứ Hai cho các ngày Thứ Ba đến Thứ Sáu!')
  }

  const handleSaveWeeklySchedule = async () => {
    if (!selectedDoctorId) return
    if (!canUpdateWeeklySchedule) {
      message.error('Bạn không có quyền cấu hình lịch làm việc.')
      return
    }

    // Validation
    const clinicOpen = clinicConfig?.openingTime || '07:30:00'
    const clinicClose = clinicConfig?.closingTime || '17:30:00'

    for (const item of weeklySchedules) {
      if (item.active) {
        const check = isTimeWithinClinicHours(item.startTime, item.endTime, clinicOpen, clinicClose)
        if (!check.valid) {
          message.error(`[${getDayLabel(item.dayOfWeek)}] ${check.message}`)
          return
        }
      }
    }

    setSavingWeekly(true)
    try {
      const payload = {
        schedules: weeklySchedules.map((item) => ({
          dayOfWeek: item.dayOfWeek,
          startTime: toBackendTime(item.startTime),
          endTime: toBackendTime(item.endTime),
          active: item.active,
        })),
      }

      await doctorScheduleApi.configureWeeklySchedule(selectedDoctorId, payload)
      setIsDirty(false)
      setHasExistingSchedule(true)
      fetchWeeklySchedule(selectedDoctorId)

      // Kiểm tra các lịch hẹn tương lai bị ảnh hưởng bởi lịch làm việc mới (đồng bộ với backend QTN-31)
      try {
        const aptRes = await appointmentApi.getAll({
          doctorId: selectedDoctorId,
          startDate: dayjs().toISOString(),
          endDate: dayjs().add(180, 'day').toISOString(),
          size: 100,
        })
        const list = Array.isArray(aptRes?.data?.content)
          ? aptRes.data.content
          : (Array.isArray(aptRes?.data) ? aptRes.data : [])
        const affected = detectAffectedAppointments(list, weeklySchedules)
        if (affected.length > 0) {
          setActiveAffectedTimeOffRange('Cấu hình lịch làm việc tuần mới')
          setActiveAffectedAppointments(affected)
          setAffectedModalOpen(true)
          message.warning(`Đã lưu lịch làm việc tuần. Phát hiện ${affected.length} lịch hẹn bị ảnh hưởng cần điều phối lại.`)
        } else {
          message.success('Cập nhật lịch làm việc định kỳ thành công!')
        }
      } catch {
        message.success('Cập nhật lịch làm việc định kỳ thành công!')
      }
    } catch (err) {
      if (err.response?.status === 403) {
        message.error('Bạn không có quyền cấu hình lịch làm việc cho bác sĩ này.')
        return
      }
      const apiMsg = cleanDoctorScheduleErrorMessage(
        getApiErrorMessage(err, 'Không thể lưu lịch làm việc. Vui lòng kiểm tra lại ràng buộc giờ phòng khám.')
      )
      message.error(apiMsg)
    } finally {
      setSavingWeekly(false)
    }
  }

  // --- Handlers for Tab 2: Time-Offs ---
  const handleCancelTimeOff = async (timeOffId) => {
    if (!selectedDoctorId || !timeOffId) return
    if (!canCancelTimeOff) {
      message.error('Bạn không có quyền hủy khoảng nghỉ này.')
      return
    }
    setCancellingId(timeOffId)
    try {
      await doctorScheduleApi.cancelTimeOff(selectedDoctorId, timeOffId)
      message.success('Hủy khoảng nghỉ thành công! Bác sĩ đã có thể nhận lịch trong khung giờ này.')
      fetchTimeOffs(selectedDoctorId)
    } catch (err) {
      if (err.response?.status === 403) {
        message.error('Bạn không có quyền hủy khoảng nghỉ của bác sĩ này.')
        return
      }
      const apiMsg = cleanDoctorScheduleErrorMessage(
        getApiErrorMessage(err, 'Không thể hủy khoảng nghỉ.')
      )
      message.error(apiMsg)
    } finally {
      setCancellingId(null)
    }
  }

  const handleOpenAffectedModal = (record) => {
    const start = dayjs(record.startTime).format('HH:mm DD/MM/YYYY')
    const end = dayjs(record.endTime).format('HH:mm DD/MM/YYYY')
    setActiveAffectedTimeOffRange(`${start} - ${end}`)
    setActiveAffectedAppointments(record.affectedAppointments || [])
    setAffectedModalOpen(true)
  }

  const handleRegisterTimeOffSuccess = (createdTimeOff) => {
    fetchTimeOffs(selectedDoctorId)

    // Check TC-03: affected appointments
    if (createdTimeOff?.affectedAppointments && createdTimeOff.affectedAppointments.length > 0) {
      const start = dayjs(createdTimeOff.startTime).format('HH:mm DD/MM/YYYY')
      const end = dayjs(createdTimeOff.endTime).format('HH:mm DD/MM/YYYY')
      setActiveAffectedTimeOffRange(`${start} - ${end}`)
      setActiveAffectedAppointments(createdTimeOff.affectedAppointments)
      setAffectedModalOpen(true)
    }
  }

  // Filtered Time-offs
  const filteredTimeOffs = useMemo(() => {
    if (timeOffFilter === 'ACTIVE') return timeOffs.filter((t) => t.status === 'ACTIVE')
    if (timeOffFilter === 'CANCELLED') return timeOffs.filter((t) => t.status === 'CANCELLED')
    return timeOffs
  }, [timeOffs, timeOffFilter])

  // Statistics
  const activeWorkingDaysCount = useMemo(() => {
    return weeklySchedules.filter((d) => d.active).length
  }, [weeklySchedules])

  const totalWeeklyHours = useMemo(() => {
    let totalMinutes = 0
    weeklySchedules.forEach((d) => {
      if (d.active && d.startTime && d.endTime) {
        const [sh, sm] = d.startTime.split(':').map(Number)
        const [eh, em] = d.endTime.split(':').map(Number)
        const diff = eh * 60 + em - (sh * 60 + sm)
        if (diff > 0) totalMinutes += diff
      }
    })
    return (totalMinutes / 60).toFixed(1)
  }, [weeklySchedules])

  const activeTimeOffsCount = useMemo(() => {
    return timeOffs.filter((t) => t.status === 'ACTIVE').length
  }, [timeOffs])

  // Calculate dates for Monday through Sunday of the selected week for Tab 3
  const weekDays = useMemo(() => {
    const now = dayjs()
    const currentDay = now.day() // 0 is Sun, 1 is Mon...
    const diffToMonday = currentDay === 0 ? -6 : 1 - currentDay
    const monday = now.add(diffToMonday, 'day').add(weekOffset * 7, 'day').startOf('day')

    return DAYS_OF_WEEK.map((d, idx) => {
      const dayDate = monday.add(idx, 'day')
      const isToday = dayDate.isSame(now, 'day')
      return {
        ...d,
        date: dayDate,
        dateFormatted: dayDate.format('DD/MM'),
        isToday,
      }
    })
  }, [weekOffset])

  const weekRangeText = useMemo(() => {
    if (!weekDays || weekDays.length === 0) return ''
    const start = weekDays[0].date.format('DD/MM/YYYY')
    const end = weekDays[6].date.format('DD/MM/YYYY')
    return `Tuần từ ${start} đến ${end}`
  }, [weekDays])

  // Table columns for Time Offs
  const timeOffColumns = [
    {
      title: 'Khoảng thời gian nghỉ',
      key: 'timeRange',
      width: 260,
      render: (_, record) => {
        const start = dayjs(record.startTime).format('HH:mm - DD/MM/YYYY')
        const end = dayjs(record.endTime).format('HH:mm - DD/MM/YYYY')
        const duration = formatDuration(record.startTime, record.endTime)
        return (
          <div>
            <div style={{ fontWeight: 600, color: '#1e293b' }}>{start}</div>
            <div style={{ color: '#64748b' }}>đến {end}</div>
            {duration && (
              <Tag color="orange" style={{ marginTop: 4 }}>
                {duration}
              </Tag>
            )}
          </div>
        )
      },
    },
    {
      title: 'Lý do nghỉ',
      dataIndex: 'reason',
      key: 'reason',
      render: (reason) => <span>{reason}</span>,
    },
    {
      title: 'Lịch hẹn bị trùng (TC-03)',
      key: 'affectedAppointments',
      width: 190,
      render: (_, record) => {
        const count = record.affectedAppointments ? record.affectedAppointments.length : 0
        if (count === 0) {
          return <Tag color="default">Không có lịch hẹn trùng</Tag>
        }
        return (
          <Badge count={count} overflowCount={99}>
            <Button
              type="link"
              danger
              icon={<WarningOutlined />}
              onClick={() => handleOpenAffectedModal(record)}
              style={{ padding: 0 }}
            >
              Xem {count} lịch hẹn bị ảnh hưởng
            </Button>
          </Badge>
        )
      },
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      width: 140,
      render: (status) => {
        const { label, color } = formatTimeOffStatus(status)
        return <Tag color={color}>{label}</Tag>
      },
    },
    {
      title: 'Ngày tạo',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 150,
      render: (dt) => (dt ? dayjs(dt).format('HH:mm DD/MM/YYYY') : '---'),
    },
    {
      title: 'Thao tác',
      key: 'action',
      width: 120,
      render: (_, record) => {
        if (record.status === 'CANCELLED') {
          return <Text type="secondary">Đã hủy</Text>
        }
        if (!canCancelTimeOff) {
          return (
            <Tooltip title="Bạn không có quyền hủy khoảng nghỉ này">
              <span>
                <Button danger size="small" icon={<DeleteOutlined />} disabled>
                  Hủy nghỉ
                </Button>
              </span>
            </Tooltip>
          )
        }
        return (
          <Popconfirm
            title="Hủy khoảng nghỉ này?"
            description="Sau khi hủy, khung giờ này sẽ được mở lại cho bệnh nhân đặt lịch."
            onConfirm={() => handleCancelTimeOff(record.id)}
            okText="Đồng ý hủy"
            cancelText="Đóng"
            okButtonProps={{ danger: true, loading: cancellingId === record.id }}
          >
            <Button danger size="small" icon={<DeleteOutlined />}>
              Hủy nghỉ
            </Button>
          </Popconfirm>
        )
      },
    },
  ]

  const tabItems = [
    {
      key: 'weekly',
      label: (
        <span>
          <CalendarOutlined /> Lịch làm việc định kỳ theo tuần
          {isDirty && <Badge status="warning" style={{ marginLeft: 8 }} />}
        </span>
      ),
      children: (
        <div>
          <div className="schedule-config-header">
            <div>
              <Title level={5} style={{ margin: 0 }}>Cấu hình các ngày làm việc trong tuần</Title>
            </div>
            <div className="schedule-config-actions">
              <Tooltip title={!canUpdateWeeklySchedule ? 'Bạn không có quyền cấu hình lịch làm việc' : ''}>
                <span>
                  <Button
                    icon={<CopyOutlined />}
                    onClick={handleCopyMondayToWeekdays}
                    disabled={!canUpdateWeeklySchedule}
                  >
                    Sao chép Thứ 2 cho T3 - T6
                  </Button>
                </span>
              </Tooltip>
              <Tooltip title={!canUpdateWeeklySchedule ? 'Bạn không có quyền cấu hình lịch làm việc' : ''}>
                <span>
                  <Button
                    type="primary"
                    icon={<SaveOutlined />}
                    loading={savingWeekly}
                    disabled={!canUpdateWeeklySchedule}
                    onClick={handleSaveWeeklySchedule}
                  >
                    Lưu lịch làm việc tuần
                  </Button>
                </span>
              </Tooltip>
            </div>
          </div>

          {!hasExistingSchedule && !loadingWeekly && (
            <Alert
              type="warning"
              showIcon
              style={{ marginBottom: 16 }}
              message="Bác sĩ này chưa có lịch làm việc định kỳ trong hệ thống"
              description="Hệ thống đang hiển thị khung giờ làm việc mẫu (Thứ 2 đến Thứ 7 từ 08:00 đến 17:00, Chủ Nhật nghỉ). Vui lòng điều chỉnh và bấm 'Lưu lịch làm việc tuần' để chính thức kích hoạt lịch cho bác sĩ."
            />
          )}

          {!canUpdateWeeklySchedule && (
            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
              message="Chế độ chỉ xem lịch làm việc"
              description="Tài khoản của bạn không có quyền thay đổi hoặc lưu cấu hình lịch làm việc cho bác sĩ này. Các trường chỉnh sửa đã bị khóa."
            />
          )}

          <Spin spinning={loadingWeekly}>
            <div className="day-schedule-list">
              {weeklySchedules.map((item) => {
                const isWorking = item.active
                const startVal = item.startTime ? dayjs(item.startTime, 'HH:mm') : null
                const endVal = item.endTime ? dayjs(item.endTime, 'HH:mm') : null
                const rangeVal = startVal && endVal && isWorking ? [startVal, endVal] : null

                const validation = isWorking
                  ? isTimeWithinClinicHours(
                      item.startTime,
                      item.endTime,
                      clinicConfig?.openingTime,
                      clinicConfig?.closingTime
                    )
                  : { valid: true, message: '' }

                return (
                  <div
                    key={item.dayOfWeek}
                    className={`day-schedule-row ${!isWorking ? 'inactive' : ''}`}
                  >
                    <div className="day-label-group">
                      <div className={`day-tag ${!isWorking ? 'inactive' : ''}`}>
                        {getDayShortLabel(item.dayOfWeek)}
                      </div>
                      <div>
                        <div className="day-name">{getDayLabel(item.dayOfWeek)}</div>
                        <div style={{ fontSize: 12, color: isWorking ? '#16a34a' : '#94a3b8' }}>
                          {isWorking ? 'Đang làm việc' : 'Nghỉ làm'}
                        </div>
                      </div>
                    </div>

                    <div className="day-controls">
                      {isWorking && (
                        <div className="day-time-picker-wrapper">
                          <TimePicker.RangePicker
                            value={rangeVal}
                            format="HH:mm"
                            minuteStep={15}
                            allowClear={false}
                            disabled={!canUpdateWeeklySchedule}
                            placeholder={['Giờ bắt đầu', 'Giờ kết thúc']}
                            onChange={(_, timeStrings) => handleTimeChange(item.dayOfWeek, timeStrings)}
                            status={!validation.valid ? 'error' : ''}
                          />
                          {!validation.valid && (
                            <Text type="danger" style={{ fontSize: 12 }}>
                              {validation.message}
                            </Text>
                          )}
                        </div>
                      )}

                      {isWorking && (
                        <div className="day-presets">
                          <Button
                            size="small"
                            type="text"
                            disabled={!canUpdateWeeklySchedule}
                            onClick={() => handleApplyPreset(item.dayOfWeek, 'full')}
                          >
                            Cả ngày
                          </Button>
                          <Button
                            size="small"
                            type="text"
                            disabled={!canUpdateWeeklySchedule}
                            onClick={() => handleApplyPreset(item.dayOfWeek, 'morning')}
                          >
                            Ca sáng
                          </Button>
                          <Button
                            size="small"
                            type="text"
                            disabled={!canUpdateWeeklySchedule}
                            onClick={() => handleApplyPreset(item.dayOfWeek, 'afternoon')}
                          >
                            Ca chiều
                          </Button>
                        </div>
                      )}
                    </div>

                    <div className="day-switch-wrapper">
                      <Switch
                        checked={isWorking}
                        disabled={!canUpdateWeeklySchedule}
                        onChange={(checked) => handleDayToggle(item.dayOfWeek, checked)}
                        checkedChildren="Làm"
                        unCheckedChildren="Nghỉ"
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </Spin>
        </div>
      ),
    },
    {
      key: 'timeoff',
      label: (
        <span>
          <ClockCircleOutlined /> Khoảng nghỉ đột xuất & Nghỉ phép
          {activeTimeOffsCount > 0 && (
            <Badge count={activeTimeOffsCount} style={{ marginLeft: 8 }} />
          )}
        </span>
      ),
      children: (
        <div>
          <div className="timeoff-toolbar-header">
            <div>
              <Title level={5} style={{ margin: 0 }}>Danh sách khoảng nghỉ của Bác sĩ</Title>
            </div>
            <div className="timeoff-toolbar-actions">
              <Radio.Group value={timeOffFilter} onChange={(e) => setTimeOffFilter(e.target.value)}>
                <Radio.Button value="ALL">Tất cả</Radio.Button>
                <Radio.Button value="ACTIVE">Đang hiệu lực</Radio.Button>
                <Radio.Button value="CANCELLED">Đã hủy</Radio.Button>
              </Radio.Group>
              <Tooltip title={!canCreateTimeOff ? 'Bạn không có quyền đăng ký khoảng nghỉ cho bác sĩ này' : ''}>
                <span>
                  <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    disabled={!canCreateTimeOff}
                    onClick={() => setRegisterModalOpen(true)}
                  >
                    Đăng ký khoảng nghỉ đột xuất
                  </Button>
                </span>
              </Tooltip>
            </div>
          </div>

          <Table
            dataSource={filteredTimeOffs}
            columns={timeOffColumns}
            rowKey="id"
            loading={loadingTimeOffs}
            pagination={{ pageSize: 8 }}
            locale={{ emptyText: <Empty description="Chưa có khoảng nghỉ nào được đăng ký cho bác sĩ này" /> }}
          />
        </div>
      ),
    },
    {
      key: 'visual',
      label: (
        <span>
          <CheckCircleOutlined /> Lịch tổng quan trực quan tuần này
        </span>
      ),
      children: (
        <div>
          <div className="visual-week-header">
            <div>
              <Title level={5} style={{ margin: 0 }}>Tổng hợp lịch trực & khoảng nghỉ trong tuần</Title>
            </div>
            <div className="visual-week-controls">
              <Button size="small" onClick={() => setWeekOffset((prev) => prev - 1)}>
                ← Tuần trước
              </Button>
              <Tag color="blue" style={{ fontSize: 13, padding: '4px 10px', margin: 0 }}>
                {weekRangeText}
              </Tag>
              {weekOffset !== 0 && (
                <Button size="small" type="link" onClick={() => setWeekOffset(0)}>
                  Về tuần hiện tại
                </Button>
              )}
              <Button size="small" onClick={() => setWeekOffset((prev) => prev + 1)}>
                Tuần sau →
              </Button>
            </div>
          </div>

          <div className="visual-week-grid">
            {weekDays.map((d) => {
              const schedule = weeklySchedules.find((s) => s.dayOfWeek === d.key)
              const isWorking = schedule?.active

              // Only include time-offs that strictly overlap with this specific date
              const dayStart = d.date.startOf('day')
              const dayEnd = d.date.endOf('day')
              const activeTimeOffsForDay = timeOffs.filter((t) => {
                if (t.status !== 'ACTIVE') return false
                const tStart = dayjs(t.startTime)
                const tEnd = dayjs(t.endTime)
                return tStart.isBefore(dayEnd) && tEnd.isAfter(dayStart)
              })

              return (
                <div key={d.key} className={`visual-day-column ${d.isToday ? 'today' : ''}`}>
                  <div className="visual-day-header">
                    <div>
                      <strong>{d.label}</strong>
                      <div style={{ fontSize: 12, color: d.isToday ? '#2563eb' : '#64748b', fontWeight: d.isToday ? 600 : 400 }}>
                        {d.dateFormatted} {d.isToday && '(Hôm nay)'}
                      </div>
                    </div>
                    <Tag color={isWorking ? 'blue' : 'default'}>
                      {isWorking ? 'Có ca trực' : 'Nghỉ'}
                    </Tag>
                  </div>

                  {isWorking ? (
                    <div className="visual-slot-card working">
                      <strong>Ca làm việc:</strong>
                      <span>{schedule.startTime} - {schedule.endTime}</span>
                    </div>
                  ) : (
                    <div className="visual-slot-card off">
                      Nghỉ định kỳ
                    </div>
                  )}

                  {/* Only active time-offs that overlap with THIS day */}
                  {activeTimeOffsForDay.map((t) => {
                    const tStart = dayjs(t.startTime)
                    const tEnd = dayjs(t.endTime)
                    const sameDay = tStart.isSame(tEnd, 'day')
                    const timeRangeStr = sameDay
                      ? `${tStart.format('HH:mm')} - ${tEnd.format('HH:mm')}`
                      : `${tStart.format('HH:mm DD/MM')} - ${tEnd.format('HH:mm DD/MM')}`

                    return (
                      <div key={t.id} className="visual-slot-card timeoff">
                        <Space align="center" size="small">
                          <WarningOutlined style={{ color: '#ea580c' }} />
                          <strong style={{ color: '#c2410c' }}>Nghỉ đột xuất:</strong>
                        </Space>
                        <span style={{ fontSize: 12, fontWeight: 500, color: '#1e293b' }}>
                          {t.reason}
                        </span>
                        <span style={{ fontSize: 11, color: '#9a3412', fontWeight: 600 }}>
                          {timeRangeStr}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>
      ),
    },
  ]

  return (
    <div className="schedule-page-container">
      <Breadcrumb
        style={{ marginBottom: 16 }}
        items={[
          { title: 'Trang chủ' },
          { title: 'Tiếp nhận & Chăm sóc' },
          { title: 'Quản lý lịch làm việc & nghỉ của bác sĩ' },
        ]}
      />

      {/* Header Card */}
      <div className="schedule-header-card">
        <div className="schedule-header-title">
          <CalendarOutlined style={{ fontSize: 24, color: '#2563eb' }} />
          <div>
            <h2>Quản lý lịch làm việc và thời gian nghỉ của Bác sĩ</h2>
          </div>
        </div>

        {/* Clinic General Hours Banner */}
        <div className="clinic-hours-banner">
          <div className="clinic-hours-badge">
            <ShopOutlined />
            <span>
              Giờ làm việc phòng khám ({clinicConfig?.clinicName || 'Phòng khám'}):{' '}
              <strong>
                {normalizeTimeDisplay(clinicConfig?.openingTime || '07:30')} - {normalizeTimeDisplay(clinicConfig?.closingTime || '17:30')}
              </strong>
            </span>
          </div>
        </div>

        {isFallbackActive && (
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
            message="Chế độ hoạt động cục bộ (Backend đang chờ restart nạp endpoint mới)"
            description={
              <div>
                Tiến trình Backend (<code>mvn spring-boot:run</code>) được bật từ trước khi checkout nhánh tính năng này nên chưa nạp Controller và migration V42 (phản hồi 404).
                <br />
                Giao diện đang lưu tạm dữ liệu cục bộ trên trình duyệt để bạn kiểm tra và thao tác bình thường mà không bị gián đoạn. Để lưu trực tiếp vào MySQL Database, bạn chỉ cần <strong>khởi động lại Backend</strong> (bấm Ctrl+C tại terminal <code>mvn spring-boot:run</code> rồi chạy lại lệnh).
              </div>
            }
          />
        )}

        {/* Doctor Selector Bar */}
        <div className="doctor-select-bar">
          <Text strong>Chọn Bác sĩ:</Text>
          <Select
            className="doctor-select-field"
            value={selectedDoctorId}
            onChange={handleSelectDoctor}
            loading={doctorsLoading}
            showSearch
            placeholder="Tìm kiếm và chọn bác sĩ..."
            filterOption={(input, option) =>
              String(option?.label || '').toLowerCase().includes(input.toLowerCase())
            }
            options={doctors.map((doc) => ({
              value: doc.id,
              label: `${doc.fullName || doc.username} (${doc.email || 'Bác sĩ'})`,
            }))}
          />

          {currentDoctor && (
            <Space align="center" style={{ marginLeft: 'auto' }}>
              <Avatar icon={<UserOutlined />} style={{ backgroundColor: '#2563eb' }} />
              <div>
                <strong>{currentDoctor.fullName || currentDoctor.username}</strong>
                <div style={{ fontSize: 12, color: '#64748b' }}>{currentDoctor.email || 'Bác sĩ chuyên khoa'}</div>
              </div>
            </Space>
          )}
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="schedule-stats-row">
        <div className="schedule-stat-card">
          <div className="schedule-stat-icon blue">
            <CalendarOutlined />
          </div>
          <div className="schedule-stat-copy">
            <small>Số ngày làm / tuần</small>
            <strong>{activeWorkingDaysCount} ngày</strong>
          </div>
        </div>

        <div className="schedule-stat-card">
          <div className="schedule-stat-icon green">
            <ClockCircleOutlined />
          </div>
          <div className="schedule-stat-copy">
            <small>Tổng giờ làm / tuần</small>
            <strong>{totalWeeklyHours} giờ</strong>
          </div>
        </div>

        <div className="schedule-stat-card">
          <div className="schedule-stat-icon amber">
            <WarningOutlined />
          </div>
          <div className="schedule-stat-copy">
            <small>Khoảng nghỉ đang hiệu lực</small>
            <strong>{activeTimeOffsCount} khoảng nghỉ</strong>
          </div>
        </div>
      </div>

      {/* Main Card with Tabs */}
      <Card bordered={false} style={{ borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <Tabs items={tabItems} defaultActiveKey="weekly" />
      </Card>

      {/* Register Time Off Modal */}
      <RegisterTimeOffModal
        open={registerModalOpen}
        onClose={() => setRegisterModalOpen(false)}
        doctor={currentDoctor}
        onSuccess={handleRegisterTimeOffSuccess}
      />

      {/* Affected Appointments Modal */}
      <AffectedAppointmentsModal
        open={affectedModalOpen}
        onClose={() => setAffectedModalOpen(false)}
        appointments={activeAffectedAppointments}
        doctorName={currentDoctor?.fullName || currentDoctor?.username}
        timeOffRange={activeAffectedTimeOffRange}
      />
    </div>
  )
}

export default DoctorScheduleManagementPage
