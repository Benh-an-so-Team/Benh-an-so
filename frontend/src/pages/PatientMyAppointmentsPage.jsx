import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Breadcrumb,
  Button,
  Card,
  Col,
  Empty,
  Input,
  Modal,
  Pagination,
  Row,
  Skeleton,
  Space,
  Tabs,
  Tag,
  Typography,
  message,
} from 'antd'
import {
  CalendarOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  ExclamationCircleOutlined,
  FileDoneOutlined,
  FileProtectOutlined,
  HomeOutlined,
  MedicineBoxOutlined,
  PlusOutlined,
  ReloadOutlined,
  SwapOutlined,
  SyncOutlined,
  UserOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'

import patientPortalAppointmentApi from '../api/patientPortalAppointmentApi'
import RescheduleAppointmentModal from '../components/portal/RescheduleAppointmentModal'
import { useAuthContext } from '../context/AuthContext'
import PatientNotificationBell from '../components/portal/PatientNotificationBell.jsx'
import './styles/patientMyAppointments.css'

const { Title, Text, Paragraph } = Typography

const statusMeta = {
  SCHEDULED: { label: 'Đã đặt lịch', color: 'blue', icon: <ClockCircleOutlined /> },
  CONFIRMED: { label: 'Đã xác nhận', color: 'cyan', icon: <CheckCircleOutlined /> },
  IN_PROGRESS: { label: 'Đang khám', color: 'processing', icon: <SyncOutlined spin /> },
  COMPLETED: { label: 'Đã hoàn thành', color: 'success', icon: <CheckCircleOutlined /> },
  CANCELLED: { label: 'Đã hủy', color: 'default', icon: <CloseCircleOutlined /> },
  NO_SHOW: { label: 'Không đến', color: 'error', icon: <ExclamationCircleOutlined /> },
}

function PatientMyAppointmentsPage() {
  const { user } = useAuthContext()
  const [appointments, setAppointments] = useState([])
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('ALL')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [cancellingId, setCancellingId] = useState(null)
  const [confirmingId, setConfirmingId] = useState(null)
  const [cancelModalOpen, setCancelModalOpen] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [targetAppointment, setTargetAppointment] = useState(null)
  const [rescheduleModalOpen, setRescheduleModalOpen] = useState(false)
  const [rescheduleTargetAppointment, setRescheduleTargetAppointment] = useState(null)

  const patientId = user?.patientId || user?.id

  const fetchAppointments = useCallback(async () => {
    setLoading(true)
    let cachedList = []
    try {
      cachedList = JSON.parse(localStorage.getItem('portal_booked_appointments') || '[]')
    } catch {
      cachedList = []
    }

    try {
      const res = await patientPortalAppointmentApi.getMyAppointments(patientId)
      const data = res.data
      const apiList = Array.isArray(data?.content) ? data.content : Array.isArray(data) ? data : []
      const combined = [...apiList]
      cachedList.forEach((cached) => {
        if (!combined.some((item) => item.id === cached.id || (item.appointmentCode && item.appointmentCode === cached.appointmentCode))) {
          combined.push(cached)
        }
      })
      const sorted = combined.sort((a, b) => new Date(b.startTime || b.createdAt) - new Date(a.startTime || a.createdAt))
      setAppointments(sorted)
    } catch {
      setAppointments(cachedList)
    } finally {
      setLoading(false)
    }
  }, [patientId])

  useEffect(() => {
    fetchAppointments()
  }, [fetchAppointments])

  const filteredAppointments = useMemo(() => {
    if (activeTab === 'ALL') return appointments
    if (activeTab === 'UPCOMING') {
      return appointments.filter((a) => a.status === 'SCHEDULED' || a.status === 'CONFIRMED')
    }
    if (activeTab === 'COMPLETED') {
      return appointments.filter((a) => a.status === 'COMPLETED')
    }
    if (activeTab === 'CANCELLED') {
      return appointments.filter((a) => a.status === 'CANCELLED' || a.status === 'NO_SHOW')
    }
    return appointments
  }, [appointments, activeTab])

  const paginatedAppointments = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize
    return filteredAppointments.slice(startIndex, startIndex + pageSize)
  }, [filteredAppointments, currentPage, pageSize])

  const handleTabChange = (key) => {
    setActiveTab(key)
    setCurrentPage(1)
  }

  const canModifyAppointment = (apt) => {
    if (!apt) return false
    const validStatus = apt.status === 'SCHEDULED' || apt.status === 'CONFIRMED'
    const isFuture = apt.startTime ? dayjs(apt.startTime).isAfter(dayjs()) : true
    return validStatus && isFuture
  }

  const handleConfirmAttendance = (apt) => {
    const startDayjs = apt.startTime ? dayjs(apt.startTime) : null
    const doctorName = apt.doctor?.fullName || apt.doctor?.username || apt.doctorName || 'Bác sĩ phụ trách'

    Modal.confirm({
      title: 'Xác nhận sẽ đến khám bệnh',
      icon: <CheckCircleOutlined style={{ color: '#16a34a' }} />,
      content: (
        <div>
          <Paragraph>
            Bạn có chắc chắn xác nhận <strong>sẽ đến khám</strong> cho lịch hẹn này không?
          </Paragraph>
          <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, marginTop: 8 }}>
            <div style={{ marginBottom: 4 }}>
              <ClockCircleOutlined style={{ color: '#2563eb', marginRight: 6 }} />
              <strong>
                {startDayjs?.isValid() ? startDayjs.format('HH:mm, [ngày] DD/MM/YYYY') : 'Lịch hẹn'}
              </strong>
            </div>
            <div>
              <UserOutlined style={{ color: '#2563eb', marginRight: 6 }} />
              <strong>BS. {doctorName}</strong>
            </div>
          </div>
          <Paragraph type="secondary" style={{ fontSize: 12, marginTop: 8, marginBottom: 0 }}>
            Sau khi xác nhận, phòng khám sẽ giữ chỗ ưu tiên và chuẩn bị sẵn sàng hồ sơ đón tiếp bạn.
          </Paragraph>
        </div>
      ),
      okText: 'Xác nhận sẽ đến',
      okButtonProps: { style: { backgroundColor: '#16a34a', borderColor: '#16a34a' } },
      cancelText: 'Để sau',
      onOk: async () => {
        setConfirmingId(apt.id)
        try {
          await patientPortalAppointmentApi.confirmAppointment(apt.id)
          message.success('Cảm ơn bạn! Lịch hẹn đã được xác nhận thành công.')
          setAppointments((prev) =>
            prev.map((item) =>
              item.id === apt.id ? { ...item, status: 'CONFIRMED', confirmedAt: new Date().toISOString() } : item
            )
          )
          fetchAppointments()
        } catch (err) {
          const msg = err?.response?.data?.message || err?.message || 'Không thể xác nhận lịch hẹn'
          message.error(msg)
        } finally {
          setConfirmingId(null)
        }
      },
    })
  }

  const handleOpenCancelModal = (apt) => {
    setTargetAppointment(apt)
    setCancelReason('')
    setCancelModalOpen(true)
  }

  const handleConfirmCancel = async () => {
    if (!targetAppointment) return
    setCancellingId(targetAppointment.id)
    const oldStartTime = targetAppointment.startTime
    const oldDoctorId = targetAppointment.doctorId || targetAppointment.doctor?.id
    const oldDate = oldStartTime ? dayjs(oldStartTime).format('YYYY-MM-DD') : null
    const oldTimeStr = oldStartTime ? dayjs(oldStartTime).format('HH:mm') : null

    try {
      await patientPortalAppointmentApi.cancelAppointment(
        targetAppointment.id,
        cancelReason.trim() || undefined
      )

      if (oldDoctorId && oldDate) {
        try {
          const verifyRes = await patientPortalAppointmentApi.getAvailableSlots(oldDoctorId, oldDate)
          const freedSlots = verifyRes.data || []
          const oldSlotObj = freedSlots.find((s) => s.time === oldTimeStr)
          if (oldSlotObj && oldSlotObj.isAvailable === false) {
            console.warn(`[Verification] Cảnh báo: Khung giờ cũ ${oldTimeStr} chưa được giải phóng trên Backend!`)
          } else {
            console.log(`[Verification] Xác nhận thành công: Khung giờ cũ ${oldTimeStr} đã được giải phóng (isAvailable=true).`)
          }
        } catch {}
      }

      try {
        const cached = JSON.parse(localStorage.getItem('portal_booked_appointments') || '[]')
        const updated = cached.map((item) =>
          item.id === targetAppointment.id || item.appointmentCode === targetAppointment.appointmentCode
            ? { ...item, status: 'CANCELLED' }
            : item
        )
        localStorage.setItem('portal_booked_appointments', JSON.stringify(updated))
      } catch {}

      setAppointments((prev) =>
        prev.map((item) =>
          item.id === targetAppointment.id || item.appointmentCode === targetAppointment.appointmentCode
            ? { ...item, status: 'CANCELLED' }
            : item
        )
      )

      message.success('Đã hủy lịch hẹn thành công!')
      setCancelModalOpen(false)
      setTargetAppointment(null)
    } catch (err) {
      const status = err?.response?.status
      if (status === 403) {
        message.error('Bạn không có quyền thao tác trên lịch hẹn này.')
      } else if (status === 400) {
        message.error('Lịch hẹn này không thể đổi/hủy (đã qua giờ hoặc đã được xử lý).')
        fetchAppointments()
        setCancelModalOpen(false)
      } else if (status === 404) {
        message.warning('Lịch hẹn không tìm thấy trên hệ thống hoặc Backend chưa được khởi động lại để nhận API mới.')
        try {
          const cached = JSON.parse(localStorage.getItem('portal_booked_appointments') || '[]')
          const updated = cached.map((item) =>
            item.id === targetAppointment.id || item.appointmentCode === targetAppointment.appointmentCode
              ? { ...item, status: 'CANCELLED' }
              : item
          )
          localStorage.setItem('portal_booked_appointments', JSON.stringify(updated))
        } catch {}
        setAppointments((prev) =>
          prev.map((item) =>
            item.id === targetAppointment.id || item.appointmentCode === targetAppointment.appointmentCode
              ? { ...item, status: 'CANCELLED' }
              : item
          )
        )
        setCancelModalOpen(false)
        setTargetAppointment(null)
      } else {
        const errorMsg = err?.response?.data?.message || 'Không thể hủy lịch hẹn. Vui lòng thử lại sau.'
        message.error(errorMsg)
      }
    } finally {
      setCancellingId(null)
    }
  }

  const handleOpenRescheduleModal = (apt) => {
    setRescheduleTargetAppointment(apt)
    setRescheduleModalOpen(true)
  }

  const handleRescheduleSuccess = (updatedData) => {
    if (!updatedData) return
    setAppointments((prev) =>
      prev.map((item) =>
        item.id === updatedData.id || item.appointmentCode === updatedData.appointmentCode
          ? {
              ...item,
              startTime: updatedData.startTime,
              endTime: updatedData.endTime,
              reason: updatedData.reason || item.reason,
            }
          : item
      )
    )

    try {
      const cached = JSON.parse(localStorage.getItem('portal_booked_appointments') || '[]')
      const updated = cached.map((item) =>
        item.id === updatedData.id || item.appointmentCode === updatedData.appointmentCode
          ? {
              ...item,
              startTime: updatedData.startTime,
              endTime: updatedData.endTime,
              reason: updatedData.reason || item.reason,
            }
          : item
      )
      localStorage.setItem('portal_booked_appointments', JSON.stringify(updated))
    } catch {}
  }

  return (
    <div className="portal-my-appointments-page">
      <header className="portal-my-appointments-header">
        <div className="portal-my-appointments-header-inner">
          <Link className="portal-booking-brand" to="/portal/dashboard">
            <span className="portal-booking-brand-icon">
              <MedicineBoxOutlined />
            </span>
            <span>
              <strong>BỆNH ÁN SỐ</strong>
              <small>Cổng thông tin bệnh nhân</small>
            </span>
          </Link>

          <Space size={10} wrap align="center">
            <PatientNotificationBell />
            <Link to="/portal/book-appointment">
              <Button type="primary" className="portal-header-btn-primary" icon={<PlusOutlined />}>
                Đặt lịch khám mới
              </Button>
            </Link>
            <Link to="/portal/medical-history">
              <Button className="portal-header-btn" icon={<FileDoneOutlined style={{ color: '#16a34a' }} />}>
                Lịch sử khám
              </Button>
            </Link>
            <Link to="/portal/my-invoices">
              <Button className="portal-header-btn" icon={<FileProtectOutlined style={{ color: '#2563eb' }} />}>
                Hóa đơn của tôi
              </Button>
            </Link>
            <Link to="/portal/dashboard">
              <Button className="portal-header-btn" icon={<HomeOutlined style={{ color: '#64748b' }} />}>
                Trang chủ
              </Button>
            </Link>
          </Space>
        </div>
      </header>

      <main className="portal-my-appointments-main">
        <div style={{ marginBottom: 16 }}>
          <Breadcrumb
            items={[
              {
                title: (
                  <Link to="/portal/dashboard">
                    <HomeOutlined /> Trang chủ
                  </Link>
                ),
              },
              {
                title: 'Lịch hẹn của tôi',
              },
            ]}
          />
        </div>

        <div className="portal-appointments-card-wrapper">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
            <div>
              <Title level={4} style={{ margin: 0, color: '#1e3a8a' }}>
                <CalendarOutlined style={{ marginRight: 8 }} />
                Danh sách lịch hẹn khám của tôi
              </Title>
              <Text type="secondary" style={{ fontSize: 13 }}>
                Theo dõi trạng thái và thời gian các ca khám đã đặt trực tuyến hoặc tại phòng khám
              </Text>
            </div>

            <Button icon={<ReloadOutlined />} onClick={fetchAppointments} loading={loading}>
              Làm mới
            </Button>
          </div>

          <Tabs
            activeKey={activeTab}
            onChange={handleTabChange}
            items={[
              { key: 'ALL', label: `Tất cả (${appointments.length})` },
              {
                key: 'UPCOMING',
                label: `Sắp tới (${appointments.filter((a) => a.status === 'SCHEDULED' || a.status === 'CONFIRMED').length})`,
              },
              {
                key: 'COMPLETED',
                label: `Đã khám xong (${appointments.filter((a) => a.status === 'COMPLETED').length})`,
              },
              {
                key: 'CANCELLED',
                label: `Đã hủy (${appointments.filter((a) => a.status === 'CANCELLED' || a.status === 'NO_SHOW').length})`,
              },
            ]}
          />

          {loading ? (
            <div style={{ padding: '24px 0' }}>
              {[1, 2, 3].map((k) => (
                <Card key={k} style={{ marginBottom: 12, borderRadius: 10 }}>
                  <Skeleton active paragraph={{ rows: 2 }} />
                </Card>
              ))}
            </div>
          ) : filteredAppointments.length === 0 ? (
            <div style={{ padding: '48px 0', textAlign: 'center' }}>
              <Empty
                description="Bạn chưa có lịch hẹn nào trong danh mục này."
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              >
                <Link to="/portal/book-appointment">
                  <Button type="primary" icon={<PlusOutlined />} style={{ background: '#2563eb' }}>
                    Đặt lịch khám ngay bây giờ
                  </Button>
                </Link>
              </Empty>
            </div>
          ) : (
            <div>
              {paginatedAppointments.map((apt) => {
                const statusInfo = statusMeta[apt.status] || {
                  label: apt.status,
                  color: 'default',
                  icon: null,
                }
                const canCancel = apt.status === 'SCHEDULED' || apt.status === 'CONFIRMED'
                const startDayjs = apt.startTime ? dayjs(apt.startTime) : null
                const endDayjs = apt.endTime ? dayjs(apt.endTime) : null
                const doctorName = apt.doctor?.fullName || apt.doctor?.username || apt.doctorName || 'Bác sĩ phụ trách'

                return (
                  <Card key={apt.id} className="appointment-item-card" bodyStyle={{ padding: '16px 20px' }}>
                    <Row gutter={[16, 12]} align="middle">
                      <Col xs={24} md={16}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
                          <strong style={{ fontSize: 16, color: '#1e293b' }}>
                            Mã lịch hẹn: {apt.appointmentCode || apt.id?.substring(0, 8)}
                          </strong>
                          {apt.status === 'CONFIRMED' ? (
                            <Tag color="green" icon={<CheckCircleOutlined />} style={{ fontWeight: 600, fontSize: 12 }}>
                              Đã xác nhận sẽ đến
                            </Tag>
                          ) : (
                            <Tag color={statusInfo.color} icon={statusInfo.icon} style={{ fontWeight: 600, fontSize: 12 }}>
                              {statusInfo.label}
                            </Tag>
                          )}
                          {apt.bookingChannel === 'ONLINE_PORTAL' && (
                            <Tag color="purple" style={{ fontSize: 11 }}>
                              Đặt trực tuyến
                            </Tag>
                          )}
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, color: '#475569' }}>
                          <div>
                            <UserOutlined style={{ color: '#2563eb', marginRight: 6 }} />
                            <span>Bác sĩ: <strong>BS. {doctorName}</strong></span>
                          </div>
                          {startDayjs && (
                            <div>
                              <ClockCircleOutlined style={{ color: '#2563eb', marginRight: 6 }} />
                              <span>
                                Thời gian: <strong>{startDayjs.format('HH:mm')}{endDayjs ? ` - ${endDayjs.format('HH:mm')}` : ''}</strong>, ngày <strong>{startDayjs.format('DD/MM/YYYY')}</strong>
                              </span>
                            </div>
                          )}
                          {apt.reason && (
                            <div style={{ marginTop: 2, color: '#64748b' }}>
                              Lý do khám: {apt.reason}
                            </div>
                          )}
                          {apt.status === 'CONFIRMED' && (
                            <div style={{ marginTop: 4, color: '#16a34a', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                              <CheckCircleOutlined /> Bạn đã xác nhận sẽ đến khám. Vui lòng có mặt trước giờ hẹn 15 phút.
                            </div>
                          )}
                        </div>
                      </Col>

                      <Col xs={24} md={8} style={{ textAlign: { xs: 'left', md: 'right' } }}>
                        {canModifyAppointment(apt) ? (
                          <Space size={8} wrap>
                            {apt.status === 'SCHEDULED' && (
                              <Button
                                type="primary"
                                className="portal-action-btn-confirm"
                                icon={<CheckCircleOutlined />}
                                loading={confirmingId === apt.id}
                                style={{ backgroundColor: '#16a34a', borderColor: '#16a34a' }}
                                onClick={() => handleConfirmAttendance(apt)}
                              >
                                Xác nhận sẽ đến
                              </Button>
                            )}
                            <Button
                              className="portal-action-btn-reschedule"
                              icon={<SwapOutlined />}
                              onClick={() => handleOpenRescheduleModal(apt)}
                            >
                              Đổi lịch
                            </Button>
                            <Button
                              className="portal-action-btn-cancel"
                              icon={<CloseCircleOutlined />}
                              onClick={() => handleOpenCancelModal(apt)}
                            >
                              Hủy lịch
                            </Button>
                          </Space>
                        ) : (
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            {apt.status === 'COMPLETED'
                              ? 'Đã hoàn tất khám bệnh'
                              : apt.status === 'CANCELLED'
                              ? 'Lịch hẹn đã hủy'
                              : apt.status === 'IN_PROGRESS'
                              ? 'Đang tiến hành khám'
                              : apt.status === 'NO_SHOW'
                              ? 'Không đến khám'
                              : 'Lịch hẹn đã qua giờ khám'}
                          </Text>
                        )}
                      </Col>
                    </Row>
                  </Card>
                )
              })}

              {filteredAppointments.length > 0 && (
                <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end' }}>
                  <Pagination
                    current={currentPage}
                    pageSize={pageSize}
                    total={filteredAppointments.length}
                    showSizeChanger
                    pageSizeOptions={['5', '10', '20', '50']}
                    locale={{ items_per_page: '/ trang' }}
                    onChange={(page, size) => {
                      setCurrentPage(page)
                      setPageSize(size)
                    }}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#dc2626' }}>
            <ExclamationCircleOutlined />
            <span>Xác nhận hủy lịch hẹn</span>
          </div>
        }
        open={cancelModalOpen}
        onCancel={() => setCancelModalOpen(false)}
        onOk={handleConfirmCancel}
        confirmLoading={cancellingId === targetAppointment?.id}
        okText="Xác nhận hủy"
        okButtonProps={{ danger: true }}
        cancelText="Đóng"
        destroyOnClose
      >
        <div style={{ marginBottom: 14 }}>
          Bạn có chắc chắn muốn hủy lịch hẹn <strong>{targetAppointment?.appointmentCode || targetAppointment?.id}</strong> không?
        </div>
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
            Lý do hủy lịch (tùy chọn, tối đa 500 ký tự):
          </div>
          <Input.TextArea
            rows={2}
            maxLength={500}
            showCount
            placeholder="Nhập lý do bạn muốn hủy lịch hẹn..."
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            style={{ borderRadius: 8 }}
          />
        </div>
      </Modal>

      <RescheduleAppointmentModal
        open={rescheduleModalOpen}
        onClose={() => {
          setRescheduleModalOpen(false)
          setRescheduleTargetAppointment(null)
        }}
        appointment={rescheduleTargetAppointment}
        onSuccess={handleRescheduleSuccess}
        onRefreshAppointments={fetchAppointments}
      />
    </div>
  )
}

export default PatientMyAppointmentsPage
