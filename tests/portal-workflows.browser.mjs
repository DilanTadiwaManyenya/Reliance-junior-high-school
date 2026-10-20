import assert from 'node:assert/strict'
import { startPortalBrowser, openPortal, portalLayoutMetrics } from './helpers/portal-browser.mjs'
const runtime=await startPortalBrowser()
let checks=0
async function verify(page,label){const m=await portalLayoutMetrics(page);assert.ok(m.documentWidth<=m.width+1,`${label}: document overflow`);assert.deepEqual(m.clipped,[],`${label}: clipped content`);if(m.width<=900)assert.deepEqual(m.smallFields,[],`${label}: small fields`);assert.deepEqual(page.portalErrors,[],`${label}: runtime error`);checks++;console.log(`PASS ${label}`)}
try{
 if(!process.env.PORTAL_PROFILE_ONLY){
 for(const width of [320,768])for(const role of ['admin','accountant']){
  const page=await openPortal(runtime.browser,runtime.base,{role,section:'inventory'},width)
  const nav=page.getByRole('navigation',{name:'Shop sections'})
  const labels=await nav.locator('button').allTextContents()
  for(const label of labels){
   await nav.getByRole('button',{name:label.trim(),exact:true}).click()
   await verify(page,`${role} inventory ${label.trim()} ${width}px`)
   if(label.trim()==='Settings'){
    const tabs=page.getByRole('tablist',{name:'Shop settings'})
    for(const title of await tabs.getByRole('tab').allTextContents()){
     await tabs.getByRole('tab',{name:title.trim(),exact:true}).click()
     await verify(page,`admin shop settings ${title.trim()} ${width}px`)
    }
   }
   if(label.trim()==='Products'&&role==='admin'){
    await page.getByRole('button',{name:'Add product',exact:true}).click()
    const dialog=page.getByRole('dialog',{name:'Product editor'})
    await dialog.waitFor();assert.equal(await page.evaluate(()=>document.body.style.overflow),'hidden')
    await verify(page,`product dialog ${width}px`)
    await page.keyboard.press('Escape');await page.waitForFunction(()=>document.body.style.overflow!=='hidden')
   }
   if(label.trim()==='Point of sale'){
    const campusPicker=page.getByLabel('Checkout campus',{exact:true})
    if(await campusPicker.count())await campusPicker.selectOption('senior')
    await page.locator('.shop-product').first().click()
    await page.getByLabel('Amount received (USD)',{exact:true}).fill('20')
    await verify(page,`accountant checkout cart ${width}px`)
    assert.equal(await page.getByRole('button',{name:'Complete checkout',exact:true}).isEnabled(),true)
   }
   if(label.trim()==='Sales & receipts'){
    await page.getByRole('button',{name:'Open',exact:true}).first().click()
    const dialog=page.getByRole('dialog',{name:'Sale receipt'})
    await dialog.waitFor();await verify(page,`receipt ${width}px`)
    await page.keyboard.press('Escape');await page.waitForFunction(()=>document.body.style.overflow!=='hidden')
   }
  }
  await page.close()
 }
 for(const width of [320,768])for(const campus of ['junior','senior'])for(const view of ['register','staff','settings']){
  const query=new URLSearchParams({section:'classes',campus,classLevel:campus==='junior'?'Grade 1':'Form 1',stream:campus==='junior'?'class-2':'class-1',view})
  const page=await openPortal(runtime.browser,runtime.base,{role:'admin',route:'/portal/staff?'+query},width)
  await page.locator('.class-workspace').waitFor()
  await verify(page,`${campus} class ${view} ${width}px`)
  await page.close()
 }
 }
 for(const width of [320,768])for(const role of ['admin','accountant']){
  const page=await openPortal(runtime.browser,runtime.base,{role,section:role==='admin'?'roster':'learner-profiles'},width)
  if(role==='admin')await page.getByRole('button',{name:/Open profile for Alexandra/}).click()
  else await page.getByRole('button',{name:'Open profile',exact:true}).first().click()
  const nav=page.getByRole('navigation',{name:'Learner profile sections'})
  await nav.waitFor()
  for(const label of await nav.getByRole('button').allTextContents()){
   await nav.getByRole('button',{name:label.trim(),exact:true}).click()
   await verify(page,`${role} learner ${label.trim()} ${width}px`)
  }
  await page.close()
 }
 for(const [role,campus] of [['admin','all'],['admin','junior'],['admin','senior'],['accountant','junior'],['accountant','senior']]){
  const page=await openPortal(runtime.browser,runtime.base,{role,campus,section:'progress-reports',mfaDisabled:''},390)
  await page.getByRole('button',{name:'View progress',exact:true}).first().click()
  await page.getByRole('navigation',{name:'Learner profile sections'}).waitFor()
  if(role==='accountant'){
   const nav=page.getByRole('navigation',{name:'Accountant workspace'})
   await nav.locator('summary').click()
   await nav.getByRole('button',{name:'Finance',exact:true}).click()
  }else{
   await page.getByRole('button',{name:'Open navigation menu',exact:true}).click()
   await page.getByRole('dialog',{name:'Portal navigation'}).getByRole('navigation',{name:'Main navigation'}).getByRole('button',{name:'Finance',exact:true}).click()
  }
  await page.waitForFunction(()=>document.querySelector('.staff-shell')?.dataset.section==='fees')
  await page.getByRole('navigation',{name:'Learner profile sections'}).waitFor({state:'detached'})
  assert.deepEqual(page.portalErrors,[],`${role} ${campus}: progress report navigation runtime error`)
  console.log(`PASS ${role} ${campus}: switching directly from learner report to Finance`)
  await page.close()
 }
 const pending=await openPortal(runtime.browser,runtime.base,{role:'admin',section:'fees',delayPayment:''},320,480)
 await pending.getByRole('button',{name:'Collect payment',exact:true}).first().click()
 await pending.getByLabel('New amount received',{exact:true}).fill('10')
 await pending.getByRole('button',{name:'Record payment',exact:true}).click()
 await pending.waitForFunction(()=>typeof window.fixtureResolvePayment==='function')
 await pending.keyboard.press('Escape')
 assert.equal(await pending.getByRole('dialog').count(),1,'Pending payment must not be dismissed by Escape')
 assert.equal(await pending.getByRole('button',{name:'Close payment dialog'}).isDisabled(),true)
 await pending.mouse.click(2,2)
 assert.equal(await pending.getByRole('dialog').count(),1,'Pending payment must not be dismissed by a background tap')
 assert.equal(await pending.evaluate(()=>window.fixtureWrites.filter(row=>row.table==='rpc:record_learner_fee_payment').length),1)
 await pending.evaluate(()=>window.fixtureResolvePayment())
 await pending.getByRole('dialog').waitFor({state:'detached'})
 await pending.waitForFunction(()=>document.body.style.overflow!=='hidden')
 await pending.close()
 console.log('PASS pending payment dismissal and single request')
 for(const width of [1024,1280,1440])for(const role of ['admin','principal','teacher','accountant','parent']){
  const page=await openPortal(runtime.browser,runtime.base,{role,multi:''},width)
  await verify(page,`${role} desktop ${width}px`)
  await page.close()
 }
 console.log(`Verified ${checks} deeper inventory, class, learner-profile and desktop views.`)
}finally{await runtime.close()}
