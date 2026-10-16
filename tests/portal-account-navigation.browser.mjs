import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { startPortalBrowser, openPortal, portalLayoutMetrics } from './helpers/portal-browser.mjs'
const runtime = await startPortalBrowser()
try {
  for (const width of [320, 390, 768, 1280]) {
    const page = await openPortal(runtime.browser, runtime.base, { role: 'accountant', campus: 'junior' }, width)
    const nav = page.getByRole('navigation', { name: 'Accountant workspace' })
    assert.match(await page.getByLabel('Signed-in account').innerText(), /Junior School/)
    const summary = nav.locator('summary')
    assert.equal(await summary.isVisible(), width <= 900)
    for (const [label, section] of [['Point of sale', 'inventory'], ['Learner profiles', 'learner-profiles'], ['Finance', 'fees']]) {
      if (width <= 900) {
        assert.equal(await nav.locator('details').getAttribute('open'), null)
        await summary.click()
      }
      const button = nav.getByRole('button', { name: label, exact: true })
      await button.click()
      await page.waitForFunction(section => new URLSearchParams(window.fixtureRoute.split('?')[1]) .get('section') === (section === 'fees' ? null : section), section)
      if (width <= 900) assert.equal(await summary.evaluate(el => document.activeElement === el), true)
    }
    await page.setViewportSize({ width: width <= 900 ? 1280 : 320, height: 844 })
    await page.waitForFunction(() => document.querySelector('.accountant-workspace-menu').open === (innerWidth > 900))
    assert.deepEqual(page.portalErrors, [])
    await page.close()
    console.log(`PASS ${width}px: accountant workspace selection, focus, campus context and breakpoint resize`)
  }
  for (const roleError of [false, true]) {
    const page = await openPortal(runtime.browser, runtime.base, { role: 'admin', multi: '', ...(roleError ? { roleError: '' } : {}) }, 320)
    await page.getByRole('combobox', { name: 'Active portal role' }).selectOption('teacher')
    if (roleError) {
      await page.getByRole('alert').filter({ hasText: 'We could not switch roles' }).waitFor()
      assert.equal(await page.locator('.staff-shell').getAttribute('data-role'), 'admin')
    } else {
      await page.waitForFunction(() => document.querySelector('.staff-shell')?.dataset.role === 'teacher')
      assert.equal(await page.getByRole('button', { name: 'Staff', exact: true }).count(), 0)
    }
    await page.close()
  }
  const routes = ['/portal/login', '/portal/staff-login', '/portal/signup', '/portal/forgot-password', '/portal/set-password', '/portal/first-login']
  for (const width of [320, 390, 768]) for (const route of routes) {
    const page = await openPortal(runtime.browser, runtime.base, { role: route.endsWith('first-login') ? 'teacher' : 'parent', route, ...(route.endsWith('set-password') ? { mustChange: '' } : {}) }, width, 480)
    const metrics = await portalLayoutMetrics(page)
    assert.ok(metrics.documentWidth <= width + 1, `${route} ${width}: overflow`)
    assert.deepEqual(metrics.clipped, [], `${route} ${width}: clipped fields`)
    assert.deepEqual(metrics.smallFields, [], `${route} ${width}: small fields`)
    const password = page.locator('.password-input input').first()
    if (await password.count()) {
      await password.fill('Example-pass-123')
      const toggle = page.locator('.password-input button').first()
      await toggle.click()
      assert.equal(await password.getAttribute('type'), 'text')
      assert.equal(await password.inputValue(), 'Example-pass-123')
      assert.equal(await toggle.getAttribute('aria-pressed'), 'true')
      assert.equal(await toggle.getAttribute('aria-controls'), await password.getAttribute('id'))
      const bounds = await toggle.boundingBox()
      assert.ok(bounds.width >= 44 && bounds.height >= 44)
      await toggle.click()
      assert.equal(await password.getAttribute('type'), 'password')
    }
    if (route.endsWith('/login') || route.endsWith('/staff-login')) assert.equal(await password.getAttribute('autocomplete'), 'current-password')
    await page.emulateMedia({ reducedMotion: 'reduce' })
    assert.equal(await page.locator('.portal-auth-card').evaluate(el => getComputedStyle(el).animationName), 'none')
    if (width === 390 && route === '/portal/login') {
      await mkdir('tmp/mobile-navigation-review', { recursive: true })
      await page.screenshot({ path: 'tmp/mobile-navigation-review/login-390.png', fullPage: true })
    }
    assert.deepEqual(page.portalErrors, [])
    await page.close()
    console.log(`PASS ${width}px ${route}: short viewport, field sizing, password visibility and reduced motion`)
  }
} finally { await runtime.close() }
