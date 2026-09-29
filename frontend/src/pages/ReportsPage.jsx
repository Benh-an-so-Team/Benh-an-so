import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Alert,
  Button,
  Card,
  DatePicker,
  Empty,
  Input,
  Radio,
  Select,
  Space,
  Switch,
  Tabs,
  Tag,
  Tooltip,
  Typography,
  message,
} from 'antd'
import {
  CalendarOutlined,
  DashboardOutlined,
  DollarCircleOutlined,
  DownloadOutlined,
  FileSearchOutlined,
  LineChartOutlined,
  MedicineBoxOutlined,
  PrinterOutlined,
  ReloadOutlined,
  UserOutlined,
  BarChartOutlined,
  StarOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import reportApi from '../api/reportApi'
import billingApi from '../api/billingApi'
import { useAuthContext } from '../context/AuthContext'
import { getApiErrorMessage, isAccessDeniedApiError, normalizeApiError } from '../utils/apiError'
import {
  REPORT_TYPES,
  downloadCsvBlob,
  getExportErrorMessage,
  getExportFilename,
  validateExportParams,
  isIdentifyingReportType,
  canUserExportUnmasked,
  validateUnmaskReason,
  buildExportQueryParams,
} from '../utils/reportExportHelpers'
import ReportStatCards from '../components/reporting/ReportStatCards'
import ReportPrintTemplateModal from '../components/reporting/ReportPrintTemplateModal'
import OverviewReportView from '../components/reporting/OverviewReportView'
import VisitReportView from '../components/reporting/VisitReportView'
import DoctorVisitsReportView from '../components/reporting/DoctorVisitsReportView'
import RevenueReportView from '../components/reporting/RevenueReportView'
import TopMedicinesReportView from '../components/reporting/TopMedicinesReportView'
import AuditLogsReportView from '../components/reporting/AuditLogsReportView'
import {
  getStoredAuditLogs,
  getStoredInvoices,
  getStoredMedicalRecords,
  getStoredMedicines,
  getStoredPrescriptions,
  mergeInvoices,
} from '../utils/storageHelpers'

import DiseasePatternReportPage from './DiseasePatternReportPage.jsx'
import RevenueBreakdownReportPage from './RevenueBreakdownReportPage.jsx'
import AppointmentEffectivenessReportPage from './AppointmentEffectivenessReportPage.jsx'
import InventoryStockReportPage from './InventoryStockReportPage.jsx'
import SatisfactionReportPage from './SatisfactionReportPage.jsx'

const { RangePicker } = DatePicker
const { Title, Text } = Typography

const VALID_TABS = ['overview', 'visits', 'doctor-visits', 'revenue', 'medicines', 'audit', 'disease-patterns', 'revenue-breakdown', 'appointment-effectiveness', 'inventory-stock', 'satisfaction']

function ReportsPage() {
  const { user } = useAuthContext()
  const [searchParams, setSearchParams] = useSearchParams()

  const userRoles = useMemo(() => {
    return (user?.roles || [user?.role || '']).map((r) => String(r || '').toLowerCase().replace(/^role_/, ''))
  }, [user])
  const userPermissions = useMemo(() => {
    return (user?.permissions || []).map((p) => String(p || '').toUpperCase().replace(/^PERMISSION_/, ''))
  }, [user])

  const isAdmin = userRoles.includes('admin')
  const isManager = userRoles.includes('manager') || userRoles.includes('clinic_manager')

  const canViewReports = userPermissions.includes('REPORT_VIEW') || isAdmin || isManager
  const canExportReports = userPermissions.includes('REPORT_EXPORT') || isAdmin || isManager
  const canExportAccessLog = isAdmin || userPermissions.includes('ACCESS_LOG_REPORT_EXPORT')
  const canExportUnmasked = canUserExportUnmasked(user?.permissions) || isAdmin || isManager

  // URL parameters parsing
  const urlTab = searchParams.get('tab')
  const initialTab = VALID_TABS.includes(urlTab) ? urlTab : 'visits'

  const urlFrom = searchParams.get('from')
  const urlTo = searchParams.get('to')
  const initialRange = useMemo(() => {
    if (urlFrom && urlTo && dayjs(urlFrom).isValid() && dayjs(urlTo).isValid()) {
      return [dayjs(urlFrom), dayjs(urlTo)]
    }
    return [dayjs().subtract(29, 'day'), dayjs()]
  }, [urlFrom, urlTo])

  const [range, setRange] = useState(initialRange)
  const [activeTab, setActiveTab] = useState(initialTab)
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const isExportingRef = useRef(false)
  const [printModalOpen, setPrintModalOpen] = useState(false)
  const [loadError, setLoadError] = useState('')

  const [summary, setSummary] = useState({
    visitCount: 0,
    revenue: 0,
    dispensedCount: 0,
    auditCount: 0,
    currency: 'VND',
  })
  const [timeline, setTimeline] = useState([])
  const [topMedicines, setTopMedicines] = useState([])
  const [auditLogs, setAuditLogs] = useState([])
  const [invoicesList, setInvoicesList] = useState([])

  const fromStr = useMemo(
    () => (range?.[0] ? range[0].format('YYYY-MM-DD') : dayjs().subtract(29, 'day').format('YYYY-MM-DD')),
    [range],
  )
  const toStr = useMemo(
    () => (range?.[1] ? range[1].format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD')),
    [range],
  )

  // Synchronize state with URL query parameters
  const updateUrlParams = useCallback((newTab, newRange) => {
    const from = newRange?.[0] ? newRange[0].format('YYYY-MM-DD') : fromStr
    const to = newRange?.[1] ? newRange[1].format('YYYY-MM-DD') : toStr
    setSearchParams(
      {
        tab: newTab || activeTab,
        from,
        to,
      },
      { replace: true },
    )
  }, [activeTab, fromStr, toStr, setSearchParams])

  const handleRangeChange = (newRange) => {
    if (newRange && newRange[0] && newRange[1]) {
      setRange(newRange)
      updateUrlParams(activeTab, newRange)
    }
  }

  const handleQuickPreset = (presetType) => {
    let newRange = [dayjs().subtract(29, 'day'), dayjs()]
    if (presetType === 'TODAY') {
      newRange = [dayjs().startOf('day'), dayjs().endOf('day')]
    } else if (presetType === 'YESTERDAY') {
      newRange = [dayjs().subtract(1, 'day').startOf('day'), dayjs().subtract(1, 'day').endOf('day')]
    } else if (presetType === '7DAYS') {
      newRange = [dayjs().subtract(6, 'day').startOf('day'), dayjs().endOf('day')]
    } else if (presetType === '30DAYS') {
      newRange = [dayjs().subtract(29, 'day').startOf('day'), dayjs().endOf('day')]
    } else if (presetType === 'THIS_MONTH') {
      newRange = [dayjs().startOf('month'), dayjs().endOf('month')]
    } else if (presetType === 'THIS_YEAR') {
      newRange = [dayjs().startOf('year'), dayjs().endOf('year')]
    }
    setRange(newRange)
    updateUrlParams(activeTab, newRange)
  }

  const getParams = useCallback(() => ({
    from: fromStr,
    to: toStr,
  }), [fromStr, toStr])

  const loadData = useCallback(async () => {
    if (!fromStr || !toStr) return

    setLoading(true)
    setLoadError('')
    const params = getParams()

    try {
      const [summaryRes, timelineRes, medicinesRes, auditRes, invoicesRes] = await Promise.allSettled([
        reportApi.summary(params),
        reportApi.timeline(params),
        reportApi.topMedicines(params),
        reportApi.audit(params),
        billingApi.getAll(),
      ])

      const apiSummary = summaryRes.status === 'fulfilled' ? summaryRes.value.data : null
      const apiTimeline = timelineRes.status === 'fulfilled' ? timelineRes.value.data : null
      const apiTopMedicines = medicinesRes.status === 'fulfilled' ? medicinesRes.value.data : null
      const apiAudit = auditRes.status === 'fulfilled' ? auditRes.value.data : null
      const apiInvoicesRaw = invoicesRes.status === 'fulfilled' ? invoicesRes.value.data : null
      const apiInvoicesList = (apiInvoicesRaw && Array.isArray(apiInvoicesRaw.content))
        ? apiInvoicesRaw.content
        : (Array.isArray(apiInvoicesRaw) ? apiInvoicesRaw : [])

      const storedRecords = getStoredMedicalRecords()
      const storedInvoices = getStoredInvoices()
      const storedPrescriptions = getStoredPrescriptions()
      const storedMedicines = getStoredMedicines()
      const storedLogs = getStoredAuditLogs()

      const apiRecords = (apiSummary && Array.isArray(apiSummary.records)) ? apiSummary.records : []
      const apiInvs = (apiSummary && Array.isArray(apiSummary.invoices)) ? apiSummary.invoices : apiInvoicesList
      const apiPrescs = (apiSummary && Array.isArray(apiSummary.prescriptions)) ? apiSummary.prescriptions : []

      const realRecords = [...storedRecords, ...apiRecords]
      const realInvoices = mergeInvoices([...storedInvoices, ...apiInvs])
      const realPrescriptions = [...storedPrescriptions, ...apiPrescs]
      const realLogs = (apiAudit && Array.isArray(apiAudit)) ? [...storedLogs, ...apiAudit] : storedLogs

      setInvoicesList(realInvoices)

      const totalVisits = apiSummary?.visitCount != null ? Number(apiSummary.visitCount) : realRecords.length
      const totalRevenue = apiSummary?.revenue != null ? Number(apiSummary.revenue) : realInvoices.reduce((sum, inv) => sum + Number(inv.totalAmount || 0), 0)
      const dispensedCount = realPrescriptions.filter((p) => p.status === 'DISPENSED' || p.status === 'COMPLETED').length
      const auditCount = realLogs.length

      let timelineList = []
      if (apiTimeline && Array.isArray(apiTimeline.items) && apiTimeline.items.length > 0) {
        timelineList = apiTimeline.items.map((item) => ({
          date: item.date,
          reportDate: dayjs(item.date).format('DD/MM/YYYY'),
          visitCount: Number(item.visitCount || 0),
          revenue: Number(item.revenue || 0),
        }))
      } else {
        const startDate = range[0] || dayjs().subtract(29, 'day')
        const endDate = range[1] || dayjs()
        const diffDays = Math.max(0, endDate.diff(startDate, 'day'))
        const datesCount = Math.min(diffDays + 1, 366)

        for (let i = 0; i < datesCount; i++) {
          const currentDate = startDate.add(i, 'day')
          const formattedDate = currentDate.format('DD/MM/YYYY')
          const dateISO = currentDate.format('YYYY-MM-DD')

          const dayVisits = realRecords.filter((r) => (
            r.createdAt && dayjs(r.createdAt).format('YYYY-MM-DD') === dateISO
          )).length

          const dayRevenue = realInvoices
            .filter((inv) => inv.createdAt && dayjs(inv.createdAt).format('YYYY-MM-DD') === dateISO)
            .reduce((sum, inv) => sum + Number(inv.totalAmount || 0), 0)

          timelineList.push({
            date: dateISO,
            reportDate: formattedDate,
            visitCount: dayVisits,
            revenue: dayRevenue,
          })
        }
      }

      let rankedMeds = []
      if (apiTopMedicines && Array.isArray(apiTopMedicines.items)) {
        rankedMeds = apiTopMedicines.items.map((m) => ({
          name: m.medicineName || m.name,
          category: 'Dược phẩm',
          dispensedQuantity: m.totalDispensedQuantity || m.dispensedQuantity || 0,
        }))
      } else {
        const medMap = new Map()
        realPrescriptions.forEach((p) => {
          let items = []
          try {
            items = typeof p.items === 'string' ? JSON.parse(p.items) : (p.items || [])
          } catch {
            items = []
          }
          items.forEach((item) => {
            const medName = storedMedicines.find((m) => m.id === item.medicineId)?.name || item.medicineId || 'Thuốc'
            const currentQty = medMap.get(medName) || 0
            medMap.set(medName, currentQty + Number(item.quantity || 1))
          })
        })

        rankedMeds = Array.from(medMap.entries())
          .map(([name, dispensedQuantity]) => ({ name, category: 'Dược phẩm', dispensedQuantity }))
          .sort((a, b) => b.dispensedQuantity - a.dispensedQuantity)
      }

      setSummary({
        visitCount: totalVisits,
        revenue: totalRevenue,
        dispensedCount,
        auditCount,
        currency: apiSummary?.currency || 'VND',
      })

      setTimeline(timelineList)
      setTopMedicines(rankedMeds)
      setAuditLogs(realLogs)
    } catch (err) {
      console.error('Lỗi tải báo cáo vận hành:', err)
      const apiError = err.apiError || normalizeApiError(err, 'Không thể tải báo cáo.')
      if (!isAccessDeniedApiError(apiError)) {
        setLoadError(getApiErrorMessage(err, 'Không thể tải dữ liệu báo cáo từ máy chủ.'))
      } else {
        setLoadError('')
      }
    } finally {
      setLoading(false)
    }
  }, [fromStr, toStr, getParams, range])

  useEffect(() => {
    loadData()
  }, [loadData])

  const [selectedReportType, setSelectedReportType] = useState('VISIT_REPORT')
  const [unmask, setUnmask] = useState(false)
  const [unmaskReason, setUnmaskReason] = useState('')
  const [reasonError, setReasonError] = useState('')

  const hasIdentifyingData = useMemo(
    () => isIdentifyingReportType(selectedReportType),
    [selectedReportType],
  )

  const handleTabChange = (key) => {
    setActiveTab(key)
    updateUrlParams(key, range)
    let nextReportType = 'VISIT_REPORT'
    if (key === 'visits') {
      nextReportType = 'VISIT_REPORT'
    } else if (key === 'revenue') {
      nextReportType = 'REVENUE_REPORT'
    } else if (key === 'overview') {
      nextReportType = 'OPERATIONAL_REPORT'
    } else if (key === 'doctor-visits') {
      nextReportType = 'DOCTOR_VISITS_REPORT'
    } else if (key === 'medicines') {
      nextReportType = 'TOP_MEDICINES_REPORT'
    } else if (key === 'audit') {
      nextReportType = 'ACCESS_LOG_REPORT'
    }
    setSelectedReportType(nextReportType)
    if (!isIdentifyingReportType(nextReportType)) {
      setUnmask(false)
      setUnmaskReason('')
      setReasonError('')
    }
  }

  const handleExport = async () => {
    if (isExportingRef.current || exporting) return

    const params = getParams()
    const validation = validateExportParams(params)
    if (!validation.isValid) {
      message.error(validation.errorMessage || validation.message)
      return
    }

    if (selectedReportType === 'ACCESS_LOG_REPORT' && !canExportAccessLog) {
      message.error('Bạn không có quyền xuất báo cáo (Yêu cầu quyền ACCESS_LOG_REPORT_EXPORT của Quản trị viên).')
      return
    }

    if (hasIdentifyingData && unmask) {
      const reasonVal = validateUnmaskReason(unmaskReason)
      if (!reasonVal.isValid) {
        setReasonError(reasonVal.error)
        return
      }
      setReasonError('')
    }

    isExportingRef.current = true
    setExporting(true)
    try {
      const exportParams = buildExportQueryParams({
        ...params,
        reportType: selectedReportType,
        unmask,
        reason: unmaskReason,
      })

      let response
      if (selectedReportType === 'OPERATIONAL_REPORT') {
        response = await reportApi.exportOperational(exportParams)
      } else if (selectedReportType === 'VISIT_REPORT' || selectedReportType === 'DOCTOR_VISITS_REPORT') {
        response = await reportApi.exportVisits(exportParams)
      } else if (selectedReportType === 'REVENUE_REPORT') {
        response = await reportApi.exportRevenue(params)
      } else if (selectedReportType === 'ACCESS_LOG_REPORT') {
        response = await reportApi.exportAccessLog(params)
      } else {
        response = await reportApi.exportVisits(exportParams)
      }

      const disposition = response.headers?.['content-disposition']
      const filename = getExportFilename(disposition, selectedReportType, params.from, params.to)
      downloadCsvBlob(response.data, filename)
      message.success(`Đã xuất báo cáo ${filename} thành công!`)
    } catch (err) {
      console.error('Lỗi xuất báo cáo CSV:', err)
      let errorData = null
      if (err?.response?.data instanceof Blob) {
        try {
          const text = await err.response.data.text()
          errorData = JSON.parse(text)
        } catch {
          // ignore
        }
      } else if (err?.response?.data) {
        errorData = err.response.data
      }

      const status = err?.response?.status
      const serverMsg = errorData?.message || errorData?.errorMessage || ''

      if (status === 403 && unmask) {
        message.error('Bạn không có quyền xuất dữ liệu đầy đủ')
        setUnmask(false)
        setReasonError('')
      } else if (
        status === 400 &&
        unmask &&
        (serverMsg.toLowerCase().includes('reason') || serverMsg.toLowerCase().includes('lý do'))
      ) {
        setReasonError(serverMsg || 'Lý do xuất bản dữ liệu đầy đủ không hợp lệ.')
      } else {
        const errorMsg = await getExportErrorMessage(err)
        message.error(errorMsg)
      }
    } finally {
      isExportingRef.current = false
      setExporting(false)
    }
  }

  if (!canViewReports) {
    return (
      <div style={{ paddingBottom: 32 }}>
        <div style={{ marginBottom: 16 }}>
          <Title level={2} style={{ margin: 0 }}>
            <LineChartOutlined style={{ marginRight: 10, color: '#2563eb' }} />
            Báo cáo Vận hành & Doanh thu
          </Title>
        </div>
        <Card style={{ borderRadius: 12, textAlign: 'center', padding: '40px 20px', marginTop: 16 }}>
          <Empty description="Tài khoản của bạn chưa được phân quyền xem Báo cáo vận hành & doanh thu." />
        </Card>
      </div>
    )
  }

  return (
    <div style={{ paddingBottom: 32 }}>
      {/* Header Block */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 16,
          marginBottom: 16,
        }}
      >
        <div>
          <Title level={2} style={{ margin: 0 }}>
            <LineChartOutlined style={{ marginRight: 10, color: '#2563eb' }} />
            Báo cáo Vận hành & Doanh thu
          </Title>
        </div>

        <Space wrap>
          <Select
            value={selectedReportType}
            onChange={(val) => {
              setSelectedReportType(val)
              if (!isIdentifyingReportType(val)) {
                setUnmask(false)
                setUnmaskReason('')
                setReasonError('')
              }
              const matchedType = REPORT_TYPES.find((t) => t.value === val)
              if (matchedType) {
                setActiveTab(matchedType.tabKey)
                updateUrlParams(matchedType.tabKey, range)
              }
            }}
            options={REPORT_TYPES.map((t) => ({ label: t.label, value: t.value }))}
            style={{ width: 180 }}
          />

          <RangePicker
            value={range}
            onChange={handleRangeChange}
            format="DD/MM/YYYY"
            allowClear={false}
          />

          <Button icon={<ReloadOutlined />} loading={loading} onClick={loadData}>
            Làm mới
          </Button>

          <Button
            icon={<PrinterOutlined />}
            onClick={() => setPrintModalOpen(true)}
          >
            In báo cáo
          </Button>

          {canExportReports && (
            <Tooltip
              title={
                selectedReportType === 'ACCESS_LOG_REPORT' && !canExportAccessLog
                  ? 'Yêu cầu quyền Quản trị viên (ACCESS_LOG_REPORT_EXPORT) để xuất báo cáo này'
                  : ''
              }
            >
              <Button
                type="primary"
                icon={<DownloadOutlined />}
                loading={exporting}
                disabled={selectedReportType === 'ACCESS_LOG_REPORT' && !canExportAccessLog}
                onClick={handleExport}
              >
                Xuất CSV
              </Button>
            </Tooltip>
          )}
        </Space>
      </div>

      {/* Date Presets Toolbar */}
      <Card size="small" style={{ marginBottom: 16, borderRadius: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <Space wrap size={6}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#475569', marginRight: 4 }}>
              <CalendarOutlined style={{ marginRight: 4 }} /> Chọn nhanh thời gian:
            </span>
            <Button size="small" onClick={() => handleQuickPreset('TODAY')}>Hôm nay</Button>
            <Button size="small" onClick={() => handleQuickPreset('7DAYS')}>7 ngày</Button>
            <Button size="small" onClick={() => handleQuickPreset('30DAYS')}>30 ngày</Button>
            <Button size="small" onClick={() => handleQuickPreset('THIS_MONTH')}>Tháng này</Button>
            <Button size="small" onClick={() => handleQuickPreset('THIS_YEAR')}>Năm nay</Button>
          </Space>

          <div style={{ fontSize: 12.5, color: '#64748b' }}>
            Khoảng thời gian đang chọn: <Text strong style={{ color: '#2563eb' }}>{fromStr}</Text> đến <Text strong style={{ color: '#2563eb' }}>{toStr}</Text>
          </div>
        </div>
      </Card>

      {/* Cấu hình che/xuất bản đầy đủ dữ liệu định danh (NCL-15-CN-007 / QTN-43 / QTN-03 / QTN-25) */}
      {hasIdentifyingData && canExportUnmasked && (
        <Card
          size="small"
          style={{
            marginBottom: 16,
            borderRadius: 10,
            border: unmask ? '1px solid #f59e0b' : '1px solid #e2e8f0',
            backgroundColor: unmask ? '#fffbeb' : '#f8fafc',
            transition: 'all 0.2s ease',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <Space align="center">
              <Switch
                id="unmask-export-switch"
                checked={unmask}
                onChange={(checked) => {
                  setUnmask(checked)
                  if (!checked) {
                    setReasonError('')
                  }
                }}
              />
              <Text strong style={{ fontSize: 13.5, color: unmask ? '#b45309' : '#334155' }}>
                Xuất bản đầy đủ (không che thông tin)
              </Text>
              <Tag color={unmask ? 'warning' : 'default'} style={{ marginLeft: 4 }}>
                {unmask ? 'Bản đầy đủ (Nhạy cảm)' : 'Mặc định (Đã che)'}
              </Tag>
            </Space>
          </div>

          {unmask && (
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px dashed #fde68a' }}>
              <Alert
                type="warning"
                showIcon
                message="Cảnh báo an toàn dữ liệu cá nhân"
                description="Dữ liệu xuất ra sẽ chứa đầy đủ họ tên, số điện thoại, địa chỉ bệnh nhân. Hành động này được ghi nhật ký kiểm toán."
                style={{ marginBottom: 12 }}
              />
              <div>
                <label
                  htmlFor="unmask-export-reason"
                  style={{ display: 'block', fontWeight: 600, fontSize: 13, marginBottom: 4, color: '#334155' }}
                >
                  Lý do xuất bản dữ liệu đầy đủ <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <Input.TextArea
                  id="unmask-export-reason"
                  rows={3}
                  value={unmaskReason}
                  maxLength={500}
                  showCount
                  status={reasonError ? 'error' : ''}
                  placeholder="Nhập lý do xuất bản dữ liệu đầy đủ (tối thiểu 5 ký tự, tối đa 500 ký tự)..."
                  onChange={(e) => {
                    setUnmaskReason(e.target.value)
                    if (reasonError) setReasonError('')
                  }}
                />
                {reasonError && (
                  <div id="unmask-reason-error" style={{ color: '#ef4444', fontSize: 12.5, marginTop: 4 }}>
                    {reasonError}
                  </div>
                )}
              </div>
            </div>
          )}
        </Card>
      )}

      {loadError ? (
        <Alert
          type="error"
          showIcon
          message="Không tải được dữ liệu báo cáo"
          description={loadError}
          action={<Button size="small" onClick={loadData}>Thử lại</Button>}
          style={{ marginBottom: 16 }}
        />
      ) : null}

      {/* Interactive KPI Stat Cards (Click switches active tab) */}
      <ReportStatCards
        summary={summary}
        activeTab={activeTab}
        onSelectTab={handleTabChange}
      />

      {/* Main Tabs Navigation */}
      <Card
        style={{
          borderRadius: 14,
          boxShadow: '0 2px 10px rgba(0,0,0,0.02)',
          border: '1px solid #f1f5f9',
          marginBottom: 20,
        }}
        styles={{ body: { padding: 0 } }}
      >
        <Tabs
          activeKey={activeTab}
          onChange={handleTabChange}
          style={{ paddingLeft: 16, paddingRight: 16 }}
          items={[
            {
              key: 'overview',
              label: (
                <span style={{ fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>
                  <DashboardOutlined /> Tổng quan vận hành
                </span>
              ),
            },
            {
              key: 'visits',
              label: (
                <span style={{ fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>
                  <LineChartOutlined /> Báo cáo lượt khám
                </span>
              ),
            },
            {
              key: 'doctor-visits',
              label: (
                <span style={{ fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>
                  <UserOutlined /> Lượt khám theo bác sĩ
                </span>
              ),
            },
            {
              key: 'revenue',
              label: (
                <span style={{ fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>
                  <DollarCircleOutlined /> Báo cáo doanh thu
                </span>
              ),
            },
            {
              key: 'medicines',
              label: (
                <span style={{ fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>
                  <MedicineBoxOutlined /> Báo cáo thuốc dùng nhiều
                </span>
              ),
            },
            {
              key: 'audit',
              label: (
                <span style={{ fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>
                  <FileSearchOutlined /> Nhật ký truy cập bệnh án
                </span>
              ),
            },
            ...(isManager && !isAdmin
              ? [
                  {
                    key: 'disease-patterns',
                    label: (
                      <span style={{ fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>
                        <BarChartOutlined /> Mô hình bệnh tật
                      </span>
                    ),
                  },
                  {
                    key: 'revenue-breakdown',
                    label: (
                      <span style={{ fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>
                        <DollarCircleOutlined /> Doanh thu bóc tách
                      </span>
                    ),
                  },
                  {
                    key: 'appointment-effectiveness',
                    label: (
                      <span style={{ fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>
                        <CalendarOutlined /> Hiệu quả lịch hẹn
                      </span>
                    ),
                  },
                ]
              : []),
            ...((isManager || isAdmin)
              ? [
                  {
                    key: 'inventory-stock',
                    label: (
                      <span style={{ fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>
                        <MedicineBoxOutlined /> Xuất nhập tồn kho dược
                      </span>
                    ),
                  },
                  {
                    key: 'satisfaction',
                    label: (
                      <span style={{ fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>
                        <StarOutlined /> Khảo sát hài lòng sau khám
                      </span>
                    ),
                  },
                ]
              : []),
          ]}
        />
      </Card>

      {/* Tab Views */}
      <div>
        {activeTab === 'overview' && (
          <OverviewReportView summary={summary} />
        )}

        {activeTab === 'visits' && (
          <VisitReportView
            timeline={timeline}
            summary={summary}
            loading={loading}
          />
        )}

        {activeTab === 'doctor-visits' && (
          <DoctorVisitsReportView
            range={range}
            initialRange={range}
          />
        )}

        {activeTab === 'revenue' && (
          <RevenueReportView
            range={range}
            onRangeChange={handleRangeChange}
            invoices={invoicesList}
            loading={loading}
            onRefresh={loadData}
          />
        )}

        {activeTab === 'medicines' && (
          <TopMedicinesReportView
            topMedicines={topMedicines}
            loading={loading}
          />
        )}

        {activeTab === 'audit' && (
          <AuditLogsReportView
            auditLogs={auditLogs}
            loading={loading}
          />
        )}

        {activeTab === 'disease-patterns' && isManager && !isAdmin && (
          <DiseasePatternReportPage />
        )}

        {activeTab === 'revenue-breakdown' && isManager && !isAdmin && (
          <RevenueBreakdownReportPage />
        )}

        {activeTab === 'appointment-effectiveness' && isManager && !isAdmin && (
          <AppointmentEffectivenessReportPage />
        )}

        {activeTab === 'inventory-stock' && (isManager || isAdmin) && (
          <InventoryStockReportPage />
        )}

        {activeTab === 'satisfaction' && (isManager || isAdmin) && (
          <SatisfactionReportPage />
        )}
      </div>

      {/* Print Report Preview Modal */}
      <ReportPrintTemplateModal
        open={printModalOpen}
        onClose={() => setPrintModalOpen(false)}
        activeTab={activeTab}
        range={range}
        summary={summary}
        timeline={timeline}
        topMedicines={topMedicines}
        invoices={invoicesList}
      />
    </div>
  )
}

export default ReportsPage
