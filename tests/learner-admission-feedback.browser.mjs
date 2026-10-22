import assert from 'node:assert/strict'
import {startPortalBrowser} from './helpers/portal-browser.mjs'
const runtime=await startPortalBrowser()
try {
 for(const level of ['Grade 1','Grade 6','Form 1','Lower Six','Upper Six','Upper 6']) for(const width of [390,1280]) {
  const campus=level.startsWith('Grade')?'junior':'senior'
  const stream=level==='Form 1'?'Blue':'Commercials'
  const page=await runtime.browser.newPage({viewport:{width,height:850}})
  await page.goto(`${runtime.base}/tests/fixtures/teacher-workspace/index.html?campus=${campus}&class=${encodeURIComponent(level)}&stream=${stream}&section=roster`)
  await page.getByLabel('Full name',{exact:true}).fill('Unique Admission Example')
  await page.getByLabel('Date of birth',{exact:true}).fill('2015-01-01')
  await page.getByLabel('Class level',{exact:true}).selectOption(level)
  if(campus==='senior')await page.getByLabel('Class stream',{exact:true}).selectOption(stream)
  await page.getByRole('button',{name:'Add learner',exact:true}).click()
  await page.getByText('Unique Admission Example added successfully. The saved learner is shown in the roster.',{exact:true}).waitFor()
  await page.getByRole('table',{name:'Learner register'}).getByText('Unique Admission Example',{exact:true}).waitFor()
  const writes=await page.evaluate(()=>window.fixtureWrites.filter(row=>row.table==='students'))
  assert.equal(writes.length,1);assert.equal(writes[0].payload.campus,campus)
  assert.equal(await page.getByLabel('Full name',{exact:true}).inputValue(),'')
  await page.getByLabel('Full name',{exact:true}).fill('Unique Admission Exampl')
  await page.getByLabel('Date of birth',{exact:true}).fill('2015-01-01')
  await page.getByLabel('Class level',{exact:true}).selectOption(level)
  if(campus==='senior')await page.getByLabel('Class stream',{exact:true}).selectOption(stream)
  await page.getByRole('button',{name:'Add learner',exact:true}).click()
  await page.getByRole('heading',{name:'Could this learner already be enrolled?'}).waitFor()
  assert.equal(await page.evaluate(()=>window.fixtureWrites.filter(row=>row.table==='students').length),1)
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1))
  console.log(`PASS ${level} ${width}: saved learner visible, duplicate warning before second write`)
  await page.close()
 }
} finally {await runtime.close()}
