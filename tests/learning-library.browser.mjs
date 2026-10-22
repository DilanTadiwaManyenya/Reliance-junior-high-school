import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { mkdir } from 'node:fs/promises'
import { createServer } from 'vite'

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright')
const server = await createServer({ server: { host: '127.0.0.1', port: 0, hmr: false }, logLevel: 'error' })
let browser
let checks = 0
const pdf = { name: 'fractions.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\nLibrary fixture\n%%EOF') }
const fileState = page => page.evaluate(() => ({ rows: window.libraryFixture.rows, files: window.libraryFixture.files, ops: window.libraryFixture.operations }))
try {
  await server.listen()
  const base = `http://127.0.0.1:${server.httpServer.address().port}`
  browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) })
  await mkdir('tests/artifacts', { recursive: true })
  for (const width of [320, 390, 768, 1440]) for (const campus of ['junior', 'senior']) {
    const page = await browser.newPage({ viewport: { width, height: 900 }, ...(width < 600 ? { isMobile: true, hasTouch: true } : {}) })
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.route('https://fonts.googleapis.com/**', route => route.abort())
    await page.route('https://fonts.gstatic.com/**', route => route.abort())
    await page.goto(`${base}/tests/fixtures/learning-library/index.html?campus=${campus}`, { waitUntil: 'domcontentloaded' })
    await page.getByRole('heading', { name: 'Upload learning notes' }).waitFor()
    assert.equal(await page.getByRole('button', { name: 'Back to allocations', exact: true }).isVisible(), true, 'Return navigation must survive the shared teacher CSS at every viewport')
    await page.getByLabel('Academic year', { exact: true }).fill('2026')
    await page.getByLabel('Term', { exact: true }).selectOption('3')
    await page.getByLabel('Title', { exact: true }).fill('Revision notes for our allocated class')
    if (width === 390 && campus === 'senior') {
      page.once('dialog', dialog => dialog.dismiss())
      await page.getByRole('button', { name: 'Back to allocations', exact: true }).click()
      assert.equal((await fileState(page)).ops.some(op => op.navigate), false, 'Cancelled navigation must preserve the draft')
      checks++
    }
    await page.locator('input[type=file]').setInputFiles(pdf)
    await page.getByRole('button', { name: 'Publish notes', exact: true }).click()
    await page.getByText('Notes published for the learners in this allocation.', { exact: true }).waitFor()
    let state = await fileState(page)
    assert.equal(state.rows.length, 1)
    assert.equal(state.rows[0].state, 'published')
    assert.equal(state.rows[0].campus, campus)
    assert.equal(state.rows[0].class_level, campus === 'junior' ? 'Grade 5' : 'Form 1')
    assert.equal(state.rows[0].subject, campus === 'junior' ? 'Mathematics' : 'Combined Science')
    assert.equal(state.files.filter(file => file.active).length, 1)
    assert.equal(state.ops.find(op => op.upload).options.upsert, false)
    assert.equal(state.ops.some(op => op.download), false, 'Listing must not download files automatically')
    checks += 8
    const geometry = await page.evaluate(() => ({
      width: document.documentElement.scrollWidth,
      controls: [...document.querySelectorAll('.learning-library input,.learning-library select,.learning-library textarea')].map(el => ({ width: el.getBoundingClientRect().right, font: parseFloat(getComputedStyle(el).fontSize), height: el.getBoundingClientRect().height })),
    }))
    assert.ok(geometry.width <= width + 1, `No horizontal overflow at ${width}px (${campus}): ${geometry.width}`)
    assert.ok(geometry.controls.every(control => control.width <= width + 1 && control.font >= 16 && control.height >= 43.9))
    checks += 2
    if (width === 390 && campus === 'senior') {
      await page.getByRole('button', { name: 'Edit notes', exact: true }).click()
      await page.getByLabel('Title', { exact: true }).fill('Updated revision notes')
      await page.evaluate(() => { window.libraryFixture.failUpload = true })
      await page.locator('input[type=file]').setInputFiles({ ...pdf, name: 'replacement.pdf' })
      await page.getByRole('button', { name: 'Save changes', exact: true }).click()
      const uploadAlert = page.getByRole('alert').filter({ hasText: /Upload connection dropped/ })
      await uploadAlert.waitFor()
      assert.equal(await uploadAlert.isVisible(), true, 'Failed upload must show an alert')
      await page.waitForFunction(() => {
        const element = document.querySelector('.library-error-focus [role="alert"]')
        if (!element) return false
        const box = element.getBoundingClientRect()
        return box.bottom > 0 && box.top < innerHeight
      }, null, { timeout: 5000 })
      state = await fileState(page)
      assert.equal(state.rows.length, 1)
      assert.equal(state.files.find(file => file.active).original_name, 'fractions.pdf')
      assert.equal(await page.getByLabel('Title', { exact: true }).inputValue(), 'Updated revision notes')
      await page.evaluate(() => { window.libraryFixture.failUpload = false })
      await page.getByRole('button', { name: 'Save changes', exact: true }).click()
      await page.getByText('Your published notes have been updated.', { exact: true }).waitFor()
      state = await fileState(page)
      assert.equal(state.rows.length, 1)
      assert.equal(state.files.filter(file => file.active).length, 1)
      assert.equal(state.files.find(file => file.active).original_name, 'replacement.pdf')
      checks += 6
      await page.getByRole('button', { name: 'Prepare download', exact: true }).click()
      await page.getByRole('link', { name: /Download replacement.pdf/ }).waitFor()
      assert.equal((await fileState(page)).ops.find(op => op.download).seconds, 60)
      checks++
      page.once('dialog', dialog => dialog.accept())
      await page.getByRole('button', { name: 'Archive notes', exact: true }).click()
      await page.getByText('Notes archived.', { exact: true }).waitFor()
      assert.equal((await fileState(page)).rows[0].state, 'archived')
      await page.getByRole('button', { name: 'Restore to draft', exact: true }).click()
      await page.getByText('Notes restored to draft. Review and publish when ready.', { exact: true }).waitFor()
      assert.equal((await fileState(page)).rows[0].state, 'draft')
      checks += 2
      await page.getByLabel('Title', { exact: true }).fill('Publication retry example')
      await page.locator('input[type=file]').setInputFiles(pdf)
      await page.evaluate(() => { window.libraryFixture.failPublish = true })
      await page.getByRole('button', { name: 'Publish notes', exact: true }).click()
      await page.getByText(/Publication connection dropped/).waitFor()
      const uploadsBefore = (await fileState(page)).ops.filter(op => op.upload).length
      await page.evaluate(() => { window.libraryFixture.failPublish = false })
      await page.getByRole('button', { name: 'Publish notes', exact: true }).click()
      await page.getByText('Notes published for the learners in this allocation.', { exact: true }).waitFor()
      state = await fileState(page)
      assert.equal(state.rows.length, 2)
      assert.equal(state.ops.filter(op => op.upload).length, uploadsBefore, 'Publication retry must reuse the already finalized file')
      checks += 2
      await page.locator('input[type=file]').setInputFiles({ name: 'unsafe.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg/>') })
      await page.getByText(/matching file type/).waitFor()
      checks++
      await page.evaluate(() => { window.libraryFixture.failLoad = true })
      await page.getByRole('button', { name: 'Refresh notes', exact: true }).click()
      await page.getByText('Library connection unavailable').waitFor()
      await page.evaluate(() => { window.libraryFixture.failLoad = false })
      await page.getByRole('button', { name: 'Retry notes', exact: true }).click()
      await page.getByRole('heading', { name: 'Publication retry example', exact: true }).waitFor()
      checks++
    }
    if (width === 390) await page.screenshot({ path: `tests/artifacts/library-stage3-${campus}-mobile.png`, fullPage: true })
    assert.deepEqual(errors, [], `No browser errors (${campus}, ${width}px)`)
    checks++
    await page.close()
  }
  const ecdPage = await browser.newPage({ viewport: { width: 390, height: 844 } })
  await ecdPage.goto(`${base}/tests/fixtures/learning-library/index.html?campus=junior&level=ECD%20A`, { waitUntil: 'domcontentloaded' })
  await ecdPage.getByRole('heading', { name: 'Upload learning notes' }).waitFor()
  assert.equal(await ecdPage.getByLabel('Subject', { exact: true }).inputValue(), 'English Languages')
  await ecdPage.getByLabel('Title', { exact: true }).fill('ECD weekly notes')
  ecdPage.once('dialog', dialog => dialog.dismiss())
  await ecdPage.getByLabel('Subject', { exact: true }).selectOption('Indigenous Languages')
  assert.equal(await ecdPage.getByLabel('Subject', { exact: true }).inputValue(), 'English Languages', 'Cancelled subject change preserves the draft scope')
  assert.equal(await ecdPage.getByLabel('Title', { exact: true }).inputValue(), 'ECD weekly notes')
  checks += 3
  await ecdPage.close()
  console.log(`PASS ${checks} teacher library browser assertions across Junior/Senior at 320, 390, 768 and 1440px, plus ECD subject/draft protection. Mocked Supabase transport; no live credentials changed.`)
} finally { await browser?.close(); await server.close() }
