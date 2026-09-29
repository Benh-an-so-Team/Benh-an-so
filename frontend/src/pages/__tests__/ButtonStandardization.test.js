import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const frontendDir = fs.existsSync(path.resolve('src')) ? process.cwd() : path.resolve('frontend')


test('App.jsx has standardized button theme tokens', () => {
  const appContent = fs.readFileSync(path.join(frontendDir, 'src/App.jsx'), 'utf-8')
  assert.ok(appContent.includes('controlHeight: 38'), 'App.jsx should have controlHeight: 38')
  assert.ok(appContent.includes('controlHeightSM: 30'), 'App.jsx should have controlHeightSM: 30')
  assert.ok(appContent.includes('controlHeightLG: 44'), 'App.jsx should have controlHeightLG: 44')
  assert.ok(appContent.includes('Button: {'), 'App.jsx should have Button component token')
})

test('index.css has centralized button standard rules', () => {
  const indexCss = fs.readFileSync(path.join(frontendDir, 'src/index.css'), 'utf-8')
  assert.ok(indexCss.includes('.ant-modal-footer .ant-btn'), 'index.css should standardize modal footer buttons')
  assert.ok(indexCss.includes('height: 38px !important;'), 'index.css should enforce 38px height for standard buttons')
  assert.ok(indexCss.includes('height: 30px !important;'), 'index.css should enforce 30px height for small buttons')
  assert.ok(indexCss.includes('height: 44px !important;'), 'index.css should enforce 44px height for large buttons')
  assert.ok(indexCss.includes('min-width: 96px !important;'), 'index.css should have min-width for modal footer buttons')
})

test('services.css has removed tiny font-size (10px) from modal actions', () => {
  const servicesCss = fs.readFileSync(path.join(frontendDir, 'src/styles/services.css'), 'utf-8')
  assert.ok(!servicesCss.includes('font-size: 10px;'), 'services.css should not have 10px font size')
  assert.ok(servicesCss.includes('min-width: 100px;'), 'services.css should have min-width 100px for admin modal actions')
})

test('appointments.css has removed tiny font-size (9.5px) and height 37px', () => {
  const apptCss = fs.readFileSync(path.join(frontendDir, 'src/styles/appointments.css'), 'utf-8')
  assert.ok(!apptCss.includes('font-size: 9.5px;'), 'appointments.css should not have 9.5px font size')
  assert.ok(!apptCss.includes('height: 37px;'), 'appointments.css should not have height: 37px')
  assert.ok(apptCss.includes('height: 38px;'), 'appointments.css should have standardized height 38px')
})

test('SignMedicalRecordModal, PrescriptionPage, ResultModal have symmetric button sizes', () => {
  const signModal = fs.readFileSync(path.join(frontendDir, 'src/components/clinical/SignMedicalRecordModal.jsx'), 'utf-8')
  assert.ok(!signModal.includes('key="submit"\n          type="primary"\n          icon={<CheckCircleOutlined />}\n          size="large"'), 'Sign modal submit button should not have size="large"')

  const presPage = fs.readFileSync(path.join(frontendDir, 'src/pages/PrescriptionPage.jsx'), 'utf-8')
  assert.ok(!presPage.includes('size="large"\n                          loading={saving || checkingInteractions}'), 'Prescription page save button should not have size="large"')

  const resModal = fs.readFileSync(path.join(frontendDir, 'src/components/results/ResultModal.jsx'), 'utf-8')
  assert.ok(!resModal.includes('key="saveConfirm"\n            type="primary"\n            size="large"'), 'Result modal confirm button should not have size="large"')
})
