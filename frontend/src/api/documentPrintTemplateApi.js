import axiosClient from './axiosClient.js'

const documentPrintTemplateApi = {
  /**
   * Get all print templates
   */
  getAll: () => axiosClient.get('/system/print-templates'),

  /**
   * Get specific print template by document type (INVOICE, PRESCRIPTION, VISIT_SUMMARY)
   * @param {string} documentType
   */
  getByType: (documentType) => axiosClient.get(`/system/print-templates/${documentType}`),

  /**
   * Update print template for a document type
   * @param {string} documentType
   * @param {Object} data
   */
  update: (documentType, data) => axiosClient.put(`/system/print-templates/${documentType}`, data),

  /**
   * Generate live PDF preview from backend without persisting
   * @param {Object} data
   */
  previewPdf: (data) =>
    axiosClient.post('/system/print-templates/preview', data, {
      responseType: 'blob',
    }),

  /**
   * Get audit logs for print template changes
   * @param {Object} params
   */
  getAuditHistory: (params = {}) =>
    axiosClient.get('/admin-operation-logs', {
      params: {
        resourceType: 'SYSTEM_CONFIG',
        ...params,
      },
    }),

  /**
   * Upload logo image to Cloudinary
   * @param {File} file
   */
  uploadLogo: (file) => {
    const formData = new FormData()
    formData.append('file', file)
    return axiosClient.post('/system/print-templates/logo', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
  },
}

export default documentPrintTemplateApi
