import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { preview } from 'vite'

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright')
const server = await preview({ preview: { host: '127.0.0.1', port: 0 }, logLevel: 'error' })
const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge' })
try {
  const context = await browser.newContext({ viewport: { width: 320, height: 640 }, reducedMotion: 'reduce' })
  await context.route('https://fonts.googleapis.com/**', route => route.abort())
  await context.route('https://fonts.gstatic.com/**', route => route.abort())
  const page = await context.newPage()
  await page.addInitScript(() => Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => window.__testOnline ?? true }))
  const base = `http://127.0.0.1:${server.httpServer.address().port}`

  await page.goto(`${base}/portal/login`, { waitUntil: 'networkidle' })
  const notice = page.getByRole('status')
  assert.equal(await notice.count(), 0, 'No connection warning while the browser reports online')
  await page.evaluate(() => { window.__testOnline = false; window.dispatchEvent(new Event('offline')) })
  await notice.getByText(/device reports that it is offline/).waitFor()
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Offline notice fits a 320px phone')

  await page.evaluate(() => { window.__testOnline = true; window.dispatchEvent(new Event('online')) })
  await notice.getByText(/connection is back/).waitFor()
  await page.waitForTimeout(7200)
  assert.equal(await notice.count(), 0, 'Recovery notice clears without triggering a retry')

  await page.goto(`${base}/`, { waitUntil: 'networkidle' })
  await page.evaluate(() => { window.__testOnline = false; window.dispatchEvent(new Event('offline')) })
  assert.equal(await page.getByRole('status').count(), 0, 'The portal-only notice does not appear on public pages')
  await context.close()

  const slowContext = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' })
  await slowContext.route('https://fonts.googleapis.com/**', route => route.abort())
  await slowContext.route('https://fonts.gstatic.com/**', route => route.abort())
  const slowPage = await slowContext.newPage()
  const cdp = await slowContext.newCDPSession(slowPage)
  await cdp.send('Network.enable')
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false, latency: 450, downloadThroughput: 200 * 1024 / 8,
    uploadThroughput: 100 * 1024 / 8, connectionType: 'cellular3g',
  })
  const started = Date.now()
  await slowPage.goto(`${base}/portal/login`, { waitUntil: 'domcontentloaded', timeout: 20000 })
  await slowPage.getByRole('heading', { name: 'Welcome back' }).waitFor({ timeout: 20000 })
  const elapsedMs = Date.now() - started
  assert.ok(elapsedMs < 20000, `Portal login should render under the simulated mobile-data limit (${elapsedMs}ms)`)
  await slowContext.close()
  console.log('PASS 320px portal offline/reconnected status, no automatic retry, and public-page scope')
  console.log(`PASS 390px 3G-throttled portal login rendered in ${elapsedMs}ms`)
} finally {
  await browser.close()
  await server.close()
}
