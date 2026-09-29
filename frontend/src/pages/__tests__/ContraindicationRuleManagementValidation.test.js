import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import contraindicationRuleManagementApi from '../../api/contraindicationRuleManagementApi.js'
import { getNavigationItems } from '../../components/layout/navigationConfig.js'
import {
  DIAGNOSIS_CATALOG_FALLBACK,
  getDiagnosisInfo,
} from '../../utils/contraindicationValidation.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const frontendDir = path.resolve(__dirname, '../../..')

test('TC-CRM-01: contraindicationRuleManagementApi cung cấp đầy đủ các hàm CRUD và import', () => {
  assert.equal(typeof contraindicationRuleManagementApi.searchRules, 'function')
  assert.equal(typeof contraindicationRuleManagementApi.createRule, 'function')
  assert.equal(typeof contraindicationRuleManagementApi.updateRule, 'function')
  assert.equal(typeof contraindicationRuleManagementApi.deactivateRule, 'function')
  assert.equal(typeof contraindicationRuleManagementApi.activateRule, 'function')
  assert.equal(typeof contraindicationRuleManagementApi.importRules, 'function')
})

test('TC-CRM-02: navigationConfig.js tích hợp menu Quy tắc chống chỉ định cho phân quyền phù hợp', () => {
  const adminItems = getNavigationItems(['admin'], [])
  const hasRuleMenuAdmin = adminItems.some((item) => item.key === '/contraindication-rules')
  assert.ok(hasRuleMenuAdmin, 'Admin phải thấy menu Quy tắc chống chỉ định')

  const doctorItems = getNavigationItems(['doctor'], ['CONTRAINDICATION_RULE_MANAGE'])
  const hasRuleMenuDoctor = doctorItems.some((item) => item.key === '/contraindication-rules')
  assert.ok(hasRuleMenuDoctor, 'Bác sĩ có quyền CONTRAINDICATION_RULE_MANAGE phải thấy menu')

  const receptionistItems = getNavigationItems(['receptionist'], [])
  const hasRuleMenuRecep = receptionistItems.some((item) => item.key === '/contraindication-rules')
  assert.equal(hasRuleMenuRecep, false, 'Lễ tân không có quyền không được thấy menu')
})

test('TC-CRM-03: AppRoutes.jsx đăng ký route /contraindication-rules và component ContraindicationRuleManagementPage', () => {
  const appRoutesContent = fs.readFileSync(
    path.join(frontendDir, 'src/routes/AppRoutes.jsx'),
    'utf-8',
  )
  assert.ok(
    appRoutesContent.includes('ContraindicationRuleManagementPage'),
    'AppRoutes phải import ContraindicationRuleManagementPage',
  )
  assert.ok(
    appRoutesContent.includes('path="contraindication-rules"'),
    'AppRoutes phải khai báo path contraindication-rules',
  )
  assert.ok(
    appRoutesContent.includes('CONTRAINDICATION_RULE_MANAGE'),
    'Route phải bảo vệ bởi quyền CONTRAINDICATION_RULE_MANAGE',
  )
})

test('TC-CRM-04: getDiagnosisInfo và DIAGNOSIS_CATALOG_FALLBACK đối chiếu đúng mã ICD-10 và tên bệnh', () => {
  const asthmaRule = {
    type: 'DISEASE',
    diagnosisCatalogId: 'a1000000-0000-0000-0000-000000000023',
  }
  const ulcerRule = {
    type: 'DISEASE',
    diagnosisCatalogId: 'a1000000-0000-0000-0000-000000000026',
  }

  const asthmaInfo = getDiagnosisInfo(asthmaRule)
  assert.equal(asthmaInfo.code, 'J45.9')
  assert.equal(asthmaInfo.name, 'Hen phế quản')
  assert.equal(asthmaInfo.displayText, 'J45.9 - Hen phế quản')

  const ulcerInfo = getDiagnosisInfo(ulcerRule)
  assert.equal(ulcerInfo.code, 'K25.9')
  assert.equal(ulcerInfo.name, 'Loét dạ dày')
  assert.equal(ulcerInfo.displayText, 'K25.9 - Loét dạ dày')

  // Xác nhận không còn hiển thị chuỗi kỹ thuật UUID rút gọn
  assert.ok(!asthmaInfo.displayText.includes('a1000000'))
  assert.ok(!ulcerInfo.displayText.includes('a1000000'))
})

