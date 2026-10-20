import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { mkdir } from 'node:fs/promises'
import { createServer } from 'vite'

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright')
const server = await createServer({ server: { host: '127.0.0.1', port: 0, hmr: false }, logLevel: 'error' })
let browser
let base
let checks = 0
const state = page => page.evaluate(() => ({ calls: window.parentLibraryFixture.calls, fileCalls: window.parentLibraryFixture.fileCalls, route: window.fixtureRoute }))
async function open(width = 390, route = '/portal/library?learner=senior-child') {
  const page = await browser.newPage({ viewport: { width, height: 900 }, ...(width <= 600 ? { isMobile: true, hasTouch: true } : {}) })
  page.errors = []
  page.on('pageerror', error => page.errors.push(error.message))
  await page.clock.install()
  await page.route('https://fonts.googleapis.com/**', route => route.abort())
  await page.route('https://fonts.gstatic.com/**', route => route.abort())
  await page.route('**/tests/fixtures/parent-library/file/**', route => route.fulfill({ contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64') }))
  await page.goto(`${base}/tests/fixtures/parent-library/index.html?${new URLSearchParams({ route })}`, { waitUntil: 'domcontentloaded' })
  await page.getByRole('heading', { name: 'Learning library', exact: true }).waitFor()
  return page
}
try {
  await server.listen()
  base = `http://127.0.0.1:${server.httpServer.address().port}`
  browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) })
  await mkdir('tests/artifacts', { recursive: true })
  for (const width of [320, 390, 768, 1440]) {
    const page = await open(width)
    await page.getByText('23 learning resources for this learner’s current class', { exact: true }).waitFor()
    assert.equal(await page.locator('.parent-library-note').count(), 20)
    assert.equal(await page.getByText('Junior mathematics notes', { exact: true }).count(), 0)
    assert.equal((await state(page)).fileCalls.length, 0, 'Opening the library must not fetch file contents or signed URLs')
    assert.match(await page.locator('.parent-library-scope').innerText(), /Senior School.*Form 1.*Blue/)
    checks += 4
    const metrics = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, controls: [...document.querySelectorAll('.parent-library select')].map(el => ({ right: el.getBoundingClientRect().right, height: el.getBoundingClientRect().height, font: parseFloat(getComputedStyle(el).fontSize) })) }))
    assert.ok(metrics.width <= width + 1, `No horizontal page overflow at ${width}px: ${metrics.width}`)
    assert.ok(metrics.controls.every(control => control.right <= width + 1 && control.height >= 43.9 && control.font >= 16))
    checks += 2
    await page.getByRole('button', { name: 'Next', exact: true }).click()
    await page.getByText('Page 2 of 2', { exact: true }).waitFor()
    assert.equal(await page.locator('.parent-library-note').count(), 3)
    await page.getByRole('button', { name: 'Previous', exact: true }).click()
    await page.getByText('Page 1 of 2', { exact: true }).waitFor()
    checks++
    await page.getByLabel('Subject', { exact: true }).selectOption('Combined Science')
    await page.getByText('11 learning resources for this learner’s current class', { exact: true }).waitFor()
    assert.equal(await page.locator('.parent-library-note').count(), 11)
    await page.getByLabel('Academic year', { exact: true }).selectOption('2025')
    await page.getByLabel('Term', { exact: true }).selectOption('2')
    await page.waitForFunction(() => window.parentLibraryFixture.calls.filter(call => call.name === 'parent_learning_library').at(-1)?.args.p_term === 2 && document.querySelectorAll('.parent-library-note').length === 5)
    await page.getByText('5 learning resources for this learner’s current class', { exact: true }).waitFor()
    assert.equal(await page.locator('.parent-library-note').count(), 5)
    checks += 2
    await page.getByLabel('Viewing learner', { exact: true }).selectOption('junior-child')
    await page.getByRole('heading', { name: 'Junior mathematics notes', exact: true }).waitFor()
    assert.equal(await page.locator('.parent-library-note').count(), 1)
    assert.match(await page.locator('.parent-library-scope').innerText(), /Junior School.*Grade 5/)
    const route = (await state(page)).route
    assert.ok(route.includes('learner=junior-child') && !/subject=|year=|term=|page=/.test(route), 'Changing learner resets filters and paging')
    await page.locator('.parent-portal-shell[data-campus="junior"]').waitFor()
    checks += 3
    if (width === 390) {
      await page.screenshot({ path: 'tests/artifacts/parent-library-stage4-mobile.png', fullPage: true })
      await page.getByRole('button', { name: 'Preview file', exact: true }).click()
      await page.locator('.parent-library-file img').waitFor()
      let requests = (await state(page)).fileCalls
      assert.equal(requests.at(-1).seconds, 60)
      assert.equal(requests.at(-1).options, undefined)
      const previewSrc = await page.locator('.parent-library-file img').getAttribute('src')
      await page.clock.fastForward(56000)
      await page.getByText(/This private link expired/).waitFor()
      assert.equal(await page.locator('.parent-library-file img').getAttribute('src'), previewSrc, 'An already loaded preview remains readable after link expiry')
      assert.equal(await page.getByRole('link', { name: 'Open file in a new tab', exact: true }).count(), 0)
      await page.getByRole('button', { name: 'Request new file link', exact: true }).click()
      await page.getByRole('link', { name: 'Open file in a new tab', exact: true }).waitFor()
      await page.getByRole('button', { name: 'Close file', exact: true }).click()
      await page.getByRole('button', { name: 'Prepare download', exact: true }).click()
      await page.getByRole('link', { name: 'Download junior-notes.png', exact: true }).waitFor()
      requests = (await state(page)).fileCalls
      assert.equal(requests.at(-1).options.download, 'junior-notes.png')
      checks += 5
      await page.getByRole('button', { name: 'Close file', exact: true }).click()
      await page.evaluate(() => { window.parentLibraryFixture.failFile = true })
      await page.getByRole('button', { name: 'Prepare download', exact: true }).click()
      await page.getByText(/file is no longer available, or your connection dropped/).waitFor()
      await page.evaluate(() => { window.parentLibraryFixture.failFile = false })
      await page.getByRole('button', { name: 'Request new file link', exact: true }).click()
      await page.getByRole('link', { name: 'Download junior-notes.png', exact: true }).waitFor()
      checks++
      await page.evaluate(() => { window.parentLibraryFixture.failLibrary = true })
      await page.getByRole('button', { name: 'Refresh library', exact: true }).click()
      await page.getByRole('button', { name: 'Retry library', exact: true }).waitFor()
      assert.equal(await page.locator('.parent-library-note').count(), 0, 'Failed reads cannot retain stale cards or display a false empty feed')
      await page.evaluate(() => { window.parentLibraryFixture.failLibrary = false })
      await page.getByRole('button', { name: 'Retry library', exact: true }).click()
      await page.getByRole('heading', { name: 'Junior mathematics notes', exact: true }).waitFor()
      checks++
      await page.getByRole('link', { name: 'Dashboard', exact: true }).click()
      await page.getByRole('link', { name: 'Open learning library for Junior learner', exact: true }).waitFor()
      await page.getByRole('link', { name: 'Open learning library for Junior learner', exact: true }).click()
      await page.getByRole('heading', { name: 'Junior mathematics notes', exact: true }).waitFor()
      assert.equal(await page.getByLabel('Viewing learner', { exact: true }).inputValue(), 'junior-child')
      checks++
      await page.getByLabel('Viewing learner', { exact: true }).selectOption('senior-child')
      await page.getByText('23 learning resources for this learner’s current class', { exact: true }).waitFor()
      const wordCard = page.locator('.parent-library-note').filter({ has: page.getByRole('heading', { name: 'Senior revision 02', exact: true }) })
      assert.equal(await wordCard.getByRole('button', { name: 'Preview file', exact: true }).count(), 0)
      checks++
      await page.evaluate(() => { window.parentLibraryFixture.holdSenior = true })
      await page.getByRole('button', { name: 'Refresh library', exact: true }).click()
      await page.waitForFunction(() => typeof window.resolveHeldParentLibrary === 'function')
      await page.getByLabel('Viewing learner', { exact: true }).selectOption('junior-child')
      await page.getByRole('heading', { name: 'Junior mathematics notes', exact: true }).waitFor()
      await page.evaluate(() => { window.parentLibraryFixture.holdSenior = false; window.resolveHeldParentLibrary() })
      assert.equal(await page.locator('.parent-library-note').count(), 1)
      assert.equal(await page.getByRole('heading', { name: 'Senior revision 01', exact: true }).count(), 0)
      checks += 2
      await page.getByLabel('Viewing learner', { exact: true }).selectOption('senior-child')
      await page.getByText('23 learning resources for this learner’s current class', { exact: true }).waitFor()
      await page.evaluate(() => { window.parentLibraryFixture.holdFile = true })
      await page.getByRole('button', { name: 'Prepare download', exact: true }).first().click()
      await page.waitForFunction(() => typeof window.resolveHeldParentFile === 'function')
      await page.getByLabel('Viewing learner', { exact: true }).selectOption('junior-child')
      await page.getByRole('heading', { name: 'Junior mathematics notes', exact: true }).waitFor()
      await page.evaluate(() => { window.parentLibraryFixture.holdFile = false; window.resolveHeldParentFile() })
      assert.equal(await page.locator('.parent-library-file').count(), 0, 'A previous child’s late file link must never appear after switching')
      checks++
    }
    assert.deepEqual(page.errors, [])
    checks++
    await page.close()
  }
  for (const [id, message] of [['unlinked-child', 'That learner is not linked to this account.'], ['inactive-child', 'Learning files are for currently enrolled learners']]) {
    const page = await open(390, `/portal/library?learner=${id}`)
    await page.getByText(message, { exact: false }).waitFor()
    assert.equal((await state(page)).calls.filter(call => call.name === 'parent_learning_library').length, 0)
    assert.equal(await page.locator('.parent-library-note').count(), 0)
    checks += 2
    await page.close()
  }
  console.log(`PASS ${checks} parent library browser assertions: multi-campus learners, filters/pagination, previews/downloads/expiry, retries, late-response isolation, navigation and mobile layout. Mocked Supabase transport.`)
} finally { await browser?.close(); await server.close() }
