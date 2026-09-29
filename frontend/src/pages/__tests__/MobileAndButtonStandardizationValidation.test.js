import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const frontendDir = fs.existsSync(path.resolve('src')) ? process.cwd() : path.resolve('frontend')

test('App.jsx enforces standard Ant Design button height tokens', () => {
  const appContent = fs.readFileSync(path.join(frontendDir, 'src/App.jsx'), 'utf-8')
  assert.ok(appContent.includes('controlHeight: 38'), 'App.jsx must configure standard height 38px')
  assert.ok(appContent.includes('controlHeightSM: 30'), 'App.jsx must configure small height 30px')
  assert.ok(appContent.includes('controlHeightLG: 44'), 'App.jsx must configure large height 44px')
  assert.ok(appContent.includes('Button: {'), 'App.jsx must configure Button component theme tokens')
})

test('index.css standardizes button heights, icon-only buttons, and modal footers', () => {
  const indexCss = fs.readFileSync(path.join(frontendDir, 'src/index.css'), 'utf-8')
  
  // Enforce standard button heights
  assert.ok(indexCss.includes('.ant-modal-footer .ant-btn'), 'index.css must target modal footer buttons')
  assert.ok(indexCss.includes('height: 38px !important;'), 'index.css must enforce 38px for default buttons')
  assert.ok(indexCss.includes('height: 30px !important;'), 'index.css must enforce 30px for small buttons')
  assert.ok(indexCss.includes('height: 44px !important;'), 'index.css must enforce 44px for large buttons')
  assert.ok(indexCss.includes('min-width: 96px !important;'), 'index.css must enforce minimum 96px width for modal footer buttons')

  // Enforce icon-only buttons square dimensions
  assert.ok(indexCss.includes('.ant-btn-icon-only'), 'index.css must standardize icon-only buttons')
  assert.ok(indexCss.includes('width: 38px !important;'), 'icon-only default button must be 38px wide')
  assert.ok(indexCss.includes('width: 30px !important;'), 'icon-only small button must be 30px wide')
  assert.ok(indexCss.includes('width: 44px !important;'), 'icon-only large button must be 44px wide')
})

test('index.css includes mobile responsive rules and touch targets', () => {
  const indexCss = fs.readFileSync(path.join(frontendDir, 'src/index.css'), 'utf-8')

  // Responsive action bars
  assert.ok(indexCss.includes('.prescription-header-actions'), 'Must have prescription-header-actions class')
  assert.ok(indexCss.includes('.encounter-header-actions'), 'Must have encounter-header-actions class')
  assert.ok(indexCss.includes('.page-header-actions'), 'Must have page-header-actions class')

  // Mobile viewports
  assert.ok(indexCss.includes('@media (max-width: 768px)'), 'Must define 768px tablet/mobile breakpoint')
  assert.ok(indexCss.includes('@media (max-width: 576px)'), 'Must define 576px mobile breakpoint')
  assert.ok(indexCss.includes('@media (max-width: 480px)'), 'Must define 480px small mobile breakpoint')

  // Touch-friendly chips
  assert.ok(indexCss.includes('.allergen-chip'), 'Must style allergen-chip for touch interaction')
  assert.ok(indexCss.includes('.suggestion-chip'), 'Must style suggestion-chip for touch interaction')
  assert.ok(indexCss.includes('.dose-suggestion-tag'), 'Must style dose-suggestion-tag for touch interaction')
})

test('No tiny unreadable font-sizes (<10px) exist in core stylesheets', () => {
  const cssFiles = [
    'src/styles/appointments.css',
    'src/styles/services.css',
    'src/styles/dashboard.css',
    'src/index.css',
  ]

  const tinyFontRegex = /font-size:\s*([0-9](\.[0-9]+)?)px/g

  for (const relPath of cssFiles) {
    const fullPath = path.join(frontendDir, relPath)
    if (!fs.existsSync(fullPath)) continue
    const content = fs.readFileSync(fullPath, 'utf-8')
    const matches = [...content.matchAll(tinyFontRegex)]
    assert.equal(
      matches.length,
      0,
      `File ${relPath} contains ${matches.length} tiny font-size (<10px) rule(s): ${matches.map(m => m[0]).join(', ')}`
    )
  }
})

test('PrescriptionPage.jsx uses standardized buttons and responsive header class', () => {
  const presContent = fs.readFileSync(path.join(frontendDir, 'src/pages/PrescriptionPage.jsx'), 'utf-8')

  // Header actions have responsive container class
  assert.ok(
    presContent.includes('className="prescription-header-actions"'),
    'PrescriptionPage header action Space must include className="prescription-header-actions"'
  )

  // Copy button is standardized
  assert.ok(
    !presContent.includes('icon={<CopyOutlined />}\n                  size="large"'),
    'Prescription code copy button must not have size="large"'
  )
})

test('MedicalEncounter.jsx header actions have responsive container class', () => {
  const encounterContent = fs.readFileSync(path.join(frontendDir, 'src/pages/MedicalEncounter.jsx'), 'utf-8')
  assert.ok(
    encounterContent.includes('className="encounter-header-actions"'),
    'MedicalEncounter header action Space must include className="encounter-header-actions"'
  )
})

test('SignMedicalRecordModal.jsx canvas is mobile-responsive and supports touch events', () => {
  const signModal = fs.readFileSync(path.join(frontendDir, 'src/components/clinical/SignMedicalRecordModal.jsx'), 'utf-8')

  // Responsive canvas style
  assert.ok(signModal.includes("maxWidth: '100%'"), 'Canvas must have maxWidth: 100% to fit mobile screens')
  assert.ok(signModal.includes("touchAction: 'none'"), 'Canvas must have touchAction: none to prevent scrolling while signing')

  // Touch event handlers
  assert.ok(signModal.includes('onTouchStart='), 'Canvas must handle onTouchStart')
  assert.ok(signModal.includes('onTouchMove='), 'Canvas must handle onTouchMove')
  assert.ok(signModal.includes('onTouchEnd='), 'Canvas must handle onTouchEnd')

  // Scale computation
  assert.ok(signModal.includes('getCanvasCoordinates'), 'Must have getCanvasCoordinates calculation function')
  assert.ok(signModal.includes('scaleX'), 'Must calculate scaleX for accurate responsive touch coordinates')
  assert.ok(signModal.includes('scaleY'), 'Must calculate scaleY for accurate responsive touch coordinates')
})

test('PatientAllergyModal.jsx uses touch-friendly allergen chips and responsive grid', () => {
  const allergyModal = fs.readFileSync(path.join(frontendDir, 'src/components/clinical/PatientAllergyModal.jsx'), 'utf-8')

  assert.ok(allergyModal.includes('className="allergen-chip"'), 'Must apply allergen-chip class to quick allergen tags')
  assert.ok(allergyModal.includes('xs={24} md={14}'), 'Must use responsive Col breakpoint xs={24} md={14}')
  assert.ok(allergyModal.includes('xs={24} md={10}'), 'Must use responsive Col breakpoint xs={24} md={10}')
})
