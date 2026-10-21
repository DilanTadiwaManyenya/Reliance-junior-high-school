import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { createServer } from 'vite'

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright')
const server = await createServer({ server: { host: '127.0.0.1', port: 0, hmr: false }, logLevel: 'error' })
let browser
try {
  await server.listen()
  browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) })
  const base = `http://127.0.0.1:${server.httpServer.address().port}/tests/fixtures/teacher-workspace/index.html`
  for (const width of [320, 390, 768, 1024, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } })
    await page.route('https://fonts.googleapis.com/**', route => route.abort())
    await page.route('https://fonts.gstatic.com/**', route => route.abort())
    await page.goto(`${base}?campus=senior&section=coursework&workspace=subjects&allocation=allocation&subject=Combined+Science&level=Form+1`)
    await page.getByRole('heading', { name: 'Course Work', exact: true }).waitFor()
    assert.equal(await page.getByRole('button', { name: 'Subject work', exact: true }).getAttribute('aria-pressed'), 'true')
    const menu = page.getByRole('button', { name: 'Open navigation menu', exact: true })
    if (await menu.isVisible()) await menu.click()
    await page.getByRole('button', { name: 'Subject allocations', exact: true }).click()
    await page.getByRole('heading', { name: 'Choose a subject allocation', exact: true }).waitFor()
    assert.equal(new URL(page.url()).searchParams.has('allocation'), false)
    assert.equal(new URL(page.url()).searchParams.has('subject'), false)
    await page.locator('.subject-allocation-card').click()
    await page.getByRole('button', { name: 'Open course work', exact: true }).click()
    await page.getByRole('heading', { name: 'Course Work', exact: true }).waitFor()
    assert.equal(new URL(page.url()).searchParams.get('allocation'), 'allocation')
    await page.goBack()
    await page.getByRole('heading', { name: 'Combined Science · Form 1', exact: true }).waitFor()
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `No horizontal page overflow at ${width}`)
    await page.getByRole('button', { name: 'Class work', exact: true }).click()
    await page.waitForFunction(() => new URLSearchParams(location.search).get('section') === 'roster')
    assert.equal(await page.getByRole('button', { name: 'Class work', exact: true }).getAttribute('aria-pressed'), 'true')
    assert.equal(new URL(page.url()).searchParams.has('allocation'), false)
    console.log(`PASS Senior teacher allocation menu, scope reset, browser Back and class switch at ${width}px`)
    await page.close()
  }
} finally {
  await browser?.close()
  await server.close()
}
