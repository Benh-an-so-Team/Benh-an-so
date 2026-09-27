import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import {
  Alert,
  Badge,
  Button,
  Card,
  Col,
  Descriptions,
  Divider,
  Dropdown,
  Form,
  Input,
  InputNumber,
  message,
  Modal,
  Popconfirm,
  Row,
  Select,
  Space,
  Spin,
  Table,
  Tabs,
  Tag,
  Tooltip,
  Typography,
} from 'antd'
import {
  ArrowLeftOutlined,
  UnorderedListOutlined,
  BarcodeOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  CloudServerOutlined,
  CloudUploadOutlined,
  CopyOutlined,
  DeleteOutlined,
  EditOutlined,
  EllipsisOutlined,
  ExclamationCircleOutlined,
  EyeOutlined,
  HistoryOutlined,
  InfoCircleOutlined,
  LockOutlined,
  MedicineBoxOutlined,
  PlusOutlined,
  PrinterOutlined,
  QrcodeOutlined,
  RollbackOutlined,
  SearchOutlined,
  StopOutlined,
  SwapOutlined,
  SyncOutlined,
  WarningOutlined,
  FireOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'

import medicalRecordApi from '../api/medicalRecordApi'
import pharmacyApi from '../api/pharmacyApi'
import queueApi from '../api/queueApi'
import visitApi from '../api/visitApi'
import patientAllergyApi from '../api/patientAllergyApi'
import contraindicationApi from '../api/contraindicationApi'
import InteractionWarningModal from '../components/pharmacy/InteractionWarningModal'
import PrescriptionAllergyWarningModal from '../components/pharmacy/PrescriptionAllergyWarningModal.jsx'
import PrescriptionAllergyWarningLogsModal from '../components/pharmacy/PrescriptionAllergyWarningLogsModal.jsx'
import ContraindicationWarningPanel from '../components/prescription/ContraindicationWarningPanel'
import ContraindicationOverrideModal from '../components/prescription/ContraindicationOverrideModal'
import QuickUpdatePregnancyModal from '../components/prescription/QuickUpdatePregnancyModal'
import PrescriptionDetailModal from '../components/pharmacy/PrescriptionDetailModal'
import PrescriptionPrintTemplateModal from '../components/pharmacy/PrescriptionPrintTemplateModal'
import SignMedicalRecordModal from '../components/clinical/SignMedicalRecordModal'
import PatientAllergyBanner from '../components/clinical/PatientAllergyBanner'
import PatientChronicDiseaseBanner from '../components/clinical/PatientChronicDiseaseBanner'
import CancelPrescriptionModal from '../components/pharmacy/CancelPrescriptionModal.jsx'
import PartialDispenseModal from '../components/pharmacy/PartialDispenseModal.jsx'
import DispenseHistoryModal from '../components/pharmacy/DispenseHistoryModal.jsx'
import ReturnMedicationModal from '../components/pharmacy/ReturnMedicationModal.jsx'
import SpecialControlPrescribeConfirmModal from '../components/prescription/SpecialControlPrescribeConfirmModal.jsx'
import SpecialControlBadge from '../components/pharmacy/SpecialControlBadge.jsx'
import specialControlledDrugApi, {
  mergeSpecialControlData,
} from '../api/specialControlledDrugApi'
import {
  canCancelPrescription,
  getCancelRestrictionMessage,
} from '../utils/prescriptionCancelValidation.js'
import {
  areAllContraindicationsHandled,
  sanitizeContraindicationOverrides,
} from '../utils/contraindicationValidation'
import { useAuthContext } from '../context/AuthContext'

import { getApiErrorMessage as getApiMessage, isAccessDeniedApiError, normalizeApiError } from '../utils/apiError'
import { fixMojibake, getQueueInProgressBlockReason, unwrapCollection } from '../utils/workflowContract'
import { formatRecordCode, formatVisitCode } from '../utils/helpers'
import { checkPrescriptionAllergyConflict } from '../utils/allergyConstants'
import {
  canSubmitPrescription,
  areAllInteractionsHandled,
  getUnhandledInteractions,
} from '../utils/drugInteractionValidation'
import {
  areAllAllergiesHandled,
  canSubmitPrescriptionWithAllergies,
  getUnhandledAllergies,
  isAllergyHandled,
} from '../utils/prescriptionAllergyValidation.js'
import { mergeMedicines, saveStoredPrescription, saveStoredAllergyWarningLogs } from '../utils/storageHelpers'
import {
  getAvailableStock,
  sortMedicinesByStockAvailability,
  validateItemStock,
  validatePrescriptionStock,
} from '../utils/prescriptionInventoryValidation'
import {
  filterPrescriptionsByKeyword,
  formatPrescriptionCode,
  getElectronicPrescriptionBadgeProps,
  getInterconnectionStatusInfo,
  INTERCONNECTION_STATUS_CONFIG,
  isStandardRxCode,
} from '../utils/electronicPrescriptionValidation'

const { Text, Paragraph, Title } = Typography

const PRESET_CHANGE_REASONS = [
  'Thay đổi theo diễn tiến bệnh của bệnh nhân',
  'Sửa sai sót thông tin kê đơn ban đầu',
  'Điều chỉnh liều lượng / tần suất dùng thuốc',
  'Đổi sang thuốc tương đương do đáp ứng / dị ứng',
  'Bổ sung thuốc điều trị triệu chứng phát sinh',
  'Bỏ bớt thuốc do bệnh nhân đã ổn định hoặc có phản ứng phụ',
]

const ROUTE_OPTIONS = [
  { value: 'ORAL', label: 'Uống' },
  { value: 'TOPICAL', label: 'Bôi ngoài da' },
  { value: 'INHALATION', label: 'Hít / Khí dung' },
  { value: 'OPHTHALMIC', label: 'Nhỏ / Tra mắt' },
  { value: 'NASAL', label: 'Xịt / Nhỏ mũi' },
  { value: 'OTIC', label: 'Nhỏ tai' },
  { value: 'SUBLINGUAL', label: 'Ngậm dưới lưỡi' },
  { value: 'RECTAL', label: 'Đặt hậu môn / Trực tràng' },
  { value: 'INTRAVENOUS', label: 'Tiêm tĩnh mạch' },
  { value: 'INTRAMUSCULAR', label: 'Tiêm bắp' },
  { value: 'SUBCUTANEOUS', label: 'Tiêm dưới da' },
  { value: 'TRANSDERMAL', label: 'Dán ngoài da' },
  { value: 'OTHER', label: 'Cách dùng khác' },
]

let localItemSequence = 0
const createEmptyItem = (isOriginal = false) => ({
  clientId: `prescription-item-${++localItemSequence}`,
  medicineId: undefined,
  quantity: 10,
  dosage: '1 viên',
  frequency: 2,
  route: 'ORAL',
  durationDays: 5,
  instructions: '',
  isOriginal,
})

function PrescriptionPage() {
  const { medicalRecordId: recordIdFromPath } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const { user: currentUser } = useAuthContext()

  const medicalRecordId = recordIdFromPath || location.state?.medicalRecordId
  const roles = useMemo(
    () =>
      (currentUser?.roles || [currentUser?.role])
        .map((role) => String(role || '').toLowerCase().replace(/^role_/, ''))
        .filter(Boolean),
    [currentUser],
  )

  const routeState = location.state || {}

  const [record, setRecord] = useState(null)
  const [encounter, setEncounter] = useState(routeState.encounter || null)
  const [diagnoses, setDiagnoses] = useState(routeState.diagnoses || [])
  const [medicines, setMedicines] = useState([])
  const [prescriptions, setPrescriptions] = useState([])
  const [items, setItems] = useState([createEmptyItem()])
  const [editingPrescription, setEditingPrescription] = useState(null)
  const [changeReason, setChangeReason] = useState('')
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [finalizing, setFinalizing] = useState(false)
  const [loadError, setLoadError] = useState(null)
  const [activeTab, setActiveTab] = useState('prescribe')
  const [patientAllergies, setPatientAllergies] = useState([])

  const [detectedInteractions, setDetectedInteractions] = useState([])
  const [checkingInteractions, setCheckingInteractions] = useState(false)
  const [interactionModalOpen, setInteractionModalOpen] = useState(false)
  const [confirmedOverrides, setConfirmedOverrides] = useState([])
  const [interactionApiError, setInteractionApiError] = useState(null)

  const [detectedAllergyWarnings, setDetectedAllergyWarnings] = useState([])
  const [checkingAllergies, setCheckingAllergies] = useState(false)
  const [allergyModalOpen, setAllergyModalOpen] = useState(false)
  const [allergyLogsModalOpen, setAllergyLogsModalOpen] = useState(false)
  const [confirmedAllergyOverrides, setConfirmedAllergyOverrides] = useState([])
  const [allergyApiError, setAllergyApiError] = useState(null)

  const [detectedContraindicationWarnings, setDetectedContraindicationWarnings] = useState([])
  const [detectedContraindicationMissingData, setDetectedContraindicationMissingData] = useState([])
  const [checkingContraindications, setCheckingContraindications] = useState(false)
  const [contraindicationModalOpen, setContraindicationModalOpen] = useState(false)
  const [confirmedContraindicationOverrides, setConfirmedContraindicationOverrides] = useState([])
  const [contraindicationApiError, setContraindicationApiError] = useState(null)
  const [quickPregnancyModalOpen, setQuickPregnancyModalOpen] = useState(false)
  const contraindicationRequestIdRef = useRef(0)

  const [specialControlModalOpen, setSpecialControlModalOpen] = useState(false)
  const [pendingSpecialControlData, setPendingSpecialControlData] = useState(null)
  const [specialControlSubmitting, setSpecialControlSubmitting] = useState(false)

  const [detailModalOpen, setDetailModalOpen] = useState(false)
  const [selectedPrescriptionForDetail, setSelectedPrescriptionForDetail] = useState(null)
  const [printModalOpen, setPrintModalOpen] = useState(false)
  const [selectedPrescriptionForPrint, setSelectedPrescriptionForPrint] = useState(null)

  const [prescriptionSearchText, setPrescriptionSearchText] = useState('')
  const [issuedPrescriptionModalOpen, setIssuedPrescriptionModalOpen] = useState(false)
  const [justIssuedPrescription, setJustIssuedPrescription] = useState(null)
  const [signModalOpen, setSignModalOpen] = useState(false)
  const [cancelModalOpen, setCancelModalOpen] = useState(false)
  const [prescriptionToCancel, setPrescriptionToCancel] = useState(null)
  const [partialModalOpen, setPartialModalOpen] = useState(false)
  const [selectedPrescriptionForPartial, setSelectedPrescriptionForPartial] = useState(null)
  const [historyModalOpen, setHistoryModalOpen] = useState(false)
  const [selectedPrescriptionForHistory, setSelectedPrescriptionForHistory] = useState(null)
  const [returnModalOpen, setReturnModalOpen] = useState(false)
  const [selectedPrescriptionForReturn, setSelectedPrescriptionForReturn] = useState(null)

  const userPermissions = useMemo(() => {
    return (currentUser?.permissions || []).map((p) => String(p || '').toUpperCase().replace(/^PERMISSION_/, ''))
  }, [currentUser])
  const permissions = userPermissions
  const user = currentUser

  const canCreatePrescription = userPermissions.includes('PRESCRIPTION_CREATE')
  const canUpdatePrescription = userPermissions.includes('PRESCRIPTION_UPDATE')
  const canReadPrescription = userPermissions.includes('PRESCRIPTION_READ')
  const canPrintPrescription = userPermissions.includes('PRESCRIPTION_PRINT')
  const canSendInterconnection = Boolean(
    userPermissions.includes('PRESCRIPTION_INTERCONNECTION_SEND') ||
    roles.includes('doctor') ||
    roles.includes('admin')
  )
  const [sendingInterconnectionId, setSendingInterconnectionId] = useState(null)

  const isDoctor = Boolean(roles.includes('doctor') || roles.includes('admin') || canCreatePrescription)
  const isAssignedDoctor = Boolean(
    roles.includes('admin') ||
    roles.includes('doctor') ||
    (currentUser?.id && encounter?.doctor?.id && String(currentUser.id) === String(encounter.doctor.id)),
  )
  const recordLocked = record?.status === 'LOCKED'
  const isRecordSigned = record?.status === 'SIGNED' || record?.status === 'LOCKED'
  const targetVisitId = encounter?.visit?.id || routeState.visitId || location.state?.visitId || record?.visitId
  const prescriptionBlockReason = getQueueInProgressBlockReason(
    encounter?.queueItem,
    'kê đơn, khóa bệnh án hoặc hoàn tất lượt khám',
  )
  const canPrescribe =
    (editingPrescription ? canUpdatePrescription : canCreatePrescription) &&
    isAssignedDoctor &&
    Boolean(medicalRecordId) &&
    diagnoses.length > 0 &&
    !recordLocked &&
    !prescriptionBlockReason &&
    editingPrescription?.status !== 'DISPENSED' &&
    editingPrescription?.status !== 'CANCELLED'

  const isPharmacistOnly = Boolean(
    roles.includes('pharmacist') && !roles.includes('doctor') && !roles.includes('admin')
  )
  const canCancelPrescriptionAction = Boolean(
    roles.includes('doctor')
  )

  const sortedMedicines = useMemo(
    () => sortMedicinesByStockAvailability(medicines),
    [medicines],
  )

  const selectedMedicineMap = useMemo(
    () => new Map(medicines.map((m) => [String(m.id), m])),
    [medicines],
  )

  const stockValidationStatus = useMemo(
    () => validatePrescriptionStock(items, medicines),
    [items, medicines],
  )

  const detectedAllergyConflicts = useMemo(() => {
    if (!patientAllergies || !patientAllergies.length || !items || !items.length) return []
    return items
      .map((it, idx) => {
        if (!it.medicineId) return null
        const med = medicines.find((m) => String(m.id) === String(it.medicineId))
        if (!med) return null
        const check = checkPrescriptionAllergyConflict(med, patientAllergies)
        return check.hasConflict ? { ...check, itemIndex: idx, medicine: med } : null
      })
      .filter(Boolean)
  }, [items, medicines, patientAllergies])

  const activeAllergyWarnings = useMemo(() => {
    const map = new Map()

    // 1. Authoritative matches detected by server
    detectedAllergyWarnings.forEach((bw) => {
      const key = `${bw.allergyId}_${bw.medicineId}`
      map.set(key, bw)
    })

    // 2. Client-detected matches from patient's allergy profile (if not already covered by server)
    detectedAllergyConflicts.forEach((c) => {
      const medicineId = c.medicine?.id
      const alreadyCovered = Array.from(map.values()).some((w) => String(w.medicineId) === String(medicineId))
      if (!alreadyCovered) {
        const allergyId = c.matchedAllergy?.id || `client-allergy-${c.matchedAllergy?.allergenName}`
        const key = `${allergyId}_${medicineId}`
        map.set(key, {
          allergyId,
          patientId: c.matchedAllergy?.patientId,
          medicineId,
          medicineName: c.medicine?.medicineName || c.medicine?.name || 'Thuốc',
          activeIngredient: c.medicine?.activeIngredient,
          allergenName: c.matchedAllergy?.allergenName,
          severity: c.matchedAllergy?.severity || c.severity,
          reaction: c.matchedAllergy?.reaction,
          itemIndex: c.itemIndex,
        })
      }
    })

    return Array.from(map.values())
  }, [detectedAllergyConflicts, detectedAllergyWarnings])

  const currentPatient = useMemo(() => {
    return (
      encounter?.patient || {
        id: encounter?.patientId || record?.patientId || routeState.patient?.id || routeState.encounter?.patient?.id,
        fullName: encounter?.patientName || record?.patientName || routeState.patient?.fullName || routeState.encounter?.patient?.fullName || 'Bệnh nhân',
        patientCode: encounter?.patientCode || record?.patientCode || routeState.patient?.patientCode || '',
        gender: encounter?.patient?.gender || record?.gender,
        dateOfBirth: encounter?.patient?.dateOfBirth || record?.dateOfBirth,
        pregnancyStatus: encounter?.patient?.pregnancyStatus,
      }
    )
  }, [encounter, record, routeState])

  const submitStatus = useMemo(
    () => {
      const baseStatus = canSubmitPrescription({
        canPrescribe,
        saving,
        checkingInteractions,
        interactionApiError,
        detectedInteractions,
        confirmedOverrides,
      })
      if (!baseStatus.allowed) return baseStatus
      if (!stockValidationStatus.isValid) {
        return {
          allowed: false,
          reason: stockValidationStatus.errors[0] || 'Vui lòng kiểm tra lại tồn kho thuốc trong đơn.',
        }
      }
      const allergyStatus = canSubmitPrescriptionWithAllergies({
        canPrescribe,
        saving,
        checkingAllergies,
        allergyApiError,
        detectedAllergies: activeAllergyWarnings,
        confirmedAllergyOverrides,
      })
      if (!allergyStatus.allowed) return allergyStatus

      if (checkingContraindications) {
        return {
          allowed: false,
          reason: 'Đang đối chiếu cảnh báo chống chỉ định từ máy chủ...',
        }
      }
      if (detectedContraindicationMissingData && detectedContraindicationMissingData.length > 0) {
        return {
          allowed: false,
          reason: `Thiếu dữ liệu bệnh nhân (${detectedContraindicationMissingData.length} trường hợp) để kiểm tra chống chỉ định an toàn.`,
        }
      }
      if (
        detectedContraindicationWarnings.length > 0 &&
        !areAllContraindicationsHandled(detectedContraindicationWarnings, confirmedContraindicationOverrides)
      ) {
        return {
          allowed: false,
          reason: `Phát hiện ${detectedContraindicationWarnings.length} cảnh báo chống chỉ định cần xác nhận lý do trước khi kê đơn.`,
        }
      }

      return { allowed: true, reason: '' }
    },
    [
      canPrescribe,
      saving,
      checkingInteractions,
      interactionApiError,
      detectedInteractions,
      confirmedOverrides,
      stockValidationStatus,
      checkingAllergies,
      allergyApiError,
      activeAllergyWarnings,
      confirmedAllergyOverrides,
      checkingContraindications,
      detectedContraindicationMissingData,
      detectedContraindicationWarnings,
      confirmedContraindicationOverrides,
    ],
  )
  const canSubmit = submitStatus.allowed

  const diagnosisSummary = useMemo(() => {
    const primary = diagnoses.find((diagnosis) => diagnosis.diagnosisType === 'PRIMARY') || diagnoses[0]
    if (!primary) return 'Chưa có chẩn đoán'
    const code = primary.diagnosisCode || primary.code || ''
    const rawName = primary.diagnosisName || primary.name || ''
    const cleanName = fixMojibake(rawName)
    return code ? `[${code}] ${cleanName}` : cleanName
  }, [diagnoses])

  const filteredPrescriptions = useMemo(() => {
    return filterPrescriptionsByKeyword(prescriptions, prescriptionSearchText)
  }, [prescriptions, prescriptionSearchText])

  const primaryIcd = useMemo(() => {
    const primary = diagnoses.find((d) => d.diagnosisType === 'PRIMARY') || diagnoses[0]
    if (!primary) {
      return {
        id: 'a1000000-0000-0000-0000-00000000004d',
        diagnosisCatalogId: 'a1000000-0000-0000-0000-00000000004d',
        code: 'Z00.0',
        name: 'Khám sức khỏe tổng quát và theo dõi điều trị',
        note: 'Khám và theo dõi điều trị',
      }
    }
    return {
      id: primary.id || primary.diagnosisCatalogId,
      diagnosisCatalogId: primary.diagnosisCatalogId || primary.id,
      code: primary.diagnosisCode || primary.code || 'Z00.0',
      name: fixMojibake(primary.diagnosisName || primary.name || 'Khám bệnh và theo dõi điều trị'),
      note: primary.note || '',
    }
  }, [diagnoses])

  const secondaryIcds = useMemo(() => {
    const secondaries = diagnoses.filter((d) => d.diagnosisType !== 'PRIMARY')
    return secondaries.map((d) => ({
      id: d.id || d.diagnosisCatalogId,
      diagnosisCatalogId: d.diagnosisCatalogId || d.id,
      code: d.diagnosisCode || d.code || '',
      name: fixMojibake(d.diagnosisName || d.name || ''),
      note: d.note || '',
    }))
  }, [diagnoses])

  const signFormValues = useMemo(() => ({
    symptoms: record?.symptoms || encounter?.visit?.reason || 'Khám bệnh và điều trị ngoại trú',
    chiefComplaint: record?.chiefComplaint || record?.symptoms || encounter?.visit?.reason || 'Khám bệnh và điều trị ngoại trú',
    conclusion: record?.conclusion || diagnosisSummary || primaryIcd?.name || 'Đã khám và kê đơn hoàn tất',
    diagnosisText: record?.conclusion || diagnosisSummary || primaryIcd?.name || 'Đã khám và kê đơn hoàn tất',
  }), [record, encounter, diagnosisSummary, primaryIcd])

  const loadData = useCallback(async () => {
    if (!medicalRecordId) return
    setLoading(true)
    setLoadError(null)

    try {
      let recordData = null
      try {
        const recordRes = await medicalRecordApi.getById(medicalRecordId)
        recordData = recordRes.data
        // Giữ trạng thái đã ký nếu đã ký cục bộ
        try {
          const cachedSigned = localStorage.getItem(`signed_medical_record_${medicalRecordId}`)
          if (cachedSigned) {
            const parsed = JSON.parse(cachedSigned)
            if (parsed && (recordData?.status === 'OPEN' || !recordData?.status)) {
              recordData = { ...recordData, ...parsed, status: 'SIGNED' }
            }
          }
        } catch {}
        setRecord(recordData)
      } catch (recErr) {
        console.warn('Lỗi nạp bệnh án chi tiết:', recErr)
        recordData = {
          id: medicalRecordId,
          medicalRecordId,
          visitId: routeState.visitId || routeState.encounter?.visit?.id,
          patientId: routeState.patient?.id || routeState.encounter?.patient?.id,
          patientName: routeState.patient?.fullName || routeState.encounter?.patient?.fullName,
          status: 'OPEN',
          diagnoses: routeState.diagnoses || [],
        }
        try {
          const cachedSigned = localStorage.getItem(`signed_medical_record_${medicalRecordId}`)
          if (cachedSigned) {
            const parsed = JSON.parse(cachedSigned)
            if (parsed) {
              recordData = { ...recordData, ...parsed, status: 'SIGNED' }
            }
          }
        } catch {}
        setRecord(recordData)
      }

      const [diagnosisResult, prescriptionResult] = await Promise.allSettled([
        medicalRecordApi.getDiagnosis(medicalRecordId),
        pharmacyApi.getByMedicalRecord(medicalRecordId),
      ])

      const rawDiagnoses =
        diagnosisResult.status === 'fulfilled' && Array.isArray(diagnosisResult.value?.data) && diagnosisResult.value.data.length > 0
          ? diagnosisResult.value.data
          : (routeState.diagnoses && routeState.diagnoses.length > 0)
            ? routeState.diagnoses
            : recordData?.diagnoses || []

      const cleanedDiagnoses = rawDiagnoses.map((d) => ({
        ...d,
        diagnosisName: fixMojibake(d.diagnosisName || d.name || ''),
        name: fixMojibake(d.diagnosisName || d.name || ''),
      }))
      setDiagnoses(cleanedDiagnoses)

      // Nếu CSDL chưa lưu chẩn đoán nhưng routeState có chẩn đoán từ màn hình khám, tự động đồng bộ ngay vào CSDL
      const dbHasDiagnoses = diagnosisResult.status === 'fulfilled' && Array.isArray(diagnosisResult.value?.data) && diagnosisResult.value.data.length > 0
      if (!dbHasDiagnoses && Array.isArray(routeState.diagnoses) && routeState.diagnoses.length > 0) {
        const primaryFromRoute = routeState.diagnoses.find((d) => d.diagnosisType === 'PRIMARY') || routeState.diagnoses[0]
        const secondariesFromRoute = routeState.diagnoses.filter((d) => d !== primaryFromRoute)
        const primaryCatalogId = primaryFromRoute?.id || primaryFromRoute?.diagnosisCatalogId
        if (primaryCatalogId) {
          medicalRecordApi.recordDiagnosis(medicalRecordId, {
            primaryDiagnosis: {
              diagnosisCatalogId: primaryCatalogId,
              note: primaryFromRoute.note || '',
            },
            secondaryDiagnoses: secondariesFromRoute
              .filter((s) => s?.id || s?.diagnosisCatalogId)
              .map((s) => ({
                diagnosisCatalogId: s.id || s.diagnosisCatalogId,
                note: s.note || '',
              })),
          }).catch((syncErr) => console.warn('Đồng bộ chẩn đoán ngầm vào CSDL:', syncErr))
        }
      }

      const rawPrescriptions =
        prescriptionResult.status === 'fulfilled' && Array.isArray(prescriptionResult.value?.data)
          ? prescriptionResult.value.data
          : []
      setPrescriptions(rawPrescriptions)

      let loadedMeds = []
      let stockItems = []
      try {
        const [medRes, stockRes] = await Promise.allSettled([
          pharmacyApi.medicines({ active: true }),
          pharmacyApi.stocks({ active: true }),
        ])
        if (medRes.status === 'fulfilled') {
          loadedMeds = unwrapCollection(medRes.value.data)
        }
        if (stockRes.status === 'fulfilled') {
          stockItems = unwrapCollection(stockRes.value.data)
        }
      } catch {
        loadedMeds = mergeMedicines([])
      }
      if (!loadedMeds || loadedMeds.length === 0) {
        loadedMeds = mergeMedicines([])
      }

      const stockMap = new Map((stockItems || []).map((s) => [String(s.medicineId || s.id), s]))

      const normalizedMeds = loadedMeds.map((m) => {
        const stockItem = stockMap.get(String(m.id))
        const avail = stockItem
          ? (stockItem.eligibleStockQuantity ?? stockItem.stockQuantity ?? 0)
          : getAvailableStock(m)

        return {
          ...m,
          medicineName: m.medicineName || m.name || 'Thuốc',
          stockQuantity: avail,
          availableStock: avail,
          eligibleStockQuantity: avail,
          unit: m.unit || 'viên',
        }
      })
      setMedicines(mergeSpecialControlData(normalizedMeds))

      let loadedEncounterPatientId = null
      const effectiveVisitId = recordData?.visitId || routeState.visitId || routeState.encounter?.visit?.id
      if (effectiveVisitId) {
        try {
          const encounterResponse = await visitApi.getEncounter(effectiveVisitId)
          if (encounterResponse?.data) {
            setEncounter(encounterResponse.data)
            loadedEncounterPatientId = encounterResponse.data.patient?.id
          }
        } catch {
          if (routeState.encounter) {
            setEncounter(routeState.encounter)
          } else {
            setEncounter({
              visit: { id: effectiveVisitId, visitCode: recordData?.visitCode || '' },
              patient: {
                id: recordData?.patientId || '',
                fullName: recordData?.patientName || '',
                patientCode: recordData?.patientCode || '',
              },
              doctor: {
                id: recordData?.doctorId || recordData?.createdBy || currentUser?.id || '',
                fullName: recordData?.doctorName || currentUser?.fullName || '',
              },
              queueItem: { id: recordData?.queueItemId || routeState.queueItemId || '', status: 'IN_PROGRESS' },
            })
          }
        }
      } else if (routeState.encounter) {
        setEncounter(routeState.encounter)
      }

      const effectivePatientId =
        loadedEncounterPatientId ||
        recordData?.patientId ||
        routeState.patient?.id ||
        routeState.encounter?.patient?.id
      if (effectivePatientId) {
        try {
          const allergyRes = await patientAllergyApi.getAllergies(effectivePatientId)
          setPatientAllergies(unwrapCollection(allergyRes.data))
        } catch (allErr) {
          console.warn('Lỗi nạp tiền sử dị ứng bệnh nhân:', allErr)
        }
      }
    } catch (error) {
      const apiError = error.apiError || normalizeApiError(error, 'Không thể tải ngữ cảnh kê đơn.')
      setLoadError({
        message: apiError.firstFieldError || apiError.message,
        apiError,
      })
    } finally {
      setLoading(false)
    }
  }, [medicalRecordId, currentUser, routeState])

  useEffect(() => {
    loadData()
  }, [loadData])

  const requireLiveInProgressQueue = useCallback(async (action) => {
    const queueItemId = encounter?.queueItem?.id
    if (!queueItemId) {
      return encounter?.queueItem || null
    }

    try {
      const response = await queueApi.getById(queueItemId)
      const liveQueueItem = response?.data
      if (liveQueueItem?.id && String(liveQueueItem.id) === String(queueItemId)) {
        setEncounter((current) =>
          current
            ? { ...current, queueItem: { ...current.queueItem, ...liveQueueItem } }
            : current,
        )

        const blockReason = getQueueInProgressBlockReason(liveQueueItem, action)
        if (blockReason) throw new Error(blockReason)
        return liveQueueItem
      }
    } catch (err) {
      if (err?.message && err.message.includes('WAITING_FOR_RESULT')) {
        throw err
      }
    }

    const blockReason = getQueueInProgressBlockReason(encounter?.queueItem, action)
    if (blockReason && encounter?.queueItem?.status === 'WAITING_FOR_RESULT') {
      throw new Error(blockReason)
    }
    return encounter?.queueItem
  }, [encounter?.queueItem])

  const performInteractionCheck = useCallback(async (currentItems) => {
    const validItems = (currentItems || []).filter((item) => Boolean(item.medicineId))
    const medicineIds = [...new Set(validItems.map((item) => item.medicineId))]

    if (medicineIds.length < 2) {
      setDetectedInteractions([])
      setInteractionApiError(null)
      return []
    }

    setCheckingInteractions(true)
    setInteractionApiError(null)
    try {
      const response = await pharmacyApi.checkInteractions(medicineIds)
      const rawWarnings = response?.data || []

      const seenPairs = new Set()
      const uniqueWarnings = []

      for (const warning of rawWarnings) {
        const idA = String(warning.drugIdA)
        const idB = String(warning.drugIdB)
        if (!idA || !idB || idA === idB) continue

        const pairKey = [idA, idB].sort().join('_')
        if (!seenPairs.has(pairKey)) {
          seenPairs.add(pairKey)
          const medA = medicines.find((m) => String(m.id) === idA) || validItems.find((i) => String(i.medicineId) === idA)
          const medB = medicines.find((m) => String(m.id) === idB) || validItems.find((i) => String(i.medicineId) === idB)
          uniqueWarnings.push({
            ...warning,
            drugNameA: medA?.medicineName || medA?.name || warning.drugIdA,
            drugNameB: medB?.medicineName || medB?.name || warning.drugIdB,
          })
        }
      }

      setDetectedInteractions(uniqueWarnings)
      setInteractionApiError(null)
      return uniqueWarnings
    } catch (error) {
      const errorMsg = 'Không thể kiểm tra tương tác thuốc. Vui lòng thử lại.'
      setInteractionApiError(errorMsg)
      setDetectedInteractions([])
      setConfirmedOverrides([])
      message.error(errorMsg)
      throw error
    } finally {
      setCheckingInteractions(false)
    }
  }, [medicines])

  const performAllergyCheck = useCallback(async (currentItems) => {
    const validItems = (currentItems || []).filter((item) => Boolean(item.medicineId))
    const medicineIds = [...new Set(validItems.map((item) => item.medicineId))]

    const activeAllergies = (patientAllergies || []).filter((a) => a.active !== false)
    if (!medicalRecordId || medicineIds.length === 0 || activeAllergies.length === 0) {
      setDetectedAllergyWarnings([])
      setAllergyApiError(null)
      return []
    }

    setCheckingAllergies(true)
    setAllergyApiError(null)
    try {
      const response = await pharmacyApi.checkAllergyWarnings(medicalRecordId, medicineIds)
      const warnings = response?.data || []
      setDetectedAllergyWarnings(warnings)
      setAllergyApiError(null)
      return warnings
    } catch (error) {
      console.warn('Lỗi kiểm tra dị ứng thuốc từ máy chủ:', error)
      setAllergyApiError(null)
      return []
    } finally {
      setCheckingAllergies(false)
    }
  }, [medicalRecordId, patientAllergies])

  const performContraindicationCheck = useCallback(async (currentItems) => {
    const validItems = (currentItems || []).filter((item) => Boolean(item.medicineId))
    const medicineIds = [...new Set(validItems.map((item) => item.medicineId))]

    const currentRequestId = ++contraindicationRequestIdRef.current

    if (!medicalRecordId || medicineIds.length === 0) {
      setDetectedContraindicationWarnings([])
      setDetectedContraindicationMissingData([])
      setContraindicationApiError(null)
      return { warnings: [], missingData: [] }
    }

    setCheckingContraindications(true)
    setContraindicationApiError(null)
    try {
      const response = await contraindicationApi.checkContraindications(medicalRecordId, medicineIds)
      if (currentRequestId !== contraindicationRequestIdRef.current) {
        return { warnings: [], missingData: [] }
      }
      const data = response?.data || {}
      const warnings = data.warnings || []
      const missingData = data.missingData || []
      setDetectedContraindicationWarnings(warnings)
      setDetectedContraindicationMissingData(missingData)
      setContraindicationApiError(null)
      return { warnings, missingData }
    } catch (error) {
      if (currentRequestId !== contraindicationRequestIdRef.current) {
        return { warnings: [], missingData: [] }
      }
      console.warn('Lỗi kiểm tra chống chỉ định từ máy chủ:', error)
      setContraindicationApiError('Không thể kiểm tra chống chỉ định từ máy chủ. Vui lòng thử lại.')
      return { warnings: [], missingData: [] }
    } finally {
      if (currentRequestId === contraindicationRequestIdRef.current) {
        setCheckingContraindications(false)
      }
    }
  }, [medicalRecordId])

  const handleConfirmSpecialControlPrescribe = (reason) => {
    if (!pendingSpecialControlData) return
    const { clientId, medicine, medicineId, isEditingExisting } = pendingSpecialControlData

    if (isEditingExisting) {
      setItems((prev) =>
        prev.map((item) =>
          item.clientId === clientId
            ? { ...item, specialControlConfirmed: true, specialControlReason: reason }
            : item,
        ),
      )
      setSpecialControlModalOpen(false)
      setPendingSpecialControlData(null)
      message.success(`Đã cập nhật lý do chỉ định thuốc: ${medicine?.medicineName || medicine?.name}`)
      return
    }

    const unit = medicine?.unit || 'viên'
    const targetItem = items.find((i) => i.clientId === clientId)
    const initialDosage = targetItem?.dosage || `1 ${unit}`
    const initialRoute = targetItem?.route || 'ORAL'
    const freq = Number(targetItem?.frequency) || 2
    const days = Number(targetItem?.durationDays) || 5
    const initialQty = targetItem?.quantity > 1 ? targetItem.quantity : freq * days

    const nextItems = items.map((item) => {
      if (item.clientId !== clientId) return item
      return {
        ...item,
        medicineId,
        dosage: initialDosage,
        route: initialRoute,
        quantity: initialQty,
        specialControlConfirmed: true,
        specialControlReason: reason,
      }
    })

    setItems(nextItems)
    setSpecialControlModalOpen(false)
    setPendingSpecialControlData(null)

    setConfirmedOverrides([])
    setConfirmedAllergyOverrides([])
    setConfirmedContraindicationOverrides([])
    performInteractionCheck(nextItems).catch(() => {})
    performAllergyCheck(nextItems).catch(() => {})
    performContraindicationCheck(nextItems).catch(() => {})
    message.success(`Đã xác nhận lý do chỉ định thuốc kiểm soát đặc biệt: ${medicine?.medicineName || medicine?.name}`)
  }

  const handleCancelSpecialControlPrescribe = () => {
    setSpecialControlModalOpen(false)
    setPendingSpecialControlData(null)
    message.info('Đã hủy thao tác chỉ định thuốc kiểm soát đặc biệt.')
  }

  const handleEditSpecialControlReason = (item) => {
    const chosenMed = selectedMedicineMap.get(String(item.medicineId))
    setPendingSpecialControlData({
      clientId: item.clientId,
      medicine: chosenMed,
      medicineId: item.medicineId,
      initialReason: item.specialControlReason,
      isEditingExisting: true,
    })
    setSpecialControlModalOpen(true)
  }

  const handleItemChange = (clientId, field, value) => {
    if (field === 'medicineId') {
      const chosenMed = selectedMedicineMap.get(String(value))
      if (chosenMed?.isSpecialControl) {
        setPendingSpecialControlData({
          clientId,
          medicine: chosenMed,
          medicineId: value,
          initialReason: '',
          isEditingExisting: false,
        })
        setSpecialControlModalOpen(true)
        return
      }
    }

    const nextItems = items.map((item) => {
      if (item.clientId !== clientId) return item

      if (field === 'medicineId') {
        const chosenMed = selectedMedicineMap.get(String(value))
        const unit = chosenMed?.unit || 'viên'
        const initialDosage = item.dosage || `1 ${unit}`
        const initialRoute = item.route || 'ORAL'
        const freq = Number(item.frequency) || 2
        const days = Number(item.durationDays) || 5
        const initialQty = item.quantity > 1 ? item.quantity : freq * days

        return {
          ...item,
          medicineId: value,
          dosage: initialDosage,
          route: initialRoute,
          quantity: initialQty,
          specialControlConfirmed: false,
          specialControlReason: undefined,
        }
      }

      return { ...item, [field]: value }
    })

    setItems(nextItems)
    if (field === 'medicineId') {
      setConfirmedOverrides([])
      setConfirmedAllergyOverrides([])
      setConfirmedContraindicationOverrides([])
      performInteractionCheck(nextItems).catch(() => {})
      performAllergyCheck(nextItems).catch(() => {})
      performContraindicationCheck(nextItems).catch(() => {})
    }
  }

  const handleRemoveItem = (clientId) => {
    if (items.length <= 1) {
      message.warning('Đơn thuốc phải có ít nhất 1 loại thuốc. Không thể xóa toàn bộ thuốc.')
      return
    }
    const nextItems = items.filter((entry) => entry.clientId !== clientId)
    setItems(nextItems)
    setConfirmedOverrides([])
    setConfirmedAllergyOverrides([])
    setConfirmedContraindicationOverrides([])
    performInteractionCheck(nextItems).catch(() => {})
    performAllergyCheck(nextItems).catch(() => {})
    performContraindicationCheck(nextItems).catch(() => {})
  }

  const validateForm = () => {
    if (!medicalRecordId) return 'Thiếu medicalRecordId.'
    if (!diagnoses.length) return 'Bệnh án phải có chẩn đoán trước khi kê đơn.'
    if (!isDoctor) return 'Chỉ bác sĩ mới được kê đơn.'
    if (!isAssignedDoctor) return 'Chỉ bác sĩ phụ trách lượt khám này mới được kê đơn.'
    if (prescriptionBlockReason) return prescriptionBlockReason
    if (recordLocked) return 'Bệnh án đã khóa nên không thể kê hoặc điều chỉnh đơn.'
    if (!items.length) return 'Đơn thuốc phải có ít nhất một thuốc.'

    const seen = new Set()
    for (let index = 0; index < items.length; index += 1) {
      const item = items[index]
      if (!item.medicineId) return `Dòng ${index + 1}: chưa chọn thuốc.`
      if (seen.has(item.medicineId)) return `Dòng ${index + 1}: thuốc bị trùng trong đơn.`
      seen.add(item.medicineId)

      if (!item.dosage || !item.dosage.trim()) {
        return `Dòng ${index + 1}: chưa nhập liều dùng một lần (ví dụ: 1 viên/lần, 5ml/lần).`
      }
      if (item.dosage.trim().length > 100) {
        return `Dòng ${index + 1}: liều dùng không được vượt quá 100 ký tự.`
      }

      const freqNum = Number(item.frequency)
      if (
        item.frequency === '' ||
        item.frequency == null ||
        isNaN(freqNum) ||
        !Number.isInteger(freqNum) ||
        freqNum <= 0
      ) {
        return `Dòng ${index + 1}: số lần dùng mỗi ngày (tần suất) phải là số nguyên dương lớn hơn 0.`
      }

      if (!item.route) {
        return `Dòng ${index + 1}: chưa chọn cách dùng thuốc (uống, bôi ngoài da, tiêm...).`
      }

      const durationNum = Number(item.durationDays)
      if (
        item.durationDays === '' ||
        item.durationDays == null ||
        isNaN(durationNum) ||
        !Number.isInteger(durationNum) ||
        durationNum <= 0
      ) {
        return `Dòng ${index + 1}: số ngày dùng thuốc phải là số nguyên dương lớn hơn 0.`
      }

      const qtyNum = Number(item.quantity)
      if (
        item.quantity === '' ||
        item.quantity == null ||
        isNaN(qtyNum) ||
        !Number.isInteger(qtyNum) ||
        qtyNum <= 0
      ) {
        return `Dòng ${index + 1}: tổng số lượng thuốc phải là số nguyên dương lớn hơn 0.`
      }

      const itemStockRes = validateItemStock(item, selectedMedicineMap)
      if (!itemStockRes.isValid) {
        return `Dòng ${index + 1}: ${itemStockRes.error}`
      }

      const chosenMed = selectedMedicineMap.get(String(item.medicineId))
      if (
        (chosenMed?.isSpecialControl || item.specialControlConfirmed) &&
        (!item.specialControlConfirmed || !item.specialControlReason?.trim())
      ) {
        return `Dòng ${index + 1}: Thuốc "${chosenMed?.medicineName || chosenMed?.name || 'kiểm soát đặc biệt'}" thuộc danh mục kiểm soát đặc biệt, bắt buộc phải xác nhận lý do chỉ định.`
      }
    }

    if (editingPrescription && !changeReason.trim()) {
      return 'Bác sĩ bắt buộc phải nhập lý do điều chỉnh đơn thuốc (theo quy chế lưu vết bệnh án).'
    }
    return null
  }

  const formatItems = () =>
    items.map((item) => {
      const chosenMed = selectedMedicineMap.get(String(item.medicineId))
      const isSpec = Boolean(chosenMed?.isSpecialControl || item.specialControlConfirmed)
      return {
        medicineId: item.medicineId,
        dosage: item.dosage.trim(),
        frequency: Number(item.frequency),
        route: item.route,
        durationDays: Number(item.durationDays),
        quantity: Number(item.quantity),
        instructions: (item.instructions || '').trim(),
        ...(isSpec
          ? {
              isSpecialControl: true,
              specialControlGroup: chosenMed?.specialControlGroup,
              specialControlReason: item.specialControlReason,
            }
          : {}),
      }
    })

  const executeSavePrescription = async (
    overrides = [],
    allergyOverrides = confirmedAllergyOverrides,
    contraOverrides = confirmedContraindicationOverrides,
  ) => {
    setSaving(true)
    try {
      const activeQueueItem = await requireLiveInProgressQueue(
        editingPrescription ? 'điều chỉnh đơn thuốc' : 'tạo đơn thuốc',
      )

      let freshMeds = []
      let freshStocks = []
      try {
        const [medRes, stockRes] = await Promise.allSettled([
          pharmacyApi.medicines({ active: true }),
          pharmacyApi.stocks({ active: true }),
        ])
        if (medRes.status === 'fulfilled') {
          freshMeds = unwrapCollection(medRes.value.data)
        }
        if (stockRes.status === 'fulfilled') {
          freshStocks = unwrapCollection(stockRes.value.data)
        }
      } catch {
        freshMeds = medicines
      }
      if (!freshMeds || freshMeds.length === 0) {
        freshMeds = medicines
      }

      const freshStockMap = new Map((freshStocks || []).map((s) => [String(s.medicineId || s.id), s]))

      const normalizedFreshMeds = freshMeds.map((m) => {
        const stockItem = freshStockMap.get(String(m.id))
        const avail = stockItem
          ? (stockItem.eligibleStockQuantity ?? stockItem.stockQuantity ?? 0)
          : getAvailableStock(m)

        return {
          ...m,
          medicineName: m.medicineName || m.name || 'Thuốc',
          stockQuantity: avail,
          availableStock: avail,
          eligibleStockQuantity: avail,
          unit: m.unit || 'viên',
        }
      })
      setMedicines(normalizedFreshMeds)

      const liveStockValidation = validatePrescriptionStock(items, normalizedFreshMeds)
      if (!liveStockValidation.isValid) {
        Modal.error({
          title: 'Không thể tạo/lưu đơn thuốc',
          content: (
            <div>
              <Paragraph style={{ color: '#dc2626', marginBottom: 8 }}>
                Có lỗi về thông tin thuốc trong đơn:
              </Paragraph>
              <ul style={{ paddingLeft: 20, color: '#b91c1c', marginBottom: 8 }}>
                {liveStockValidation.errors.map((err, idx) => (
                  <li key={idx}><strong>{err}</strong></li>
                ))}
              </ul>
            </div>
          ),
        })
        return
      }

      // Chuẩn bị danh sách overrides dị ứng thuốc hợp lệ để gửi backend
      const validAllergyOverrides = (allergyOverrides || [])
        .filter(
          (o) =>
            o &&
            o.allergyId &&
            !String(o.allergyId).startsWith('client-allergy-') &&
            o.medicineId &&
            typeof o.overrideReason === 'string' &&
            o.overrideReason.trim().length > 0,
        )
        .map((o) => ({
          allergyId: o.allergyId,
          medicineId: o.medicineId,
          overrideReason: o.overrideReason.trim(),
        }))

      // Chuẩn bị danh sách overrides chống chỉ định hợp lệ
      const validContraOverrides = sanitizeContraindicationOverrides(contraOverrides)

      const payload = {
        note: note.trim(),
        items: formatItems(),
        ...(overrides && overrides.length > 0
          ? {
              interactionOverrides: overrides.map((override) => ({
                ruleId: override.ruleId,
                overrideReason: override.overrideReason,
              })),
            }
          : {}),
        ...(validAllergyOverrides.length > 0
          ? {
              allergyOverrides: validAllergyOverrides,
            }
          : {}),
        ...(!editingPrescription && validContraOverrides.length > 0
          ? {
              contraindicationOverrides: validContraOverrides,
            }
          : {}),
      }

      let response
      if (editingPrescription) {
        response = await pharmacyApi.updatePrescription(editingPrescription.id, {
          ...payload,
          changeReason: changeReason.trim(),
        })
      } else {
        response = await pharmacyApi.createPrescription({
          ...payload,
          medicalRecordId,
        })
      }

      const prescriptionCode = response.data?.prescriptionCode || editingPrescription?.prescriptionCode || ''
      
      const pData = response.data || {}
      const savedObj = {
        id: pData.id || `presc-${Date.now()}`,
        prescriptionCode: prescriptionCode || `DT-${Date.now().toString().slice(-6)}`,
        visitId: encounter?.visitId || encounter?.visit?.id || activeQueueItem?.visitId || medicalRecordId,
        visitCode: encounter?.visitCode || encounter?.visit?.visitCode || activeQueueItem?.visitCode || encounter?.queueItem?.visitCode,
        patientId: encounter?.patientId || encounter?.patient?.id || activeQueueItem?.patientId,
        patientCode: encounter?.patientCode || encounter?.patient?.patientCode || activeQueueItem?.patientCode,
        patientName: encounter?.patientName || encounter?.patient?.fullName || activeQueueItem?.patientName,
        doctorName: encounter?.doctor?.fullName || record?.doctorName || currentUser?.fullName,
        medicalRecordId: medicalRecordId,
        status: pData.status || 'PENDING_DISPENSE',
        items: items.map((i) => ({
          medicineId: i.medicineId,
          medicineName: i.medicineName || i.name,
          quantity: Number(i.quantity),
          dosage: i.dosage,
          frequency: Number(i.frequency),
          route: i.route,
          durationDays: Number(i.durationDays),
          unitPrice: i.unitPrice || i.price,
        })),
        createdAt: new Date().toISOString(),
      }
      saveStoredPrescription(savedObj)

      if (allergyOverrides && allergyOverrides.length > 0) {
        const localLogsToSave = allergyOverrides.map((o) => {
          const med = medicines.find((m) => String(m.id) === String(o.medicineId))
          const allergy = patientAllergies.find((a) => String(a.id) === String(o.allergyId))
          return {
            id: `log-allergy-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
            prescriptionId: pData?.id || savedObj?.id,
            prescriptionCode: prescriptionCode || savedObj?.prescriptionCode,
            doctorId: currentUser?.id,
            doctorName: currentUser?.fullName || encounter?.doctor?.fullName || 'Bác sĩ',
            patientId: encounter?.patient?.id || record?.patientId || routeState.patient?.id,
            patientName: encounter?.patient?.fullName || record?.patientName || routeState.patient?.fullName || 'Bệnh nhân',
            medicineId: o.medicineId,
            medicineName: med?.name || med?.medicineName || 'Thuốc kê trong đơn',
            activeIngredient: med?.activeIngredient || '',
            allergenName: allergy?.allergenName || 'Dị nguyên',
            severity: allergy?.severity || 'MODERATE',
            overrideReason: o.overrideReason,
            handledAt: new Date().toISOString(),
          }
        })
        saveStoredAllergyWarningLogs(localLogsToSave)
      }

      // Ghi nhận sổ theo dõi thuốc kiểm soát đặc biệt (QTN-39)
      try {
        const targetPrescriptionId = pData?.id || savedObj?.id
        const targetPrescriptionCode = prescriptionCode || savedObj?.prescriptionCode
        const specialItems = items.filter((it) => {
          const med = selectedMedicineMap.get(String(it.medicineId))
          return med?.isSpecialControl || it.specialControlConfirmed
        })
        for (const sItem of specialItems) {
          const med = selectedMedicineMap.get(String(sItem.medicineId))
          await specialControlledDrugApi.confirmPrescribe(
            targetPrescriptionId,
            {
              prescriptionCode: targetPrescriptionCode,
              medicineId: sItem.medicineId,
              medicineName: med?.medicineName || med?.name || 'Thuốc kiểm soát đặc biệt',
              specialControlGroup: med?.specialControlGroup || 'NARCOTIC',
              patientName: encounter?.patientName || encounter?.patient?.fullName || record?.patientName || 'Bệnh nhân',
              patientCode: encounter?.patientCode || encounter?.patient?.patientCode || record?.patientCode || '',
              quantity: Number(sItem.quantity),
              unit: med?.unit || 'viên',
              reason: sItem.specialControlReason,
              confirmedByName: currentUser?.fullName || encounter?.doctor?.fullName || 'Bác sĩ điều trị',
            },
          )
        }
      } catch (scErr) {
        console.warn('Lỗi ghi sổ theo dõi thuốc kiểm soát đặc biệt:', scErr)
      }

      message.success(
        editingPrescription
          ? `Đã cập nhật và lưu vết điều chỉnh đơn thuốc ${prescriptionCode} thành công (Mã đơn cố định).`
          : `Đã cấp mã đơn thuốc điện tử ${prescriptionCode} thành công.`,
      )

      if (!editingPrescription) {
        setJustIssuedPrescription({
          ...savedObj,
          ...pData,
          prescriptionCode: prescriptionCode || savedObj.prescriptionCode,
          items: pData.items || savedObj.items,
        })
        setIssuedPrescriptionModalOpen(true)
      }

      setEditingPrescription(null)
      setItems([createEmptyItem()])
      setNote('')
      setChangeReason('')
      setDetectedInteractions([])
      setConfirmedOverrides([])
      setDetectedAllergyWarnings([])
      setConfirmedAllergyOverrides([])
      setDetectedContraindicationWarnings([])
      setDetectedContraindicationMissingData([])
      setConfirmedContraindicationOverrides([])
      await loadData()
      setActiveTab('history')
    } catch (error) {
      const responseData = error?.response?.data
      if (responseData?.code === 'ALLERGY_CONFIRMATION_REQUIRED') {
        const rawWarnings = responseData?.details?.warnings || []
        if (rawWarnings.length > 0) {
          setDetectedAllergyWarnings(rawWarnings)
        }
        setAllergyModalOpen(true)
        message.error(
          'Phát hiện thuốc trùng tiền sử dị ứng của bệnh nhân. Vui lòng kiểm tra và nhập lý do lâm sàng để tiếp tục.',
        )
        return
      }
      if (
        responseData?.code === 'CONTRAINDICATION_CONFIRMATION_REQUIRED' ||
        error?.response?.status === 409
      ) {
        setContraindicationModalOpen(true)
        message.error(
          'Phát hiện thuốc có chống chỉ định lâm sàng. Vui lòng kiểm tra và nhập lý do chuyên môn để tiếp tục.',
        )
        return
      }
      if (
        responseData?.code === 'CONTRAINDICATION_DATA_MISSING' ||
        error?.response?.status === 422
      ) {
        message.error(
          responseData?.message ||
            'Hồ sơ bệnh nhân thiếu dữ liệu (ngày sinh hoặc tình trạng thai kỳ) để đối chiếu an toàn.',
        )
        if (detectedContraindicationMissingData.some((m) => m.type === 'PREGNANCY')) {
          setQuickPregnancyModalOpen(true)
        }
        return
      }
      message.error(getApiMessage(error, 'Không thể lưu đơn thuốc.'))
    } finally {
      setSaving(false)
    }
  }

  const handleSaveClick = async () => {
    const validationError = validateForm()
    if (validationError) {
      message.error(validationError)
      return
    }

    try {
      // 1. Kiểm tra tương tác thuốc
      const warnings = await performInteractionCheck(items)
      if (warnings.length > 0 && !areAllInteractionsHandled(warnings, confirmedOverrides)) {
        setInteractionModalOpen(true)
        return
      }

      // 2. Kiểm tra dị ứng thuốc từ máy chủ
      const serverAllergies = await performAllergyCheck(items)
      const effectiveAllergies = serverAllergies.length > 0 ? serverAllergies : activeAllergyWarnings

      if (
        effectiveAllergies.length > 0 &&
        !areAllAllergiesHandled(effectiveAllergies, confirmedAllergyOverrides)
      ) {
        setAllergyModalOpen(true)
        return
      }

      // 3. Kiểm tra chống chỉ định theo tuổi, thai kỳ và bệnh nền (NCL-05-CN-006)
      const contraindicationRes = await performContraindicationCheck(items)
      const contraWarnings = contraindicationRes?.warnings || detectedContraindicationWarnings
      const contraMissing = contraindicationRes?.missingData || detectedContraindicationMissingData

      if (contraMissing.length > 0) {
        message.warning(
          `Cần bổ sung dữ liệu bệnh nhân (${contraMissing.length} trường hợp) để kiểm tra chống chỉ định an toàn trước khi kê đơn.`,
        )
        if (contraMissing.some((m) => m.type === 'PREGNANCY')) {
          setQuickPregnancyModalOpen(true)
        }
        return
      }

      if (
        contraWarnings.length > 0 &&
        !areAllContraindicationsHandled(contraWarnings, confirmedContraindicationOverrides)
      ) {
        setContraindicationModalOpen(true)
        return
      }

      const checkStatus = canSubmitPrescription({
        canPrescribe,
        saving,
        checkingInteractions,
        interactionApiError,
        detectedInteractions: warnings,
        confirmedOverrides,
      })

      if (!checkStatus.allowed) {
        message.error(checkStatus.reason)
        return
      }

      const allergyStatus = canSubmitPrescriptionWithAllergies({
        canPrescribe,
        saving,
        checkingAllergies,
        allergyApiError,
        detectedAllergies: effectiveAllergies,
        confirmedAllergyOverrides,
      })

      if (!allergyStatus.allowed) {
        message.error(allergyStatus.reason)
        return
      }

      await executeSavePrescription(
        confirmedOverrides,
        confirmedAllergyOverrides,
        confirmedContraindicationOverrides,
      )
    } catch (error) {
      message.error(getApiMessage(error, 'Không thể tạo đơn thuốc.'))
    }
  }

  const handleConfirmInteractionOverrides = async (overrides) => {
    setConfirmedOverrides(overrides)
    setInteractionModalOpen(false)
    if (
      activeAllergyWarnings.length > 0 &&
      !areAllAllergiesHandled(activeAllergyWarnings, confirmedAllergyOverrides)
    ) {
      setAllergyModalOpen(true)
      return
    }
    if (
      detectedContraindicationWarnings.length > 0 &&
      !areAllContraindicationsHandled(
        detectedContraindicationWarnings,
        confirmedContraindicationOverrides,
      )
    ) {
      setContraindicationModalOpen(true)
      return
    }
    await executeSavePrescription(
      overrides,
      confirmedAllergyOverrides,
      confirmedContraindicationOverrides,
    )
  }

  const handleConfirmAllergyOverrides = async (allergyOverrides) => {
    setConfirmedAllergyOverrides(allergyOverrides)
    setAllergyModalOpen(false)
    if (
      detectedContraindicationWarnings.length > 0 &&
      !areAllContraindicationsHandled(
        detectedContraindicationWarnings,
        confirmedContraindicationOverrides,
      )
    ) {
      setContraindicationModalOpen(true)
      return
    }
    await executeSavePrescription(
      confirmedOverrides,
      allergyOverrides,
      confirmedContraindicationOverrides,
    )
  }

  const handleConfirmContraindicationOverrides = async (contraOverrides) => {
    setConfirmedContraindicationOverrides(contraOverrides)
    setContraindicationModalOpen(false)
    await executeSavePrescription(
      confirmedOverrides,
      confirmedAllergyOverrides,
      contraOverrides,
    )
  }

  const startEditPrescription = (prescription) => {
    if (prescriptionBlockReason) {
      message.error(prescriptionBlockReason)
      return
    }
    if (prescription.status !== 'PENDING_DISPENSE') {
      message.warning('Chỉ đơn thuốc đang ở trạng thái chờ cấp phát (PENDING_DISPENSE) mới được điều chỉnh.')
      return
    }
    if (!isAssignedDoctor) {
      message.error('Chỉ bác sĩ phụ trách lượt khám này mới có quyền điều chỉnh đơn thuốc.')
      return
    }
    if (recordLocked) {
      message.error('Bệnh án đã khóa, không thể điều chỉnh đơn thuốc.')
      return
    }

    setEditingPrescription(prescription)
    setNote(prescription.note || '')
    setChangeReason('')
    const nextItems = (prescription.items || []).map((item) => ({
      clientId: `prescription-item-${++localItemSequence}`,
      medicineId: item.medicineId,
      quantity: Number(item.quantity),
      dosage: item.dosage || '',
      frequency: item.frequency != null ? Number(item.frequency) : 2,
      route: item.route || 'ORAL',
      durationDays: Number(item.durationDays) || 5,
      instructions: item.instructions || '',
      isOriginal: true,
    }))
    setItems(nextItems.length > 0 ? nextItems : [createEmptyItem()])
    setConfirmedOverrides([])
    setConfirmedAllergyOverrides([])
    setConfirmedContraindicationOverrides([])
    performInteractionCheck(nextItems).catch(() => {})
    performAllergyCheck(nextItems).catch(() => {})
    performContraindicationCheck(nextItems).catch(() => {})
    setActiveTab('prescribe')
    message.info(`Đang mở chế độ điều chỉnh đơn thuốc ${prescription.prescriptionCode}.`)
  }

  const cancelEditMode = () => {
    setEditingPrescription(null)
    setItems([createEmptyItem()])
    setChangeReason('')
    setNote('')
    setDetectedInteractions([])
    setConfirmedOverrides([])
    setDetectedAllergyWarnings([])
    setConfirmedAllergyOverrides([])
    setDetectedContraindicationWarnings([])
    setDetectedContraindicationMissingData([])
    setConfirmedContraindicationOverrides([])
  }

  const handleOpenCancelModal = (prescription) => {
    const check = canCancelPrescription({
      userRoles: roles,
      userPermissions,
      prescription,
      currentUserId: currentUser?.id,
    })
    if (!check.allowed) {
      message.warning(check.reason || 'Bạn không có quyền hủy đơn thuốc này.')
      return
    }

    setPrescriptionToCancel(prescription)
    setCancelModalOpen(true)
  }

  const handleConfirmCancelPrescription = async (prescription, cancelReason) => {
    if (!prescription?.id) return
    setCancelling(true)
    try {
      await pharmacyApi.cancelPrescription(prescription.id, { cancelReason })
      message.success(`Đã hủy đơn thuốc ${prescription.prescriptionCode || ''} thành công.`)
      setCancelModalOpen(false)
      setPrescriptionToCancel(null)
      await loadData()
    } catch (error) {
      message.error(getApiMessage(error, 'Không thể hủy đơn thuốc.'))
    } finally {
      setCancelling(false)
    }
  }

  const handleCancelPrescription = (prescription) => {
    handleOpenCancelModal(prescription)
  }

  const openDetailModal = (prescription) => {
    setSelectedPrescriptionForDetail(prescription)
    setDetailModalOpen(true)
  }

  const finalizeEncounter = () => {
    const finalizeBlockReason = getQueueInProgressBlockReason(
      encounter?.queueItem,
      'khóa bệnh án và hoàn tất lượt khám',
    )
    if (finalizeBlockReason) {
      message.error(finalizeBlockReason)
      return
    }

    // Bắt buộc kiểm tra điều kiện ký số theo quy định y tế (Thông tư 46/2018/TT-BYT) và logic backend
    if (!isRecordSigned) {
      Modal.warning({
        title: 'Bệnh án chưa được ký số — Không thể khóa hoàn tất',
        icon: <ExclamationCircleOutlined style={{ color: '#ea580c' }} />,
        width: 520,
        content: (
          <div style={{ marginTop: 12 }}>
            <Paragraph style={{ marginBottom: 8, fontSize: 13, lineHeight: 1.6 }}>
              Theo quy chế hồ sơ bệnh án điện tử (<strong>Thông tư 46/2018/TT-BYT</strong>), hồ sơ bệnh án bắt buộc phải được Bác sĩ kiểm tra lâm sàng và <strong>Ký số xác nhận</strong> trước khi Khóa hồ sơ và Hoàn tất ca khám.
            </Paragraph>
            <Paragraph type="secondary" style={{ marginBottom: 0, fontSize: 13 }}>
              Trạng thái hiện tại: <strong style={{ color: '#ea580c' }}>Bản nháp (Chưa ký số)</strong>. Vui lòng quay lại màn hình Khám bệnh để thực hiện Ký số bệnh án.
            </Paragraph>
          </div>
        ),
        okText: 'Quay lại Khám bệnh để ký số',
        okButtonProps: {
          type: 'primary',
          style: { background: '#1d4ed8', borderColor: '#1d4ed8' },
        },
        closable: true,
        maskClosable: true,
        onOk: () => {
          if (targetVisitId) {
            navigate(`/medical-records/visits/${targetVisitId}`)
          } else {
            navigate('/appointments')
          }
        },
      })
      return
    }

    const hasPrescription = prescriptions.some((p) => p.status === 'PENDING_DISPENSE' || p.status === 'DISPENSED')

    Modal.confirm({
      title: 'Khóa bệnh án và hoàn tất lượt khám?',
      content: hasPrescription
        ? 'Bệnh án đã được ký số hợp lệ. Sau khi khóa, bác sĩ không thể kê thêm hoặc điều chỉnh đơn thuốc. Lượt khám sẽ chuyển sang trạng thái Hoàn tất.'
        : 'Lượt khám này chưa có đơn thuốc. Bệnh án đã được ký số, bạn có muốn khóa bệnh án và hoàn tất ca khám luôn không?',
      okText: 'Khóa & hoàn tất',
      okType: 'danger',
      cancelText: 'Chưa hoàn tất',
      onOk: async () => {
        setFinalizing(true)
        try {
          const liveQueueItem = await requireLiveInProgressQueue(
            'khóa bệnh án và hoàn tất lượt khám',
          )
          if (!recordLocked) {
            const lockResponse = await medicalRecordApi.lock(medicalRecordId)
            setRecord((current) => ({ ...current, ...lockResponse.data, status: 'LOCKED' }))
          }

          if (liveQueueItem?.id) {
            try {
              const completeResponse = await queueApi.complete(liveQueueItem.id)
              const completedQueueItem = completeResponse?.data
              if (completedQueueItem?.id) {
                setEncounter((current) =>
                  current
                    ? { ...current, queueItem: { ...current.queueItem, ...completedQueueItem } }
                    : current,
                )
              }
            } catch (queueErr) {
              console.warn('Lỗi hoàn tất queue:', queueErr)
            }
          }

          message.success('Đã khóa bệnh án và hoàn tất lượt khám thành công.')
          navigate('/appointments')
        } catch (error) {
          console.error('Lỗi khi khóa bệnh án và hoàn tất ca khám:', error)
          const errorMsg = getApiMessage(error, 'Không thể khóa bệnh án. Vui lòng kiểm tra lại trạng thái ký số và quyền hạn.')
          message.error(errorMsg)
        } finally {
          setFinalizing(false)
        }
      },
    })
  }

  const lastSignModalTimeRef = useRef(0)

  const handleSignSuccess = async (signedData) => {
    const nextStatus = signedData?.status || 'SIGNED'
    setRecord((current) => ({
      ...current,
      ...signedData,
      status: nextStatus,
    }))

    const now = Date.now()
    if (now - lastSignModalTimeRef.current < 3000) {
      return
    }
    lastSignModalTimeRef.current = now

    Modal.success({
      title: 'Ký số bệnh án thành công!',
      icon: <CheckCircleOutlined style={{ color: '#16a34a' }} />,
      content: (
        <div>
          <Paragraph style={{ marginBottom: 8 }}>
            Hồ sơ bệnh án đã được Bác sĩ ký số xác nhận hợp lệ (trạng thái: <strong style={{ color: '#0284c7' }}>ĐÃ KÝ SỐ</strong>).
          </Paragraph>
          <Paragraph type="secondary" style={{ marginBottom: 0 }}>
            Bác sĩ có thể tiếp tục rà soát đơn thuốc và bấm nút <strong>"Khóa bệnh án & hoàn tất khám"</strong> để khóa hồ sơ và kết thúc ca khám.
          </Paragraph>
        </div>
      ),
      okText: 'Tiếp tục rà soát đơn thuốc',
    })
  }

  const handlePrintPrescription = (prescription) => {
    if (!canPrintPrescription) {
      message.error('Bạn không có quyền in đơn thuốc (Yêu cầu quyền PRESCRIPTION_PRINT).')
      return
    }
    if (!prescription) return
    setSelectedPrescriptionForPrint(prescription)
    setPrintModalOpen(true)
  }

  const handleSendPrescriptionToInterconnection = async (prescription) => {
    if (!prescription?.id || sendingInterconnectionId) return
    setSendingInterconnectionId(prescription.id)
    try {
      const response = await pharmacyApi.sendToInterconnection(prescription.id)
      const data = response?.data || {}
      setJustIssuedPrescription((prev) => {
        if (prev && String(prev.id) === String(prescription.id)) {
          return {
            ...prev,
            interconnectionStatus: data.status,
            interconnectionReceiptCode: data.receiptCode,
            lastInterconnectionError: data.failureReason,
            lastInterconnectionAt: data.completedAt || new Date().toISOString(),
          }
        }
        return prev
      })
      if (data.status === 'SUCCESS') {
        message.success(
          `Đã gửi đơn thuốc ${prescription.prescriptionCode || ''} lên Cổng liên thông Quốc gia thành công! Mã biên nhận: ${data.receiptCode}`,
        )
      } else {
        message.error(
          `Gửi liên thông đơn ${prescription.prescriptionCode || ''} thất bại: ${data.failureReason || 'Cổng liên thông từ chối tiếp nhận'}`,
        )
      }
      await loadData()
    } catch (error) {
      message.error(getApiMessage(error, 'Không thể gửi đơn thuốc lên Cổng liên thông Quốc gia.'))
    } finally {
      setSendingInterconnectionId(null)
    }
  }

  const historyColumns = [
    {
      title: 'Mã đơn điện tử',
      dataIndex: 'prescriptionCode',
      key: 'prescriptionCode',
      width: 180,
      render: (value, row) => {
        const displayCode = formatPrescriptionCode(value || row.id)
        const isRx = isStandardRxCode(displayCode)
        const isModified = row.updatedAt && row.updatedAt !== row.prescribedAt

        const handleCopy = (e) => {
          e?.stopPropagation()
          if (displayCode && displayCode !== '—') {
            navigator.clipboard.writeText(displayCode)
            message.success(`Đã sao chép mã đơn điện tử: ${displayCode}`)
          }
        }

        return (
          <Space direction="vertical" size={3}>
            <Space size={4} align="center">
              <Tooltip title={isRx ? 'Mã đơn thuốc điện tử chuẩn liên thông quốc gia (Định danh duy nhất không đổi)' : 'Mã đơn thuốc tra cứu'}>
                <Tag
                  color="blue"
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: 'pointer',
                    borderRadius: 4,
                    padding: '2px 8px',
                    letterSpacing: 0.5,
                    border: '1px solid #93c5fd',
                    backgroundColor: '#eff6ff',
                    color: '#1d4ed8',
                  }}
                  onClick={() => openDetailModal(row)}
                >
                  <BarcodeOutlined style={{ marginRight: 4 }} />
                  {displayCode}
                </Tag>
              </Tooltip>
              {displayCode && displayCode !== '—' && (
                <Tooltip title="Sao chép mã đơn">
                  <Button
                    type="text"
                    size="small"
                    icon={<CopyOutlined style={{ color: '#2563eb', fontSize: 13 }} />}
                    onClick={handleCopy}
                    style={{ padding: '0 4px', height: 22, width: 22 }}
                  />
                </Tooltip>
              )}
            </Space>

            <Space size={4} wrap>
              <Tag color="cyan" style={{ fontSize: 10, padding: '0 4px', margin: 0 }}>
                Định danh cố định
              </Tag>
              {isModified && (
                <Tag color="purple" style={{ fontSize: 10, padding: '0 4px', margin: 0 }}>
                  <SyncOutlined spin={false} /> Đã sửa (giữ mã)
                </Tag>
              )}
            </Space>
          </Space>
        )
      },
    },
    {
      title: 'Danh sách thuốc trong đơn',
      dataIndex: 'items',
      key: 'items',
      render: (value = []) => (
        <div>
          {value.slice(0, 3).map((item, idx) => (
            <div key={idx} style={{ marginBottom: 2 }}>
              <Text strong>{item.medicineName}</Text> <Text type="secondary">× {item.quantity} ({item.dosage || 'Theo chỉ định'})</Text>
            </div>
          ))}
          {value.length > 3 && (
            <Text type="secondary" style={{ fontSize: 12, fontStyle: 'italic' }}>
              +{value.length - 3} thuốc khác...
            </Text>
          )}
        </div>
      ),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      width: 150,
      render: (value, row = {}) => {
        if (value === 'PENDING_DISPENSE') {
          return (
            <Tag color="orange" icon={<ClockCircleOutlined />}>
              Chờ cấp phát
            </Tag>
          )
        }
        if (value === 'PARTIALLY_DISPENSED') {
          return (
            <Tag color="gold" icon={<ClockCircleOutlined />} style={{ fontWeight: 600 }}>
              Cấp phát một phần
            </Tag>
          )
        }
        if (value === 'DISPENSED') {
          return (
            <Tag color="green" icon={<CheckCircleOutlined />}>
              Đã cấp phát
            </Tag>
          )
        }
        if (value === 'CANCELLED') {
          return (
            <Tooltip title={row?.cancelReason ? `Lý do hủy: ${row.cancelReason}` : 'Đơn thuốc đã hủy'}>
              <Tag color="default" icon={<CloseCircleOutlined />} style={{ cursor: 'pointer' }}>
                Đã hủy
              </Tag>
            </Tooltip>
          )
        }
        return <Tag>{value}</Tag>
      },
    },
    {
      title: 'Bác sĩ kê / Thời gian',
      key: 'prescribedInfo',
      width: 180,
      render: (_, row) => (
        <div>
          <div><Text strong>{row.doctorName || '—'}</Text></div>
          <div style={{ fontSize: 12, color: '#6b7280' }}>
            {row.prescribedAt ? dayjs(row.prescribedAt).format('HH:mm DD/MM/YYYY') : '—'}
          </div>
        </div>
      ),
    },
    {
      title: 'Liên thông Quốc gia',
      key: 'interconnection',
      width: 175,
      render: (_, row) => {
        const status = row.interconnectionStatus || (row.receiptCode ? 'SUCCESS' : 'NOT_SENT')
        const receiptCode = row.interconnectionReceiptCode || row.receiptCode || ''
        const error = row.lastInterconnectionError || row.failureReason || ''
        const isSending = sendingInterconnectionId === row.id
        const isSuccess = status === 'SUCCESS'
        const isFailed = status === 'FAILED'

        if (isSuccess) {
          return (
            <Space direction="vertical" size={2}>
              <Tag color="success" icon={<CheckCircleOutlined />}>
                Đã liên thông
              </Tag>
              {receiptCode && (
                <Tooltip title="Mã biên nhận từ Cổng liên thông Quốc gia">
                  <Text code style={{ fontSize: 11, color: '#15803d', fontWeight: 600 }}>
                    {receiptCode}
                  </Text>
                </Tooltip>
              )}
            </Space>
          )
        }

        if (isFailed) {
          return (
            <Space direction="vertical" size={2}>
              <Tooltip title={error ? `Lý do lỗi: ${error}` : 'Gửi liên thông không thành công'}>
                <Tag color="error" icon={<CloseCircleOutlined />} style={{ cursor: 'pointer' }}>
                  Liên thông lỗi
                </Tag>
              </Tooltip>
              {canPrescribe && (
                <Button
                  size="small"
                  type="link"
                  icon={<SyncOutlined spin={isSending} />}
                  loading={isSending}
                  onClick={() => handleSendPrescriptionToInterconnection(row)}
                  style={{ padding: 0, height: 'auto', fontSize: 11, color: '#dc2626' }}
                >
                  Gửi lại
                </Button>
              )}
            </Space>
          )
        }

        return (
          <Space direction="vertical" size={2}>
            <Tag color="default" icon={<CloudServerOutlined />}>
              Chưa liên thông
            </Tag>
            {canPrescribe && row.status !== 'CANCELLED' && (
              <Button
                size="small"
                type="link"
                icon={<CloudUploadOutlined />}
                loading={isSending}
                onClick={() => handleSendPrescriptionToInterconnection(row)}
                style={{ padding: 0, height: 'auto', fontSize: 11, color: '#0284c7' }}
              >
                Gửi liên thông
              </Button>
            )}
          </Space>
        )
      },
    },
    {
      title: 'Thao tác',
      key: 'actions',
      width: 90,
      align: 'center',
      render: (_, prescription) => {
        const isPending = prescription.status === 'PENDING_DISPENSE'
        const isPartiallyDispensed = prescription.status === 'PARTIALLY_DISPENSED'
        const isPrintable = Boolean(
          canPrintPrescription &&
          prescription.id &&
          prescription.prescriptionCode &&
          (isPending || isPartiallyDispensed || prescription.status === 'DISPENSED')
        )
        const canEditThis = canPrescribe && isPending
        const isInterconnected = prescription.interconnectionStatus === 'SUCCESS'
        const cancelCheck = canCancelPrescription({
          userRoles: roles,
          userPermissions,
          prescription,
          currentUserId: currentUser?.id,
        })

        const isPharmacistOrAdmin =
          (roles.includes('pharmacist') || roles.includes('admin') || userPermissions.includes('PRESCRIPTION_UPDATE_STATUS')) &&
          !roles.includes('doctor')
        const canViewHistory =
          roles.includes('doctor') ||
          roles.includes('pharmacist') ||
          roles.includes('admin') ||
          roles.includes('manager') ||
          userPermissions.includes('PRESCRIPTION_DISPENSE_HISTORY_READ')

        const canPartialDispense = isPharmacistOrAdmin && (isPending || isPartiallyDispensed)
        const canSeeHistory = canViewHistory && (isPartiallyDispensed || prescription.status === 'DISPENSED')

        const menuItems = [
          {
            key: 'detail',
            icon: <EyeOutlined />,
            label: 'Xem chi tiết đơn thuốc',
            onClick: () => openDetailModal(prescription),
          },
          canPartialDispense && {
            key: 'partial-dispense',
            icon: <MedicineBoxOutlined style={{ color: '#d97706' }} />,
            label: 'Cấp phát một phần',
            onClick: () => {
              setSelectedPrescriptionForPartial(prescription)
              setPartialModalOpen(true)
            },
          },
          canSeeHistory && {
            key: 'dispense-history',
            icon: <HistoryOutlined style={{ color: '#1677ff' }} />,
            label: 'Xem lịch sử cấp phát',
            onClick: () => {
              setSelectedPrescriptionForHistory(prescription)
              setHistoryModalOpen(true)
            },
          },
          isPharmacistOrAdmin && (prescription.status === 'DISPENSED' || isPartiallyDispensed) && {
            key: 'return-medication',
            icon: <RollbackOutlined style={{ color: '#dc2626' }} />,
            label: 'Trả lại thuốc / Hủy cấp phát',
            danger: true,
            onClick: () => {
              setSelectedPrescriptionForReturn(prescription)
              setReturnModalOpen(true)
            },
          },
          canPrescribe && prescription.status !== 'CANCELLED' && {
            key: 'interconnection',
            icon: <CloudUploadOutlined style={{ color: '#0284c7' }} />,
            label: isInterconnected ? 'Xem trạng thái liên thông' : 'Gửi lên Cổng liên thông',
            onClick: () => {
              if (!isInterconnected) {
                handleSendPrescriptionToInterconnection(prescription)
              } else {
                openDetailModal(prescription)
              }
            },
          },
          isPrintable && {
            key: 'print',
            icon: <PrinterOutlined />,
            label: 'In đơn thuốc',
            onClick: () => handlePrintPrescription(prescription),
          },
          canEditThis && {
            key: 'edit',
            icon: <EditOutlined />,
            label: 'Điều chỉnh đơn thuốc',
            onClick: () => startEditPrescription(prescription),
          },
          // TC-04: Chỉ bác sĩ đã kê đơn mới có thao tác hủy đơn chưa cấp phát
          cancelCheck.allowed && isPending && {
            type: 'divider',
          },
          cancelCheck.allowed && isPending && {
            key: 'cancel',
            icon: <StopOutlined />,
            danger: true,
            label: 'Hủy đơn thuốc này',
            onClick: () => handleOpenCancelModal(prescription),
          },
          roles.includes('doctor') && (prescription.status === 'DISPENSED' || isPartiallyDispensed) && (prescription.prescribedBy ? String(prescription.prescribedBy).toLowerCase().replace(/-/g, '') === String(user?.id).toLowerCase().replace(/-/g, '') : true) && {
            key: 'cancel-dispensed',
            icon: <StopOutlined style={{ color: '#94a3b8' }} />,
            disabled: true,
            label: (
              <Tooltip title="Đơn thuốc đã được xuất cấp phát tại quầy dược. Không thể hủy đơn trực tiếp.">
                <span>Hủy đơn (Đã cấp thuốc)</span>
              </Tooltip>
            ),
          },
        ].filter(Boolean)

        return (
          <Dropdown menu={{ items: menuItems }} trigger={['click']} placement="bottomRight">
            <Button size="small" icon={<EllipsisOutlined />} title="Thao tác" />
          </Dropdown>
        )
      },
    },
  ]

  if (!medicalRecordId) {
    return (
      <Card>
        <Alert
          type="warning"
          showIcon
          message="Chưa có bệnh án để kê đơn"
          description={
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span>Màn kê đơn chỉ mở từ một lượt khám đã lưu.</span>
              <span>Phải có mã bệnh án trên đường dẫn để tiếp tục.</span>
            </div>
          }
          action={<Button type="primary" onClick={() => navigate('/appointments')}>Về danh sách lượt khám</Button>}
        />
      </Card>
    )
  }

  const queueStatusLabel = {
    WAITING: 'Chờ khám',
    IN_PROGRESS: 'Đang khám',
    WAITING_FOR_RESULT: 'Chờ kết quả CĐLS',
    COMPLETED: 'Đã hoàn tất',
    SKIPPED: 'Đã bỏ qua',
  }[encounter?.queueItem?.status] || encounter?.queueItem?.status || 'Chưa xác định'

  const recordStatusLabel = recordLocked
    ? 'Đã khóa hồ sơ'
    : (record?.status === 'SIGNED'
      ? 'Đã ký số (Chờ khóa)'
      : (record?.status === 'DRAFT' ? 'Chưa ký số (Bản nháp)' : (record?.status ? `Chưa ký số (${record.status})` : 'Chưa ký số')))

  return (
    <div style={{ paddingBottom: 40 }}>
      {loadError && (
        <Alert
          type="warning"
          showIcon
          closable
          onClose={() => setLoadError(null)}
          message="Thông báo đồng bộ"
          description={loadError.message}
          style={{ marginBottom: 16 }}
        />
      )}
      {/* Thanh điều hướng quay lại gọn gàng */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <Button
          type="text"
          size="small"
          icon={<ArrowLeftOutlined />}
          onClick={() => {
            if (targetVisitId) {
              navigate(`/medical-records/visits/${targetVisitId}`)
            } else {
              navigate('/appointments')
            }
          }}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            borderRadius: 6,
            background: '#F1F5F9',
            color: '#1E293B',
            fontWeight: 500,
            fontSize: 13,
            padding: '2px 10px',
          }}
        >
          Quay lại Khám bệnh
        </Button>
        <span style={{ color: '#CBD5E1' }}>•</span>
        <Button
          type="text"
          size="small"
          icon={<UnorderedListOutlined />}
          onClick={() => navigate('/appointments')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            borderRadius: 6,
            color: '#64748B',
            fontSize: 13,
            padding: '2px 8px',
          }}
        >
          Hàng đợi khám
        </Button>
      </div>

      <div
        className="page-header"
        style={{
          marginBottom: 16,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <Title level={3} style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <MedicineBoxOutlined style={{ color: '#2563eb' }} />
            {editingPrescription ? (
              <span>
                Điều chỉnh Đơn thuốc <Text code style={{ color: '#2563eb', fontSize: 20 }}>{editingPrescription.prescriptionCode}</Text>
              </span>
            ) : (
              'Kê đơn thuốc theo bệnh án'
            )}
          </Title>
        </div>
        <Space wrap size="middle" className="prescription-header-actions">
          {editingPrescription && (
            <Button icon={<RollbackOutlined />} onClick={cancelEditMode}>
              Hủy điều chỉnh
            </Button>
          )}
          {canPrescribe && (
            <Tooltip title={!canSubmit ? submitStatus.reason : ''}>
              <Button
                type="primary"
                loading={saving || checkingInteractions || checkingAllergies}
                disabled={!canSubmit}
                icon={<CheckCircleOutlined />}
                onClick={handleSaveClick}
                style={{ fontWeight: 600 }}
              >
                {editingPrescription ? 'Lưu điều chỉnh đơn thuốc' : 'Tạo đơn thuốc'}
              </Button>
            </Tooltip>
          )}
          {isDoctor && !recordLocked && !editingPrescription && (
            <>
              {/* Nút 1: Ký số bệnh án */}
              <Tooltip title={isRecordSigned ? 'Bệnh án đã được ký số hợp lệ (Bấm để xem chứng thư)' : 'Mở hộp thoại ký số xác nhận bệnh án điện tử'}>
                <Button
                  type={!isRecordSigned ? 'primary' : 'default'}
                  icon={isRecordSigned ? <CheckCircleOutlined style={{ color: '#16a34a' }} /> : <EditOutlined />}
                  loading={finalizing}
                  disabled={Boolean(prescriptionBlockReason)}
                  onClick={() => setSignModalOpen(true)}
                  style={{
                    fontWeight: 700,
                    ...(isRecordSigned
                      ? { color: '#15803d', borderColor: '#86efac', background: '#f0fdf4' }
                      : { background: '#0284c7', borderColor: '#0284c7', boxShadow: '0 2px 6px rgba(2, 132, 199, 0.3)' }
                    ),
                  }}
                >
                  {isRecordSigned ? 'Đã ký số' : 'Ký số bệnh án'}
                </Button>
              </Tooltip>

              {/* Nút 2: Khóa bệnh án */}
              <Tooltip
                title={
                  !isRecordSigned
                    ? 'Bệnh án cần được Ký số xác nhận trước khi Khóa'
                    : 'Khóa hồ sơ bệnh án và hoàn tất lượt khám'
                }
              >
                <span>
                  <Button
                    danger={isRecordSigned}
                    type="primary"
                    icon={<LockOutlined />}
                    loading={finalizing}
                    disabled={Boolean(prescriptionBlockReason) || !isRecordSigned}
                    onClick={finalizeEncounter}
                    style={{
                      fontWeight: 700,
                      ...(isRecordSigned
                        ? { background: '#dc2626', borderColor: '#dc2626', boxShadow: '0 2px 6px rgba(220, 38, 38, 0.3)' }
                        : {}
                      ),
                    }}
                  >
                    Khóa bệnh án
                  </Button>
                </span>
              </Tooltip>
            </>
          )}
        </Space>
      </div>

      <Card style={{ marginBottom: 16, borderRadius: 8 }}>
        <Descriptions bordered size="small" column={{ xs: 1, sm: 2, lg: 4 }}>
          <Descriptions.Item label="Mã bệnh án">
            {medicalRecordId ? (
              <Space size={4} align="center">
                <Tag
                  color="geekblue"
                  style={{
                    fontFamily: 'monospace',
                    fontWeight: 700,
                    fontSize: 12,
                    padding: '1px 8px',
                    borderRadius: 4,
                    margin: 0,
                  }}
                >
                  {formatRecordCode(medicalRecordId)}
                </Tag>
                <Tooltip title={`Mã UUID đầy đủ: ${medicalRecordId}`}>
                  <Typography.Text
                    copyable={{
                      text: String(medicalRecordId),
                      tooltips: ['Sao chép mã UUID', 'Đã sao chép!'],
                    }}
                    type="secondary"
                    style={{ fontSize: 11 }}
                  />
                </Tooltip>
              </Space>
            ) : (
              '—'
            )}
          </Descriptions.Item>
          <Descriptions.Item label="Mã lượt khám">
            <Space size={4} align="center">
              <Tag
                color="blue"
                style={{
                  fontFamily: 'monospace',
                  fontWeight: 700,
                  fontSize: 12,
                  padding: '1px 8px',
                  borderRadius: 4,
                  margin: 0,
                }}
              >
                {formatVisitCode(encounter?.visit?.visitCode, record?.visitId)}
              </Tag>
              {(encounter?.visit?.visitCode || record?.visitId) && (
                <Tooltip title={`Mã lượt khám đầy đủ: ${encounter?.visit?.visitCode || record?.visitId}`}>
                  <Typography.Text
                    copyable={{
                      text: String(encounter?.visit?.visitCode || record?.visitId),
                      tooltips: ['Sao chép mã', 'Đã sao chép!'],
                    }}
                    type="secondary"
                    style={{ fontSize: 11 }}
                  />
                </Tooltip>
              )}
            </Space>
          </Descriptions.Item>
          <Descriptions.Item label="Bệnh nhân">
            <Text strong>{encounter?.patient?.fullName || record?.patientName || '—'}</Text> ({encounter?.patient?.patientCode || record?.patientCode || 'BN'})
          </Descriptions.Item>
          <Descriptions.Item label="Bác sĩ phụ trách">{encounter?.doctor?.fullName || record?.doctorName || '—'}</Descriptions.Item>
          <Descriptions.Item label="Chẩn đoán chính" span={2}>
            <Text strong style={{ color: '#1e40af' }}>{diagnosisSummary}</Text>
          </Descriptions.Item>
          <Descriptions.Item label="Tiền sử dị ứng" span={2}>
            {patientAllergies.filter((a) => a.active !== false).length > 0 ? (
              <Space size={6} wrap>
                {patientAllergies
                  .filter((a) => a.active !== false)
                  .map((a) => (
                    <Tag
                      key={a.id || a.allergenName}
                      color={a.severity === 'ANAPHYLAXIS' ? '#b91c1c' : 'red'}
                      style={{ fontWeight: 700, fontSize: 13, padding: '2px 8px' }}
                    >
                      <FireOutlined style={{ marginRight: 4 }} />
                      {a.allergenName}
                    </Tag>
                  ))}
              </Space>
            ) : (
              <Tag color="success" style={{ fontWeight: 600, fontSize: 12 }}>
                <CheckCircleOutlined /> Chưa ghi nhận
              </Tag>
            )}
          </Descriptions.Item>
          <Descriptions.Item label="Hàng đợi / STT">
            {encounter?.queueItem ? (
              <Space size={4} align="center">
                <Tag color="blue" style={{ fontWeight: 700, borderRadius: 10 }}>
                  STT #{encounter.queueItem.queueNumber || 1}
                </Tag>
                {encounter.queueItem.id && (
                  <Tooltip title={`Mã hàng đợi đầy đủ: ${encounter.queueItem.id}`}>
                    <Typography.Text
                      type="secondary"
                      copyable={{
                        text: String(encounter.queueItem.id),
                        tooltips: ['Sao chép mã', 'Đã sao chép!'],
                      }}
                      style={{ fontSize: 11, fontFamily: 'monospace' }}
                    >
                      #{String(encounter.queueItem.id).slice(0, 8)}
                    </Typography.Text>
                  </Tooltip>
                )}
              </Space>
            ) : (
              '—'
            )}
          </Descriptions.Item>
          <Descriptions.Item label="Trạng thái lượt khám">
            <Tag color={encounter?.queueItem?.status === 'IN_PROGRESS' ? 'processing' : (encounter?.queueItem?.status === 'WAITING_FOR_RESULT' ? 'warning' : 'default')}>
              {queueStatusLabel}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Trạng thái bệnh án">
            <Tag
              color={recordLocked ? 'green' : (record?.status === 'SIGNED' ? 'cyan' : 'orange')}
              icon={recordLocked ? <LockOutlined /> : (record?.status === 'SIGNED' ? <CheckCircleOutlined /> : <WarningOutlined />)}
              style={{ fontWeight: 600 }}
            >
              {recordStatusLabel}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Số đơn thuốc hiện có">
            <Badge count={prescriptions.length} showZero color="#2563eb" />
          </Descriptions.Item>
        </Descriptions>
      </Card>

      {/* Banner tiền sử dị ứng thuốc - Hiển thị nổi bật ở đầu bệnh án của mọi lượt khám */}
      <PatientAllergyBanner
        patientId={encounter?.patient?.id || record?.patientId || routeState.patient?.id || routeState.encounter?.patient?.id}
        patientName={encounter?.patient?.fullName || record?.patientName || routeState.patient?.fullName || routeState.encounter?.patient?.fullName}
        visitId={targetVisitId}
        allergies={patientAllergies}
        onAllergiesChange={setPatientAllergies}
        currentUser={currentUser}
        onOpenLogs={() => setAllergyLogsModalOpen(true)}
        compact={false}
      />

      {/* Banner tiền sử bệnh mạn tính - Căn cứ bắt buộc cho chẩn đoán & cảnh báo chống chỉ định thuốc */}
      {(encounter?.patient?.id || record?.patientId || routeState.patient?.id || routeState.encounter?.patient?.id) && (
        <PatientChronicDiseaseBanner
          patientId={encounter?.patient?.id || record?.patientId || routeState.patient?.id || routeState.encounter?.patient?.id}
          patientName={encounter?.patient?.fullName || record?.patientName || routeState.patient?.fullName || routeState.encounter?.patient?.fullName}
          visitId={targetVisitId}
          currentUser={currentUser}
          doctorName={encounter?.doctor?.fullName || record?.doctorName || currentUser?.fullName}
          compact={false}
        />
      )}

      {prescriptionBlockReason && (
        <Alert
          type={encounter?.queueItem?.status === 'WAITING_FOR_RESULT' ? 'warning' : 'error'}
          showIcon
          message="Tạm khóa thao tác kê đơn và hoàn tất lượt khám"
          description={prescriptionBlockReason}
          action={<Button onClick={loadData}>Tải lại trạng thái</Button>}
          style={{ marginBottom: 16 }}
        />
      )}

      {!isAssignedDoctor && (
        <Alert
          type="warning"
          showIcon
          message="Bạn không phải bác sĩ phụ trách lượt khám này"
          description="Hệ thống chỉ cho phép bác sĩ phụ trách lượt khám thực hiện kê đơn và điều chỉnh đơn thuốc."
          style={{ marginBottom: 16 }}
        />
      )}
      {!diagnoses.length && (
        <Alert type="error" showIcon message="Bệnh án chưa có chẩn đoán" style={{ marginBottom: 16 }} />
      )}
      {!recordLocked && !isRecordSigned && (
        <Alert
          type="info"
          showIcon
          icon={<InfoCircleOutlined />}
          message="Bệnh án đang chờ Ký số xác nhận"
          description={
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
              <span>
                Hồ sơ bệnh án hiện tại đang ở trạng thái <strong>Bản nháp</strong>. Bác sĩ cần thực hiện <strong>Ký số bệnh án</strong> trước, sau đó mới có thể thực hiện Khóa bệnh án để hoàn tất ca khám.
              </span>
              <Space wrap size="small">
                <Tooltip title={prescriptionBlockReason || ''}>
                  <span>
                    <Button
                      size="small"
                      type="primary"
                      icon={<EditOutlined />}
                      disabled={Boolean(prescriptionBlockReason)}
                      onClick={() => setSignModalOpen(true)}
                      style={{
                        fontWeight: 600,
                        ...(!prescriptionBlockReason
                          ? { background: '#0284c7', borderColor: '#0284c7' }
                          : {}),
                      }}
                    >
                      Ký số bệnh án ngay
                    </Button>
                  </span>
                </Tooltip>
                {targetVisitId && (
                  <Button
                    size="small"
                    type="default"
                    icon={<ArrowLeftOutlined />}
                    onClick={() => navigate(`/medical-records/visits/${targetVisitId}`)}
                    style={{ fontWeight: 500 }}
                  >
                    Xem lại chi tiết tại màn Khám bệnh
                  </Button>
                )}
              </Space>
            </div>
          }
          style={{ marginBottom: 16 }}
        />
      )}
      {isRecordSigned && !recordLocked && (
        <Alert
          type="success"
          showIcon
          icon={<CheckCircleOutlined style={{ color: '#16a34a' }} />}
          message="Bệnh án đã được Ký số thành công — Sẵn sàng để Khóa hồ sơ"
          description={
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
              <span>
                Hồ sơ đã được lưu chữ ký điện tử hợp lệ (<strong>ĐÃ KÝ SỐ</strong>). Sau khi hoàn tất kê đơn và kiểm tra thuốc, bác sĩ bấm nút <strong>"Khóa bệnh án & hoàn tất khám"</strong> để khóa hồ sơ và kết thúc ca khám.
              </span>
              <Button
                type="primary"
                danger
                size="small"
                icon={<LockOutlined />}
                loading={finalizing}
                onClick={finalizeEncounter}
                style={{ fontWeight: 600 }}
              >
                Khóa bệnh án & hoàn tất khám
              </Button>
            </div>
          }
          style={{ marginBottom: 16, background: '#f0fdf4', borderColor: '#bbf7d0' }}
        />
      )}
      {recordLocked && (
        <Alert
          type="info"
          showIcon
          icon={<LockOutlined />}
          message="Bệnh án đã được khóa; không thể sửa đổi đơn thuốc."
          style={{ marginBottom: 16 }}
        />
      )}

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        type="card"
        items={[
          {
            key: 'prescribe',
            label: (
              <span>
                {editingPrescription ? <EditOutlined /> : <PlusOutlined />}
                {editingPrescription ? ` Điều chỉnh đơn: ${editingPrescription.prescriptionCode}` : ' Kê đơn thuốc mới'}
              </span>
            ),
            children: (
              <div>
                {editingPrescription && (
                  <Alert
                    type="info"
                    showIcon
                    icon={<EditOutlined style={{ fontSize: 18 }} />}
                    message={
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                        <span>
                          <strong>ĐANG ĐIỀU CHỈNH ĐƠN THUỐC: {editingPrescription.prescriptionCode}</strong> — Trạng thái: <Tag color="orange">Chờ cấp phát (PENDING_DISPENSE)</Tag>
                        </span>
                        <Button size="small" onClick={cancelEditMode}>Hủy điều chỉnh</Button>
                      </div>
                    }
                    description="Bác sĩ có thể sửa liều lượng, tần suất, cách dùng, số lượng, hướng dẫn; bấm '+ Thêm thuốc mới' để bổ sung hoặc bấm biểu tượng thùng rác để bỏ thuốc không còn phù hợp khỏi đơn. Mọi thay đổi đều được hệ thống tự động lưu vết lịch sử (audit snapshot)."
                    style={{ marginBottom: 16, backgroundColor: '#eff6ff', borderColor: '#bfdbfe' }}
                  />
                )}

                <Card
                  title={
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>
                        <MedicineBoxOutlined style={{ color: '#2563eb', marginRight: 8 }} />
                        {editingPrescription
                          ? `Danh sách thuốc điều chỉnh (${items.length} loại thuốc)`
                          : `Thuốc trong đơn (${items.length} loại thuốc)`}
                      </span>
                      {editingPrescription && (
                        <Tag color="blue">Đơn gốc kê lúc: {dayjs(editingPrescription.prescribedAt).format('HH:mm DD/MM/YYYY')}</Tag>
                      )}
                    </div>
                  }
                >
                  {activeAllergyWarnings.length > 0 && (
                    <Alert
                      type="error"
                      showIcon
                      icon={<FireOutlined style={{ fontSize: 20, color: '#dc2626' }} />}
                      message={
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                          <Text strong style={{ fontSize: 15, color: '#991b1b' }}>
                            CẢNH BÁO NGUY CƠ DỊ ỨNG THUỐC / SỐC PHẢN VỆ: PHÁT HIỆN {activeAllergyWarnings.length} THUỐC TRÙNG TIỀN SỬ DỊ ỨNG!
                          </Text>
                          {areAllAllergiesHandled(activeAllergyWarnings, confirmedAllergyOverrides) ? (
                            <Tag color="green" icon={<CheckCircleOutlined />}>
                              Đã nhập lý do lâm sàng bỏ qua
                            </Tag>
                          ) : (
                            <Button
                              danger
                              type="primary"
                              size="small"
                              onClick={() => setAllergyModalOpen(true)}
                            >
                              Xem cảnh báo & Nhập lý do bỏ qua
                            </Button>
                          )}
                        </div>
                      }
                      description={
                        <div style={{ marginTop: 6 }}>
                          <div>Đơn thuốc đang kê có chứa hoạt chất/nhóm thuốc mà bệnh nhân có tiền sử dị ứng đã ghi nhận trong hồ sơ:</div>
                          <ul style={{ margin: '8px 0 0 18px', padding: 0 }}>
                            {activeAllergyWarnings.map((c, idx) => (
                              <li key={idx} style={{ marginBottom: 4 }}>
                                <Text strong>{c.medicineName || 'Thuốc'}:</Text> Dị ứng với <Tag color="red">{c.allergenName}</Tag> - Mức độ:{' '}
                                <Text type="danger" strong>{c.severity || 'Cảnh báo'}</Text> {c.reaction ? `(${c.reaction})` : ''}
                              </li>
                            ))}
                          </ul>
                          <div style={{ marginTop: 6, fontWeight: 600, color: '#b91c1c' }}>
                            Khuyến cáo: Bác sĩ nên thay thế bằng nhóm thuốc an toàn khác để ngăn ngừa phản vệ đe dọa tính mạng người bệnh.
                          </div>
                        </div>
                      }
                      style={{ marginBottom: 16, border: '2px solid #ef4444', backgroundColor: '#fef2f2', borderRadius: 8 }}
                    />
                  )}

                  {items.map((item, index) => {
                    const selectedMed = selectedMedicineMap.get(String(item.medicineId))
                    const unit = selectedMed?.unit || 'viên'
                    const isComplete = Boolean(
                      item.medicineId &&
                      item.dosage?.trim() &&
                      item.frequency &&
                      Number(item.frequency) > 0 &&
                      item.route &&
                      item.durationDays &&
                      Number(item.durationDays) > 0 &&
                      item.quantity &&
                      Number(item.quantity) > 0,
                    )

                    return (
                      <Card
                        key={item.clientId}
                        size="small"
                        style={{
                          marginBottom: 16,
                          borderRadius: 8,
                          border: isComplete ? '1px solid #BFDBFE' : '1px solid #E2E8F0',
                          borderLeft: isComplete ? '4px solid #2563EB' : '4px solid #F59E0B',
                          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
                          backgroundColor: item.isOriginal ? '#ffffff' : '#fafafa',
                        }}
                      >
                        {/* Header của thẻ thuốc */}
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            paddingBottom: 10,
                            marginBottom: 14,
                            borderBottom: '1px solid #F1F5F9',
                            flexWrap: 'wrap',
                            gap: 8,
                          }}
                        >
                          <Space size={8} wrap align="center">
                            <Tag
                              color={isComplete ? 'blue' : 'gold'}
                              style={{
                                fontWeight: 700,
                                fontSize: 13,
                                padding: '2px 10px',
                                borderRadius: 12,
                                margin: 0,
                              }}
                            >
                              Thuốc #{index + 1}
                            </Tag>

                            {isComplete ? (
                              <Tag color="success" icon={<CheckCircleOutlined />} style={{ borderRadius: 12, margin: 0 }}>
                                Đầy đủ thông tin
                              </Tag>
                            ) : (
                              <Tag color="warning" icon={<ExclamationCircleOutlined />} style={{ borderRadius: 12, margin: 0 }}>
                                Chưa đủ trường bắt buộc
                              </Tag>
                            )}

                            {editingPrescription && (
                              <Tag color={item.isOriginal ? 'default' : 'cyan'} style={{ borderRadius: 12, margin: 0 }}>
                                {item.isOriginal ? 'Thuốc trong đơn gốc' : 'Thuốc thêm mới'}
                              </Tag>
                            )}

                            {(() => {
                              const itemWarning = activeAllergyWarnings.find(
                                (w) => String(w.medicineId) === String(item.medicineId),
                              )
                              if (!itemWarning) return null
                              const isHandled = isAllergyHandled(itemWarning, confirmedAllergyOverrides)
                              const isLifeThreatening =
                                String(itemWarning.severity).toUpperCase() === 'ANAPHYLAXIS' ||
                                String(itemWarning.severity).toUpperCase() === 'SEVERE'
                              return (
                                <Tag
                                  icon={
                                    <FireOutlined
                                      style={{
                                        color: isHandled ? '#15803d' : '#ffffff',
                                        fontSize: 13,
                                        marginRight: 4,
                                      }}
                                    />
                                  }
                                  style={{
                                    fontWeight: 700,
                                    fontSize: 13,
                                    padding: '4px 12px',
                                    borderRadius: 14,
                                    margin: 0,
                                    cursor: 'pointer',
                                    backgroundColor: isHandled
                                      ? '#f0fdf4'
                                      : isLifeThreatening
                                      ? '#dc2626'
                                      : '#ea580c',
                                    borderColor: isHandled
                                      ? '#86efac'
                                      : isLifeThreatening
                                      ? '#991b1b'
                                      : '#c2410c',
                                    borderWidth: '1.5px',
                                    borderStyle: 'solid',
                                    color: isHandled ? '#15803d' : '#ffffff',
                                    boxShadow: isLifeThreatening && !isHandled ? '0 2px 6px rgba(220, 38, 38, 0.35)' : undefined,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                  }}
                                  onClick={() => setAllergyModalOpen(true)}
                                  title="Bấm để mở hộp thoại xem hoặc nhập lý do bỏ qua cảnh báo dị ứng"
                                >
                                  <span style={{ color: isHandled ? '#15803d' : '#ffffff', fontWeight: 700 }}>
                                    {isLifeThreatening ? '🚨 NGUY CƠ SỐC PHẢN VỆ' : '⚠️ CẢNH BÁO DỊ ỨNG'}: {itemWarning.allergenName} ({itemWarning.severity || 'Dị ứng'})
                                    {isHandled ? ' [Đã nhập lý do]' : ' [Cần nhập lý do]'}
                                  </span>
                                </Tag>
                              )
                            })()}

                            {selectedMed && (() => {
                              const avail = getAvailableStock(selectedMed)
                              if (avail <= 0) {
                                return (
                                  <Tag
                                    color="warning"
                                    icon={<WarningOutlined />}
                                    style={{
                                      borderRadius: 12,
                                      margin: 0,
                                      backgroundColor: '#FEF3C7',
                                      color: '#92400E',
                                      borderColor: '#FCD34D',
                                    }}
                                  >
                                    Hết hàng — Dược sĩ sẽ cấp bù sau (Tồn: 0 {unit})
                                  </Tag>
                                )
                              }
                              if (item.quantity > avail) {
                                return (
                                  <Tag
                                    color="orange"
                                    icon={<WarningOutlined />}
                                    style={{
                                      borderRadius: 12,
                                      margin: 0,
                                      backgroundColor: '#FFF7ED',
                                      color: '#C2410C',
                                      borderColor: '#FDBA74',
                                    }}
                                  >
                                    Tồn kho không đủ ({avail}/{item.quantity} {unit}) — Sẽ cấp phát một phần
                                  </Tag>
                                )
                              }
                              return (
                                <Text type="secondary" style={{ fontSize: 12 }}>
                                  (Tồn khả dụng: <strong style={{ color: '#16a34a' }}>{avail}</strong> {unit})
                                </Text>
                              )
                            })()}
                          </Space>

                          <Tooltip title={items.length <= 1 ? 'Đơn thuốc phải có ít nhất 1 thuốc' : 'Bỏ thuốc này khỏi đơn'}>
                            <Button
                              danger
                              type="text"
                              size="small"
                              icon={<DeleteOutlined />}
                              disabled={!canPrescribe || items.length <= 1 || checkingInteractions || saving}
                              onClick={() => handleRemoveItem(item.clientId)}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                backgroundColor: '#FEF2F2',
                                border: '1px solid #FEE2E2',
                                borderRadius: 6,
                                padding: '2px 10px',
                                fontWeight: 500,
                              }}
                            >
                              Bỏ thuốc
                            </Button>
                          </Tooltip>
                        </div>

                        {/* Hàng 1: Thuốc & Đường dùng */}
                        <Row gutter={[12, 12]} style={{ marginBottom: 12 }}>
                          <Col xs={24} md={16}>
                            <Form.Item
                              label={<span style={{ fontWeight: 600, color: '#334155' }}>Thuốc & Hoạt chất <span style={{ color: '#ef4444' }}>*</span></span>}
                              style={{ marginBottom: 0 }}
                            >
                              <Select
                                showSearch
                                style={{ width: '100%' }}
                                optionFilterProp="label"
                                disabled={!canPrescribe || checkingInteractions || saving}
                                value={item.medicineId}
                                onChange={(value) => handleItemChange(item.clientId, 'medicineId', value)}
                                options={sortedMedicines.map((medicine) => {
                                  const availStock = getAvailableStock(medicine)
                                  const isOut = availStock <= 0
                                  const medConflict = checkPrescriptionAllergyConflict(medicine, patientAllergies)
                                  const allergyPrefix = medConflict.hasConflict
                                    ? `[⚠️ DỊ ỨNG${medConflict.isLifeThreatening ? ' - SỐC PHẢN VỆ' : ''}] `
                                    : ''
                                  const specialPrefix = medicine.isSpecialControl ? '[KSĐB] ' : ''
                                  return {
                                    value: medicine.id,
                                    disabled: false,
                                    label: isOut
                                      ? `${specialPrefix}${allergyPrefix}${medicine.medicineName} — ${medicine.strength ? `${medicine.strength} ` : ''}— [Hết hàng — cấp bù sau]`
                                      : `${specialPrefix}${allergyPrefix}${medicine.medicineName} — ${medicine.strength ? `${medicine.strength} ` : ''}— Còn ${availStock} ${medicine.unit || 'viên'}`,
                                  }
                                })}
                                placeholder="Tìm kiếm thuốc theo tên hoặc hoạt chất..."
                              />
                            </Form.Item>
                          </Col>

                          <Col xs={24} md={8}>
                            <Form.Item
                              label={<span style={{ fontWeight: 600, color: '#334155' }}>Đường dùng <span style={{ color: '#ef4444' }}>*</span></span>}
                              style={{ marginBottom: 0 }}
                            >
                              <Select
                                style={{ width: '100%' }}
                                disabled={!canPrescribe || checkingInteractions || saving}
                                value={item.route}
                                onChange={(value) => handleItemChange(item.clientId, 'route', value)}
                                options={ROUTE_OPTIONS}
                                placeholder="Chọn đường dùng..."
                              />
                            </Form.Item>
                          </Col>
                        </Row>

                        {selectedMed && (
                          <div
                            style={{
                              background: '#F8FAFC',
                              border: '1px solid #E2E8F0',
                              padding: '6px 12px',
                              borderRadius: 6,
                              marginBottom: 12,
                              display: 'flex',
                              flexWrap: 'wrap',
                              gap: 8,
                              alignItems: 'center',
                              fontSize: 12,
                            }}
                          >
                            <span style={{ color: '#64748B', fontWeight: 500 }}>Quy cách:</span>
                            <Tag color="blue" style={{ margin: 0, borderRadius: 4 }}>
                              Hàm lượng: <strong>{selectedMed.strength || 'Theo quy cách'}</strong>
                            </Tag>
                            <Tag color="cyan" style={{ margin: 0, borderRadius: 4 }}>
                              Hoạt chất: <strong>{selectedMed.activeIngredient || selectedMed.medicineName}</strong>
                            </Tag>
                            <Tag color="purple" style={{ margin: 0, borderRadius: 4 }}>
                              Đơn vị tính: <strong>{selectedMed.unit || 'viên'}</strong>
                            </Tag>
                            {(() => {
                              const avail = getAvailableStock(selectedMed)
                              return (
                                <Tag color={avail > 0 ? 'green' : 'red'} style={{ margin: 0, borderRadius: 4 }}>
                                  Tồn khả dụng: <strong>{avail} {selectedMed.unit || 'viên'}</strong>
                                </Tag>
                              )
                            })()}
                          </div>
                        )}

                        {selectedMed?.isSpecialControl && (
                          <div
                            style={{
                              background: '#FFFBEB',
                              border: '1px solid #FDE68A',
                              padding: '8px 12px',
                              borderRadius: 6,
                              marginBottom: 12,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              flexWrap: 'wrap',
                              gap: 8,
                            }}
                          >
                            <Space size={8} wrap align="center">
                              <SpecialControlBadge
                                isSpecialControl={true}
                                group={selectedMed.specialControlGroup}
                              />
                              {selectedMed.specialControlNote && (
                                <Text type="secondary" style={{ fontSize: 12 }}>
                                  <strong>Cảnh báo danh mục:</strong> {selectedMed.specialControlNote}
                                </Text>
                              )}
                              {item.specialControlReason && (
                                <Text style={{ fontSize: 12, color: '#92400E' }}>
                                  <strong>Lý do chỉ định:</strong> {item.specialControlReason}
                                </Text>
                              )}
                            </Space>
                            <Button
                              size="small"
                              type="link"
                              onClick={() => handleEditSpecialControlReason(item)}
                              style={{ padding: 0, height: 'auto', fontWeight: 600, color: '#D97706' }}
                            >
                              {item.specialControlReason ? 'Sửa lý do chỉ định' : 'Xác nhận lý do ngay'}
                            </Button>
                          </div>
                        )}

                        {(() => {
                          const itemAllergyConflict = detectedAllergyConflicts.find((c) => c.itemIndex === index)
                          if (!itemAllergyConflict) return null
                          return (
                            <Alert
                              type="error"
                              showIcon
                              icon={<FireOutlined style={{ fontSize: 18, color: '#dc2626' }} />}
                              message={
                                <Text strong style={{ color: itemAllergyConflict.isLifeThreatening ? '#7f1d1d' : '#991b1b', fontSize: 13 }}>
                                  {itemAllergyConflict.isLifeThreatening ? '🚨 CẢNH BÁO SỐC PHẢN VỆ / ĐE DỌA TÍNH MẠNG' : 'CẢNH BÁO DỊ ỨNG THUỐC ĐÃ BIẾT'}
                                </Text>
                              }
                              description={
                                <div style={{ fontSize: 12 }}>
                                  <div>{itemAllergyConflict.warningMessage}</div>
                                  {itemAllergyConflict.matchedAllergy?.notes && (
                                    <div style={{ marginTop: 2, color: '#4b5563' }}>
                                      <strong>Ghi chú tiền sử:</strong> {itemAllergyConflict.matchedAllergy.notes}
                                    </div>
                                  )}
                                </div>
                              }
                              style={{
                                marginBottom: 12,
                                borderRadius: 6,
                                border: '1.5px solid #ef4444',
                                backgroundColor: '#fef2f2',
                              }}
                            />
                          )
                        })()}

                        {/* Hàng 2: Liều dùng, Tần suất, Số ngày & Tổng số lượng (cân đối 4 cột) */}
                        <Row gutter={[12, 12]} style={{ marginBottom: 12 }}>
                          <Col xs={24} sm={12} md={6}>
                            <Form.Item
                              label={<span style={{ fontWeight: 600, color: '#334155' }}>Liều dùng / lần <span style={{ color: '#ef4444' }}>*</span></span>}
                              style={{ marginBottom: 0 }}
                            >
                              <Input
                                disabled={!canPrescribe || checkingInteractions || saving}
                                value={item.dosage}
                                onChange={(event) => handleItemChange(item.clientId, 'dosage', event.target.value)}
                                placeholder={`VD: 1 ${unit}`}
                              />
                            </Form.Item>
                            <div style={{ marginTop: 6, minHeight: 24, display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                              {[`1 ${unit}`, `2 ${unit}`, `1/2 ${unit}`].map((sug) => (
                                <Tag
                                  key={sug}
                                  style={{
                                    cursor: 'pointer',
                                    fontSize: 11,
                                    margin: 0,
                                    padding: '0 6px',
                                    borderRadius: 4,
                                    background: '#F8FAFC',
                                    border: '1px solid #E2E8F0',
                                  }}
                                  onClick={() => handleItemChange(item.clientId, 'dosage', sug)}
                                >
                                  {sug}
                                </Tag>
                              ))}
                            </div>
                          </Col>

                          <Col xs={24} sm={12} md={6}>
                            <Form.Item
                              label={<span style={{ fontWeight: 600, color: '#334155' }}>Số lần / ngày <span style={{ color: '#ef4444' }}>*</span></span>}
                              style={{ marginBottom: 0 }}
                            >
                              <InputNumber
                                min={1}
                                max={24}
                                step={1}
                                precision={0}
                                style={{ width: '100%' }}
                                placeholder="2"
                                addonAfter="lần/ngày"
                                disabled={!canPrescribe || checkingInteractions || saving}
                                value={item.frequency}
                                onChange={(value) => handleItemChange(item.clientId, 'frequency', value)}
                              />
                            </Form.Item>
                            <div style={{ marginTop: 6, minHeight: 24, display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                              {[1, 2, 3].map((f) => (
                                <Tag
                                  key={f}
                                  style={{
                                    cursor: 'pointer',
                                    fontSize: 11,
                                    margin: 0,
                                    padding: '0 6px',
                                    borderRadius: 4,
                                    background: '#F8FAFC',
                                    border: '1px solid #E2E8F0',
                                  }}
                                  onClick={() => handleItemChange(item.clientId, 'frequency', f)}
                                >
                                  {f} lần
                                </Tag>
                              ))}
                            </div>
                          </Col>

                          <Col xs={24} sm={12} md={6}>
                            <Form.Item
                              label={<span style={{ fontWeight: 600, color: '#334155' }}>Số ngày dùng <span style={{ color: '#ef4444' }}>*</span></span>}
                              style={{ marginBottom: 0 }}
                            >
                              <InputNumber
                                min={1}
                                max={365}
                                precision={0}
                                disabled={!canPrescribe || checkingInteractions || saving}
                                value={item.durationDays}
                                onChange={(value) => handleItemChange(item.clientId, 'durationDays', value)}
                                style={{ width: '100%' }}
                                placeholder="5"
                                addonAfter="ngày"
                              />
                            </Form.Item>
                            <div style={{ marginTop: 6, minHeight: 24, display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                              {[3, 5, 7, 10].map((d) => (
                                <Tag
                                  key={d}
                                  style={{
                                    cursor: 'pointer',
                                    fontSize: 11,
                                    margin: 0,
                                    padding: '0 6px',
                                    borderRadius: 4,
                                    background: '#F8FAFC',
                                    border: '1px solid #E2E8F0',
                                  }}
                                  onClick={() => handleItemChange(item.clientId, 'durationDays', d)}
                                >
                                  {d} ngày
                                </Tag>
                              ))}
                            </div>
                          </Col>

                          <Col xs={24} sm={12} md={6}>
                            <Form.Item
                              label={<span style={{ fontWeight: 600, color: '#334155' }}>Tổng số lượng <span style={{ color: '#ef4444' }}>*</span></span>}
                              style={{ marginBottom: 0 }}
                            >
                              <InputNumber
                                min={1}
                                precision={0}
                                disabled={!canPrescribe || checkingInteractions || saving}
                                value={item.quantity}
                                onChange={(value) => handleItemChange(item.clientId, 'quantity', value)}
                                style={{ width: '100%' }}
                                placeholder="10"
                                addonAfter={unit}
                              />
                            </Form.Item>
                            <div style={{ marginTop: 6, minHeight: 24, display: 'flex', alignItems: 'center' }}>
                              {Number(item.frequency) > 0 && Number(item.durationDays) > 0 ? (
                                <Tag
                                  color="blue"
                                  style={{
                                    cursor: 'pointer',
                                    fontSize: 11,
                                    margin: 0,
                                    padding: '0 6px',
                                    borderRadius: 4,
                                  }}
                                  onClick={() => {
                                    const qty = Number(item.frequency) * Number(item.durationDays)
                                    handleItemChange(item.clientId, 'quantity', qty)
                                  }}
                                >
                                  ⚡ Tự tính: {Number(item.frequency) * Number(item.durationDays)} {unit}
                                </Tag>
                              ) : (
                                <span style={{ fontSize: 11, color: '#94A3B8' }}>(= Lần × Ngày)</span>
                              )}
                            </div>
                            {selectedMed && (() => {
                              const avail = getAvailableStock(selectedMed)
                              if (avail <= 0) {
                                return (
                                  <div style={{ color: '#d97706', fontSize: 12, marginTop: 4, fontWeight: 500 }}>
                                    Thuốc hiện hết hàng (tồn 0 {unit}) — dược sĩ sẽ cấp bù sau khi có hàng.
                                  </div>
                                )
                              }
                              if (item.quantity > avail) {
                                return (
                                  <div style={{ color: '#d97706', fontSize: 12, marginTop: 4, fontWeight: 500 }}>
                                    Tồn kho hiện tại chỉ còn {avail} {unit} — dược sĩ có thể cần cấp phát một phần.
                                  </div>
                                )
                              }
                              return null
                            })()}
                          </Col>
                        </Row>

                        {/* Hàng 3: Hướng dẫn dùng & Lời dặn chi tiết */}
                        <Form.Item
                          label={<span style={{ fontWeight: 600, color: '#334155' }}>Hướng dẫn sử dụng & Lời dặn của bác sĩ</span>}
                          style={{ marginBottom: 4 }}
                        >
                          <Input
                            disabled={!canPrescribe || checkingInteractions || saving}
                            value={item.instructions}
                            onChange={(event) => handleItemChange(item.clientId, 'instructions', event.target.value)}
                            placeholder="Ví dụ: Uống sau khi ăn no 30 phút, uống với nhiều nước..."
                          />
                        </Form.Item>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                          <span style={{ fontSize: 11, color: '#64748B' }}>Gợi ý nhanh:</span>
                          {['Uống sau ăn no', 'Uống trước ăn 30 phút', 'Uống trước khi đi ngủ', 'Uống nhiều nước'].map((preset) => (
                            <Tag
                              key={preset}
                              style={{
                                cursor: 'pointer',
                                fontSize: 11,
                                margin: 0,
                                padding: '1px 8px',
                                borderRadius: 4,
                                background: '#F8FAFC',
                                border: '1px solid #E2E8F0',
                                color: '#334155',
                              }}
                              onClick={() => {
                                const current = item.instructions?.trim()
                                const newVal = current
                                  ? current.includes(preset)
                                    ? current
                                    : `${current}; ${preset}`
                                  : preset
                                handleItemChange(item.clientId, 'instructions', newVal)
                              }}
                            >
                              + {preset}
                            </Tag>
                          ))}
                        </div>

                        {selectedMed && (() => {
                          const avail = getAvailableStock(selectedMed)
                          if (avail <= 0) {
                            return (
                              <Alert
                                type="warning"
                                showIcon
                                icon={<WarningOutlined />}
                                message={`Thuốc "${selectedMed.medicineName}" hiện đã hết hàng (tồn khả dụng = 0). Dược sĩ sẽ cấp bù sau khi có hàng.`}
                                style={{
                                  marginTop: 12,
                                  borderRadius: 6,
                                  backgroundColor: '#FEF3C7',
                                  borderColor: '#FCD34D',
                                }}
                              />
                            )
                          }
                          if (item.quantity > avail) {
                            return (
                              <Alert
                                type="warning"
                                showIcon
                                icon={<WarningOutlined />}
                                message={`Số lượng kê (${item.quantity} ${unit}) vượt quá tồn kho khả dụng (hiện còn ${avail} ${unit}). Dược sĩ có thể thực hiện cấp phát một phần.`}
                                style={{
                                  marginTop: 12,
                                  borderRadius: 6,
                                  backgroundColor: '#FFF7ED',
                                  borderColor: '#FDBA74',
                                }}
                              />
                            )
                          }
                          return null
                        })()}
                      </Card>
                    )
                  })}

                  {canPrescribe && (
                    <Button
                      type="dashed"
                      icon={<PlusOutlined />}
                      disabled={checkingInteractions || saving}
                      onClick={() => {
                        setConfirmedOverrides([])
                        setItems((current) => [...current, createEmptyItem(false)])
                      }}
                      style={{
                        width: '100%',
                        marginTop: 4,
                        height: 42,
                        borderRadius: 8,
                        borderColor: '#93C5FD',
                        color: '#2563EB',
                        fontWeight: 600,
                        backgroundColor: '#F8FAFC',
                      }}
                    >
                      + Thêm thuốc mới vào đơn
                    </Button>
                  )}

                  <Divider style={{ margin: '16px 0' }} />

                  <Form.Item label="Ghi chú đơn thuốc (cho bệnh nhân & dược sĩ)">
                    <Input.TextArea
                      rows={2}
                      disabled={!canPrescribe || checkingInteractions || saving}
                      value={note}
                      onChange={(event) => setNote(event.target.value)}
                      placeholder="Nhập dặn dò thêm cho bệnh nhân..."
                    />
                  </Form.Item>

                  {editingPrescription && (
                    <div style={{ backgroundColor: '#fffbeb', padding: 14, borderRadius: 8, border: '1px solid #fef3c7', marginTop: 12 }}>
                      <Form.Item
                        label={
                          <span>
                            <strong style={{ color: '#b45309' }}>Lý do điều chỉnh đơn thuốc *</strong> (Bắt buộc theo quy chế bệnh án)
                          </span>
                        }
                        style={{ marginBottom: 8 }}
                      >
                        <Input.TextArea
                          rows={2}
                          disabled={!canPrescribe || checkingInteractions || saving}
                          value={changeReason}
                          onChange={(event) => setChangeReason(event.target.value)}
                          placeholder="Nhập lý do điều chỉnh đơn thuốc hoặc chọn nhanh từ danh sách bên dưới..."
                        />
                      </Form.Item>

                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                        <Text type="secondary" style={{ fontSize: 12 }}>Mẫu lý do gợi ý:</Text>
                        {PRESET_CHANGE_REASONS.map((preset, idx) => (
                          <Tag
                            key={idx}
                            color="orange"
                            style={{ cursor: (canPrescribe && !checkingInteractions && !saving) ? 'pointer' : 'not-allowed', margin: '2px 0' }}
                            onClick={() => {
                              if (!canPrescribe || checkingInteractions || saving) return
                              setChangeReason(preset)
                            }}
                          >
                            + {preset}
                          </Tag>
                        ))}
                      </div>
                    </div>
                  )}

                  {checkingInteractions && (
                    <div style={{ marginTop: 16 }}>
                      <Alert
                        type="info"
                        showIcon
                        icon={<Spin size="small" />}
                        message="Đang kiểm tra tương tác thuốc..."
                      />
                    </div>
                  )}

                  {!checkingInteractions && interactionApiError && (
                    <div style={{ marginTop: 16 }}>
                      <Alert
                        type="error"
                        showIcon
                        icon={<WarningOutlined />}
                        message="Lỗi kiểm tra tương tác thuốc"
                        description={
                          <div>
                            <Paragraph style={{ marginBottom: 8, color: '#991b1b' }}>
                              Không thể kiểm tra tương tác thuốc. Vui lòng thử lại.
                            </Paragraph>
                            <Button
                              size="small"
                              type="primary"
                              danger
                              onClick={() => performInteractionCheck(items).catch(() => {})}
                            >
                              Thử lại kiểm tra tương tác
                            </Button>
                          </div>
                        }
                      />
                    </div>
                  )}

                  {!checkingInteractions && !interactionApiError && detectedInteractions.length > 0 && (
                    <div style={{ marginTop: 16 }}>
                      {areAllInteractionsHandled(detectedInteractions, confirmedOverrides) ? (
                        <Alert
                          type="warning"
                          showIcon
                          icon={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
                          message={`Đã xác nhận lý do bỏ qua cho toàn bộ ${detectedInteractions.length} cảnh báo tương tác thuốc`}
                          description={
                            <div>
                              <ul style={{ margin: '4px 0 8px 0', paddingLeft: 20 }}>
                                {detectedInteractions.map((w, idx) => {
                                  const ov = confirmedOverrides.find((o) => String(o.ruleId) === String(w.ruleId))
                                  return (
                                    <li key={idx}>
                                      <strong>{w.drugNameA}</strong> — <strong>{w.drugNameB}</strong> ({w.severity}):{' '}
                                      <Text type="secondary">Lý do: "{ov?.overrideReason}"</Text>
                                    </li>
                                  )
                                })}
                              </ul>
                              <Button size="small" onClick={() => setInteractionModalOpen(true)}>
                                Xem / Thay đổi lý do bỏ qua
                              </Button>
                            </div>
                          }
                        />
                      ) : (
                        <Alert
                          type="error"
                          showIcon
                          icon={<WarningOutlined />}
                          message={`Phát hiện ${detectedInteractions.length} tương tác thuốc bất lợi (${getUnhandledInteractions(detectedInteractions, confirmedOverrides).length} chưa xử lý)`}
                          description={
                            <div>
                              <Paragraph style={{ marginBottom: 8, color: '#991b1b' }}>
                                Nút "Tạo đơn thuốc" tạm thời bị khóa. Bác sĩ phải điều chỉnh bỏ/đổi thuốc hoặc bấm "Xem cảnh báo & Bỏ qua" để nhập lý do chuyên môn bỏ qua trước khi kê đơn.
                              </Paragraph>
                              <ul style={{ margin: '4px 0 8px 0', paddingLeft: 20 }}>
                                {detectedInteractions.map((w, idx) => (
                                  <li key={idx}>
                                    <strong>{w.drugNameA}</strong> — <strong>{w.drugNameB}</strong> ({w.severity}): {w.description}
                                  </li>
                                ))}
                              </ul>
                              <Button size="small" danger onClick={() => setInteractionModalOpen(true)}>
                                Xem cảnh báo & Bỏ qua
                              </Button>
                            </div>
                          }
                        />
                      )}
                    </div>
                  )}

                  {checkingAllergies && (
                    <div style={{ marginTop: 16 }}>
                      <Alert
                        type="info"
                        showIcon
                        icon={<Spin size="small" />}
                        message="Đang đối chiếu hoạt chất thuốc với tiền sử dị ứng của bệnh nhân..."
                      />
                    </div>
                  )}

                  {!checkingAllergies && activeAllergyWarnings.length > 0 && (
                    <div style={{ marginTop: 16 }}>
                      {areAllAllergiesHandled(activeAllergyWarnings, confirmedAllergyOverrides) ? (
                        <Alert
                          type="warning"
                          showIcon
                          icon={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
                          message={`Đã ghi nhận lý do lâm sàng bỏ qua cho toàn bộ ${activeAllergyWarnings.length} cảnh báo dị ứng thuốc`}
                          description={
                            <div>
                              <ul style={{ margin: '4px 0 8px 0', paddingLeft: 20 }}>
                                {activeAllergyWarnings.map((w, idx) => {
                                  const ov = confirmedAllergyOverrides.find(
                                    (o) =>
                                      String(o.allergyId) === String(w.allergyId) &&
                                      String(o.medicineId) === String(w.medicineId),
                                  )
                                  return (
                                    <li key={idx}>
                                      <strong>{w.medicineName}</strong> (Dị ứng: {w.allergenName} - {w.severity || 'Cảnh báo'}):{' '}
                                      <Text type="secondary">Lý do lâm sàng: "{ov?.overrideReason}"</Text>
                                    </li>
                                  )
                                })}
                              </ul>
                              <Button size="small" onClick={() => setAllergyModalOpen(true)}>
                                Xem / Thay đổi lý do bỏ qua dị ứng
                              </Button>
                            </div>
                          }
                        />
                      ) : (
                        <Alert
                          type="error"
                          showIcon
                          icon={<FireOutlined style={{ color: '#dc2626' }} />}
                          message={`CẢNH BÁO DỊ ỨNG THUỐC: Phát hiện ${activeAllergyWarnings.length} thuốc trùng tiền sử dị ứng (${getUnhandledAllergies(activeAllergyWarnings, confirmedAllergyOverrides).length} chưa xử lý)`}
                          description={
                            <div>
                              <Paragraph style={{ marginBottom: 8, color: '#991b1b' }}>
                                Nút "{editingPrescription ? 'Lưu điều chỉnh đơn thuốc' : 'Tạo đơn thuốc'}" bị khóa. Bác sĩ phải điều chỉnh bỏ/đổi thuốc an toàn hoặc bấm "Xem cảnh báo & Nhập lý do bỏ qua" để tiếp tục kê đơn.
                              </Paragraph>
                              <ul style={{ margin: '4px 0 8px 0', paddingLeft: 20 }}>
                                {activeAllergyWarnings.map((w, idx) => (
                                  <li key={idx}>
                                    <strong>{w.medicineName}</strong>: Hoạt chất/nhóm thuốc trùng tiền sử dị ứng <strong>{w.allergenName}</strong> ({w.severity || 'Cảnh báo'}){w.reaction ? ` — Phản ứng: ${w.reaction}` : ''}
                                  </li>
                                ))}
                              </ul>
                              <Button size="small" type="primary" danger onClick={() => setAllergyModalOpen(true)}>
                                Xem cảnh báo & Nhập lý do bỏ qua
                              </Button>
                            </div>
                          }
                        />
                      )}
                    </div>
                  )}

                  {checkingContraindications && (
                    <div style={{ marginTop: 16 }}>
                      <Alert
                        type="info"
                        showIcon
                        icon={<Spin size="small" />}
                        message="Đang đối chiếu chống chỉ định theo tuổi, thai kỳ và bệnh nền của bệnh nhân..."
                      />
                    </div>
                  )}

                  {!checkingContraindications && contraindicationApiError && (
                    <div style={{ marginTop: 16 }}>
                      <Alert
                        type="error"
                        showIcon
                        icon={<WarningOutlined />}
                        message="Lỗi kiểm tra chống chỉ định thuốc"
                        description={
                          <div>
                            <Paragraph style={{ marginBottom: 8, color: '#991b1b' }}>
                              {contraindicationApiError}
                            </Paragraph>
                            <Button
                              size="small"
                              type="primary"
                              danger
                              onClick={() => performContraindicationCheck(items).catch(() => {})}
                            >
                              Thử lại kiểm tra chống chỉ định
                            </Button>
                          </div>
                        }
                      />
                    </div>
                  )}

                  {!checkingContraindications &&
                    !contraindicationApiError &&
                    (detectedContraindicationWarnings.length > 0 ||
                      detectedContraindicationMissingData.length > 0) && (
                      <ContraindicationWarningPanel
                        warnings={detectedContraindicationWarnings}
                        missingData={detectedContraindicationMissingData}
                        overrides={confirmedContraindicationOverrides}
                        onOpenOverrideModal={() => setContraindicationModalOpen(true)}
                        onOpenQuickUpdatePregnancy={() => setQuickPregnancyModalOpen(true)}
                        editingPrescription={Boolean(editingPrescription)}
                      />
                    )}

                  <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                    {editingPrescription && (
                      <Button disabled={checkingInteractions || checkingAllergies || checkingContraindications || saving} onClick={cancelEditMode}>Hủy điều chỉnh</Button>
                    )}
                    {canPrescribe && (
                      <Tooltip title={!canSubmit ? submitStatus.reason : ''}>
                        <Button
                          type="primary"
                          loading={saving || checkingInteractions || checkingAllergies || checkingContraindications}
                          disabled={!canSubmit}
                          icon={<CheckCircleOutlined />}
                          onClick={handleSaveClick}
                        >
                          {editingPrescription ? 'Lưu điều chỉnh đơn thuốc' : 'Tạo đơn thuốc'}
                        </Button>
                      </Tooltip>
                    )}
                  </div>
                </Card>
              </div>
            ),
          },
          {
            key: 'history',
            label: (
              <span>
                <HistoryOutlined /> Danh sách & Lịch sử đơn thuốc ({prescriptions.length})
              </span>
            ),
            children: (
              <div>
                <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                  <Input
                    placeholder="Tìm kiếm theo mã đơn điện tử (RX...), tên/mã bệnh nhân, mã khám..."
                    prefix={<SearchOutlined style={{ color: '#9ca3af' }} />}
                    value={prescriptionSearchText}
                    onChange={(e) => setPrescriptionSearchText(e.target.value)}
                    allowClear
                    style={{ maxWidth: 420 }}
                  />
                  <Text type="secondary" style={{ fontSize: 13 }}>
                    Hiển thị <strong>{filteredPrescriptions.length}</strong> / {prescriptions.length} đơn thuốc
                  </Text>
                </div>

                <Table
                  rowKey="id"
                  dataSource={filteredPrescriptions}
                  columns={historyColumns}
                  pagination={{ pageSize: 10 }}
                  bordered
                />
              </div>
            ),
          },
        ]}
      />

      <Modal
        open={issuedPrescriptionModalOpen}
        onCancel={() => setIssuedPrescriptionModalOpen(false)}
        footer={
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              flexWrap: 'wrap',
              paddingTop: 14,
              borderTop: '1px solid #f0f0f0',
              width: '100%',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center' }}>
              {justIssuedPrescription?.interconnectionStatus === 'SUCCESS' ? (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '6px 14px',
                    backgroundColor: '#f0fdf4',
                    color: '#166534',
                    border: '1px solid #86efac',
                    borderRadius: 9999,
                    fontSize: 13,
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                    lineHeight: 1.4,
                  }}
                >
                  <CheckCircleOutlined style={{ color: '#16a34a', fontSize: 14 }} />
                  Đã liên thông ({justIssuedPrescription.interconnectionReceiptCode})
                </span>
              ) : (
                <Button
                  type="primary"
                  icon={<CloudUploadOutlined />}
                  loading={sendingInterconnectionId === justIssuedPrescription?.id}
                  onClick={async () => {
                    if (justIssuedPrescription) {
                      await handleSendPrescriptionToInterconnection(justIssuedPrescription)
                    }
                  }}
                  style={{
                    backgroundColor: '#0284c7',
                    borderColor: '#0284c7',
                    whiteSpace: 'nowrap',
                    padding: '6px 14px',
                    display: 'inline-flex',
                    alignItems: 'center',
                  }}
                >
                  Gửi liên thông ngay
                </Button>
              )}
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                flexWrap: 'wrap',
              }}
            >
              <Button
                key="print"
                type="default"
                icon={<PrinterOutlined />}
                style={{
                  whiteSpace: 'nowrap',
                  padding: '6px 14px',
                  display: 'inline-flex',
                  alignItems: 'center',
                }}
                onClick={() => {
                  setIssuedPrescriptionModalOpen(false)
                  if (justIssuedPrescription) {
                    setSelectedPrescriptionForPrint(justIssuedPrescription)
                    setPrintModalOpen(true)
                  }
                }}
              >
                In đơn
              </Button>
              <Button
                key="detail"
                type="default"
                icon={<EyeOutlined />}
                style={{
                  whiteSpace: 'nowrap',
                  padding: '6px 14px',
                  display: 'inline-flex',
                  alignItems: 'center',
                }}
                onClick={() => {
                  setIssuedPrescriptionModalOpen(false)
                  if (justIssuedPrescription) {
                    openDetailModal(justIssuedPrescription)
                  }
                }}
              >
                Xem chi tiết
              </Button>
              <Button
                key="close"
                type="primary"
                style={{
                  whiteSpace: 'nowrap',
                  padding: '6px 14px',
                  display: 'inline-flex',
                  alignItems: 'center',
                }}
                onClick={() => setIssuedPrescriptionModalOpen(false)}
              >
                Đóng & Tiếp tục
              </Button>
            </div>
          </div>
        }
        width={640}
      >
        <div style={{ textAlign: 'center', padding: '16px 8px 8px' }}>
          <div style={{ fontSize: 44, marginBottom: 8 }}>🩺</div>
          <Title level={4} style={{ color: '#166534', margin: 0 }}>
            Cấp Mã Đơn Thuốc Điện Tử Thành Công
          </Title>
          <Paragraph type="secondary" style={{ marginTop: 4, marginBottom: 16 }}>
            Hệ thống đã tự động cấp mã định danh duy nhất cho đơn thuốc của lượt khám này.
          </Paragraph>

          <Card
            style={{
              backgroundColor: '#f0fdf4',
              borderColor: '#86efac',
              borderRadius: 12,
              marginBottom: 16,
            }}
          >
            <div style={{ fontSize: 13, color: '#166534', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>
              Mã Đơn Thuốc Điện Tử
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 8 }}>
              <Tag
                color="blue"
                style={{
                  fontSize: 22,
                  padding: '6px 18px',
                  fontWeight: 800,
                  letterSpacing: 1.5,
                  borderRadius: 8,
                  borderColor: '#93c5fd',
                  backgroundColor: '#eff6ff',
                  color: '#1d4ed8',
                }}
              >
                <BarcodeOutlined style={{ marginRight: 8 }} />
                {justIssuedPrescription?.prescriptionCode || '—'}
              </Tag>
              <Tooltip title="Sao chép mã đơn">
                <Button
                  icon={<CopyOutlined />}
                  onClick={() => {
                    if (justIssuedPrescription?.prescriptionCode) {
                      navigator.clipboard.writeText(justIssuedPrescription.prescriptionCode)
                      message.success(`Đã sao chép mã đơn: ${justIssuedPrescription.prescriptionCode}`)
                    }
                  }}
                />
              </Tooltip>
            </div>
            <div style={{ fontSize: 12.5, color: '#15803d', fontStyle: 'italic' }}>
              ✓ Mã định danh duy nhất được gắn cố định với đơn, không đổi trong suốt vòng đời phục vụ in ấn, tra cứu và liên thông.
            </div>
          </Card>

          {justIssuedPrescription?.interconnectionStatus === 'SUCCESS' && (
            <div
              style={{
                backgroundColor: '#f0fdf4',
                borderColor: '#86efac',
                borderWidth: 1,
                borderStyle: 'solid',
                borderRadius: 8,
                padding: '10px 14px',
                marginBottom: 16,
                textAlign: 'left',
              }}
            >
              <Space size={10} align="center">
                <CheckCircleOutlined style={{ fontSize: 22, color: '#16a34a' }} />
                <div>
                  <div style={{ fontWeight: 700, color: '#166534', fontSize: 13 }}>
                    ĐÃ LIÊN THÔNG QUỐC GIA THÀNH CÔNG
                  </div>
                  <div style={{ fontSize: 12.5, color: '#15803d', marginTop: 2 }}>
                    Mã biên nhận: <Text code strong style={{ color: '#15803d', fontSize: 13 }}>{justIssuedPrescription.interconnectionReceiptCode}</Text>
                  </div>
                </div>
              </Space>
            </div>
          )}

          <Descriptions size="small" column={2} bordered>
            <Descriptions.Item label="Bệnh nhân">
              <strong>{encounter?.patient?.fullName || record?.patientName || '—'}</strong>
            </Descriptions.Item>
            <Descriptions.Item label="Mã BN">
              {encounter?.patient?.patientCode || record?.patientCode || '—'}
            </Descriptions.Item>
            <Descriptions.Item label="Mã lượt khám">
              {encounter?.visit?.visitCode || record?.visitId || '—'}
            </Descriptions.Item>
            <Descriptions.Item label="Trạng thái">
              <Tag color="orange">Chờ cấp phát</Tag>
            </Descriptions.Item>
          </Descriptions>
        </div>
      </Modal>

      {interactionModalOpen && (
        <React.Suspense fallback={<Spin size="small" />}>
          <InteractionWarningModal
            open={interactionModalOpen}
            warnings={detectedInteractions}
            onCancel={() => setInteractionModalOpen(false)}
            onConfirmOverride={handleConfirmInteractionOverrides}
          />
        </React.Suspense>
      )}

      <PrescriptionAllergyWarningModal
        open={allergyModalOpen}
        warnings={activeAllergyWarnings}
        patientName={encounter?.patient?.fullName || record?.patientName || ''}
        onCancel={() => setAllergyModalOpen(false)}
        onConfirmOverride={handleConfirmAllergyOverrides}
      />

      <ContraindicationOverrideModal
        open={contraindicationModalOpen}
        warnings={detectedContraindicationWarnings}
        initialOverrides={confirmedContraindicationOverrides}
        patientName={currentPatient?.fullName || ''}
        onCancel={() => setContraindicationModalOpen(false)}
        onConfirmOverride={handleConfirmContraindicationOverrides}
      />

      <QuickUpdatePregnancyModal
        open={quickPregnancyModalOpen}
        patient={currentPatient}
        onClose={() => setQuickPregnancyModalOpen(false)}
        onSuccess={(status) => {
          setEncounter((prev) => {
            if (!prev) return prev
            return {
              ...prev,
              patient: {
                ...(prev.patient || {}),
                pregnancyStatus: status,
              },
            }
          })
          performContraindicationCheck(items).catch(() => {})
        }}
      />

      <SpecialControlPrescribeConfirmModal
        open={specialControlModalOpen}
        medicine={pendingSpecialControlData?.medicine}
        patient={encounter?.patient || record || { fullName: routeState.patientName, patientCode: routeState.patientCode }}
        initialReason={pendingSpecialControlData?.initialReason || ''}
        onCancel={handleCancelSpecialControlPrescribe}
        onConfirm={handleConfirmSpecialControlPrescribe}
        submitting={specialControlSubmitting}
      />

      <PrescriptionAllergyWarningLogsModal
        open={allergyLogsModalOpen}
        onClose={() => setAllergyLogsModalOpen(false)}
        patientId={encounter?.patient?.id || record?.patientId || routeState.patient?.id}
        defaultPatientId={encounter?.patient?.id || record?.patientId || routeState.patient?.id}
        patientName={encounter?.patient?.fullName || record?.patientName || routeState.patient?.fullName}
      />

      <PrescriptionDetailModal
        open={detailModalOpen}
        onClose={() => setDetailModalOpen(false)}
        prescription={selectedPrescriptionForDetail}
        medicines={medicines}
        canEdit={canPrescribe}
        canCancel={canCancelPrescription({ userRoles: roles, userPermissions, prescription: selectedPrescriptionForDetail, currentUserId: currentUser?.id }).allowed}
        onCancelClick={handleOpenCancelModal}
        canSendInterconnection={canSendInterconnection}
        onInterconnectionUpdated={loadData}
        onEditClick={startEditPrescription}
        onPrintClick={(p) => {
          setSelectedPrescriptionForPrint(p)
          setPrintModalOpen(true)
        }}
      />

      <CancelPrescriptionModal
        open={cancelModalOpen}
        onClose={() => {
          setCancelModalOpen(false)
          setPrescriptionToCancel(null)
        }}
        prescription={prescriptionToCancel}
        onConfirm={handleConfirmCancelPrescription}
        loading={cancelling}
      />

      <PartialDispenseModal
        open={partialModalOpen}
        onClose={() => {
          setPartialModalOpen(false)
          setSelectedPrescriptionForPartial(null)
        }}
        prescription={selectedPrescriptionForPartial}
        onSuccess={() => {
          loadData()
        }}
      />

      <DispenseHistoryModal
        open={historyModalOpen}
        onClose={() => {
          setHistoryModalOpen(false)
          setSelectedPrescriptionForHistory(null)
        }}
        prescription={selectedPrescriptionForHistory}
      />

      <ReturnMedicationModal
        open={returnModalOpen}
        onClose={() => {
          setReturnModalOpen(false)
          setSelectedPrescriptionForReturn(null)
        }}
        prescription={selectedPrescriptionForReturn}
        onSuccess={() => {
          if (loadData) loadData()
        }}
      />

      <PrescriptionPrintTemplateModal
        open={printModalOpen}
        onClose={() => {
          setPrintModalOpen(false)
          setSelectedPrescriptionForPrint(null)
        }}
        prescription={selectedPrescriptionForPrint}
        record={record}
        diagnoses={diagnoses}
        patient={encounter?.patient}
        encounter={encounter}
      />

      {signModalOpen && (
        <SignMedicalRecordModal
          open={signModalOpen}
          onClose={() => setSignModalOpen(false)}
          onSuccess={handleSignSuccess}
          recordId={medicalRecordId}
          encounterContext={encounter}
          medicalRecord={record}
          patient={
            encounter?.patient || {
              id: record?.patientId,
              fullName: record?.patientName,
              patientCode: record?.patientCode,
            }
          }
          formValues={signFormValues}
          vitalSigns={record?.vitalSigns || {}}
          bmiValue={record?.bmiValue || null}
          primaryIcd={primaryIcd}
          secondaryIcds={secondaryIcds}
          selectedOrders={[]}
          currentUser={currentUser}
          onOpenAmend={() => {
            setSignModalOpen(false)
            if (targetVisitId) {
              navigate(`/medical-records/visits/${targetVisitId}`)
            }
          }}
        />
      )}
    </div>
  )
}

export default PrescriptionPage
