import assert from 'node:assert/strict'
import { startPortalBrowser } from './helpers/portal-browser.mjs'
const runtime=await startPortalBrowser()
try {
 for (const campus of ['senior','junior']) {
  const page=await runtime.browser.newPage({viewport:{width:390,height:480}})
  await page.route('https://fonts.googleapis.com/**',route=>route.abort())
  await page.route('https://fonts.gstatic.com/**',route=>route.abort())
  await page.addInitScript(()=>{window.fixturePops=0;window.addEventListener('popstate',()=>{window.fixturePops++},true)})
  const errors=[];page.on('pageerror',error=>errors.push(error.message))
  let decision='dismiss',dialogs=0
  page.on('dialog',async dialog=>{dialogs++;await dialog[decision]()})
  const params=new URLSearchParams({campus,class:'Grade 4',section:campus==='junior'?'dashboard':'subject-allocations',workspace:'subjects',allocation:'allocation',subject:'Combined Science',level:'Form 1'})
  await page.goto(`${runtime.base}/tests/fixtures/teacher-workspace/index.html?${params}`,{waitUntil:'domcontentloaded'})
  await page.getByRole('button',{name:campus==='junior'?'Course Work':/^Open course work/}).click()
  await page.locator('.coursework-page').waitFor()
  const courseworkUrl=page.url()
  // Make a real future entry using the portal, then return through browser history.
  await page.locator('.coursework-back').click()
  await page.locator('.coursework-page').waitFor({state:'detached'})
  await page.goBack()
  await page.locator('.coursework-page').waitFor()
  const mark=page.getByLabel('Mark for Alexandra Example Learner With A Longer Name',{exact:true})
  const enterDraft=async()=>{
   if(campus==='junior') {
    await page.locator('form select').nth(1).selectOption({index:1})
    await page.locator('form select').nth(2).selectOption({index:1})
   }
   await page.locator('.coursework-heading select').selectOption('assessment')
   await mark.fill('18.5')
   await page.getByRole('status').filter({hasText:'Unsaved changes'}).waitFor()
  }
  const traverse=async(direction,restored)=>{
   const before=await page.evaluate(()=>window.fixturePops)
   await page.evaluate(direction=>window.history[direction](),direction)
   try { await page.waitForFunction(expected=>window.fixturePops>=expected,before+(restored?2:1)) }
   catch(error) { console.error({campus,direction,restored,before,dialogs,state:await page.evaluate(()=>({pops:window.fixturePops,index:history.state?.idx,url:location.href,mark:document.querySelector('.coursework-marks input')?.value}))});throw error }
   if(restored) {
    await page.waitForURL(courseworkUrl)
    assert.equal(await mark.inputValue(),'18.5')
   }
  }
  await enterDraft()
  const historyLength=await page.evaluate(()=>history.length)
  for(const direction of ['back','forward','back']) {
   const count=dialogs
   await traverse(direction,true)
   assert.equal(dialogs,count+1,`${campus}: exactly one confirmation per cancelled ${direction}`)
   assert.equal(await page.evaluate(()=>history.length),historyLength,'Cancellation must preserve the history stack')
   assert.equal(await page.evaluate(()=>window.fixtureWrites.filter(row=>['coursework_marks','junior_component_marks','coursework_assessments'].includes(row.table)).length),0,'Cancelled navigation must not save marks')
  }
  decision='accept'
  await traverse('back',false)
  await page.locator('.coursework-page').waitFor({state:'detached'})
  await page.goForward()
  await page.locator('.coursework-page').waitFor()
  await enterDraft()
  await traverse('forward',false)
  await page.locator('.coursework-page').waitFor({state:'detached'})
  assert.equal(await page.evaluate(()=>window.fixtureWrites.filter(row=>['coursework_marks','junior_component_marks','coursework_assessments'].includes(row.table)).length),0,'Confirmed discard must not save marks')
  await page.goBack()
  await page.locator('.coursework-page').waitFor()
  await enterDraft()
  await page.evaluate(()=>{window.fixtureHoldMarks=true})
  await page.getByRole('button',{name:'Save 2 marks',exact:true}).click()
  await page.waitForFunction(()=>typeof window.fixtureReleaseMarks==='function')
  const count=dialogs
  await traverse('back',true)
  assert.equal(dialogs,count,'Saving must block traversal without offering to discard an in-flight save')
  await page.evaluate(()=>window.fixtureReleaseMarks())
  await page.waitForFunction(()=>{const text=document.querySelector('.coursework-marks-progress').textContent;return !text.includes('Unsaved changes')&&!text.includes('Saving marks')})
  assert.equal(await page.evaluate(()=>window.fixtureWrites.filter(row=>row.table==='coursework_marks').length),1,'Save completes once')
  await traverse('back',false)
  await page.locator('.coursework-page').waitFor({state:'detached'})
  assert.equal(dialogs,count,'A saved assessment must not prompt on Back')
  assert.deepEqual(errors,[])
  await page.close()
  console.log(`PASS ${campus}: native Back/Forward cancellation, confirmed discard, preserved history, pending save protection and clean return`)
 }
} finally {await runtime.close()}
