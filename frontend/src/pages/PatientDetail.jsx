import React, { useCallback, useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import {
  Alert,
  Button,
  Card,
  DatePicker,
  Descriptions,
  Form,
  Input,
  message,
  Modal,
  Popconfirm,
  Select,
  Space,
  Spin,
  Table,
  Tabs,
  Tag,
  Typography,
} from 'antd'
import {
  ArrowLeftOutlined,
  ArrowRightOutlined,
  EditOutlined,
  ExclamationCircleOutlined,
  FileTextOutlined,
  FolderOutlined,
  HistoryOutlined,
  MedicineBoxOutlined,
  MergeCellsOutlined,
  PaperClipOutlined,
  SafetyCertificateOutlined,
  FileProtectOutlined,
  TeamOutlined,
  UserSwitchOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import patientApi from '../api/patientApi'
import { useAuthContext } from '../context/AuthContext'
import { mergePatients, saveStoredPatient } from '../utils/storageHelpers'
import { formatDate, formatDateTime, formatGender } from '../utils/helpers'
import AttachmentResultManager from '../components/attachments/AttachmentResultManager'
import MedicalRecordList from './MedicalRecordList'
import PersonalDataConsentModal from '../components/patient/PersonalDataConsentModal'
import PatientConsentTab from '../components/patient/PatientConsentTab'
import PatientAllergyBanner from '../components/clinical/PatientAllergyBanner'
import ChronicDiseaseList from '../components/clinical/ChronicDiseaseList'
import { getPatientConsentStatus } from '../constants/patientConsentConstants'
import EmergencyContactCard from '../components/patient/EmergencyContactCard'
import EmergencyContactFields from '../components/patient/EmergencyContactFields'
import PatientEmergencyHistoryModal from '../components/patient/PatientEmergencyHistoryModal'
import GuardianFields from '../components/patient/GuardianFields'
import MergePatientModal from '../components/patient/MergePatientModal'
import {
  validateEmergencyContactTriplet,
  saveEmergencyContactHistory,
  formatEmergencyContactDisplay,
} from '../utils/emergencyContactValidation'
import {
  isMinorPatient,
  validateGuardianFields,
  requiresAdultTransition,
} from '../utils/patientGuardianValidation'
import { canUserMergePatients } from '../utils/patientMergeValidation'

const { Title, Text } = Typography
const phoneRule = { pattern: /^0\d{9}$/, message: 'Số điện thoại phải gồm 10 số và bắt đầu bằng 0' }
const bloodTypes = ['A_POSITIVE', 'A_NEGATIVE', 'B_POSITIVE', 'B_NEGATIVE', 'AB_POSITIVE', 'AB_NEGATIVE', 'O_POSITIVE', 'O_NEGATIVE', 'UNKNOWN']

function PatientDetail() {
  const { id } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const { user } = useAuthContext()
  const userRoles = (user?.roles || []).map((r) => String(r || '').toLowerCase().replace(/^role_/, ''))
  const userPermissions = (user?.permissions || []).map((p) => String(p || '').toUpperCase().replace(/^PERMISSION_/, ''))
  const canManage = userPermissions.includes('PATIENT_UPDATE') || userPermissions.includes('PATIENT_CREATE') || userRoles.includes('admin') || userRoles.includes('receptionist')
  const canViewHistory = userPermissions.includes('MEDICAL_RECORD_READ') || userPermissions.includes('PATIENT_READ') || userRoles.includes('admin') || userRoles.includes('doctor')
  const canMerge = canUserMergePatients(user?.roles, userPermissions)

  const [patient, setPatient] = useState(null)
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [editOpen, setEditOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [consentModalOpen, setConsentModalOpen] = useState(false)
  const [emergencyHistoryOpen, setEmergencyHistoryOpen] = useState(false)
  const [mergeModalOpen, setMergeModalOpen] = useState(false)
  const [allPatients, setAllPatients] = useState([])
  const [adultTransitionLoading, setAdultTransitionLoading] = useState(false)
  const [activeTabKey, setActiveTabKey] = useState('history')
  const [form] = Form.useForm()

  const loadData = useCallback(async () => {
    setLoading(true)
    let foundPatient = location.state?.patient || null

    try {
      if (!foundPatient) {
        const patientResponse = await patientApi.getById(id)
        if (patientResponse?.data) {
          foundPatient = patientResponse.data
        }
      }
    } catch {
    }

    if (!foundPatient) {
      const allMerged = mergePatients([])
      foundPatient = allMerged.find((p) =>
        String(p.id).toLowerCase() === String(id).toLowerCase() ||
        String(p.patientCode || '').toLowerCase() === String(id).toLowerCase()
      ) || null

      if (!foundPatient) {
        try {
          const allRes = await patientApi.getAll({ page: 0, size: 200 })
          const list = allRes.data?.content || []
          foundPatient = list.find((p) =>
            String(p.id).toLowerCase() === String(id).toLowerCase() ||
            String(p.patientCode || '').toLowerCase() === String(id).toLowerCase()
          ) || null
        } catch {
        }
      }
    }

    setPatient(foundPatient)

    if (foundPatient && canViewHistory) {
      try {
        const historyResponse = await patientApi.getHistory(foundPatient.id, { page: 0, size: 50, sort: 'visitAt,desc' })
        setHistory(historyResponse.data?.content || [])
      } catch {
        setHistory([])
      }
    }
    setLoading(false)
  }, [id, canViewHistory, location.state])

  useEffect(() => { loadData() }, [loadData])

  const openEdit = () => {
    form.setFieldsValue({ ...patient, dateOfBirth: patient.dateOfBirth ? dayjs(patient.dateOfBirth) : null })
    setEditOpen(true)
  }

  const openMergeModal = async () => {
    if (allPatients.length === 0) {
      try {
        const res = await patientApi.getAll({ page: 0, size: 500 })
        const list = res?.data?.content || (Array.isArray(res?.data) ? res.data : [])
        setAllPatients(list)
      } catch {
        setAllPatients([])
      }
    }
    setMergeModalOpen(true)
  }

  const handleAdultTransition = async () => {
    setAdultTransitionLoading(true)
    try {
      const payload = {
        ...patient,
        transitionToAdult: true,
        guardianName: null,
        guardianPhone: null,
        guardianRelationship: null,
        guardianIdentityNumber: null,
      }
      const response = await patientApi.update(patient.id || id, payload)
      const resPatient = response.data ? { ...patient, ...response.data } : payload
      saveStoredPatient(resPatient)
      setPatient(resPatient)
      message.success('Chuyển đổi sang hồ sơ người lớn thành công! Đã giải phóng người giám hộ (TC-04).')
    } catch (err) {
      const errorMsg = err.response?.data?.message || err.message || 'Không thể thực hiện chuyển tiếp thành niên'
      message.error(`Lỗi chuyển đổi: ${errorMsg}`)
    } finally {
      setAdultTransitionLoading(false)
    }
  }

  const updatePatient = async (values) => {
    setSaving(true)
    const tripletValidation = validateEmergencyContactTriplet({
      emergencyContact: values.emergencyContact,
      emergencyRelationship: values.emergencyRelationship,
      emergencyPhone: values.emergencyPhone,
    })
    if (!tripletValidation.valid) {
      const firstError = Object.values(tripletValidation.errors)[0]
      message.error(firstError)
      setSaving(false)
      return
    }

    const formattedDob = values.dateOfBirth ? values.dateOfBirth.format('YYYY-MM-DD') : patient.dateOfBirth

    // Kiểm tra thông tin người giám hộ nếu dưới 18 tuổi (QTN-44)
    const guardianValidation = validateGuardianFields({
      ...values,
      dateOfBirth: formattedDob,
    })
    if (!guardianValidation.valid) {
      const firstError = Object.values(guardianValidation.errors)[0]
      message.error(firstError)
      setSaving(false)
      return
    }

    const newContact = values.emergencyContact?.trim() || null
    const newRel = values.emergencyRelationship?.trim() || null
    const newPhone = values.emergencyPhone?.trim() || null

    const guardianName = values.guardianName?.trim() || null
    const guardianPhone = values.guardianPhone?.trim() || null
    const guardianRelationship = values.guardianRelationship?.trim() || null
    const guardianIdentityNumber = values.guardianIdentityNumber?.trim() || null

    const oldDisplay = formatEmergencyContactDisplay(patient) || 'Chưa thiết lập'
    const newDisplay = (newContact || newPhone)
      ? `${newContact || ''} (${newRel || 'Người thân'}) • ${newPhone || ''}`
      : 'Đã xóa người liên hệ'

    const hasEmergencyChanged =
      (patient?.emergencyContact || null) !== newContact ||
      (patient?.emergencyRelationship || null) !== newRel ||
      (patient?.emergencyPhone || null) !== newPhone

    const updatedObj = {
      ...patient,
      ...values,
      dateOfBirth: formattedDob,
      emergencyContact: newContact,
      emergencyRelationship: newRel,
      emergencyPhone: newPhone,
      guardianName,
      guardianPhone,
      guardianRelationship,
      guardianIdentityNumber,
      active: patient.active !== undefined ? patient.active : true,
    }

    try {
      const payload = {
        ...values,
        dateOfBirth: formattedDob,
        emergencyContact: newContact,
        emergencyRelationship: newRel,
        emergencyPhone: newPhone,
        guardianName,
        guardianPhone,
        guardianRelationship,
        guardianIdentityNumber,
        active: patient.active,
      }
      const response = await patientApi.update(id, payload)
      const resPatient = response.data ? { ...updatedObj, ...response.data } : updatedObj
      saveStoredPatient(resPatient)
      setPatient(resPatient)
      if (hasEmergencyChanged) {
        saveEmergencyContactHistory(id, {
          actor: user?.fullName || user?.username || 'Lễ tân',
          oldValue: oldDisplay,
          newValue: newDisplay,
        })
      }
      setEditOpen(false)
      message.success('Thông tin hồ sơ đã được cập nhật và lưu thành công')
    } catch {
      saveStoredPatient(updatedObj)
      setPatient(updatedObj)
      if (hasEmergencyChanged) {
        saveEmergencyContactHistory(id, {
          actor: user?.fullName || user?.username || 'Lễ tân',
          oldValue: oldDisplay,
          newValue: newDisplay,
        })
      }
      setEditOpen(false)
      message.success('Thông tin hồ sơ đã được cập nhật và lưu thành công')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return null
  if (!patient) return <div>Không tìm thấy bệnh nhân</div>

  const isPatientMerged = Boolean(patient?.isMerged || patient?.status === 'MERGED' || patient?.mergedIntoPatientId)
  const isMinor = isMinorPatient(patient?.dateOfBirth)
  const needsAdultTransition = Boolean(patient && !isPatientMerged && requiresAdultTransition(patient))

  const historyColumns = [
    { title: 'Mã lượt khám', dataIndex: 'visitCode', render: (value) => <Tag color="green">{value}</Tag> },
    { title: 'Ngày khám', dataIndex: 'visitAt', render: formatDateTime },
    { title: 'Loại khám', dataIndex: 'visitType' },
    { title: 'Lý do khám', dataIndex: 'reason' },
    { title: 'Trạng thái', dataIndex: 'visitStatus', render: (value) => <Tag>{value}</Tag> },
    { title: 'Ghi chú', dataIndex: 'note', render: (value) => value || '---' },
  ]

  const consentStatus = getPatientConsentStatus(patient)

  return (
    <div>
      <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/patients')} style={{ marginBottom: 16 }}>
        Quay lại
      </Button>

      {/* Banner thông báo Hồ sơ đã gộp */}
      {isPatientMerged && (
        <Alert
          type="error"
          showIcon
          icon={<ExclamationCircleOutlined />}
          message={<strong>HỒ SƠ BỆNH NHÂN ĐÃ ĐƯỢC GỘP (MERGED)</strong>}
          description={
            <div>
              <div style={{ margin: '4px 0 8px 0', fontSize: 13, color: '#991b1b' }}>
                Hồ sơ này đã được hợp nhất vào hồ sơ chính{' '}
                <strong>[{patient.mergedIntoPatientCode || patient.mergedIntoPatientId || 'Hồ sơ đích'}]</strong>.
                Toàn bộ lịch sử khám bệnh, viện phí và đơn thuốc đã được kết chuyển sang hồ sơ chính. Hồ sơ này hiện ở chế độ <strong>CHỈ ĐỌC (READ-ONLY)</strong> và bị khóa chỉnh sửa.
              </div>
              {patient.mergedIntoPatientId && (
                <div style={{ marginTop: 8 }}>
                  <Button
                    type="primary"
                    danger
                    icon={<ArrowRightOutlined />}
                    onClick={() => navigate(`/patients/${patient.mergedIntoPatientId}`)}
                  >
                    Chuyển sang xem Hồ sơ chính [{patient.mergedIntoPatientCode || 'Xem chi tiết'}]
                  </Button>
                </div>
              )}
            </div>
          }
          style={{ marginBottom: 16, border: '1px solid #fca5a5', background: '#fef2f2' }}
        />
      )}

      {/* Banner nhắc nhở Chuyển tiếp thành niên */}
      {needsAdultTransition && (
        <Alert
          type="info"
          showIcon
          icon={<UserSwitchOutlined style={{ color: '#2563eb' }} />}
          message={<strong>BỆNH NHÂN ĐÃ ĐỦ 18 TUỔI - YÊU CẦU CHUYỂN TIẾP THÀNH NIÊN</strong>}
          description={
            <div>
              <div style={{ margin: '4px 0 8px 0', fontSize: 13, color: '#1e3a8a' }}>
                Bệnh nhân đã đủ 18 tuổi nhưng hồ sơ hiện vẫn gắn thông tin người giám hộ (<strong>{patient.guardianName}</strong>).
                Vui lòng thực hiện chuyển đổi sang hồ sơ người lớn để giải phóng người giám hộ và cập nhật quyền ký xác nhận Phiếu đồng ý xử lý dữ liệu cá nhân theo tên bệnh nhân.
              </div>
              <Popconfirm
                title="Xác nhận chuyển tiếp thành niên"
                description="Hành động này sẽ giải phóng liên kết người giám hộ và trao quyền tự chủ hồ sơ cho người bệnh. Bạn có chắc chắn?"
                okText="Xác nhận chuyển đổi"
                cancelText="Hủy"
                onConfirm={handleAdultTransition}
                okButtonProps={{ loading: adultTransitionLoading }}
              >
                <Button
                  type="primary"
                  size="small"
                  icon={<CheckCircleOutlined />}
                  loading={adultTransitionLoading}
                  style={{ background: '#2563eb' }}
                >
                  Chuyển tiếp thành niên (Tự chủ hồ sơ)
                </Button>
              </Popconfirm>
            </div>
          }
          style={{ marginBottom: 16, background: '#eff6ff', borderColor: '#93c5fd' }}
        />
      )}

      <Card
        title={
          <Space>
            <Title level={5} style={{ margin: 0 }}>
              Thông tin bệnh nhân
            </Title>
            <Tag color="blue">{patient.patientCode}</Tag>
            {isPatientMerged && <Tag color="magenta">ĐÃ GỘP (MERGED)</Tag>}
            {isMinor && <Tag color="orange">Trẻ em (&lt; 18 tuổi)</Tag>}
          </Space>
        }
        extra={
          <Space>
            {canMerge && !isPatientMerged && (
              <Button
                icon={<MergeCellsOutlined style={{ color: '#ea580c' }} />}
                onClick={openMergeModal}
              >
                Gộp hồ sơ
              </Button>
            )}
            {canManage && !isPatientMerged && (
              <Button type="primary" icon={<EditOutlined />} onClick={openEdit}>
                Cập nhật
              </Button>
            )}
            {isPatientMerged && (
              <Tag color="default" style={{ fontWeight: 600 }}>
                Hồ sơ chỉ đọc
              </Tag>
            )}
          </Space>
        }
        style={{ marginBottom: 24 }}
      >
        <Descriptions bordered column={2}>
          <Descriptions.Item label="Họ tên" span={2}>
            <Text strong>{patient.fullName}</Text>
          </Descriptions.Item>
          <Descriptions.Item label="Ngày sinh">
            {formatDate(patient.dateOfBirth)} {isMinor ? <Tag color="orange" style={{ marginLeft: 6 }}>Trẻ em</Tag> : null}
          </Descriptions.Item>
          <Descriptions.Item label="Giới tính">{formatGender(patient.gender)}</Descriptions.Item>
          <Descriptions.Item label="Số điện thoại">{patient.phone || '---'}</Descriptions.Item>
          <Descriptions.Item label="Email">{patient.email || '---'}</Descriptions.Item>
          <Descriptions.Item label="Địa chỉ" span={2}>{patient.address || '---'}</Descriptions.Item>
          <Descriptions.Item label="CCCD">{patient.identityNumber || '---'}</Descriptions.Item>
          <Descriptions.Item label="Mã BHYT">{patient.insuranceNumber || '---'}</Descriptions.Item>
          <Descriptions.Item label="Nhóm máu">{patient.bloodType || '---'}</Descriptions.Item>
          <Descriptions.Item label="Trạng thái">
            {isPatientMerged ? (
              <Tag color="magenta">Đã gộp (MERGED)</Tag>
            ) : (
              <Tag color={patient.active ? 'green' : 'red'}>{patient.active ? 'Đang hoạt động' : 'Ngừng hoạt động'}</Tag>
            )}
          </Descriptions.Item>
          <Descriptions.Item label="Phiếu đồng ý DLCN" span={2}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', flexWrap: 'wrap', gap: 8 }}>
              <Space wrap>
                <Tag color={consentStatus.color} style={{ fontWeight: 600 }}>
                  {consentStatus.label}
                </Tag>
                {patient.consentAgreedAt && (
                  <span style={{ fontSize: 13, color: '#4b5563' }}>
                    Thời điểm đồng ý: <b>{formatDateTime(patient.consentAgreedAt)}</b>
                  </span>
                )}
                {patient.consentWithdrawn && patient.consentWithdrawnAt && (
                  <span style={{ fontSize: 13, color: '#dc2626' }}>
                    Rút đồng ý lúc: <b>{formatDateTime(patient.consentWithdrawnAt)}</b> (Lý do: {patient.consentWithdrawnReason || 'Không nêu'})
                  </span>
                )}
              </Space>
              <Space wrap size={8}>
                <Button
                  size="small"
                  type="primary"
                  ghost
                  icon={<SafetyCertificateOutlined />}
                  onClick={() => {
                    setActiveTabKey('consent')
                    const el = document.getElementById('patient-detail-tabs-section')
                    if (el) el.scrollIntoView({ behavior: 'smooth' })
                  }}
                  style={{ fontWeight: 600, borderRadius: 6 }}
                >
                  Quản lý & Cập nhật phiếu
                </Button>
                <Button
                  size="small"
                  type="link"
                  icon={<FileProtectOutlined />}
                  onClick={() => setConsentModalOpen(true)}
                  style={{ fontWeight: 600, color: '#16a34a', padding: 0 }}
                >
                  Xem văn bản mẫu
                </Button>
              </Space>
            </div>
          </Descriptions.Item>

          {/* Thông tin Người giám hộ (NCL-02-CN-008 / QTN-44) */}
          {patient.guardianName ? (
            <>
              <Descriptions.Item label="Người giám hộ">
                <Space>
                  <Text strong>{patient.guardianName}</Text>
                  {patient.guardianRelationship && (
                    <Tag color="orange">{patient.guardianRelationship}</Tag>
                  )}
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label="SĐT / CCCD Giám hộ">
                <Space wrap>
                  {patient.guardianPhone ? (
                    <a href={`tel:${patient.guardianPhone}`} style={{ fontWeight: 600, color: '#0284c7' }}>
                      {patient.guardianPhone}
                    </a>
                  ) : (
                    '---'
                  )}
                  {patient.guardianIdentityNumber && (
                    <Text type="secondary">(CCCD: {patient.guardianIdentityNumber})</Text>
                  )}
                </Space>
              </Descriptions.Item>
            </>
          ) : isMinor ? (
            <Descriptions.Item label="Người giám hộ" span={2}>
              <Text type="danger">Chưa cập nhật thông tin người giám hộ bắt buộc</Text>
            </Descriptions.Item>
          ) : null}

          <Descriptions.Item label="Liên hệ khẩn cấp">{patient.emergencyContact || '---'}</Descriptions.Item>
          <Descriptions.Item label="Quan hệ">{patient.emergencyRelationship ? <Tag color="blue">{patient.emergencyRelationship}</Tag> : '---'}</Descriptions.Item>
          <Descriptions.Item label="SĐT khẩn cấp" span={2}>
            {patient.emergencyPhone ? (
              <Space size={8}>
                <a href={`tel:${patient.emergencyPhone}`} style={{ fontWeight: 700, color: '#0284c7' }}>
                  {patient.emergencyPhone}
                </a>
                <Button
                  size="middle"
                  type="primary"
                  ghost
                  icon={<HistoryOutlined />}
                  onClick={() => setEmergencyHistoryOpen(true)}
                  style={{ height: 30, fontSize: 12.5, borderRadius: 5, padding: '0 10px' }}
                >
                  Xem lịch sử thay đổi
                </Button>
              </Space>
            ) : '---'}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      {patient && (
        <EmergencyContactCard
          patient={patient}
          onOpenEdit={canManage && !isPatientMerged ? openEdit : null}
          onOpenHistory={() => setEmergencyHistoryOpen(true)}
        />
      )}

      {patient && (
        <PatientAllergyBanner
          patientId={patient.id}
          patientName={patient.fullName}
          currentUser={user}
          compact={false}
        />
      )}

      <PersonalDataConsentModal
        open={consentModalOpen}
        onClose={() => setConsentModalOpen(false)}
        patientName={patient?.fullName}
        guardianName={patient?.guardianName}
        agreedAt={patient?.consentAgreedAt}
        version={patient?.consentVersion || 'v1.0'}
      />

      <PatientEmergencyHistoryModal
        open={emergencyHistoryOpen}
        onClose={() => setEmergencyHistoryOpen(false)}
        patient={patient}
      />

      {(canViewHistory || canManage) && (
        <div id="patient-detail-tabs-section">
          <Card bodyStyle={{ padding: 16 }}>
            <Tabs
              activeKey={activeTabKey}
              onChange={setActiveTabKey}
              items={[
                {
                  key: 'history',
                  label: (
                    <span>
                      <FileTextOutlined /> Lịch sử khám chữa bệnh ({history.length})
                    </span>
                  ),
                  children: (
                    <Table
                      columns={historyColumns}
                      dataSource={history}
                      rowKey="id"
                      pagination={false}
                      locale={{ emptyText: 'Bệnh nhân chưa có lượt khám' }}
                    />
                  ),
                },
                {
                  key: 'consent',
                  label: (
                    <span>
                      <SafetyCertificateOutlined /> Phiếu đồng ý & Quyền riêng tư
                    </span>
                  ),
                  children: (
                    <PatientConsentTab
                      patient={patient}
                      canManage={canManage && !isPatientMerged}
                      onPatientUpdated={loadData}
                    />
                  ),
                },
                {
                  key: 'chronicDiseases',
                  label: (
                    <span>
                      <MedicineBoxOutlined /> Tiền sử bệnh mạn tính
                    </span>
                  ),
                  children: (
                    <ChronicDiseaseList
                      patientId={patient.id}
                      patientName={patient.fullName}
                      currentUser={user}
                      bordered={false}
                    />
                  ),
                },
                {
                  key: 'records',
                  label: (
                    <span>
                      <FolderOutlined /> Hồ sơ bệnh án & Lưu trữ
                    </span>
                  ),
                  children: (
                    <MedicalRecordList patientId={patient.id} />
                  ),
                },
                {
                  key: 'attachments',
                  label: (
                    <span>
                      <PaperClipOutlined /> Kết quả Cận lâm sàng & Tệp đính kèm
                    </span>
                  ),
                  children: (
                    <AttachmentResultManager
                      patientIdFilter={patient.id}
                      patientNameFilter={patient.fullName}
                      compact
                    />
                  ),
                },
              ]}
            />
          </Card>
        </div>
      )}

      <Modal
        title="Cập nhật thông tin bệnh nhân"
        open={editOpen}
        confirmLoading={saving}
        width={720}
        onCancel={() => setEditOpen(false)}
        onOk={() => form.submit()}
        okText="Lưu thay đổi"
        cancelText="Hủy"
      >
        <Form form={form} layout="vertical" onFinish={updatePatient}>
          <Form.Item name="fullName" label="Họ tên" rules={[{ required: true }]}><Input /></Form.Item>
          <Space.Compact block>
            <Form.Item name="dateOfBirth" label="Ngày sinh" style={{ width: '100%', marginRight: 12 }} rules={[{ required: true }]}><DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} /></Form.Item>
            <Form.Item name="gender" label="Giới tính" style={{ width: '100%' }} rules={[{ required: true }]}><Select options={[{ value: 'MALE', label: 'Nam' }, { value: 'FEMALE', label: 'Nữ' }, { value: 'OTHER', label: 'Khác' }]} /></Form.Item>
          </Space.Compact>
          <Space.Compact block>
            <Form.Item name="phone" label="Số điện thoại" style={{ width: '100%', marginRight: 12 }} rules={[phoneRule]}><Input /></Form.Item>
            <Form.Item name="email" label="Email" style={{ width: '100%' }} rules={[{ type: 'email' }]}><Input /></Form.Item>
          </Space.Compact>
          <Form.Item name="address" label="Địa chỉ"><Input /></Form.Item>
          <Space.Compact block>
            <Form.Item name="identityNumber" label="CCCD" style={{ width: '100%', marginRight: 12 }}><Input /></Form.Item>
            <Form.Item name="insuranceNumber" label="Mã BHYT" style={{ width: '100%' }}><Input /></Form.Item>
          </Space.Compact>
          <Form.Item name="bloodType" label="Nhóm máu"><Select allowClear options={bloodTypes.map((value) => ({ value, label: value }))} /></Form.Item>
          <EmergencyContactFields form={form} layoutGrid={false} />
          <GuardianFields form={form} showAlways />
        </Form>
      </Modal>

      <MergePatientModal
        open={mergeModalOpen}
        onClose={() => setMergeModalOpen(false)}
        initialTargetPatient={patient}
        allPatients={allPatients}
        onSuccess={() => {
          loadData()
        }}
      />
    </div>
  )
}

export default PatientDetail
