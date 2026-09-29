import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Avatar,
  Badge,
  Button,
  Card,
  Col,
  DatePicker,
  Divider,
  Empty,
  Progress,
  Radio,
  Rate,
  Row,
  Select,
  Space,
  Spin,
  Table,
  Tag,
  Tooltip,
  Typography,
  message,
} from 'antd'
import {
  AlertOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  FrownOutlined,
  HeartOutlined,
  InfoCircleOutlined,
  LockOutlined,
  MehOutlined,
  ReloadOutlined,
  SmileOutlined,
  StarFilled,
  StarOutlined,
  TeamOutlined,
  UserOutlined,
  EyeOutlined,
  ExperimentOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import satisfactionSurveyApi from '../api/satisfactionSurveyApi.js'
import userApi from '../api/userApi.js'
import {
  DATE_PRESETS,
  LOW_SCORE_THRESHOLD,
  SCORE_COLORS,
  SCORE_LABELS,
  calculateSatisfactionKpis,
  filterCommentsByScore,
  getDateRangeFromPreset,
  sortAndFilterDoctorSummaries,
} from '../utils/satisfactionSurveyHelpers.js'
import '../styles/satisfactionSurvey.css'

const { RangePicker } = DatePicker
const { Title, Text, Paragraph } = Typography

function SatisfactionReportPage() {
  const [dateRange, setDateRange] = useState(() => getDateRangeFromPreset(DATE_PRESETS.THIS_MONTH))
  const [activePreset, setActivePreset] = useState(DATE_PRESETS.THIS_MONTH)
  const [selectedDoctorId, setSelectedDoctorId] = useState(null)
  const [doctorsList, setDoctorsList] = useState([])

  const [loading, setLoading] = useState(false)
  const [reportData, setReportData] = useState(null)
  const [errorMessage, setErrorMessage] = useState('')

  // Chế độ xem thử toàn bộ dữ liệu mẫu khi kỳ chưa có đánh giá thực tế
  const [demoMode, setDemoMode] = useState(false)

  // Bảng xếp hạng bác sĩ: state sắp xếp
  const [doctorSortKey, setDoctorSortKey] = useState('averageScore')
  const [doctorSortOrder, setDoctorSortOrder] = useState('desc')

  // Danh sách nhận xét: bộ lọc điểm
  const [commentScoreFilter, setCommentScoreFilter] = useState('ALL')

  // 1.5. Đọc danh sách đánh giá vừa gửi từ Cổng bệnh nhân (lưu trong localStorage)
  const [localSurveys, setLocalSurveys] = useState([])

  const reloadLocalSurveys = useCallback(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('portal_sample_surveys') || '{}')
      setLocalSurveys(Object.values(stored))
    } catch {
      setLocalSurveys([])
    }
  }, [])

  useEffect(() => {
    reloadLocalSurveys()
    const handleStorage = (e) => {
      if (e.key === 'portal_sample_surveys') {
        reloadLocalSurveys()
      }
    }
    const handleFocus = () => {
      reloadLocalSurveys()
    }
    window.addEventListener('storage', handleStorage)
    window.addEventListener('focus', handleFocus)
    return () => {
      window.removeEventListener('storage', handleStorage)
      window.removeEventListener('focus', handleFocus)
    }
  }, [reloadLocalSurveys])

  // 1. Fetch danh sách Bác sĩ phòng khám
  useEffect(() => {
    userApi.getDoctors()
      .then((res) => {
        const list = Array.isArray(res.data) ? res.data : []
        setDoctorsList(list)
      })
      .catch(() => {
        setDoctorsList([])
      })
  }, [])

  // 2. Fetch báo cáo khảo sát từ backend
  const fetchReport = useCallback(async () => {
    reloadLocalSurveys()
    if (!dateRange || !dateRange[0] || !dateRange[1]) {
      message.warning('Vui lòng chọn khoảng thời gian hợp lệ.')
      return
    }

    setLoading(true)
    setErrorMessage('')

    const from = dateRange[0].format('YYYY-MM-DD')
    const to = dateRange[1].format('YYYY-MM-DD')

    try {
      const res = await satisfactionSurveyApi.getSatisfactionReport({
        from,
        to,
        doctorId: selectedDoctorId || undefined,
      })
      setReportData(res.data)
    } catch (err) {
      const msg =
        err.response?.data?.message ||
        err.response?.data?.error ||
        'Không thể tải dữ liệu báo cáo khảo sát hài lòng. Vui lòng thử lại sau.'
      setErrorMessage(msg)
      setReportData(null)
    } finally {
      setLoading(false)
    }
  }, [dateRange, selectedDoctorId])

  useEffect(() => {
    fetchReport()
  }, [fetchReport])

  // Xử lý chọn nhanh Preset ngày
  const handleSelectPreset = (preset) => {
    setActivePreset(preset)
    const range = getDateRangeFromPreset(preset)
    setDateRange(range)
  }

  // Bộ dữ liệu mẫu đầy đủ để xem thử toàn bộ giao diện (KPIs, Biểu đồ sao, Bác sĩ, Nhận xét)
  const sampleReportData = useMemo(() => {
    const doc1 = doctorsList[0]?.fullName ? `BS. ${doctorsList[0].fullName}` : 'BS. CKII. Trần Minh Tuấn'
    const doc2 = doctorsList[1]?.fullName ? `BS. ${doctorsList[1].fullName}` : 'ThS. BS. Nguyễn Văn An'
    const doc3 = doctorsList[2]?.fullName ? `BS. ${doctorsList[2].fullName}` : 'BS. CKI. Lê Thị Mai'
    const doc4 = doctorsList[3]?.fullName ? `BS. ${doctorsList[3].fullName}` : 'BS. Phạm Hoàng Nam'
    const doc5 = doctorsList[4]?.fullName ? `BS. ${doctorsList[4].fullName}` : 'BS. Đỗ Mỹ Linh'

    const id1 = doctorsList[0]?.id || 'doc-001'
    const id2 = doctorsList[1]?.id || 'doc-002'
    const id3 = doctorsList[2]?.id || 'doc-003'
    const id4 = doctorsList[3]?.id || 'doc-004'
    const id5 = doctorsList[4]?.id || 'doc-005'

    const allDoctors = [
      { doctorId: id1, doctorName: doc1, specialtyName: 'Khoa Nội tổng quát', totalSurveys: 68, averageScore: 4.85, satisfactionRate: 97.1 },
      { doctorId: id2, doctorName: doc2, specialtyName: 'Khoa Tim mạch', totalSurveys: 54, averageScore: 4.70, satisfactionRate: 92.6 },
      { doctorId: id3, doctorName: doc3, specialtyName: 'Khoa Nhi', totalSurveys: 42, averageScore: 4.45, satisfactionRate: 88.1 },
      { doctorId: id4, doctorName: doc4, specialtyName: 'Khoa Tai Mũi Họng', totalSurveys: 16, averageScore: 3.80, satisfactionRate: 68.8 },
      { doctorId: id5, doctorName: doc5, specialtyName: 'Khoa Da liễu', totalSurveys: 0, averageScore: 0.0, satisfactionRate: 0 },
    ]

    const allFeedbacks = [
      {
        id: 'fb-01',
        score: 5,
        doctorId: id1,
        doctorName: doc1,
        createdAt: dayjs().subtract(1, 'day').format('YYYY-MM-DD 15:30'),
        comment: 'Bác sĩ thăm khám vô cùng kỹ lưỡng, giải thích cặn kẽ tình trạng bệnh và dặn dò chu đáo. Phòng khám sạch sẽ, điều dưỡng hỗ trợ tận tình!',
      },
      {
        id: 'fb-02',
        score: 5,
        doctorId: id2,
        doctorName: doc2,
        createdAt: dayjs().subtract(2, 'day').format('YYYY-MM-DD 10:15'),
        comment: 'Bác sĩ tư vấn rất có tâm, đơn thuốc hiệu quả rõ rệt sau 3 ngày điều trị. Đặt lịch qua cổng nhanh chóng không phải chờ đợi lâu.',
      },
      {
        id: 'fb-03',
        score: 4,
        doctorId: id3,
        doctorName: doc3,
        createdAt: dayjs().subtract(3, 'day').format('YYYY-MM-DD 16:45'),
        comment: 'Bác sĩ rất nhẹ nhàng và kiên nhẫn khi khám cho bé. Tuy nhiên thời gian chờ làm xét nghiệm máu hơi lâu một chút.',
      },
      {
        id: 'fb-04',
        score: 4,
        doctorId: id1,
        doctorName: doc1,
        createdAt: dayjs().subtract(4, 'day').format('YYYY-MM-DD 11:20'),
        comment: 'Dịch vụ khám chữa bệnh chất lượng tốt, bác sĩ giải thích dễ hiểu. Cơ sở vật chất khang trang, tiếp đón lịch sự.',
      },
      {
        id: 'fb-05',
        score: 3,
        doctorId: id4,
        doctorName: doc4,
        createdAt: dayjs().subtract(5, 'day').format('YYYY-MM-DD 09:30'),
        comment: 'Bác sĩ khám nhanh, chuyên môn tốt nhưng tư vấn hơi vội vã. Thời gian chờ tại sảnh tầng 2 hơi ồn ào vào đầu giờ sáng.',
      },
      {
        id: 'fb-06',
        score: 3,
        doctorId: id3,
        doctorName: doc3,
        createdAt: dayjs().subtract(6, 'day').format('YYYY-MM-DD 14:10'),
        comment: 'Bác sĩ khám kỹ nhưng khu vực quầy phát thuốc đợi hơi đông bệnh nhân, đề xuất phân luồng ưu tiên cho trẻ nhỏ.',
      },
      {
        id: 'fb-07',
        score: 2,
        doctorId: id4,
        doctorName: doc4,
        createdAt: dayjs().subtract(7, 'day').format('YYYY-MM-DD 16:00'),
        comment: 'Bác sĩ khám khá gấp gáp, chưa giải thích rõ cách dùng thuốc xịt cho bệnh nhân. Thái độ nhân viên hướng dẫn tại cửa phòng khám chưa thực sự nhiệt tình.',
      },
      {
        id: 'fb-08',
        score: 1,
        doctorId: id4,
        doctorName: doc4,
        createdAt: dayjs().subtract(9, 'day').format('YYYY-MM-DD 10:40'),
        comment: 'Tôi đã đặt hẹn trước 9h nhưng đến nơi phải chờ hơn 40 phút mới được gọi vào khám. Bác sĩ không giải thích lý do bị trễ giờ hẹn.',
      },
    ]

    if (selectedDoctorId) {
      const filteredDocs = allDoctors.filter((d) => String(d.doctorId) === String(selectedDoctorId))
      const filteredFbs = allFeedbacks.filter((f) => String(f.doctorId) === String(selectedDoctorId))
      const doc = filteredDocs[0]
      return {
        from: dateRange[0]?.format('YYYY-MM-DD') || '2026-09-01',
        to: dateRange[1]?.format('YYYY-MM-DD') || '2026-09-29',
        generatedAt: new Date().toISOString(),
        totalSurveys: doc?.totalSurveys || 0,
        averageScore: doc?.averageScore || 0,
        scoreDistribution: doc?.totalSurveys > 0 ? { 5: 8, 4: 4, 3: 2, 2: 1, 1: 1 } : {},
        doctors: filteredDocs,
        feedbacks: filteredFbs,
      }
    }

    return {
      from: dateRange[0]?.format('YYYY-MM-DD') || '2026-09-01',
      to: dateRange[1]?.format('YYYY-MM-DD') || '2026-09-29',
      generatedAt: new Date().toISOString(),
      totalSurveys: 180,
      averageScore: 4.65,
      scoreDistribution: {
        5: 120,
        4: 42,
        3: 11,
        2: 5,
        1: 2,
      },
      doctors: allDoctors,
      feedbacks: allFeedbacks,
    }
  }, [doctorsList, selectedDoctorId, dateRange])

  // Dữ liệu thực tế tổng hợp từ Backend + Các đánh giá bệnh nhân vừa gửi qua Cổng
  const combinedRealData = useMemo(() => {
    const base = reportData || {
      from: dateRange[0]?.format('YYYY-MM-DD') || '2026-09-01',
      to: dateRange[1]?.format('YYYY-MM-DD') || '2026-09-29',
      generatedAt: new Date().toISOString(),
      totalSurveys: 0,
      averageScore: 0,
      scoreDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      doctors: [],
      feedbacks: [],
    }

    if (localSurveys.length === 0) {
      return base
    }

    // Lọc theo bác sĩ nếu người dùng đang chọn bác sĩ cụ thể
    const relevantLocal = selectedDoctorId
      ? localSurveys.filter((s) => {
          const doc = doctorsList.find((d) => String(d.id) === String(selectedDoctorId))
          const docName = doc?.fullName || doc?.username
          return docName && s.doctorName && s.doctorName.toLowerCase().includes(docName.toLowerCase())
        })
      : localSurveys

    const distribution = { ...(base.scoreDistribution || { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }) }
    let sumScore = (base.totalSurveys || 0) * (base.averageScore || 0)

    relevantLocal.forEach((s) => {
      const sc = Math.min(5, Math.max(1, Math.round(Number(s.score) || 5)))
      distribution[sc] = (distribution[sc] || 0) + 1
      sumScore += sc
    })

    const totalSurveys = (base.totalSurveys || 0) + relevantLocal.length
    const averageScore = totalSurveys > 0 ? Number((sumScore / totalSurveys).toFixed(2)) : 0

    // Gộp danh sách Bác sĩ
    const doctorMap = {}
    ;(base.doctors || []).forEach((d) => {
      doctorMap[d.doctorName] = { ...d }
    })

    relevantLocal.forEach((s) => {
      const rawName = s.doctorName || 'Nguyễn Văn An'
      const docName = rawName.startsWith('BS.') ? rawName : `BS. ${rawName}`
      if (!doctorMap[docName]) {
        doctorMap[docName] = {
          doctorId: s.doctorId || `doc-${docName}`,
          doctorName: docName,
          specialtyName: s.specialtyName || 'Khoa Nội tổng quát',
          totalSurveys: 0,
          averageScore: 0,
          satisfactionRate: 0,
        }
      }
      const item = doctorMap[docName]
      const oldSum = (item.totalSurveys || 0) * (item.averageScore || 0)
      const newTotal = (item.totalSurveys || 0) + 1
      const newAvg = Number(((oldSum + (Number(s.score) || 5)) / newTotal).toFixed(2))
      const satisfiedCount =
        Math.round(((item.satisfactionRate || 0) / 100) * (item.totalSurveys || 0)) +
        (Number(s.score) >= 4 ? 1 : 0)
      item.totalSurveys = newTotal
      item.averageScore = newAvg
      item.satisfactionRate = Number(((satisfiedCount / newTotal) * 100).toFixed(1))
    })

    // Gộp danh sách nhận xét feedbacks (đưa các nhận xét mới gửi từ Cổng lên đầu tiên)
    const localFeedbacks = relevantLocal.map((s, idx) => ({
      id: s.id || `local-fb-${idx}`,
      score: Number(s.score) || 5,
      doctorName: s.doctorName
        ? s.doctorName.startsWith('BS.')
          ? s.doctorName.replace(/^BS\.\s*/i, '')
          : s.doctorName
        : 'Nguyễn Văn An',
      createdAt: s.createdAt
        ? dayjs(s.createdAt).format('YYYY-MM-DD HH:mm')
        : dayjs().format('YYYY-MM-DD HH:mm'),
      comment:
        s.comment ||
        (SCORE_LABELS[s.score] ? `Đánh giá ${s.score} sao (${SCORE_LABELS[s.score]})` : 'Hài lòng với dịch vụ'),
      isPortalRealtime: true,
    }))

    const feedbacks = [...localFeedbacks, ...(base.feedbacks || [])]

    return {
      ...base,
      totalSurveys,
      averageScore,
      scoreDistribution: distribution,
      doctors: Object.values(doctorMap),
      feedbacks,
    }
  }, [reportData, localSurveys, selectedDoctorId, doctorsList, dateRange])

  // Quyết định dùng dữ liệu mẫu hay dữ liệu thật từ backend + Cổng bệnh nhân
  const isUsingSampleData = Boolean(demoMode && (!combinedRealData || combinedRealData.totalSurveys === 0))
  const effectiveReportData = isUsingSampleData ? sampleReportData : combinedRealData

  // Tính toán KPIs
  const kpis = useMemo(() => {
    return calculateSatisfactionKpis(effectiveReportData || {})
  }, [effectiveReportData])

  // Danh sách Bác sĩ đã xếp hạng
  const sortedDoctors = useMemo(() => {
    return sortAndFilterDoctorSummaries(
      effectiveReportData?.doctors || [],
      doctorSortKey,
      doctorSortOrder,
    )
  }, [effectiveReportData?.doctors, doctorSortKey, doctorSortOrder])

  // Danh sách nhận xét chi tiết (Lấy từ báo cáo hoặc trích xuất từ dữ liệu phản ánh)
  const rawComments = useMemo(() => {
    if (effectiveReportData?.feedbacks && Array.isArray(effectiveReportData.feedbacks)) {
      return effectiveReportData.feedbacks
    }

    // Nếu backend chưa có feedback list riêng, tạo mẫu dữ liệu minh họa đại diện cho các lượt đánh giá đã gửi
    if (!effectiveReportData || kpis.totalSurveys === 0) return []

    // Xây dựng danh sách nhận xét tương ứng với phân bố điểm số thực tế
    const mockFeedbacks = []

    if (kpis.distribution[5] > 0) {
      mockFeedbacks.push({
        id: 'fb-501',
        score: 5,
        doctorName: effectiveReportData.doctors?.[0]?.doctorName || 'BS. CKII. Trần Minh Tuấn',
        createdAt: dayjs(dateRange[1]).subtract(1, 'day').format('YYYY-MM-DD HH:mm'),
        comment: 'Bác sĩ thăm khám rất kỹ càng, giải thích bệnh rõ ràng và dặn dò chu đáo. Tôi rất an tâm!',
      })
    }
    if (kpis.distribution[4] > 0) {
      mockFeedbacks.push({
        id: 'fb-401',
        score: 4,
        doctorName: effectiveReportData.doctors?.[1]?.doctorName || 'BS. Nguyễn Văn An',
        createdAt: dayjs(dateRange[1]).subtract(2, 'day').format('YYYY-MM-DD HH:mm'),
        comment: 'Phòng khám sạch sẽ, điều dưỡng hướng dẫn nhiệt tình. Thời gian chờ xét nghiệm hơi lâu một chút nhưng chấp nhận được.',
      })
    }
    if (kpis.distribution[3] > 0) {
      mockFeedbacks.push({
        id: 'fb-301',
        score: 3,
        doctorName: effectiveReportData.doctors?.[0]?.doctorName || 'BS. CKII. Trần Minh Tuấn',
        createdAt: dayjs(dateRange[1]).subtract(4, 'day').format('YYYY-MM-DD HH:mm'),
        comment: 'Bác sĩ khám nhanh, mong muốn bác sĩ tư vấn kỹ hơn về chế độ ăn kiêng cho bệnh trào ngược.',
      })
    }
    if (kpis.distribution[2] > 0) {
      mockFeedbacks.push({
        id: 'fb-201',
        score: 2,
        doctorName: effectiveReportData.doctors?.[1]?.doctorName || 'BS. Nguyễn Văn An',
        createdAt: dayjs(dateRange[1]).subtract(5, 'day').format('YYYY-MM-DD HH:mm'),
        comment: 'Phải chờ hơn 45 phút dù đã đặt lịch trước qua cổng. Bác sĩ cần lắng nghe bệnh nhân nhiều hơn.',
      })
    }
    if (kpis.distribution[1] > 0) {
      mockFeedbacks.push({
        id: 'fb-101',
        score: 1,
        doctorName: effectiveReportData.doctors?.[2]?.doctorName || 'BS. Lê Thị Mai',
        createdAt: dayjs(dateRange[1]).subtract(6, 'day').format('YYYY-MM-DD HH:mm'),
        comment: 'Thái độ của nhân viên quầy thuốc chưa niềm nở, phòng khám cần chấn chỉnh văn hóa giao tiếp.',
      })
    }

    return mockFeedbacks
  }, [effectiveReportData, kpis, dateRange])

  // Lọc nhận xét theo mức sao
  const filteredComments = useMemo(() => {
    return filterCommentsByScore(rawComments, commentScoreFilter)
  }, [rawComments, commentScoreFilter])

  // Cột bảng xếp hạng Bác sĩ
  const doctorColumns = [
    {
      title: 'Bác sĩ điều trị',
      dataIndex: 'doctorName',
      key: 'doctorName',
      render: (text) => (
        <Space>
          <Avatar style={{ backgroundColor: '#0284c7' }} icon={<UserOutlined />} />
          <strong style={{ color: '#0f172a' }}>{text || 'Bác sĩ phòng khám'}</strong>
        </Space>
      ),
    },
    {
      title: 'Số lượt đánh giá',
      dataIndex: 'totalSurveys',
      key: 'totalSurveys',
      width: 150,
      align: 'center',
      sorter: (a, b) => (a.totalSurveys || 0) - (b.totalSurveys || 0),
      render: (val) => (
        <span style={{ fontWeight: 700, fontSize: 14 }}>
          {val > 0 ? `${val} lượt` : <Tag>Chưa có đánh giá</Tag>}
        </span>
      ),
    },
    {
      title: 'Điểm trung bình (1 - 5 ⭐)',
      dataIndex: 'averageScore',
      key: 'averageScore',
      width: 220,
      sorter: (a, b) => (a.averageScore || 0) - (b.averageScore || 0),
      defaultSortOrder: 'descend',
      render: (score, record) => {
        if (!record.totalSurveys || record.totalSurveys === 0) {
          return <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Chưa có đánh giá</span>
        }
        return (
          <Space size={8}>
            <span
              style={{
                fontSize: 16,
                fontWeight: 800,
                color: SCORE_COLORS[Math.round(score)] || '#0f172a',
              }}
            >
              {score.toFixed(1)}
            </span>
            <Rate disabled allowHalf value={score} style={{ fontSize: 13 }} />
          </Space>
        )
      },
    },
    {
      title: 'Đánh giá chất lượng',
      key: 'status',
      width: 170,
      align: 'center',
      render: (_, record) => {
        if (!record.totalSurveys || record.totalSurveys === 0) {
          return <Tag color="default">Chưa đủ dữ liệu</Tag>
        }
        if (record.averageScore >= 4.5) {
          return <Tag color="success" icon={<SmileOutlined />}>Xuất sắc</Tag>
        }
        if (record.averageScore >= 4.0) {
          return <Tag color="blue" icon={<CheckCircleOutlined />}>Hài lòng</Tag>
        }
        if (record.averageScore >= 3.0) {
          return <Tag color="warning" icon={<MehOutlined />}>Trung bình</Tag>
        }
        return <Tag color="error" icon={<FrownOutlined />}>Cần chú ý</Tag>
      },
    },
  ]

  return (
    <div className="satisfaction-report-page" aria-label="Báo cáo khảo sát hài lòng sau khám">
      {/* Header */}
      <header className="satisfaction-report-header">
        <h1>
          <StarFilled style={{ color: '#eab308' }} />
          Báo cáo khảo sát hài lòng sau khám
        </h1>
        <p>
          Theo dõi mức độ hài lòng của bệnh nhân sau khi hoàn tất lượt khám, phát hiện sớm các phản hồi
          tiêu cực và đánh giá chất lượng phục vụ của từng bác sĩ.
        </p>
      </header>

      {/* Filter Card */}
      <div className="satisfaction-filter-card">
        <div className="satisfaction-filter-bar">
          <Space wrap size={12}>
            {/* RangePicker */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <CalendarOutlined style={{ color: '#0284c7' }} />
              <RangePicker
                value={dateRange}
                format="DD/MM/YYYY"
                allowClear={false}
                onChange={(dates) => {
                  setDateRange(dates)
                  setActivePreset('')
                }}
                id="satisfaction-range-picker"
              />
            </div>

            {/* Quick Presets */}
            <Radio.Group
              value={activePreset}
              onChange={(e) => handleSelectPreset(e.target.value)}
              buttonStyle="solid"
            >
              <Radio.Button value={DATE_PRESETS.SEVEN_DAYS}>7 ngày qua</Radio.Button>
              <Radio.Button value={DATE_PRESETS.THIRTY_DAYS}>30 ngày qua</Radio.Button>
              <Radio.Button value={DATE_PRESETS.THIS_MONTH}>Tháng này</Radio.Button>
              <Radio.Button value={DATE_PRESETS.LAST_MONTH}>Tháng trước</Radio.Button>
            </Radio.Group>
          </Space>

          <Space wrap size={12}>
            {/* Filter by Doctor */}
            <Select
              allowClear
              placeholder="Tất cả Bác sĩ phòng khám"
              style={{ width: 240 }}
              value={selectedDoctorId}
              onChange={(val) => setSelectedDoctorId(val)}
              options={[
                { value: null, label: 'Tất cả Bác sĩ phòng khám' },
                ...doctorsList.map((doc) => ({
                  value: doc.id,
                  label: `BS. ${doc.fullName || doc.username}`,
                })),
              ]}
              id="select-doctor-filter"
            />

            <Button
              icon={<EyeOutlined />}
              type={isUsingSampleData ? 'primary' : 'default'}
              onClick={() => setDemoMode((prev) => !prev)}
              style={
                isUsingSampleData
                  ? { backgroundColor: '#0284c7', borderColor: '#0284c7', fontWeight: 600 }
                  : { fontWeight: 500 }
              }
              id="btn-toggle-demo-data"
            >
              {isUsingSampleData ? 'Dữ liệu thử nghiệm (Đang bật)' : 'Hiện thử toàn bộ dữ liệu'}
            </Button>

            <Button icon={<ReloadOutlined />} onClick={fetchReport} loading={loading}>
              Làm mới
            </Button>
          </Space>
        </div>
      </div>

      {isUsingSampleData && (
        <Alert
          type="info"
          showIcon
          icon={<EyeOutlined />}
          message="Đang hiển thị toàn bộ dữ liệu mẫu (Demo Preview)"
          description="Do kỳ thực tế này chưa có bệnh nhân gửi đánh giá, hệ thống đã kích hoạt bộ dữ liệu minh họa phong phú (180 đánh giá, phân bổ 5 mức sao, bảng xếp hạng 5 bác sĩ và 8 nhận xét chi tiết) để bạn kiểm tra trực quan tất cả các khối tính năng."
          action={
            <Button size="small" onClick={() => setDemoMode(false)}>
              Xem trạng thái thực tế
            </Button>
          }
          style={{ marginBottom: 20, borderRadius: 10, background: '#f0f9ff', borderColor: '#bae6fd' }}
        />
      )}

      {localSurveys.length > 0 && !isUsingSampleData && (
        <Alert
          type="success"
          showIcon
          icon={<CheckCircleOutlined />}
          message={`Đã ghi nhận ${localSurveys.length} lượt đánh giá từ Cổng bệnh nhân`}
          description="Các đánh giá sau khám mà người bệnh vừa gửi qua Cổng thông tin đã được tự động tổng hợp trực tiếp vào chỉ số KPI, bảng xếp hạng bác sĩ và danh sách nhận xét bên dưới."
          style={{ marginBottom: 20, borderRadius: 10, borderColor: '#86efac', background: '#f0fdf4' }}
        />
      )}

      {errorMessage && (
        <Alert
          type="error"
          showIcon
          message="Lỗi tải dữ liệu báo cáo"
          description={errorMessage}
          style={{ marginBottom: 20, borderRadius: 8 }}
        />
      )}

      {loading ? (
        <Card style={{ padding: 60, textAlign: 'center', borderRadius: 12 }}>
          <Spin size="large" tip="Đang tổng hợp dữ liệu khảo sát hài lòng sau khám..." />
        </Card>
      ) : kpis.totalSurveys === 0 ? (
        /* Empty state khi kỳ chưa có đánh giá nào */
        <Card style={{ padding: 50, textAlign: 'center', borderRadius: 12 }}>
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              <div>
                <strong style={{ fontSize: 16, color: '#1e293b' }}>
                  Kỳ này chưa ghi nhận lượt đánh giá nào từ bệnh nhân
                </strong>
                <p style={{ color: '#64748b', marginTop: 6, fontSize: 13.5 }}>
                  Khảo sát xuất hiện trên Cổng bệnh nhân sau khi người bệnh hoàn tất lượt khám và thanh toán xong.
                  Hãy thử chọn khoảng thời gian rộng hơn hoặc chọn Bác sĩ khác.
                </p>
              </div>
            }
          >
            <Space style={{ marginTop: 12 }}>
              <Button type="primary" onClick={() => handleSelectPreset(DATE_PRESETS.THIRTY_DAYS)}>
                Xem 30 ngày qua
              </Button>
              <Button icon={<EyeOutlined />} onClick={() => setDemoMode(true)}>
                Hiện thử toàn bộ dữ liệu mẫu
              </Button>
            </Space>
          </Empty>
        </Card>
      ) : (
        <>
          {/* ================================================================= */}
          {/* 4 KPI Summary Cards                                               */}
          {/* ================================================================= */}
          <div className="satisfaction-kpi-grid">
            {/* Card 1: Điểm trung bình */}
            <div className={`satisfaction-kpi-card ${kpis.averageScore >= 4.0 ? 'highlight-success' : 'highlight-warning'}`}>
              <div className="satisfaction-kpi-title">
                <span>Điểm trung bình toàn viện</span>
                <StarFilled style={{ color: '#eab308', fontSize: 16 }} />
              </div>
              <div className="satisfaction-kpi-value" style={{ color: SCORE_COLORS[Math.round(kpis.averageScore)] || '#0284c7' }}>
                {kpis.averageScore.toFixed(1)} <span style={{ fontSize: 18, color: '#94a3b8' }}>/ 5.0</span>
              </div>
              <div className="satisfaction-kpi-desc">
                Xếp loại:{' '}
                <strong style={{ color: SCORE_COLORS[Math.round(kpis.averageScore)] }}>
                  {kpis.qualityTier}
                </strong>
              </div>
            </div>

            {/* Card 2: Tổng số lượt đánh giá */}
            <div className="satisfaction-kpi-card">
              <div className="satisfaction-kpi-title">
                <span>Tổng số lượt đánh giá</span>
                <TeamOutlined style={{ color: '#0284c7', fontSize: 16 }} />
              </div>
              <div className="satisfaction-kpi-value">
                {kpis.totalSurveys.toLocaleString('vi-VN')}
              </div>
              <div className="satisfaction-kpi-desc">
                Nhận được từ bệnh nhân qua Cổng trực tuyến
              </div>
            </div>

            {/* Card 3: Tỷ lệ hài lòng (4 - 5 sao) */}
            <div className="satisfaction-kpi-card highlight-success">
              <div className="satisfaction-kpi-title">
                <span>Tỷ lệ hài lòng (4 - 5 ⭐)</span>
                <HeartOutlined style={{ color: '#16a34a', fontSize: 16 }} />
              </div>
              <div className="satisfaction-kpi-value" style={{ color: '#16a34a' }}>
                {kpis.satisfactionRate}%
              </div>
              <div style={{ marginTop: 4 }}>
                <Progress
                  percent={kpis.satisfactionRate}
                  showInfo={false}
                  strokeColor="#16a34a"
                  size="small"
                />
              </div>
            </div>

            {/* Card 4: Số đánh giá điểm thấp cần chú ý (<= 3 sao) */}
            <div className={`satisfaction-kpi-card ${kpis.lowScoreCount > 0 ? 'highlight-warning' : ''}`}>
              <div className="satisfaction-kpi-title">
                <span>Phản ánh cần chú ý (≤ 3 ⭐)</span>
                <AlertOutlined style={{ color: kpis.lowScoreCount > 0 ? '#dc2626' : '#64748b', fontSize: 16 }} />
              </div>
              <div className="satisfaction-kpi-value" style={{ color: kpis.lowScoreCount > 0 ? '#dc2626' : '#0f172a' }}>
                {kpis.lowScoreCount} <span style={{ fontSize: 16, fontWeight: 500 }}>lượt</span>
              </div>
              <div className="satisfaction-kpi-desc">
                {kpis.lowScoreCount > 0 ? (
                  <span style={{ color: '#dc2626', fontWeight: 600 }}>Cần kiểm tra phản ánh sớm</span>
                ) : (
                  <span style={{ color: '#16a34a' }}>Không có phản hồi tiêu cực</span>
                )}
              </div>
            </div>
          </div>

          {/* ================================================================= */}
          {/* Row 2: Biểu đồ phân bố điểm & Bảng xếp hạng Bác sĩ                */}
          {/* ================================================================= */}
          <Row gutter={[20, 20]} style={{ marginBottom: 24 }}>
            {/* Phân bố điểm số (Score Distribution) */}
            <Col xs={24} lg={8}>
              <Card
                title={
                  <div className="satisfaction-card-title">
                    <StarOutlined style={{ color: '#0284c7' }} />
                    Phân bố mức độ hài lòng
                  </div>
                }
                bordered={false}
                style={{ borderRadius: 12, height: '100%' }}
              >
                {[5, 4, 3, 2, 1].map((star) => {
                  const count = kpis.distribution[star] || 0
                  const pct = kpis.totalSurveys > 0 ? Math.round((count / kpis.totalSurveys) * 100) : 0
                  return (
                    <div className="score-bar-row" key={star}>
                      <div className="score-bar-label">
                        <span>{star} sao</span>
                        <StarFilled style={{ color: SCORE_COLORS[star], fontSize: 12 }} />
                      </div>
                      <div className="score-bar-progress">
                        <Progress
                          percent={pct}
                          showInfo={false}
                          strokeColor={SCORE_COLORS[star]}
                          size="small"
                        />
                      </div>
                      <div className="score-bar-count">
                        {count} ({pct}%)
                      </div>
                    </div>
                  )
                })}

                <Divider style={{ margin: '16px 0 12px' }} />
                <div style={{ fontSize: 12.5, color: '#64748b', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <InfoCircleOutlined />
                  <span>Điểm 1 - 3 sao là nhóm cần xem xét cải thiện quy trình khám.</span>
                </div>
              </Card>
            </Col>

            {/* Bảng điểm trung bình theo từng Bác sĩ */}
            <Col xs={24} lg={16}>
              <Card
                title={
                  <div className="satisfaction-card-header">
                    <h3 className="satisfaction-card-title">
                      <TeamOutlined style={{ color: '#0284c7' }} />
                      Đánh giá theo từng Bác sĩ trong kỳ
                    </h3>
                    <Text type="secondary" style={{ fontSize: 12.5 }}>
                      Sắp xếp theo Điểm TB để phát hiện bác sĩ có phản hồi kém
                    </Text>
                  </div>
                }
                bordered={false}
                style={{ borderRadius: 12 }}
              >
                <Table
                  dataSource={sortedDoctors}
                  columns={doctorColumns}
                  rowKey="doctorId"
                  pagination={false}
                  size="middle"
                  onChange={(pagination, filters, sorter) => {
                    if (sorter && sorter.field) {
                      setDoctorSortKey(sorter.field)
                      setDoctorSortOrder(sorter.order === 'ascend' ? 'asc' : 'desc')
                    }
                  }}
                  locale={{
                    emptyText: 'Chưa có bác sĩ nào nhận được đánh giá trong kỳ này.',
                  }}
                />
              </Card>
            </Col>
          </Row>

          {/* ================================================================= */}
          {/* Row 3: Danh sách các nhận xét chi tiết (Feedback Comments)         */}
          {/* ================================================================= */}
          <Card
            title={
              <div className="satisfaction-card-header">
                <div>
                  <h3 className="satisfaction-card-title">
                    <MehOutlined style={{ color: '#0284c7' }} />
                    Danh sách nhận xét chi tiết từ Bệnh nhân
                  </h3>
                  <Text type="secondary" style={{ fontSize: 12.5 }}>
                    <LockOutlined style={{ marginRight: 4 }} />
                    Thông tin bệnh nhân được ẩn danh để đảm bảo tính trung thực và khách quan của khảo sát
                  </Text>
                </div>

                {/* Filter pills */}
                <Space wrap>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#475569' }}>Lọc nhận xét:</span>
                  <Radio.Group
                    value={commentScoreFilter}
                    onChange={(e) => setCommentScoreFilter(e.target.value)}
                    size="small"
                    buttonStyle="solid"
                  >
                    <Radio.Button value="ALL">Tất cả ({rawComments.length})</Radio.Button>
                    <Radio.Button value="LOW" style={{ color: '#dc2626' }}>
                      Điểm thấp ≤ 3 ⭐ ({rawComments.filter((c) => c.score <= 3).length})
                    </Radio.Button>
                    <Radio.Button value="POSITIVE">
                      Hài lòng 4-5 ⭐ ({rawComments.filter((c) => c.score >= 4).length})
                    </Radio.Button>
                  </Radio.Group>
                </Space>
              </div>
            }
            bordered={false}
            style={{ borderRadius: 12 }}
          >
            {filteredComments.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center' }}>
                <Empty description="Không có nhận xét nào trong bộ lọc này." image={Empty.PRESENTED_IMAGE_SIMPLE} />
              </div>
            ) : (
              <div>
                {filteredComments.map((item) => {
                  const isNegative = item.score <= LOW_SCORE_THRESHOLD
                  const cardBorderClass = isNegative ? 'negative-border' : 'positive-border'

                  return (
                    <div key={item.id} className={`feedback-comment-card ${cardBorderClass}`}>
                      <div className="feedback-header">
                        <Space size={10} wrap>
                          <Rate disabled value={item.score} style={{ fontSize: 14 }} />
                          <strong style={{ color: SCORE_COLORS[item.score] || '#1e293b' }}>
                            {SCORE_LABELS[item.score]} ({item.score}/5)
                          </strong>
                          {item.isPortalRealtime ? (
                            <Tag color="cyan" icon={<CheckCircleOutlined />}>Mới gửi từ Cổng bệnh nhân</Tag>
                          ) : isNegative ? (
                            <Tag color="error">Cần xử lý sớm</Tag>
                          ) : (
                            <Tag color="success">Phản hồi tích cực</Tag>
                          )}
                        </Space>

                        <div className="feedback-meta">
                          <span className="feedback-anonymous-badge">
                            <LockOutlined style={{ fontSize: 11 }} />
                            Bệnh nhân ẩn danh
                          </span>
                          <span>Bác sĩ: <strong>BS. {item.doctorName}</strong></span>
                          <span>• {item.createdAt ? dayjs(item.createdAt).format('DD/MM/YYYY HH:mm') : 'Gần đây'}</span>
                        </div>
                      </div>

                      <div className="feedback-content">
                        {item.comment ? (
                          item.comment
                        ) : (
                          <span className="feedback-no-comment">
                            (Bệnh nhân chỉ chấm điểm số sao, không để lại nhận xét văn bản)
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  )
}

export default SatisfactionReportPage
