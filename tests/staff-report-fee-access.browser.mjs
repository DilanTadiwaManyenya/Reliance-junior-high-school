import assert from 'node:assert/strict'
import {startPortalBrowser,openPortal} from './helpers/portal-browser.mjs'
const runtime=await startPortalBrowser()
try {
 for(const learnerClass of ['Grade 1','Form 1']) for(const role of ['admin','accountant','parent']) {
  const page=await openPortal(runtime.browser,runtime.base,{role,learnerClass,owing:'',campus:role==='admin'?'all':learnerClass==='Grade 1'?'junior':'senior',...(role==='parent'?{route:'/portal/learner/learner-0/academics'}:{section:role==='admin'?'roster':'learner-profiles'})},390)
  if(role!=='parent') {
   await page.getByRole('button',{name:role==='admin'?/Open profile for Alexandra/:'Open profile',exact:role!=='admin'}).first().click()
   await page.getByRole('navigation',{name:'Learner profile sections'}).getByRole('button',{name:'Academics',exact:true}).click()
  }
  await page.locator('.report-card').waitFor()
  assert.equal(await page.locator('.report-card-locked').count(),role==='parent'?1:0,`${role} ${learnerClass} unpaid access`)
  if(role==='accountant')assert.equal(await page.locator('.junior-report-office-editor').count(),0,'Accountants cannot edit report comments')
  assert.deepEqual(page.portalErrors,[])
  console.log(`PASS ${role} ${learnerClass}: unpaid fees ${role==='parent'?'lock':'do not lock'} report`)
  await page.close()
 }
}finally{await runtime.close()}
