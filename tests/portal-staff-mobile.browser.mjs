import assert from 'node:assert/strict'
import { startPortalBrowser, openPortal, portalLayoutMetrics } from './helpers/portal-browser.mjs'

const runtime = await startPortalBrowser()
const sections = ['dashboard', 'roster', 'staff', 'classes', 'entry', 'fees', 'expenses', 'inventory', 'report-settings', 'grade-bands', 'bulk-import', 'progress-reports', 'activity', 'settings']
const scenarios = [
  ...sections.map(section => ({ role: 'admin', section, multi: '' })),
  ...['junior', 'senior'].flatMap(campus => ['dashboard', 'roster', 'staff', 'classes', 'fees', 'report-settings'].map(section => ({ role: 'admin', campus, section }))),
  ...['junior', 'senior'].flatMap(campus => ['fees', 'expenses', 'inventory', 'learner-profiles', 'progress-reports'].map(section => ({ role: 'accountant', campus, section, multi: '' }))),
  ...['dashboard', 'fees', 'expenses', 'staff'].map(section => ({ role: 'principal', section })),
]
let count = 0
try {
  for (const width of (process.env.PORTAL_STAFF_DIALOGS_ONLY ? [] : [320, 768])) for (const scenario of scenarios) {
    const page = await openPortal(runtime.browser, runtime.base, scenario, width)
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
    const metrics = await portalLayoutMetrics(page)
    assert.ok(metrics.documentWidth <= width + 1, `${JSON.stringify(scenario)} ${width}: document overflow ${metrics.documentWidth}`)
    assert.deepEqual(metrics.clipped, [], `${JSON.stringify(scenario)} ${width}: clipped content`)
    assert.deepEqual(metrics.smallFields, [], `${JSON.stringify(scenario)} ${width}: unreadable inputs`)
    assert.deepEqual(page.portalErrors, [], `${JSON.stringify(scenario)} ${width}: runtime errors`)
    if (scenario.role === 'accountant') {
      assert.equal(await page.getByRole('navigation', { name: 'Accountant workspace' }).count(), 1)
      if (scenario.section === 'progress-reports') assert.equal(await page.getByRole('heading', { name: 'Academic progress', exact: true }).isVisible(), true)
    }
    if (scenario.role === 'principal' && scenario.section === 'fees') assert.equal(await page.getByRole('button', { name: 'Collect payment', exact: true }).count(), 0)
    console.log(`PASS ${scenario.role} ${scenario.campus || 'all'} ${scenario.section} ${width}px`)
    count++
    await page.close()
  }
  // All accountant workspaces remain reachable even though this role has no sidebar.
  const accountant = await openPortal(runtime.browser, runtime.base, { role: 'accountant', campus: 'junior' }, 320)
  const nav = accountant.getByRole('navigation', { name: 'Accountant workspace' })
  for (const [tab, heading] of [['Learner profiles', 'Learner profiles'], ['Academic progress', 'Academic progress'], ['Expenses & Cashbook', 'Expenses & cashbook'], ['Point of sale', 'Junior school POS'], ['Finance', 'Fees tracking']]) {
    await nav.locator('summary').click()
    await nav.getByRole('button', { name: tab, exact: true }).click()
    await accountant.getByRole('heading', { name: heading, exact: true }).waitFor()
  }
  await accountant.close()
  // Payment and enrolment dialogs fit both a phone and a reduced keyboard viewport.
  const fees = await openPortal(runtime.browser, runtime.base, { role: 'admin', section: 'fees' }, 320, 480)
  for (const name of ['Collect payment', 'Add learner', 'Edit fee structure']) {
    await fees.getByRole('button', { name, exact: true }).first().click()
    const dialog = fees.getByRole('dialog')
    await dialog.waitFor()
    const modal = dialog.locator('.fee-modal')
    const bounds = await modal.boundingBox()
    assert.ok(bounds.x >= 0 && bounds.y >= 0 && bounds.x + bounds.width <= 321 && bounds.y + bounds.height <= 481, `${name}: modal must fit the reduced viewport`)
    assert.equal(await fees.evaluate(() => document.body.style.overflow), 'hidden')
    const action = modal.locator('.fee-modal-actions button').last()
    await action.scrollIntoViewIfNeeded()
    const actionBounds = await action.boundingBox()
    assert.ok(actionBounds.y >= 0 && actionBounds.y + actionBounds.height <= 481, `${name}: footer action must remain reachable`)
    assert.ok(await action.evaluate(element => { const b = element.getBoundingClientRect(); return element.contains(document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2)) }), `${name}: footer action must not be covered`)
    await fees.keyboard.press('Escape')
    await fees.waitForFunction(() => document.body.style.overflow !== 'hidden')
    assert.equal(await fees.getByRole('dialog').count(), 0)
  }
  await fees.close()
  const staff = await openPortal(runtime.browser, runtime.base, { role: 'admin', section: 'staff' }, 320, 480)
  await staff.getByRole('button', { name: '+ Add Staff Member', exact: true }).click()
  const staffDialog = staff.getByRole('dialog', { name: 'Add staff member' })
  await staffDialog.waitFor()
  assert.ok((await staffDialog.boundingBox()).width <= 320)
  await staffDialog.getByRole('button', { name: 'Close panel', exact: true }).click()
  await staff.waitForFunction(() => document.body.style.overflow !== 'hidden')
  await staff.close()
  console.log(`Verified ${count} staff page layouts, five accountant navigation routes, three financial dialogs and staff enrolment.`)
} finally { await runtime.close() }
