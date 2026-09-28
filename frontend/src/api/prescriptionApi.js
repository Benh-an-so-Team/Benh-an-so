import axiosClient from './axiosClient.js'
import pharmacyApi from './pharmacyApi.js'

export const prescriptionApi = {
  ...pharmacyApi,
  checkMaxDailyDose: (medicalRecordId, items) =>
    axiosClient.post('/prescriptions/check-max-daily-dose', { medicalRecordId, items }),
}

export default prescriptionApi
