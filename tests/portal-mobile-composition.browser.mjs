import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { startPortalBrowser, portalLayoutMetrics } from './helpers/portal-browser.mjs'
const runtime=await startPortalBrowser()
await mkdir('tmp/mobile-composition',{recursive:true})
const scenarios=[['admin',{role:'admin',multi:''}],['accountant',{role:'accountant',campus:'junior'}],['junior-teacher',{role:'teacher',campus:'junior'}],['senior-teacher',{role:'teacher',campus:'senior'}],['parent',{role:'parent'}]]
try {
 for(const width of [320,390,600,667,768,1280]) for(const [name,scenario] of scenarios) {
  const page=await runtime.browser.newPage({viewport:{width,height:width===667?390:844},reducedMotion:'reduce'})
  await page.route('https://fonts.googleapis.com/**',route=>route.abort())
  await page.route('https://fonts.gstatic.com/**',route=>route.abort())
  const errors=[];page.on('pageerror',error=>errors.push(error.message))
  await page.goto(`${runtime.base}/tests/fixtures/portal/index.html?${new URLSearchParams(scenario)}`,{waitUntil:'domcontentloaded'})
  const root=page.locator(name==='parent'?'.parent-record-launcher':name==='accountant'?'.fees-dashboard':name==='junior-teacher'?'.junior-teacher-home':'.dash-home')
  await root.waitFor()
  if(name==='admin'||name==='senior-teacher') {
   const list=page.getByRole('list',{name:'Recent learners',exact:true})
   if(width<=767) {
    await list.waitFor()
    assert.equal(await list.getByRole('listitem').count(),name==='admin'?3:2)
    assert.match(await list.innerText(),/Alexandra Example Learner With A Longer Name/)
    assert.match(await list.innerText(),/TEST-2026-001/)
    assert.match(await list.innerText(),/Form 1 · Blue/)
    assert.match(await list.innerText(),/Active/i)
    assert.equal(await page.locator('.dash-preview-table').isVisible(),false)
   } else {
    await page.locator('.dash-preview-table tbody tr').first().waitFor()
    assert.equal(await list.isVisible(),false)
    assert.equal(await page.locator('.dash-preview-table th').count(),5)
   }
  }
  if(width<=767) {
   const grid=page.locator(name==='parent'?'.parent-record-launcher':name==='accountant'?'.fees-stat-row':name==='junior-teacher'?'.junior-teacher-home-stats':'.dash-stats-row')
   assert.equal(await grid.evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length),name==='parent'?1:2,`${name} ${width}: phone composition`)
   if(name==='accountant') {
    const row=page.locator('.fee-master-table tbody tr').first()
    const action=row.getByRole('button',{name:'Collect payment',exact:true})
    const rowBounds=await row.boundingBox(),actionBounds=await action.boundingBox()
    assert.ok(actionBounds.width>=rowBounds.width-40,JSON.stringify({message:'Phone payment action must use the record card width',rowBounds,actionBounds,style:await row.locator('.actions-column').evaluate(el=>({display:getComputedStyle(el).display,width:getComputedStyle(el).width,padding:getComputedStyle(el).padding}))}))
   }
   if(name==='parent') {
    assert.equal(await page.locator('.parent-record-mobile-arrow').first().isVisible(),true)
    assert.equal(await page.locator('.parent-record-action').first().isVisible(),false)
    assert.equal(await page.locator('.parent-record-card').count(),7)
    if(width===390)assert.ok(await root.evaluate(el=>el.clientHeight)<900,'Parent phone actions must be more compact than tall desktop cards')
   }
  } else if(name==='parent') {
   assert.equal(await page.locator('.parent-record-mobile-arrow').first().isVisible(),false)
   assert.equal(await page.locator('.parent-record-action').first().isVisible(),true)
  }
  if(width===390&&name!=='parent') {
   await page.evaluate(()=>document.documentElement.style.fontSize='200%')
   const tiles=page.locator(name==='accountant'?'.fees-stat-row':name==='junior-teacher'?'.junior-teacher-home-stats':'.dash-stats-row')
   await page.waitForFunction(selector=>getComputedStyle(document.querySelector(selector)).gridTemplateColumns.split(' ').length===1, name==='accountant'?'.fees-stat-row':name==='junior-teacher'?'.junior-teacher-home-stats':'.dash-stats-row')
   assert.equal(await tiles.evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length),1,'Enlarged text must switch summary tiles to a comfortable single column')
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1))
   await page.evaluate(()=>document.documentElement.style.removeProperty('font-size'))
  }
  const metrics=await portalLayoutMetrics(page)
  assert.ok(metrics.documentWidth<=width+1,`${name} ${width}: document overflow`)
  assert.deepEqual(metrics.clipped,[],`${name} ${width}: clipped content`)
  if(width<=900)assert.deepEqual(metrics.smallFields,[])
  assert.deepEqual(errors,[])
  if(width===390)await page.screenshot({path:`tmp/mobile-composition/after-${name}.png`,fullPage:true})
  console.log(`PASS ${name} ${width}px: mobile composition, complete records and desktop fallback`)
  await page.close()
 }
 for(const width of [390,667,1280]) {
  const page=await runtime.browser.newPage({viewport:{width,height:width===667?390:844},reducedMotion:'reduce'})
  await page.route('https://fonts.googleapis.com/**',route=>route.abort())
  await page.route('https://fonts.gstatic.com/**',route=>route.abort())
  await page.goto(runtime.base+'/tests/fixtures/portal/index.html?'+new URLSearchParams({role:'admin',route:'/portal/admin-dashboard'}),{waitUntil:'domcontentloaded'})
  await page.locator('.professional-dashboard .dashboard-stat-grid').waitFor()
  const columns=await page.locator('.dashboard-stat-grid').evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length)
  assert.equal(columns,width<=767?2:4)
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1))
  await page.close()
  console.log('PASS alternate admin dashboard '+width+'px: phone tiles and desktop fallback')
 }
} finally {await runtime.close()}
