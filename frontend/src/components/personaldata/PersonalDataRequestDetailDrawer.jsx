import React, { useEffect, useState } from 'react'
import {
  Drawer,
  Descriptions,
  Tag,
  Button,
  Spin,
  Alert,
  Space,
  Divider,
  Typography,
} from 'antd'
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  UserOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import personalDataRequestApi from '../../api/personalDataRequestApi.js'
import patientApi from '../../api/patientApi.js'
import userApi from '../../api/userApi.js'
import {
  getRequestTypeLabel,
  getStatusTag,
  getOverdueFlag,
  isUpcomingDue,
  canComplete,
  mapPersonalDataRequestError,
} from '../../utils/personalDataRequestHelpers.js'

const { Text, Title, Paragraph } = Typography

/**
 * Drawer xem chi tiết yêu cầu dữ liệu cá nhân
 */
const PersonalDataRequestDetailDrawer = ({
  open,
  onClose,
  requestId,
  onOpenCompleteModal,
  patientMap = new Map(),
  userMap = new Map(),
}) => {
  const [loading, setLoading] = useState(false)
  const [request, setRequest] = useState(null)
  const [patientDetail, setPatientDetail] = useState(null)
  const [processorDetail, setProcessorDetail] = useState(null)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    if (!open || !requestId) {
      setRequest(null)
      setPatientDetail(null)
      setProcessorDetail(null)
      setErrorMessage('')
      return
    }

    let active = true
    const fetchDetail = async () => {
      setLoading(true)
      setErrorMessage('')
      try {
        const res = await personalDataRequestApi.getById(requestId)
        if (!active) return
        const reqData = res.data
        setRequest(reqData)

        // Tra cứu thêm bệnh nhân nếu chưa có trong map
        const patientId = reqData.patientId
        if (patientId) {
          const cachedPatient = patientMap.get(String(patientId))
          if (cachedPatient) {
            setPatientDetail(cachedPatient)
          } else {
            patientApi
              .getById(patientId)
              .then((pRes) => {
                if (active) setPatientDetail(pRes.data)
              })
              .catch(() => {})
          }
        }

        // Tra cứu người xử lý nếu đã COMPLETED
        const processedBy = reqData.processedBy
        if (processedBy) {
          const cachedUser = userMap.get(String(processedBy))
          if (cachedUser) {
            setProcessorDetail(cachedUser)
          } else {
            userApi
              .getById(processedBy)
              .then((uRes) => {
                if (active) setProcessorDetail(uRes.data)
              })
              .catch(() => {})
          }
        }
      } catch (err) {
        if (active) {
          setErrorMessage(mapPersonalDataRequestError(err, 'Không thể tải chi tiết yêu cầu.'))
        }
      } finally {
        if (active) setLoading(false)
      }
    }

    fetchDetail()

    return () => {
      active = false
    }
  }, [open, requestId, patientMap, userMap])

  const statusTag = getStatusTag(request?.status)
  const isOverdue = getOverdueFlag(request)
  const isUpcoming = isUpcomingDue(request)
  const isActionable = canComplete(request)

  return (
    <Drawer
      title="Chi tiết yêu cầu dữ liệu cá nhân"
      placement="right"
      width={650}
      open={open}
      onClose={onClose}
      extra={
        isActionable ? (
          <Button
            type="primary"
            icon={<CheckCircleOutlined />}
            onClick={() => {
              onClose()
              onOpenCompleteModal?.(request)
            }}
          >
            Hoàn tất xử lý
          </Button>
        ) : null
      }
    >
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <Spin size="large" tip="Đang tải thông tin yêu cầu..." />
        </div>
      ) : errorMessage ? (
        <Alert type="error" message={errorMessage} showIcon />
      ) : request ? (
        <div>
          {/* Cảnh báo trạng thái quá hạn hoặc sắp tới hạn */}
          {isOverdue && (
            <Alert
              type="error"
              showIcon
              icon={<ExclamationCircleOutlined />}
              message="Yêu cầu đã quá hạn xử lý!"
              description={`Hạn giải quyết đã kết thúc vào ${dayjs(request.dueAt).format('DD/MM/YYYY HH:mm')}. Vui lòng ưu tiên xử lý sớm.`}
              style={{ marginBottom: 16 }}
            />
          )}

          {!isOverdue && isUpcoming && (
            <Alert
              type="warning"
              showIcon
              icon={<ClockCircleOutlined />}
              message="Yêu cầu sắp tới hạn xử lý trong 24 giờ tới!"
              description={`Hạn xử lý sẽ hết vào ${dayjs(request.dueAt).format('DD/MM/YYYY HH:mm')}.`}
              style={{ marginBottom: 16 }}
            />
          )}

          <Descriptions title="Thông tin người bệnh" bordered size="small" column={1}>
            <Descriptions.Item label="Họ và tên">
              <Text strong>{patientDetail?.fullName || '---'}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="Mã người bệnh">
              {patientDetail?.patientCode || '---'}
            </Descriptions.Item>
            <Descriptions.Item label="Số điện thoại">
              {patientDetail?.phone || '---'}
            </Descriptions.Item>
            <Descriptions.Item label="Số CCCD / ĐD cá nhân">
              {patientDetail?.identityNumber || '---'}
            </Descriptions.Item>
            <Descriptions.Item label="Địa chỉ">
              {patientDetail?.address || '---'}
            </Descriptions.Item>
          </Descriptions>

          <Divider style={{ margin: '16px 0' }} />

          <Descriptions title="Nội dung yêu cầu" bordered size="small" column={1}>
            <Descriptions.Item label="Mã yêu cầu">
              <Text code>{request.id}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="Loại yêu cầu">
              <Text strong>{getRequestTypeLabel(request.requestType)}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="Trạng thái">
              <Space>
                <Tag color={statusTag.color} style={{ fontWeight: 600 }}>
                  {statusTag.label}
                </Tag>
                {isOverdue && <Tag color="error">Quá hạn</Tag>}
                {!isOverdue && isUpcoming && <Tag color="warning">Sắp đến hạn</Tag>}
              </Space>
            </Descriptions.Item>
            <Descriptions.Item label="Thời điểm tiếp nhận">
              {request.receivedAt ? dayjs(request.receivedAt).format('DD/MM/YYYY HH:mm:ss') : '---'}
            </Descriptions.Item>
            <Descriptions.Item label="Hạn xử lý">
              <span style={{ color: isOverdue ? '#dc2626' : isUpcoming ? '#d97706' : 'inherit', fontWeight: isOverdue || isUpcoming ? 600 : 'normal' }}>
                {request.dueAt ? dayjs(request.dueAt).format('DD/MM/YYYY HH:mm:ss') : '---'}
              </span>
            </Descriptions.Item>
            <Descriptions.Item label="Lý do yêu cầu">
              <Paragraph style={{ whiteSpace: 'pre-wrap', marginBottom: 0 }}>
                {request.reason || '---'}
              </Paragraph>
            </Descriptions.Item>
          </Descriptions>

          <Divider style={{ margin: '16px 0' }} />

          <Descriptions title="Kết quả giải quyết & Lưu vết" bordered size="small" column={1}>
            <Descriptions.Item label="Kết quả xử lý">
              {request.result ? (
                <Paragraph style={{ whiteSpace: 'pre-wrap', marginBottom: 0, fontWeight: 500, color: '#15803d' }}>
                  {request.result}
                </Paragraph>
              ) : (
                <Text type="secondary">Chưa có kết quả xử lý (yêu cầu đang chờ giải quyết)</Text>
              )}
            </Descriptions.Item>
            <Descriptions.Item label="Thời điểm hoàn tất">
              {request.completedAt ? dayjs(request.completedAt).format('DD/MM/YYYY HH:mm:ss') : '---'}
            </Descriptions.Item>
            <Descriptions.Item label="Người xử lý">
              {processorDetail?.fullName ? (
                <span>
                  <UserOutlined style={{ marginRight: 6 }} />
                  {processorDetail.fullName} ({processorDetail.username})
                </span>
              ) : request.processedBy ? (
                <Text code>{request.processedBy}</Text>
              ) : (
                '---'
              )}
            </Descriptions.Item>
          </Descriptions>
        </div>
      ) : null}
    </Drawer>
  )
}

export default PersonalDataRequestDetailDrawer
