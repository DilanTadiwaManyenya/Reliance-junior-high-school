import assert from 'node:assert/strict'
import { startPortalBrowser, openPortal } from './helpers/portal-browser.mjs'
const runtime=await startPortalBrowser()
try {
 for(const width of [390,1280])for(const [role,campus] of [['admin','all'],['accountant','senior']]) {
  const page=await openPortal(runtime.browser,runtime.base,{role,campus,section:'expenses',expenseControls:''},width)
  const reverse=page.getByRole('button',{name:'Reverse expense',exact:true})
  if(campus!=='all') {
   assert.equal(await reverse.count(),0)
   assert.equal(await page.getByRole('button',{name:'Approve',exact:true}).count(),0)
   assert.equal(await page.getByRole('button',{name:'Submit for approval',exact:true}).count(),role==='accountant'?1:0)
  } else {
   assert.match(await page.locator('.shop-stats').innerText(),/40\.00/)
   await reverse.click()
   const form=page.getByRole('form',{name:'Expense correction',exact:true})
   await form.getByLabel('Reason for expense reversal').fill('Wrong supplier entered')
   page.once('dialog',dialog=>dialog.dismiss())
   await form.getByRole('button',{name:'Confirm expense reversal',exact:true}).click()
   assert.equal(await page.evaluate(()=>window.fixtureWrites.filter(row=>row.table==='rpc:reverse_school_expense').length),0)
   page.once('dialog',dialog=>dialog.accept())
   await form.getByRole('button',{name:'Confirm expense reversal',exact:true}).click()
   await page.getByRole('alert').filter({hasText:'Synthetic expense reversal failed safely'}).waitFor()
   await page.evaluate(()=>{window.fixtureExpenseReversalSucceeds=true})
   page.once('dialog',dialog=>dialog.accept())
   await form.getByRole('button',{name:'Confirm expense reversal',exact:true}).click()
   await page.getByText('Reason: Wrong supplier entered',{exact:true}).waitFor()
   assert.equal(await reverse.count(),0)
   assert.match(await page.locator('.shop-stats').innerText(),/Approved spending \(USD\)\s*USD\s*0\.00/)
   assert.match(await page.getByRole('table',{name:'Cashbook entries',exact:true}).innerText(),/40\.00/)
  }
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1))
  assert.deepEqual(page.portalErrors,[])
  console.log('PASS expense reversal '+role+'/'+campus+' '+width+'px: authority, confirmation, error/retry and retained cashbook')
  await page.close()
 }
 for(const width of [390,1280])for(const [role,campus] of [['accountant','junior'],['admin','all']]) {
  const page=await openPortal(runtime.browser,runtime.base,{role,campus,section:'expenses',expenseControls:'',expenseLoss:''},width)
  if(role==='admin')await page.getByLabel('Campus',{exact:true}).selectOption('junior')
  await page.getByLabel('Amount (USD)',{exact:true}).fill('25')
  await page.getByLabel('Reason / description',{exact:true}).fill('School transport verification')
  await page.getByRole('button',{name:'Submit for approval',exact:true}).click()
  await page.getByRole('button',{name:'Retry saved expense',exact:true}).waitFor()
  const original=await page.evaluate(()=>window.fixtureWrites.find(row=>row.table==='rpc:submit_school_expense').payload)
  assert.equal(original.p_expense.campus,'junior')
  assert.equal(await page.getByRole('button',{name:'Submit for approval',exact:true}).isDisabled(),true)
  await page.reload()
  await page.getByRole('button',{name:'Retry saved expense',exact:true}).waitFor()
  await page.getByRole('button',{name:'Retry saved expense',exact:true}).click()
  await page.getByRole('button',{name:'Retry saved expense',exact:true}).waitFor({state:'detached'})
  const retried=await page.evaluate(()=>window.fixtureWrites.find(row=>row.table==='rpc:submit_school_expense').payload)
  assert.deepEqual(retried,original)
  assert.equal(await page.evaluate(()=>Object.keys(localStorage).filter(key=>key.startsWith('fixture-expense-server:')).length),1)
  assert.equal(await page.evaluate(()=>Object.keys(sessionStorage).filter(key=>key.startsWith('reliance:expense-submission:')).length),0)
  await page.getByRole('table',{name:'Cashbook entries',exact:true}).getByText('School transport verification',{exact:true}).waitFor()
  if(role==='admin') {
   await page.getByRole('button',{name:'Approve',exact:true}).click()
   await page.getByText('Expense approved.',{exact:true}).waitFor()
   assert.equal(await page.getByRole('button',{name:'Approve',exact:true}).count(),0)
  }
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1))
  assert.deepEqual(page.portalErrors,[])
  console.log('PASS expense submission '+role+'/'+campus+' '+width+'px: lost response, campus, reload and identical retry')
  await page.close()
 }
}finally{await runtime.close()}
