import assert from 'node:assert/strict'
import { startPortalBrowser } from './helpers/portal-browser.mjs'
console.log('Starting bulk browser checks')
const runtime = await startPortalBrowser()
console.log('Browser ready')
try {
  for (const status of ['active', 'inactive']) {
    const page = await runtime.browser.newPage({ viewport: { width: 390, height: 844 } })
    page.setDefaultTimeout(10000)
    console.log('Checking', status)
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.goto(`${runtime.base}/tests/fixtures/bulk-learners/index.html?status=${status}`)
    await page.getByText('Bulk disable or delete learners · Main Admin', { exact: true }).click()
    console.log('Fixture opened')
    await page.getByLabel('Enrolment year').selectOption('2026')
    await page.getByLabel('Class', { exact: true }).selectOption('Form 1')
    await page.getByLabel('Stream', { exact: true }).selectOption('White')
    assert.equal(await page.getByRole('checkbox').count(), 2)
    await page.getByRole('button', { name: 'Select all 2 matching learners' }).click()
    await page.getByLabel('Reason', { exact: true }).fill('Default duplicate records entered in error')
    const button = page.getByRole('button', { name: status === 'active' ? 'Disable selected learners' : 'Permanently delete selected learners', exact: true })
    if (status === 'inactive') {
      assert.equal(await button.isDisabled(), true)
      await page.getByLabel('Type DELETE 2').fill('DELETE 2')
    }
    page.once('dialog', dialog => dialog.dismiss())
    await button.click()
    assert.equal(await page.evaluate(() => window.fixtureWrites.length), 0)
    page.once('dialog', dialog => dialog.accept())
    await button.click()
    await page.getByRole('status').filter({ hasText: status === 'active' ? '2 disabled; 0 blocked' : '1 deleted; 1 blocked' }).waitFor()
    const calls = await page.evaluate(() => window.fixtureWrites)
    assert.deepEqual(calls.map(call => call.args.p_student), ['1', '2'])
    assert.ok(calls.every(call => call.name === (status === 'active' ? 'correct_assigned_learner' : 'manage_disabled_learner')))
    if (status === 'inactive') await page.getByText('Fixture White Two: This learner has fee payment history.').waitFor()
    assert.deepEqual(errors, [])
    await page.close()
  }
  for (const query of ['role=teacher', 'role=principal', 'role=accountant', 'campus=senior']) {
    const page = await runtime.browser.newPage()
    await page.goto(`${runtime.base}/tests/fixtures/bulk-learners/index.html?${query}`)
    await page.waitForFunction(() => window.fixtureReady)
    assert.equal(await page.locator('summary').count(), 0)
    await page.close()
  }
  console.log('PASS bulk selection, year/class/stream scope, cancellation, deletion confirmation, protected history and Main Admin controls')
} finally { await runtime.close() }
