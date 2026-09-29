import React, { useCallback, useEffect, useState } from 'react'
import {
  Alert,
  Button,
  Card,
  Col,
  DatePicker,
  Empty,
  Input,
  Row,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
  message,
} from 'antd'
import {
  AuditOutlined,
  BookOutlined,
  CalendarOutlined,
  DownloadOutlined,
  EyeOutlined,
  ReloadOutlined,
  SearchOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import specialControlledDrugApi from '../api/specialControlledDrugApi'
import SpecialControlBadge from '../components/pharmacy/SpecialControlBadge.jsx'
import SpecialControlledDrugDetailModal from '../components/pharmacy/SpecialControlledDrugDetailModal.jsx'
import {
  SPECIAL_CONTROL_ACTION_TYPES,
  SPECIAL_CONTROL_GROUPS,
  getSpecialControlMeta,
} from '../utils/specialControlHelpers.js'
import { useAuthContext } from '../context/AuthContext'

const { Title, Text } = Typography
const { RangePicker } = DatePicker

export default function SpecialControlledDrugRegisterPage() {
  const { user: currentUser } = useAuthContext()
  const [loading, setLoading] = useState(false)
  const [entries, setEntries] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(10)

  // Filters
  const [keyword, setKeyword] = useState('')
  const [selectedGroup, setSelectedGroup] = useState('ALL')
  const [selectedActionType, setSelectedActionType] = useState('ALL')
  const [dateRange, setDateRange] = useState(null)

  // Modal
  const [selectedEntry, setSelectedEntry] = useState(null)
  const [detailModalOpen, setDetailModalOpen] = useState(false)
  const [exporting, setExporting] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const params = {
        page,
        size: pageSize,
        keyword: keyword.trim() || undefined,
        group: selectedGroup !== 'ALL' ? selectedGroup : undefined,
        actionType: selectedActionType !== 'ALL' ? selectedActionType : undefined,
      }

      if (dateRange && dateRange[0] && dateRange[1]) {
        params.startDate = dateRange[0].startOf('day').toISOString()
        params.endDate = dateRange[1].endOf('day').toISOString()
      }

      const res = await specialControlledDrugApi.getRegisterEntries(params)
      const data = res.data || res
      const items = Array.isArray(data.content)
        ? data.content
        : Array.isArray(data)
        ? data
        : []

      setEntries(items)
      setTotal(Number(data.totalElements ?? items.length))
    } catch (err) {
      console.warn('Lỗi tải dữ liệu Sổ theo dõi thuốc kiểm soát đặc biệt:', err)
      message.error('Không thể tải dữ liệu sổ theo dõi. Vui lòng thử lại.')
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, keyword, selectedGroup, selectedActionType, dateRange])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleSearch = () => {
    setPage(0)
    loadData()
  }

  const handleResetFilters = () => {
    setKeyword('')
    setSelectedGroup('ALL')
    setSelectedActionType('ALL')
    setDateRange(null)
    setPage(0)
  }

  const handleViewDetail = (entry) => {
    setSelectedEntry(entry)
    setDetailModalOpen(true)
  }

  const handleExportCsv = () => {
    try {
      setExporting(true)
      if (!entries.length) {
        message.warning('Không có dữ liệu để xuất báo cáo.')
        return
      }

      const headers = [
        'STT',
        'Mã nhật ký',
        'Loại nghiệp vụ',
        'Thời gian',
        'Người thực hiện',
        'Bệnh nhân',
        'Mã bệnh nhân',
        'Số CCCD/CMND',
        'Mã đơn thuốc',
        'Tên thuốc',
        'Nhóm kiểm soát đặc biệt',
        'Số lượng',
        'Đơn vị tính',
        'Số lô xuất',
        'Lý do xác nhận',
      ]

      const rows = entries.map((item, idx) => {
        const actionLabel = SPECIAL_CONTROL_ACTION_TYPES[item.actionType]?.label || item.actionType
        const groupMeta = getSpecialControlMeta(item.specialControlGroup)
        const groupLabel = groupMeta ? `${groupMeta.code} - ${groupMeta.label}` : item.specialControlGroup
        const timeStr = item.confirmedAt || item.createdAt
          ? dayjs(item.confirmedAt || item.createdAt).format('DD/MM/YYYY HH:mm:ss')
          : ''

        return [
          idx + 1,
          `"${item.registerCode || item.id || ''}"`,
          `"${actionLabel}"`,
          `"${timeStr}"`,
          `"${item.confirmedBy || ''}"`,
          `"${item.patientName || ''}"`,
          `"${item.patientCode || ''}"`,
          `"${item.patientIdCard || ''}"`,
          `"${item.prescriptionCode || ''}"`,
          `"${item.medicineName || ''}"`,
          `"${groupLabel}"`,
          item.quantity || 0,
          `"${item.unit || ''}"`,
          `"${item.batchNumber || item.medicineBatchId || ''}"`,
          `"${(item.confirmationReason || item.reason || '').replace(/"/g, '""')}"`,
        ]
      })

      const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n')
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.setAttribute('href', url)
      link.setAttribute(
        'download',
        `So_theo_doi_thuoc_kiem_soat_dac_biet_${dayjs().format('YYYYMMDD_HHmmss')}.csv`,
      )
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      message.success('Xuất file báo cáo thành công.')
    } catch (err) {
      console.error('Lỗi khi xuất báo cáo:', err)
      message.error('Không thể xuất báo cáo. Vui lòng thử lại.')
    } finally {
      setExporting(false)
    }
  }

  const columns = [
    {
      title: 'STT',
      key: 'stt',
      width: 55,
      align: 'center',
      render: (_, __, index) => page * pageSize + index + 1,
    },
    {
      title: 'Mã nhật ký',
      dataIndex: 'registerCode',
      key: 'registerCode',
      width: 145,
      render: (code, record) => (
        <Text strong style={{ color: '#0369a1', fontSize: 13 }}>
          {code || record.id}
        </Text>
      ),
    },
    {
      title: 'Thời gian',
      key: 'time',
      width: 135,
      render: (_, record) => {
        const time = record.confirmedAt || record.createdAt
        return (
          <span style={{ fontSize: 12.5, color: '#334155' }}>
            {time ? dayjs(time).format('DD/MM/YYYY HH:mm') : '—'}
          </span>
        )
      },
    },
    {
      title: 'Thao tác',
      dataIndex: 'actionType',
      key: 'actionType',
      width: 105,
      align: 'center',
      render: (type) => {
        const meta = SPECIAL_CONTROL_ACTION_TYPES[type] || {
          label: type || 'Ghi nhận',
          color: 'default',
        }
        return (
          <Tag color={meta.color} style={{ fontWeight: 600, borderRadius: 6, margin: 0 }}>
            {meta.label}
          </Tag>
        )
      },
    },
    {
      title: 'Bệnh nhân',
      key: 'patient',
      width: 170,
      render: (_, record) => (
        <div>
          <div style={{ fontWeight: 600, color: '#0f172a' }}>{record.patientName || '—'}</div>
          <div style={{ fontSize: 11.5, color: '#64748b' }}>
            Mã: {record.patientCode || '—'}
            {record.patientIdCard && ` · CCCD: ${record.patientIdCard}`}
          </div>
        </div>
      ),
    },
    {
      title: 'Thuốc & Nhóm kiểm soát',
      key: 'medicine',
      render: (_, record) => (
        <Space direction="vertical" size={2}>
          <Text strong style={{ color: '#1e293b' }}>
            {record.medicineName}
          </Text>
          <SpecialControlBadge
            isSpecialControl={true}
            group={record.specialControlGroup}
          />
        </Space>
      ),
    },
    {
      title: 'Số lượng',
      key: 'quantity',
      width: 100,
      align: 'center',
      render: (_, record) => (
        <Text strong style={{ color: '#059669', fontSize: 14 }}>
          {record.quantity} {record.unit || 'viên'}
        </Text>
      ),
    },
    {
      title: 'Người thực hiện',
      dataIndex: 'confirmedBy',
      key: 'confirmedBy',
      width: 145,
      render: (name) => <span style={{ fontSize: 13, color: '#334155' }}>{name || '—'}</span>,
    },
    {
      title: 'Xem',
      key: 'actions',
      width: 70,
      align: 'center',
      render: (_, record) => (
        <Tooltip title="Xem chi tiết nhật ký">
          <Button
            type="text"
            icon={<EyeOutlined style={{ fontSize: 17, color: '#0284c7' }} />}
            onClick={() => handleViewDetail(record)}
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              backgroundColor: '#e0f2fe',
              border: '1px solid #bae6fd',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 0,
            }}
          />
        </Tooltip>
      ),
    },
  ]

  return (
    <div style={{ padding: 24, maxWidth: 1400, margin: '0 auto' }}>
      {/* Tiêu đề trang - Tuân thủ nguyên tắc 3: Không có dòng mô tả phụ bên dưới */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 10,
            backgroundColor: '#f0f9ff',
            border: '1px solid #bae6fd',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <BookOutlined style={{ fontSize: 24, color: '#0284c7' }} />
        </div>
        <Title level={3} style={{ margin: 0, color: '#0f172a', fontWeight: 700 }}>
          Sổ theo dõi thuốc kiểm soát đặc biệt
        </Title>
      </div>

      {/* Thanh bộ lọc và công cụ */}
      <Card
        style={{
          marginBottom: 16,
          borderRadius: 10,
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
        }}
      >
        <Row gutter={[12, 12]} align="middle">
          <Col xs={24} sm={12} md={6} lg={5} xl={5}>
            <Input
              placeholder="Tìm theo mã sổ, tên bệnh nhân, tên thuốc..."
              prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onPressEnter={handleSearch}
              allowClear
              style={{ height: 40 }}
            />
          </Col>

          <Col xs={24} sm={12} md={5} lg={4} xl={4}>
            <Select
              style={{ width: '100%', height: 40 }}
              value={selectedGroup}
              onChange={(val) => {
                setSelectedGroup(val)
                setPage(0)
              }}
              options={[
                { value: 'ALL', label: 'Tất cả nhóm kiểm soát' },
                ...Object.values(SPECIAL_CONTROL_GROUPS).map((g) => ({
                  value: g.key,
                  label: `${g.code} — ${g.label}`,
                })),
              ]}
            />
          </Col>

          <Col xs={24} sm={12} md={4} lg={4} xl={4}>
            <Select
              style={{ width: '100%', height: 40 }}
              value={selectedActionType}
              onChange={(val) => {
                setSelectedActionType(val)
                setPage(0)
              }}
              options={[
                { value: 'ALL', label: 'Tất cả thao tác' },
                { value: 'PRESCRIBED', label: 'Kê đơn (Bác sĩ)' },
                { value: 'DISPENSED', label: 'Cấp phát (Dược sĩ)' },
              ]}
            />
          </Col>

          <Col xs={24} sm={12} md={5} lg={5} xl={5}>
            <RangePicker
              value={dateRange}
              onChange={(dates) => {
                setDateRange(dates)
                setPage(0)
              }}
              format="DD/MM/YYYY"
              placeholder={['Từ ngày', 'Đến ngày']}
              style={{ width: '100%', height: 40 }}
            />
          </Col>

          <Col xs={24} sm={12} md={4} lg={6} xl={6} style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', alignItems: 'center' }}>
            <Button
              icon={<ReloadOutlined />}
              onClick={handleResetFilters}
              style={{
                height: 40,
                minWidth: 92,
                borderRadius: 6,
                marginLeft: 4,
              }}
              title="Đặt lại bộ lọc"
            >
              Đặt lại
            </Button>
            <Button
              type="primary"
              icon={<DownloadOutlined />}
              onClick={handleExportCsv}
              loading={exporting}
              style={{
                height: 40,
                fontWeight: 600,
                backgroundColor: '#0284c7',
                borderColor: '#0284c7',
                borderRadius: 6,
                whiteSpace: 'nowrap',
              }}
            >
              Xuất Excel / CSV
            </Button>
          </Col>
        </Row>
      </Card>

      {/* Bảng dữ liệu nhật ký - Bất biến: chỉ xem, không sửa/xóa */}
      <Card
        style={{
          borderRadius: 10,
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
        }}
        bodyStyle={{ padding: 0 }}
      >
        <Table
          dataSource={entries}
          columns={columns}
          rowKey={(r) => r.id || r.registerCode}
          loading={loading}
          pagination={{
            current: page + 1,
            pageSize,
            total,
            showSizeChanger: true,
            pageSizeOptions: ['10', '20', '50'],
            showTotal: (totalCount, range) => `${range[0]}-${range[1]} trong tổng số ${totalCount} lượt`,
            onChange: (p, s) => {
              setPage(p - 1)
              setPageSize(s)
            },
          }}
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="Không có dữ liệu nhật ký thuốc kiểm soát đặc biệt phù hợp"
              />
            ),
          }}
        />
      </Card>

      {/* Modal xem chi tiết */}
      <SpecialControlledDrugDetailModal
        open={detailModalOpen}
        entry={selectedEntry}
        onClose={() => {
          setDetailModalOpen(false)
          setSelectedEntry(null)
        }}
      />
    </div>
  )
}
