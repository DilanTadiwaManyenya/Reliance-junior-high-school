import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { startPortalBrowser, openPortal, portalLayoutMetrics } from './helpers/portal-browser.mjs'
const runtime=await startPortalBrowser()
try {
 for(const width of [320,390,768,1280]) for(const role of ['admin','accountant','principal']) {
  const page=await openPortal(runtime.browser,runtime.base,{role,campus:role==='accountant'?'junior':'all',section:'fees',owing:''},width)
  const table=page.getByRole('table',{name:'Learner fee balances',exact:true})
  await table.locator('tbody tr').first().waitFor()
  const rows=table.locator('tbody tr')
  assert.equal(await rows.count(),role==='accountant'?1:3,'Campus finance must show its own learners, not an empty boolean campus filter')
  assert.equal(await page.locator('.fees-stat-card').filter({has:page.getByText('Total outstanding balance',{exact:true})}).locator('strong').innerText(),role==='accountant'?'$135.00':'$405.00')
  const row=rows.first()
  for(const label of ['Total term fee','Amount paid','Balance owed','Fee status','Enrolment']) {
   const cell=row.locator(`td[data-label="${label}"]`)
   assert.equal(await cell.isVisible(),true,`${role} ${width}: ${label} visible`)
   if(label==='Total term fee') assert.equal((await cell.innerText()).trim(),'$160.00')
   if(label==='Amount paid') assert.equal((await cell.innerText()).trim(),'$25.00')
   if(label==='Balance owed') assert.equal((await cell.innerText()).trim(),'$135.00')
  }
  if(width<=600)assert.equal(await table.evaluate(el=>el.scrollWidth<=el.clientWidth+1),true)
  if(role==='principal')assert.equal(await page.getByRole('button',{name:'Collect payment',exact:true}).count(),0)
  else {
   await row.getByRole('button',{name:/Collect/}).click()
   const dialog=page.getByRole('dialog')
   await dialog.waitFor()
   assert.equal(Number(await dialog.getByLabel('Total term fee',{exact:true}).inputValue()),160)
   await page.keyboard.press('Escape')
   await dialog.waitFor({state:'detached'})
  }
  const metrics=await portalLayoutMetrics(page)
  assert.ok(metrics.documentWidth<=width+1)
  assert.deepEqual(metrics.clipped,[])
  assert.deepEqual(page.portalErrors,[])
  if(width===390&&role==='accountant') {await mkdir('tmp/mobile-finance-review',{recursive:true});await page.screenshot({path:'tmp/mobile-finance-review/accountant-fees-390.png',fullPage:true})}
  await page.close()
  console.log(`PASS ${role} fees ${width}px: campus rows, every financial field, unchanged amounts and payment access`)
 }
 for(const section of ['expenses','learner-profiles']) {
  const page=await openPortal(runtime.browser,runtime.base,{role:'accountant',campus:'senior',section},320,480)
  const table=page.locator('.mobile-record-table')
  await table.locator('tbody tr').first().waitFor()
  assert.equal(await table.evaluate(el=>el.scrollWidth<=el.clientWidth+1),true)
  assert.equal(await page.getByRole('button',{name:'Approve',exact:true}).count(),0)
  assert.equal(await page.getByRole('button',{name:'Reject',exact:true}).count(),0)
  if(section==='expenses')assert.match(await table.innerText(),/40\.00/)
  if(section==='learner-profiles')assert.match(await table.innerText(),/Alexandra/)
  assert.deepEqual(page.portalErrors,[])
  await page.close()
 }
} finally {await runtime.close()}
