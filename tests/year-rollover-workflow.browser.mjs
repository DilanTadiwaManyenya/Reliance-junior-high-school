import assert from 'node:assert/strict'
import {mkdir} from 'node:fs/promises'
import {startPortalBrowser,openPortal,portalLayoutMetrics} from './helpers/portal-browser.mjs'
const runtime=await startPortalBrowser()
try{
 for(const width of [320,390,667,1280]){
  const page=await openPortal(runtime.browser,runtime.base,{role:'admin',campus:'junior',section:'year-rollover',rolloverReviewed:'1',rolloverLostResponse:'1'},width)
  await page.getByLabel('Decision for Brian Example').selectOption('promote')
  await page.getByLabel('Destination for Brian Example').selectOption('next-junior')
  await page.getByLabel('School decision reason').fill('School approved placement following register review')
  assert.equal(await page.getByRole('button',{name:'Apply reviewed placements',exact:true}).count(),0)
  await page.getByRole('button',{name:'Validate and preview placements',exact:true}).click()
  await page.getByText('Review before applying',{exact:true}).waitFor()
  assert.equal(await page.getByRole('button',{name:'Apply reviewed placements',exact:true}).isDisabled(),true)
  await page.getByRole('checkbox',{name:/I verified these placements/}).check()
  const metrics=await portalLayoutMetrics(page);assert.ok(metrics.documentWidth<=width+1,JSON.stringify(metrics));assert.deepEqual(metrics.clipped,[]);assert.deepEqual(metrics.smallFields,[])
  if(width===390){await mkdir('tmp/rollover-workflow-review',{recursive:true});await page.screenshot({path:'tmp/rollover-workflow-review/preview-390.png',fullPage:true})}
  await page.getByRole('button',{name:'Apply reviewed placements',exact:true}).click()
  await page.getByRole('button',{name:'Retry same batch',exact:true}).waitFor()
  assert.equal(await page.getByRole('button',{name:'Refresh decisions',exact:true}).isDisabled(),true)
  await page.getByRole('button',{name:'Retry same batch',exact:true}).click()
  await page.getByText(/Rollover applied\. Reference/).waitFor()
  const writes=await page.evaluate(()=>window.fixtureWrites.filter(r=>r.table==='rpc:apply_year_rollover').map(r=>r.payload))
  assert.equal(writes.length,3);assert.equal(writes[0].p_preview,true);assert.deepEqual(writes[1],writes[2],'uncertain retries preserve exact batch and decisions')
  assert.deepEqual(page.portalErrors,[]);await page.close();console.log(`PASS reviewed rollover ${width}px: explicit preview, approval, campus scope and lost-response retry`)
 }
 const blocked=await openPortal(runtime.browser,runtime.base,{role:'admin',campus:'junior',section:'year-rollover'},390)
 await blocked.getByText('Confirm source-year report history first.',{exact:true}).waitFor();assert.equal(await blocked.getByLabel('Decision for Brian Example').isDisabled(),true);await blocked.close()
 for(const role of ['accountant','teacher','principal']){const page=await openPortal(runtime.browser,runtime.base,{role,section:'year-rollover'},390);assert.equal(await page.getByRole('heading',{name:'Reviewed year rollover',exact:true}).count(),0);await page.close()}
 const main=await openPortal(runtime.browser,runtime.base,{role:'admin',section:'year-rollover',rolloverReviewed:'1'},390)
 await main.getByLabel('Decision for Brian Example').selectOption('retain');await main.getByLabel('Destination for Brian Example').selectOption('class-2');await main.getByLabel('School decision reason').fill('School verified retention decision');await main.getByRole('button',{name:'Validate and preview placements'}).click();await main.getByRole('checkbox',{name:/I verified/}).check();await main.getByRole('button',{name:'Apply reviewed placements',exact:true}).click();await main.getByRole('button',{name:'Review reversal'}).click();await main.getByLabel('Correction reason').fill('Corrected school-approved retention decision');await main.getByRole('button',{name:'Reverse reviewed batch',exact:true}).click();await main.getByText('1 placements reversed with a recorded reason.',{exact:true}).waitFor();await main.close()
 console.log('PASS history prerequisite, unauthorized navigation and Main Admin reviewed reversal')
}finally{await runtime.close()}
