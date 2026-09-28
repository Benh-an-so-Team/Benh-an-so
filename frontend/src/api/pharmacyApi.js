import axiosClient from './axiosClient.js'

const pharmacyApi = {
  medicines: (params) => axiosClient.get('/medicines', { params: { size: 200, ...params } }),
  prescriptions: (params = { status: 'PENDING_DISPENSE' }) => axiosClient.get('/prescriptions', { params }),
  getByMedicalRecord: (medicalRecordId) => axiosClient.get(`/prescriptions/medical-records/${medicalRecordId}`),
  getById: (id) => axiosClient.get(`/prescriptions/${id}`),
  checkInteractions: (drugIds) => axiosClient.post('/prescriptions/check-interactions', { drugIds }),
  checkAllergyWarnings: (medicalRecordId, medicineIds) =>
    axiosClient.post('/prescriptions/check-allergy-warnings', { medicalRecordId, medicineIds }),
  checkContraindications: (medicalRecordId, medicineIds) =>
    axiosClient.post('/prescriptions/check-contraindications', { medicalRecordId, medicineIds }),
  checkMaxDailyDose: (medicalRecordId, items) =>
    axiosClient.post('/prescriptions/check-max-daily-dose', { medicalRecordId, items }),
  getAllergyWarningLogs: (params) => axiosClient.get('/prescriptions/allergy-warning-logs', { params }),
  createPrescription: (data) => axiosClient.post('/prescriptions', data),
  updatePrescription: (id, data) => axiosClient.patch(`/prescriptions/${id}`, data),
  cancelPrescription: (id, data) =>
    axiosClient.post(
      `/prescriptions/${id}/cancel`,
      typeof data === 'string' ? { cancelReason: data } : (data || {})
    ),
  printPrescription: (id) => axiosClient.get(`/prescriptions/${id}/print`, { responseType: 'blob' }),
  stocks: (params) => axiosClient.get('/inventory/stocks', { params }),
  lowStock: () => axiosClient.get('/inventory/low-stock'),
  batches: (params) => axiosClient.get('/inventory/batches', { params }),
  createMedicine: (data) => axiosClient.post('/medicines', data),
  updateMedicine: (id, data) => axiosClient.put(`/medicines/${id}`, data),
  updateMedicineStatus: (id, active) => axiosClient.patch(`/medicines/${id}/status`, { active }),
  receiveBatch: (data) => axiosClient.post('/inventory/receipts', data),
  dispense: (id) => axiosClient.post(`/prescriptions/${id}/dispense`),
  partialDispense: (prescriptionId, items) =>
    axiosClient.post(`/prescriptions/${prescriptionId}/partial-dispense`, { items }),
  dispenseHistory: (prescriptionId) =>
    axiosClient.get(`/prescriptions/${prescriptionId}/dispense-history`),
  adjustBatchStock: (batchId, data) => axiosClient.post(`/inventory/batches/${batchId}/adjust`, data),
  discardExpiredBatch: (batchId, data) => axiosClient.post(`/inventory/batches/${batchId}/discard`, data),
  expiryAlerts: (params) => axiosClient.get('/inventory/expiry-alerts', { params }),
  sendToInterconnection: (id) => axiosClient.post(`/prescriptions/${id}/interconnection`),
  retryInterconnection: (id) => axiosClient.post(`/prescriptions/${id}/interconnection/retry`),
  searchInterconnections: (params) => axiosClient.get('/prescription-interconnections', { params }),
}

export default pharmacyApi
