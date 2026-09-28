import axiosClient from './axiosClient.js'

/**
 * NCL-05-CN-008 / QTN-20, QTN-26: Bộ đơn thuốc mẫu theo chẩn đoán
 * Endpoints for saving, listing, getting, and applying doctor-scoped prescription templates.
 */
const prescriptionTemplateApi = {
  /**
   * Lưu một đơn thuốc hoàn tất thành đơn mẫu gắn với mã bệnh.
   * Quyền: PRESCRIPTION_CREATE (chỉ DOCTOR).
   * @param {string} prescriptionId - UUID đơn thuốc nguồn
   * @param {string} diagnosisCode - Mã chẩn đoán có trong bệnh án của đơn nguồn
   */
  save: (prescriptionId, diagnosisCode) =>
    axiosClient.post('/prescription-templates', { prescriptionId, diagnosisCode }),

  /**
   * Lấy danh sách mẫu theo mã chẩn đoán (phạm vi bác sĩ đăng nhập).
   * Quyền: PRESCRIPTION_READ (chỉ DOCTOR).
   * @param {string} diagnosisCode - Mã chẩn đoán ICD
   */
  list: (diagnosisCode) =>
    axiosClient.get('/prescription-templates', { params: { diagnosisCode } }),

  /**
   * Xem chi tiết 1 mẫu đơn thuốc.
   * Quyền: PRESCRIPTION_READ (chỉ DOCTOR).
   * @param {string} id - UUID template
   */
  getById: (id) => axiosClient.get(`/prescription-templates/${id}`),

  /**
   * Áp dụng đơn thuốc mẫu vào bệnh án (trả về bản nháp, KHÔNG lưu DB).
   * Quyền: PRESCRIPTION_CREATE (chỉ DOCTOR).
   * @param {string} id - UUID template
   * @param {string} medicalRecordId - UUID bệnh án cần áp dụng
   */
  apply: (id, medicalRecordId) =>
    axiosClient.post(`/prescription-templates/${id}/apply`, { medicalRecordId }),
}

export default prescriptionTemplateApi
