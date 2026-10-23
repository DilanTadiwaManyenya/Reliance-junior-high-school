import assert from 'node:assert/strict'
import { openPortal, startPortalBrowser } from './helpers/portal-browser.mjs'

const runtime = await startPortalBrowser()
try {
  const page = await openPortal(runtime.browser, runtime.base, { role: 'admin', section: 'staff', mfaDisabled: '', multiClassAllocations: '' }, 390)
  page.setDefaultTimeout(5000)

  await page.getByLabel('Search staff', { exact: true }).fill('Example Teacher')
  const teacherRow = page.locator('.mobile-record-table tbody tr').filter({ hasText: 'Example Teacher' })
  await teacherRow.getByRole('button', { name: 'Manage', exact: true }).click()

  const editor = page.getByRole('dialog')
  const editControl = editor.getByRole('button', { name: 'Edit Form 1 · Blue', exact: true })
  const removeControl = editor.getByRole('button', { name: 'Remove Form 1 · Blue', exact: true })
  assert.ok((await editControl.boundingBox()).height >= 36, 'Edit allocation must be tappable on a phone')
  assert.ok((await removeControl.boundingBox()).height >= 36, 'Remove allocation must be tappable on a phone')
  await editor.getByLabel('Class').selectOption({ label: 'Form 1' })
  await editor.getByLabel('Stream scope').selectOption({ label: 'Green' })
  await editor.getByRole('button', { name: 'Add class', exact: true }).click()
  await editor.getByRole('button', { name: 'Edit Form 1 · Green', exact: true }).click()
  await removeControl.click()
  assert.equal(await editor.getByRole('button', { name: 'Update allocation', exact: true }).count(), 1, 'Removing another allocation should preserve the active edit')
  await editor.getByLabel('Class').selectOption({ label: 'Form 2' })
  await editor.getByLabel('Stream scope').selectOption({ label: 'Blue' })
  await editor.getByRole('button', { name: 'Update allocation', exact: true }).click()
  await editor.getByRole('button', { name: 'Edit Form 2 · Blue', exact: true }).waitFor()

  await editor.getByLabel('Class').selectOption({ label: 'Form 1' })
  await editor.getByLabel('Stream scope').selectOption({ label: 'Green' })
  await editor.getByRole('button', { name: 'Add class', exact: true }).click()
  await editor.getByLabel('Class').selectOption({ label: 'Form 1' })
  await editor.getByLabel('Stream scope').selectOption({ label: 'Red' })
  await editor.getByRole('button', { name: 'Add class', exact: true }).click()
  await editor.getByRole('button', { name: 'Remove Form 1 · Red', exact: true }).click()
  assert.equal(await editor.getByRole('button', { name: 'Edit Form 1 · Red', exact: true }).count(), 0)
  await editor.getByRole('button', { name: 'Edit Form 1 · Green', exact: true }).waitFor()

  await page.getByLabel('Search staff', { exact: true }).fill('')
  await editor.getByRole('button', { name: 'Save staff changes', exact: true }).click()
  await editor.waitFor({ state: 'detached' })
  await page.waitForFunction(() => {
    const row = [...document.querySelectorAll('.mobile-record-table tbody tr')].find(item => item.textContent.includes('Form 2 Blue'))
    const classAllocations = row?.querySelector('.staff-class-list')?.textContent || ''
    return classAllocations.includes('Form 2 Blue') && classAllocations.includes('Form 1 Green') && !classAllocations.includes('Form 1 Red')
  })

  const savedCall = await page.evaluate(() => window.fixtureFunctionCalls.findLast(call => call.name === 'manage-staff-account' && call.body.action === 'update'))
  assert.deepEqual(savedCall.body.class_assignments, [
    { class_level: 'Form 2', class_stream: 'Blue' },
    { class_level: 'Form 1', class_stream: 'Green' },
  ])
  assert.deepEqual(page.portalErrors, [])
  console.log('PASS staff allocation editor: edit while removing another row, add a second class, remove allocation, save both scopes, and refresh the staff row')
  await page.close()
} finally {
  await runtime.close()
}
