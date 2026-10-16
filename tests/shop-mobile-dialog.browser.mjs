import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { startPortalBrowser, openPortal, portalLayoutMetrics } from './helpers/portal-browser.mjs'
const runtime = await startPortalBrowser()
await mkdir('tmp/mobile-shop-review', { recursive: true })
try {
 for (const width of [320, 390, 768]) {
  const page = await openPortal(runtime.browser, runtime.base, { role: 'admin', section: 'inventory' }, width, 480)
  await page.getByRole('navigation', { name: 'Shop sections' }).getByRole('button', { name: 'Products', exact: true }).click()
  const opener = page.getByRole('button', { name: 'Add product', exact: true })
  await opener.click()
  const dialog = page.getByRole('dialog', { name: 'Product editor' })
  await dialog.waitFor()
  for (const name of ['Product name', 'Selling price (USD)', 'Opening stock']) {
   const field = dialog.getByLabel(name, { exact: true })
   await field.focus(); await field.scrollIntoViewIfNeeded()
   assert.ok(await field.evaluate(el => { const b=el.getBoundingClientRect();return el.contains(document.elementFromPoint(b.x+b.width/2,b.y+b.height/2)) }), `${name} unobscured at ${width}`)
  }
  assert.equal(await dialog.getByLabel('Selling price (USD)', { exact:true }).getAttribute('inputmode'), 'decimal')
  for (const name of ['Save product', 'Cancel']) {
   const action = dialog.getByRole('button', { name, exact:true })
   await action.scrollIntoViewIfNeeded()
   assert.ok(await action.evaluate(el => { const b=el.getBoundingClientRect();return b.top>=0&&b.bottom<=innerHeight+1&&el.contains(document.elementFromPoint(b.x+b.width/2,b.y+b.height/2)) }), `${name} reachable at ${width}`)
  }
  const metrics=await portalLayoutMetrics(page)
  assert.ok(metrics.documentWidth<=width+1)
  assert.deepEqual(metrics.clipped,[])
  assert.deepEqual(page.portalErrors,[])
  if(width===390)await page.screenshot({path:'tmp/mobile-shop-review/product-390.png'})
  await page.keyboard.press('Escape')
  await dialog.waitFor({state:'detached'})
  assert.equal(await opener.evaluate(el=>el===document.activeElement),true)
  await page.close()
  console.log(`PASS product fields, footer, overflow and focus restoration ${width}x480`)
 }
} finally { await runtime.close() }
