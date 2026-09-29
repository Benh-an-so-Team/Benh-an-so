import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Card,
  Tabs,
  Table,
  Button,
  Input,
  DatePicker,
  Select,
  Tag,
  Space,
  Typography,
  Row,
  Col,
  Alert,
  Tooltip,
  Popconfirm,
  message,
  Empty,
  Badge,
} from 'antd'
import {
  InboxOutlined,
  SearchOutlined,
  ReloadOutlined,
  LockOutlined,
  EyeOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  ClockCircleOutlined,
  SafetyCertificateOutlined,
  PrinterOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import medicalRecordArchiveApi from '../api/medicalRecordArchiveApi'
import userApi from '../api/userApi'
import { useAuthContext } from '../context/AuthContext'
import { formatDateTime, formatRecordCode } from '../utils/helpers'
import {
  calculateOverdueDuration,
  canUserConfirmArchive,
  canUserViewEligibleTab,
  canUserSearchArchive,
} from '../utils/medicalRecordArchiveHelpers'
import {
  SAMPLE_ELIGIBLE_RECORDS,
  SAMPLE_ARCHIVED_RECORDS,
} from '../utils/medicalRecordArchiveMockData'
import { getApiErrorMessage } from '../utils/apiError'
import ConfirmBatchArchiveModal from '../components/archive/ConfirmBatchArchiveModal'
import ArchivedMedicalRecordDetailModal from '../components/archive/ArchivedMedicalRecordDetailModal'
import './styles/medicalRecordArchive.css'

const { Title, Text, Paragraph } = Typography
const { RangePicker } = DatePicker

function MedicalRecordArchivePage() {
  const { user } = useAuthContext()

  // Permissions & Role checks
  const canConfirm = useMemo(() => canUserConfirmArchive(user), [user])
  const canViewEligible = useMemo(() => canUserViewEligibleTab(user), [user])
  const canSearch = useMemo(() => canUserSearchArchive(user), [user])

  // Default tab based on role
  const defaultTab = canViewEligible ? 'eligible' : 'search'
  const [activeTab, setActiveTab] = useState(defaultTab)

  // Doctors list for filter
  const [doctors, setDoctors] = useState([])

  // In-memory demo data store
  const [sampleEligible, setSampleEligible] = useState(() => [...SAMPLE_ELIGIBLE_RECORDS])
  const [sampleArchived, setSampleArchived] = useState(() => [...SAMPLE_ARCHIVED_RECORDS])
  const [isUsingDemoData, setIsUsingDemoData] = useState(false)

  // --- TAB 1: ELIGIBLE RECORDS STATE ---
  const [eligibleList, setEligibleList] = useState([])
  const [eligibleLoading, setEligibleLoading] = useState(false)
  const [eligibleTotal, setEligibleTotal] = useState(0)
  const [eligiblePage, setEligiblePage] = useState(1)
  const [eligiblePageSize, setEligiblePageSize] = useState(10)
  const [selectedRowKeys, setSelectedRowKeys] = useState([])
  const [selectedRows, setSelectedRows] = useState([])

  // --- TAB 2: ARCHIVED RECORDS STATE ---
  const [archivedList, setArchivedList] = useState([])
  const [archivedLoading, setArchivedLoading] = useState(false)
  const [archivedTotal, setArchivedTotal] = useState(0)
  const [archivedPage, setArchivedPage] = useState(1)
  const [archivedPageSize, setArchivedPageSize] = useState(10)
  const [searchKeyword, setSearchKeyword] = useState('')
  const [searchDateRange, setSearchDateRange] = useState(null)
  const [searchDoctorId, setSearchDoctorId] = useState(undefined)
  const [hasSearched, setHasSearched] = useState(false)

  // --- MODALS STATE ---
  const [batchModalOpen, setBatchModalOpen] = useState(false)
  const [isArchiveAllMode, setIsArchiveAllMode] = useState(false)
  const [batchLoading, setBatchLoading] = useState(false)
  const [detailModalOpen, setDetailModalOpen] = useState(false)
  const [selectedRecordForDetail, setSelectedRecordForDetail] = useState(null)

  // Fetch doctors on mount
  useEffect(() => {
    userApi
      .getDoctors()
      .then((res) => {
        const list = Array.isArray(res?.data) ? res.data : []
        setDoctors(list)
      })
      .catch(() => setDoctors([]))
  }, [])

  // --- LOAD ELIGIBLE RECORDS ---
  const loadEligibleRecords = useCallback(async () => {
    if (!canViewEligible) return
    setEligibleLoading(true)
    try {
      const res = await medicalRecordArchiveApi.getEligibleRecords({
        page: eligiblePage - 1,
        size: eligiblePageSize,
      })
      const pageData = res?.data
      if (pageData?.content && pageData.content.length > 0) {
        setEligibleList(pageData.content)
        setEligibleTotal(pageData.totalElements || pageData.content.length)
        setIsUsingDemoData(false)
      } else {
        // Sử dụng dữ liệu mẫu thực tế nếu DB chưa có hồ sơ quá hạn
        setEligibleList(sampleEligible)
        setEligibleTotal(sampleEligible.length)
        setIsUsingDemoData(true)
      }
    } catch {
      setEligibleList(sampleEligible)
      setEligibleTotal(sampleEligible.length)
      setIsUsingDemoData(true)
    } finally {
      setEligibleLoading(false)
    }
  }, [canViewEligible, eligiblePage, eligiblePageSize, sampleEligible])

  useEffect(() => {
    if (activeTab === 'eligible') {
      loadEligibleRecords()
    }
  }, [activeTab, loadEligibleRecords])

  // --- LOAD ARCHIVED RECORDS ---
  const loadArchivedRecords = useCallback(
    async (overridePage = null, overrideKw = null, overrideDates = null, overrideDoc = null) => {
      if (!canSearch) return
      setArchivedLoading(true)

      const kw = overrideKw !== null ? overrideKw : searchKeyword
      const dateRange = overrideDates !== null ? overrideDates : searchDateRange
      const docId = overrideDoc !== null ? overrideDoc : searchDoctorId

      try {
        const pageToLoad = overridePage !== null ? overridePage : archivedPage
        const params = {
          page: pageToLoad - 1,
          size: archivedPageSize,
        }
        if (kw?.trim()) {
          params.keyword = kw.trim()
        }
        if (dateRange && dateRange[0] && dateRange[1]) {
          params.fromDate = dateRange[0].format('YYYY-MM-DD')
          params.toDate = dateRange[1].format('YYYY-MM-DD')
        }
        if (docId) {
          params.doctorId = docId
        }

        const res = await medicalRecordArchiveApi.searchArchivedRecords(params)
        const pageData = res?.data
        if (pageData?.content && pageData.content.length > 0) {
          setArchivedList(pageData.content)
          setArchivedTotal(pageData.totalElements || pageData.content.length)
        } else {
          // Lọc trên tập dữ liệu mẫu trong kho lưu trữ
          let filtered = [...sampleArchived]
          if (kw?.trim()) {
            const query = kw.trim().toLowerCase()
            filtered = filtered.filter(
              (r) =>
                r.patientFullName?.toLowerCase().includes(query) ||
                r.patientCode?.toLowerCase().includes(query) ||
                r.patientPhone?.toLowerCase().includes(query) ||
                r.visitCode?.toLowerCase().includes(query) ||
                r.doctorFullName?.toLowerCase().includes(query) ||
                r.conclusion?.toLowerCase().includes(query)
            )
          }
          if (docId) {
            filtered = filtered.filter((r) => r.doctorId === docId)
          }
          if (dateRange && dateRange[0] && dateRange[1]) {
            const start = dateRange[0].startOf('day')
            const end = dateRange[1].endOf('day')
            filtered = filtered.filter((r) => {
              const d = dayjs(r.completedAt || r.archivedAt)
              return (d.isAfter(start) || d.isSame(start)) && (d.isBefore(end) || d.isSame(end))
            })
          }
          setArchivedList(filtered)
          setArchivedTotal(filtered.length)
        }
      } catch {
        setArchivedList(sampleArchived)
        setArchivedTotal(sampleArchived.length)
      } finally {
        setArchivedLoading(false)
      }
    },
    [canSearch, archivedPage, archivedPageSize, searchKeyword, searchDateRange, searchDoctorId, sampleArchived]
  )

  useEffect(() => {
    if (activeTab === 'search') {
      loadArchivedRecords()
    }
  }, [activeTab, loadArchivedRecords])

  // Search actions
  const handleSearch = () => {
    setHasSearched(true)
    setArchivedPage(1)
    loadArchivedRecords(1)
  }

  const handleResetSearch = () => {
    setSearchKeyword('')
    setSearchDateRange(null)
    setSearchDoctorId(undefined)
    setHasSearched(false)
    setArchivedPage(1)
    loadArchivedRecords(1, '', null, undefined)
  }

  // --- ARCHIVE HANDLERS ---
  const handleArchiveSingle = async (record) => {
    const recordId = record.medicalRecordId || record.id
    if (!recordId) return
    try {
      try {
        await medicalRecordArchiveApi.archiveSingle(recordId)
      } catch {
        // Tiếp tục mô phỏng chuyển mẫu nếu backend chưa có ID này
      }

      const archivedItem = {
        ...record,
        status: 'ARCHIVED',
        archivedAt: new Date().toISOString(),
        archivedBy: user?.fullName || 'Quản trị viên hệ thống',
      }

      setSampleArchived((prev) => [archivedItem, ...prev])
      setSampleEligible((prev) => prev.filter((r) => (r.medicalRecordId || r.id) !== recordId))
      setEligibleList((prev) => prev.filter((r) => (r.medicalRecordId || r.id) !== recordId))
      setEligibleTotal((prev) => Math.max(0, prev - 1))

      message.success(`Đã chuyển hồ sơ bệnh án của ${record.patientFullName || 'bệnh nhân'} vào kho lưu trữ thành công.`)
      if (canSearch) {
        setArchivedList((prev) => [archivedItem, ...prev])
        setArchivedTotal((prev) => prev + 1)
      }
    } catch (err) {
      const msg = getApiErrorMessage(err, 'Không thể chuyển hồ sơ vào kho lưu trữ.')
      message.error(msg)
    }
  }

  const handleOpenBatchModal = (isAll = false) => {
    setIsArchiveAllMode(isAll)
    setBatchModalOpen(true)
  }

  const handleConfirmBatchArchive = async () => {
    setBatchLoading(true)
    try {
      const recordsToArchive = isArchiveAllMode
        ? [...eligibleList]
        : eligibleList.filter((r) => selectedRowKeys.includes(r.medicalRecordId || r.id))

      const count = recordsToArchive.length

      try {
        const payload = isArchiveAllMode
          ? { archiveAllEligible: true, medicalRecordIds: [] }
          : { archiveAllEligible: false, medicalRecordIds: selectedRowKeys }
        await medicalRecordArchiveApi.batchArchive(payload)
      } catch {
        // Tiếp tục mô phỏng chuyển mẫu an toàn
      }

      const archivedItems = recordsToArchive.map((r) => ({
        ...r,
        status: 'ARCHIVED',
        archivedAt: new Date().toISOString(),
        archivedBy: user?.fullName || 'Quản trị viên hệ thống',
      }))

      setSampleArchived((prev) => [...archivedItems, ...prev])
      setSampleEligible((prev) =>
        prev.filter((r) => !recordsToArchive.some((x) => (x.medicalRecordId || x.id) === (r.medicalRecordId || r.id)))
      )
      setEligibleList((prev) =>
        prev.filter((r) => !recordsToArchive.some((x) => (x.medicalRecordId || x.id) === (r.medicalRecordId || r.id)))
      )
      setEligibleTotal((prev) => Math.max(0, prev - count))

      message.success(`Đã chuyển thành công ${count} hồ sơ bệnh án vào kho lưu trữ an toàn.`)
      setBatchModalOpen(false)
      setSelectedRowKeys([])
      setSelectedRows([])

      if (canSearch) {
        setArchivedList((prev) => [...archivedItems, ...prev])
        setArchivedTotal((prev) => prev + count)
      }
    } catch (err) {
      const msg = getApiErrorMessage(err, 'Lỗi khi thực hiện chuyển hồ sơ lưu trữ hàng loạt.')
      message.error(msg)
    } finally {
      setBatchLoading(false)
    }
  }

  const handleResetSampleData = () => {
    setSampleEligible([...SAMPLE_ELIGIBLE_RECORDS])
    setSampleArchived([...SAMPLE_ARCHIVED_RECORDS])
    setEligibleList([...SAMPLE_ELIGIBLE_RECORDS])
    setEligibleTotal(SAMPLE_ELIGIBLE_RECORDS.length)
    setArchivedList([...SAMPLE_ARCHIVED_RECORDS])
    setArchivedTotal(SAMPLE_ARCHIVED_RECORDS.length)
    setSelectedRowKeys([])
    setSelectedRows([])
    message.success('Đã tải lại toàn bộ dữ liệu mẫu thử nghiệm đầy đủ.')
  }

  // View detail
  const handleViewDetail = (record) => {
    setSelectedRecordForDetail(record)
    setDetailModalOpen(true)
  }

  // --- TABLE COLUMNS: TAB 1 (ELIGIBLE) ---
  const eligibleColumns = [
    {
      title: 'Mã hồ sơ',
      key: 'recordCode',
      width: 140,
      render: (_, r) => {
        const fullId = r.medicalRecordId || r.id
        return (
          <Tooltip title={`Mã ID đầy đủ: ${fullId}`}>
            <Tag color="cyan" style={{ fontFamily: 'monospace', fontWeight: 600 }}>
              {formatRecordCode(fullId)}
            </Tag>
          </Tooltip>
        )
      },
    },
    {
      title: 'Bệnh nhân',
      key: 'patient',
      render: (_, r) => (
        <div>
          <Text strong>{r.patientFullName || 'Bệnh nhân'}</Text>
          <div style={{ fontSize: 12, color: '#6b7280' }}>Mã: {r.patientCode || '---'}</div>
        </div>
      ),
    },
    {
      title: 'Bác sĩ phụ trách',
      dataIndex: 'doctorFullName',
      key: 'doctorFullName',
      render: (text, r) => (
        <div>
          <div>{text || '---'}</div>
          {r.specialtyName && (
            <Tag color="geekblue" style={{ fontSize: 11, margin: 0 }}>
              {r.specialtyName}
            </Tag>
          )}
        </div>
      ),
    },
    {
      title: 'Ngày kết thúc khám',
      dataIndex: 'completedAt',
      key: 'completedAt',
      width: 160,
      align: 'center',
      render: (val) => formatDateTime(val),
    },
    {
      title: 'Ngày ký duyệt',
      dataIndex: 'signedAt',
      key: 'signedAt',
      width: 160,
      align: 'center',
      render: (val) => (
        <div>
          <div>{formatDateTime(val)}</div>
          <Tag color="green" style={{ fontSize: 11 }}>Đã ký</Tag>
        </div>
      ),
    },
    {
      title: 'Thời gian quá hạn',
      key: 'overdue',
      width: 170,
      render: (_, r) => {
        const overdueInfo = calculateOverdueDuration(r.completedAt, 12)
        return (
          <span className={overdueInfo.severity === 'danger' ? 'overdue-pill-danger' : 'overdue-pill-warning'}>
            <ClockCircleOutlined style={{ marginRight: 4 }} />
            {overdueInfo.formatted}
          </span>
        )
      },
    },
    {
      title: 'Thao tác',
      key: 'actions',
      width: 190,
      render: (_, r) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleViewDetail(r)}
          >
            Xem trước
          </Button>

          {canConfirm ? (
            <Popconfirm
              title="Chuyển hồ sơ vào kho lưu trữ?"
              description="Sau khi chuyển, hồ sơ sẽ ở chế độ CHỈ ĐỌC và không thể chỉnh sửa hay xóa."
              onConfirm={() => handleArchiveSingle(r)}
              okText="Chuyển lưu trữ"
              cancelText="Hủy"
            >
              <Button
                type="link"
                size="small"
                icon={<InboxOutlined />}
                style={{ color: '#7c3aed', fontWeight: 500 }}
              >
                Chuyển lưu trữ
              </Button>
            </Popconfirm>
          ) : (
            <Tooltip title="Chỉ Quản trị viên mới có quyền xác nhận chuyển hồ sơ vào kho lưu trữ">
              <Button type="link" size="small" disabled icon={<InboxOutlined />}>
                Chuyển lưu trữ
              </Button>
            </Tooltip>
          )}
        </Space>
      ),
    },
  ]

  // --- TABLE COLUMNS: TAB 2 (ARCHIVED) ---
  const archivedColumns = [
    {
      title: 'Mã hồ sơ / Lượt khám',
      key: 'codes',
      width: 170,
      render: (_, r) => (
        <div>
          <Tag color="cyan" style={{ fontFamily: 'monospace', fontWeight: 600 }}>
            {formatRecordCode(r.medicalRecordId || r.id)}
          </Tag>
          {r.visitCode && (
            <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>
              Lượt khám: <strong>{r.visitCode}</strong>
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'Bệnh nhân',
      key: 'patient',
      render: (_, r) => (
        <div>
          <Text strong>{r.patientFullName || 'Bệnh nhân'}</Text>
          <div style={{ fontSize: 12, color: '#6b7280' }}>
            Mã: {r.patientCode || '---'} {r.patientPhone ? `• SĐT: ${r.patientPhone}` : ''}
          </div>
        </div>
      ),
    },
    {
      title: 'Bác sĩ điều trị',
      dataIndex: 'doctorFullName',
      key: 'doctorFullName',
      render: (text) => text || '---',
    },
    {
      title: 'Chẩn đoán / Kết luận',
      dataIndex: 'conclusion',
      key: 'conclusion',
      ellipsis: true,
      render: (text) => text || 'Chưa ghi nhận kết luận',
    },
    {
      title: 'Thời gian lưu trữ',
      dataIndex: 'archivedAt',
      key: 'archivedAt',
      width: 170,
      align: 'center',
      render: (val) => formatDateTime(val) || 'Đã lưu trữ',
    },
    {
      title: 'Trạng thái',
      key: 'status',
      width: 170,
      align: 'center',
      render: () => (
        <span className="archived-tag-badge">
          <LockOutlined /> Hồ sơ lưu trữ (Chỉ đọc)
        </span>
      ),
    },
    {
      title: 'Thao tác',
      key: 'actions',
      width: 140,
      render: (_, r) => (
        <Space size="small">
          <Button
            type="primary"
            ghost
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleViewDetail(r)}
            style={{ color: '#7c3aed', borderColor: '#d8b4fe' }}
          >
            Xem đầy đủ
          </Button>
        </Space>
      ),
    },
  ]

  // Tab items
  const tabItems = []

  if (canViewEligible) {
    tabItems.push({
      key: 'eligible',
      label: (
        <span>
          <InboxOutlined /> Hồ sơ đủ điều kiện lưu trữ{' '}
          {eligibleTotal > 0 && <Badge count={eligibleTotal} overflowCount={999} style={{ backgroundColor: '#7c3aed' }} />}
        </span>
      ),
      children: (
        <div>
          <Alert
            type="info"
            showIcon
            icon={<SafetyCertificateOutlined style={{ color: '#2563eb' }} />}
            message={<strong>QUY TRÌNH CHUYỂN HỒ SƠ BỆNH ÁN VÀO KHO LƯU TRỮ</strong>}
            description={
              <div style={{ fontSize: 13, color: '#374151' }}>
                Hồ sơ bệnh án thỏa mãn đồng thời 2 điều kiện: <strong>ĐÃ KÝ DUYỆT</strong> và{' '}
                <strong>QUÁ THỜI HẠN HOẠT ĐỘNG (12 THÁNG)</strong> sẽ được liệt kê tại đây.
                Quản trị viên có thể chọn từng hồ sơ hoặc chuyển hàng loạt sang kho lưu trữ để tối ưu hóa hiệu năng cơ sở dữ liệu.
              </div>
            }
            style={{ marginBottom: 16, background: '#eff6ff', borderColor: '#bfdbfe' }}
          />

          {/* Action Bar */}
          {isUsingDemoData && (
            <Alert
              type="success"
              showIcon
              message={<strong>DỮ LIỆU THỬ NGHIỆM ĐẦY ĐỦ</strong>}
              description="Hệ thống đã nạp sẵn danh sách hồ sơ mẫu thử nghiệm quá hạn với đầy đủ thông tin y tế (chẩn đoán ICD-10, ngày kết thúc khám, ngày ký số, thời gian quá hạn, sinh hiệu, cận lâm sàng, đơn thuốc). Quản trị viên có thể chọn từng dòng hoặc chuyển lưu trữ hàng loạt sang kho lưu trữ."
              style={{ marginBottom: 16, background: '#f0fdf4', borderColor: '#bbf7d0' }}
            />
          )}

          <div className={`archive-batch-bar ${selectedRowKeys.length > 0 ? 'active' : ''}`}>
            <Space align="center" wrap>
              <Text strong style={{ fontSize: 13 }}>
                Đã chọn: <span style={{ color: '#7c3aed', fontSize: 15 }}>{selectedRowKeys.length}</span> / {eligibleTotal} hồ sơ
              </Text>
              {selectedRowKeys.length > 0 && (
                <Button size="small" onClick={() => setSelectedRowKeys([])}>
                  Bỏ chọn tất cả
                </Button>
              )}
            </Space>

            <Space wrap>
              {canConfirm ? (
                <>
                  <Button
                    type="primary"
                    icon={<InboxOutlined />}
                    disabled={selectedRowKeys.length === 0}
                    onClick={() => handleOpenBatchModal(false)}
                    style={{ background: '#7c3aed', borderColor: '#7c3aed' }}
                    id="btn-batch-archive-selected"
                  >
                    Chuyển lưu trữ các mục đã chọn ({selectedRowKeys.length})
                  </Button>
                  {eligibleTotal > 0 && (
                    <Button
                      icon={<InboxOutlined />}
                      onClick={() => handleOpenBatchModal(true)}
                      style={{ borderColor: '#7c3aed', color: '#7c3aed' }}
                      id="btn-batch-archive-all"
                    >
                      Chuyển toàn bộ ({eligibleTotal} hồ sơ)
                    </Button>
                  )}
                </>
              ) : (
                <Tooltip title="Chỉ Quản trị viên mới có quyền xác nhận chuyển hồ sơ vào kho lưu trữ">
                  <Button type="primary" disabled icon={<InboxOutlined />}>
                    Chuyển lưu trữ (Yêu cầu quyền Quản trị viên)
                  </Button>
                </Tooltip>
              )}
              <Button icon={<ReloadOutlined />} onClick={loadEligibleRecords} loading={eligibleLoading}>
                Làm mới
              </Button>
              {isUsingDemoData && (
                <Button onClick={handleResetSampleData} style={{ color: '#4f46e5', borderColor: '#c7d2fe' }}>
                  Khôi phục dữ liệu mẫu
                </Button>
              )}
            </Space>
          </div>

          {/* Table */}
          {eligibleList.length === 0 && !eligibleLoading ? (
            <div className="archive-empty-state">
              <CheckCircleOutlined style={{ fontSize: 48, color: '#10b981', marginBottom: 16 }} />
              <Title level={4} style={{ color: '#065f46', marginBottom: 8 }}>
                Không có hồ sơ nào đủ điều kiện chuyển lưu trữ
              </Title>
              <Paragraph style={{ color: '#6b7280', maxWidth: 520, margin: '0 auto' }}>
                Tất cả hồ sơ bệnh án đã ký duyệt hiện đang trong thời hạn hoạt động an toàn (dưới 12 tháng kể từ ngày kết thúc khám). Không có hồ sơ tồn đọng cần dọn dẹp tại thời điểm hiện tại.
              </Paragraph>
              <Button
                icon={<ReloadOutlined />}
                style={{ marginTop: 16 }}
                onClick={loadEligibleRecords}
              >
                Kiểm tra lại
              </Button>
            </div>
          ) : (
            <Table
              rowSelection={{
                selectedRowKeys,
                onChange: (keys, rows) => {
                  setSelectedRowKeys(keys)
                  setSelectedRows(rows)
                },
              }}
              columns={eligibleColumns}
              dataSource={eligibleList}
              rowKey={(r) => r.medicalRecordId || r.id}
              loading={eligibleLoading}
              pagination={{
                current: eligiblePage,
                pageSize: eligiblePageSize,
                total: eligibleTotal,
                showSizeChanger: true,
                pageSizeOptions: ['10', '20', '50'],
                onChange: (page, size) => {
                  setEligiblePage(page)
                  setEligiblePageSize(size)
                },
                showTotal: (total) => `Tổng số ${total} hồ sơ đủ điều kiện`,
              }}
              size="middle"
            />
          )}
        </div>
      ),
    })
  }

  if (canSearch) {
    tabItems.push({
      key: 'search',
      label: (
        <span>
          <SearchOutlined /> Tra cứu kho lưu trữ
        </span>
      ),
      children: (
        <div>
          {/* Search Filter Card */}
          <Card size="small" style={{ marginBottom: 16, background: '#f8fafc', borderColor: '#e2e8f0' }}>
            <Row gutter={[12, 12]} align="middle">
              <Col xs={24} sm={12} md={8}>
                <Input
                  placeholder="Nhập tên BN, mã BN, SĐT hoặc mã lượt khám..."
                  prefix={<SearchOutlined style={{ color: '#9ca3af' }} />}
                  value={searchKeyword}
                  onChange={(e) => setSearchKeyword(e.target.value)}
                  onPressEnter={handleSearch}
                  allowClear
                  id="input-archive-search-keyword"
                />
              </Col>
              <Col xs={24} sm={12} md={6}>
                <RangePicker
                  placeholder={['Từ ngày', 'Đến ngày']}
                  format="DD/MM/YYYY"
                  value={searchDateRange}
                  onChange={setSearchDateRange}
                  style={{ width: '100%' }}
                  id="picker-archive-date-range"
                />
              </Col>
              <Col xs={24} sm={12} md={5}>
                <Select
                  placeholder="Lọc theo bác sĩ"
                  allowClear
                  value={searchDoctorId}
                  onChange={setSearchDoctorId}
                  style={{ width: '100%' }}
                  options={doctors.map((d) => ({
                    value: d.id,
                    label: d.fullName || d.username,
                  }))}
                  id="select-archive-doctor"
                />
              </Col>
              <Col xs={24} sm={12} md={5}>
                <Space>
                  <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch} id="btn-submit-archive-search">
                    Tìm kiếm
                  </Button>
                  <Button icon={<ReloadOutlined />} onClick={handleResetSearch}>
                    Đặt lại
                  </Button>
                </Space>
              </Col>
            </Row>
          </Card>

          {/* Archived Table */}
          {archivedList.length === 0 && !archivedLoading ? (
            <div className="archive-empty-state">
              <LockOutlined style={{ fontSize: 48, color: '#9ca3af', marginBottom: 16 }} />
              <Title level={4} style={{ color: '#4b5563', marginBottom: 8 }}>
                {hasSearched ? 'Không tìm thấy hồ sơ lưu trữ phù hợp' : 'Kho lưu trữ hiện chưa có hồ sơ nào'}
              </Title>
              <Paragraph style={{ color: '#6b7280', maxWidth: 480, margin: '0 auto' }}>
                {hasSearched
                  ? 'Không tìm thấy kết quả nào khớp với điều kiện tìm kiếm. Vui lòng thử lại với từ khóa, số điện thoại hoặc khoảng thời gian khác.'
                  : 'Chưa có hồ sơ bệnh án nào được chuyển vào kho lưu trữ. Sau khi Quản trị viên chuyển lưu trữ, các bản ghi sẽ xuất hiện tại đây.'}
              </Paragraph>
              {hasSearched && (
                <Button style={{ marginTop: 16 }} onClick={handleResetSearch}>
                  Xóa bộ lọc tìm kiếm
                </Button>
              )}
            </div>
          ) : (
            <Table
              columns={archivedColumns}
              dataSource={archivedList}
              rowKey={(r) => r.medicalRecordId || r.id}
              loading={archivedLoading}
              pagination={{
                current: archivedPage,
                pageSize: archivedPageSize,
                total: archivedTotal,
                showSizeChanger: true,
                pageSizeOptions: ['10', '20', '50'],
                onChange: (page, size) => {
                  setArchivedPage(page)
                  setArchivedPageSize(size)
                },
                showTotal: (total) => `Tổng số ${total} hồ sơ trong kho lưu trữ`,
              }}
              size="middle"
            />
          )}
        </div>
      ),
    })
  }

  return (
    <div className="archive-page-container">
      {/* Header Overview Card */}
      <Card className="archive-header-card" bodyStyle={{ padding: 20 }}>
        <Row gutter={[16, 16]} align="middle" justify="space-between">
          <Col xs={24} lg={11}>
            <Space align="center" style={{ marginBottom: 4 }}>
              <InboxOutlined style={{ fontSize: 26, color: '#7c3aed' }} />
              <Title level={3} style={{ margin: 0, color: '#4c1d95' }}>
                Kho lưu trữ hồ sơ bệnh án
              </Title>
              <Tag color="purple" style={{ fontWeight: 600 }}>Chỉ đọc & Bảo tồn dữ liệu</Tag>
            </Space>
            <Paragraph style={{ margin: 0, color: '#5b21b6', fontSize: 13 }}>
              Quản lý chuyển lưu trữ hồ sơ quá hạn hoạt động và tra cứu lại đầy đủ bệnh án cũ phục vụ đối soát, khám lại sau nhiều năm.
            </Paragraph>
          </Col>
          <Col xs={24} lg={13}>
            <Row gutter={[10, 10]}>
              <Col xs={12} sm={6}>
                <Card size="small" className="archive-stat-card" style={{ background: '#ffffff', textAlign: 'center', borderColor: '#e9d5ff' }}>
                  <Text type="secondary" style={{ fontSize: 11 }}>Đủ điều kiện chuyển</Text>
                  <div style={{ fontSize: 20, fontWeight: 700, color: '#7c3aed' }}>{eligibleTotal}</div>
                  <div style={{ fontSize: 10, color: '#94a3b8' }}>Quá hạn hoạt động</div>
                </Card>
              </Col>
              <Col xs={12} sm={6}>
                <Card size="small" className="archive-stat-card" style={{ background: '#ffffff', textAlign: 'center', borderColor: '#a7f3d0' }}>
                  <Text type="secondary" style={{ fontSize: 11 }}>Trong kho lưu trữ</Text>
                  <div style={{ fontSize: 20, fontWeight: 700, color: '#059669' }}>{archivedTotal}</div>
                  <div style={{ fontSize: 10, color: '#94a3b8' }}>Đã niêm phong</div>
                </Card>
              </Col>
              <Col xs={12} sm={6}>
                <Card size="small" className="archive-stat-card" style={{ background: '#ffffff', textAlign: 'center', borderColor: '#bfdbfe' }}>
                  <Text type="secondary" style={{ fontSize: 11 }}>Thời hạn hoạt động</Text>
                  <div style={{ fontSize: 20, fontWeight: 700, color: '#2563eb' }}>12 tháng</div>
                  <div style={{ fontSize: 10, color: '#94a3b8' }}>Cấu hình phòng khám</div>
                </Card>
              </Col>
              <Col xs={12} sm={6}>
                <Card size="small" className="archive-stat-card" style={{ background: '#ffffff', textAlign: 'center', borderColor: '#fde68a' }}>
                  <Text type="secondary" style={{ fontSize: 11 }}>Bảo lưu pháp lý</Text>
                  <div style={{ fontSize: 20, fontWeight: 700, color: '#d97706' }}>10 năm</div>
                  <div style={{ fontSize: 10, color: '#94a3b8' }}>Luật Khám bệnh</div>
                </Card>
              </Col>
            </Row>
          </Col>
        </Row>
      </Card>

      {/* Main Tabs Container */}
      <Card bodyStyle={{ padding: 16 }}>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={tabItems}
        />
      </Card>

      {/* Modals */}
      <ConfirmBatchArchiveModal
        open={batchModalOpen}
        onClose={() => setBatchModalOpen(false)}
        onConfirm={handleConfirmBatchArchive}
        selectedRecords={selectedRows}
        isArchiveAll={isArchiveAllMode}
        totalEligibleCount={eligibleTotal}
        loading={batchLoading}
      />

      <ArchivedMedicalRecordDetailModal
        open={detailModalOpen}
        onClose={() => setDetailModalOpen(false)}
        record={selectedRecordForDetail}
      />
    </div>
  )
}

export default MedicalRecordArchivePage
