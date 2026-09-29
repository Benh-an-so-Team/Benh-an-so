import axiosClient from './axiosClient.js'

/**
 * API service for exporting medical records according to data exchange structure (NCL-11-CN-007).
 * Encapsulates single export and batch export with standard 5 blocks:
 * 1. Administrative, Facility & Encounter
 * 2. Primary/Secondary Diagnoses with ICD-10 codes (QTN-22)
 * 3. Clinical Orders
 * 4. Clinical Results
 * 5. Prescriptions
 */

/**
 * Batch export signed medical records according to standard data exchange structure.
 * @param {string[]|{medicalRecordIds?: string[], visitIds?: string[], format?: string}} payloadOrRecordIds
 * @returns {Promise<import('axios').AxiosResponse<Blob>>}
 */
export const exportBatch = (payloadOrRecordIds) => {
  const payload = Array.isArray(payloadOrRecordIds)
    ? { medicalRecordIds: payloadOrRecordIds, format: 'JSON' }
    : {
        format: 'JSON',
        ...payloadOrRecordIds,
      }

  return axiosClient.post('/medical-records/export', payload, {
    responseType: 'blob',
  })
}

/**
 * Export single signed medical record according to standard data exchange structure.
 * @param {string} medicalRecordId
 * @returns {Promise<import('axios').AxiosResponse<Blob>>}
 */
export const exportSingle = (medicalRecordId) => {
  return axiosClient.get(`/medical-records/${medicalRecordId}/export`, {
    responseType: 'blob',
  })
}

const medicalRecordExportApi = {
  exportBatch,
  exportSingle,
}

export default medicalRecordExportApi
