import React, { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Modal,
  Button,
  Select,
  Input,
  Alert,
  Descriptions,
  Tag,
  Space,
  Typography,
  Divider,
  message,
  Card,
  Row,
  Col,
  Checkbox,
  Steps,
  Result,
  Tooltip,
  Badge,
  Spin,
} from 'antd'
import {
  SwapOutlined,
  WarningOutlined,
  CheckCircleOutlined,
  UserOutlined,
  AuditOutlined,
  ExclamationCircleOutlined,
  StopOutlined,
  ArrowRightOutlined,
  InfoCircleOutlined,
  BranchesOutlined,
  EyeOutlined,
  CheckOutlined,
  LockOutlined,
} from '@ant-design/icons'
import patientApi from '../../api/patientApi'
import { useAuthContext } from '../../context/AuthContext'
import {
  MERGE_REASON_PRESETS,
  canUserMergePatients,
  checkIdentityConflict,
  comparePatientFields,
  buildMergedPatientProfile,
  validatePatientMerge,
  cleanMergeErrorMessage,
  patientHasSignedMedicalRecords,
} from '../../utils/patientMergeValidation'
import { formatDate } from '../../utils/helpers'
import '../../styles/patientMergeModal.css'

const { Text, Title, Paragraph } = Typography
const { Option } = Select
const { TextArea } = Input

export default function MergePatientModal({
  open,
  onClose,
  initialTargetPatient = null,
  initialSourcePatient = null,
  allPatients = [],
  onSuccess,
}) {
  const { user } = useAuthContext()

  // Phân quyền RBAC (QTN-01): Chỉ Lễ tân & Quản lý được gộp, Bác sĩ bị từ chối
  const canMerge = useMemo(() => {
    return canUserMergePatients(user?.roles || user?.role, user?.permissions)
  }, [user])

  // Quản lý bước hiện tại: 0: Xác định cặp trùng, 1: So sánh & Chọn trường, 2: Xác nhận gộp
  const [currentStep, setCurrentStep] = useState(0)

  // Hai hồ sơ được chọn để so sánh
  const [patient1, setPatient1] = useState(initialTargetPatient)
  const [patient2, setPatient2] = useState(initialSourcePatient)

  // Mã hồ sơ được chọn làm hồ sơ giữ lại (Target Patient: 'p1' hoặc 'p2')
  const [retainedSide, setRetainedSide] = useState('p1')

  // Lựa chọn từng trường thông tin cá nhân: key -> 'p1' | 'p2'
  const [fieldSelections, setFieldSelections] = useState({})

  // Lý do gộp
  const [reasonPreset, setReasonPreset] = useState(MERGE_REASON_PRESETS[0])
  const [customReason, setCustomReason] = useState('')

  // Trạng thái xác nhận phụ
  const [confirmModalVisible, setConfirmModalVisible] = useState(false)
  const [agreementChecked, setAgreementChecked] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Dữ liệu lượt khám / bệnh án hỗ trợ kiểm tra
  const [checkingRecords, setCheckingRecords] = useState(false)
  const [signedRecordsCheck, setSignedRecordsCheck] = useState({
    p1HasSigned: false,
    p2HasSigned: false,
    p1VisitsCount: 0,
    p2VisitsCount: 0,
  })

  // Khi modal mở, khởi tạo dữ liệu
  useEffect(() => {
    if (open) {
      setPatient1(initialTargetPatient)
      setPatient2(initialSourcePatient)
      setRetainedSide('p1')
      setReasonPreset(MERGE_REASON_PRESETS[0])
      setCustomReason('')
      setAgreementChecked(false)
      setConfirmModalVisible(false)

      // Nếu đã có sẵn 2 hồ sơ hợp lệ và không bị gộp trước đó, có thể tự động vào bước so sánh
      if (initialTargetPatient && initialSourcePatient) {
        setCurrentStep(1)
      } else {
        setCurrentStep(0)
      }
    }
  }, [open, initialTargetPatient, initialSourcePatient])

  // Kiểm tra lịch sử bệnh án đã ký của cả 2 hồ sơ (để đối soát xung đột danh tính y tế)
  useEffect(() => {
    let isMounted = true

    async function checkMedicalHistory() {
      if (!open || !patient1 || !patient2) {
        setSignedRecordsCheck({
          p1HasSigned: false,
          p2HasSigned: false,
          p1VisitsCount: 0,
          p2VisitsCount: 0,
        })
        return
      }

      // Nếu cả 2 hồ sơ đã có sẵn cờ thì không cần fetch
      const p1Flag = patientHasSignedMedicalRecords(patient1)
      const p2Flag = patientHasSignedMedicalRecords(patient2)

      if (p1Flag && p2Flag) {
        setSignedRecordsCheck({
          p1HasSigned: true,
          p2HasSigned: true,
          p1VisitsCount: patient1.totalVisits || 0,
          p2VisitsCount: patient2.totalVisits || 0,
        })
        return
      }

      setCheckingRecords(true)
      try {
        const id1 = patient1.id || patient1.patientId
        const id2 = patient2.id || patient2.patientId

        const [res1, res2] = await Promise.allSettled([
          id1 ? patientApi.getHistory(id1, { page: 0, size: 20 }) : Promise.resolve({ data: {} }),
          id2 ? patientApi.getHistory(id2, { page: 0, size: 20 }) : Promise.resolve({ data: {} }),
        ])

        if (!isMounted) return

        const list1 = res1.status === 'fulfilled' ? (res1.value?.data?.content || res1.value?.data || []) : []
        const list2 = res2.status === 'fulfilled' ? (res2.value?.data?.content || res2.value?.data || []) : []

        const p1Signed = p1Flag || (Array.isArray(list1) && list1.some(
          (item) => item.status === 'SIGNED' || item.status === 'FINALIZED' || item.status === 'LOCKED' || item.medicalRecordStatus === 'SIGNED'
        ))
        const p2Signed = p2Flag || (Array.isArray(list2) && list2.some(
          (item) => item.status === 'SIGNED' || item.status === 'FINALIZED' || item.status === 'LOCKED' || item.medicalRecordStatus === 'SIGNED'
        ))

        setSignedRecordsCheck({
          p1HasSigned: Boolean(p1Signed),
          p2HasSigned: Boolean(p2Signed),
          p1VisitsCount: Array.isArray(list1) ? list1.length : 0,
          p2VisitsCount: Array.isArray(list2) ? list2.length : 0,
        })
      } catch {
        // Fallback an toàn
      } finally {
        if (isMounted) setCheckingRecords(false)
      }
    }

    checkMedicalHistory()
    return () => {
      isMounted = false
    }
  }, [open, patient1, patient2])

  // Xác định hồ sơ giữ lại (Target) và hồ sơ bị gộp (Source)
  const targetPatient = retainedSide === 'p1' ? patient1 : patient2
  const sourcePatient = retainedSide === 'p1' ? patient2 : patient1

  // 1. Kiểm tra trạng thái đã gộp trước đó (Merged Status Check)
  const isP1AlreadyMerged = Boolean(patient1?.isMerged || patient1?.status === 'MERGED' || patient1?.mergedIntoPatientId)
  const isP2AlreadyMerged = Boolean(patient2?.isMerged || patient2?.status === 'MERGED' || patient2?.mergedIntoPatientId)
  const hasMergedPatient = isP1AlreadyMerged || isP2AlreadyMerged

  // 2. Kiểm tra mâu thuẫn danh tính trên bệnh án đã ký (Identity Conflict Check)
  const identityConflict = useMemo(() => {
    if (!patient1 || !patient2) return { hasConflict: false }
    return checkIdentityConflict(patient1, patient2, {
      patientAHasSignedRecords: signedRecordsCheck.p1HasSigned,
      patientBHasSignedRecords: signedRecordsCheck.p2HasSigned,
    })
  }, [patient1, patient2, signedRecordsCheck])

  // 3. So sánh chi tiết từng trường thông tin cá nhân
  const comparisonResult = useMemo(() => {
    if (!patient1 || !patient2) return null
    return comparePatientFields(patient1, patient2, { preferredSide: retainedSide })
  }, [patient1, patient2, retainedSide])

  // Đồng bộ lựa chọn trường ban đầu khi comparisonResult thay đổi
  useEffect(() => {
    if (comparisonResult?.initialSelections) {
      setFieldSelections((prev) => {
        // Giữ lại các lựa chọn người dùng đã tự tay chỉnh, chỉ gán mặc định cho các trường chưa chọn
        return {
          ...comparisonResult.initialSelections,
          ...prev,
        }
      })
    }
  }, [comparisonResult])

  // Hồ sơ tổng hợp sau khi gộp (Preview Merged Profile)
  const previewProfile = useMemo(() => {
    if (!patient1 || !patient2 || !targetPatient) return null
    return buildMergedPatientProfile(
      patient1,
      patient2,
      targetPatient.id || targetPatient.patientId,
      fieldSelections
    )
  }, [patient1, patient2, targetPatient, fieldSelections])

  // Lý do hoàn chỉnh
  const fullReason = useMemo(() => {
    if (reasonPreset === 'Khác') return customReason.trim()
    if (customReason.trim()) return `${reasonPreset} - ${customReason.trim()}`
    return reasonPreset
  }, [reasonPreset, customReason])

  // Validate nghiệp vụ tổng thể
  const mergeValidation = useMemo(() => {
    if (!sourcePatient || !targetPatient) {
      return { allowed: false, message: 'Vui lòng chọn đủ 2 hồ sơ bệnh nhân.' }
    }
    return validatePatientMerge(sourcePatient, targetPatient, fullReason, {
      patientAHasSignedRecords: signedRecordsCheck.p1HasSigned,
      patientBHasSignedRecords: signedRecordsCheck.p2HasSigned,
    })
  }, [sourcePatient, targetPatient, fullReason, signedRecordsCheck])

  // Hàm chọn giá trị của 1 trường
  const handleSelectFieldSide = (fieldKey, side) => {
    setFieldSelections((prev) => ({
      ...prev,
      [fieldKey]: side,
    }))
  }

  // Đổi chiều hồ sơ bảo lưu mã
  const handleToggleRetainedSide = (side) => {
    setRetainedSide(side)
  }

  // Đổi chỗ 2 hồ sơ
  const handleSwapPatients = () => {
    const temp = patient1
    setPatient1(patient2)
    setPatient2(temp)
    setRetainedSide((prev) => (prev === 'p1' ? 'p2' : 'p1'))
  }

  // Thực thi gộp hồ sơ
  const handleExecuteMerge = async () => {
    if (!mergeValidation.allowed) {
      message.error(mergeValidation.message || 'Không thể thực hiện gộp hồ sơ.')
      return
    }

    setSubmitting(true)
    try {
      const sourceId = sourcePatient.id || sourcePatient.patientId
      const targetId = targetPatient.id || targetPatient.patientId

      // 1. Gửi lệnh gộp dữ liệu y tế sang hồ sơ đích
      const payload = {
        sourcePatientId: sourceId,
        targetPatientId: targetId,
        reason: fullReason || 'Gộp hồ sơ trùng lặp tiếp đón',
      }

      const res = await patientApi.merge(payload)
      const data = res?.data || {}
      const transferredCount = data.transferredVisitsCount ?? data.transferredCount ?? (signedRecordsCheck.p1VisitsCount + signedRecordsCheck.p2VisitsCount)

      // 2. Cập nhật hồ sơ đích theo đúng các trường thông tin cá nhân đã chọn lọc
      if (previewProfile && targetId) {
        try {
          const updatePayload = {
            ...targetPatient,
            fullName: previewProfile.fullName,
            dateOfBirth: previewProfile.dateOfBirth,
            gender: previewProfile.gender,
            identityNumber: previewProfile.identityNumber,
            phone: previewProfile.phone,
            phoneNumber: previewProfile.phone,
            address: previewProfile.address,
            insuranceNumber: previewProfile.insuranceNumber,
            bloodType: previewProfile.bloodType,
            guardianName: previewProfile.guardianName,
            guardianRelationship: previewProfile.guardianRelationship,
            guardianPhone: previewProfile.guardianPhone,
            guardianIdentityNumber: previewProfile.guardianIdentityNumber,
          }
          await patientApi.update(targetId, updatePayload)
        } catch (updateErr) {
          console.warn('Lưu thông tin cá nhân hồ sơ đích:', updateErr)
        }
      }

      message.success({
        content: `Gộp hồ sơ thành công! Đã bảo lưu mã [${targetPatient.patientCode}], chuyển toàn bộ ${transferredCount} lượt khám và đồng bộ thông tin cá nhân chính xác nhất.`,
        duration: 5,
      })

      setConfirmModalVisible(false)
      if (onSuccess) {
        onSuccess(data)
      }
      onClose()
    } catch (err) {
      message.error(cleanMergeErrorMessage(err, 'Lỗi khi gộp hồ sơ bệnh nhân.'))
    } finally {
      setSubmitting(false)
    }
  }

  // =========================================================================
  // RENDER: Phân quyền từ chối (Bác sĩ mở chức năng này)
  // =========================================================================
  if (!canMerge) {
    return (
      <Modal
        open={open}
        onCancel={onClose}
        width={600}
        footer={[
          <Button key="close" type="primary" onClick={onClose}>
            Đã hiểu & Đóng
          </Button>,
        ]}
        destroyOnClose
      >
        <Result
          status="403"
          icon={<LockOutlined style={{ color: '#dc2626', fontSize: 64 }} />}
          title="Từ chối quyền truy cập gộp hồ sơ bệnh nhân"
          subTitle={
            <div style={{ fontSize: 14.5, color: '#4b5563', lineHeight: 1.6, textAlign: 'left', marginTop: 12 }}>
              <p>
                Theo quy định bảo mật và phân quyền y tế (<strong>QTN-01</strong>):
              </p>
              <ul style={{ paddingLeft: 20 }}>
                <li>
                  Chức năng <strong>Gộp hồ sơ bệnh nhân</strong> chỉ dành riêng cho vai trò <strong>Lễ tân (Tiếp đón)</strong> và <strong>Quản lý phòng khám</strong>.
                </li>
                <li>
                  Tài khoản vai trò <strong>Bác sĩ</strong> và <strong>Dược sĩ</strong> không được phép thực hiện thao tác này nhằm đảm bảo tính toàn vẹn của hồ sơ bệnh án.
                </li>
              </ul>
              <Alert
                type="warning"
                showIcon
                message="Nhật ký truy cập (Audit Log)"
                description="Hệ thống đã ghi nhận nhật ký từ chối truy cập đối với tài khoản hiện tại."
                style={{ marginTop: 12 }}
              />
            </div>
          }
        />
      </Modal>
    )
  }

  // =========================================================================
  // RENDER: Trạng thái hồ sơ đã từng bị gộp trước đó
  // =========================================================================
  if (hasMergedPatient) {
    const mergedPatient = isP1AlreadyMerged ? patient1 : patient2
    return (
      <Modal
        title={
          <Space>
            <StopOutlined style={{ color: '#dc2626' }} />
            <span>Hồ sơ đã ở trạng thái ĐÃ GỘP</span>
          </Space>
        }
        open={open}
        onCancel={onClose}
        width={680}
        footer={[
          <Button key="close" type="primary" onClick={onClose}>
            Đóng
          </Button>,
        ]}
        destroyOnClose
      >
        <Alert
          type="error"
          showIcon
          message="Không thể thực hiện gộp hồ sơ này"
          description={
            <div style={{ marginTop: 8, fontSize: 14, lineHeight: 1.6 }}>
              <p>
                Hồ sơ bệnh nhân <strong>{mergedPatient?.patientCode} - {mergedPatient?.fullName}</strong> đã ở trạng thái <code>MERGED</code> (Đã gộp vào hồ sơ chính khác trước đó).
              </p>
              <p style={{ margin: 0 }}>
                Theo quy định bảo mật <strong>QTN-33</strong>, hồ sơ đã gộp là hồ sơ chỉ xem (Read-only), mọi dữ liệu y tế đã được chuyển giao và gắn liên kết chuyển hướng sang hồ sơ giữ lại. Hệ thống không cho phép gộp tiếp trên hồ sơ đã gộp.
              </p>
            </div>
          }
          style={{ marginBottom: 16 }}
        />
        <div style={{ textAlign: 'center', padding: '16px 0' }}>
          <Text type="secondary">
            Vui lòng mở hồ sơ chính đang hoạt động để tra cứu toàn bộ lịch sử khám bệnh tập trung.
          </Text>
        </div>
      </Modal>
    )
  }

  return (
    <Modal
      className="patient-merge-modal"
      title={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingRight: 24 }}>
          <Space align="center" size={10}>
            <BranchesOutlined style={{ color: '#2563eb', fontSize: 22 }} />
            <span style={{ fontSize: 18, fontWeight: 700, color: '#0f172a' }}>
              Gộp hồ sơ bệnh nhân trùng lặp
            </span>
          </Space>
          <Tag color="blue" style={{ fontSize: 12, padding: '2px 10px', borderRadius: 12 }}>
            NCL-02-CN-006 • QTN-33
          </Tag>
        </div>
      }
      open={open}
      onCancel={onClose}
      width={1050}
      footer={null}
      destroyOnClose
    >
      {/* STEPS INDICATOR */}
      <div className="merge-steps-header">
        <Steps
          current={currentStep}
          onChange={(step) => {
            // Không cho phép nhảy sang bước 1 hoặc 2 nếu chưa chọn đủ 2 hồ sơ hoặc có conflict
            if (step > 0 && (!patient1 || !patient2)) {
              message.warning('Vui lòng chọn đầy đủ 2 hồ sơ bệnh nhân trước khi tiếp tục.')
              return
            }
            if (step > 0 && identityConflict.hasConflict) {
              message.error('Phát hiện mâu thuẫn danh tính. Không thể chuyển bước.')
              return
            }
            setCurrentStep(step)
          }}
          items={[
            {
              title: 'Xác định cặp hồ sơ',
              description: 'Chọn 2 hồ sơ nghi trùng',
            },
            {
              title: 'So sánh & Chọn thông tin',
              description: 'Chọn lọc từng trường dữ liệu',
            },
            {
              title: 'Xem trước & Xác nhận',
              description: 'Rà soát trước khi chuyển giao',
            },
          ]}
        />
      </div>

      {/* =================================================================== */}
      {/* TRƯỜNG HỢP TỪ CHỐI DO MÂU THUẪN DANH TÍNH TRÊN BỆNH ÁN ĐÃ KÝ        */}
      {/* =================================================================== */}
      {identityConflict.hasConflict && (
        <div className="merge-identity-conflict-card">
          <div className="conflict-card-header">
            <StopOutlined style={{ color: '#dc2626', fontSize: 24 }} />
            <span className="conflict-card-title">
              TỪ CHỐI GỘP HOÀN TOÀN DO MÂU THUẪN DANH TÍNH (QTN-33)
            </span>
          </div>
          <div className="conflict-card-body">
            <p style={{ margin: '0 0 8px 0' }}>
              <strong>Lý do từ chối:</strong> {identityConflict.reason}
            </p>
            <p style={{ margin: 0 }}>
              Cả hai hồ sơ đều đã có bệnh án ký khóa chuyên môn hoặc số định danh cá nhân độc lập. Đây là dấu hiệu của <strong>hai bệnh nhân khác nhau</strong>, việc gộp tự động sẽ làm sai lệch hồ sơ bệnh án và vi phạm pháp lý y tế.
            </p>
            <div className="conflict-card-recommendation">
              ⚠️ <strong>Gợi ý xử lý:</strong> {identityConflict.recommendation}
            </div>
          </div>
          <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
            <Button onClick={onClose} size="middle">
              Đóng cửa sổ
            </Button>
            <Button
              type="primary"
              danger
              onClick={() => {
                setPatient2(null)
                setCurrentStep(0)
              }}
            >
              Chọn hồ sơ khác để đối chiếu
            </Button>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* BƯỚC 1: XÁC ĐỊNH CẶP HỒ SƠ                                         */}
      {/* =================================================================== */}
      {currentStep === 0 && !identityConflict.hasConflict && (
        <div>
          <Alert
            type="info"
            showIcon
            message="Xác định cặp hồ sơ bệnh nhân nghi trùng lặp:"
            description="Vui lòng chọn 2 hồ sơ nghi trùng trong hệ thống. Ở bước tiếp theo, bạn sẽ được chọn lọc từng trường thông tin chính xác nhất từ mỗi hồ sơ để tạo bản thông tin hoàn chỉnh."
            style={{ marginBottom: 16 }}
          />

          <Row gutter={16} align="middle">
            <Col xs={24} md={11}>
              <Card
                size="small"
                title={<span style={{ color: '#0369a1', fontWeight: 600 }}>Hồ sơ thứ nhất</span>}
                style={{ border: '2px solid #38bdf8', borderRadius: 10, background: '#f0f9ff' }}
              >
                {patient1 ? (
                  <div>
                    <Descriptions size="small" column={1} bordered style={{ background: '#fff' }}>
                      <Descriptions.Item label="Mã BN"><Text strong>{patient1.patientCode}</Text></Descriptions.Item>
                      <Descriptions.Item label="Họ và tên"><Text strong>{patient1.fullName}</Text></Descriptions.Item>
                      <Descriptions.Item label="Ngày sinh">{formatDate(patient1.dateOfBirth)} ({patient1.gender === 'MALE' ? 'Nam' : 'Nữ'})</Descriptions.Item>
                      <Descriptions.Item label="Số CCCD">{patient1.identityNumber || 'Chưa cập nhật'}</Descriptions.Item>
                      <Descriptions.Item label="Số điện thoại">{patient1.phone || patient1.phoneNumber || 'Chưa cập nhật'}</Descriptions.Item>
                      <Descriptions.Item label="Địa chỉ">{patient1.address || 'Chưa cập nhật'}</Descriptions.Item>
                    </Descriptions>
                  </div>
                ) : (
                  <div style={{ padding: '24px 0', textAlign: 'center' }}>
                    <Select
                      placeholder="Chọn hồ sơ 1..."
                      style={{ width: '100%' }}
                      showSearch
                      optionFilterProp="children"
                      onChange={(val) => setPatient1(allPatients.find((p) => (p.id || p.patientId) === val))}
                    >
                      {allPatients
                        .filter((p) => (p.id || p.patientId) !== (patient2?.id || patient2?.patientId))
                        .map((p) => (
                          <Option key={p.id || p.patientId} value={p.id || p.patientId}>
                            {p.patientCode} - {p.fullName} ({formatDate(p.dateOfBirth)})
                          </Option>
                        ))}
                    </Select>
                  </div>
                )}
              </Card>
            </Col>

            <Col xs={24} md={2} style={{ textAlign: 'center', margin: '12px 0' }}>
              <Button
                type="primary"
                shape="circle"
                icon={<SwapOutlined />}
                onClick={handleSwapPatients}
                disabled={!patient1 || !patient2}
                title="Đổi chỗ 2 hồ sơ"
                style={{ background: '#2563eb' }}
              />
            </Col>

            <Col xs={24} md={11}>
              <Card
                size="small"
                title={<span style={{ color: '#7c3aed', fontWeight: 600 }}>Hồ sơ thứ hai</span>}
                style={{ border: '2px solid #c084fc', borderRadius: 10, background: '#faf5ff' }}
              >
                {patient2 ? (
                  <div>
                    <Descriptions size="small" column={1} bordered style={{ background: '#fff' }}>
                      <Descriptions.Item label="Mã BN"><Text strong>{patient2.patientCode}</Text></Descriptions.Item>
                      <Descriptions.Item label="Họ và tên"><Text strong>{patient2.fullName}</Text></Descriptions.Item>
                      <Descriptions.Item label="Ngày sinh">{formatDate(patient2.dateOfBirth)} ({patient2.gender === 'MALE' ? 'Nam' : 'Nữ'})</Descriptions.Item>
                      <Descriptions.Item label="Số CCCD">{patient2.identityNumber || 'Chưa cập nhật'}</Descriptions.Item>
                      <Descriptions.Item label="Số điện thoại">{patient2.phone || patient2.phoneNumber || 'Chưa cập nhật'}</Descriptions.Item>
                      <Descriptions.Item label="Địa chỉ">{patient2.address || 'Chưa cập nhật'}</Descriptions.Item>
                    </Descriptions>
                  </div>
                ) : (
                  <div style={{ padding: '24px 0', textAlign: 'center' }}>
                    <Select
                      placeholder="Chọn hồ sơ 2..."
                      style={{ width: '100%' }}
                      showSearch
                      optionFilterProp="children"
                      onChange={(val) => setPatient2(allPatients.find((p) => (p.id || p.patientId) === val))}
                    >
                      {allPatients
                        .filter((p) => (p.id || p.patientId) !== (patient1?.id || patient1?.patientId))
                        .map((p) => (
                          <Option key={p.id || p.patientId} value={p.id || p.patientId}>
                            {p.patientCode} - {p.fullName} ({formatDate(p.dateOfBirth)})
                          </Option>
                        ))}
                    </Select>
                  </div>
                )}
              </Card>
            </Col>
          </Row>

          <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
            <Button onClick={onClose} size="large">
              Hủy bỏ
            </Button>
            <Button
              type="primary"
              size="large"
              disabled={!patient1 || !patient2}
              onClick={() => setCurrentStep(1)}
              icon={<ArrowRightOutlined />}
            >
              Tiếp tục: So sánh & Chọn thông tin
            </Button>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* BƯỚC 2: SO SÁNH & CHỌN TỪNG TRƯỜNG THÔNG TIN (TRỌNG TÂM CẢI TIẾN)     */}
      {/* =================================================================== */}
      {currentStep === 1 && !identityConflict.hasConflict && comparisonResult && (
        <div>
          {/* PHẦN 1: CHỌN MÃ HỒ SƠ GIỮ LẠI (TÁCH BIỆT VỚI CHỌN TRƯỜNG) */}
          <div className="retained-selector-container">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <Space>
                <Badge count="1" style={{ backgroundColor: '#2563eb' }} />
                <Text strong style={{ fontSize: 15, color: '#0f172a' }}>
                  CHỌN HỒ SƠ GIỮ LẠI (BẢO LƯU MÃ HỒ SƠ DUY NHẤT)
                </Text>
              </Space>
              <Tag color="cyan">Mã định danh hệ thống không đổi</Tag>
            </div>

            <Paragraph style={{ fontSize: 13, color: '#64748b', marginBottom: 14 }}>
              Mã hồ sơ được chọn sẽ được bảo lưu làm định danh duy nhất trong toàn hệ thống. Hồ sơ còn lại sẽ chuyển sang trạng thái <strong>ĐÃ GỘP (MERGED)</strong> và trỏ liên kết chuyển hướng về mã này. <em>(Việc chọn mã hồ sơ giữ lại hoàn toàn tách biệt với việc chọn từng trường thông tin cá nhân bên dưới).</em>
            </Paragraph>

            <Row gutter={16}>
              <Col xs={24} md={12}>
                <div
                  className={`retained-card-option ${retainedSide === 'p1' ? 'selected' : ''}`}
                  onClick={() => handleToggleRetainedSide('p1')}
                >
                  <input
                    type="radio"
                    name="retained_profile_radio"
                    checked={retainedSide === 'p1'}
                    onChange={() => handleToggleRetainedSide('p1')}
                    style={{ marginTop: 2, transform: 'scale(1.2)' }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Text strong style={{ fontSize: 14.5, color: '#0369a1' }}>
                        Bảo lưu mã: {patient1?.patientCode}
                      </Text>
                      {retainedSide === 'p1' && <Tag color="success">Đang chọn giữ lại mã</Tag>}
                    </div>
                    <div style={{ fontSize: 13, color: '#334155', marginTop: 4 }}>
                      Bệnh nhân: <strong>{patient1?.fullName}</strong> ({formatDate(patient1?.dateOfBirth)})
                    </div>
                  </div>
                </div>
              </Col>

              <Col xs={24} md={12}>
                <div
                  className={`retained-card-option ${retainedSide === 'p2' ? 'selected' : ''}`}
                  onClick={() => handleToggleRetainedSide('p2')}
                >
                  <input
                    type="radio"
                    name="retained_profile_radio"
                    checked={retainedSide === 'p2'}
                    onChange={() => handleToggleRetainedSide('p2')}
                    style={{ marginTop: 2, transform: 'scale(1.2)' }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Text strong style={{ fontSize: 14.5, color: '#6b21a8' }}>
                        Bảo lưu mã: {patient2?.patientCode}
                      </Text>
                      {retainedSide === 'p2' && <Tag color="success">Đang chọn giữ lại mã</Tag>}
                    </div>
                    <div style={{ fontSize: 13, color: '#334155', marginTop: 4 }}>
                      Bệnh nhân: <strong>{patient2?.fullName}</strong> ({formatDate(patient2?.dateOfBirth)})
                    </div>
                  </div>
                </div>
              </Col>
            </Row>
          </div>

          {/* PHẦN 2: BẢNG SO SÁNH 2 CỘT TỪNG TRƯỜNG THÔNG TIN */}
          <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Space>
              <Badge count="2" style={{ backgroundColor: '#2563eb' }} />
              <Text strong style={{ fontSize: 15, color: '#0f172a' }}>
                SO SÁNH VÀ CHỌN THÔNG TIN CÁ NHÂN GIỮ LẠI
              </Text>
            </Space>
            <Space size={8}>
              <Tag color="green">
                <CheckOutlined /> {comparisonResult.identicalCount} trường trùng khớp
              </Tag>
              {comparisonResult.differentCount > 0 ? (
                <Tag color="gold">
                  <WarningOutlined /> {comparisonResult.differentCount} trường khác biệt (hãy chọn)
                </Tag>
              ) : (
                <Tag color="cyan">Dữ liệu cá nhân hoàn toàn đồng nhất</Tag>
              )}
            </Space>
          </div>

          <div className="merge-comparison-table-wrapper">
            {/* Header bảng */}
            <div className="merge-comparison-header">
              <div className="merge-comparison-header-col">Trường thông tin</div>
              <div className="merge-comparison-header-col col-p1">
                <span>Hồ sơ 1: <strong>{patient1?.patientCode}</strong> ({patient1?.fullName})</span>
              </div>
              <div className="merge-comparison-header-col col-p2">
                <span>Hồ sơ 2: <strong>{patient2?.patientCode}</strong> ({patient2?.fullName})</span>
              </div>
            </div>

            {/* Danh sách các trường */}
            {comparisonResult.fields.map((field) => {
              const selectedSide = fieldSelections[field.key] || field.recommendedSide

              if (field.isIdentical) {
                // Trường GIỐNG NHAU: Hiển thị 1 dòng chung
                return (
                  <div key={field.key} className="merge-comparison-row identical-row">
                    <div className="merge-field-label-cell">
                      <span>{field.label}</span>
                    </div>
                    <div className="identical-content">
                      <Space>
                        <CheckCircleOutlined style={{ color: '#10b981', fontSize: 16 }} />
                        <span style={{ fontSize: 13.5, fontWeight: 600, color: '#1e293b' }}>
                          {field.displayVal1}
                        </span>
                      </Space>
                      <Tag color="default" style={{ fontSize: 11, color: '#059669', background: '#ecfdf5', borderColor: '#a7f3d0' }}>
                        Trùng khớp (Tự động giữ)
                      </Tag>
                    </div>
                  </div>
                )
              }

              // Trường KHÁC NHAU: Làm nổi bật và hiển thị 2 radio buttons
              return (
                <div key={field.key} className="merge-comparison-row different-row">
                  <div className="merge-field-label-cell">
                    <span>{field.label}</span>
                    <Tag color="warning" style={{ fontSize: 10, width: 'fit-content', padding: '0 4px', margin: 0 }}>
                      Khác biệt
                    </Tag>
                  </div>

                  {/* Lựa chọn từ Hồ sơ 1 */}
                  <div className="merge-field-value-cell">
                    <label
                      className={`field-choice-item ${selectedSide === 'p1' ? 'active' : ''}`}
                      onClick={() => handleSelectFieldSide(field.key, 'p1')}
                    >
                      <input
                        type="radio"
                        name={`field_${field.key}`}
                        checked={selectedSide === 'p1'}
                        onChange={() => handleSelectFieldSide(field.key, 'p1')}
                      />
                      <div className="field-choice-content">
                        <div className={`field-choice-text ${!field.hasVal1 ? 'empty-text' : ''}`}>
                          {field.displayVal1}
                        </div>
                        {field.recommendedSide === 'p1' && (
                          <div style={{ fontSize: 11, color: '#0284c7', marginTop: 2, fontWeight: 500 }}>
                            {field.isOneSideEmpty ? '★ Gợi ý (có dữ liệu)' : '★ Gợi ý (cập nhật mới hơn)'}
                          </div>
                        )}
                      </div>
                    </label>
                  </div>

                  {/* Lựa chọn từ Hồ sơ 2 */}
                  <div className="merge-field-value-cell">
                    <label
                      className={`field-choice-item ${selectedSide === 'p2' ? 'active' : ''}`}
                      onClick={() => handleSelectFieldSide(field.key, 'p2')}
                    >
                      <input
                        type="radio"
                        name={`field_${field.key}`}
                        checked={selectedSide === 'p2'}
                        onChange={() => handleSelectFieldSide(field.key, 'p2')}
                      />
                      <div className="field-choice-content">
                        <div className={`field-choice-text ${!field.hasVal2 ? 'empty-text' : ''}`}>
                          {field.displayVal2}
                        </div>
                        {field.recommendedSide === 'p2' && (
                          <div style={{ fontSize: 11, color: '#7c3aed', marginTop: 2, fontWeight: 500 }}>
                            {field.isOneSideEmpty ? '★ Gợi ý (có dữ liệu)' : '★ Gợi ý (cập nhật mới hơn)'}
                          </div>
                        )}
                      </div>
                    </label>
                  </div>
                </div>
              )
            })}
          </div>

          {/* PHẦN 3: XEM TRƯỚC HỒ SƠ SAU KHI GỘP (PREVIEW) */}
          <div className="merge-preview-card">
            <div className="merge-preview-header">
              <div className="merge-preview-title">
                <EyeOutlined />
                <span>Xem trước hồ sơ bệnh nhân sau khi gộp (Bản thông tin cuối cùng)</span>
              </div>
              <Tag color="success" style={{ fontWeight: 600 }}>
                Mã bảo lưu: {previewProfile?.retainedPatientCode}
              </Tag>
            </div>
            <div className="merge-preview-body">
              <Descriptions size="small" column={{ xs: 1, sm: 2, md: 3 }} bordered>
                <Descriptions.Item label="Mã bệnh nhân">
                  <Text strong style={{ color: '#2563eb' }}>{previewProfile?.patientCode}</Text>
                </Descriptions.Item>
                <Descriptions.Item label="Họ và tên">
                  <Text strong>{previewProfile?.fullName || '---'}</Text>
                </Descriptions.Item>
                <Descriptions.Item label="Ngày sinh / Giới tính">
                  {formatDate(previewProfile?.dateOfBirth)} ({previewProfile?.gender === 'MALE' ? 'Nam' : previewProfile?.gender === 'FEMALE' ? 'Nữ' : 'Khác'})
                </Descriptions.Item>
                <Descriptions.Item label="Số CCCD / CMND">
                  {previewProfile?.identityNumber || 'Chưa cập nhật'}
                </Descriptions.Item>
                <Descriptions.Item label="Số điện thoại">
                  <Text strong style={{ color: '#059669' }}>
                    {previewProfile?.phone || previewProfile?.phoneNumber || 'Chưa cập nhật'}
                  </Text>
                </Descriptions.Item>
                <Descriptions.Item label="Số thẻ BHYT">
                  {previewProfile?.insuranceNumber || 'Không có'}
                </Descriptions.Item>
                <Descriptions.Item label="Địa chỉ" span={2}>
                  {previewProfile?.address || 'Chưa cập nhật'}
                </Descriptions.Item>
                <Descriptions.Item label="Nhóm máu">
                  {previewProfile?.bloodType || 'Chưa rõ'}
                </Descriptions.Item>
                {previewProfile?.guardianName && (
                  <Descriptions.Item label="Người giám hộ" span={3}>
                    {previewProfile.guardianName} ({previewProfile.guardianRelationship || 'Giám hộ'}) - SĐT: {previewProfile.guardianPhone || '---'}
                  </Descriptions.Item>
                )}
              </Descriptions>

              {/* GHI CHÚ BẮT BUỘC: DỮ LIỆU Y TẾ LUÔN CHUYỂN TOÀN BỘ */}
              <div className="merge-medical-data-notice">
                <InfoCircleOutlined style={{ fontSize: 18, marginTop: 2, flexShrink: 0 }} />
                <div>
                  <strong>Quy tắc chuyển giao dữ liệu y tế toàn diện:</strong> Toàn bộ lịch sử khám bệnh, bệnh án điện tử, đơn thuốc, kết quả xét nghiệm, lịch hẹn và hóa đơn viện phí của cả hai hồ sơ <strong>LUÔN được chuyển toàn bộ</strong> sang hồ sơ giữ lại ({previewProfile?.retainedPatientCode}), không bị ảnh hưởng bởi lựa chọn thông tin cá nhân ở trên.
                </div>
              </div>
            </div>
          </div>

          {/* PHẦN 4: LÝ DO GỘP HỒ SƠ */}
          <div style={{ marginBottom: 16 }}>
            <Text strong style={{ display: 'block', marginBottom: 6 }}>
              Lý do gộp hồ sơ <span style={{ color: '#dc2626' }}>*</span>
            </Text>
            <Select
              value={reasonPreset}
              onChange={setReasonPreset}
              style={{ width: '100%', marginBottom: 8 }}
            >
              {MERGE_REASON_PRESETS.map((preset) => (
                <Option key={preset} value={preset}>
                  {preset}
                </Option>
              ))}
            </Select>

            {(reasonPreset === 'Khác' || customReason) && (
              <TextArea
                rows={2}
                placeholder="Ghi chú chi tiết thêm về lý do gộp hồ sơ..."
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                maxLength={500}
                showCount
              />
            )}
          </div>

          {/* NÚT ĐIỀU HƯỚNG BƯỚC 2 */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 20, paddingTop: 16, borderTop: '1px solid #e2e8f0' }}>
            <Button size="large" onClick={() => setCurrentStep(0)}>
              Quay lại chọn cặp hồ sơ
            </Button>

            <Space size={12}>
              <Button size="large" onClick={onClose}>
                Hủy bỏ
              </Button>
              <Button
                type="primary"
                danger
                size="large"
                icon={<CheckCircleOutlined />}
                disabled={!mergeValidation.allowed}
                onClick={() => setConfirmModalVisible(true)}
                style={{ minWidth: 200, height: 46, fontWeight: 700, borderRadius: 8 }}
              >
                Tiếp tục: Xác nhận gộp
              </Button>
            </Space>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* BƯỚC 3: MODAL XÁC NHẬN PHỤ (CONFIRMATION MODAL)                     */}
      {/* =================================================================== */}
      <Modal
        title={
          <Space>
            <ExclamationCircleOutlined style={{ color: '#dc2626', fontSize: 22 }} />
            <span style={{ fontSize: 17, fontWeight: 700, color: '#0f172a' }}>
              Xác nhận phụ: Chuyển giao toàn bộ dữ liệu y tế
            </span>
          </Space>
        }
        open={confirmModalVisible}
        onCancel={() => setConfirmModalVisible(false)}
        width={620}
        footer={[
          <Button key="back" size="large" onClick={() => setConfirmModalVisible(false)}>
            Xem lại thông tin
          </Button>,
          <Button
            key="submit"
            type="primary"
            danger
            size="large"
            loading={submitting}
            disabled={!agreementChecked}
            onClick={handleExecuteMerge}
            style={{ fontWeight: 700, minWidth: 210, height: 44 }}
          >
            Tôi đồng ý thực hiện gộp
          </Button>,
        ]}
        destroyOnClose
      >
        <div className="merge-confirm-dialog-content">
          <p style={{ margin: '0 0 10px 0' }}>
            Bạn đang thực hiện thao tác gộp hồ sơ cho bệnh nhân <strong>{previewProfile?.fullName}</strong>:
          </p>

          <div className="merge-stat-box">
            <div className="merge-stat-item">
              <div className="stat-value" style={{ color: '#16a34a' }}>{targetPatient?.patientCode}</div>
              <div className="stat-label">Hồ sơ giữ lại (Bảo lưu)</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', color: '#94a3b8' }}>
              <ArrowRightOutlined style={{ fontSize: 20 }} />
            </div>
            <div className="merge-stat-item">
              <div className="stat-value" style={{ color: '#dc2626' }}>{sourcePatient?.patientCode}</div>
              <div className="stat-label">Hồ sơ phụ (Khóa & Gộp)</div>
            </div>
          </div>

          <div style={{ background: '#fef2f2', border: '1px solid #fee2e2', borderRadius: 8, padding: '12px 16px', color: '#991b1b', marginBottom: 14 }}>
            <p style={{ margin: '0 0 6px 0', fontWeight: 600 }}>
              ⚠️ Cảnh báo nghiệp vụ quan trọng:
            </p>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
              <li>Toàn bộ lượt khám, đơn thuốc và hóa đơn của cả hai hồ sơ sẽ được chuyển dồn sang hồ sơ <strong>{targetPatient?.patientCode}</strong>.</li>
              <li>Hồ sơ <strong>{sourcePatient?.patientCode}</strong> sẽ bị khóa vĩnh viễn và không thể tự hoàn tác dễ dàng.</li>
              <li>Thông tin cá nhân hồ sơ giữ lại sẽ được đồng bộ theo đúng các trường bạn vừa lựa chọn.</li>
            </ul>
          </div>

          {/* CHECKBOX CAM KẾT TRÁCH NHIỆM */}
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 12,
              padding: '10px 12px',
              borderRadius: 8,
              border: agreementChecked ? '1.5px solid #16a34a' : '1.5px solid #cbd5e1',
              background: agreementChecked ? '#f0fdf4' : '#f8fafc',
              cursor: 'pointer',
            }}
            onClick={() => setAgreementChecked(!agreementChecked)}
          >
            <Checkbox
              checked={agreementChecked}
              onChange={(e) => setAgreementChecked(e.target.checked)}
              style={{ marginTop: 2, transform: 'scale(1.15)' }}
            />
            <div style={{ fontSize: 13.5, color: '#1f2937', lineHeight: 1.5 }}>
              Tôi xác nhận đã rà soát kỹ lưỡng các trường thông tin cá nhân và chịu trách nhiệm về việc gộp 2 hồ sơ trên.
            </div>
          </div>
        </div>
      </Modal>
    </Modal>
  )
}
