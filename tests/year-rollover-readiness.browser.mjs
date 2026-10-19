import assert from 'node:assert/strict'
import { readFile,mkdir } from 'node:fs/promises'
import { startPortalBrowser,openPortal,portalLayoutMetrics } from './helpers/portal-browser.mjs'
const runtime=await startPortalBrowser()
try{
 for(const width of [320,390,667,1280]){
  const page=await openPortal(runtime.browser,runtime.base,{role:'admin',section:'year-planning'},width)
  await page.locator('.rollover-card').first().waitFor()
  assert.equal(await page.locator('.rollover-card').count(),50)
  await page.getByRole('button',{name:'Load more learners',exact:true}).click()
  await page.waitForFunction(()=>document.querySelectorAll('.rollover-card').length===52)
  const event=page.waitForEvent('download')
  await page.getByRole('button',{name:'Export loaded review',exact:true}).click()
  const download=await event
  assert.equal(download.suggestedFilename(),'rollover-review-junior-2027.csv')
  const csv=await readFile(await download.path(),'utf8')
  assert.ok(csv.includes('Source year'));assert.equal(csv.split('\r\n').length,53)
  await page.getByLabel('Find learner',{exact:true}).fill('Brian')
  await page.waitForFunction(()=>document.querySelectorAll('.rollover-card').length===1)
  assert.match(await page.locator('.rollover-card').innerText(),/Brian/)
  await page.getByLabel('Find learner',{exact:true}).fill('')
  await page.getByLabel('Rollover campus',{exact:true}).selectOption('senior')
  await page.waitForFunction(()=>document.querySelectorAll('.rollover-card').length===3)
  assert.match(await page.locator('.rollover-card').first().innerText(),/Senior Example/)
  await page.getByLabel('Find learner',{exact:true}).fill('No such learner')
  await page.getByText('No active learners match this review.',{exact:true}).waitFor()
  await page.getByLabel('Find learner',{exact:true}).fill('')
  await page.locator('.rollover-card').first().waitFor()
  const metrics=await portalLayoutMetrics(page)
  assert.ok(metrics.documentWidth<=width+1,JSON.stringify(metrics));assert.deepEqual(metrics.clipped,[]);assert.deepEqual(metrics.smallFields,[])
  assert.deepEqual(page.portalErrors,[])
  assert.equal(await page.getByRole('button',{name:/^(Apply|Promote|Save promotion)/}).count(),0)
  assert.equal(await page.evaluate(()=>window.fixtureWrites.some(row=>['students','fee_balances','academic_records'].includes(row.table))),false)
  if(width===390){await mkdir('tmp/rollover-review',{recursive:true});await page.screenshot({path:'tmp/rollover-review/readiness-390.png'})}
  await page.close();console.log(`PASS rollover review ${width}px: pagination, CSV, search, campus switch and layout`)
 }
 for(const campus of ['junior','senior']){
  const page=await openPortal(runtime.browser,runtime.base,{role:'admin',campus,section:'year-planning'},390)
  await page.locator('.rollover-card').first().waitFor()
  assert.equal(await page.getByLabel('Rollover campus',{exact:true}).count(),0)
  assert.ok(await page.evaluate(campus=>window.fixtureRolloverCalls.every(call=>call.p_campus===campus),campus))
  await page.close();console.log(`PASS ${campus} administrator review fixed to assigned campus`)
 }
 const error=await openPortal(runtime.browser,runtime.base,{role:'admin',section:'year-planning',rolloverError:'1'},390)
 await error.getByRole('alert').waitFor();await error.evaluate(()=>{window.fixtureRolloverError=false})
 await error.getByRole('button',{name:'Retry review',exact:true}).click();await error.locator('.rollover-card').first().waitFor();await error.close()
 console.log('PASS unavailable preview and retry')
 for(const role of ['accountant','teacher','parent','principal']){
  const page=await openPortal(runtime.browser,runtime.base,{role,section:'year-planning'},390)
  assert.equal(await page.getByRole('heading',{name:'Year rollover readiness',exact:true}).count(),0)
  assert.equal(await page.getByRole('button',{name:'Year rollover readiness',exact:true,includeHidden:true}).count(),0)
  assert.equal(await page.evaluate(()=>window.fixtureRolloverCalls.length),0)
  await page.close()
 }
 console.log('PASS non-admin roles cannot open the planning workspace')
}finally{await runtime.close()}
