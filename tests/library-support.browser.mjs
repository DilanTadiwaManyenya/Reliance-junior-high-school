import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { mkdir } from 'node:fs/promises'
import { createServer } from 'vite'
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright')
const server = await createServer({ server: { host: '127.0.0.1', port: 0, hmr: false }, logLevel: 'error' })
let browser, base, checks = 0
async function open(width = 390, query = '') {
  const page = await browser.newPage({ viewport: { width, height: 900 } })
  page.errors = []; page.on('pageerror', error => page.errors.push(error.message))
  await page.clock.install()
  await page.route('**/file.png', route => route.fulfill({ contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64') }))
  await page.goto(base + query)
  return page
}
try {
  await server.listen()
  await mkdir('tests/artifacts', { recursive: true })
  base = `http://127.0.0.1:${server.httpServer.address().port}/tests/fixtures/library-support/index.html`
  browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge' })
  for (const width of [320,390,768,1440]) {
    const page = await open(width)
    await page.getByText('22 matching teacher notes. Showing page 1.', { exact: true }).waitFor()
    assert.equal(await page.locator('.library-support-card').count(), 20)
    assert.equal((await page.evaluate(() => window.supportFixture.signs)).length, 0); checks += 2
    assert.equal(await page.getByRole('button', { name: 'Preview Senior notes 02', exact: true }).count(), 0)
    assert.equal(await page.getByRole('button', { name: 'Download Senior notes 02', exact: true }).count(), 1)
    assert.ok(await page.locator('.library-support-filters select').evaluateAll(nodes => nodes.every(node => node.getBoundingClientRect().height >= 44 && parseFloat(getComputedStyle(node).fontSize) >= 16))); checks += 3
    await page.getByRole('button', { name: 'Next content', exact: true }).click()
    await page.getByText('22 matching teacher notes. Showing page 2.', { exact: true }).waitFor()
    assert.equal(await page.locator('.library-support-card').count(), 2); checks++
    await page.getByLabel('Support campus', { exact: true }).selectOption('senior')
    await page.getByText('21 matching teacher notes. Showing page 1.', { exact: true }).waitFor()
    assert.equal(await page.getByRole('heading', { name: 'Junior mathematics', exact: true }).count(), 0); checks++
    await page.getByLabel('Publication status', { exact: true }).selectOption('draft')
    await page.getByText('1 matching teacher notes. Showing page 1.', { exact: true }).waitFor()
    await page.getByText('Hidden from parents: draft', { exact: true }).waitFor(); checks++
    await page.getByLabel('Publication status', { exact: true }).selectOption('')
    await page.getByLabel('Grade / Form', { exact: true }).selectOption('Form 2')
    await page.getByText('10 matching teacher notes. Showing page 1.', { exact: true }).waitFor(); checks++
    await page.getByLabel('Grade / Form', { exact: true }).selectOption('')
    await page.getByLabel('Search title, teacher or subject', { exact: true }).fill('Senior notes 01')
    await page.getByRole('button', { name: 'Search library', exact: true }).click()
    await page.getByText('1 matching teacher notes. Showing page 1.', { exact: true }).waitFor()
    await page.getByRole('button', { name: 'Activity for Senior notes 01', exact: true }).click()
    await page.getByText('Activity page 1', { exact: true }).waitFor()
    assert.equal(await page.locator('.library-support-events>li').count(), 20); checks++
    await page.getByRole('button', { name: 'Next activity', exact: true }).click()
    await page.getByText('Activity page 2', { exact: true }).waitFor()
    assert.equal(await page.locator('.library-support-events>li').count(), 3); checks++
    await page.getByRole('button', { name: 'Close activity', exact: true }).click()
    await page.getByRole('button', { name: 'Preview Senior notes 01', exact: true }).click()
    await page.getByRole('heading', { name: 'File preview: Senior notes 01', exact: true }).waitFor()
    assert.equal((await page.evaluate(() => window.supportFixture.signs))[0].bucket, 'learning-library'); checks++
    if (width === 390) await page.screenshot({ path: 'tests/artifacts/library-support-stage6-mobile.png', fullPage: true })
    await page.clock.fastForward(56000)
    await page.getByText(/This private link expired/).waitFor()
    assert.equal(await page.locator('.parent-library-file img').count(), 1); checks++
    await page.getByRole('button', { name: 'Request new file link', exact: true }).click()
    await page.getByText('New downloads can use this private link for 60 seconds.', { exact: true }).waitFor()
    await page.getByRole('button', { name: 'Close file', exact: true }).click()
    await page.getByLabel('Search title, teacher or subject', { exact: true }).fill('')
    await page.getByRole('button', { name: 'Search library', exact: true }).click()
    await page.getByLabel('Content type', { exact: true }).selectOption('newsletters')
    await page.getByText('2 matching newsletters. Showing page 1.', { exact: true }).waitFor()
    await page.getByRole('button', { name: 'Download senior newsletter', exact: true }).click()
    await page.getByRole('heading', { name: 'Download ready: senior newsletter', exact: true }).waitFor()
    assert.equal((await page.evaluate(() => window.supportFixture.signs)).at(-1).bucket, 'school-newsletters'); checks++
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `No overflow at ${width}`)
    assert.equal(await page.locator('input[type=file]').count(), 0)
    assert.deepEqual(page.errors, []); checks += 3
    await page.close()
  }
  for (const role of ['admin','accountant']) {
    const page = await open(390, `?role=${role}&campus=junior`)
    await page.getByText('1 matching teacher notes. Showing page 1.', { exact: true }).waitFor()
    assert.equal(await page.getByLabel('Support campus', { exact: true }).isDisabled(), true)
    assert.equal(await page.getByRole('heading', { name: 'Senior notes 01', exact: true }).count(), 0); checks += 2
    if (role === 'accountant') {
      await page.getByRole('button', { name: 'Preview Junior mathematics', exact: true }).click()
      await page.getByRole('heading', { name: 'File preview: Junior mathematics', exact: true }).waitFor(); checks++
      await page.getByLabel('Content type', { exact: true }).selectOption('newsletters')
      await page.getByRole('button', { name: 'Activity for all newsletter', exact: true }).click()
      await page.getByText(/audit is available to Main Admin/).waitFor(); checks++
      await page.getByText('Workspace:', { exact: false }).click()
      await page.getByRole('button', { name: 'Library oversight', exact: true }).waitFor()
      assert.equal(await page.getByRole('button', { name: 'Library oversight', exact: true }).getAttribute('aria-current'), 'page'); checks++
    }
    await page.close()
  }
  for (const [role, campus] of [['teacher','junior'],['parent','junior'],['accountant','all']]) {
    const page = await open(390, `?role=${role}&campus=${campus}`)
    await page.getByText('Library support requires an Admin or accountant with an assigned campus.', { exact: true }).waitFor()
    assert.equal((await page.evaluate(() => window.supportFixture.calls)).length, 0); checks++
    await page.close()
  }
  {
    const page = await open()
    await page.getByText('22 matching teacher notes. Showing page 1.', { exact: true }).waitFor()
    await page.evaluate(() => { window.supportFixture.failList = true })
    await page.getByRole('button', { name: 'Refresh support list', exact: true }).click()
    await page.getByText('Support connection dropped', { exact: true }).waitFor()
    assert.equal(await page.locator('.library-support-card').count(), 0); checks++
    await page.evaluate(() => { window.supportFixture.failList = false })
    await page.getByRole('button', { name: 'Refresh support list', exact: true }).click()
    await page.getByRole('button', { name: 'Preview Senior notes 01', exact: true }).waitFor()
    await page.evaluate(() => { window.supportFixture.failTrace = true })
    await page.getByRole('button', { name: 'Activity for Senior notes 01', exact: true }).click()
    await page.getByText('Activity connection dropped', { exact: true }).waitFor(); checks++
    await page.evaluate(() => { window.supportFixture.failTrace = false })
    await page.getByRole('button', { name: 'Refresh activity', exact: true }).click()
    await page.getByText('Activity page 1', { exact: true }).waitFor(); checks++
    await page.getByRole('button', { name: 'Close activity', exact: true }).click()
    await page.evaluate(() => { window.supportFixture.holdFile = true })
    await page.getByRole('button', { name: 'Preview Senior notes 01', exact: true }).click()
    await page.getByLabel('Support campus', { exact: true }).selectOption('junior')
    await page.getByText('1 matching teacher notes. Showing page 1.', { exact: true }).waitFor()
    await page.evaluate(() => window.resolveHeldSupportFile())
    assert.equal(await page.locator('.parent-library-file').count(), 0); checks++
    await page.evaluate(() => { window.supportFixture.holdList = true })
    await page.getByLabel('Support campus', { exact: true }).selectOption('senior')
    await page.waitForFunction(() => window.supportFixture.calls.filter(call => call.name === 'school_library_oversight').at(-1).args.p_campus === 'senior')
    await page.evaluate(() => { window.releasePreviousSupport = window.resolveHeldSupport; window.supportFixture.holdList = false })
    await page.getByLabel('Support campus', { exact: true }).selectOption('junior')
    await page.getByText('1 matching teacher notes. Showing page 1.', { exact: true }).waitFor()
    await page.evaluate(() => window.releasePreviousSupport())
    assert.equal(await page.getByRole('heading', { name: 'Senior notes 01', exact: true }).count(), 0); checks++
    await page.close()
  }
  console.log(`${checks} library support browser assertions passed.`)
} finally { await browser?.close(); await server.close() }
