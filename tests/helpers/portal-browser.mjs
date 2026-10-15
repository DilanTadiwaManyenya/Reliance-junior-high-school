import { createRequire } from 'node:module'
import { createServer } from 'vite'

export async function startPortalBrowser() {
  const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright')
  const server = await createServer({ server: { host: '127.0.0.1', port: 0, hmr: false }, logLevel: 'error' })
  await server.listen()
  try {
    const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) })
    const base = `http://127.0.0.1:${server.httpServer.address().port}`
    return { browser, base, close: async () => { await browser.close(); await server.close() } }
  } catch (error) { await server.close(); throw error }
}
export async function openPortal(browser, base, scenario, width = 390, height = 844) {
  const page = await browser.newPage({ viewport: { width, height }, ...(width <= 600 ? { isMobile: true, hasTouch: true } : {}) })
  await page.goto(`${base}/tests/fixtures/portal/index.html?${new URLSearchParams(scenario)}`, { waitUntil: 'domcontentloaded' })
  await page.locator('h1').first().waitFor()
  return page
}
