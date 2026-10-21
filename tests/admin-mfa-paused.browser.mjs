import assert from 'node:assert/strict'
import { startPortalBrowser, portalLayoutMetrics } from './helpers/portal-browser.mjs'

const runtime = await startPortalBrowser()
try {
  const scenarios = [
    ['paused', 'role=admin&mfaDisabled=1'],
    ['enrollment state', 'role=admin&mfa=setup'],
    ['verification state', 'role=admin&mfa=verify'],
    ['settings read failure', 'role=admin&mfaSettingsError=1'],
  ]

  for (const width of [320, 390, 667, 1280]) {
    for (const [name, query] of scenarios) {
      const page = await runtime.browser.newPage({ viewport: { width, height: 844 } })
      const errors = []
      page.on('pageerror', error => errors.push(error.message))
      await page.goto(`${runtime.base}/tests/fixtures/portal/index.html?${query}`, { waitUntil: 'domcontentloaded' })
      await page.locator('.staff-shell').waitFor()
      assert.equal(await page.locator('.admin-mfa').count(), 0, `MFA UI must stay removed (${name})`)
      assert.equal(await page.evaluate(() => window.fixtureMfaEnrolls || 0), 0, 'the paused portal must not start enrollment')
      assert.deepEqual(errors, [])
      const metrics = await portalLayoutMetrics(page)
      assert.ok(metrics.documentWidth <= width + 1)
      assert.deepEqual(metrics.clipped, [])
      await page.close()
    }
    console.log(`PASS paused admin sign-in at ${width}px: no setup or verification gate`)
  }
} finally {
  await runtime.close()
}
