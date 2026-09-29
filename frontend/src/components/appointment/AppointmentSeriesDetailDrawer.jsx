import React, { useCallback, useEffect, useState } from 'react'
import {
  Alert,
  Badge,
  Button,
  Card,
  Col,
  Descriptions,
  Divider,
  Drawer,
  Empty,
  Input,
  Modal,
  Popconfirm,
  Row,
  Space,
  Spin,
  Table,
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
  EyeOutlined,
  ReloadOutlined,
  UserOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import appointmentApi from '../../api/appointmentApi.js'
import {
  getSeriesStatusTag,
  mapSeriesErrorMessage,
} from '../../utils/appointmentSeriesHelpers.js'
import { APPOINTMENT_STATUS_META } from '../../utils/queueHelpers.js'

const { Text, Title, Paragraph } = Typography

export default function AppointmentSeriesDetailDrawer({
  open,
  onClose,
  seriesId,
  initialSeriesData = null,
  getPatientInfo,
  getDoctorInfo,
  onCancelAppointmentSuccess,
}) {
  const [loading, setLoading] = useState(false)
  const [seriesData, setSeriesData] = useState(initialSeriesData)
  const [patientSeriesList, setPatientSeriesList] = useState([])
  const [loadingPatientSeries, setLoadingPatientSeries] = useState(false)
  const [cancelModalItem, setCancelModalItem] = useState(null)
  const [cancelReason, setCancelReason] = useState('Bệnh nhân bận việc đột xuất')
  const [canceling, setCanceling] = useState(false)
  const [activeTab, setActiveTab] = useState('detail')

  const loadSeriesDetail = useCallback(async (id) => {
    if (!id) return
    setLoading(true)
    try {
      const res = await appointmentApi.getSeriesById(id)
      const data = res.data || res
      setSeriesData(data)

      // Also load all series of this patient
      if (data.patientId) {
        loadPatientSeries(data.patientId)
      }
    } catch (err) {
      message.error(mapSeriesErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [])

  const loadPatientSeries = async (patientId) => {
    if (!patientId) return
    setLoadingPatientSeries(true)
    try {
      const res = await appointmentApi.getSeriesByPatient(patientId)
      const list = res.data || res
      setPatientSeriesList(Array.isArray(list) ? list : [])
    } catch (err) {
      // Do not block main drawer if patient series fails
    } finally {
      setLoadingPatientSeries(false)
    }
  }

  useEffect(() => {
    if (open && seriesId) {
      loadSeriesDetail(seriesId)
      setActiveTab('detail')
    } else if (!open) {
      setSeriesData(null)
      setPatientSeriesList([])
    }
  }, [open, seriesId, loadSeriesDetail])

  // Single appointment cancellation handler
  const handleConfirmCancelAppointment = async () => {
    if (!cancelModalItem) return
    setCanceling(true)
    try {
      await appointmentApi.cancel(cancelModalItem.id, cancelReason)
      message.success(`Đã hủy buổi hẹn ${cancelModalItem.appointmentCode || ''}! Các buổi còn lại trong liệu trình được giữ nguyên.`)
      setCancelModalItem(null)
      // Refetch series details to reflect updated appointment status
      if (seriesId) {
        await loadSeriesDetail(seriesId)
      }
      if (onCancelAppointmentSuccess) {
        onCancelAppointmentSuccess()
      }
    } catch (err) {
      message.error(mapSeriesErrorMessage(err))
    } finally {
      setCanceling(false)
    }
  }

  const statusMeta = getSeriesStatusTag(seriesData?.status)
  const pInfo = getPatientInfo
    ? getPatientInfo(seriesData?.patientId)
    : { name: seriesData?.patientName || 'Bệnh nhân', code: seriesData?.patientCode || '' }
  const dInfo = getDoctorInfo
    ? getDoctorInfo(seriesData?.doctorId)
    : { name: seriesData?.doctorName || 'Bác sĩ', department: seriesData?.specialtyName || '' }

  const appointmentList = seriesData?.appointments || []

  const sessionColumns = [
    {
      title: 'Buổi #',
      key: 'sequence',
      width: 80,
      render: (_, __, index) => (
        <Text strong style={{ color: '#7c3aed' }}>
          Buổi {index + 1}
        </Text>
      ),
    },
    {
      title: 'Mã lịch hẹn',
      dataIndex: 'appointmentCode',
      key: 'appointmentCode',
      width: 140,
      render: (code) => (
        <Text strong style={{ color: '#2563eb' }}>
          {code || '—'}
        </Text>
      ),
    },
    {
      title: 'Thời gian khám',
      key: 'time',
      width: 220,
      render: (_, record) => {
        const start = record.startTime ? dayjs(record.startTime) : null
        const end = record.endTime ? dayjs(record.endTime) : null
        if (!start) return '—'
        return (
          <div>
            <Text strong style={{ display: 'block', color: '#0f172a' }}>
              {start.format('HH:mm')} {end ? `- ${end.format('HH:mm')}` : ''}
            </Text>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {start.format('dddd, DD/MM/YYYY')}
            </Text>
          </div>
        )
      },
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      width: 140,
      render: (st) => {
        const meta = APPOINTMENT_STATUS_META[st] || { label: st || 'Không xác định', tone: 'gray' }
        return <Tag color={meta.tone}>{meta.label}</Tag>
      },
    },
    {
      title: 'Thao tác',
      key: 'action',
      width: 120,
      align: 'center',
      render: (_, record, index) => {
        const canCancel = ['SCHEDULED', 'CONFIRMED'].includes(record.status)
        if (!canCancel) {
          return <Text type="secondary" style={{ fontSize: 12 }}>—</Text>
        }
        return (
          <Button
            size="small"
            danger
            icon={<CloseCircleOutlined />}
            onClick={() => {
              setCancelReason('Bệnh nhân bận việc đột xuất')
              setCancelModalItem({ ...record, sessionSeq: index + 1 })
            }}
            className="series-btn-cancel-session"
          >
            Hủy buổi này
          </Button>
        )
      },
    },
  ]

  const patientSeriesColumns = [
    {
      title: 'Mã liệu trình',
      dataIndex: 'seriesCode',
      key: 'seriesCode',
      render: (code, record) => (
        <Button
          type="link"
          style={{ padding: 0, fontWeight: 'bold', color: '#7c3aed' }}
          onClick={() => loadSeriesDetail(record.id)}
        >
          {code}
        </Button>
      ),
    },
    {
      title: 'Tiêu đề',
      dataIndex: 'title',
      key: 'title',
      render: (t) => t || 'Không có tiêu đề',
    },
    {
      title: 'Số buổi',
      key: 'sessions',
      render: (_, r) => `${r.totalSessions || 0} buổi (${r.intervalDays || 1} ngày/buổi)`,
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      render: (st) => {
        const tag = getSeriesStatusTag(st)
        return <Tag color={tag.color}>{tag.label}</Tag>
      },
    },
    {
      title: 'Ngày tạo',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date) => (date ? dayjs(date).format('DD/MM/YYYY HH:mm') : '—'),
    },
  ]

  return (
    <>
      <Drawer
        title={
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', paddingRight: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 8,
                  background: 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ffffff',
                  fontSize: 16,
                  boxShadow: '0 2px 6px rgba(124, 58, 237, 0.25)',
                }}
              >
                <CalendarOutlined />
              </div>
              <div>
                <span style={{ fontWeight: 700, fontSize: 16, color: '#0f172a' }}>Chi tiết Liệu trình đặt lịch</span>
                <div style={{ display: 'flex', gap: 6, marginTop: 2, alignItems: 'center' }}>
                  {seriesData?.seriesCode && (
                    <Tag color="purple" style={{ fontSize: 12, padding: '1px 8px', borderRadius: 4, margin: 0, fontWeight: 600 }}>
                      {seriesData.seriesCode}
                    </Tag>
                  )}
                  {seriesData?.status && (
                    <Tag color={statusMeta.color} style={{ fontSize: 12, padding: '1px 8px', borderRadius: 4, margin: 0 }}>
                      {statusMeta.label}
                    </Tag>
                  )}
                </div>
              </div>
            </div>
            <Button
              size="small"
              icon={<ReloadOutlined />}
              onClick={() => seriesId && loadSeriesDetail(seriesId)}
              loading={loading}
              style={{ borderRadius: 6, fontWeight: 500 }}
            >
              Làm mới
            </Button>
          </div>
        }
        placement="right"
        width={780}
        onClose={onClose}
        open={open}
        destroyOnClose
      >
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <Spin size="large" tip="Đang tải thông tin liệu trình..." />
          </div>
        ) : !seriesData ? (
          <Empty description="Không tìm thấy thông tin liệu trình" />
        ) : (
          <Tabs
            activeKey={activeTab}
            onChange={setActiveTab}
            items={[
              {
                key: 'detail',
                label: 'Liệu trình & Các buổi khám',
                children: (
                  <div>
                    <Card size="small" style={{ marginBottom: 16, backgroundColor: '#faf5ff', borderColor: '#e9d5ff' }}>
                      <Descriptions column={{ xs: 1, sm: 2 }} size="small">
                        <Descriptions.Item label="Mã liệu trình">
                          <Text strong style={{ color: '#7c3aed' }}>{seriesData.seriesCode}</Text>
                        </Descriptions.Item>
                        <Descriptions.Item label="Trạng thái">
                          <Tag color={statusMeta.color}>{statusMeta.label}</Tag>
                        </Descriptions.Item>
                        <Descriptions.Item label="Bệnh nhân">
                          <Text strong>{pInfo.name}</Text> {pInfo.code && <Text type="secondary">({pInfo.code})</Text>}
                        </Descriptions.Item>
                        <Descriptions.Item label="Bác sĩ phụ trách">
                          <Text strong>{dInfo.name}</Text> {dInfo.department && <Tag color="cyan">{dInfo.department}</Tag>}
                        </Descriptions.Item>
                        <Descriptions.Item label="Quy mô liệu trình">
                          <Text strong>{seriesData.totalSessions} buổi</Text> (mỗi buổi cách nhau {seriesData.intervalDays} ngày)
                        </Descriptions.Item>
                        <Descriptions.Item label="Ngày tạo">
                          {seriesData.createdAt ? dayjs(seriesData.createdAt).format('DD/MM/YYYY HH:mm') : '—'}
                        </Descriptions.Item>
                        {seriesData.title && (
                          <Descriptions.Item label="Tiêu đề" span={2}>
                            {seriesData.title}
                          </Descriptions.Item>
                        )}
                        {seriesData.notes && (
                          <Descriptions.Item label="Ghi chú điều trị" span={2}>
                            <Paragraph style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{seriesData.notes}</Paragraph>
                          </Descriptions.Item>
                        )}
                      </Descriptions>
                    </Card>

                    <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Title level={5} style={{ margin: 0 }}>
                        Danh sách các buổi khám ({appointmentList.length} buổi)
                      </Title>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        * Thứ tự các buổi đúng theo lịch điều trị đã lập
                      </Text>
                    </div>

                    <Table
                      size="small"
                      rowKey="id"
                      columns={sessionColumns}
                      dataSource={appointmentList}
                      pagination={false}
                      locale={{
                        emptyText: 'Chưa có lịch hẹn nào thuộc liệu trình này',
                      }}
                    />
                  </div>
                ),
              },
              {
                key: 'patient_series',
                label: `Lịch sử liệu trình của BN (${patientSeriesList.length})`,
                children: (
                  <div>
                    <Table
                      size="small"
                      rowKey="id"
                      columns={patientSeriesColumns}
                      dataSource={patientSeriesList}
                      pagination={{ pageSize: 5 }}
                      loading={loadingPatientSeries}
                      locale={{
                        emptyText: (
                          <Empty
                            image={Empty.PRESENTED_IMAGE_SIMPLE}
                            description="Bệnh nhân chưa có liệu trình nào khác"
                          />
                        ),
                      }}
                    />
                  </div>
                ),
              },
            ]}
          />
        )}
      </Drawer>

      {/* Modal xác nhận hủy 1 buổi hẹn trong liệu trình */}
      <Modal
        title="Xác nhận hủy buổi khám"
        open={Boolean(cancelModalItem)}
        onCancel={() => setCancelModalItem(null)}
        onOk={handleConfirmCancelAppointment}
        okText="Hủy buổi khám này"
        okButtonProps={{ danger: true, loading: canceling }}
        cancelText="Đóng"
        destroyOnClose
      >
        {cancelModalItem && (
          <div>
            <Alert
              type="warning"
              showIcon
              style={{ marginBottom: 12 }}
              message={`Hủy buổi khám số ${cancelModalItem.sessionSeq || ''}`}
              description="Thao tác này chỉ hủy riêng buổi khám này. Toàn bộ các buổi khám khác và thông tin liệu trình vẫn được bảo lưu nguyên vẹn."
            />
            <div style={{ marginBottom: 12 }}>
              <p><strong>Mã lịch hẹn:</strong> {cancelModalItem.appointmentCode}</p>
              <p>
                <strong>Thời gian khám:</strong>{' '}
                {cancelModalItem.startTime ? dayjs(cancelModalItem.startTime).format('HH:mm - DD/MM/YYYY') : '—'}
              </p>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>
                Lý do hủy buổi khám:
              </label>
              <Input.TextArea
                rows={3}
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Nhập lý do hủy buổi hẹn..."
              />
            </div>
          </div>
        )}
      </Modal>
    </>
  )
}
