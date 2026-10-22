import assert from 'node:assert/strict'
import { startPortalBrowser } from './helpers/portal-browser.mjs'

const runtime = await startPortalBrowser()
try {
  const page = await runtime.browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
  await page.goto(`${runtime.base}/tests/fixtures/teacher-workspace/index.html?campus=junior&class=Grade+4&section=roster&failStudentRefresh=`)
  await page.getByLabel('Full name', { exact: true }).fill('Roster Retry Example')
  await page.getByLabel('Date of birth', { exact: true }).fill('2015-01-01')
  await page.getByLabel('Class level', { exact: true }).selectOption('Grade 4')
  await page.getByRole('button', { name: 'Add learner', exact: true }).click()
  const saveNotice = page.getByRole('status').filter({ hasText: 'Roster Retry Example was saved, but the roster did not refresh' })
  await saveNotice.waitFor()
  assert.match(await saveNotice.innerText(), /Do not add the learner again/)
  await saveNotice.getByRole('button', { name: 'Refresh learners', exact: true }).click()
  await page.getByText(/Roster Retry Example is visible in Grade 4/).waitFor()
  await page.getByRole('table', { name: 'Learner register' }).getByText('Roster Retry Example', { exact: true }).waitFor()
  assert.equal(await page.evaluate(() => window.fixtureWrites.filter(row => row.table === 'students').length), 1)
  console.log('PASS 390px mobile save: failed roster refresh gives a do-not-repeat warning; retry confirms the single saved learner')
  await page.close()
} finally {
  await runtime.close()
}
