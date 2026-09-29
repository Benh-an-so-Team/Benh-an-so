import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import {
  Avatar,
  Button,
  DatePicker,
  Dropdown,
  Form,
  Input,
  message,
  Modal,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
} from 'antd'
import {
  CalendarOutlined,
  CopyOutlined,
  DownloadOutlined,
  EditOutlined,
  EyeOutlined,
  FilterOutlined,
  HeartOutlined,
  InboxOutlined,
  MoreOutlined,
  PlusOutlined,
  SearchOutlined,
  TeamOutlined,
  UserAddOutlined,
  UsergroupAddOutlined,
  UserOutlined,
  UsergroupDeleteOutlined,
  MergeCellsOutlined,
  UploadOutlined,
  FileExcelOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import patientApi from '../api/patientApi'
import { useAuthContext } from '../context/AuthContext'
import { formatDate } from '../utils/helpers'
import PersonalDataConsentField from '../components/patient/PersonalDataConsentField'
import { getPatientConsentStatus } from '../constants/patientConsentConstants'
import EmergencyContactFields from '../components/patient/EmergencyContactFields'
import { validateEmergencyContactTriplet } from '../utils/emergencyContactValidation'
import GuardianFields from '../components/patient/GuardianFields'
import MergePatientModal from '../components/patient/MergePatientModal'
import DuplicatePatientsDrawer from '../components/patient/DuplicatePatientsDrawer'
import { isMinorPatient, validateGuardianFields } from '../utils/patientGuardianValidation'
import { canUserMergePatients } from '../utils/patientMergeValidation'

const { RangePicker } = DatePicker

const avatarPalette = [
  ['#e6f0ff', '#236bd8'],
  ['#fff0e5', '#c26a2d'],
  ['#e8f7ef', '#21835a'],
  ['#f3eaff', '#7743bd'],
]

const getInitials = (name = '') => name
  .trim()
  .split(/\s+/)
  .slice(-2)
  .map((part) => part[0])
  .join('')
  .toUpperCase()

const getPatientStatus = (patient) => {
  if (patient.isMerged || patient.status === 'MERGED' || patient.mergedIntoPatientId) {
    return { label: 'Đã gộp', tone: 'purple' }
  }
  return patient.active === false
    ? { label: 'Đã lưu trữ', tone: 'gray' }
    : { label: 'Đang điều trị', tone: 'green' }
}

function PatientList() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuthContext()
  const userPermissions = useMemo(() => {
    return (user?.permissions || []).map((p) => String(p || '').toUpperCase().replace(/^PERMISSION_/, ''))
  }, [user])

  const userRoles = useMemo(() => {
    return (user?.roles || []).map((r) => String(r || '').toLowerCase().replace(/^role_/, ''))
  }, [user])
  const canCreatePatient = userPermissions.includes('PATIENT_CREATE')
  const canUpdatePatient = userPermissions.includes('PATIENT_UPDATE')
  const canReadPatient = userPermissions.includes('PATIENT_READ')
  const canImportPatient = userPermissions.includes('PATIENT_IMPORT') || userRoles.includes('admin') || userRoles.includes('receptionist')
  const canBookAppointment = userPermissions.includes('APPOINTMENT_CREATE') || userPermissions.includes('APPOINTMENT_READ')
  const canManage = canCreatePatient || canUpdatePatient
  const canMerge = canUserMergePatients(user?.roles, userPermissions)

  const [loading, setLoading] = useState(false)
  const [keyword, setKeyword] = useState('')
  const [searchText, setSearchText] = useState('')

  useEffect(() => {
    if (location.state?.keyword) {
      setSearchText(location.state.keyword)
      setKeyword(location.state.keyword)
    }
  }, [location.state?.keyword])

  const [allPatients, setAllPatients] = useState([])
  const [genderFilter, setGenderFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [dateRange, setDateRange] = useState(null)
  const [selectedRowKeys, setSelectedRowKeys] = useState([])
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(5)
  const [registerOpen, setRegisterOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [registerForm] = Form.useForm()

  // Merge modal and duplicate drawer states
  const [mergeModalOpen, setMergeModalOpen] = useState(false)
  const [mergeTargetPatient, setMergeTargetPatient] = useState(null)
  const [mergeSourcePatient, setMergeSourcePatient] = useState(null)
  const [duplicatesDrawerOpen, setDuplicatesDrawerOpen] = useState(false)

  // Form watches for minor & consent
  const registeredFullName = Form.useWatch('fullName', registerForm)
  const registeredDob = Form.useWatch('dateOfBirth', registerForm)
  const registeredGuardianName = Form.useWatch('guardianName', registerForm)
  const isRegisteredMinor = isMinorPatient(registeredDob)

  const loadPatients = useCallback(async () => {
    setLoading(true)
    try {
      const response = await patientApi.getAll({ page: 0, size: 500 })
      const apiList = response?.data?.content || (Array.isArray(response?.data) ? response.data : [])
      setAllPatients(apiList)
    } catch {
      setAllPatients([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadPatients() }, [loadPatients])

  const filteredPatients = useMemo(() => {
    const kw = keyword.trim().toLowerCase()
    return allPatients.filter((patient) => {
      const matchesKeyword = !kw || [
        patient.fullName,
        patient.patientCode,
        patient.phone,
        patient.phoneNumber,
        patient.identityNumber,
        patient.insuranceNumber,
        patient.address,
      ].some((val) => String(val || '').toLowerCase().includes(kw))

      const matchesGender = genderFilter === 'ALL' || patient.gender === genderFilter
      const isMerged = Boolean(patient.isMerged || patient.status === 'MERGED' || patient.mergedIntoPatientId)
      const matchesStatus = statusFilter === 'ALL'
        || (statusFilter === 'ACTIVE' ? (patient.active !== false && !isMerged) : false)
        || (statusFilter === 'ARCHIVED' ? (patient.active === false && !isMerged) : false)
        || (statusFilter === 'MERGED' ? isMerged : false)

      const createdAt = patient.createdAt ? dayjs(patient.createdAt) : null
      const matchesDate = !dateRange?.length || (createdAt
        && !createdAt.isBefore(dateRange[0].startOf('day'))
        && !createdAt.isAfter(dateRange[1].endOf('day')))

      return matchesKeyword && matchesGender && matchesStatus && matchesDate
    })
  }, [allPatients, dateRange, genderFilter, keyword, statusFilter])

  const paginatedPatients = useMemo(() => {
    const start = page * pageSize
    return filteredPatients.slice(start, start + pageSize)
  }, [filteredPatients, page, pageSize])

  const activeCount = useMemo(() => allPatients.filter((patient) => patient.active !== false && !patient.isMerged && patient.status !== 'MERGED').length, [allPatients])
  const archivedCount = useMemo(() => allPatients.filter((patient) => patient.active === false && !patient.isMerged && patient.status !== 'MERGED').length, [allPatients])
  const mergedCount = useMemo(() => allPatients.filter((patient) => patient.isMerged || patient.status === 'MERGED' || patient.mergedIntoPatientId).length, [allPatients])
  const newCount = useMemo(() => allPatients.filter((patient) => patient.createdAt && dayjs().diff(dayjs(patient.createdAt), 'day') <= 30).length, [allPatients])

  const patientStats = [
    { key: 'total', label: 'Tổng bệnh nhân', value: allPatients.length, note: '12,5% so với tháng trước', trend: 'up', icon: TeamOutlined, tone: 'blue' },
    { key: 'new', label: 'Bệnh nhân mới', value: newCount, note: '8,3% so với tháng trước', trend: 'up', icon: UserAddOutlined, tone: 'green' },
    { key: 'active', label: 'Đang điều trị', value: activeCount, note: 'Không đổi so với tháng trước', trend: 'flat', icon: HeartOutlined, tone: 'orange' },
    { key: 'archived', label: 'Hồ sơ đã lưu trữ', value: archivedCount, note: '4,1% so với tháng trước', trend: 'up', icon: InboxOutlined, tone: 'purple' },
  ]

  const handleRegister = async (values) => {
    setSaving(true)
    try {
      // 1. Kiểm tra Người liên hệ khẩn cấp (nếu có nhập)
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

      // 2. Kiểm tra Người giám hộ nếu là bệnh nhân dưới 18 tuổi (NCL-02-CN-008 / QTN-44)
      const formattedDob = values.dateOfBirth ? values.dateOfBirth.format('YYYY-MM-DD') : null
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

      const payload = {
        ...values,
        dateOfBirth: formattedDob,
        gender: values.gender ? values.gender.toUpperCase() : 'OTHER',
        phone: values.phone || null,
        insuranceNumber: values.insuranceNumber || null,
        emergencyContact: values.emergencyContact?.trim() || null,
        emergencyRelationship: values.emergencyRelationship?.trim() || null,
        emergencyPhone: values.emergencyPhone?.trim() || null,
        guardianName: values.guardianName?.trim() || null,
        guardianPhone: values.guardianPhone?.trim() || null,
        guardianRelationship: values.guardianRelationship?.trim() || null,
        guardianIdentityNumber: values.guardianIdentityNumber?.trim() || null,
        consentAgreed: values.consentAgreed ?? true,
        consentVersion: 'v1.0',
      }
      const response = await patientApi.create(payload)
      const newPatient = response.data
      message.success(`Tạo hồ sơ thành công: ${newPatient?.patientCode || ''}`)
      await loadPatients()
      setRegisterOpen(false)
      registerForm.resetFields()
      setPage(0)

      Modal.confirm({
        title: `Đã tạo thành công bệnh nhân: ${newPatient?.fullName}`,
        content: 'Bạn có muốn CHUYỂN SANG BƯỚC TIẾP THEO (Đặt lịch khám & Xếp hàng) cho bệnh nhân này không?',
        okText: 'Chuyển sang Đặt lịch khám',
        cancelText: 'Về danh sách bệnh nhân',
        onOk: () => navigate('/appointments', { state: { patientId: newPatient?.id, patientName: newPatient?.fullName } }),
      })
    } catch (err) {
      const errorMsg = err.response?.data?.message || err.message || 'Không thể tạo hồ sơ bệnh nhân trên Backend'
      message.error(`Lỗi tạo hồ sơ: ${errorMsg}`)
    } finally {
      setSaving(false)
    }
  }

  const submitSearch = () => {
    setPage(0)
    setSelectedRowKeys([])
    setKeyword(searchText.trim())
  }

  const resetFilters = () => {
    setGenderFilter('ALL')
    setStatusFilter('ALL')
    setDateRange(null)
    setSelectedRowKeys([])
  }

  const exportPatients = () => {
    if (!filteredPatients.length) {
      message.info('Không có dữ liệu để xuất')
      return
    }

    const headers = [
      'TÊN PHÒNG KHÁM',
      'TÊN BỆNH NHÂN',
      'MÃ BỆNH NHÂN',
      'GIỚI TÍNH',
      'SĐT',
      'EMAIL',
      'NGÀY NHẬP VIỆN',
      'THÔNG TIN BỆNH',
      'THÔNG TIN ĐƠN THUỐC',
    ]

    const escapeXml = (str) => {
      if (str === null || str === undefined) return ''
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;')
    }

    const rowsXml = filteredPatients.map((patient, index) => {
      const clinicName = patient.clinicName || patient.roomName || patient.department || patient.room || `Phòng khám ${index + 1}`
      const fullName = patient.fullName || patient.name || ''
      const patientCode = patient.patientCode || patient.code || ''
      const gender = patient.gender === 'FEMALE' ? 'Nữ' : patient.gender === 'MALE' ? 'Nam' : (patient.gender || '')
      const phone = patient.phone || patient.phoneNumber || ''
      const email = patient.email || ''
      const admissionDate = patient.admissionDate || patient.hospitalizationDate || patient.visitDate || (patient.createdAt ? formatDate(patient.createdAt) : '')
      const diseaseInfo = patient.medicalCondition || patient.diagnosis || patient.diseaseInfo || patient.medicalHistory || ''
      const prescriptionInfo = patient.prescriptionInfo || patient.prescription || patient.medicines || patient.treatment || ''

      const cells = [clinicName, fullName, patientCode, gender, phone, email, admissionDate, diseaseInfo, prescriptionInfo]

      return '   <Row>\n' +
        cells.map((cell) => `    <Cell><Data ss:Type="String">${escapeXml(cell)}</Data></Cell>`).join('\n') +
        '\n   </Row>'
    }).join('\n')

    const headerCellsXml = headers.map((h) => `    <Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">${escapeXml(h)}</Data></Cell>`).join('\n')

    const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Bottom"/>
   <Borders/>
   <Font ss:FontName="Segoe UI" x:Family="Swiss" ss:Size="10" ss:Color="#000000"/>
   <Interior/>
   <NumberFormat/>
   <Protection/>
  </Style>
  <Style ss:ID="HeaderStyle">
   <Font ss:FontName="Segoe UI" x:Family="Swiss" ss:Size="10" ss:Bold="1" ss:Color="#000000"/>
   <Interior ss:Color="#E5E7EB" ss:Pattern="Solid"/>
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
  </Style>
 </Styles>
 <Worksheet ss:Name="Thông tin bệnh nhân">
  <Table>
   <Row></Row>
   <Row></Row>
   <Row ss:StyleID="HeaderStyle">
${headerCellsXml}
   </Row>
${rowsXml}
  </Table>
 </Worksheet>
</Workbook>`

    const blob = new Blob([xmlContent], { type: 'application/vnd.ms-excel;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `danh-sach-benh-nhan-${dayjs().format('YYYY-MM-DD')}.xls`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const copyPatientCode = async (patientCode) => {
    try {
      await navigator.clipboard.writeText(patientCode)
      message.success('Đã sao chép mã bệnh nhân')
    } catch {
      message.warning('Không thể sao chép mã bệnh nhân')
    }
  }

  const columns = [
    {
      title: 'STT',
      key: 'index',
      width: 50,
      align: 'center',
      render: (_, __, index) => page * pageSize + index + 1,
    },
    {
      title: 'Họ và tên',
      dataIndex: 'fullName',
      key: 'fullName',
      width: 190,
      render: (name, patient, index) => {
        const [background, color] = avatarPalette[index % avatarPalette.length]
        return (
          <div className="patient-name-cell">
            <Avatar style={{ background, color }}>{getInitials(name)}</Avatar>
            <div><strong>{name}</strong><small>{patient.patientCode}</small></div>
          </div>
        )
      },
    },
    {
      title: 'Giới tính',
      dataIndex: 'gender',
      key: 'gender',
      width: 82,
      render: (gender) => (
        <span className={'patient-gender gender-' + String(gender).toLowerCase()}>
          <b>{gender === 'FEMALE' ? '♀' : gender === 'MALE' ? '♂' : '•'}</b>
          {gender === 'FEMALE' ? 'Nữ' : gender === 'MALE' ? 'Nam' : 'Khác'}
        </span>
      ),
    },
    {
      title: 'Ngày sinh',
      dataIndex: 'dateOfBirth',
      key: 'dateOfBirth',
      width: 108,
      render: (value) => (
        <div className="patient-date-cell"><span>{formatDate(value)}</span><small>({dayjs().diff(dayjs(value), 'year')} tuổi)</small></div>
      ),
    },
    { title: 'SĐT', dataIndex: 'phone', key: 'phone', width: 108, render: (value) => value || '—' },
    { title: 'CCCD/CMND', dataIndex: 'identityNumber', key: 'identityNumber', width: 125, render: (value) => value || '—' },
    { title: 'Địa chỉ', dataIndex: 'address', key: 'address', width: 168, ellipsis: true, render: (value) => value || '—' },
    {
      title: 'Trạng thái',
      key: 'status',
      width: 108,
      render: (_, patient) => {
        const status = getPatientStatus(patient)
        return <span className={'patient-status patient-status-' + status.tone}>{status.label}</span>
      },
    },
    {
      title: 'Đồng ý DLCN',
      key: 'consent',
      width: 140,
      render: (_, patient) => {
        const consent = getPatientConsentStatus(patient)
        return <Tag color={consent.color}>{consent.label}</Tag>
      },
    },
    {
      title: 'Thao tác',
      key: 'actions',
      width: 76,
      fixed: 'right',
      align: 'center',
      render: (_, patient) => (
        <div onClick={(event) => event.stopPropagation()} style={{ display: 'inline-block' }}>
          <Dropdown
            trigger={['click']}
            placement="bottomRight"
            menu={{
              items: [
                {
                  key: 'view',
                  icon: <EyeOutlined style={{ color: '#2563eb' }} />,
                  label: 'Xem hồ sơ chi tiết',
                  onClick: () => navigate(`/patients/${patient.id}`, { state: { patient } }),
                },
                ...(canUpdatePatient
                  ? [
                      {
                        key: 'edit',
                        icon: <EditOutlined style={{ color: '#059669' }} />,
                        label: 'Chỉnh sửa thông tin',
                        onClick: () => navigate(`/patients/${patient.id}`, { state: { patient, edit: true } }),
                      },
                    ]
                  : []),
                ...(canBookAppointment
                  ? [
                      {
                        key: 'book',
                        icon: <CalendarOutlined style={{ color: '#d97706' }} />,
                        label: 'Đặt lịch / Tiếp nhận',
                        onClick: () => navigate('/appointments', { state: { patientId: patient.id } }),
                      },
                      {
                        key: 'book-series',
                        icon: <CalendarOutlined style={{ color: '#7c3aed' }} />,
                        label: 'Đặt lịch theo liệu trình',
                        onClick: () => navigate('/appointments', { state: { patientId: patient.id, openSeries: true } }),
                      },
                    ]
                  : []),
                ...(canMerge && !patient.isMerged && patient.status !== 'MERGED'
                  ? [
                      {
                        key: 'merge',
                        icon: <MergeCellsOutlined style={{ color: '#ea580c' }} />,
                        label: 'Gộp hồ sơ trùng...',
                        onClick: () => {
                          setMergeTargetPatient(patient)
                          setMergeSourcePatient(null)
                          setMergeModalOpen(true)
                        },
                      },
                    ]
                  : []),
                { type: 'divider' },
                {
                  key: 'copy',
                  icon: <CopyOutlined />,
                  label: 'Sao chép mã bệnh nhân',
                  onClick: () => copyPatientCode(patient.patientCode),
                },
              ],
            }}
          >
            <Button
              className="patient-action-button"
              icon={<MoreOutlined style={{ fontSize: 16 }} />}
              aria-label="Thao tác"
              title="Thao tác"
            />
          </Dropdown>
        </div>
      ),
    },
  ]

  return (
    <div className="patient-management-page">
      {/* Top Module Navigation Tabs */}
      <Tabs
        activeKey="list"
        onChange={(key) => {
          if (key === 'import') {
            navigate('/patients/import')
          }
        }}
        type="card"
        style={{ marginBottom: 16 }}
        items={[
          {
            key: 'list',
            label: (
              <span style={{ fontWeight: 600, fontSize: 14 }}>
                <TeamOutlined /> Danh sách hồ sơ bệnh nhân
              </span>
            ),
          },
          ...(canImportPatient
            ? [
                {
                  key: 'import',
                  label: (
                    <span style={{ fontWeight: 600, fontSize: 14, color: '#16a34a' }}>
                      <FileExcelOutlined /> Nhập hồ sơ từ Excel
                    </span>
                  ),
                },
              ]
            : []),
        ]}
      />

      <section className="patient-stat-grid" aria-label="Thống kê bệnh nhân">
        {patientStats.map((stat) => {
          const Icon = stat.icon
          return (
            <article className={'patient-stat-card patient-stat-' + stat.tone} key={stat.key}>
              <span className="patient-stat-icon"><Icon /></span>
              <div>
                <small>{stat.label}</small>
                <strong>{Number(stat.value || 0).toLocaleString('vi-VN')}</strong>
                <em className={'patient-trend-' + stat.trend}><b>{stat.trend === 'up' ? '↑' : '—'}</b> {stat.note}</em>
              </div>
            </article>
          )
        })}
      </section>

      <section className="patient-list-card">
        <header className="patient-list-header">
          <h1>Danh sách bệnh nhân</h1>
          <Space size={10}>
            {canMerge && (
              <Button
                icon={<UsergroupDeleteOutlined style={{ color: '#ea580c' }} />}
                onClick={() => setDuplicatesDrawerOpen(true)}
              >
                Rà soát hồ sơ trùng
              </Button>
            )}
            <Button icon={<DownloadOutlined />} onClick={exportPatients}>Xuất Excel</Button>
            {canImportPatient && (
              <Button
                icon={<FileExcelOutlined style={{ color: '#16a34a' }} />}
                onClick={() => navigate('/patients/import')}
                style={{ borderColor: '#86efac', background: '#f0fdf4', color: '#166534', fontWeight: 500 }}
              >
                Nhập hồ sơ Excel
              </Button>
            )}
            {canCreatePatient && <Button type="primary" icon={<PlusOutlined />} onClick={() => setRegisterOpen(true)}>Thêm bệnh nhân</Button>}
          </Space>
        </header>

        <div className="patient-filter-bar">
          <Input
            value={searchText}
            prefix={<SearchOutlined />}
            placeholder="Tìm kiếm theo tên, SĐT, CCCD..."
            allowClear
            onChange={(event) => {
              const val = event.target.value
              setSearchText(val)
              setKeyword(val)
              setPage(0)
            }}
            onPressEnter={submitSearch}
          />
          <Select
            value={genderFilter}
            options={[
              { value: 'ALL', label: 'Tất cả giới tính' },
              { value: 'MALE', label: 'Nam' },
              { value: 'FEMALE', label: 'Nữ' },
              { value: 'OTHER', label: 'Khác' },
            ]}
            onChange={setGenderFilter}
          />
          <RangePicker value={dateRange} placeholder={['Từ ngày', 'Đến ngày']} format="DD/MM/YYYY" onChange={setDateRange} />
          <Select
            value={statusFilter}
            options={[
              { value: 'ALL', label: 'Tất cả trạng thái' },
              { value: 'ACTIVE', label: 'Đang điều trị' },
              { value: 'ARCHIVED', label: 'Đã lưu trữ' },
              { value: 'MERGED', label: 'Đã gộp' },
            ]}
            onChange={setStatusFilter}
          />
          <Button icon={<FilterOutlined />} onClick={resetFilters}>Bộ lọc</Button>
        </div>

        {canMerge && selectedRowKeys.length === 2 && (
          <div
            style={{
              background: '#eff6ff',
              border: '1px solid #bfdbfe',
              borderRadius: 8,
              padding: '10px 16px',
              marginBottom: 12,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 8,
            }}
          >
            <Space>
              <MergeCellsOutlined style={{ color: '#2563eb', fontSize: 18 }} />
              <span style={{ fontWeight: 600, color: '#1e40af' }}>
                Đã chọn 2 hồ sơ bệnh nhân để đối chiếu
              </span>
              <span style={{ fontSize: 13, color: '#4b5563' }}>
                (Bạn có thể thực hiện kiểm tra và hợp nhất 2 hồ sơ này)
              </span>
            </Space>
            <Button
              type="primary"
              size="small"
              icon={<MergeCellsOutlined />}
              style={{ background: '#2563eb' }}
              onClick={() => {
                const p1 = allPatients.find((p) => p.id === selectedRowKeys[0])
                const p2 = allPatients.find((p) => p.id === selectedRowKeys[1])
                setMergeTargetPatient(p1)
                setMergeSourcePatient(p2)
                setMergeModalOpen(true)
              }}
            >
              Tiến hành gộp 2 hồ sơ này
            </Button>
          </div>
        )}

        <Table
          className="patient-record-table"
          columns={columns}
          dataSource={paginatedPatients}
          rowKey="id"
          loading={loading}
          rowSelection={{
            selectedRowKeys,
            onChange: setSelectedRowKeys,
            columnWidth: 42,
            onCell: () => ({ onClick: (event) => event.stopPropagation() }),
          }}
          onRow={(patient) => ({ onClick: () => navigate(`/patients/${patient.id}`, { state: { patient } }) })}
          scroll={{ x: 1095 }}
          pagination={{
            current: page + 1,
            pageSize,
            total: filteredPatients.length,
            showSizeChanger: true,
            pageSizeOptions: [5, 10, 20],
            showTotal: (value, range) => `Hiển thị ${range[0]} - ${range[1]} của ${value.toLocaleString('vi-VN')} bệnh nhân`,
            onChange: (nextPage, nextSize) => {
              setPage(nextPage - 1)
              setPageSize(nextSize)
              setSelectedRowKeys([])
            },
          }}
        />
      </section>

      <Modal
        title="Đăng ký hồ sơ bệnh nhân mới"
        open={registerOpen}
        confirmLoading={saving}
        onCancel={() => setRegisterOpen(false)}
        onOk={() => registerForm.submit()}
        okText="Lưu hồ sơ"
        cancelText="Hủy"
        width={720}
        centered
        className="patient-register-modal"
      >
        <Form className="patient-register-form" form={registerForm} layout="vertical" onFinish={handleRegister} requiredMark="optional">
          <div className="patient-register-grid">
            <Form.Item className="patient-register-full" name="fullName" label="Họ và tên" rules={[{ required: true, message: 'Vui lòng nhập họ tên' }]}><Input placeholder="Nhập họ và tên bệnh nhân" /></Form.Item>
            <Form.Item name="dateOfBirth" label="Ngày sinh" rules={[{ required: true, message: 'Vui lòng chọn ngày sinh' }]}><DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" placeholder="Chọn ngày sinh" /></Form.Item>
            <Form.Item name="gender" label="Giới tính" rules={[{ required: true, message: 'Vui lòng chọn giới tính' }]}><Select style={{ width: '100%' }} placeholder="Chọn giới tính" options={[{ value: 'MALE', label: 'Nam' }, { value: 'FEMALE', label: 'Nữ' }, { value: 'OTHER', label: 'Khác' }]} /></Form.Item>
            <Form.Item name="phone" label="Số điện thoại" rules={[{ pattern: /^0\d{9}$/, message: 'Số điện thoại phải gồm 10 số và bắt đầu bằng 0' }]}><Input placeholder="09xxxxxxxx" /></Form.Item>
            <Form.Item name="email" label="Email" rules={[{ type: 'email', message: 'Email không hợp lệ' }]}><Input placeholder="email@example.com" /></Form.Item>
            <Form.Item className="patient-register-full" name="address" label="Địa chỉ"><Input placeholder="Nhập địa chỉ hiện tại" /></Form.Item>
            <Form.Item name="identityNumber" label="CCCD/CMND"><Input placeholder="Nhập số CCCD/CMND" /></Form.Item>
            <Form.Item name="insuranceNumber" label="Mã BHYT"><Input placeholder="Nhập mã bảo hiểm y tế" /></Form.Item>
            <div className="patient-register-full">
              <EmergencyContactFields form={registerForm} layoutGrid />
            </div>
            <div className="patient-register-full">
              <GuardianFields form={registerForm} layoutGrid />
            </div>
          </div>
          <PersonalDataConsentField
            patientName={registeredFullName}
            isMinor={isRegisteredMinor}
            guardianName={registeredGuardianName}
          />
        </Form>
      </Modal>

      <MergePatientModal
        open={mergeModalOpen}
        onClose={() => {
          setMergeModalOpen(false)
          setMergeTargetPatient(null)
          setMergeSourcePatient(null)
        }}
        initialTargetPatient={mergeTargetPatient}
        initialSourcePatient={mergeSourcePatient}
        allPatients={allPatients}
        onSuccess={() => {
          loadPatients()
          setSelectedRowKeys([])
        }}
      />

      <DuplicatePatientsDrawer
        open={duplicatesDrawerOpen}
        onClose={() => setDuplicatesDrawerOpen(false)}
        canMerge={canMerge}
        onSelectMerge={(target, source) => {
          setDuplicatesDrawerOpen(false)
          setMergeTargetPatient(target)
          setMergeSourcePatient(source)
          setMergeModalOpen(true)
        }}
      />
    </div>
  )
}

export default PatientList
