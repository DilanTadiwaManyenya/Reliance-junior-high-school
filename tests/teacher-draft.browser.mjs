import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { startPortalBrowser } from './helpers/portal-browser.mjs'
const r=await startPortalBrowser()
try {
 for(const campus of ['senior','junior']) {
  const p=await r.browser.newPage({viewport:{width:390,height:480}})
  await p.route('https://fonts.googleapis.com/**',route=>route.abort())
  await p.route('https://fonts.gstatic.com/**',route=>route.abort())
  const params=new URLSearchParams({campus,class:campus==='senior'?'Form 1':'Grade 4',section:'coursework',workspace:'subjects',allocation:'allocation',subject:'Combined Science',level:'Form 1'})
  await p.goto(`${r.base}/tests/fixtures/teacher-workspace/index.html?${params}`,{waitUntil:'domcontentloaded'})
  if(campus==='junior'){await p.locator('form select').nth(1).selectOption({index:1});await p.locator('form select').nth(2).selectOption({index:1})}
  const assessment=p.locator('.coursework-heading select')
  await assessment.selectOption('assessment')
  const mark=p.getByLabel('Mark for Alexandra Example Learner With A Longer Name',{exact:true})
  await mark.fill('51')
  assert.equal(await mark.getAttribute('aria-invalid'),'true')
  await mark.fill('18.5')
  await p.getByRole('status').filter({hasText:'Unsaved changes'}).waitFor()
  p.once('dialog',dialog=>dialog.dismiss())
  await assessment.selectOption('')
  assert.equal(await assessment.inputValue(),'assessment')
  assert.equal(await mark.inputValue(),'18.5')
  await p.evaluate(()=>window.fixtureFailMarks=true)
  await p.getByRole('button',{name:'Save 2 marks',exact:true}).click()
  await p.getByRole('alert').filter({hasText:'Synthetic mark save failed'}).waitFor()
  assert.equal(await mark.inputValue(),'18.5')
  await p.getByRole('status').filter({hasText:'Unsaved changes'}).waitFor()
  await p.evaluate(()=>window.fixtureFailMarks=false)
  await p.getByRole('button',{name:'Save 2 marks',exact:true}).click()
  await p.waitForFunction(()=>!document.querySelector('.coursework-marks-progress').textContent.includes('Unsaved changes'))
  await mark.fill('19')
  p.once('dialog',dialog=>dialog.dismiss())
  await p.locator('.coursework-back').click()
  assert.equal(await mark.inputValue(),'19')
  if(campus==='senior'){await mkdir('tmp/mobile-teacher-review',{recursive:true});await p.screenshot({path:'tmp/mobile-teacher-review/draft-390.png',fullPage:true})}
  p.once('dialog',dialog=>dialog.accept())
  await p.locator('.coursework-back').click()
  await p.waitForFunction(()=>new URLSearchParams(location.search).get('section')!=='coursework')
  await p.close()
  console.log(`PASS ${campus}: invalid marks, discard cancellation, failed save retains draft, retry and explicit discard`)
 }
}finally{await r.close()}
