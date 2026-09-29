import axiosClient from './axiosClient.js'

const medicalRecordApi = {
  getById: (id) => {
    return axiosClient.get(`/medical-records/${id}`)
  },
  getByVisit: (visitId, params) => {
    return axiosClient.get(`/medical-records/visits/${visitId}`, { params })
  },
  getByPatient: (patientId, params) => {
    return axiosClient.get(`/medical-records/patient/${patientId}`, { params })
  },
  create: (data) => {
    return axiosClient.post('/medical-records', data)
  },
  update: (id, data) => {
    return axiosClient.put(`/medical-records/${id}`, data)
  },
  recordDiagnosis: (recordId, data) => {
    const isUuid = (val) => typeof val === 'string' && /^[0-9a-fA-F-]{36}$/.test(val)
    const rawPrimary = data.primaryDiagnosis || data
    const rawPrimaryCatId =
      rawPrimary.diagnosisCatalogId ||
      data.primaryDiagnosisCatalogId ||
      data.diagnosisCatalogId ||
      rawPrimary.id
    const primaryCatalogId = isUuid(rawPrimaryCatId)
      ? rawPrimaryCatId
      : 'a1000000-0000-0000-0000-00000000004d'

    const secondarySource = data.secondaryDiagnoses || data.secondaryIcds || data.secondaryIcdCodes || []
    const rawSecondaries = Array.isArray(secondarySource)
      ? secondarySource
      : String(secondarySource).split(',').map((code) => code.trim()).filter(Boolean)

    const cleanedSecondaries = rawSecondaries.map((sec) => {
      const rawSecCatId = typeof sec === 'object' ? (sec.diagnosisCatalogId || sec.id) : null
      const secCatId = isUuid(rawSecCatId) ? rawSecCatId : null
      const secName = typeof sec === 'string' ? sec : (sec.name || sec.diagnosisName || sec.code || '')
      if (secCatId) {
        return {
          diagnosisCatalogId: secCatId,
          note: (typeof sec === 'object' ? sec.note : '') || '',
        }
      }
      return {
        name: secName || 'Chẩn đoán kèm theo',
        note: (typeof sec === 'object' ? sec.note : '') || '',
      }
    })

    const payload = {
      primaryDiagnosis: {
        diagnosisCatalogId: primaryCatalogId,
        note: rawPrimary.note || data.clinicalNotes || data.note || '',
      },
      secondaryDiagnoses: cleanedSecondaries,
    }

    return axiosClient.put(`/medical-records/${recordId}/diagnoses`, payload)
  },
  getDiagnosis: (recordId) => {
    return axiosClient.get(`/medical-records/${recordId}/diagnoses`)
  },
  lock: (recordId) => {
    return axiosClient.post(`/medical-records/${recordId}/lock`)
  },
  sign: (recordId, data = {}) => {
    return axiosClient.post(`/medical-records/${recordId}/sign`, data)
  },
  archive: (recordId) => {
    return axiosClient.post(`/medical-records/${recordId}/archive`)
  },
  delete: (recordId) => {
    return axiosClient.delete(`/medical-records/${recordId}`)
  },
  amend: (recordId, data) => {
    return axiosClient.post(`/medical-records/${recordId}/amendments`, data)
  },
  getVersionHistory: (recordId) => {
    return axiosClient.get(`/medical-records/${recordId}/versions`)
  },
  createClinicalOrder: (visitId, data) => {
    return axiosClient.post(`/clinical-orders/visits/${visitId}`, data)
  },
  getClinicalOrders: (visitId, params = {}) => {
    return axiosClient.get(`/clinical-orders/visits/${visitId}`, { params })
  },
  getDiagnosisCatalog: (searchQuery) => {
    return axiosClient.get('/diagnosis-catalog', { params: { search: searchQuery } })
  },
  getAccessLogsByPatient: (patientId, params = {}) => {
    return axiosClient.get('/medical-records/access-logs', { params: { patientId, ...params } })
  },
  getAccessLogsByRecord: (medicalRecordId, params = {}) => {
    return axiosClient.get(`/medical-records/${medicalRecordId}/access-logs`, { params })
  },
  exportCopy: (medicalRecordId) => {
    return axiosClient.get(`/medical-records/${medicalRecordId}/export-copy`, {
      responseType: 'blob',
    })
  },
  getVersionHistory: (medicalRecordId) => {
    return axiosClient.get(`/medical-records/${medicalRecordId}/versions`)
  },
  amendRecord: (medicalRecordId, data) => {
    return axiosClient.post(`/medical-records/${medicalRecordId}/amendments`, data)
  },
  getTemplateOptions: (medicalRecordId) => {
    return axiosClient.get(`/medical-records/${medicalRecordId}/template-options`)
  },
  getTemplateOptionsByVisit: (visitId) => {
    return axiosClient.get(`/medical-records/visits/${visitId}/template-options`)
  },
  applyTemplate: (medicalRecordId, templateId) => {
    return axiosClient.put(`/medical-records/${medicalRecordId}/template`, { templateId })
  },
  updateInstructionsAndTreatmentPlan: (medicalRecordId, data) => {
    return axiosClient.put(`/medical-records/${medicalRecordId}/instructions-and-treatment-plan`, data)
  },
  getOverdueSigning: (params = {}) => {
    return axiosClient.get('/medical-records/overdue-signing', { params })
  },
  sendSigningReminder: (medicalRecordId, data = {}) => {
    return axiosClient.post(`/medical-records/${medicalRecordId}/signing-reminders`, data)
  },
  getSigningReminders: (medicalRecordId) => {
    return axiosClient.get(`/medical-records/${medicalRecordId}/signing-reminders`)
  },
  getEligibleForArchive: (params = {}) => {
    return axiosClient.get('/medical-records/archive/eligible', { params })
  },
  searchArchived: (params = {}) => {
    return axiosClient.get('/medical-records/archive', { params })
  },
  batchArchive: (payload) => {
    return axiosClient.post('/medical-records/archive/batch', payload)
  },
}

export default medicalRecordApi
