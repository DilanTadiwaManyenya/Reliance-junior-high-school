import assert from 'node:assert/strict'
import { startPortalBrowser, openPortal } from './helpers/portal-browser.mjs'

const runtime = await startPortalBrowser()
try {
  const route = `/portal/teacher?${new URLSearchParams({ section: 'entry', workspace: 'subjects', allocation: 'allocation', subject: 'Combined Science', level: 'Form 1' })}`
  const page = await openPortal(runtime.browser, runtime.base, {
    role: 'teacher', campus: 'senior', multi: '', academicTeacher: '', legacyAcademicTerm: '', mfaDisabled: '', route,
  }, 1024)
  await page.getByRole('heading', { name: 'Enter Combined Science marks' }).waitFor()
  await page.locator('.grade-filterbar select').first().selectOption('learner-0')
  await page.getByRole('heading', { name: 'Edit saved mark' }).waitFor()
  assert.equal(await page.getByLabel('Term mark (%)', { exact: true }).inputValue(), '0')
  await page.getByLabel('Term mark (%)', { exact: true }).fill('82')
  await page.getByLabel('Exam mark (%)', { exact: false }).fill('91')
  await page.getByLabel('Teacher’s comment').fill('Updated from the Senior Markbook')
  await page.getByRole('button', { name: 'Update Combined Science mark', exact: true }).click()
  await page.waitForTimeout(500)
  await page.getByText('Combined Science mark updated. You can return and edit it again at any time.', { exact: true }).waitFor()

  const update = await page.evaluate(() => window.fixtureWrites.filter(row => row.table === 'academic_records'))
  assert.equal(update.length, 1, 'Editing an existing mark updates one report row')
  assert.equal(update[0].operation, 'update')
  assert.equal(update[0].payload.term, 'Term 3', 'Legacy report term labels remain attached to the original row')
  assert.equal(update[0].payload.term_mark, 82)
  assert.equal(update[0].payload.exam_mark, 91)

  await page.getByRole('combobox', { name: 'Active portal role' }).selectOption('admin')
  await page.waitForFunction(() => document.querySelector('.staff-shell')?.dataset.role === 'admin')
  await page.locator('.portal-sidebar').getByRole('button', { name: 'Learners', exact: true }).click()
  await page.getByRole('button', { name: /Open profile for Alexandra Example Learner/ }).click()
  const tabs = page.getByRole('navigation', { name: 'Learner profile sections' })
  await tabs.getByRole('button', { name: 'Academics', exact: true }).click()
  const report = page.getByRole('region', { name: 'Academic report marks' })
  const scienceRow = report.getByRole('row').filter({ hasText: 'Combined Science' })
  await scienceRow.waitFor()
  assert.equal((await scienceRow.getByRole('cell').nth(1).innerText()).trim(), '82')
  assert.equal((await scienceRow.getByRole('cell').nth(2).innerText()).trim(), '91')
  assert.deepEqual(page.portalErrors, [])
  await page.close()
  console.log('PASS Senior Markbook edits a legacy Term 3 record and the learner report shows the updated term and exam marks')
} finally {
  await runtime.close()
}
