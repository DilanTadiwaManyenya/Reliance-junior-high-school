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
  page.portalErrors = []
  page.on('pageerror', error => page.portalErrors.push(error.message))
  await page.goto(`${base}/tests/fixtures/portal/index.html?${new URLSearchParams(scenario)}`, { waitUntil: 'domcontentloaded' })
  await page.locator('h1').first().waitFor()
  if (!scenario.mfa) {
    await page.waitForFunction(() => !document.querySelector('.admin-mfa'))
    await page.locator('h1').first().waitFor()
  }
  return page
}

export async function portalLayoutMetrics(page) {
  return page.evaluate(() => {
    const candidates = [...document.querySelectorAll('button,input,select,textarea,h1,h2,.card,.shop-panel,.staff-content-area > *')]
    const visible = element => element.getBoundingClientRect().width > 0 && getComputedStyle(element).visibility !== 'hidden' && !element.closest('.sidebar-wrapper:not(.mobile-open)') && !element.closest('thead')
    const inScroller = element => {
      for (let parent = element.parentElement; parent && parent !== document.body && parent !== document.documentElement; parent = parent.parentElement) {
        if (/auto|scroll/.test(getComputedStyle(parent).overflowX) && parent.scrollWidth > parent.clientWidth + 2) return true
      }
      return false
    }
    return {
      width: innerWidth, documentWidth: document.documentElement.scrollWidth,
      clipped: candidates.filter(visible).filter(element => { const b = element.getBoundingClientRect(); return (b.left < -1 || b.right > innerWidth + 1) && !inScroller(element) }).slice(0, 12).map(element => ({ tag: element.tagName, className: String(element.className), text: element.textContent.slice(0, 50) })),
      smallFields: candidates.filter(visible).filter(element => /INPUT|SELECT|TEXTAREA/.test(element.tagName) && !['checkbox', 'radio', 'file', 'hidden'].includes(element.type) && parseFloat(getComputedStyle(element).fontSize) < 16).map(element => element.getAttribute('aria-label') || element.type),
    }
  })
}
