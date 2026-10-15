import assert from 'node:assert/strict'
import { startPortalBrowser, openPortal } from './helpers/portal-browser.mjs'
const runtime = await startPortalBrowser()
try {
  for (const width of [320, 390, 768, 1024]) for (const role of ['admin', 'principal', 'teacher', 'accountant']) {
    const page = await openPortal(runtime.browser, runtime.base, { role, multi: '' }, width)
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${role} ${width}: document overflow`)
    const toolbar = await page.locator('.staff-top-bar').evaluate(root => [...root.querySelectorAll('button,select')].filter(el => el.getBoundingClientRect().width > 0).map(el => { const b = el.getBoundingClientRect(); return { left: b.left, right: b.right, height: b.height, name: el.getAttribute('aria-label') || el.textContent } }))
    assert.ok(toolbar.every(el => el.left >= 0 && el.right <= width + 1 && el.height >= 44), `${role} ${width}: clipped or small toolbar controls ${JSON.stringify(toolbar)}`)
    if (role !== 'accountant' && width <= 900) {
      const menu = page.getByRole('button', { name: 'Open navigation menu', exact: true })
      assert.equal(await menu.isVisible(), true)
      await menu.click()
      const dialog = page.getByRole('dialog', { name: 'Portal navigation' })
      await dialog.waitFor()
      await page.waitForFunction(() => document.activeElement?.closest('[role="dialog"]'))
      assert.equal(await page.evaluate(() => document.body.style.overflow), 'hidden')
      await page.keyboard.press('Shift+Tab')
      assert.ok(await page.evaluate(() => Boolean(document.activeElement?.closest('[role="dialog"]'))))
      await page.keyboard.press('Escape')
      await page.waitForFunction(() => document.body.style.overflow !== 'hidden')
      assert.equal(await menu.getAttribute('aria-expanded'), 'false')
      assert.equal(await menu.evaluate(el => document.activeElement === el), true)
      await menu.click()
      await dialog.getByRole('button', { name: 'Account settings', exact: true }).click()
      await page.getByRole('heading', { name: 'Account settings', exact: true }).waitFor()
      assert.equal(await menu.getAttribute('aria-expanded'), 'false')
      assert.notEqual(await page.evaluate(() => document.body.style.overflow), 'hidden')
    }
    console.log(`PASS ${role} ${width}px: toolbar, drawer navigation, focus and scrolling`)
    await page.close()
  }
} finally { await runtime.close() }
