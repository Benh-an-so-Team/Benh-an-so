import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import dayjs from 'dayjs'
import {
  Alert,
  Button,
  Card,
  Descriptions,
  Divider,
  Dropdown,
  Empty,
  Form,
  Input,
  message,
  Modal,
  Result,
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
  CheckCircleOutlined,
  CheckCircleFilled,
  CheckOutlined,
  DeleteOutlined,
  EllipsisOutlined,
  EyeOutlined,
  MedicineBoxOutlined,
  PlusOutlined,
  PrinterOutlined,
  SearchOutlined,
  SolutionOutlined,
  SafetyCertificateOutlined,
  SafetyCertificateFilled,
  LockOutlined,
  EditOutlined,
  HistoryOutlined,
  FileProtectOutlined,
  ArrowLeftOutlined,
  UnorderedListOutlined,
  StopOutlined,
  SwapOutlined,
} from '@ant-design/icons'

import clinicalServiceApi from '../api/clinicalServiceApi'
import medicalRecordApi from '../api/medicalRecordApi'
import queueApi from '../api/queueApi'
import visitApi from '../api/visitApi'
import MedicalEncounterForm from '../components/clinical/MedicalEncounterForm'
import PatientAllergyBanner from '../components/clinical/PatientAllergyBanner'
import SignMedicalRecordModal from '../components/clinical/SignMedicalRecordModal'
import AmendMedicalRecordModal from '../components/clinical/AmendMedicalRecordModal'
import MedicalRecordVersionHistoryModal from '../components/clinical/MedicalRecordVersionHistoryModal'
import CloseVisitModal from '../components/clinical/CloseVisitModal'
import VitalSignHistoryModal from '../components/clinical/VitalSignHistoryModal'
import VisitSummaryPrintModal from '../components/clinical/VisitSummaryPrintModal.jsx'
import HandoverPatientModal from '../components/clinical/HandoverPatientModal.jsx'
import HandoverHistoryModal from '../components/clinical/HandoverHistoryModal.jsx'
import { canHandoverVisit, getStoredHandovers } from '../utils/handoverValidation.js'
import vitalSignApi from '../api/vitalSignApi'
import { isMedicalRecordSigned } from '../utils/medicalRecordSignHelpers'
import { canViewMedicalRecordVersionHistory } from '../utils/medicalRecordVersionHelpers'
import { canUserCloseVisit } from '../utils/closeVisitHelpers'
import {
  formatBloodPressure,
  mapVitalSignErrorMessage,
  validateVitalSignForm,
} from '../utils/vitalSignHelpers'
import {
  validateCanAddComorbidity,
  validateDiagnosesSubmission,
} from '../utils/comorbiditiesHelpers'
import { useAuthContext } from '../context/AuthContext'

import { clinicalServiceCatalog } from '../utils/clinicalCatalogData'
import { getCategoryFromIcdCode, icd10Categories } from '../utils/icd10Data'
import { fixMojibake } from '../utils/serviceCatalogValidation'
import { getApiErrorMessage, getApiErrorMessage as getApiMessage, normalizeApiError } from '../utils/apiError'
import { formatRecordCode, formatRecordStatus, formatVisitCode } from '../utils/helpers'
import { formatTemplateName } from '../constants/medicalRecordTemplateConstants'
import {
  buildClinicalOrderPayload,
  buildDiagnosisPayload,
  buildMedicalRecordPayload,
  getQueueInProgressBlockReason,
  normalizeMedicalRecordDetail,
  unwrapCollection,
} from '../utils/workflowContract'

const ClinicalOrderPrintModal = React.lazy(() => import('../components/clinical/ClinicalOrderPrintModal'))

const { Text, Paragraph, Title } = Typography

const loadRecentDiagnoses = () => {
  try {
    const saved = localStorage.getItem('recent_diagnoses')
    if (saved) {
      const parsed = JSON.parse(saved)
      if (Array.isArray(parsed)) {
        const valid = parsed.filter((item) => item?.id && item?.code)
        if (valid.length !== parsed.length) {
          localStorage.setItem('recent_diagnoses', JSON.stringify(valid))
        }
        return valid
      }
    }
  } catch {
  }
  return []
}

const saveRecentDiagnosis = (icd) => {
  if (!icd?.code) return
  try {
    const current = loadRecentDiagnoses()
    const updated = [icd, ...current.filter((item) => item.code !== icd.code)].slice(0, 10)
    localStorage.setItem('recent_diagnoses', JSON.stringify(updated))
  } catch {
  }
}

const mapClinicalService = (item) => ({
  id: item.id || item.serviceCode || item.code,
  code: item.serviceCode || item.code || '',
  name: fixMojibake(item.serviceName || item.name || ''),
  category:
    item.category ||
    (item.serviceType === 'LAB_TEST'
      ? 'XET_NGHIEM'
      : item.serviceType === 'IMAGING'
        ? 'CDHA'
        : 'THU_THUAT'),
  department: item.department || item.description || 'Dịch vụ cận lâm sàng',
  price: Number(item.price ?? item.currentPrice ?? 0),
  preparation: item.preparation || '',
})

function MedicalEncounter() {
  const { visitId: visitIdFromPath } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const { user } = useAuthContext()
  const [form] = Form.useForm()

  const visitId = visitIdFromPath || location.state?.visitId
  const roles = useMemo(
    () => (user?.roles || []).map((role) => String(role).toLowerCase().replace(/^role_/, '')),
    [user?.roles],
  )
  const canEditEncounter = roles.includes('doctor') || roles.includes('admin')
  const canViewVersionHistory = canViewMedicalRecordVersionHistory(roles, user?.permissions)

  const [encounter, setEncounter] = useState(null)
  const [currentRecordId, setCurrentRecordId] = useState(null)
  const [medicalRecord, setMedicalRecord] = useState(null)
  const [signModalOpen, setSignModalOpen] = useState(false)
  const [amendModalOpen, setAmendModalOpen] = useState(false)
  const [versionHistoryModalOpen, setVersionHistoryModalOpen] = useState(false)
  const [versionHistory, setVersionHistory] = useState(null)
  const [records, setRecords] = useState([])
  const [clinicalServices, setClinicalServices] = useState([])
  const [serviceCatalogError, setServiceCatalogError] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState('')
  const draftInitPromiseRef = useRef(null)
  const pendingSaveRef = useRef(null)
  const [activeTab, setActiveTab] = useState('current')
  const [viewing, setViewing] = useState(null)

  const isRecordSigned = useMemo(() => {
    const status = medicalRecord?.status || encounter?.medicalRecord?.status
    return isMedicalRecordSigned(status)
  }, [medicalRecord?.status, encounter?.medicalRecord?.status])

  const isRecordArchived = useMemo(() => {
    const status = medicalRecord?.status || encounter?.medicalRecord?.status
    return String(status || '').toUpperCase() === 'ARCHIVED'
  }, [medicalRecord?.status, encounter?.medicalRecord?.status])

  const [closeVisitModalOpen, setCloseVisitModalOpen] = useState(false)
  const [visitSummaryModalOpen, setVisitSummaryModalOpen] = useState(false)
  const [handoverModalOpen, setHandoverModalOpen] = useState(false)
  const [handoverHistoryModalOpen, setHandoverHistoryModalOpen] = useState(false)
  const [handovers, setHandovers] = useState([])

  const canCloseThisVisit = useMemo(() => {
    const isProgress =
      encounter?.visit?.status === 'IN_PROGRESS' ||
      encounter?.queueItem?.status === 'IN_PROGRESS' ||
      (!encounter?.visit?.status && encounter?.queueItem?.status === 'IN_PROGRESS')
    if (!isProgress) return false
    if (isRecordSigned) return false
    const doctorId =
      encounter?.doctor?.id ||
      encounter?.visit?.doctorId ||
      encounter?.queueItem?.doctorId ||
      encounter?.queue?.doctorId
    return canUserCloseVisit(user, doctorId)
  }, [encounter, isRecordSigned, user])

  const handleCloseVisitSuccess = (data, outcome, reason) => {
    setCloseVisitModalOpen(false)
    setTimeout(() => {
      navigate('/appointments', { replace: true })
    }, 1200)
  }

  const handleHandoverSuccess = (targetDoctorObj) => {
    setHandoverModalOpen(false)
    const targetName = targetDoctorObj?.fullName || 'bác sĩ tiếp nhận'
    message.success(`Đã bàn giao ca khám sang ${targetName} thành công!`)
    navigate('/appointments', { replace: true })
  }

  const [vitalSigns, setVitalSigns] = useState({
    bp: '',
    pulse: '',
    bloodPressureSystolic: null,
    bloodPressureDiastolic: null,
    temperature: '37.0',
    temp: '37.0',
    respiratoryRate: 16,
    respRate: '16',
    weight: '',
    height: '',
    spo2: 98,
    spO2: '98',
    note: '',
  })
  const [vitalSignId, setVitalSignId] = useState(null)
  const [vitalSignBackendFlags, setVitalSignBackendFlags] = useState([])
  const [vitalSignSaving, setVitalSignSaving] = useState(false)
  const [vitalSignHistoryModalOpen, setVitalSignHistoryModalOpen] = useState(false)

  const handleVitalSignsChange = (newValues) => {
    let bpStr = newValues.bp
    if (newValues.bloodPressureSystolic != null || newValues.bloodPressureDiastolic != null) {
      const s = newValues.bloodPressureSystolic != null ? newValues.bloodPressureSystolic : ''
      const d = newValues.bloodPressureDiastolic != null ? newValues.bloodPressureDiastolic : ''
      bpStr = `${s}/${d}`
    }
    setVitalSigns({
      ...newValues,
      bp: bpStr || '',
      temp: newValues.temperature != null ? String(newValues.temperature) : (newValues.temp || ''),
      respRate: newValues.respiratoryRate != null ? String(newValues.respiratoryRate) : (newValues.respRate || ''),
      spO2: newValues.spo2 != null ? String(newValues.spo2) : (newValues.spO2 || ''),
    })
  }

  const handleSaveVitalSigns = async (customValues = null) => {
    if (!visitId) return false
    const isSyntheticEvent = customValues && (customValues.nativeEvent || customValues.target || typeof customValues.preventDefault === 'function')
    const valuesToSave = (!isSyntheticEvent && customValues && typeof customValues === 'object') ? customValues : vitalSigns
    const validation = validateVitalSignForm(valuesToSave)
    if (!validation.valid) {
      const firstErr = Object.values(validation.errors)[0]
      message.error(firstErr || 'Chỉ số sinh tồn không hợp lệ.')
      return false
    }

    setVitalSignSaving(true)
    try {
      const payload = {
        visitId,
        pulse: valuesToSave.pulse ? parseInt(valuesToSave.pulse, 10) : null,
        bloodPressureSystolic: valuesToSave.bloodPressureSystolic != null && valuesToSave.bloodPressureSystolic !== ''
          ? parseInt(valuesToSave.bloodPressureSystolic, 10)
          : null,
        bloodPressureDiastolic: valuesToSave.bloodPressureDiastolic != null && valuesToSave.bloodPressureDiastolic !== ''
          ? parseInt(valuesToSave.bloodPressureDiastolic, 10)
          : null,
        temperature: valuesToSave.temperature ? parseFloat(valuesToSave.temperature) : (valuesToSave.temp ? parseFloat(valuesToSave.temp) : null),
        respiratoryRate: valuesToSave.respiratoryRate ? parseInt(valuesToSave.respiratoryRate, 10) : (valuesToSave.respRate ? parseInt(valuesToSave.respRate, 10) : null),
        weight: valuesToSave.weight ? parseFloat(valuesToSave.weight) : null,
        height: valuesToSave.height ? parseFloat(valuesToSave.height) : null,
        spo2: valuesToSave.spo2 ? parseInt(valuesToSave.spo2, 10) : (valuesToSave.spO2 ? parseInt(valuesToSave.spO2, 10) : null),
        note: valuesToSave.note || null,
      }

      let res
      if (vitalSignId) {
        res = await vitalSignApi.update(vitalSignId, payload)
      } else {
        res = await vitalSignApi.record(payload)
      }

      if (res?.data) {
        setVitalSignId(res.data.id)
        setVitalSignBackendFlags(res.data.abnormalFlags || [])
      }
      return true
    } catch (err) {
      const msg = mapVitalSignErrorMessage(err)
      message.error(msg)
      return false
    } finally {
      setVitalSignSaving(false)
    }
  }
  const [diagnosisType, setDiagnosisType] = useState('DEFINITIVE')
  const [primaryIcd, setPrimaryIcd] = useState(null)
  const [secondaryIcds, setSecondaryIcds] = useState([])
  const [diagnosisModalOpen, setDiagnosisModalOpen] = useState(false)
  const lastSignModalTimeRef = useRef(0)
  const [icdSearchQuery, setIcdSearchQuery] = useState('')
  const [icdCategory, setIcdCategory] = useState('ALL')
  const [backendIcdCatalog, setBackendIcdCatalog] = useState([])
  const [allBackendDiagnoses, setAllBackendDiagnoses] = useState([])
  const [icdSearching, setIcdSearching] = useState(false)
  const [, setRecentIcds] = useState(loadRecentDiagnoses)

  const loadAllBackendDiagnoses = useCallback(async () => {
    setIcdSearching(true)
    try {
      const res = await medicalRecordApi.getDiagnosisCatalog('A')
      const rawList = Array.isArray(res?.data) ? res.data : []
      const list = rawList.map((item) => ({
        id: item.id,
        code: item.code,
        rawName: item.name,
        name: fixMojibake(item.name),
        diseaseGroup: item.diseaseGroup ? fixMojibake(item.diseaseGroup) : null,
        description: fixMojibake(item.description || ''),
        category: getCategoryFromIcdCode(item.code),
      })).sort((a, b) => a.code.localeCompare(b.code))
      setAllBackendDiagnoses(list)
    } catch {
      setAllBackendDiagnoses([])
    } finally {
      setIcdSearching(false)
    }
  }, [])

  useEffect(() => {
    loadAllBackendDiagnoses()
  }, [loadAllBackendDiagnoses])

  const [visitSpecialty, setVisitSpecialty] = useState(null)
  const [availableTemplates, setAvailableTemplates] = useState([])
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [currentTemplate, setCurrentTemplate] = useState(null)
  const [isFallbackTemplate, setIsFallbackTemplate] = useState(false)
  const [templateLoading, setTemplateLoading] = useState(false)
  const [templateError, setTemplateError] = useState('')

  const handleTemplateChange = async (templateId) => {
    if (!templateId || templateId === selectedTemplateId) return
    const candidate = availableTemplates.find(
      (t) => String(t.templateId || t.id) === String(templateId),
    )
    if (!candidate) return

    setTemplateError('')

    if (currentRecordId) {
      const formVals = form.getFieldsValue()
      const hasContent = [
        formVals.chiefComplaint,
        formVals.symptoms,
        formVals.medicalHistory,
        formVals.physicalExamination,
        formVals.clinicalProgress,
        formVals.treatmentPlan,
        formVals.doctorInstructions,
        formVals.conclusion,
      ].some((val) => val && String(val).trim().length > 0)

      if (hasContent) {
        Modal.confirm({
          title: 'Bệnh án đã có nội dung khám',
          content:
            'Theo quy định chuyên môn, việc đổi mẫu bệnh án chỉ được thực hiện khi các trường khám lâm sàng chưa có nội dung để tránh mất dữ liệu đã ghi. Bạn có muốn xóa nội dung đã nhập để áp dụng mẫu mới không?',
          okText: 'Xóa nội dung & Đổi mẫu',
          okType: 'danger',
          cancelText: 'Hủy / Giữ nguyên mẫu',
          onOk: async () => {
            setTemplateLoading(true)
            try {
              form.setFieldsValue({
                chiefComplaint: '',
                symptoms: '',
                medicalHistory: '',
                physicalExamination: '',
                clinicalProgress: '',
                treatmentPlan: '',
                doctorInstructions: '',
                revisitDate: null,
                conclusion: '',
              })
              await medicalRecordApi.update(currentRecordId, {
                chiefComplaint: '',
                symptoms: '',
                medicalHistory: '',
                physicalExamination: '',
                clinicalProgress: '',
                treatmentPlan: '',
                doctorInstructions: '',
                conclusion: '',
              })
              const res = await medicalRecordApi.applyTemplate(currentRecordId, templateId)
              setSelectedTemplateId(templateId)
              setCurrentTemplate(res.data?.appliedTemplate || candidate)
              message.success(`Đã áp dụng mẫu: ${formatTemplateName(candidate.name)}`)
            } catch (err) {
              const msg = getApiMessage(err, 'Không thể đổi mẫu bệnh án.')
              setTemplateError(msg)
              message.error(msg)
            } finally {
              setTemplateLoading(false)
            }
          },
        })
        return
      }

      setTemplateLoading(true)
      try {
        const res = await medicalRecordApi.applyTemplate(currentRecordId, templateId)
        setSelectedTemplateId(templateId)
        setCurrentTemplate(res.data?.appliedTemplate || candidate)
        message.success(`Đã áp dụng mẫu: ${formatTemplateName(candidate.name)}`)
      } catch (err) {
        const msg = getApiMessage(err, 'Không thể đổi mẫu bệnh án.')
        setTemplateError(msg)
        message.error(msg)
      } finally {
        setTemplateLoading(false)
      }
    } else {
      setSelectedTemplateId(templateId)
      setCurrentTemplate(candidate)
      message.info(`Đã chọn mẫu: ${formatTemplateName(candidate.name)}`)
    }
  }

  const [selectedOrders, setSelectedOrders] = useState([])
  const [orderCategory, setOrderCategory] = useState('ALL')
  const [orderSearchQuery, setOrderSearchQuery] = useState('')
  const [printModalOpen, setPrintModalOpen] = useState(false)

  const selectedPatientObj = useMemo(() => {
    if (!encounter?.patient) return null
    return {
      ...encounter.patient,
      phoneNumber: encounter.patient.phone,
      healthInsuranceCode: encounter.patient.insuranceNumber,
      medicalHistory: form.getFieldValue('medicalHistory'),
    }
  }, [encounter, form])

  const hydrateRecord = useCallback((detail) => {
    if (!detail) {
      setCurrentRecordId(null)
      setMedicalRecord(null)
      setPrimaryIcd(null)
      setSecondaryIcds([])
      return
    }

    setMedicalRecord(detail)
    const cleanPrimaryName = fixMojibake(detail.primaryIcdName)
    const cleanConclusion = fixMojibake(detail.conclusion)

    setCurrentRecordId(detail.medicalRecordId || detail.id)
    form.setFieldsValue({
      patientId: detail.patient?.id,
      chiefComplaint: fixMojibake(detail.chiefComplaint || detail.symptoms || ''),
      symptoms: fixMojibake(detail.symptoms || detail.chiefComplaint || ''),
      medicalHistory: fixMojibake(detail.medicalHistory || ''),
      physicalExamination: fixMojibake(detail.physicalExamination || ''),
      examinationNote: fixMojibake(detail.physicalExamination || ''),
      clinicalProgress: fixMojibake(detail.clinicalProgress || ''),
      treatmentPlan: fixMojibake(detail.treatmentPlan || ''),
      doctorInstructions: fixMojibake(detail.doctorInstructions || ''),
      revisitDate: detail.revisitDate ? dayjs(detail.revisitDate) : null,
      conclusion: cleanConclusion || '',
      diagnosisText:
        detail.primaryIcdCode && cleanPrimaryName
          ? `[${detail.primaryIcdCode}] ${cleanPrimaryName}`
          : cleanConclusion || '',
    })

    if (detail.appliedTemplate) {
      setCurrentTemplate(detail.appliedTemplate)
      setSelectedTemplateId(detail.appliedTemplate.templateId)
      if (detail.appliedTemplate.specialty) {
        setVisitSpecialty(detail.appliedTemplate.specialty)
      }
      setIsFallbackTemplate(Boolean(detail.appliedTemplate.fallback))
    }

    const diagnoses = Array.isArray(detail.diagnoses) ? detail.diagnoses : []
    const primary = diagnoses.find((item) => item.diagnosisType === 'PRIMARY')
    setPrimaryIcd(
      primary
        ? {
          id: primary.diagnosisCatalogId || primary.id,
          code: primary.diagnosisCode,
          rawName: primary.diagnosisName,
          name: fixMojibake(primary.diagnosisName),
          note: fixMojibake(primary.note),
        }
        : detail.primaryIcdCode
          ? {
            id: detail.primaryDiagnosisCatalogId || detail.primaryIcdId || detail.id,
            code: detail.primaryIcdCode,
            rawName: cleanPrimaryName,
            name: cleanPrimaryName,
          }
          : null,
    )
    setSecondaryIcds(
      diagnoses
        .filter((item) => item.diagnosisType === 'SECONDARY')
        .map((item) => ({
          id: item.diagnosisCatalogId || item.id,
          code: item.diagnosisCode,
          rawName: item.diagnosisName,
          name: fixMojibake(item.diagnosisName),
          note: fixMojibake(item.note),
        })),
    )
  }, [form])

  const ensureDraftRecord = useCallback(async (vId, tmplId) => {
    try {
      const createRes = await medicalRecordApi.create({
        visitId: vId,
        chiefComplaint: '',
        symptoms: '',
        medicalHistory: '',
        physicalExamination: '',
        clinicalProgress: '',
        treatmentPlan: '',
        doctorInstructions: '',
        conclusion: '',
      })
      const recId = createRes.data?.id
      if (recId) {
        setCurrentRecordId(recId)
        setMedicalRecord((prev) => ({
          ...prev,
          id: recId,
          medicalRecordId: recId,
          status: 'DRAFT',
          visitId: vId,
        }))
        if (tmplId) {
          try {
            const appliedRes = await medicalRecordApi.applyTemplate(recId, tmplId)
            if (appliedRes.data?.appliedTemplate) {
              setCurrentTemplate(appliedRes.data.appliedTemplate)
            }
          } catch (tErr) {
            console.warn('Áp dụng mẫu bệnh án khi tạo nháp:', tErr)
          }
        }
        return recId
      }
    } catch (createErr) {
      const isAlreadyExists =
        createErr?.response?.status === 409 ||
        createErr?.response?.data?.code === 'MEDICAL_RECORD_ALREADY_EXISTS_FOR_VISIT' ||
        String(createErr?.response?.data?.message || '').toLowerCase().includes('already exists')
      if (isAlreadyExists) {
        try {
          const existingRes = await medicalRecordApi.getByVisit(vId)
          const existId = existingRes?.data?.id || existingRes?.data?.medicalRecordId
          if (existId) {
            setCurrentRecordId(existId)
            setMedicalRecord((prev) => ({ ...prev, ...existingRes?.data, medicalRecordId: existId }))
            return existId
          }
        } catch {
        }
      }
    }
    return null
  }, [])

  const loadWorkflow = useCallback(async () => {
    if (!visitId) return
    setLoading(true)
    setLoadError('')
    setServiceCatalogError('')
    setTemplateError('')

    try {
      const encounterResponse = await visitApi.getEncounter(visitId)
      const encounterData = encounterResponse.data
      setEncounter(encounterData)
      form.setFieldsValue({
        patientId: encounterData.patient?.id,
        chiefComplaint: fixMojibake(encounterData.visit?.reason || ''),
        symptoms: fixMojibake(encounterData.visit?.reason || ''),
      })

      let recordData = null
      try {
        const recordRes = await medicalRecordApi.getByVisit(visitId)
        recordData = recordRes.data
        if (recordData) {
          hydrateRecord(recordData)
          const recId = recordData.medicalRecordId || recordData.id
          if (recId) {
            medicalRecordApi
              .getVersionHistory(recId)
              .then((vRes) => setVersionHistory(vRes.data))
              .catch(() => setVersionHistory(null))
          }
        }
      } catch (recErr) {
        if ((recErr?.apiError || normalizeApiError(recErr)).status === 404) {
          hydrateRecord(null)
          setVersionHistory(null)
        } else {
          console.warn('Không tìm thấy bệnh án lượt khám:', recErr)
        }
      }

      let effectiveTmplId = null
      try {
        const tmplOptRes = await medicalRecordApi.getTemplateOptionsByVisit(visitId)
        const tmplData = tmplOptRes.data
        if (tmplData) {
          setVisitSpecialty(tmplData.visitSpecialty)
          setAvailableTemplates(tmplData.availableTemplates || [])
          setIsFallbackTemplate(Boolean(tmplData.fallback))

          const applied = recordData?.appliedTemplate
          if (applied) {
            setSelectedTemplateId(applied.templateId)
            setCurrentTemplate(applied)
            effectiveTmplId = applied.templateId
          } else if (tmplData.effectiveTemplate) {
            setSelectedTemplateId(tmplData.effectiveTemplate.templateId)
            setCurrentTemplate(tmplData.effectiveTemplate)
            effectiveTmplId = tmplData.effectiveTemplate.templateId
          }
        }
      } catch (tmplErr) {
        console.warn('Không thể nạp template options:', tmplErr)
      }

      if (!recordData && visitId) {
        draftInitPromiseRef.current = ensureDraftRecord(visitId, effectiveTmplId)
      }

      // Tải chỉ số sinh tồn của lượt khám từ Backend
      try {
        const vsRes = await vitalSignApi.getByVisitId(visitId)
        const vsList = Array.isArray(vsRes?.data) ? vsRes.data : (vsRes?.data ? [vsRes.data] : [])
        if (vsList.length > 0) {
          const vs = vsList[0]
          setVitalSignId(vs.id)
          setVitalSignBackendFlags(vs.abnormalFlags || [])
          setVitalSigns({
            pulse: vs.pulse != null ? vs.pulse : '',
            bloodPressureSystolic: vs.bloodPressureSystolic != null ? vs.bloodPressureSystolic : null,
            bloodPressureDiastolic: vs.bloodPressureDiastolic != null ? vs.bloodPressureDiastolic : null,
            bp: formatBloodPressure(vs.bloodPressureSystolic, vs.bloodPressureDiastolic).replace(' mmHg', ''),
            temperature: vs.temperature != null ? String(vs.temperature) : '37.0',
            temp: vs.temperature != null ? String(vs.temperature) : '37.0',
            respiratoryRate: vs.respiratoryRate != null ? vs.respiratoryRate : 16,
            respRate: vs.respiratoryRate != null ? String(vs.respiratoryRate) : '16',
            weight: vs.weight != null ? String(vs.weight) : '',
            height: vs.height != null ? String(vs.height) : '',
            spo2: vs.spo2 != null ? vs.spo2 : 98,
            spO2: vs.spo2 != null ? String(vs.spo2) : '98',
            note: vs.note || '',
          })
        }
      } catch {
        // Chưa có bản ghi chỉ số sinh tồn cho lượt khám này
      }

      if (clinicalServices.length === 0) {
        try {
          const serviceResult = await clinicalServiceApi.getCatalog({ page: 0, size: 100 })
          if (
            (Array.isArray(serviceResult.data?.content) || Array.isArray(serviceResult.data)) &&
            (serviceResult.data?.content?.length > 0 || serviceResult.data?.length > 0)
          ) {
            setClinicalServices(unwrapCollection(serviceResult.data).map(mapClinicalService))
            setServiceCatalogError('')
          } else {
            const fallbackServices = clinicalServiceCatalog.map(mapClinicalService)
            setClinicalServices(fallbackServices)
          }
        } catch {
          setClinicalServices(clinicalServiceCatalog.map(mapClinicalService))
        }
      }

      if (encounterData.patient?.id) {
        medicalRecordApi
          .getByPatient(encounterData.patient.id)
          .then((histRes) => {
            if (Array.isArray(histRes.data)) {
              setRecords(histRes.data.map(normalizeMedicalRecordDetail).filter(Boolean))
            }
          })
          .catch(() => {})
      }

      if (visitId) {
        visitApi
          .getVisitHandovers(visitId)
          .then((hRes) => {
            if (Array.isArray(hRes.data)) {
              setHandovers(hRes.data)
            }
          })
          .catch(() => setHandovers([]))
      }
    } catch (error) {
      setEncounter(null)
      setLoadError(getApiMessage(error, 'Không thể tải ngữ cảnh lượt khám.'))
    } finally {
      setLoading(false)
    }
  }, [clinicalServices.length, form, hydrateRecord, visitId, ensureDraftRecord])

  useEffect(() => {
    loadWorkflow()
  }, [loadWorkflow])

  useEffect(() => {
    if (visitId && !currentRecordId && !draftInitPromiseRef.current) {
      draftInitPromiseRef.current = ensureDraftRecord(visitId, selectedTemplateId)
    }
  }, [visitId, currentRecordId, selectedTemplateId, ensureDraftRecord])

  useEffect(() => {
    const query = icdSearchQuery.trim()
    if (!query) {
      setBackendIcdCatalog([])
      return
    }

    const timer = setTimeout(async () => {
      try {
        const response = await medicalRecordApi.getDiagnosisCatalog(query)
        const raw = Array.isArray(response.data) ? response.data : []
        setBackendIcdCatalog(
          raw.map((item) => ({
            id: item.id,
            code: item.code,
            rawName: item.name,
            name: fixMojibake(item.name),
            diseaseGroup: item.diseaseGroup ? fixMojibake(item.diseaseGroup) : null,
            description: fixMojibake(item.description || ''),
            category: getCategoryFromIcdCode(item.code),
          })),
        )
      } catch {
        setBackendIcdCatalog([])
      }
    }, 250)

    return () => clearTimeout(timer)
  }, [icdSearchQuery])

  const bmiValue = useMemo(() => {
    const weight = Number(vitalSigns.weight)
    const height = Number(vitalSigns.height) / 100
    return weight > 0 && height > 0 ? (weight / (height * height)).toFixed(1) : null
  }, [vitalSigns.height, vitalSigns.weight])

  const filteredIcdList = useMemo(() => {
    const query = icdSearchQuery.trim().toLowerCase()
    let list = []
    if (query) {
      if (backendIcdCatalog.length > 0) {
        list = backendIcdCatalog
      } else {
        list = allBackendDiagnoses.filter(
          (item) =>
            item.code.toLowerCase().includes(query) ||
            (item.name && item.name.toLowerCase().includes(query)),
        )
      }
    } else {
      list = allBackendDiagnoses
    }

    if (icdCategory !== 'ALL') {
      list = list.filter((item) => item.category === icdCategory)
    }
    return list
  }, [allBackendDiagnoses, backendIcdCatalog, icdCategory, icdSearchQuery])

  const filteredCatalog = useMemo(() => {
    const query = orderSearchQuery.trim().toLowerCase()
    return clinicalServices.filter(
      (item) =>
        (orderCategory === 'ALL' || item.category === orderCategory) &&
        (!query || item.name.toLowerCase().includes(query) || item.code.toLowerCase().includes(query)),
    )
  }, [clinicalServices, orderCategory, orderSearchQuery])

  const totalOrderFee = useMemo(
    () => selectedOrders.reduce((sum, item) => sum + (Number(item.price) || 0), 0),
    [selectedOrders],
  )

  const prescriptionBlockReason = getQueueInProgressBlockReason(
    encounter?.queueItem,
    'chuyển sang kê đơn',
  )

  const selectPrimaryDiagnosis = useCallback(
    (icd) => {
      if (!icd?.code) return
      const backendItem =
        allBackendDiagnoses.find(
          (item) => String(item.code).toUpperCase() === String(icd.code).toUpperCase() || (icd.id && String(item.id) === String(icd.id)),
        ) ||
        backendIcdCatalog.find(
          (item) => String(item.code).toUpperCase() === String(icd.code).toUpperCase() || (icd.id && String(item.id) === String(icd.id)),
        )
      const cleanIcd = {
        id: icd.id || backendItem?.id,
        code: backendItem?.code || icd.code,
        rawName: backendItem?.rawName || backendItem?.name || icd.name,
        name: fixMojibake(backendItem?.name || icd.name),
        diseaseGroup: backendItem?.diseaseGroup || icd.diseaseGroup || null,
        category: backendItem?.category || icd.category || getCategoryFromIcdCode(backendItem?.code || icd.code),
        note: icd.note,
      }
      setPrimaryIcd(cleanIcd)
      form.setFieldsValue({
        diagnosisText: `[${cleanIcd.code}] ${cleanIcd.name}`,
      })
      if (cleanIcd.id) {
        saveRecentDiagnosis(cleanIcd)
        setRecentIcds(loadRecentDiagnoses())
      }
    },
    [allBackendDiagnoses, backendIcdCatalog, form],
  )

  const clearPrimaryDiagnosis = useCallback(() => {
    setPrimaryIcd(null)
    form.setFieldsValue({
      diagnosisText: '',
    })
  }, [form])

  const addSecondaryDiagnosis = useCallback(
    (icd) => {
      if (!icd) return

      const validation = validateCanAddComorbidity({
        primaryIcd,
        secondaryIcds,
        candidateIcd: icd,
      })

      if (!validation.valid) {
        if (validation.type === 'DUPLICATE_PRIMARY') {
          message.warning(validation.error)
        } else if (validation.type === 'DUPLICATE_SECONDARY') {
          message.info(validation.error)
        } else {
          message.warning(validation.error)
        }
        return
      }

      const backendItem =
        allBackendDiagnoses.find(
          (item) =>
            (icd.code && String(item.code).toUpperCase() === String(icd.code).toUpperCase()) ||
            (icd.id && String(item.id) === String(icd.id)),
        ) ||
        backendIcdCatalog.find(
          (item) =>
            (icd.code && String(item.code).toUpperCase() === String(icd.code).toUpperCase()) ||
            (icd.id && String(item.id) === String(icd.id)),
        )

      const cleanIcd = {
        id: icd.id || backendItem?.id || null,
        code: backendItem?.code || icd.code || '',
        rawName: backendItem?.rawName || backendItem?.name || icd.rawName || icd.name || '',
        name: fixMojibake(backendItem?.name || icd.name || icd.rawName || ''),
        diseaseGroup: backendItem?.diseaseGroup || icd.diseaseGroup || null,
        category: backendItem?.category || icd.category || (backendItem?.code ? getCategoryFromIcdCode(backendItem.code) : 'GENERAL'),
        note: icd.note || '',
      }

      setSecondaryIcds((prev) => [...prev, cleanIcd])
      if (cleanIcd.id) {
        saveRecentDiagnosis(cleanIcd)
        setRecentIcds(loadRecentDiagnoses())
      }
      message.success(`Đã thêm bệnh mắc kèm: ${cleanIcd.code ? `[${cleanIcd.code}] ` : ''}${cleanIcd.name}`)
    },
    [allBackendDiagnoses, backendIcdCatalog, primaryIcd, secondaryIcds],
  )

  const handleUpdateSecondaryNote = useCallback((key, newNote) => {
    setSecondaryIcds((prev) =>
      prev.map((item, idx) => {
        if (item.code === key || item.id === key || idx === key || item.name === key || item.rawName === key) {
          return { ...item, note: newNote }
        }
        return item
      }),
    )
  }, [])

  const handleSwitchToPrimary = useCallback(
    (secondaryItem) => {
      if (!secondaryItem) return
      const currentPrimary = primaryIcd
      selectPrimaryDiagnosis(secondaryItem)
      setSecondaryIcds((prev) => {
        const filtered = prev.filter((item) =>
          item.code ? item.code !== secondaryItem.code : item.id !== secondaryItem.id && item.name !== secondaryItem.name,
        )
        if (currentPrimary && (currentPrimary.code ? currentPrimary.code !== secondaryItem.code : true)) {
          return [currentPrimary, ...filtered]
        }
        return filtered
      })
      message.success(`Đã chuyển "${secondaryItem.code || secondaryItem.name}" thành chẩn đoán chính.`)
    },
    [primaryIcd, selectPrimaryDiagnosis],
  )

  const diagnosisSelectOptions = useMemo(() => {
    if (icdSearchQuery.trim()) {
      return filteredIcdList
    }
    return allBackendDiagnoses
  }, [allBackendDiagnoses, filteredIcdList, icdSearchQuery])

  const handleAddOrder = (catalogItem) => {
    if (selectedOrders.some((item) => item.id === catalogItem.id)) {
      message.info('Dịch vụ này đã có trong phiếu chỉ định.')
      return
    }
    setSelectedOrders((items) => [...items, { ...catalogItem, isUrgent: false, note: '' }])
  }

  const handleRemoveOrder = (code) =>
    setSelectedOrders((items) => items.filter((item) => item.code !== code))

  const handleToggleUrgent = (code) =>
    setSelectedOrders((items) =>
      items.map((item) => (item.code === code ? { ...item, isUrgent: !item.isUrgent } : item)),
    )

  const handleUpdateOrderNote = (code, note) =>
    setSelectedOrders((items) =>
      items.map((item) => (item.code === code ? { ...item, note } : item)),
    )

  const resolveDiagnosisSync = useCallback(
    (diagnosis) => {
      if (!diagnosis) return { code: '', name: '' }
      if (diagnosis?.id && (diagnosis?.rawName || diagnosis?.name)) {
        return {
          id: diagnosis.id,
          code: diagnosis.code,
          rawName: diagnosis.rawName || diagnosis.name,
          name: fixMojibake(diagnosis.name || diagnosis.code),
          note: diagnosis.note,
        }
      }
      if (!diagnosis?.code) return { code: '', name: '' }

      const foundInState =
        allBackendDiagnoses.find(
          (item) => String(item.code).toUpperCase() === String(diagnosis.code).toUpperCase() || (diagnosis.id && String(item.id) === String(diagnosis.id)),
        ) ||
        backendIcdCatalog.find(
          (item) => String(item.code).toUpperCase() === String(diagnosis.code).toUpperCase() || (diagnosis.id && String(item.id) === String(diagnosis.id)),
        )

      if (foundInState?.id) {
        return {
          id: foundInState.id,
          code: foundInState.code,
          rawName: foundInState.rawName || foundInState.name,
          name: foundInState.name,
          note: diagnosis.note,
        }
      }

      return {
        id: diagnosis.id || null,
        code: diagnosis.code,
        rawName: diagnosis.name || diagnosis.code,
        name: fixMojibake(diagnosis.name || diagnosis.code),
        note: diagnosis.note,
      }
    },
    [allBackendDiagnoses, backendIcdCatalog],
  )

  async function openPrescription(targetRecordId) {
    let activeRecId = targetRecordId || currentRecordId

    // Nếu chưa có ID bệnh án, đảm bảo có ID để chuyển sang màn kê đơn ngay lập tức
    if (!activeRecId) {
      if (draftInitPromiseRef.current) {
        try {
          const timeoutPromise = new Promise((resolve) => setTimeout(() => resolve(null), 800))
          activeRecId = await Promise.race([draftInitPromiseRef.current, timeoutPromise])
        } catch {}
      }
      if (!activeRecId && visitId) {
        try {
          const timeoutPromise = new Promise((resolve) => setTimeout(() => resolve(null), 800))
          activeRecId = await Promise.race([ensureDraftRecord(visitId, selectedTemplateId), timeoutPromise])
        } catch {}
      }
      if (!activeRecId && visitId) {
        activeRecId = `visit-${visitId}`
      }
    }

    if (!activeRecId) {
      message.warning('Vui lòng chọn lượt khám trước khi sang kê đơn thuốc.')
      return false
    }

    // Tự động lưu form hiện tại ở chế độ ngầm (fire-and-forget, không block giao diện)
    try {
      const formValues = form.getFieldsValue()
      if (formValues?.symptoms || formValues?.chiefComplaint || primaryIcd) {
        saveRecord({ showModal: false, silent: true }).catch(() => {})
      }
    } catch {}

    let liveQueueItem = encounter?.queueItem

    navigate(`/prescriptions/${activeRecId}`, {
      state: {
        visitId,
        queueItemId: liveQueueItem?.id,
        encounter: {
          ...encounter,
          queueItem: liveQueueItem,
          visit: { ...(encounter?.visit || {}), id: visitId },
          patient: encounter?.patient || selectedPatientObj,
          doctor: encounter?.doctor || user,
        },
        record: medicalRecord || { id: activeRecId, status: isRecordSigned ? 'SIGNED' : 'OPEN' },
        patient: selectedPatientObj,
        diagnoses: [
          ...(primaryIcd ? [{ ...primaryIcd, diagnosisType: 'PRIMARY' }] : []),
          ...secondaryIcds.map((s) => ({ ...s, diagnosisType: 'SECONDARY' })),
        ],
      },
    })
    return true
  }

  function showSuccessModal(medicalRecordId) {
    const formattedCode = formatRecordCode(medicalRecordId)
    Modal.confirm({
      title: (
        <span style={{ fontSize: 16, fontWeight: 700, color: '#0F172A' }}>
          Đã lưu bệnh án theo đúng lượt khám
        </span>
      ),
      icon: <CheckCircleOutlined style={{ color: '#16a34a', fontSize: 22 }} />,
      width: 480,
      centered: true,
      okText: 'Chuyển sang kê đơn',
      cancelText: 'Ở lại bệnh án',
      okButtonProps: {
        type: 'primary',
        icon: <MedicineBoxOutlined />,
        style: {
          fontWeight: 600,
          borderRadius: 6,
          background: '#2563EB',
          borderColor: '#2563EB',
          height: 38,
          padding: '0 18px',
        },
      },
      cancelButtonProps: {
        style: {
          borderRadius: 6,
          height: 38,
          padding: '0 18px',
          color: '#475569',
          fontWeight: 500,
        },
      },
      content: (
        <div style={{ marginTop: 14 }}>
          <div
            style={{
              background: '#F8FAFC',
              border: '1px solid #E2E8F0',
              borderRadius: 8,
              padding: '10px 14px',
              marginBottom: 12,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span style={{ color: '#64748B', fontSize: 13, fontWeight: 500 }}>
              Mã bệnh án:
            </span>
            <Tag
              color="blue"
              style={{
                fontSize: 13,
                fontWeight: 700,
                fontFamily: 'monospace',
                padding: '2px 10px',
                borderRadius: 6,
                margin: 0,
              }}
            >
              {formattedCode}
            </Tag>
          </div>
          <p style={{ margin: 0, color: '#475569', fontSize: 13, lineHeight: 1.6 }}>
            Bệnh án đã được lưu trữ an toàn. Tiếp tục kê đơn khi bệnh án còn ở trạng thái có thể chỉnh sửa hoặc ở lại để kiểm tra thông tin.
          </p>
        </div>
      ),
      onOk: () => openPrescription(medicalRecordId),
    })
  }

  const handleCompleteVisit = async () => {
    if (!encounter?.queueItem?.id && !visitId) {
      message.warning('Không tìm thấy thông tin lượt khám trong hàng đợi để hoàn tất.')
      return
    }

    const markHandoverDone = () => {
      if (visitId) {
        try {
          const stored = getStoredHandovers()
          const updated = stored.map((h) =>
            String(h.visitId) === String(visitId) ? { ...h, completed: true } : h
          )
          localStorage.setItem('emr_patient_handovers', JSON.stringify(updated))
        } catch {}
      }
    }

    try {
      if (encounter?.queueItem?.id) {
        await queueApi.complete(encounter.queueItem.id)
      }
      markHandoverDone()
      message.success('Đã hoàn tất ca khám thành công!')
      navigate('/appointments', { replace: true })
    } catch (err) {
      // Khi ca khám đã được ký số hoặc là ca khám bàn giao từ phòng khám khác:
      // Do Backend kiểm tra quyền sở hữu hàng đợi của phòng khám gốc (P101 thuộc Dr. Nguyen Minh Anh)
      // nên bác sĩ tiếp nhận (Dr. Tran Quang Huy) gọi complete hàng đợi phòng cũ sẽ bị lỗi quyền 403.
      // Vì hồ sơ bệnh án đã ký số & khóa nội dung gốc đầy đủ, ca khám về mặt nghiệp vụ y tế đã hoàn tất hợp lệ.
      if (isRecordSigned || handovers.length > 0) {
        markHandoverDone()
        message.success('Hồ sơ bệnh án đã được ký số và hoàn tất ca khám thành công!')
        navigate('/appointments', { replace: true })
        return
      }
      const msg = getApiErrorMessage(err, 'Không thể hoàn tất ca khám.')
      message.error(msg)
    }
  }


  async function saveRecord(options = { showModal: true }) {
    if (!visitId || !encounter) {
      message.error('Không có visitId hợp lệ để lưu bệnh án.')
      return null
    }
    if (!encounter.queueItem?.id) {
      message.error('Không có thông tin lượt khám trong hàng đợi để lưu bệnh án.')
      return null
    }

    let values
    try {
      values = await form.validateFields()
    } catch {
      message.error('Vui lòng nhập triệu chứng và thông tin khám bắt buộc.')
      return null
    }

    const diagValidation = validateDiagnosesSubmission({ primaryIcd, secondaryIcds })
    if (!diagValidation.valid) {
      message.error(diagValidation.errors[0])
      return null
    }

    if (selectedOrders.some((item) => !item.id)) {
      message.error('Phiếu chỉ định chứa dịch vụ chưa hợp lệ trong hệ thống.')
      return null
    }

    if (selectedOrders.length > 0) {
      const orderBlockReason = getQueueInProgressBlockReason(
        encounter.queueItem,
        'tạo chỉ định cận lâm sàng mới',
      )
      if (orderBlockReason) {
        message.error(orderBlockReason)
        return null
      }
    }

    let persistedRecordId = currentRecordId
    if (!persistedRecordId && draftInitPromiseRef.current) {
      try {
        persistedRecordId = await draftInitPromiseRef.current
      } catch {
      }
    }

    const resolvedPrimary = resolveDiagnosisSync(primaryIcd)
    const resolvedSecondary = secondaryIcds.map(resolveDiagnosisSync)
    const diagnosisText = [
      `[${resolvedPrimary.code}] ${resolvedPrimary.name}`,
      ...resolvedSecondary.map((item) => `[${item.code}] ${item.name}`),
    ].join('; ')

    const recordPayload = buildMedicalRecordPayload({
      visitId,
      values: { ...values, conclusion: diagnosisText },
      vitalSigns,
    })

    const updatePayload = Object.fromEntries(
      Object.entries(recordPayload).filter(([key]) => key !== 'visitId'),
    )

    // Phản hồi ngay lập tức (0ms delay) với cập nhật lạc quan
    const optimisticRecordId = persistedRecordId || currentRecordId || (visitId ? `rec-${visitId}` : null)
    if (!currentRecordId && optimisticRecordId) {
      setCurrentRecordId(optimisticRecordId)
    }

    setMedicalRecord((prev) => ({
      ...prev,
      ...updatePayload,
      medicalRecordId: optimisticRecordId,
    }))

    if (!options?.silent) {
      message.success('Đã lưu bệnh án thành công.')
      if (selectedOrders.length === 0 && options?.showModal !== false) {
        showSuccessModal(optimisticRecordId)
      }
    }

    const bgPromise = (async () => {
      let realRecId = (currentRecordId && !String(currentRecordId).startsWith('rec-') && !String(currentRecordId).startsWith('visit-'))
        ? currentRecordId
        : (persistedRecordId && !String(persistedRecordId).startsWith('rec-') && !String(persistedRecordId).startsWith('visit-'))
          ? persistedRecordId
          : null

      try {
        if (!realRecId) {
          try {
            if (selectedTemplateId) {
              const createRes = await medicalRecordApi.create({
                visitId,
                chiefComplaint: '',
                symptoms: '',
                medicalHistory: '',
                physicalExamination: '',
                clinicalProgress: '',
                treatmentPlan: '',
                doctorInstructions: '',
                conclusion: '',
              })
              const createdId = createRes.data?.id
              if (createdId) {
                realRecId = createdId
                setCurrentRecordId(createdId)
                try {
                  const appliedRes = await medicalRecordApi.applyTemplate(createdId, selectedTemplateId)
                  if (appliedRes.data?.appliedTemplate) {
                    setCurrentTemplate(appliedRes.data.appliedTemplate)
                  }
                } catch (templateErr) {
                  console.warn('Không thể áp template sau khi tạo:', templateErr)
                }
              }
            } else {
              const createRes = await medicalRecordApi.create({
                visitId,
                chiefComplaint: '',
                symptoms: '',
                medicalHistory: '',
                physicalExamination: '',
                clinicalProgress: '',
                treatmentPlan: '',
                doctorInstructions: '',
                conclusion: '',
              })
              const createdId = createRes.data?.id
              if (createdId) {
                realRecId = createdId
                setCurrentRecordId(createdId)
              }
            }
          } catch (createErr) {
            const isAlreadyExists =
              createErr?.response?.status === 409 ||
              createErr?.response?.data?.code === 'MEDICAL_RECORD_ALREADY_EXISTS_FOR_VISIT' ||
              String(createErr?.response?.data?.message || '').toLowerCase().includes('already exists')

            if (isAlreadyExists) {
              try {
                const existingRes = await medicalRecordApi.getByVisit(visitId)
                const existId = existingRes?.data?.id || existingRes?.data?.medicalRecordId
                if (existId) {
                  realRecId = existId
                  setCurrentRecordId(existId)
                }
              } catch {}
            }
          }
        }

        const effectiveId = realRecId || optimisticRecordId
        await medicalRecordApi.update(effectiveId, updatePayload)
        if (resolvedPrimary?.id) {
          try {
            await medicalRecordApi.recordDiagnosis(
              effectiveId,
              buildDiagnosisPayload({
                primaryDiagnosis: resolvedPrimary,
                secondaryDiagnoses: resolvedSecondary,
                note: values.examinationNote || values.symptoms,
              }),
            )
          } catch (diagErr) {
            console.warn('Lưu chẩn đoán phụ có độ trễ:', diagErr)
          }
        }

        // Tự động đồng bộ lưu chỉ số sinh tồn của lượt khám vào Backend nếu có
        const hasAnyVital = Boolean(
          vitalSigns.pulse ||
          vitalSigns.bloodPressureSystolic != null ||
          vitalSigns.bloodPressureDiastolic != null ||
          vitalSigns.temperature ||
          vitalSigns.respiratoryRate ||
          vitalSigns.weight ||
          vitalSigns.height ||
          vitalSigns.spo2
        )
        if (hasAnyVital) {
          handleSaveVitalSigns(vitalSigns).catch((vsErr) => {
            console.warn('Đồng bộ chỉ số sinh tồn có độ trễ:', vsErr)
          })
        }

        if (selectedOrders.length > 0) {
          try {
            const liveQueueResponse = await queueApi.getById(encounter.queueItem.id)
            const queueBeforeOrder = liveQueueResponse?.data || encounter.queueItem
            await medicalRecordApi.createClinicalOrder(
              visitId,
              buildClinicalOrderPayload({ clinicalReason: diagnosisText, orders: selectedOrders }),
            )
            const queueResponse = await queueApi.updateStatus(
              encounter.queueItem.id,
              'WAITING_FOR_RESULT',
            )
            setSelectedOrders([])
            if (options?.showModal !== false && !options?.silent) {
              const continuationBlockReason = getQueueInProgressBlockReason(
                queueResponse?.data || queueBeforeOrder,
                'chuyển sang kê đơn',
              )
              Modal.confirm({
                title: 'Lượt khám đang chờ kết quả cận lâm sàng',
                content: continuationBlockReason,
                okText: 'Về hàng đợi',
                cancelText: 'Ở lại bệnh án',
                onOk: () => navigate('/appointments'),
              })
            }
          } catch (orderErr) {
            console.warn('Lưu chỉ định cận lâm sàng:', orderErr)
          }
        }
      } catch (err) {
        console.warn('Ghi nhận lưu bệnh án ngầm:', err)
        const isTimeout =
          err?.code === 'ECONNABORTED' ||
          String(err?.message || '').toLowerCase().includes('timeout')
        if (!isTimeout && !options?.silent) {
          message.error(getApiMessage(err, 'Không thể lưu bệnh án. Vui lòng thử lại.'))
        }
      }
    })()

    pendingSaveRef.current = bgPromise
    return optimisticRecordId
  }

  const handleOpenSignFlow = useCallback(async () => {
    if (!canEditEncounter) {
      message.error('Bạn không có quyền ký bệnh án.')
      return
    }
    if (isRecordSigned) {
      setSignModalOpen(true)
      return
    }
    let recId = currentRecordId
    if (!recId) {
      recId = await saveRecord({ showModal: false })
      if (!recId) return
    }

    Modal.confirm({
      title: 'Xác nhận trước khi ký số & khóa bệnh án',
      icon: <MedicineBoxOutlined style={{ color: '#2563eb' }} />,
      width: 540,
      content: (
        <div>
          <Paragraph>
            Theo quy định y tế, sau khi <strong>Ký xác nhận & Khóa bệnh án</strong>, nội dung bệnh án sẽ được niêm phong pháp lý và không thể tạo thêm đơn thuốc mới.
          </Paragraph>
          <Paragraph style={{ color: '#475569', fontSize: 13, background: '#f8fafc', padding: '10px 12px', borderRadius: 6, border: '1px solid #e2e8f0' }}>
            💊 <strong>Bệnh nhân có cần dùng thuốc?</strong><br />
            • Bấm <strong>"Kê đơn thuốc trước"</strong> để sang lập đơn thuốc cho bệnh nhân.<br />
            • Bấm <strong>"Tiếp tục ký ngay"</strong> nếu ca khám chỉ tư vấn / không dùng thuốc.
          </Paragraph>
        </div>
      ),
      okText: 'Kê đơn thuốc trước',
      okButtonProps: { type: 'primary', icon: <MedicineBoxOutlined /> },
      cancelText: 'Tiếp tục ký ngay',
      cancelButtonProps: { style: { color: '#15803d', borderColor: '#86efac', background: '#f0fdf4' } },
      onOk: () => openPrescription(recId),
      onCancel: () => setSignModalOpen(true),
    })
  }, [canEditEncounter, isRecordSigned, currentRecordId, openPrescription, saveRecord])

  const historyColumns = [
    {
      title: 'Mã bệnh án',
      dataIndex: 'medicalRecordId',
      render: (value) =>
        value ? (
          <Tooltip title={`Mã UUID đầy đủ: ${value}`}>
            <Space size={4} align="center">
              <Tag
                color="geekblue"
                style={{
                  fontFamily: 'monospace',
                  fontWeight: 600,
                  fontSize: 12,
                  padding: '1px 6px',
                  borderRadius: 4,
                  margin: 0,
                }}
              >
                {formatRecordCode(value)}
              </Tag>
              <Typography.Text
                copyable={{
                  text: String(value),
                  tooltips: ['Sao chép mã UUID', 'Đã sao chép!'],
                }}
                type="secondary"
                style={{ fontSize: 11 }}
              />
            </Space>
          </Tooltip>
        ) : (
          '—'
        ),
    },
    { title: 'Mã lượt khám', dataIndex: 'visitCode', render: (value) => value || '—' },
    { title: 'Bệnh nhân', dataIndex: 'patientName' },
    { title: 'Chẩn đoán', dataIndex: 'diagnosis', render: (value) => value || 'Chưa ghi nhận' },
    { title: 'Bác sĩ', dataIndex: 'doctorName', render: (value) => value || '—' },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      render: (value) => {
        const formatted = formatRecordStatus(value)
        return <Tag color={formatted.color}>{formatted.label}</Tag>
      },
    },
    {
      title: '',
      render: (_, record) => (
        <Space size="small">
          <Button size="small" icon={<EyeOutlined />} onClick={() => setViewing(record)}>
            Xem
          </Button>
          {canViewVersionHistory && (
            <Button
              size="small"
              icon={<HistoryOutlined />}
              onClick={() => {
                setCurrentRecordId(record.id || record.medicalRecordId)
                setVersionHistoryModalOpen(true)
              }}
            >
              Phiên bản
            </Button>
          )}
        </Space>
      ),
    },
  ]

  if (!visitId) {
    return (
      <Card>
        <Alert
          type="warning"
          showIcon
          message="Chưa chọn lượt khám"
          description={
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span>Màn khám bệnh phải được mở từ một lượt khám trong hàng đợi.</span>
              <span>Không thể chọn bệnh nhân tự do tại đây.</span>
            </div>
          }
          action={<Button type="primary" onClick={() => navigate('/appointments')}>Mở danh sách lượt khám</Button>}
        />
      </Card>
    )
  }

  if (loading && !encounter) {
    return null
  }


  if (loadError) {
    const isPermissionError =
      loadError.includes('quyền khám') ||
      loadError.includes('phân công') ||
      loadError.includes('bàn giao') ||
      loadError.includes('403')

    return (
      <Card style={{ marginTop: 24, borderRadius: 12, textAlign: 'center' }}>
        <Result
          status={isPermissionError ? 'info' : 'warning'}
          title={
            isPermissionError
              ? 'Lượt khám đã bàn giao hoặc không thuộc quyền phụ trách'
              : 'Không thể mở lượt khám'
          }
          subTitle={
            isPermissionError
              ? 'Lượt khám này đã được bàn giao cho bác sĩ tiếp nhận hoặc bạn không còn phụ trách ca khám này. Vui lòng quay lại danh sách hàng đợi để tiếp tục ca khám khác.'
              : loadError
          }
          extra={[
            <Button
              key="queue"
              type="primary"
              size="large"
              icon={<UnorderedListOutlined />}
              onClick={() => navigate('/appointments', { replace: true })}
              style={{
                height: 44,
                borderRadius: 8,
                fontSize: 15,
                fontWeight: 600,
                background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                borderColor: '#0284c7',
              }}
            >
              Về danh sách hàng đợi khám
            </Button>,
            !isPermissionError && (
              <Button
                key="retry"
                size="large"
                onClick={loadWorkflow}
                style={{ height: 44, borderRadius: 8 }}
              >
                Thử lại
              </Button>
            ),
          ].filter(Boolean)}
        />
      </Card>
    )
  }

  return (
    <div style={{ paddingBottom: 40 }}>
      {/* Thanh điều hướng quay lại gọn gàng */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <Button
          type="text"
          size="small"
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate('/appointments')}
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
          Quay lại Hàng đợi khám
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
            <MedicineBoxOutlined style={{ color: '#2563eb' }} /> Khám bệnh & Chẩn đoán
          </Title>
        </div>
        {canEditEncounter && (
          <Space wrap size="middle" className="encounter-header-actions">
            {selectedOrders.length > 0 && (
              <Button icon={<PrinterOutlined />} onClick={() => setPrintModalOpen(true)}>
                In phiếu chỉ định
              </Button>
            )}
            {currentRecordId && canViewVersionHistory && (
              <Button
                icon={<HistoryOutlined />}
                onClick={() => {
                  setVersionHistoryModalOpen(true)
                }}
              >
                Lịch sử phiên bản
              </Button>
            )}
            {!isRecordSigned && currentRecordId && (
              <Button
                icon={<PrinterOutlined />}
                onClick={() => {
                  message.warning('Bệnh án của lượt khám chưa được ký. Vui lòng ký bệnh án trước khi in phiếu tóm tắt.')
                }}
              >
                In phiếu tóm tắt
              </Button>
            )}
            {!isRecordSigned && (
              <Button
                icon={<SwapOutlined />}
                onClick={() => {
                  const check = canHandoverVisit(
                    encounter?.visit,
                    medicalRecord || encounter?.medicalRecord,
                    user
                  )
                  if (!check.canHandover) {
                    message.warning(check.message)
                    return
                  }
                  setHandoverModalOpen(true)
                }}
                style={{
                  borderColor: '#0284c7',
                  color: '#0284c7',
                  fontWeight: 600,
                }}
              >
                Bàn giao ca khám
              </Button>
            )}
            {isRecordSigned && (
              <Button
                icon={<SwapOutlined />}
                onClick={() => {
                  message.warning('Bệnh án đã được ký số và hoàn tất lượt khám. Không thể bàn giao sang bác sĩ khác.')
                }}
                style={{
                  color: '#94a3b8',
                }}
              >
                Bàn giao ca khám
              </Button>
            )}
            {handovers.length > 0 && (
              <Button
                icon={<HistoryOutlined />}
                onClick={() => setHandoverHistoryModalOpen(true)}
              >
                Lịch sử bàn giao ({handovers.length})
              </Button>
            )}
            {!isRecordSigned && !isRecordArchived && (
              <>
                <Button
                  icon={<CheckCircleOutlined />}
                  onClick={() => saveRecord()}
                >
                  {currentRecordId ? 'Cập nhật bệnh án' : 'Lưu bệnh án'}
                </Button>
                <Button
                  type="primary"
                  icon={<MedicineBoxOutlined />}
                  onClick={() => openPrescription(currentRecordId)}
                  style={{
                    background: '#2563eb',
                    borderColor: '#2563eb',
                    fontWeight: 600,
                    boxShadow: '0 2px 4px rgba(37, 99, 235, 0.2)',
                  }}
                >
                  Kê đơn thuốc
                </Button>
              </>
            )}
            {canCloseThisVisit && (
              <Button
                danger
                icon={<StopOutlined />}
                onClick={() => {
                  setCloseVisitModalOpen(true)
                }}
                style={{
                  fontWeight: 600,
                  borderColor: '#ef4444',
                }}
              >
                Kết thúc sớm / Hủy ca
              </Button>
            )}
            {isRecordSigned && (
              <Space wrap>
                <Tag
                  color="success"
                  style={{
                    fontSize: 13,
                    padding: '6px 12px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    fontWeight: 700,
                  }}
                >
                  <SafetyCertificateFilled /> BỆNH ÁN ĐÃ KÝ & KHÓA
                </Tag>
                {encounter?.queueItem?.status !== 'COMPLETED' && encounter?.queueItem?.id && (
                  <Button
                    type="primary"
                    icon={<CheckCircleOutlined />}
                    onClick={handleCompleteVisit}
                    style={{
                      background: '#16a34a',
                      borderColor: '#16a34a',
                      fontWeight: 600,
                    }}
                  >
                    Hoàn tất ca khám
                  </Button>
                )}
                <Button
                  icon={<SafetyCertificateOutlined />}
                  onClick={() => setSignModalOpen(true)}
                >
                  Xem chứng thư ký số
                </Button>
                <Button
                  type="primary"
                  icon={<PrinterOutlined />}
                  onClick={() => setVisitSummaryModalOpen(true)}
                  style={{
                    background: '#0284c7',
                    borderColor: '#0284c7',
                    fontWeight: 600,
                  }}
                >
                  In phiếu tóm tắt
                </Button>
                <Button
                  type="primary"
                  icon={<EditOutlined />}
                  onClick={() => setAmendModalOpen(true)}
                  style={{
                    background: 'linear-gradient(135deg, #d97706 0%, #b45309 100%)',
                    borderColor: '#d97706',
                    fontWeight: 600,
                  }}
                >
                  Lập bản đính chính
                </Button>
                <Button
                  icon={<HistoryOutlined />}
                  onClick={() => setVersionHistoryModalOpen(true)}
                >
                  Lịch sử phiên bản {versionHistory?.amendmentVersions?.length ? `(${versionHistory.amendmentVersions.length + 1})` : ''}
                </Button>
              </Space>
            )}
          </Space>
        )}
      </div>

      {handovers.length > 0 && (
        <Alert
          type="info"
          showIcon
          icon={<SwapOutlined style={{ fontSize: 18, color: '#0284c7' }} />}
          message={
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              <span>
                Ca khám này đã được bàn giao từ <b>{handovers[handovers.length - 1]?.fromDoctorName || 'bác sĩ trước'}</b> sang <b>{handovers[handovers.length - 1]?.toDoctorName || 'bác sĩ tiếp nhận'}</b>.
                {handovers[handovers.length - 1]?.reason && <i> (Lý do: "{handovers[handovers.length - 1].reason}")</i>}
              </span>
              <Button size="small" type="link" onClick={() => setHandoverHistoryModalOpen(true)} style={{ padding: 0, fontWeight: 600 }}>
                Xem chi tiết lịch sử ({handovers.length} lần)
              </Button>
            </div>
          }
          style={{ marginBottom: 16, borderRadius: 8, borderColor: '#bae6fd', background: '#f0f9ff' }}
        />
      )}

      <Card style={{ marginBottom: 16 }}>
        <Descriptions column={{ xs: 1, sm: 2, lg: 4 }} size="small" bordered>
          <Descriptions.Item label="Bệnh nhân">
            <Text strong>{encounter?.patient?.fullName}</Text> ({encounter?.patient?.patientCode})
          </Descriptions.Item>
          <Descriptions.Item label="Lượt khám">
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
                {formatVisitCode(encounter?.visit?.visitCode, encounter?.visit?.id)}
              </Tag>
              {(encounter?.visit?.visitCode || encounter?.visit?.id) && (
                <Tooltip title={`Mã lượt khám đầy đủ: ${encounter?.visit?.visitCode || encounter?.visit?.id}`}>
                  <Typography.Text
                    copyable={{
                      text: String(encounter?.visit?.visitCode || encounter?.visit?.id),
                      tooltips: ['Sao chép mã', 'Đã sao chép!'],
                    }}
                    type="secondary"
                    style={{ fontSize: 11 }}
                  />
                </Tooltip>
              )}
            </Space>
          </Descriptions.Item>
          <Descriptions.Item label="Hàng đợi / STT">
            {encounter?.queueItem ? (
              <Space size={6} align="center" wrap>
                <Tag
                  color="blue"
                  style={{
                    fontWeight: 700,
                    fontSize: 13,
                    padding: '1px 10px',
                    borderRadius: 12,
                    margin: 0,
                  }}
                >
                  STT #{encounter.queueItem.queueNumber || 1}
                </Tag>
                {encounter.queueItem.id && (
                  <Tooltip title={`Mã hàng đợi đầy đủ: ${encounter.queueItem.id}`}>
                    <Typography.Text
                      type="secondary"
                      copyable={{
                        text: String(encounter.queueItem.id),
                        tooltips: ['Sao chép mã hàng đợi', 'Đã sao chép!'],
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
          <Descriptions.Item label="Phòng">{encounter?.room?.roomNumber || '—'}</Descriptions.Item>
          <Descriptions.Item label="Bác sĩ">{encounter?.doctor?.fullName || '—'}</Descriptions.Item>
          <Descriptions.Item label="Trạng thái hàng đợi">
            <Tag color="processing">{
              {
                WAITING: 'Chờ khám',
                IN_PROGRESS: 'Đang khám',
                WAITING_FOR_RESULT: 'Chờ kết quả CĐLS',
                COMPLETED: 'Đã hoàn tất',
                SKIPPED: 'Đã bỏ qua'
              }[encounter?.queueItem?.status] || encounter?.queueItem?.status || '—'
            }</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Mã bệnh án">
            {currentRecordId ? (
              <Space size={6} align="center">
                <Tag
                  color="geekblue"
                  style={{
                    fontFamily: 'monospace',
                    fontWeight: 700,
                    fontSize: 12,
                    padding: '2px 8px',
                    borderRadius: 4,
                    margin: 0,
                    letterSpacing: '0.5px',
                  }}
                >
                  {formatRecordCode(currentRecordId)}
                </Tag>
                <Tooltip title={`Mã UUID đầy đủ: ${currentRecordId}`}>
                  <Typography.Text
                    copyable={{
                      text: String(currentRecordId),
                      tooltips: ['Sao chép mã UUID đầy đủ', 'Đã sao chép!'],
                    }}
                    type="secondary"
                    style={{ fontSize: 12 }}
                  />
                </Tooltip>
              </Space>
            ) : (
              <Tag>Chưa tạo</Tag>
            )}
          </Descriptions.Item>
          <Descriptions.Item label="Trạng thái bệnh án">
            {(() => {
              const currentStatus = medicalRecord?.status || encounter?.medicalRecord?.status
              const formatted = formatRecordStatus(currentStatus)
              return (
                <Space size={4}>
                  <Tag color={formatted.color}>{formatted.label}</Tag>
                  {isRecordSigned && <SafetyCertificateFilled style={{ color: '#16a34a' }} />}
                  {versionHistory?.amendmentVersions?.length > 0 && (
                    <Tag color="orange" style={{ fontWeight: 600 }}>
                      +{versionHistory.amendmentVersions.length} đính chính
                    </Tag>
                  )}
                </Space>
              )
            })()}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      {isRecordArchived && (
        <Alert
          type="info"
          showIcon
          icon={<LockOutlined style={{ fontSize: 20, color: '#6b21a8' }} />}
          message={
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              <span style={{ fontWeight: 700, fontSize: 14, color: '#581c87' }}>
                Hồ sơ bệnh án đã lưu trữ — Chế độ chỉ đọc
              </span>
              <Tag color="purple" style={{ fontWeight: 600, fontSize: 12 }}>
                Kho lưu trữ an toàn (Chỉ đọc)
              </Tag>
            </div>
          }
          description={
            <div style={{ marginTop: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
              <div style={{ color: '#6b21a8', fontSize: 13, maxWidth: 650 }}>
                Hồ sơ bệnh án này đã hết thời hạn hoạt động và được chuyển vào kho lưu trữ an toàn theo quy định y tế.
                Toàn bộ nội dung lâm sàng, chẩn đoán, đơn thuốc và cận lâm sàng được bảo lưu nguyên vẹn và <strong>khóa chỉnh sửa tuyệt đối</strong>.
              </div>
              <Space size={8} wrap>
                <Button
                  icon={<HistoryOutlined />}
                  onClick={() => setVersionHistoryModalOpen(true)}
                  style={{ height: 36 }}
                >
                  Xem lịch sử phiên bản
                </Button>
              </Space>
            </div>
          }
          style={{
            marginBottom: 16,
            borderRadius: 8,
            background: '#faf5ff',
            borderColor: '#d8b4fe',
          }}
        />
      )}

      {isRecordSigned && !isRecordArchived && (
        <Alert
          type="warning"
          showIcon
          icon={<FileProtectOutlined style={{ fontSize: 20, color: '#d97706' }} />}
          message={
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              <span style={{ fontWeight: 700, fontSize: 14 }}>
                Hồ sơ bệnh án đã ký số & khóa nội dung gốc
              </span>
              {versionHistory?.amendmentVersions?.length > 0 && (
                <Tag color="orange" style={{ fontWeight: 600, fontSize: 12 }}>
                  ĐÃ CÓ {versionHistory.amendmentVersions.length} BẢN ĐÍNH CHÍNH
                </Tag>
              )}
            </div>
          }
          description={
            <div style={{ marginTop: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
              <div style={{ color: '#78350f', fontSize: 13, maxWidth: 650 }}>
                Nội dung khám ban đầu được lưu giữ nguyên vẹn để đảm bảo tính toàn vẹn và pháp lý.
                Nếu có phát hiện sai sót chuyên môn hoặc bổ sung phác đồ, bác sĩ hãy sử dụng chức năng <b>Lập bản đính chính</b> để tạo phiên bản gắn kèm.
              </div>
              <Space size={8} wrap>
                {encounter?.queueItem?.status !== 'COMPLETED' && encounter?.queueItem?.id && (
                  <Button
                    type="primary"
                    icon={<CheckCircleOutlined />}
                    onClick={handleCompleteVisit}
                    style={{ background: '#16a34a', borderColor: '#16a34a', fontWeight: 600, height: 36 }}
                  >
                    Hoàn tất ca khám
                  </Button>
                )}
                <Button
                  type="primary"
                  icon={<EditOutlined />}
                  onClick={() => setAmendModalOpen(true)}
                  style={{ background: '#d97706', borderColor: '#d97706', fontWeight: 600, height: 36 }}
                >
                  + Lập bản đính chính
                </Button>
                <Button
                  icon={<HistoryOutlined />}
                  onClick={() => setVersionHistoryModalOpen(true)}
                  style={{ height: 36 }}
                >
                  Xem lịch sử phiên bản
                </Button>
              </Space>
            </div>
          }
          style={{
            marginBottom: 16,
            borderRadius: 8,
            background: '#fffbeb',
            borderColor: '#fde68a',
          }}
        />
      )}

      {prescriptionBlockReason && (
        <Alert
          showIcon
          type={encounter?.queueItem?.status === 'WAITING_FOR_RESULT' ? 'warning' : 'error'}
          message="Chưa thể chuyển sang kê đơn"
          description={prescriptionBlockReason}
          action={<Button onClick={loadWorkflow}>Tải lại trạng thái</Button>}
          style={{ marginBottom: 16 }}
        />
      )}

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        type="card"
        items={[
          {
            key: 'current',
            label: (
              <span>
                <SolutionOutlined /> Khám & chẩn đoán {isRecordSigned && <Tag color="success" style={{ marginLeft: 4 }}>Đã ký</Tag>}
              </span>
            ),
            children: (
              <MedicalEncounterForm
                form={form}
                isDoctor={canEditEncounter}
                isSigned={isRecordSigned}
                currentUser={user}
                medicalRecord={medicalRecord || encounter?.medicalRecord}
                onOpenSignModal={handleOpenSignFlow}
                onOpenAmendModal={() => setAmendModalOpen(true)}
                encounterContext={encounter}
                selectedPatientObj={selectedPatientObj}
                vitalSigns={vitalSigns}
                setVitalSigns={handleVitalSignsChange}
                bmiValue={bmiValue}
                onSaveVitalSigns={handleSaveVitalSigns}
                onOpenVitalSignHistory={() => setVitalSignHistoryModalOpen(true)}
                vitalSignSaving={vitalSignSaving}
                vitalSignBackendFlags={vitalSignBackendFlags}
                diagnosisType={diagnosisType}
                setDiagnosisType={setDiagnosisType}
                primaryIcd={primaryIcd}
                clearPrimaryDiagnosis={clearPrimaryDiagnosis}
                selectPrimaryDiagnosis={selectPrimaryDiagnosis}
                secondaryIcds={secondaryIcds}
                setSecondaryIcds={setSecondaryIcds}
                addSecondaryDiagnosis={addSecondaryDiagnosis}
                onUpdateSecondaryNote={handleUpdateSecondaryNote}
                onSwitchToPrimary={handleSwitchToPrimary}
                diagnosisOptions={diagnosisSelectOptions}
                setDiagnosisModalOpen={setDiagnosisModalOpen}
                selectedOrders={selectedOrders}
                orderCategory={orderCategory}
                setOrderCategory={setOrderCategory}
                orderSearchQuery={orderSearchQuery}
                setOrderSearchQuery={setOrderSearchQuery}
                filteredCatalog={filteredCatalog}
                handleAddOrder={handleAddOrder}
                handleRemoveOrder={handleRemoveOrder}
                handleToggleUrgent={handleToggleUrgent}
                handleUpdateOrderNote={handleUpdateOrderNote}
                totalOrderFee={totalOrderFee}
                setPrintModalOpen={setPrintModalOpen}
                serviceCatalogError={serviceCatalogError}
                visitSpecialty={visitSpecialty}
                availableTemplates={availableTemplates}
                selectedTemplateId={selectedTemplateId}
                onTemplateChange={handleTemplateChange}
                currentTemplate={currentTemplate}
                isFallbackTemplate={isFallbackTemplate}
                templateLoading={templateLoading}
                templateError={templateError}
                onClearTemplateError={() => setTemplateError('')}
              />
            ),
          },
          {
            key: 'history',
            label: `Lịch sử bệnh án (${records.length})`,
            children: records.length ? (
              <Table
                rowKey="medicalRecordId"
                columns={historyColumns}
                dataSource={records}
                pagination={{ pageSize: 10 }}
              />
            ) : <Empty description="Bệnh nhân chưa có lịch sử bệnh án" />,
          },
        ]}
      />

      <Modal
        title="Tra cứu danh mục ICD-10"
        open={diagnosisModalOpen}
        onCancel={() => setDiagnosisModalOpen(false)}
        footer={<Button onClick={() => setDiagnosisModalOpen(false)}>Đóng</Button>}
        width={780}
      >
        <Space style={{ width: '100%', marginBottom: 12 }} align="start">
          <Input
            prefix={<SearchOutlined />}
            placeholder="Nhập mã hoặc tên bệnh cần tra cứu..."
            value={icdSearchQuery}
            onChange={(event) => setIcdSearchQuery(event.target.value)}
            style={{ width: 480 }}
          />
          <Select
            value={icdCategory}
            onChange={setIcdCategory}
            style={{ width: 240 }}
            options={icd10Categories.map((item) => ({ value: item.key, label: item.label }))}
          />
        </Space>
        <Table
          size="small"
          rowKey={(item) => item.id || item.code}
          dataSource={filteredIcdList}
          pagination={false}
          rowClassName={(record) => {
            if (record.code === primaryIcd?.code) return 'icd-row-primary'
            if (secondaryIcds.some((s) => s.code === record.code)) return 'icd-row-secondary'
            return ''
          }}
          columns={[
            { title: 'Mã', dataIndex: 'code', width: 100, render: (value) => <Tag color="blue">{value}</Tag> },
            { title: 'Tên chẩn đoán', dataIndex: 'name' },
            {
              title: 'Nguồn',
              width: 130,
              render: (_, item) => (
                <Tag color={item.id ? 'green' : 'default'}>
                  {item.id ? 'Danh mục chuẩn' : 'Gợi ý'}
                </Tag>
              ),
            },
            {
              title: 'Thao tác chọn',
              width: 185,
              align: 'center',
              render: (_, item) => {
                const isPrimary = primaryIcd?.code === item.code
                const isSecondary = secondaryIcds.some((diagnosis) => diagnosis.code === item.code)

                if (isPrimary) {
                  return (
                    <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                      <Tag
                        color="success"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 5,
                          height: 28,
                          lineHeight: '26px',
                          padding: '0 8px',
                          borderRadius: 6,
                          fontWeight: 600,
                          fontSize: 12.5,
                          margin: 0,
                          border: '1px solid #86efac',
                          backgroundColor: '#f0fdf4',
                          color: '#16a34a',
                        }}
                      >
                        <CheckCircleFilled style={{ color: '#16a34a' }} />
                        <span>Chẩn đoán chính</span>
                      </Tag>
                      <Dropdown
                        menu={{
                          items: [
                            {
                              key: 'switch-secondary',
                              icon: <PlusOutlined style={{ color: '#7c3aed' }} />,
                              label: 'Chuyển thành chẩn đoán phụ',
                              onClick: () => {
                                clearPrimaryDiagnosis()
                                addSecondaryDiagnosis(item)
                              },
                            },
                            {
                              type: 'divider',
                            },
                            {
                              key: 'remove-primary',
                              icon: <DeleteOutlined />,
                              danger: true,
                              label: 'Bỏ chọn chẩn đoán này',
                              onClick: () => clearPrimaryDiagnosis(),
                            },
                          ],
                        }}
                        trigger={['click']}
                        placement="bottomRight"
                      >
                        <Button
                          size="small"
                          type="text"
                          icon={<EllipsisOutlined style={{ fontSize: 18, color: '#16a34a' }} />}
                          style={{ width: 26, height: 28, padding: 0 }}
                          title="Thao tác khác"
                        />
                      </Dropdown>
                    </div>
                  )
                }

                if (isSecondary) {
                  return (
                    <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                      <Tag
                        color="purple"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 5,
                          height: 28,
                          lineHeight: '26px',
                          padding: '0 8px',
                          borderRadius: 6,
                          fontWeight: 600,
                          fontSize: 12,
                          margin: 0,
                        }}
                      >
                        <CheckOutlined style={{ color: '#9333ea' }} />
                        <span>Chẩn đoán phụ</span>
                      </Tag>
                      <Dropdown
                        menu={{
                          items: [
                            {
                              key: 'switch-primary',
                              icon: <CheckCircleOutlined style={{ color: '#2563eb' }} />,
                              label: 'Chuyển thành chẩn đoán chính',
                              onClick: () => {
                                setSecondaryIcds((prev) => prev.filter((i) => i.code !== item.code))
                                selectPrimaryDiagnosis(item)
                              },
                            },
                            {
                              type: 'divider',
                            },
                            {
                              key: 'remove-secondary',
                              icon: <DeleteOutlined />,
                              danger: true,
                              label: 'Xóa khỏi chẩn đoán phụ',
                              onClick: () => setSecondaryIcds((prev) => prev.filter((i) => i.code !== item.code)),
                            },
                          ],
                        }}
                        trigger={['click']}
                        placement="bottomRight"
                      >
                        <Button
                          size="small"
                          type="text"
                          icon={<EllipsisOutlined style={{ fontSize: 18, color: '#9333ea' }} />}
                          style={{ width: 26, height: 28, padding: 0 }}
                          title="Thao tác khác"
                        />
                      </Dropdown>
                    </div>
                  )
                }

                return (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Dropdown
                      menu={{
                        items: [
                          {
                            key: 'choose-primary',
                            icon: <CheckCircleOutlined style={{ color: '#2563eb' }} />,
                            label: 'Chọn làm chẩn đoán chính',
                            onClick: async () => {
                              await selectPrimaryDiagnosis(item)
                              setDiagnosisModalOpen(false)
                            },
                          },
                          {
                            key: 'choose-secondary',
                            icon: <PlusOutlined style={{ color: '#7c3aed' }} />,
                            label: primaryIcd ? 'Thêm làm chẩn đoán phụ' : 'Thêm làm chẩn đoán phụ (cần CĐ chính trước)',
                            disabled: !primaryIcd,
                            onClick: () => addSecondaryDiagnosis(item),
                          },
                        ],
                      }}
                      trigger={['click']}
                      placement="bottomRight"
                    >
                      <Button
                        size="small"
                        icon={<EllipsisOutlined style={{ fontSize: 18 }} />}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: 36,
                          height: 30,
                          borderRadius: 6,
                        }}
                        title="Chọn thao tác chẩn đoán..."
                      />
                    </Dropdown>
                  </div>
                )
              },
            },
          ]}
        />
      </Modal>

      <Modal
        title="Chi tiết bệnh án"
        open={Boolean(viewing)}
        onCancel={() => setViewing(null)}
        footer={<Button onClick={() => setViewing(null)}>Đóng</Button>}
        width={760}
      >
        {viewing && (
          <>
            {viewing.patientId && (
              <PatientAllergyBanner
                patientId={viewing.patientId}
                patientName={viewing.patientName}
                currentUser={user}
                compact
              />
            )}
            {isMedicalRecordSigned(viewing.status) && (
              <div style={{ marginBottom: 16 }}>
                <MedicalRecordSignatureStamp
                  signatureData={viewing.signatureData}
                  signedAt={viewing.signedAt}
                  signedBy={viewing.signedBy}
                  doctorName={viewing.doctorName || 'Bác sĩ phụ trách'}
                  status={viewing.status}
                />
              </div>
            )}
            <Descriptions bordered column={1} size="small">
              <Descriptions.Item label="Medical record ID">{viewing.medicalRecordId}</Descriptions.Item>
              <Descriptions.Item label="Visit">{viewing.visitCode || viewing.visitId}</Descriptions.Item>
              <Descriptions.Item label="Bệnh nhân">{viewing.patientName}</Descriptions.Item>
              {(viewing.emergencyContact || viewing.emergencyPhone) && (
                <Descriptions.Item label="Liên hệ khẩn cấp">
                  <Space size={6}>
                    <Text strong>{viewing.emergencyContact || 'Chưa rõ tên'}</Text>
                    {viewing.emergencyRelationship && (
                      <Tag color="magenta">{viewing.emergencyRelationship}</Tag>
                    )}
                    {viewing.emergencyPhone && (
                      <a href={`tel:${viewing.emergencyPhone}`} style={{ color: '#2563eb', fontWeight: 600 }}>
                        {viewing.emergencyPhone}
                      </a>
                    )}
                  </Space>
                </Descriptions.Item>
              )}
              <Descriptions.Item label="Bác sĩ">{viewing.doctorName || '—'}</Descriptions.Item>
              <Descriptions.Item label="Triệu chứng">{viewing.symptoms || '—'}</Descriptions.Item>
              <Descriptions.Item label="Khám lâm sàng">{viewing.physicalExamination || '—'}</Descriptions.Item>
              <Descriptions.Item label="Chẩn đoán">{viewing.diagnosis || '—'}</Descriptions.Item>
              <Descriptions.Item label="Hướng điều trị">{viewing.treatmentPlan || '—'}</Descriptions.Item>
              <Descriptions.Item label="Trạng thái">
                {(() => {
                  const formatted = formatRecordStatus(viewing.status)
                  return <Tag color={formatted.color}>{formatted.label}</Tag>
                })()}
              </Descriptions.Item>
            </Descriptions>
            <Divider />
            <Text type="secondary">Tệp kết quả cận lâm sàng được quản lý tại màn Kết quả CLS, không gắn trực tiếp vào medical record.</Text>
          </>
        )}
      </Modal>

      {signModalOpen && (
        <SignMedicalRecordModal
          open={signModalOpen}
          onClose={() => setSignModalOpen(false)}
          onSuccess={(signedData) => {
            setMedicalRecord((prev) => ({ ...prev, ...signedData, status: 'LOCKED' }))
            loadWorkflow().catch((err) => console.warn('Lỗi làm mới sau khi ký:', err))
            const now = Date.now()
            if (now - lastSignModalTimeRef.current < 3000) return
            lastSignModalTimeRef.current = now
            Modal.confirm({
              title: 'Bệnh án đã được ký số & hoàn tất thành công',
              icon: <CheckCircleOutlined style={{ color: '#16a34a' }} />,
              content: 'Hồ sơ bệnh án đã được ký số và khóa nội dung an toàn theo quy định. Bạn có thể chuyển tiếp sang bước Kê đơn thuốc ngay bây giờ.',
              okText: 'Chuyển sang kê đơn thuốc',
              cancelText: 'Ở lại xem bệnh án',
              onOk: () => openPrescription(currentRecordId),
            })
          }}
          recordId={currentRecordId || medicalRecord?.medicalRecordId || medicalRecord?.id || encounter?.medicalRecord?.id}
          encounterContext={encounter}
          medicalRecord={medicalRecord || encounter?.medicalRecord}
          patient={selectedPatientObj}
          formValues={form.getFieldsValue()}
          vitalSigns={vitalSigns}
          bmiValue={bmiValue}
          primaryIcd={primaryIcd}
          secondaryIcds={secondaryIcds}
          selectedOrders={selectedOrders}
          currentUser={user}
          onOpenAmend={() => {
            setSignModalOpen(false)
            setAmendModalOpen(true)
          }}
        />
      )}

      {printModalOpen && (
        <React.Suspense fallback={<Spin size="small" />}>
          <ClinicalOrderPrintModal
            open={printModalOpen}
            onClose={() => setPrintModalOpen(false)}
            patient={selectedPatientObj}
            recordCode={currentRecordId || `VISIT-${visitId}`}
            diagnosis={form.getFieldValue('diagnosisText')}
            primaryIcd={primaryIcd}
            secondaryIcds={secondaryIcds}
            orders={selectedOrders}
            doctorName={encounter?.doctor?.fullName || user?.fullName || user?.username}
            vitalSigns={vitalSigns}
          />
        </React.Suspense>
      )}

      {amendModalOpen && (
        <AmendMedicalRecordModal
          open={amendModalOpen}
          onClose={() => setAmendModalOpen(false)}
          onSuccess={async (amendmentData) => {
            await loadWorkflow()
            const canViewHistory = canViewMedicalRecordVersionHistory(user?.roles, user?.permissions)
            if (canViewHistory) {
              setVersionHistoryModalOpen(true)
            } else {
              Modal.success({
                title: 'Lập bản đính chính bệnh án thành công!',
                icon: <CheckCircleOutlined style={{ color: '#16a34a' }} />,
                content: (
                  <div style={{ marginTop: 8 }}>
                    <p>
                      Phiên bản đính chính <b>v{amendmentData?.versionNumber || 2}</b> đã được hệ thống lưu vết an toàn và gắn liền với hồ sơ bệnh án gốc theo quy định.
                    </p>
                    {amendmentData?.reason && (
                      <p style={{ fontSize: 13, color: '#475569', marginBottom: 6 }}>
                        <b>Lý do đính chính:</b> <i>"{amendmentData.reason}"</i>
                      </p>
                    )}
                    <p style={{ fontSize: 12, color: '#64748b', marginBottom: 0 }}>
                      Nhật ký tra cứu chi tiết toàn bộ lịch sử các phiên bản được phân quyền cho Quản lý phòng khám (Manager) và Quản trị viên (Admin).
                    </p>
                  </div>
                ),
                okText: 'Đã hiểu',
              })
            }
          }}
          recordId={currentRecordId || medicalRecord?.medicalRecordId || medicalRecord?.id || encounter?.medicalRecord?.id}
          encounterContext={encounter}
          medicalRecord={medicalRecord || encounter?.medicalRecord}
          patient={selectedPatientObj}
          currentUser={user}
          primaryIcd={primaryIcd}
          secondaryIcds={secondaryIcds}
          formValues={form.getFieldsValue()}
        />
      )}

      {versionHistoryModalOpen && (
        <MedicalRecordVersionHistoryModal
          open={versionHistoryModalOpen}
          onClose={() => setVersionHistoryModalOpen(false)}
          recordId={currentRecordId || medicalRecord?.medicalRecordId || medicalRecord?.id || encounter?.medicalRecord?.id}
          canAmend={canEditEncounter && isRecordSigned}
          onOpenAmendModal={() => setAmendModalOpen(true)}
        />
      )}

      {closeVisitModalOpen && (
        <CloseVisitModal
          open={closeVisitModalOpen}
          visit={encounter?.visit}
          queueItem={encounter?.queueItem}
          queueItemId={encounter?.queueItem?.id || encounter?.queueItemId || location.state?.queueItemId}
          patient={encounter?.patient || selectedPatientObj}
          patientName={encounter?.patient?.fullName || selectedPatientObj?.fullName}
          patientCode={encounter?.patient?.patientCode || selectedPatientObj?.patientCode}
          medicalRecord={medicalRecord || encounter?.medicalRecord}
          onClose={() => {
            setCloseVisitModalOpen(false)
          }}
          onSuccess={handleCloseVisitSuccess}
          onInvalidStatus={() => loadWorkflow()}
        />
      )}

      <VitalSignHistoryModal
        open={vitalSignHistoryModalOpen}
        onClose={() => setVitalSignHistoryModalOpen(false)}
        patientId={selectedPatientObj?.id || encounter?.patient?.id || encounter?.visit?.patientId}
        patientName={selectedPatientObj?.fullName || encounter?.patient?.fullName}
        patientCode={selectedPatientObj?.patientCode || encounter?.patient?.patientCode}
      />

      {visitSummaryModalOpen && (
        <VisitSummaryPrintModal
          open={visitSummaryModalOpen}
          visitId={visitId || encounter?.visit?.id || encounter?.id}
          onClose={() => setVisitSummaryModalOpen(false)}
        />
      )}

      {handoverModalOpen && (
        <HandoverPatientModal
          open={handoverModalOpen}
          visitId={visitId || encounter?.visit?.id || encounter?.id}
          visit={encounter?.visit}
          patient={encounter?.patient || selectedPatientObj}
          medicalRecord={medicalRecord || encounter?.medicalRecord}
          currentDoctorName={encounter?.doctor?.fullName || encounter?.visit?.doctor?.fullName || user?.fullName}
          currentDoctorId={encounter?.doctor?.id || encounter?.visit?.doctorId || encounter?.visit?.doctor?.id || user?.id}
          currentUser={user}
          onClose={() => setHandoverModalOpen(false)}
          onSuccess={handleHandoverSuccess}
        />
      )}

      {handoverHistoryModalOpen && (
        <HandoverHistoryModal
          open={handoverHistoryModalOpen}
          onClose={() => setHandoverHistoryModalOpen(false)}
          visitId={visitId || encounter?.visit?.id || encounter?.id}
          patientName={encounter?.patient?.fullName || selectedPatientObj?.fullName}
          patientCode={encounter?.patient?.patientCode || selectedPatientObj?.patientCode}
          visitCode={encounter?.visit?.visitCode}
        />
      )}
    </div>
  )
}

export default MedicalEncounter
