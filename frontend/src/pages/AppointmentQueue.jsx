import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  Alert,
  Avatar,
  Badge,
  Button,
  Card,
  Col,
  DatePicker,
  Divider,
  Drawer,
  Dropdown,
  Empty,
  Form,
  Input,
  List,
  Modal,
  Radio,
  Row,
  Select,
  Space,
  Spin,
  Table,
  Tabs,
  Tag,
  TimePicker,
  Tooltip,
  Typography,
  message,
} from 'antd'
import {
  BellOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  CheckOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  DesktopOutlined,
  EllipsisOutlined,
  ExclamationCircleOutlined,
  EyeOutlined,
  FileTextOutlined,
  FilterOutlined,
  HistoryOutlined,
  MedicineBoxOutlined,
  MoreOutlined,
  PlusOutlined,
  RedoOutlined,
  ReloadOutlined,
  RightCircleOutlined,
  SearchOutlined,
  SendOutlined,
  StepForwardOutlined,
  SwapOutlined,
  TeamOutlined,
  UserAddOutlined,
  UserOutlined,
  UserSwitchOutlined,
  StopOutlined,
  TableOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import appointmentApi from '../api/appointmentApi'
import patientApi from '../api/patientApi'
import queueApi from '../api/queueApi'
import visitApi from '../api/visitApi.js'
import {
  getStoredHandovers,
  saveStoredHandover,
} from '../utils/handoverValidation.js'
import PatientMedicalHistoryModal from '../components/clinical/PatientMedicalHistoryModal'
import CloseVisitModal from '../components/clinical/CloseVisitModal'
import DoctorWeeklyScheduleTable from '../components/appointment/DoctorWeeklyScheduleTable'
import userApi from '../api/userApi'
import { useAuthContext } from '../context/AuthContext'
import { canUserCloseVisit } from '../utils/closeVisitHelpers'
import {
  APPOINTMENT_STATUS_META,
  QUEUE_STATUS_META,
  checkQueuePermissions,
  handleQueueApiError,
} from '../utils/queueHelpers'
import { fixMojibake } from '../utils/serviceCatalogValidation'
import {
  getStoredAppointmentLogs,
  getStoredNotificationLogs,
  saveAppointmentLog,
  saveNotificationLog,
  saveStoredQueueItem,
} from '../utils/storageHelpers'
import { formatVisitCode } from '../utils/helpers'
import ReceptionRescheduleAppointmentModal from '../components/appointment/ReceptionRescheduleAppointmentModal'
import UnconfirmedAppointmentsDrawer from '../components/appointment/UnconfirmedAppointmentsDrawer'
import BookAppointmentModal from '../components/appointment-queue/BookAppointmentModal'
import WalkInModal from '../components/appointment-queue/WalkInModal'
import CancelAppointmentModal from '../components/appointment-queue/CancelAppointmentModal'
import QuickPatientModal from '../components/appointment-queue/QuickPatientModal'
import AppointmentLogsDrawer from '../components/appointment-queue/AppointmentLogsDrawer'
import AppointmentDetailModal from '../components/appointment-queue/AppointmentDetailModal'
import InProgressPatientList from '../components/appointment-queue/InProgressPatientList'
import WaitingPatientList from '../components/appointment-queue/WaitingPatientList'
import WaitingForResultList from '../components/appointment-queue/WaitingForResultList'
import CompletedTodayList from '../components/appointment-queue/CompletedTodayList'
import { getAppointmentColumns } from './appointment-queue/appointmentColumns'
import { getQueueBoardColumns } from './appointment-queue/queueBoardColumns'
import PrioritizeQueueItemModal from '../components/queue/PrioritizeQueueItemModal.jsx'
import AppointmentWaitlistPanel from '../components/appointment/AppointmentWaitlistPanel.jsx'
import WaitlistSuggestionModal from '../components/appointment/WaitlistSuggestionModal.jsx'
import AddToWaitlistModal from '../components/appointment/AddToWaitlistModal.jsx'
import { sortQueueItemsByPriority } from '../utils/queuePriorityHelpers.js'
import {
  canRescheduleAppointment,
  getRescheduleRestrictionMessage,
} from '../utils/appointmentRescheduleValidation'
import {
  canConfirmAppointment,
  formatConfirmationInfo,
} from '../utils/appointmentConfirmValidation'
import DeferPatientModal from '../components/queue/DeferPatientModal'
import QueueItemHistoryModal from '../components/queue/QueueItemHistoryModal'
import {
  evaluateDeferAction,
  evaluateReQueueAction,
  cleanQueueActionErrorMessage,
} from '../utils/queueDeferRecallHelpers'

import {
  getInitials,
  getAvatarStyle,
  DEFAULT_DOCTORS,
  normalizeQueueItem,
  normalizeQueueList,
  replaceQueueItem,
} from '../utils/appointmentQueueUiHelpers'

const { Text, Title, Paragraph } = Typography

function AppointmentQueue() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user } = useAuthContext()

  const permissions = useMemo(
    () => checkQueuePermissions(user?.roles || [], user?.permissions || []),
    [user?.roles, user?.permissions],
  )

  const [activeMainTab, setActiveMainTab] = useState(() => {
    const params = new URLSearchParams(location.search)
    const tabParam = params.get('tab')
    if (tabParam) return tabParam
    return permissions.isDoctorOnly ? 'doctor_queue' : 'appointments'
  })

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const tabParam = params.get('tab')
    if (tabParam && ['appointments', 'doctor_weekly_table', 'reception_queue', 'waitlist', 'doctor_queue', 'completed'].includes(tabParam)) {
      setActiveMainTab(tabParam)
    }
  }, [location.search])
  const [selectedDate, setSelectedDate] = useState(dayjs())
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)

  const [appointments, setAppointments] = useState([])
  const [queues, setQueues] = useState([])
  const [myQueueData, setMyQueueData] = useState(null)
  const [patients, setPatients] = useState([])
  const [doctors, setDoctors] = useState(DEFAULT_DOCTORS)
  const doctorList = useMemo(() => (Array.isArray(doctors) ? doctors : DEFAULT_DOCTORS), [doctors])
  const [appointmentLogs, setAppointmentLogs] = useState([])
  const [notificationLogs, setNotificationLogs] = useState([])

  const [appStatusFilter, setAppStatusFilter] = useState('ALL')
  const [appDoctorFilter, setAppDoctorFilter] = useState('ALL')
  const [appKeyword, setAppKeyword] = useState('')

  const [queueDoctorFilter, setQueueDoctorFilter] = useState('ALL')
  const [queueRoomFilter, setQueueRoomFilter] = useState('ALL')
  const [queueStatusFilter, setQueueStatusFilter] = useState('ALL')
  const [queueSourceFilter, setQueueSourceFilter] = useState('ALL')
  const [queueKeyword, setQueueKeyword] = useState('')

  const [bookModalOpen, setBookModalOpen] = useState(false)
  const [walkInModalOpen, setWalkInModalOpen] = useState(false)
  const [skipModalItem, setSkipModalItem] = useState(null)
  const [historyQueueItem, setHistoryQueueItem] = useState(null)
  const [prioritizeModalItem, setPrioritizeModalItem] = useState(null)
  const [reQueuingId, setReQueuingId] = useState(null)
  const [closeVisitModalItem, setCloseVisitModalItem] = useState(null)
  const [cancelModalItem, setCancelModalItem] = useState(null)
  const [rescheduleModalItem, setRescheduleModalItem] = useState(null)
  const [rescheduleSubmitting, setRescheduleSubmitting] = useState(false)
  const [detailItem, setDetailItem] = useState(null)
  const [unconfirmedDrawerOpen, setUnconfirmedDrawerOpen] = useState(false)
  const [quickPatientModalOpen, setQuickPatientModalOpen] = useState(false)
  const [quickPatientSaving, setQuickPatientSaving] = useState(false)
  const [waitlistSuggestionModalOpen, setWaitlistSuggestionModalOpen] = useState(false)
  const [waitlistSuggestion, setWaitlistSuggestion] = useState(null)
  const [addToWaitlistModalOpen, setAddToWaitlistModalOpen] = useState(false)
  const [waitlistPrefill, setWaitlistPrefill] = useState(null)
  const [logsDrawerOpen, setLogsDrawerOpen] = useState(false)
  const [historyModalOpen, setHistoryModalOpen] = useState(false)
  const [historyPatientTarget, setHistoryPatientTarget] = useState(null)
  const [completedSearchKeyword, setCompletedSearchKeyword] = useState('')

  const openPatientHistory = useCallback((patientId, patientName, patientCode) => {
    if (!patientId) {
      message.warning('Không tìm thấy mã bệnh nhân để tra cứu lịch sử.')
      return
    }
    setHistoryPatientTarget({ patientId, patientName, patientCode })
    setHistoryModalOpen(true)
  }, [])

  const [bookForm] = Form.useForm()
  const [walkInForm] = Form.useForm()
  const [skipForm] = Form.useForm()
  const [cancelForm] = Form.useForm()
  const [quickPatientForm] = Form.useForm()

  const getDoctorInfo = useCallback((doctorId, fallbackName, fallbackDept) => {
    const cleanId = String(doctorId || '').toLowerCase().replace(/-/g, '')
    const doc = doctors.find((d) => {
      const dClean = String(d.id || '').toLowerCase().replace(/-/g, '')
      return (cleanId && dClean === cleanId) || String(d.id) === String(doctorId)
    })
    if (doc) {
      return {
        name: fixMojibake(doc.fullName || doc.name || doc.username || fallbackName || 'BS. Chưa phân công'),
        department: fixMojibake(doc.department || fallbackDept || '—'),
      }
    }
    return { name: fixMojibake(fallbackName || 'Bác sĩ chưa xác định'), department: fixMojibake(fallbackDept || '—') }
  }, [doctors])

  const getPatientInfo = useCallback((patientId, fallbackName, fallbackCode, fallbackPhone) => {
    const cleanId = String(patientId || '').toLowerCase().replace(/-/g, '')
    const pat = (patients || []).find((p) => {
      const pClean = String(p.id || '').toLowerCase().replace(/-/g, '')
      return (cleanId && pClean === cleanId) || String(p.id) === String(patientId)
    })
    if (pat) {
      return {
        name: fixMojibake(pat.fullName || pat.name || fallbackName || 'Bệnh nhân'),
        code: pat.patientCode || pat.code || fallbackCode || '—',
        phone: pat.phoneNumber || pat.phone || fallbackPhone || '',
      }
    }
    return { name: fixMojibake(fallbackName || 'Bệnh nhân'), code: fallbackCode || '—', phone: fallbackPhone || '' }
  }, [patients])

  const isSamePatient = useCallback((id1, id2) => {
    if (!id1 || !id2) return false
    return String(id1) === String(id2)
  }, [])

  const loadDirectories = useCallback(async () => {
    try {
      const [patientRes, doctorRes] = await Promise.allSettled([
        patientApi.getAll({ page: 0, size: 500 }),
        userApi.getDoctors(),
      ])

      if (patientRes.status === 'fulfilled' && Array.isArray(patientRes.value?.data?.content || patientRes.value?.data)) {
        const list = patientRes.value?.data?.content || patientRes.value?.data
        setPatients(list)
      } else {
        setPatients([])
      }

      if (doctorRes.status === 'fulfilled') {
        const rawData = doctorRes.value?.data
        const list = Array.isArray(rawData)
          ? rawData
          : (Array.isArray(rawData?.content) ? rawData.content : [])
        if (list.length > 0) {
          setDoctors(list)
        } else {
          setDoctors(DEFAULT_DOCTORS)
        }
      } else {
        setDoctors(DEFAULT_DOCTORS)
      }
    } catch {
      setPatients([])
      setDoctors(DEFAULT_DOCTORS)
    }
  }, [])

  const loadAppointments = useCallback(async () => {
    try {
      const res = await appointmentApi.getAll({
        startDate: selectedDate.startOf('day').toISOString(),
        endDate: selectedDate.endOf('day').toISOString(),
      })
      const list = Array.isArray(res.data) ? res.data : (res.data?.content || [])
      const rawList = list

      const normalized = rawList.map((item) => {
        const timeVal = item.appointmentAt || item.startTime || item.date
        return {
          ...item,
          appointmentAt: timeVal,
        }
      })
      setAppointments(normalized)
    } catch {
      setAppointments([])
    }
  }, [selectedDate])

  const loadQueues = useCallback(async () => {
    try {
      const params = {
        date: selectedDate.format('YYYY-MM-DD'),
        doctorId: queueDoctorFilter !== 'ALL' ? queueDoctorFilter : undefined,
        roomId: queueRoomFilter !== 'ALL' ? queueRoomFilter : undefined,
      }
      const res = await queueApi.getQueues(params)
      const list = normalizeQueueList(res.data)
      setQueues(list)

      // Đồng bộ lịch sử bàn giao cho các lượt khám trong ngày
      const activeItems = list.filter(
        (item) => item.visitId && ['IN_PROGRESS', 'WAITING', 'WAITING_FOR_RESULT'].includes(item.status)
      )
      if (activeItems.length > 0) {
        Promise.allSettled(
          activeItems.map((item) =>
            visitApi
              .getVisitHandovers(item.visitId)
              .then((hRes) => {
                if (Array.isArray(hRes.data) && hRes.data.length > 0) {
                  const lastH = hRes.data[hRes.data.length - 1]
                  saveStoredHandover({
                    visitId: item.visitId,
                    patientId: item.patientId,
                    patientName: item.patientName,
                    patientCode: item.patientCode,
                    fromDoctorId: lastH.fromDoctorId,
                    fromDoctorName: lastH.fromDoctorName,
                    toDoctorId: lastH.toDoctorId,
                    toDoctorName: lastH.toDoctorName,
                    reason: lastH.reason,
                    handedOverAt: lastH.handedOverAt,
                  })
                }
              })
              .catch(() => {})
          )
        )
      }
    } catch (err) {
      setQueues([])
      console.error('Error loading queue board:', err)
    }
  }, [selectedDate, queueDoctorFilter, queueRoomFilter])

  const loadMyQueue = useCallback(async () => {
    if (!permissions.canViewMyQueue) {
      setMyQueueData([])
      return
    }
    try {
      const res = await queueApi.getMyQueue({ date: selectedDate.format('YYYY-MM-DD') })
      setMyQueueData(normalizeQueueList(res.data))
    } catch (err) {
      setMyQueueData([])
      console.error('Error loading doctor queue:', err)
    }
  }, [selectedDate, permissions.canViewMyQueue])

  const loadLogs = useCallback(() => {
    setAppointmentLogs(getStoredAppointmentLogs())
    setNotificationLogs(getStoredNotificationLogs())
  }, [])

  const refreshAllData = useCallback(async () => {
    setLoading(true)
    try {
      const tasks = [loadAppointments(), loadQueues()]
      if (permissions.canViewMyQueue) {
        tasks.push(loadMyQueue())
      }
      await Promise.allSettled(tasks)
      loadLogs()
    } catch (err) {
      console.error('Error refreshing queue data:', err)
    } finally {
      setLoading(false)
    }
  }, [loadAppointments, loadQueues, loadMyQueue, loadLogs, permissions.canViewMyQueue])

  useEffect(() => {
    loadDirectories()
    refreshAllData()
  }, [loadDirectories, refreshAllData])

  useEffect(() => {
    if (location.state?.patientId) {
      setBookModalOpen(true)
      bookForm.setFieldsValue({
        patientId: location.state.patientId,
      })
    }
  }, [location.state, bookForm])

  useEffect(() => {
    const timer = setInterval(() => {
      if (!permissions.isDoctorOnly) loadQueues()
      if (permissions.canViewMyQueue) loadMyQueue()
    }, 20000)
    return () => clearInterval(timer)
  }, [loadQueues, loadMyQueue, permissions.canViewMyQueue, permissions.isDoctorOnly])

  const extractedRooms = useMemo(() => {
    const map = new Map()
    queues.forEach((q) => {
      const rId = q.roomId
      if (rId && !map.has(String(rId))) {
        map.set(String(rId), {
          id: rId,
          code: q.roomNumber || q.roomName || 'Phòng khám',
          name: q.roomName || q.roomNumber || 'Phòng khám',
        })
      }
    })
    return Array.from(map.values())
  }, [queues])

  const filteredAppointments = useMemo(() => {
    return appointments.filter((app) => {
      const pInfo = getPatientInfo(app.patientId, app.patientName, app.patientCode, app.phone)
      const dInfo = getDoctorInfo(app.doctorId, app.doctorName, app.department)

      const isDateMatch = !selectedDate || dayjs(app.date || app.appointmentAt || app.startTime).isSame(selectedDate, 'day')
      const isDoctorMatch = permissions.isDoctorOnly
        ? String(app.doctorId) === String(user?.id)
        : appDoctorFilter === 'ALL' || String(app.doctorId) === String(appDoctorFilter)
      const isStatusMatch = appStatusFilter === 'ALL' || app.status === appStatusFilter
      const isKeywordMatch =
        !appKeyword ||
        app.appointmentCode?.toLowerCase().includes(appKeyword.toLowerCase()) ||
        pInfo.name?.toLowerCase().includes(appKeyword.toLowerCase()) ||
        pInfo.code?.toLowerCase().includes(appKeyword.toLowerCase())

      return isDateMatch && isDoctorMatch && isStatusMatch && isKeywordMatch
    })
  }, [appointments, selectedDate, appDoctorFilter, appStatusFilter, appKeyword, getPatientInfo, getDoctorInfo, permissions.isDoctorOnly, user?.id])

  const unconfirmedTodayCount = useMemo(() => {
    return appointments.filter((apt) => {
      if (apt.status !== 'SCHEDULED') return false
      const timeVal = apt.appointmentAt || apt.startTime || apt.date
      if (!timeVal) return false
      const aptTime = dayjs(timeVal)
      return aptTime.isValid() && aptTime.isAfter(dayjs())
    }).length
  }, [appointments])

  const filteredQueues = useMemo(() => {
    const kw = queueKeyword.trim().toLowerCase()

    const validItems = queues.filter((q) => {
      if (permissions.isDoctorOnly && String(q.doctorId) !== String(user?.id)) return false
      if (queueStatusFilter !== 'CANCELLED' && q.status === 'CANCELLED') return false
      if (queueStatusFilter !== 'ALL' && q.status !== queueStatusFilter) return false
      if (queueSourceFilter !== 'ALL' && q.sourceType !== queueSourceFilter) return false
      const pInfo = getPatientInfo(q.patientId, q.patientName, q.patientCode, q.phone)
      const dInfo = getDoctorInfo(q.doctorId, q.doctorName, q.department)
      const textMatch = !kw || [pInfo.name, pInfo.code, q.visitCode, dInfo.name, q.roomName, q.id]
        .some((t) => String(t || '').toLowerCase().includes(kw))
      return textMatch
    })

    // Giữ nguyên thứ tự danh sách do Backend trả về (đã sắp xếp sẵn: CẤP CỨU -> ƯU TIÊN -> THƯỜNG)
    return validItems
  }, [queues, queueKeyword, queueStatusFilter, queueSourceFilter, getPatientInfo, getDoctorInfo, permissions.isDoctorOnly, user?.id])

  const doctorQueueGroups = useMemo(() => {
    const handovers = getStoredHandovers()
    const handoverMap = new Map()
    handovers.forEach((h) => {
      if (h.visitId) handoverMap.set(String(h.visitId), h)
    })

    const currentUserId = user?.id || user?.userId
    let baseItems = []
    if (permissions.isDoctorOnly) {
      baseItems = (Array.isArray(myQueueData) ? myQueueData : myQueueData?.items || myQueueData?.content) || []
    } else {
      baseItems = queueDoctorFilter === 'ALL'
        ? queues
        : queues.filter((q) => String(q.doctorId) === String(queueDoctorFilter) || String(q.doctorName) === String(queueDoctorFilter))
    }

    // 1. Loại bỏ các ca khám mà bác sĩ hiện tại đã bàn giao sang bác sĩ khác
    const filteredBaseItems = baseItems.filter((item) => {
      const h = handoverMap.get(String(item.visitId))
      if (h && currentUserId && String(h.fromDoctorId) === String(currentUserId) && String(h.toDoctorId) !== String(currentUserId)) {
        return false
      }
      return true
    })

    // 2. Bổ sung các ca khám đã được bàn giao cho bác sĩ hiện tại từ các phòng khám khác
    const handedOverToMe = []
    const extraHandoverItems = []
    if (currentUserId) {
      queues.forEach((qItem) => {
        const h = handoverMap.get(String(qItem.visitId))
        const isTargetDoctor = h && (
          String(h.toDoctorId) === String(currentUserId) ||
          (user.fullName && h.toDoctorName && h.toDoctorName.toLowerCase() === user.fullName.toLowerCase()) ||
          (user.username && h.toDoctorName && h.toDoctorName.toLowerCase().includes(user.username.toLowerCase()))
        )

        if (isTargetDoctor) {
          const alreadyExists = filteredBaseItems.some(
            (m) => String(m.id) === String(qItem.id) || String(m.visitId) === String(qItem.visitId)
          )
          if (!alreadyExists) {
            const isItemCompleted = Boolean(h.completed) || qItem.status === 'COMPLETED'
            const handoverItemObj = {
              ...qItem,
              status: isItemCompleted ? 'COMPLETED' : qItem.status,
              doctorId: currentUserId,
              doctorName: user.fullName || user.username,
              isHandoverToMe: true,
              fromDoctorName: h.fromDoctorName || 'Đồng nghiệp',
              handoverReason: h.reason || '',
              handedOverAt: h.handedOverAt,
            }
            if (!isItemCompleted) {
              handedOverToMe.push(handoverItemObj)
            }
            extraHandoverItems.push(handoverItemObj)
          }
        }
      })
    }

    const items = [...filteredBaseItems, ...extraHandoverItems]
    const sortByNumber = (list) => [...list].sort((a, b) => Number(a.queueNumber || 999999) - Number(b.queueNumber || 999999))

    return {
      handedOverToMe,
      inProgress: sortByNumber(items.filter((q) => q.status === 'IN_PROGRESS')),
      waiting: sortQueueItemsByPriority(items.filter((q) => q.status === 'WAITING')),
      waitingForResult: sortByNumber(items.filter((q) => q.status === 'WAITING_FOR_RESULT')),
      skipped: sortByNumber(items.filter((q) => q.status === 'SKIPPED')),
      completed: [...items.filter((q) => q.status === 'COMPLETED')].sort((a, b) => {
        if (a.completedAt && b.completedAt) {
          return new Date(b.completedAt) - new Date(a.completedAt)
        }
        return Number(b.queueNumber || 0) - Number(a.queueNumber || 0)
      }),
      finished: [...items.filter((q) => ['COMPLETED', 'SKIPPED', 'CANCELLED', 'EARLY_ENDED'].includes(q.status))].sort((a, b) => {
        const timeA = a.completedAt || a.cancelledAt || a.skippedAt || a.updatedAt || a.calledAt || 0
        const timeB = b.completedAt || b.cancelledAt || b.skippedAt || b.updatedAt || b.calledAt || 0
        if (timeA && timeB) {
          return new Date(timeB) - new Date(timeA)
        }
        return Number(b.queueNumber || 0) - Number(a.queueNumber || 0)
      }),
    }
  }, [permissions.isDoctorOnly, myQueueData, queues, user?.id, user?.userId, user?.fullName, user?.username, queueDoctorFilter])

  const handleCreateAppointmentSubmit = async (values) => {
    setActionLoading(true)
    try {
      const appointmentTime = values.appointmentAt
        ? dayjs(values.appointmentAt)
        : dayjs(`${values.appointmentDate.format('YYYY-MM-DD')} ${values.appointmentTime.format('HH:mm')}`)

      if (appointmentTime.isBefore(dayjs().subtract(5, 'minute'))) {
        message.error('Hệ thống không cho đặt vào thời điểm đã qua (Khung giờ ở quá khứ)!')
        setActionLoading(false)
        return
      }

      const doctorId = values.doctorId
      const isDoctorBusy = appointments.some((app) => {
        if (['CANCELLED', 'NO_SHOW'].includes(app.status)) return false
        if (String(app.doctorId) !== String(doctorId)) return false
        const existingTime = dayjs(app.appointmentAt || app.startTime || app.date)
        return existingTime.isSame(appointmentTime, 'day') && Math.abs(existingTime.diff(appointmentTime, 'minute')) < 30
      })

      if (isDoctorBusy) {
        message.error('Hệ thống từ chối: Bác sĩ đã có lịch trong cùng khung giờ!')
        setActionLoading(false)
        return
      }

      const pInfo = getPatientInfo(values.patientId)
      const dInfo = getDoctorInfo(values.doctorId)
      const apiPayload = {
        patientId: values.patientId,
        doctorId: values.doctorId,
        startTime: appointmentTime.toISOString(),
        endTime: appointmentTime.add(30, 'minute').toISOString(),
        reason: values.reason || 'Khám bệnh',
      }
      const response = await appointmentApi.create(apiPayload)
      const newAppointment = response.data
      if (!newAppointment?.id || !newAppointment?.appointmentCode) {
        throw new Error('Backend không trả id và appointmentCode của lịch hẹn.')
      }

      saveAppointmentLog({
        appointmentId: newAppointment.id,
        appointmentCode: newAppointment.appointmentCode,
        action: 'CREATE',
        operatorName: user?.fullName || user?.username || 'Lễ tân',
        details: `Lễ tân chọn bệnh nhân ${pInfo.name}, bác sĩ ${dInfo.name} và khung giờ ${appointmentTime.format('HH:mm DD/MM/YYYY')} -> Lịch hẹn ở trạng thái ĐÃ ĐẶT`,
      })

      message.success(`Đặt lịch hẹn thành công: ${newAppointment.appointmentCode} (Trạng thái: ĐÃ ĐẶT)`)
      setBookModalOpen(false)
      bookForm.resetFields()
      refreshAllData()
    } catch (err) {
      handleQueueApiError(err, 'Không thể tạo lịch hẹn. Vui lòng kiểm tra lại thông tin và thử lại.')
    } finally {
      setActionLoading(false)
    }
  }

  const handleCancelAppointmentSubmit = async (values) => {
    if (!cancelModalItem) return
    const app = cancelModalItem

    if (['COMPLETED', 'CANCELLED'].includes(app.status)) {
      message.error('Hệ thống không cho hủy: Lịch hẹn đã hoàn tất hoặc đã hủy!')
      setCancelModalItem(null)
      return
    }

    setActionLoading(true)
    try {
      const reason = values.reason || 'Bệnh nhân báo bận'
      const cancelRes = await appointmentApi.cancel(app.id, reason)
      saveAppointmentLog({
        appointmentId: app.id,
        appointmentCode: app.appointmentCode || 'Chưa có mã',
        action: 'CANCEL',
        operatorName: user?.fullName || user?.username || 'Lễ tân',
        details: `Lễ tân hủy lịch hẹn. Lý do: ${reason}. Khung giờ được giải phóng.`,
      })

      message.success(`Lịch hẹn ${app.appointmentCode || ''} đã chuyển sang ĐÃ HỦY thành công!`)
      setCancelModalItem(null)
      cancelForm.resetFields()
      refreshAllData()

      // NCL-03-CN-012: Kiểm tra gợi ý người chờ đầu tiên từ response hủy lịch hẹn
      const cancelData = cancelRes?.data
      if (cancelData?.suggestedWaitlistEntry) {
        setWaitlistSuggestion(cancelData.suggestedWaitlistEntry)
        setWaitlistSuggestionModalOpen(true)
      }
    } catch {
      message.error('Không thể hủy lịch hẹn!')
    } finally {
      setActionLoading(false)
    }
  }

  const handleBookFromWaitlist = (target) => {
    setWaitlistSuggestionModalOpen(false)
    setWaitlistSuggestion(null)
    setBookModalOpen(true)
    bookForm.setFieldsValue({
      patientId: target?.patientId || undefined,
      doctorId: target?.doctorId || undefined,
      appointmentDate: target?.desiredDate ? dayjs(target.desiredDate) : dayjs(),
      appointmentTime: dayjs().add(1, 'hour'),
      reason: target?.note ? `(Từ DS chờ) ${target.note}` : 'Đặt lịch từ danh sách chờ',
    })
  }

  const handleOpenAddToWaitlist = (prefill) => {
    setBookModalOpen(false)
    setWaitlistPrefill(prefill || null)
    setAddToWaitlistModalOpen(true)
  }

  const handleOpenRescheduleModal = (record) => {
    if (!permissions.canRescheduleAppointment) {
      message.error('Chỉ Lễ tân hoặc Admin mới có quyền đổi lịch hẹn tại quầy.')
      return
    }
    const check = canRescheduleAppointment(record, dayjs())
    if (!check.allowed) {
      message.warning(check.reason || 'Không thể đổi lịch hẹn này.')
      return
    }
    const pInfo = getPatientInfo(record.patientId, record.patientName, record.patientCode, record.phone)
    const dInfo = getDoctorInfo(record.doctorId, record.doctorName, record.department)
    setRescheduleModalItem({
      ...record,
      patientName: pInfo.name,
      patientCode: pInfo.code,
      phone: pInfo.phone,
      doctorName: dInfo.name,
      department: dInfo.department,
    })
  }

  const handleConfirmRescheduleSubmit = async (appointment, payload) => {
    setRescheduleSubmitting(true)
    try {
      const res = await appointmentApi.reschedule(appointment.id, payload)
      const updatedApp = res?.data || res

      const pInfo = getPatientInfo(appointment.patientId, appointment.patientName)
      const targetDoc = doctors.find((d) => String(d.id) === String(payload.newDoctorId))
      const docName = targetDoc ? (targetDoc.fullName || targetDoc.username) : getDoctorInfo(appointment.doctorId).name
      const newTimeStr = dayjs(payload.startTime).format('HH:mm DD/MM/YYYY')

      saveAppointmentLog({
        appointmentId: appointment.id,
        appointmentCode: appointment.appointmentCode || 'Chưa có mã',
        action: 'RESCHEDULE',
        operatorName: user?.fullName || user?.username || 'Lễ tân',
        details: `Lễ tân đổi lịch hẹn bệnh nhân ${pInfo.name} sang bác sĩ ${docName} lúc ${newTimeStr}. Lý do: ${payload.reason}`,
      })

      message.success(`Đổi lịch hẹn thành công cho bệnh nhân ${pInfo.name} sang ${newTimeStr}! Khung giờ cũ đã được giải phóng.`)
      setRescheduleModalItem(null)
      if (detailItem && detailItem.id === appointment.id) {
        setDetailItem((prev) => ({
          ...prev,
          ...updatedApp,
          patientName: pInfo.name,
          doctorName: docName,
          appointmentAt: payload.startTime,
          startTime: payload.startTime,
          endTime: payload.endTime,
        }))
      }
      refreshAllData()
    } catch (err) {
      let apiMessage = err?.response?.data?.message || err?.message || 'Không thể đổi lịch hẹn. Vui lòng kiểm tra lại khung giờ và ca trực của Bác sĩ.'
      if (
        err?.response?.status === 409 ||
        (typeof apiMessage === 'string' && (
          apiMessage.toLowerCase().includes('conflict') ||
          apiMessage.toLowerCase().includes('overlap') ||
          apiMessage.toLowerCase().includes('already booked') ||
          apiMessage.toLowerCase().includes('trùng lịch')
        ))
      ) {
        apiMessage = 'Khung giờ này đã bị trùng lịch với lịch hẹn khác của Bác sĩ. Vui lòng chọn khung giờ khác.'
      }
      message.error(apiMessage)
      refreshAllData()
    } finally {
      setRescheduleSubmitting(false)
    }
  }

  const handleMarkNoShow = async (record) => {
    const isAlreadyCheckedIn = record.status === 'CHECKED_IN' || queues.some((q) => String(q.patientId) === String(record.patientId) && ['WAITING', 'IN_PROGRESS', 'WAITING_FOR_RESULT'].includes(q.status))

    if (isAlreadyCheckedIn) {
      message.error('Không thể đánh dấu: bệnh nhân đã được tiếp nhận trước đó.')
      return
    }

    const timeVal = record.appointmentAt || record.startTime || record.date
    const appTime = dayjs(timeVal)
    const isOverdue15Min = appTime.isValid() && dayjs().isAfter(appTime.add(15, 'minute'))

    if (!isOverdue15Min) {
      message.warning('Chưa đủ điều kiện: Chỉ được đánh dấu KHÔNG ĐẾN khi bệnh nhân quá 15 phút so với giờ hẹn!')
      return
    }

    const pInfo = getPatientInfo(record.patientId, record.patientName)
    Modal.confirm({
      title: 'Xác nhận đánh dấu Bệnh nhân KHÔNG ĐẾN?',
      content: `Bệnh nhân ${pInfo.name} (${record.appointmentCode}) đã quá 15 phút so với giờ hẹn (${appTime.format('HH:mm DD/MM/YYYY')}) mà chưa đến tiếp nhận. Bạn có muốn chuyển lịch sang trạng thái KHÔNG ĐẾN?`,
      okText: 'Xác nhận Đánh dấu Không Đến',
      okType: 'danger',
      cancelText: 'Hủy',
      onOk: async () => {
        setActionLoading(true)
        try {
          await appointmentApi.noShow(record.id)
          saveAppointmentLog({
            appointmentId: record.id,
            appointmentCode: record.appointmentCode,
            action: 'NO_SHOW',
            operatorName: user?.fullName || user?.username || 'Lễ tân',
            details: `Đánh dấu bệnh nhân không đến (Đã quá 15 phút so với giờ hẹn ${appTime.format('HH:mm DD/MM/YYYY')}).`,
          })

          message.success('Lịch hẹn đã chuyển sang trạng thái KHÔNG ĐẾN')
          refreshAllData()
        } catch {
          message.error('Không thể đánh dấu không đến')
        } finally {
          setActionLoading(false)
        }
      },
    })
  }

  const handleConfirmAppointment = (record) => {
    const confirmCheck = canConfirmAppointment(record, dayjs())
    if (!confirmCheck.allowed) {
      message.warning(confirmCheck.reason)
      return
    }

    const pInfo = getPatientInfo(record.patientId, record.patientName)
    const dInfo = getDoctorInfo(record.doctorId, record.doctorName, record.department)
    const timeVal = record.appointmentAt || record.startTime || record.date
    const appTime = dayjs(timeVal)

    Modal.confirm({
      title: 'Xác nhận lịch hẹn khám',
      icon: <CheckCircleOutlined style={{ color: '#16a34a' }} />,
      content: (
        <div>
          <Paragraph style={{ marginBottom: 6 }}>
            Bệnh nhân: <strong>{pInfo.name}</strong> ({record.appointmentCode})
          </Paragraph>
          <Paragraph style={{ marginBottom: 6 }}>
            Bác sĩ phụ trách: <strong>{dInfo.name ? (dInfo.name.startsWith('BS.') || dInfo.name.startsWith('Dr.') ? dInfo.name : `BS. ${dInfo.name}`) : 'Chưa gán'}</strong>{' '}
            {dInfo.department && <Text type="secondary">({dInfo.department})</Text>}
          </Paragraph>
          <Paragraph type="secondary" style={{ fontSize: 13, marginBottom: 0 }}>
            Khung giờ hẹn:{' '}
            <strong style={{ color: '#0f172a' }}>
              {appTime.isValid() ? appTime.format('HH:mm - DD/MM/YYYY') : 'Trong ngày'}
            </strong>
          </Paragraph>
        </div>
      ),
      okText: 'Xác nhận đến khám',
      okButtonProps: { style: { backgroundColor: '#16a34a', borderColor: '#16a34a' } },
      cancelText: 'Đóng',
      onOk: async () => {
        setActionLoading(true)
        try {
          await appointmentApi.confirm(record.id)
          saveAppointmentLog({
            appointmentId: record.id,
            appointmentCode: record.appointmentCode,
            action: 'CONFIRM',
            operatorName: user?.fullName || user?.username || 'Lễ tân',
            details: `Xác nhận lịch hẹn cho bệnh nhân ${pInfo.name} (${record.appointmentCode}).`,
          })
          message.success(`Đã xác nhận lịch hẹn của bệnh nhân ${pInfo.name} thành công!`)
          await refreshAllData()
        } catch (err) {
          handleQueueApiError(err, 'Không thể xác nhận lịch hẹn')
        } finally {
          setActionLoading(false)
        }
      },
    })
  }

  const handleCheckInAppointment = async (appId) => {
    const app = appointments.find((a) => String(a.id) === String(appId))
    const isAlreadyInQueue = queues.some((q) => isSamePatient(q.patientId, app?.patientId) && ['WAITING', 'IN_PROGRESS', 'WAITING_FOR_RESULT'].includes(q.status))

    if (isAlreadyInQueue) {
      message.warning('Bệnh nhân này hiện đã có một lượt khám hoặc đang ở trong hàng đợi khám, hệ thống không thêm trùng!')
      return
    }

    setActionLoading(true)
    try {
      const pInfo = getPatientInfo(app?.patientId, app?.patientName)
      const dInfo = getDoctorInfo(app?.doctorId, app?.doctorName, app?.department)
      const res = await queueApi.checkInAppointment(appId)
      const backendItem = normalizeQueueItem(res?.data)
      if (!backendItem.id || !backendItem.visitId) {
        throw new Error('Backend did not return queueItemId and visitId after check-in.')
      }

      const newQueueItem = {
        ...backendItem,
        id: backendItem.id,
        patientId: backendItem.patientId || app?.patientId,
        patientCode: pInfo.code,
        patientName: backendItem.patientName || pInfo.name,
        phone: pInfo.phone,
        doctorId: backendItem.doctorId || app?.doctorId,
        doctorName: backendItem.doctorName || dInfo.name,
        department: dInfo.department,
        roomName: backendItem.roomName || 'Phòng khám',
        sourceType: backendItem.sourceType || 'APPOINTMENT',
      }
      saveStoredQueueItem(newQueueItem)
      setQueues((prev) => replaceQueueItem(prev, newQueueItem))

      saveAppointmentLog({
        appointmentId: appId,
        appointmentCode: app?.appointmentCode || '',
        action: 'CHECK_IN',
        operatorName: user?.fullName || user?.username || 'Lễ tân',
        details: `Tiếp nhận bệnh nhân ${pInfo.name} và đưa vào hàng đợi khám.`,
      })

      message.success(`Đã Check-in thành công cho bệnh nhân ${pInfo.name}! Bệnh nhân đã xuất hiện trong Hàng Đợi Khám.`)
      await refreshAllData()
    } catch (err) {
      handleQueueApiError(err, 'Không thể tiếp nhận lịch hẹn')
    } finally {
      setActionLoading(false)
    }
  }

  const handleCheckInWalkInSubmit = async (values) => {
    const isAlreadyInQueue = queues.some((q) => isSamePatient(q.patientId, values.patientId) && ['WAITING', 'IN_PROGRESS', 'WAITING_FOR_RESULT'].includes(q.status))

    if (isAlreadyInQueue) {
      message.warning('Bệnh nhân này hiện đã có một lượt khám hoặc đang ở trong hàng đợi khám, hệ thống không thêm trùng!')
      return
    }

    setActionLoading(true)
    try {
      const payload = {
        patientId: values.patientId,
        doctorId: values.doctorId,
        reason: values.reason || 'Khám Walk-in',
        note: values.notes || '',
      }

      const apiRes = await queueApi.checkInWalkIn(payload)
      const backendItem = normalizeQueueItem(apiRes?.data)
      if (!backendItem.id || !backendItem.visitId) {
        throw new Error('Backend did not return queueItemId and visitId after walk-in check-in.')
      }

      const pInfo = getPatientInfo(values.patientId)
      const dInfo = getDoctorInfo(values.doctorId)

      const walkInQueueItem = {
        ...backendItem,
        id: backendItem.id,
        patientId: backendItem.patientId || values.patientId,
        patientCode: pInfo.code,
        patientName: backendItem.patientName || pInfo.name,
        phone: pInfo.phone || '',
        doctorId: backendItem.doctorId || values.doctorId,
        doctorName: backendItem.doctorName || dInfo.name,
        department: dInfo.department,
        roomName: backendItem.roomName || 'Phòng khám',
        sourceType: backendItem.sourceType || 'WALK_IN',
      }
      saveStoredQueueItem(walkInQueueItem)
      setQueues((prev) => replaceQueueItem(prev, walkInQueueItem))

      saveAppointmentLog({
        appointmentId: backendItem.appointmentId || backendItem.id,
        appointmentCode: backendItem.visitCode,
        action: 'WALK_IN_CHECKIN',
        operatorName: user?.fullName || user?.username || 'Lễ tân',
        details: `Tiếp nhận Walk-in bệnh nhân ${pInfo.name} -> Tạo lượt khám ${backendItem.visitCode} & đưa vào Hàng đợi khám.`,
      })

      message.success(`Đã tiếp nhận bệnh nhân ${pInfo.name} vào lượt khám ${backendItem.visitCode}.`)
      setWalkInModalOpen(false)
      walkInForm.resetFields()
      await refreshAllData()
    } catch (err) {
      handleQueueApiError(err, 'Không thể tiếp nhận bệnh nhân tự đến')
    } finally {
      setActionLoading(false)
    }
  }

  const handleCallNext = async (queueId) => {
    const myQueueList = permissions.isDoctorOnly
      ? (Array.isArray(myQueueData) ? myQueueData : myQueueData?.items || myQueueData?.content) || queues.filter((q) => String(q.doctorId) === String(user?.id))
      : (queueDoctorFilter === 'ALL' ? queues : queues.filter((q) => String(q.doctorId) === String(queueDoctorFilter) || String(q.doctorName) === String(queueDoctorFilter)))
    const waitingItems = queues.filter((q) => q.status === 'WAITING')
    const myWaiting = myQueueList.filter((q) => q.status === 'WAITING')

    if (waitingItems.length === 0 && myWaiting.length === 0) {
      message.warning('Hàng đợi hiện chưa có bệnh nhân. Vui lòng tiếp nhận bệnh nhân trước khi gọi khám.')
      return
    }

    setActionLoading(true)
    try {
      const targetItem = myWaiting[0] || waitingItems[0] || myQueueList[0] || queues[0]
      const qId = queueId || myQueueData?.id || myQueueList[0]?.medicalQueueId || targetItem?.medicalQueueId || targetItem?.queueId
      if (!qId) {
        throw new Error('Không xác định được hàng đợi cần gọi.')
      }

      const response = await queueApi.callNext(qId)
      const calledItem = normalizeQueueItem(response?.data)
      if (!calledItem.id) {
        throw new Error('Backend did not return the called queue item.')
      }

      setQueues((prev) => replaceQueueItem(prev, calledItem))
      setMyQueueData((prev) => replaceQueueItem(prev, calledItem))
      saveStoredQueueItem(calledItem)
      const pInfo = getPatientInfo(calledItem.patientId, calledItem.patientName)
      message.info({
        content: `🔊 THÔNG BÁO GỌI KHÁM: Bác sĩ gọi bệnh nhân ${pInfo.name} (STT: ${calledItem.queueNumber || 1}) vào khám!`,
        duration: 5,
      })
      await refreshAllData()
    } catch (err) {
      handleQueueApiError(err, 'Không thể gọi lượt khám tiếp theo')
    } finally {
      setActionLoading(false)
    }
  }

  const handleSendReminder = async (record) => {
    if (record.status === 'CANCELLED') {
      message.error('Hệ thống không gửi nhắc: Lịch hẹn đã ở trạng thái ĐÃ HỦY!')
      return
    }

    setActionLoading(true)
    try {
      const pInfo = getPatientInfo(record.patientId, record.patientName, record.patientCode, record.phone)
      const dInfo = getDoctorInfo(record.doctorId, record.doctorName)
      const timeVal = record.appointmentAt || record.startTime || record.date

      const msgText = `[Nhắc lịch hẹn] Kính gửi bệnh nhân ${pInfo.name}, quý khách có lịch hẹn khám với ${dInfo.name} vào lúc ${timeVal ? dayjs(timeVal).format('HH:mm DD/MM/YYYY') : 'khung giờ hẹn'}. Vui lòng có mặt trước 15 phút.`

      await appointmentApi.sendReminder(record.id)

      saveNotificationLog({
        appointmentId: record.id,
        patientName: pInfo.name,
        phone: pInfo.phone || '',
        channel: 'SMS / Zalo / System',
        message: msgText,
        status: 'SENT',
      })

      message.success(`Đã gửi nhắc lịch hẹn cho bệnh nhân ${pInfo.name}!`)
      loadLogs()
    } catch {
      message.error('Không thể gửi nhắc lịch hẹn!')
    } finally {
      setActionLoading(false)
    }
  }

  const handleQuickRegisterPatientSubmit = async (values) => {
    setQuickPatientSaving(true)
    try {
      const payload = {
        fullName: values.fullName,
        phone: values.phone,
        gender: values.gender,
        dateOfBirth: values.dateOfBirth.format('YYYY-MM-DD'),
        address: values.address || '',
        consentAgreed: values.consentAgreed ?? true,
        consentVersion: 'v1.0',
      }

      const response = await patientApi.create(payload)
      const created = response.data
      if (!created?.id || !created?.patientCode) {
        throw new Error('Backend không trả id và patientCode của bệnh nhân.')
      }

      setPatients((prev) => [created, ...prev.filter((patient) => patient.id !== created.id)])
      message.success(`Đã đăng ký bệnh nhân mới thành công: ${created.fullName} (${created.patientCode})`)

      if (bookModalOpen) {
        bookForm.setFieldsValue({ patientId: created.id })
      }
      if (walkInModalOpen) {
        walkInForm.setFieldsValue({ patientId: created.id })
      }
      setQuickPatientModalOpen(false)
      quickPatientForm.resetFields()
    } catch {
      message.error('Không thể tạo bệnh nhân mới!')
    } finally {
      setQuickPatientSaving(false)
    }
  }

  const handleDeferSubmit = async (values) => {
    if (!skipModalItem) return
    const evalRes = evaluateDeferAction(skipModalItem, permissions)
    if (!evalRes.allowed) {
      message.error(evalRes.message)
      return
    }

    setActionLoading(true)
    const reason = values.reason || 'Vắng mặt khi gọi lượt khám'
    try {
      const response = await queueApi.skip(skipModalItem.id, reason)
      const updatedItem = normalizeQueueItem(response?.data)
      if (!updatedItem.id) {
        throw new Error('Backend did not return the skipped queue item.')
      }

      setQueues((prev) => replaceQueueItem(prev, updatedItem))
      setMyQueueData((prev) => replaceQueueItem(prev, updatedItem))
      saveStoredQueueItem(updatedItem)

      const pInfo = getPatientInfo(skipModalItem.patientId, skipModalItem.patientName)
      saveAppointmentLog({
        appointmentId: updatedItem.appointmentId || updatedItem.id,
        appointmentCode: updatedItem.visitCode || 'VIS-QUEUE',
        action: 'QUEUE_DEFER',
        operatorName: user?.fullName || user?.username || 'Lễ tân',
        details: `Tạm hoãn bệnh nhân ${pInfo.name} (STT #${skipModalItem.queueNumber || 1}). Lý do: ${reason}. Số lần gọi: ${updatedItem.callCount || 1}`,
      })

      message.success(`Đã tạm hoãn bệnh nhân ${pInfo.name}. Hàng đợi sẵn sàng gọi lượt tiếp theo.`)
      setSkipModalItem(null)
      await refreshAllData()
    } catch (err) {
      const errorMsg = cleanQueueActionErrorMessage(err, 'Không thể thực hiện tạm hoãn lượt khám.')
      message.error(errorMsg)
    } finally {
      setActionLoading(false)
    }
  }

  const handleReQueue = async (item) => {
    if (!item) return
    const evalRes = evaluateReQueueAction(item, permissions)
    if (!evalRes.allowed) {
      message.error(evalRes.message)
      return
    }

    const pInfo = getPatientInfo(item.patientId, item.patientName)
    setReQueuingId(item.id)
    try {
      const response = await queueApi.reQueue(item.id)
      const updatedItem = normalizeQueueItem(response?.data)
      if (!updatedItem.id) {
        throw new Error('Backend did not return the re-queued queue item.')
      }

      setQueues((prev) => replaceQueueItem(prev, updatedItem))
      setMyQueueData((prev) => replaceQueueItem(prev, updatedItem))
      saveStoredQueueItem(updatedItem)

      saveAppointmentLog({
        appointmentId: updatedItem.appointmentId || updatedItem.id,
        appointmentCode: updatedItem.visitCode || 'VIS-QUEUE',
        action: 'QUEUE_RE_QUEUE',
        operatorName: user?.fullName || user?.username || 'Lễ tân',
        details: `Đưa bệnh nhân ${pInfo.name} (STT #${item.queueNumber || 1}) trở lại hàng đợi khám (Đang chờ). Số lần gọi bảo toàn: ${updatedItem.callCount || 0}`,
      })

      message.success(`Đã đưa bệnh nhân ${pInfo.name} trở lại hàng đợi khám thành công.`)
      await refreshAllData()
    } catch (err) {
      const errorMsg = cleanQueueActionErrorMessage(err, 'Không thể đưa bệnh nhân trở lại hàng đợi.')
      message.error(errorMsg)
    } finally {
      setReQueuingId(null)
    }
  }

  const handleUpdateItemStatus = async (itemId, newStatus) => {
    setActionLoading(true)
    try {
      const response = await queueApi.updateStatus(itemId, newStatus)
      const updatedItem = normalizeQueueItem(response?.data)
      if (!updatedItem.id) {
        throw new Error('Backend did not return the updated queue item.')
      }

      setQueues((prev) => replaceQueueItem(prev, updatedItem))
      setMyQueueData((prev) => replaceQueueItem(prev, updatedItem))
      saveStoredQueueItem(updatedItem)
      await refreshAllData()
    } catch (err) {
      const targetStatusLabel = QUEUE_STATUS_META[newStatus]?.label || 'trạng thái được yêu cầu'
      handleQueueApiError(err, `Không thể chuyển lượt khám sang ${targetStatusLabel}`)
    } finally {
      setActionLoading(false)
    }
  }

  const openEncounter = (item) => {
    if (!item?.visitId) {
      message.error('Lượt khám chưa có visitId từ backend.')
      return
    }
    navigate(`/medical-records/visits/${item.visitId}`, {
      state: {
        patientId: item.patientId,
        visitId: item.visitId,
        queueItemId: item.id,
      },
    })
  }

  const handleCompleteItem = async (itemId) => {
    setActionLoading(true)
    try {
      const response = await queueApi.complete(itemId)
      const completedItem = normalizeQueueItem(response?.data)
      if (!completedItem.id) {
        throw new Error('Backend did not return the completed queue item.')
      }

      setQueues((prev) => replaceQueueItem(prev, completedItem))
      setMyQueueData((prev) => replaceQueueItem(prev, completedItem))
      saveStoredQueueItem(completedItem)

      message.success('Đã hoàn tất chu trình khám bệnh cho bệnh nhân.')
      await refreshAllData()
    } catch (err) {
      handleQueueApiError(err, 'Bệnh án chưa được khóa hoặc sai chu trình khám.')
    } finally {
      setActionLoading(false)
    }
  }

  const handleOpenAppointmentDetail = useCallback(async (record, pInfoParam, dInfoParam) => {
    const pInfo = pInfoParam || getPatientInfo(record.patientId, record.patientName, record.patientCode, record.phone)
    const dInfo = dInfoParam || getDoctorInfo(record.doctorId, record.doctorName, record.department)
    setDetailItem({
      type: 'appointment',
      ...record,
      patientName: pInfo.name,
      doctorName: dInfo.name,
      department: dInfo.department,
    })
    if (record.id) {
      try {
        const res = await appointmentApi.getById(record.id)
        const data = res?.data || res
        if (data) {
          setDetailItem((prev) => ({
            ...prev,
            ...data,
            patientName: pInfo.name,
            doctorName: dInfo.name,
            department: dInfo.department,
          }))
        }
      } catch (err) {
        console.error('Failed to load full appointment detail:', err)
      }
    }
  }, [getPatientInfo, getDoctorInfo])

  const handleOpenQueueDetail = useCallback((record, pInfoParam, dInfoParam) => {
    const pInfo = pInfoParam || getPatientInfo(record.patientId, record.patientName)
    const dInfo = dInfoParam || getDoctorInfo(record.doctorId, record.doctorName)
    setDetailItem({
      type: 'queue',
      ...record,
      patientName: pInfo.name,
      doctorName: dInfo.name,
    })
  }, [getPatientInfo, getDoctorInfo])

  const appointmentColumns = useMemo(
    () =>
      getAppointmentColumns({
        getPatientInfo,
        getDoctorInfo,
        permissions,
        user,
        onOpenDetail: handleOpenAppointmentDetail,
        onConfirm: handleConfirmAppointment,
        onCheckIn: handleCheckInAppointment,
        onReschedule: handleOpenRescheduleModal,
        onRemind: handleSendReminder,
        onMarkNoShow: handleMarkNoShow,
        onCancel: (record) => {
          cancelForm.setFieldsValue({ reason: 'Bệnh nhân báo bận' })
          setCancelModalItem(record)
        },
      }),
    [
      getPatientInfo,
      getDoctorInfo,
      permissions,
      user,
      handleOpenAppointmentDetail,
      handleConfirmAppointment,
      handleCheckInAppointment,
      handleOpenRescheduleModal,
      handleSendReminder,
      handleMarkNoShow,
      cancelForm,
    ],
  )

  const queueBoardColumns = useMemo(
    () =>
      getQueueBoardColumns({
        getPatientInfo,
        getDoctorInfo,
        permissions,
        user,
        reQueuingId,
        onOpenDetail: handleOpenQueueDetail,
        onCallNext: (queueId) => handleCallNext(queueId),
        onUpdateStatus: handleUpdateItemStatus,
        onSkip: (record) => setSkipModalItem(record),
        onReQueue: (record) => handleReQueue(record),
        onOpenHistory: (record) => setHistoryQueueItem(record),
        onCloseVisit: (record) => {
          const pInfo = getPatientInfo(record.patientId, record.patientName, record.patientCode, record.phone)
          setCloseVisitModalItem({
            ...record,
            patientName: pInfo.name,
            patientCode: pInfo.code,
          })
        },
        onPrioritize: (record) => {
          const pInfo = getPatientInfo(record.patientId, record.patientName, record.patientCode, record.phone)
          const dInfo = getDoctorInfo(record.doctorId, record.doctorName, record.department)
          setPrioritizeModalItem({
            ...record,
            patientName: pInfo.name,
            patientCode: pInfo.code,
            doctorName: dInfo.name,
          })
        },
      }),
    [
      getPatientInfo,
      getDoctorInfo,
      permissions,
      user,
      reQueuingId,
      handleOpenQueueDetail,
      handleCallNext,
      handleUpdateItemStatus,
      handleReQueue,
    ],
  )

  return (
    <div style={{ padding: 24, maxWidth: 1400, margin: '0 auto' }}>
      <style>{`
        .queue-row-emergency {
          background-color: #fff1f2 !important;
          font-weight: 500;
        }
        .queue-row-emergency:hover > td {
          background-color: #ffe4e6 !important;
        }
        .queue-row-priority {
          background-color: #fffbeb !important;
        }
        .queue-row-priority:hover > td {
          background-color: #fef3c7 !important;
        }
      `}</style>
      <Card style={{ marginBottom: 24, borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
        <Row justify="space-between" align="middle" gutter={[16, 16]}>
          <Col>
            <Space align="center" size="middle">
              <Avatar size={48} icon={<CalendarOutlined />} style={{ backgroundColor: '#2563eb' }} />
              <div>
                <Title level={4} style={{ margin: 0 }}>Quản Lý Lịch Hẹn & Hàng Đợi Khám Bệnh</Title>
              </div>
            </Space>
          </Col>
          <Col>
            <Space wrap>
              <DatePicker
                value={selectedDate}
                onChange={(date) => date && setSelectedDate(date)}
                format="DD/MM/YYYY"
                allowClear={false}
              />
              <Button icon={<ReloadOutlined />} onClick={refreshAllData} loading={loading}>
                Làm mới
              </Button>
              <Button icon={<HistoryOutlined />} onClick={() => setLogsDrawerOpen(true)}>
                Nhật ký & Thông báo
              </Button>
              <Tooltip title="Mở màn hình công cộng hiển thị số thứ tự sảnh chờ (Kiosk / Smart TV)">
                <Button
                  icon={<DesktopOutlined />}
                  onClick={() => window.open('/display/waiting-room', '_blank')}
                >
                  Màn hình sảnh chờ
                </Button>
              </Tooltip>
              {permissions.canCreateAppointment && (
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={() => setBookModalOpen(true)}
                  style={{ backgroundColor: '#2563eb' }}
                >
                  + Đặt lịch hẹn mới
                </Button>
              )}
              {permissions.canManageWalkIn && (
                <Button
                  type="primary"
                  icon={<UserAddOutlined />}
                  onClick={() => setWalkInModalOpen(true)}
                  style={{ backgroundColor: '#16a34a', borderColor: '#16a34a' }}
                >
                  + Tiếp nhận tự đến
                </Button>
              )}
            </Space>
          </Col>
        </Row>
      </Card>

      <Tabs
          activeKey={activeMainTab}
          onChange={setActiveMainTab}
          type="card"
          items={[
          {
            key: 'appointments',
            label: (
              <span>
                <CalendarOutlined /> Danh sách Lịch Hẹn ({filteredAppointments.length})
              </span>
            ),
            children: (
              <Card style={{ borderRadius: 12 }}>
                <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
                  <Col xs={24} sm={8} md={6}>
                    <Input
                      placeholder="Tìm mã LH, tên bệnh nhân..."
                      prefix={<SearchOutlined />}
                      value={appKeyword}
                      onChange={(e) => setAppKeyword(e.target.value)}
                      allowClear
                    />
                  </Col>
                  <Col xs={12} sm={8} md={6}>
                    <Select
                      style={{ width: '100%' }}
                      value={appDoctorFilter}
                      onChange={setAppDoctorFilter}
                      options={
                        permissions.isDoctorOnly
                          ? [{ value: 'ALL', label: `Bác sĩ: ${user?.fullName || user?.username || 'Bạn'}` }]
                          : [
                            { value: 'ALL', label: 'Tất cả Bác sĩ' },
                            ...doctorList.map((d) => ({ value: d.id, label: d.fullName || d.username })),
                          ]
                      }
                      disabled={permissions.isDoctorOnly}
                    />
                  </Col>
                  <Col xs={12} sm={8} md={6}>
                    <Select
                      style={{ width: '100%' }}
                      value={appStatusFilter}
                      onChange={setAppStatusFilter}
                      options={[
                        { value: 'ALL', label: 'Tất cả trạng thái' },
                        { value: 'SCHEDULED', label: 'Đã đặt hẹn' },
                        { value: 'CONFIRMED', label: 'Đã xác nhận' },
                        { value: 'CHECKED_IN', label: 'Đã tiếp nhận' },
                        { value: 'NO_SHOW', label: 'Không đến khám' },
                        { value: 'COMPLETED', label: 'Đã hoàn thành' },
                        { value: 'CANCELLED', label: 'Đã hủy' },
                      ]}
                    />
                  </Col>
                  <Col xs={24} sm={24} md={6} style={{ textAlign: 'right' }}>
                    {permissions.canConfirmAppointment && (
                      <Badge count={unconfirmedTodayCount} offset={[-4, 4]}>
                        <Button
                          icon={<BellOutlined />}
                          style={{
                            borderColor: unconfirmedTodayCount > 0 ? '#eab308' : undefined,
                            color: unconfirmedTodayCount > 0 ? '#ca8a04' : undefined,
                          }}
                          onClick={() => setUnconfirmedDrawerOpen(true)}
                        >
                          Lịch chưa xác nhận
                        </Button>
                      </Badge>
                    )}
                  </Col>
                </Row>

                <Table
                  dataSource={filteredAppointments}
                  columns={appointmentColumns}
                  rowKey="id"
                  loading={loading}
                  pagination={{ pageSize: 10, showSizeChanger: true }}
                  scroll={{ x: 960 }}
                />
              </Card>
            ),
          },
          ...(!permissions.isDoctorOnly
            ? [
                {
                  key: 'doctor_weekly_table',
                  label: (
                    <span>
                      <TableOutlined /> Lịch tuần bác sĩ (bảng)
                    </span>
                  ),
                  children: (
                    <DoctorWeeklyScheduleTable
                      onAppointmentBooked={() => {
                        refreshAllData()
                      }}
                    />
                  ),
                },
              ]
            : []),
          {
            key: 'reception_queue',
            label: (
              <span>
                <TeamOutlined /> Hàng Đợi Khám (Lễ Tân) ({filteredQueues.length})
              </span>
            ),
            children: (
              <Card style={{ borderRadius: 12 }}>
                <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
                  <Col xs={24} sm={6} md={5}>
                    <Input
                      placeholder="Tìm tên, mã BN, mã lượt..."
                      prefix={<SearchOutlined />}
                      value={queueKeyword}
                      onChange={(e) => setQueueKeyword(e.target.value)}
                      allowClear
                    />
                  </Col>
                  <Col xs={12} sm={6} md={4}>
                    <Select
                      style={{ width: '100%' }}
                      value={queueDoctorFilter}
                      onChange={setQueueDoctorFilter}
                      options={
                        permissions.isDoctorOnly
                          ? [{ value: 'ALL', label: `Bác sĩ: ${user?.fullName || user?.username || 'Bạn'}` }]
                          : [
                            { value: 'ALL', label: 'Tất cả Bác sĩ' },
                            ...doctorList.map((d) => ({ value: d.id, label: d.fullName || d.username })),
                          ]
                      }
                      disabled={permissions.isDoctorOnly}
                    />
                  </Col>
                  <Col xs={12} sm={6} md={4}>
                    <Select
                      style={{ width: '100%' }}
                      value={queueRoomFilter}
                      onChange={setQueueRoomFilter}
                      options={[
                        { value: 'ALL', label: 'Tất cả Phòng khám' },
                        ...extractedRooms.map((r) => ({ value: r.id, label: `${r.code} - ${r.name}` })),
                      ]}
                    />
                  </Col>
                  <Col xs={12} sm={6} md={4}>
                    <Select
                      style={{ width: '100%' }}
                      value={queueStatusFilter}
                      onChange={setQueueStatusFilter}
                      options={[
                        { value: 'ALL', label: 'Tất cả Trạng thái' },
                        { value: 'WAITING', label: 'Chờ khám' },
                        { value: 'IN_PROGRESS', label: 'Đang khám' },
                        { value: 'WAITING_FOR_RESULT', label: 'Chờ kết quả CĐLS' },
                        { value: 'COMPLETED', label: 'Đã hoàn thành' },
                        { value: 'SKIPPED', label: 'Đã bỏ qua (Vắng mặt)' },
                        { value: 'CANCELLED', label: 'Đã hủy' },
                        { value: 'EARLY_ENDED', label: 'Kết thúc sớm' },
                      ]}
                    />
                  </Col>
                  <Col xs={12} sm={6} md={4}>
                    <Select
                      style={{ width: '100%' }}
                      value={queueSourceFilter}
                      onChange={setQueueSourceFilter}
                      options={[
                        { value: 'ALL', label: 'Tất cả Nguồn' },
                        { value: 'APPOINTMENT', label: 'Hẹn trước' },
                        { value: 'WALK_IN', label: 'Bệnh nhân tự đến' },
                        { value: 'APPOINTMENT', label: 'Hẹn trước' },
                        { value: 'WALK_IN', label: 'Bệnh nhân tự đến' },
                      ]}
                    />
                  </Col>
                  <Col xs={24} sm={24} md={3} style={{ textAlign: 'right' }}>
                    {permissions.canCallNext && (
                      <Button
                        type="primary"
                        icon={<StepForwardOutlined />}
                        loading={actionLoading}
                        onClick={() => handleCallNext()}
                      >
                        Gọi tiếp
                      </Button>
                    )}
                  </Col>
                </Row>

                {filteredQueues.length === 0 ? (
                  <Empty
                    description="Hàng đợi hiện đang trống. Bệnh nhân sau khi tiếp nhận sẽ xuất hiện tại đây theo thứ tự."
                    style={{ margin: '40px 0' }}
                  />
                ) : (
                  <Table
                    dataSource={filteredQueues}
                    columns={queueBoardColumns}
                    rowKey="id"
                    loading={loading}
                    pagination={{ pageSize: 10, showSizeChanger: true }}
                    scroll={{ x: 1080 }}
                    rowClassName={(record) =>
                      record.priority === 'EMERGENCY'
                        ? 'queue-row-emergency'
                        : record.priority === 'PRIORITY'
                        ? 'queue-row-priority'
                        : ''
                    }
                  />
                )}
              </Card>
            ),
          },
          {
            key: 'doctor_queue',
            label: (
              <span>
                <UserSwitchOutlined /> Hàng Đợi Khám Phòng Bác Sĩ
              </span>
            ),
            children: (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {!permissions.isDoctorOnly && (
                  <Card style={{ borderRadius: 12, backgroundColor: '#f8fafc', borderColor: '#e2e8f0' }} bodyStyle={{ padding: 12 }}>
                    <Row gutter={[16, 16]} align="middle">
                      <Col xs={24} sm={12} md={8}>
                        <Text strong style={{ marginRight: 8 }}>Bác sĩ phụ trách (Hôm nay):</Text>
                        <Select
                          style={{ width: '220px' }}
                          value={queueDoctorFilter}
                          onChange={setQueueDoctorFilter}
                          options={[
                            { value: 'ALL', label: 'Tất cả Bác sĩ (Hôm nay)' },
                            ...doctorList.map((d) => ({ value: d.id, label: d.fullName || d.username })),
                          ]}
                        />
                      </Col>
                      <Col xs={24} sm={12} md={16}>
                        <Text type="secondary">Quản trị viên và lễ tân có thể xem toàn bộ bệnh nhân hoặc lọc theo bác sĩ phụ trách.</Text>
                      </Col>
                    </Row>
                  </Card>
                )}
                {doctorQueueGroups.handedOverToMe?.length > 0 && (
                  <Alert
                    type="info"
                    showIcon
                    icon={<SwapOutlined style={{ fontSize: 20, color: '#0284c7' }} />}
                    message={
                      <b style={{ fontSize: 14 }}>
                        Bạn có {doctorQueueGroups.handedOverToMe.length} ca khám được bàn giao từ bác sĩ khác
                      </b>
                    }
                    description={
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                        {doctorQueueGroups.handedOverToMe.map((item) => (
                          <div
                            key={item.id}
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              background: '#ffffff',
                              padding: '10px 14px',
                              borderRadius: 8,
                              border: '1px solid #bae6fd',
                              boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                            }}
                          >
                            <div>
                              <Text strong style={{ fontSize: 15, color: '#0369a1' }}>
                                {item.patientName}
                              </Text>
                              {item.patientCode && (
                                <Tag color="geekblue" style={{ marginLeft: 8, fontFamily: 'monospace' }}>
                                  {item.patientCode}
                                </Tag>
                              )}
                              <span style={{ color: '#475569', fontSize: 13, marginLeft: 12 }}>
                                Bàn giao từ BS: <b>{item.fromDoctorName || 'Đồng nghiệp'}</b>
                                {item.handoverReason && <i> (Lý do: "{item.handoverReason}")</i>}
                              </span>
                            </div>
                            <Button
                              type="primary"
                              icon={<MedicineBoxOutlined />}
                              onClick={() => openEncounter(item)}
                              style={{
                                background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                                borderColor: '#0284c7',
                                fontWeight: 600,
                              }}
                            >
                              Vào khám ngay
                            </Button>
                          </div>
                        ))}
                      </div>
                    }
                    style={{
                      borderRadius: 10,
                      borderColor: '#bae6fd',
                      background: '#f0f9ff',
                    }}
                  />
                )}
                <InProgressPatientList
                  items={doctorQueueGroups.inProgress}
                  getPatientInfo={getPatientInfo}
                  permissions={permissions}
                  onOpenEncounter={openEncounter}
                  onOpenHistory={openPatientHistory}
                  onUpdateStatus={handleUpdateItemStatus}
                  onComplete={handleCompleteItem}
                  onSkip={(item) => setSkipModalItem(item)}
                  onCloseVisit={(item) => {
                    const pInfo = getPatientInfo(item.patientId, item.patientName, item.patientCode, item.phone)
                    setCloseVisitModalItem({
                      ...item,
                      patientName: pInfo.name,
                      patientCode: pInfo.code,
                    })
                  }}
                  onOpenQueueHistory={(item) => setHistoryQueueItem(item)}
                />

                <WaitingPatientList
                  items={doctorQueueGroups.waiting}
                  getPatientInfo={getPatientInfo}
                  permissions={permissions}
                  onCallNext={(queueId) => handleCallNext(queueId)}
                  onOpenHistory={openPatientHistory}
                />

                <WaitingForResultList
                  items={doctorQueueGroups.waitingForResult}
                  getPatientInfo={getPatientInfo}
                  permissions={permissions}
                  onUpdateStatus={handleUpdateItemStatus}
                  onOpenEncounter={openEncounter}
                  onOpenHistory={openPatientHistory}
                />

                {/* Khối Bệnh nhân tạm hoãn (vắng mặt khi gọi) */}
                <Card
                  title={
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                      <Text strong style={{ color: '#d97706' }}>
                        🟠 BỆNH NHÂN TẠM HOÃN ({doctorQueueGroups.skipped.length})
                      </Text>
                      <Tag color="warning" style={{ margin: 0, fontWeight: 600 }}>
                        Vắng mặt khi gọi
                      </Tag>
                    </div>
                  }
                  style={{ borderRadius: 12, borderColor: '#fed7aa', backgroundColor: '#fffdfa' }}
                >
                  {doctorQueueGroups.skipped.length === 0 ? (
                    <div style={{ padding: '16px 0', textAlign: 'center' }}>
                      <Empty
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                        description={
                          <span style={{ color: '#64748b' }}>
                            Không có bệnh nhân nào đang tạm hoãn trong phòng khám này.
                          </span>
                        }
                      />
                    </div>
                  ) : (
                    <List
                      dataSource={doctorQueueGroups.skipped}
                      pagination={{ pageSize: 5 }}
                      renderItem={(item) => {
                        const pInfo = getPatientInfo(item.patientId, item.patientName)
                        return (
                          <List.Item
                            actions={[
                              (permissions.isAdmin || permissions.isReceptionist) && (
                                <Button
                                  key="requeue"
                                  type="primary"
                                  icon={<RedoOutlined />}
                                  style={{ backgroundColor: '#0284c7' }}
                                  loading={reQueuingId === item.id}
                                  onClick={() => handleReQueue(item)}
                                >
                                  Đưa lại vào hàng đợi
                                </Button>
                              ),
                              <Button
                                key="history-queue"
                                icon={<HistoryOutlined />}
                                onClick={() => setHistoryQueueItem(item)}
                              >
                                Lịch sử luân chuyển
                              </Button>,
                              <Button
                                key="history-patient"
                                icon={<HistoryOutlined />}
                                onClick={() => openPatientHistory(item.patientId, pInfo.name, pInfo.code)}
                              >
                                Lịch sử khám
                              </Button>,
                            ].filter(Boolean)}
                          >
                            <List.Item.Meta
                              avatar={
                                <Avatar
                                  size={44}
                                  style={{
                                    backgroundColor: '#f97316',
                                    fontWeight: 700,
                                    fontSize: 15,
                                    boxShadow: '0 2px 5px rgba(249, 115, 22, 0.2)',
                                  }}
                                >
                                  {getInitials(pInfo.name)}
                                </Avatar>
                              }
                              title={
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                  <Text strong style={{ fontSize: 15, color: '#0f172a' }}>
                                    {pInfo.name}
                                  </Text>
                                  {item.queueNumber && (
                                    <Tag
                                      color="orange"
                                      style={{
                                        fontWeight: 700,
                                        fontSize: 12,
                                        padding: '1px 8px',
                                        borderRadius: 4,
                                        margin: 0,
                                      }}
                                    >
                                      STT #{String(item.queueNumber).padStart(2, '0')}
                                    </Tag>
                                  )}
                                  <Tag color="orange" style={{ margin: 0, fontSize: 11, borderRadius: 4, fontWeight: 600 }}>
                                    Tạm hoãn
                                  </Tag>
                                  {Number(item.callCount) > 0 && (
                                    <Tag color="volcano" style={{ margin: 0, fontSize: 11, borderRadius: 4 }}>
                                      Đã gọi: {item.callCount} lần
                                    </Tag>
                                  )}
                                </div>
                              }
                              description={
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4, flexWrap: 'wrap', fontSize: 12 }}>
                                  <span style={{ color: '#64748b' }}>
                                    Mã lượt:{' '}
                                    <Tag
                                      style={{
                                        fontFamily: 'monospace',
                                        fontWeight: 600,
                                        fontSize: 11.5,
                                        color: '#1d4ed8',
                                        backgroundColor: '#eff6ff',
                                        borderColor: '#bfdbfe',
                                        borderRadius: 4,
                                        margin: 0,
                                        padding: '0 6px',
                                      }}
                                    >
                                      {formatVisitCode(item.visitCode, item.visitId)}
                                    </Tag>
                                  </span>
                                  {pInfo.code && pInfo.code !== '—' && (
                                    <span style={{ color: '#64748b' }}>
                                      Mã BN: <Text strong style={{ color: '#334155' }}>{pInfo.code}</Text>
                                    </span>
                                  )}
                                  {pInfo.phone && (
                                    <span style={{ color: '#64748b' }}>
                                      SĐT: <Text style={{ color: '#334155' }}>{pInfo.phone}</Text>
                                    </span>
                                  )}
                                  {item.skipReason && (
                                    <span style={{ color: '#c2410c' }}>
                                      Lý do hoãn: <strong>{item.skipReason}</strong>
                                    </span>
                                  )}
                                </div>
                              }
                            />
                          </List.Item>
                        )
                      }}
                    />
                  )}
                </Card>

                <CompletedTodayList
                  items={doctorQueueGroups.completed}
                  getPatientInfo={getPatientInfo}
                  permissions={permissions}
                  selectedDate={selectedDate}
                  onOpenEncounter={openEncounter}
                  onOpenHistory={openPatientHistory}
                />
              </div>
            ),
          },
          {
            key: 'completed_history',
            label: (
              <span>
                <HistoryOutlined /> Lịch Sử Bệnh Nhân Đã Khám / Kết Thúc ({doctorQueueGroups.finished.length})
              </span>
            ),
            children: (
              <Card style={{ borderRadius: 12 }}>
                <Row gutter={[16, 16]} style={{ marginBottom: 16 }} align="middle" justify="space-between">
                  <Col xs={24} sm={12} md={8}>
                    <Input
                      placeholder="Tìm theo tên bệnh nhân, mã BN, mã lượt, SĐT..."
                      prefix={<SearchOutlined />}
                      value={completedSearchKeyword}
                      onChange={(e) => setCompletedSearchKeyword(e.target.value)}
                      allowClear
                    />
                  </Col>
                  <Col xs={24} sm={12} md={12} style={{ textAlign: 'right' }}>
                    <Text type="secondary" style={{ fontSize: 13 }}>
                      Danh sách các ca khám đã hoàn thành hoặc kết thúc trong ngày <strong>{selectedDate.format('DD/MM/YYYY')}</strong>
                    </Text>
                  </Col>
                </Row>

                <Table
                  dataSource={doctorQueueGroups.finished.filter((item) => {
                    if (!completedSearchKeyword.trim()) return true
                    const kw = completedSearchKeyword.trim().toLowerCase()
                    const pInfo = getPatientInfo(item.patientId, item.patientName)
                    return (
                      pInfo.name.toLowerCase().includes(kw) ||
                      (pInfo.code && pInfo.code.toLowerCase().includes(kw)) ||
                      (item.visitCode && item.visitCode.toLowerCase().includes(kw)) ||
                      (pInfo.phone && pInfo.phone.includes(kw))
                    )
                  })}
                  columns={[
                    {
                      title: 'STT',
                      dataIndex: 'queueNumber',
                      key: 'queueNumber',
                      width: 80,
                      align: 'center',
                      render: (val) => (
                        <Tag color="green" style={{ fontWeight: 700 }}>
                          #{String(val || 1).padStart(2, '0')}
                        </Tag>
                      ),
                    },
                    {
                      title: 'Bệnh nhân',
                      key: 'patient',
                      render: (_, record) => {
                        const pInfo = getPatientInfo(record.patientId, record.patientName)
                        return (
                          <div>
                            <div style={{ fontWeight: 700, color: '#0f172a' }}>{pInfo.name}</div>
                            <div style={{ fontSize: 12, color: '#64748b' }}>
                              Mã BN: <strong style={{ color: '#334155' }}>{pInfo.code || '—'}</strong>
                              {pInfo.phone && ` • SĐT: ${pInfo.phone}`}
                            </div>
                          </div>
                        )
                      },
                    },
                    {
                      title: 'Mã lượt khám',
                      dataIndex: 'visitCode',
                      key: 'visitCode',
                      width: 140,
                      render: (val, record) => (
                        <Tag style={{ fontFamily: 'monospace', fontWeight: 600, color: '#1d4ed8', backgroundColor: '#eff6ff' }}>
                          {formatVisitCode(val, record.visitId)}
                        </Tag>
                      ),
                    },
                    {
                      title: 'Giờ tiếp nhận',
                      key: 'checkedInAt',
                      width: 130,
                      render: (_, record) => {
                        const time = record.checkedInAt || record.checked_in_at || record.startTime || record.appointmentAt || record.createdAt
                        return time ? (
                          <span style={{ color: '#334155', fontWeight: 500 }}>
                            {dayjs(time).format('HH:mm')}
                          </span>
                        ) : '—'
                      },
                    },
                    {
                      title: 'Giờ hoàn tất / kết thúc',
                      key: 'finishTime',
                      width: 150,
                      render: (_, record) => {
                        const time =
                          record.completedAt ||
                          record.cancelledAt ||
                          record.skippedAt ||
                          record.completed_at ||
                          record.cancelled_at ||
                          record.skipped_at ||
                          record.endTime ||
                          record.updatedAt ||
                          record.updated_at
                        if (!time) return '—'
                        const isCompleted = record.status === 'COMPLETED'
                        const isEarly = record.status === 'EARLY_ENDED'
                        const isCancelled = record.status === 'CANCELLED'
                        const color = isCompleted ? '#16a34a' : isEarly ? '#ea580c' : isCancelled ? '#dc2626' : '#64748b'
                        return (
                          <Tooltip title={`${isCompleted ? 'Hoàn tất lúc' : isEarly ? 'Kết thúc sớm lúc' : isCancelled ? 'Hủy lúc' : 'Thời gian'}: ${dayjs(time).format('HH:mm:ss DD/MM/YYYY')}`}>
                            <span style={{ color, fontWeight: 600 }}>
                              {dayjs(time).format('HH:mm')}
                            </span>
                          </Tooltip>
                        )
                      },
                    },
                    {
                      title: 'Trạng thái',
                      key: 'status',
                      width: 150,
                      render: (_, record) => {
                        if (record.status === 'EARLY_ENDED') {
                          return (
                            <Tag color="warning" style={{ fontWeight: 600 }}>
                              <StopOutlined style={{ marginRight: 4 }} />Kết thúc sớm
                            </Tag>
                          )
                        }
                        if (record.status === 'CANCELLED') {
                          return (
                            <Tag color="error" style={{ fontWeight: 600 }}>
                              <CloseCircleOutlined style={{ marginRight: 4 }} />Đã hủy
                            </Tag>
                          )
                        }
                        if (record.status === 'SKIPPED') {
                          return (
                            <Tag color="default" style={{ fontWeight: 600 }}>
                              Đã bỏ qua
                            </Tag>
                          )
                        }
                        return (
                          <Tag color="success" style={{ fontWeight: 600 }}>
                            <CheckCircleOutlined style={{ marginRight: 4 }} />Đã hoàn thành
                          </Tag>
                        )
                      },
                    },
                    {
                      title: 'Thao tác',
                      key: 'action',
                      width: 220,
                      align: 'center',
                      render: (_, record) => {
                        const pInfo = getPatientInfo(record.patientId, record.patientName)
                        return (
                          <Space size={6}>
                            <Button
                              size="small"
                              icon={<FileTextOutlined />}
                              onClick={() => openEncounter(record)}
                            >
                              Bệnh án
                            </Button>
                            <Button
                              size="small"
                              type="primary"
                              ghost
                              icon={<HistoryOutlined />}
                              onClick={() => openPatientHistory(record.patientId, pInfo.name, pInfo.code)}
                            >
                              Lịch sử khám
                            </Button>
                          </Space>
                        )
                      },
                    },
                  ]}
                  rowKey="id"
                  pagination={{ pageSize: 10, showSizeChanger: true }}
                  scroll={{ x: 960 }}
                />
              </Card>
            ),
          },
          {
            key: 'completed_history',
            label: (
              <span>
                <CheckCircleOutlined /> Lịch Sử Bệnh Nhân Đã Khám
              </span>
            ),
            children: (
              <CompletedTodayList
                items={doctorQueueGroups.completed}
                getPatientInfo={getPatientInfo}
                permissions={permissions}
                selectedDate={selectedDate}
                onOpenEncounter={openEncounter}
                onOpenHistory={openPatientHistory}
              />
            ),
          },
          ...(!permissions.isDoctorOnly
            ? [
                {
                  key: 'waitlist',
                  label: (
                    <span>
                      <ClockCircleOutlined /> Danh sách chờ lịch hẹn
                    </span>
                  ),
                  children: (
                    <AppointmentWaitlistPanel
                      doctorList={doctorList}
                      patients={patients}
                      onOpenDirectBooking={handleBookFromWaitlist}
                      permissions={permissions}
                    />
                  ),
                },
              ]
            : []),
        ].filter((item) => {
          if (permissions.isAdmin) return true
          if (permissions.isDoctor) return ['doctor_queue', 'completed_history'].includes(item.key) || item.key === 'waitlist'
          return ['appointments', 'reception_queue', 'waitlist'].includes(item.key)
        })}
      />

      <BookAppointmentModal
        open={bookModalOpen}
        onCancel={() => setBookModalOpen(false)}
        form={bookForm}
        onFinish={handleCreateAppointmentSubmit}
        patients={patients}
        doctorList={doctorList}
        actionLoading={actionLoading}
        onOpenQuickPatient={() => setQuickPatientModalOpen(true)}
        onOpenWaitlist={handleOpenAddToWaitlist}
      />

      <WalkInModal
        open={walkInModalOpen}
        onCancel={() => setWalkInModalOpen(false)}
        form={walkInForm}
        onFinish={handleCheckInWalkInSubmit}
        patients={patients}
        doctorList={doctorList}
        actionLoading={actionLoading}
        onOpenQuickPatient={() => setQuickPatientModalOpen(true)}
      />

      <CancelAppointmentModal
        open={!!cancelModalItem}
        onCancel={() => setCancelModalItem(null)}
        form={cancelForm}
        onFinish={handleCancelAppointmentSubmit}
        cancelModalItem={cancelModalItem}
        getPatientInfo={getPatientInfo}
        actionLoading={actionLoading}
      />

      <QuickPatientModal
        open={quickPatientModalOpen}
        onCancel={() => setQuickPatientModalOpen(false)}
        form={quickPatientForm}
        onFinish={handleQuickRegisterPatientSubmit}
        loading={quickPatientSaving}
      />

      <PrioritizeQueueItemModal
        open={Boolean(prioritizeModalItem)}
        item={prioritizeModalItem}
        onClose={() => setPrioritizeModalItem(null)}
        onSuccess={async () => {
          await refreshAllData()
        }}
      />

      <DeferPatientModal
        open={Boolean(skipModalItem)}
        item={skipModalItem}
        onClose={() => setSkipModalItem(null)}
        onSubmit={handleDeferSubmit}
        loading={actionLoading}
      />

      <QueueItemHistoryModal
        open={Boolean(historyQueueItem)}
        item={historyQueueItem}
        onClose={() => setHistoryQueueItem(null)}
      />

      <AppointmentLogsDrawer
        open={logsDrawerOpen}
        onClose={() => setLogsDrawerOpen(false)}
        appointmentLogs={appointmentLogs}
        notificationLogs={notificationLogs}
      />

      <AppointmentDetailModal
        open={!!detailItem}
        onClose={() => setDetailItem(null)}
        detailItem={detailItem}
        permissions={permissions}
        onConfirm={handleConfirmAppointment}
        onReschedule={handleOpenRescheduleModal}
      />

      {closeVisitModalItem && (
        <CloseVisitModal
          open={!!closeVisitModalItem}
          queueItem={closeVisitModalItem}
          queueItemId={closeVisitModalItem.id || closeVisitModalItem.queueItemId}
          patientName={closeVisitModalItem.patientName}
          patientCode={closeVisitModalItem.patientCode}
          visit={{
            id: closeVisitModalItem.visitId,
            visitCode: closeVisitModalItem.visitCode,
            status: closeVisitModalItem.status,
            startedAt: closeVisitModalItem.calledAt || closeVisitModalItem.checkedInAt,
            patientName: closeVisitModalItem.patientName,
            patientCode: closeVisitModalItem.patientCode,
          }}
          onClose={() => {
            setCloseVisitModalItem(null)
          }}
          onSuccess={async (data, outcome, reason) => {
            if (closeVisitModalItem) {
              saveAppointmentLog({
                appointmentId: closeVisitModalItem.appointmentId || closeVisitModalItem.id,
                appointmentCode: closeVisitModalItem.appointmentCode || closeVisitModalItem.visitCode || 'Lượt khám',
                action: outcome === 'EARLY_ENDED' ? 'EARLY_ENDED' : 'CANCEL',
                operatorName: user?.fullName || user?.username || 'Bác sĩ',
                details: `${outcome === 'EARLY_ENDED' ? 'Kết thúc sớm' : 'Hủy'} ca khám của bệnh nhân ${closeVisitModalItem.patientName || ''}. Lý do: ${reason || ''}.`,
              })
            }
            await refreshAllData()
            setCloseVisitModalItem(null)
          }}
          onInvalidStatus={() => refreshAllData()}
        />
      )}

      <ReceptionRescheduleAppointmentModal
        open={!!rescheduleModalItem}
        appointment={rescheduleModalItem}
        doctorList={doctorList}
        loading={rescheduleSubmitting}
        onClose={() => setRescheduleModalItem(null)}
        onConfirm={handleConfirmRescheduleSubmit}
      />

      <PatientMedicalHistoryModal
        open={historyModalOpen}
        onClose={() => {
          setHistoryModalOpen(false)
          setHistoryPatientTarget(null)
        }}
        patientId={historyPatientTarget?.patientId}
        patientName={historyPatientTarget?.patientName}
        patientCode={historyPatientTarget?.patientCode}
        onOpenEncounter={openEncounter}
      />

      <UnconfirmedAppointmentsDrawer
        open={unconfirmedDrawerOpen}
        onClose={() => setUnconfirmedDrawerOpen(false)}
        onAppointmentConfirmed={() => refreshAllData()}
        user={user}
        patients={patients}
        doctors={doctors}
        getPatientInfo={getPatientInfo}
        getDoctorInfo={getDoctorInfo}
      />

      <WaitlistSuggestionModal
        open={waitlistSuggestionModalOpen}
        suggestion={waitlistSuggestion}
        onClose={() => {
          setWaitlistSuggestionModalOpen(false)
          setWaitlistSuggestion(null)
        }}
        onBookForPatient={handleBookFromWaitlist}
      />

      <AddToWaitlistModal
        open={addToWaitlistModalOpen}
        onCancel={() => {
          setAddToWaitlistModalOpen(false)
          setWaitlistPrefill(null)
        }}
        onSuccess={() => {
          refreshAllData()
        }}
        patients={patients}
        doctorList={doctorList}
        initialPatientId={waitlistPrefill?.patientId}
        initialDoctorId={waitlistPrefill?.doctorId}
        initialDesiredDate={waitlistPrefill?.desiredDate}
        onOpenDirectBooking={(target) => {
          setBookModalOpen(true)
          bookForm.setFieldsValue({
            patientId: target.patientId || undefined,
            doctorId: target.doctorId || undefined,
            appointmentDate: target.date ? dayjs(target.date) : dayjs(),
            appointmentTime: dayjs().add(1, 'hour'),
          })
        }}
      />
    </div>
  )
}

export default AppointmentQueue
