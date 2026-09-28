import React, { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Breadcrumb,
  Button,
  Space,
  message,
} from 'antd'
import {
  AppstoreOutlined,
  CalendarOutlined,
  CheckOutlined,
  FileDoneOutlined,
  HomeOutlined,
  MedicineBoxOutlined,
  ScheduleOutlined,
  UserOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'

import patientPortalAppointmentApi from '../api/patientPortalAppointmentApi'
import SpecialtySelector from '../components/portal/SpecialtySelector'
import DoctorSelector from '../components/portal/DoctorSelector'
import TimeSlotPicker from '../components/portal/TimeSlotPicker'
import BookingConfirmationModal from '../components/portal/BookingConfirmationModal'
import { useAuthContext } from '../context/AuthContext'
import PatientNotificationBell from '../components/portal/PatientNotificationBell.jsx'
import './styles/patientPortalBooking.css'

const DEFAULT_SPECIALTIES = [
  {
    id: 'f0000000-0000-0000-0000-000000000001',
    code: 'GENERAL',
    name: 'Khoa Khám Bệnh Đa Khoa',
    description: 'Khám và điều trị tổng quát ban đầu',
    active: true,
  },
  {
    id: 'f0000000-0000-0000-0000-000000000002',
    code: 'INTERNAL_MEDICINE',
    name: 'Khoa Nội Tổng Hợp',
    description: 'Chẩn đoán và điều trị bệnh lý nội khoa chuyên sâu',
    active: true,
  },
  {
    id: 'f0000000-0000-0000-0000-000000000003',
    code: 'SURGERY',
    name: 'Khoa Ngoại',
    description: 'Khám và tư vấn phẫu thuật ngoại khoa',
    active: true,
  },
  {
    id: 'f0000000-0000-0000-0000-000000000004',
    code: 'ENT',
    name: 'Khoa Tai Mũi Họng',
    description: 'Khám và điều trị các bệnh lý tai, mũi, họng',
    active: true,
  },
  {
    id: 'f0000000-0000-0000-0000-000000000005',
    code: 'CARDIOLOGY',
    name: 'Khoa Tim Mạch',
    description: 'Tầm soát và điều trị các bệnh tim mạch, huyết áp',
    active: true,
  },
]

const DEFAULT_DOCTORS = [
  {
    id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2',
    username: 'doctor_a',
    fullName: 'Nguyễn Văn A',
    email: 'doctor_a@clinic.com',
    phone: '0901234567',
    role: 'DOCTOR',
  },
  {
    id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3',
    username: 'doctor_b',
    fullName: 'Trần Thị B',
    email: 'doctor_b@clinic.com',
    phone: '0907654321',
    role: 'DOCTOR',
  },
]

function PatientPortalBookingPage() {
  const { user } = useAuthContext()
  const navigate = useNavigate()

  const [currentStep, setCurrentStep] = useState(0)

  // Step 1: Specialty
  const [specialties, setSpecialties] = useState([])
  const [selectedSpecialty, setSelectedSpecialty] = useState(null)
  const [specialtiesLoading, setSpecialtiesLoading] = useState(false)

  // Step 2: Doctor
  const [doctors, setDoctors] = useState([])
  const [selectedDoctor, setSelectedDoctor] = useState(null)
  const [doctorsLoading, setDoctorsLoading] = useState(false)

  // Step 3: Date & Slots
  const [selectedDate, setSelectedDate] = useState(dayjs().add(1, 'day').format('YYYY-MM-DD'))
  const [slots, setSlots] = useState([])
  const [selectedSlot, setSelectedSlot] = useState(null)
  const [slotsLoading, setSlotsLoading] = useState(false)

  // Step 4: Confirmation Modal
  const [modalOpen, setModalOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // 1. Fetch Specialties on mount
  useEffect(() => {
    let isMounted = true
    setSpecialtiesLoading(true)
    patientPortalAppointmentApi
      .getSpecialties()
      .then((res) => {
        if (isMounted) {
          const list = Array.isArray(res.data) && res.data.length > 0 ? res.data : DEFAULT_SPECIALTIES
          setSpecialties(list)
        }
      })
      .catch(() => {
        if (isMounted) {
          setSpecialties(DEFAULT_SPECIALTIES)
        }
      })
      .finally(() => {
        if (isMounted) setSpecialtiesLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [])

  // 2. Fetch Doctors when Specialty changes
  const fetchDoctorsForSpecialty = useCallback(async (specialtyId) => {
    if (!specialtyId) return
    setDoctorsLoading(true)
    try {
      const res = await patientPortalAppointmentApi.getDoctors({ specialtyId })
      const list = Array.isArray(res.data) && res.data.length > 0 ? res.data : DEFAULT_DOCTORS
      setDoctors(list)
    } catch {
      setDoctors(DEFAULT_DOCTORS)
    } finally {
      setDoctorsLoading(false)
    }
  }, [])

  // 3. Fetch Slots when Doctor or Date changes
  const fetchAvailableSlots = useCallback(async (doctorId, date) => {
    if (!doctorId || !date) return
    setSlotsLoading(true)
    setSelectedSlot(null)
    try {
      const res = await patientPortalAppointmentApi.getAvailableSlots(doctorId, date)
      setSlots(res.data || [])
    } catch (err) {
      message.error('Không thể tải danh sách khung giờ trống của bác sĩ.')
      setSlots([])
    } finally {
      setSlotsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (selectedDoctor && selectedDate) {
      fetchAvailableSlots(selectedDoctor.id, selectedDate)
    }
  }, [selectedDoctor, selectedDate, fetchAvailableSlots])

  // Step 1 -> Step 2
  const handleSelectSpecialty = (specialty) => {
    setSelectedSpecialty(specialty)
    setSelectedDoctor(null)
    setSelectedSlot(null)
    fetchDoctorsForSpecialty(specialty.id)
    setCurrentStep(1)
  }

  // Step 2 -> Step 3
  const handleSelectDoctor = (doctor) => {
    setSelectedDoctor(doctor)
    setSelectedSlot(null)
    setCurrentStep(2)
  }

  // Step 3 -> Open Confirmation Modal
  const handleSelectSlot = (slot) => {
    setSelectedSlot(slot)
    setModalOpen(true)
  }

  // Submit Booking
  const handleBookingSubmit = async (payload) => {
    setSubmitting(true)
    try {
      const res = await patientPortalAppointmentApi.bookAppointment(payload)
      return res.data
    } catch (err) {
      // If slot conflict occurs, refresh slots immediately
      if (selectedDoctor && selectedDate) {
        fetchAvailableSlots(selectedDoctor.id, selectedDate)
      }
      throw err
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="portal-booking-page">
      {/* Header */}
      <header className="portal-booking-header">
        <div className="portal-booking-header-inner">
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
            <Link to="/portal/my-appointments">
              <Button className="portal-header-btn" icon={<ScheduleOutlined style={{ color: '#2563eb' }} />}>
                Lịch hẹn của tôi
              </Button>
            </Link>
            <Link to="/portal/medical-history">
              <Button className="portal-header-btn" icon={<FileDoneOutlined style={{ color: '#16a34a' }} />}>
                Lịch sử khám
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

      {/* Main Content */}
      <main className="portal-booking-main">
        {/* Breadcrumb */}
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
                title: 'Đặt lịch khám trực tuyến',
              },
            ]}
          />
        </div>

        <div className="portal-booking-card-wrapper">
          {/* Custom Modern Steps Navigation */}
          <div className="portal-steps-header">
            <div className="portal-custom-steps-grid">
              {/* Step 1 */}
              <div
                className={`portal-step-item ${currentStep === 0 ? 'is-active' : ''} ${selectedSpecialty ? 'is-completed' : ''} is-clickable`}
                onClick={() => setCurrentStep(0)}
              >
                <div className="portal-step-badge">
                  {selectedSpecialty && currentStep !== 0 ? <CheckOutlined /> : <AppstoreOutlined />}
                </div>
                <div className="portal-step-content">
                  <div className="portal-step-title">1. Chuyên khoa</div>
                  <span className="portal-step-desc">
                    {selectedSpecialty ? selectedSpecialty.name : 'Chọn khoa khám'}
                  </span>
                </div>
              </div>

              {/* Step 2 */}
              <div
                className={`portal-step-item ${currentStep === 1 ? 'is-active' : ''} ${selectedDoctor ? 'is-completed' : ''} ${selectedSpecialty ? 'is-clickable' : ''}`}
                onClick={() => {
                  if (selectedSpecialty) setCurrentStep(1)
                }}
              >
                <div className="portal-step-badge">
                  {selectedDoctor && currentStep !== 1 ? <CheckOutlined /> : <UserOutlined />}
                </div>
                <div className="portal-step-content">
                  <div className="portal-step-title">2. Bác sĩ phụ trách</div>
                  <span className="portal-step-desc">
                    {selectedDoctor ? `BS. ${selectedDoctor.fullName || selectedDoctor.username}` : 'Chọn bác sĩ'}
                  </span>
                </div>
              </div>

              {/* Step 3 */}
              <div
                className={`portal-step-item ${currentStep === 2 ? 'is-active' : ''} ${selectedSlot ? 'is-completed' : ''} ${selectedDoctor ? 'is-clickable' : ''}`}
                onClick={() => {
                  if (selectedDoctor) setCurrentStep(2)
                }}
              >
                <div className="portal-step-badge">
                  {selectedSlot && currentStep !== 2 ? <CheckOutlined /> : <CalendarOutlined />}
                </div>
                <div className="portal-step-content">
                  <div className="portal-step-title">3. Ngày & Khung giờ</div>
                  <span className="portal-step-desc">
                    {selectedSlot ? `${selectedSlot.label}, ${dayjs(selectedDate).format('DD/MM')}` : 'Chọn khung giờ'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Step Contents */}
          {currentStep === 0 && (
            <SpecialtySelector
              specialties={specialties}
              selectedSpecialty={selectedSpecialty}
              onSelectSpecialty={handleSelectSpecialty}
              loading={specialtiesLoading}
            />
          )}

          {currentStep === 1 && (
            <DoctorSelector
              specialty={selectedSpecialty}
              doctors={doctors}
              selectedDoctor={selectedDoctor}
              onSelectDoctor={handleSelectDoctor}
              onBack={() => setCurrentStep(0)}
              loading={doctorsLoading}
            />
          )}

          {currentStep === 2 && (
            <TimeSlotPicker
              doctor={selectedDoctor}
              specialty={selectedSpecialty}
              selectedDate={selectedDate}
              onDateChange={setSelectedDate}
              slots={slots}
              selectedSlot={selectedSlot}
              onSelectSlot={handleSelectSlot}
              loading={slotsLoading}
              onReload={() => fetchAvailableSlots(selectedDoctor?.id, selectedDate)}
              onBack={() => setCurrentStep(1)}
            />
          )}
        </div>
      </main>

      {/* Confirmation Modal */}
      <BookingConfirmationModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        specialty={selectedSpecialty}
        doctor={selectedDoctor}
        selectedDate={selectedDate}
        selectedSlot={selectedSlot}
        patient={user}
        onSubmit={handleBookingSubmit}
        loading={submitting}
        onSuccessNavigate={(path) => navigate(path)}
      />
    </div>
  )
}

export default PatientPortalBookingPage
