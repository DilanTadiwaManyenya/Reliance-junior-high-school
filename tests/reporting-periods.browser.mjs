import assert from 'node:assert/strict'
import {startPortalBrowser,openPortal,portalLayoutMetrics} from './helpers/portal-browser.mjs'
const runtime=await startPortalBrowser()
try{
 for(const width of [320,390,667,1280]){
  const page=await openPortal(runtime.browser,runtime.base,{role:'admin',campus:'junior',section:'reporting-periods'},width)
  await page.getByRole('button',{name:'Review closing Term 3 2026',exact:true}).click()
  await page.getByLabel('Term change reason').fill('School approved end of reporting period')
  await page.getByRole('button',{name:'Save reviewed term change',exact:true}).click()
  await page.getByRole('button',{name:'Review reopening Term 3 2026',exact:true}).waitFor()
  const first=await page.evaluate(()=>window.fixtureWrites.find(r=>r.table==='rpc:change_reporting_period').payload)
  assert.equal(first.p_campus,'junior');assert.equal(first.p_expected_revision,1);assert.equal(first.p_action,'close')
  await page.getByRole('button',{name:'Review reopening Term 3 2026',exact:true}).click();await page.getByLabel('Term change reason').fill('Authorised correction following mark review');await page.getByRole('button',{name:'Save reviewed term change',exact:true}).click();await page.getByRole('button',{name:'Review closing Term 3 2026',exact:true}).waitFor()
  const metrics=await portalLayoutMetrics(page);assert.ok(metrics.documentWidth<=width+1,JSON.stringify(metrics));assert.deepEqual(metrics.clipped,[]);assert.deepEqual(metrics.smallFields,[]);assert.deepEqual(page.portalErrors,[]);await page.close();console.log(`PASS term close/reopen review ${width}px: reason, revision and fixed campus`)
 }
 for(const campus of ['junior','senior']){
  const page=await runtime.browser.newPage({viewport:{width:390,height:844}})
  const params=new URLSearchParams({campus,class:'Grade 1',section:'coursework',workspace:'subjects',allocation:'allocation',subject:'Combined Science',level:'Form 1',registryYear:'2027',registryTerm:'2'})
  await page.goto(`${runtime.base}/tests/fixtures/teacher-workspace/index.html?${params}`)
  await page.getByText('New assessments: Term 2 2027',{exact:true}).waitFor()
  if(campus==='junior')await page.locator('form select').nth(1).selectOption({index:1})
  await page.getByLabel('Assessment title',{exact:true}).fill('Registry default acceptance')
  await page.locator('form input[type="number"]').fill('40')
  await page.getByRole('button',{name:'Create assessment',exact:true}).click()
  await page.waitForFunction(()=>window.fixtureWrites.some(r=>r.table==='coursework_assessments'))
  const created=await page.evaluate(()=>window.fixtureWrites.find(r=>r.table==='coursework_assessments').payload)
  assert.equal(created.academic_year,2027);assert.equal(created.term,'2');await page.close()
 }
 const none=await runtime.browser.newPage();await none.goto(`${runtime.base}/tests/fixtures/teacher-workspace/index.html?campus=senior&section=coursework&workspace=subjects&allocation=allocation&subject=Combined+Science&level=Form+1&noCurrentPeriod=1`);await none.getByText(/No open current reporting period/).waitFor();assert.equal(await none.getByRole('button',{name:'Create assessment',exact:true}).isDisabled(),true);await none.close()
 for(const role of ['teacher','accountant','principal']){const page=await openPortal(runtime.browser,runtime.base,{role,section:'reporting-periods'},390);assert.equal(await page.getByRole('heading',{name:'Terms and marks locking',exact:true}).count(),0);await page.close()}
 console.log('PASS Junior/Senior registry defaults, missing-current fail-closed creation and management role gates')
}finally{await runtime.close()}
