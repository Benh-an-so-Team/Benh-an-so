import axiosClient from './axiosClient.js'
import pharmacyApi from './pharmacyApi.js'

/**
 * prescriptionReconciliationApi.js
 * 
 * API client for NCL-12-CN-007 (Đối chiếu đơn đã liên thông với đơn đã cấp phát / QTN-21).
 * Reuses existing retry endpoint from NCL-12-CN-004 via pharmacyApi.
 */
const prescriptionReconciliationApi = {
  /**
   * Search reconciliation records with server-side pagination and filters.
   * 
   * @param {Object} params
   * @param {string} [params.from] ISO-8601 instant
   * @param {string} [params.to] ISO-8601 instant
   * @param {string} [params.outcome] PrescriptionReconciliationOutcome
   * @param {boolean} [params.discrepanciesOnly]
   * @param {string} [params.prescriptionCode]
   * @param {number} [params.page]
   * @param {number} [params.size]
   * @returns {Promise} Axios response with Page<PrescriptionReconciliationItemResponse>
   */
  search: (params = {}) => {
    const formattedParams = {}
    if (params.from) formattedParams.from = params.from
    if (params.to) formattedParams.to = params.to
    if (params.outcome && params.outcome !== 'ALL') {
      formattedParams.outcome = params.outcome
    }
    if (params.discrepanciesOnly !== undefined && params.discrepanciesOnly !== null) {
      formattedParams.discrepanciesOnly = Boolean(params.discrepanciesOnly)
    }
    if (params.prescriptionCode && String(params.prescriptionCode).trim()) {
      formattedParams.prescriptionCode = String(params.prescriptionCode).trim()
    }
    formattedParams.page = params.page !== undefined ? Number(params.page) : 0
    formattedParams.size = params.size !== undefined ? Number(params.size) : 20

    return axiosClient.get('/prescription-reconciliation', { params: formattedParams })
  },

  /**
   * Read the append-only reconciliation note history of a prescription (oldest first).
   * 
   * @param {string} prescriptionId UUID
   * @returns {Promise} Axios response with List<PrescriptionReconciliationNoteResponse>
   */
  getNotes: (prescriptionId) =>
    axiosClient.get(`/prescription-reconciliation/${prescriptionId}/notes`),

  /**
   * Record a reason explaining a reconciliation discrepancy.
   * Sends both 'reason' (Backend DTO RecordPrescriptionReconciliationNoteRequest)
   * and 'note' to guarantee compatibility.
   * 
   * @param {string} prescriptionId UUID
   * @param {string|Object} note String note or object with reason
   * @returns {Promise} Axios response with PrescriptionReconciliationNoteResponse
   */
  addNote: (prescriptionId, note) => {
    const reasonText = typeof note === 'string'
      ? note.trim()
      : String(note?.reason || note?.note || '').trim()

    return axiosClient.post(`/prescription-reconciliation/${prescriptionId}/notes`, {
      reason: reasonText,
      note: reasonText,
    })
  },

  /**
   * Retransmit FAILED interconnection for a prescription (NCL-12-CN-004 reuse).
   * Restricted to ADMIN role on Backend.
   * 
   * @param {string} prescriptionId UUID
   * @returns {Promise} Axios response
   */
  retryInterconnection: (prescriptionId) =>
    pharmacyApi.retryInterconnection(prescriptionId),
}

export default prescriptionReconciliationApi
