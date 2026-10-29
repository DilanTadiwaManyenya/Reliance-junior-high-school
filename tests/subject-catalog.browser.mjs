import assert from 'node:assert/strict'
import { openPortal, portalLayoutMetrics, startPortalBrowser } from './helpers/portal-browser.mjs'

const runtime = await startPortalBrowser()
try {
  for (const width of [320, 390, 1280]) {
    const page = await openPortal(runtime.browser, runtime.base, {
      role: 'admin', campus: 'all', section: 'subject-catalog', subjectCatalog: '', mfaDisabled: '',
    }, width)
    page.setDefaultTimeout(5000)
    await page.getByRole('heading', { name: 'Subject catalog', exact: true }).waitFor()
    await page.getByRole('heading', { name: 'Chishona', exact: true }).waitFor()
    assert.equal(await page.locator('.subject-catalog-group').count(), 11, 'all curriculum groups should be available')

    const chishona = page.locator('.subject-catalog-row').filter({ hasText: 'Chishona' })
    const edit = chishona.getByRole('button', { name: 'Edit', exact: true })
    assert.ok((await edit.boundingBox()).height >= 36, 'edit action should be tappable on mobile')
    await edit.click()
    await page.getByLabel('Official subject name').fill('IsiNdebele')
    await page.getByRole('button', { name: 'Save subject', exact: true }).click()
    await page.getByRole('status').filter({ hasText: 'current allocation labels updated' }).waitFor()
    await page.locator('.subject-catalog-row').filter({ hasText: 'IsiNdebele' }).waitFor()
    assert.deepEqual(await page.evaluate(() => window.fixtureCatalogCalls[0]), {
      name: 'save_subject_catalog_entry',
      payload: { p_subject_id: 'catalog-shona', p_subject_code: 'chishona', p_display_name: 'IsiNdebele', p_group_codes: ['form_1_2_zgc'] },
    })
    assert.equal(await page.evaluate(() => window.fixtureWrites.filter(row => ['subject_catalog','subject_catalog_aliases','subject_catalog_group_memberships'].includes(row.table)).length), 0, 'catalog changes must use guarded RPCs, not direct table writes')

    const renamed = page.locator('.subject-catalog-row').filter({ hasText: 'IsiNdebele' })
    await renamed.getByRole('button', { name: 'Retire', exact: true }).click()
    await page.getByRole('status').filter({ hasText: 'retired from new allocations' }).waitFor()
    await page.getByLabel('Show retired subjects').check()
    const retired = page.locator('.subject-catalog-row').filter({ hasText: 'IsiNdebele' })
    assert.match(await retired.innerText(), /Retired/)
    await retired.getByRole('button', { name: 'Restore', exact: true }).click()
    await page.getByRole('status').filter({ hasText: 'restored to the active catalog' }).waitFor()

    const metrics = await portalLayoutMetrics(page)
    assert.ok(metrics.documentWidth <= width + 1, JSON.stringify(metrics))
    assert.deepEqual(metrics.clipped, [])
    assert.deepEqual(page.portalErrors, [])
    await page.close()
    console.log(`PASS subject catalog ${width}px: edit, allocation identity, retire and restore`)
  }
} finally {
  await runtime.close()
}
