import assert from 'node:assert/strict'
import { startPortalBrowser, openPortal } from './helpers/portal-browser.mjs'
const runtime=await startPortalBrowser()
try {
 for(const width of [390,1280]) for(const [role,campus] of [['admin','all'],['admin','senior'],['accountant','senior']]) {
  const page=await openPortal(runtime.browser,runtime.base,{role,campus,section:'fees',feeReversal:''},width)
  await page.getByRole('button',{name:'Open account',exact:true}).first().click()
  await page.getByRole('heading',{name:'Payment timeline',exact:true}).waitFor()
  const reverse=page.getByRole('button',{name:'Reverse fee payment',exact:true})
  if(campus!=='all') assert.equal(await reverse.count(),0)
  else {
   assert.equal(await reverse.isDisabled(),true)
   await page.getByLabel('Reason for fee reversal',{exact:true}).fill('Wrong learner selected')
   page.once('dialog',dialog=>dialog.dismiss())
   await reverse.click()
   assert.equal(await page.evaluate(()=>window.fixtureWrites.filter(row=>row.table==='rpc:reverse_learner_fee_payment').length),0)
   page.once('dialog',dialog=>dialog.accept())
   await reverse.click()
   await page.getByRole('alert').filter({hasText:'Synthetic reversal failed safely'}).waitFor()
   await page.evaluate(()=>{window.fixtureReversalCanSucceed=true})
   page.once('dialog',dialog=>dialog.accept())
   await reverse.click()
   await page.getByText('REVERSED — excluded from collections',{exact:true}).waitFor()
   await page.getByText('Reason: Wrong learner selected',{exact:true}).waitFor()
   assert.equal(await reverse.count(),0)
   const fees=page.locator('.learner-profile-fees')
   assert.match(await fees.innerText(),/Paid:\s*USD\s*0\.00/)
   assert.match(await fees.innerText(),/USD\s*160\.00/)
  }
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1))
  assert.deepEqual(page.portalErrors,[])
  console.log(`PASS ${role}/${campus} ${width}px: fee reversal authority, safe failure, confirmation and retained history`)
  await page.close()
 }
} finally { await runtime.close() }
