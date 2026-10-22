import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { createServer } from 'vite'
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright')
const server = await createServer({ server: { host: '127.0.0.1', port: 0, hmr: false }, logLevel: 'error' })
let browser, checks = 0
try {
  await server.listen()
  browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge' })
  const base = `http://127.0.0.1:${server.httpServer.address().port}/tests/fixtures/newsletters/index.html`
  for (const width of [320, 390, 768, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } })
    const errors = []; page.on('pageerror', error => errors.push(error.message))
    await page.route('**/file.png', route => route.fulfill({ contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64') }))
    await page.goto(base)
    await page.getByRole('button', { name: 'New newsletter', exact: true }).click()
    await page.getByLabel('Title', { exact: true }).fill('Term newsletter')
    await page.getByLabel('Newsletter text', { exact: true }).fill('Please read our school update.')
    await page.getByLabel('Campus', { exact: true }).selectOption('all')
    assert.equal(await page.getByLabel('Target campus', { exact: true }).count(), 2); checks++
    await page.getByLabel('Attachment', { exact: false }).setInputFiles({ name: 'letter.png', mimeType: 'image/png', buffer: Buffer.from('image fixture') })
    await page.getByRole('button', { name: 'Publish newsletter', exact: true }).click()
    await page.getByText('Saved as published.', { exact: true }).waitFor()
    assert.equal(await page.getByLabel('Campus', { exact: true }).isDisabled(), true)
    assert.equal(await page.getByLabel('Target campus', { exact: true }).first().isDisabled(), true); checks += 2
    const initial = await page.evaluate(() => window.newsletterFixture)
    assert.equal(initial.rows.length, 1)
    assert.equal(initial.files.filter(file => file.active).length, 1)
    assert.equal(initial.operations.find(op => op.options)?.options.upsert, false); checks += 3
    await page.getByRole('button', { name: 'Refresh school updates', exact: true }).click()
    await page.getByRole('button', { name: 'Preview attachment', exact: true }).waitFor()
    assert.equal((await page.evaluate(() => window.newsletterFixture.operations.filter(op => op.sign))).length, 0); checks++
    await page.getByRole('button', { name: 'Preview attachment', exact: true }).click()
    await page.getByRole('heading', { name: 'File preview: Term newsletter', exact: true }).waitFor(); checks++
    await page.getByRole('button', { name: 'Close file', exact: true }).click()
    await page.getByRole('button', { name: 'Mark as read', exact: true }).click()
    await page.getByText(/newsletter · .*Acknowledged/).waitFor(); checks++
    await page.evaluate(() => { window.newsletterFixture.failUpload = true })
    await page.getByLabel('Attachment', { exact: false }).setInputFiles({ name: 'replacement.png', mimeType: 'image/png', buffer: Buffer.from('replacement') })
    await page.getByRole('button', { name: 'Save published', exact: true }).click()
    await page.getByText('Upload connection dropped', { exact: true }).waitFor()
    assert.equal((await page.evaluate(() => window.newsletterFixture.files.filter(file => file.active))).length, 1); checks++
    await page.evaluate(() => { window.newsletterFixture.failUpload = false })
    await page.getByRole('button', { name: 'Save published', exact: true }).click()
    await page.getByText('Saved as published.', { exact: true }).waitFor()
    const files = await page.evaluate(() => window.newsletterFixture.files)
    assert.equal(files.filter(file => file.active).length, 1)
    assert.equal(files[0].active, false); checks += 2
    await page.evaluate(() => { window.newsletterFixture.failUpload = true; window.newsletterFixture.storedDespiteUploadError = true })
    await page.getByLabel('Attachment', { exact: false }).setInputFiles({ name: 'response-lost.png', mimeType: 'image/png', buffer: Buffer.from('stored despite response loss') })
    await page.getByRole('button', { name: 'Save published', exact: true }).click()
    await page.getByText('Saved as published.', { exact: true }).waitFor()
    const recovered = await page.evaluate(() => window.newsletterFixture.files.find(file => file.active))
    assert.equal(recovered.original_name, 'response-lost.png', 'Stored newsletter bytes should be finalized despite a lost upload response')
    await page.evaluate(() => { window.newsletterFixture.failUpload = false; window.newsletterFixture.storedDespiteUploadError = false })
    checks++
    await page.getByRole('button', { name: 'Return to draft', exact: true }).click()
    await page.getByText('Saved as draft.', { exact: true }).waitFor()
    assert.equal(await page.getByLabel('Target campus', { exact: true }).first().isDisabled(), false); checks++
    await page.getByRole('button', { name: 'Refresh school updates', exact: true }).click()
    await page.getByText('No published updates for this learner yet.', { exact: true }).waitFor(); checks++
    await page.getByRole('button', { name: 'Archive newsletter', exact: true }).click()
    await page.getByText('Saved as archived.', { exact: true }).waitFor(); checks++
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `No overflow at ${width}`)
    assert.deepEqual(errors, []); checks += 2
    await page.close()
  }
  for (const role of ['teacher', 'accountant', 'parent']) {
    const page = await browser.newPage()
    await page.goto(`${base}?role=${role}`)
    await page.getByText('Only campus Admins can manage newsletters.', { exact: true }).waitFor()
    assert.equal(await page.getByRole('button', { name: 'New newsletter', exact: true }).count(), 0); checks++
    await page.close()
  }
  console.log(`${checks} newsletter browser assertions passed.`)
} finally { await browser?.close(); await server.close() }
