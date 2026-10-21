import assert from 'node:assert/strict'
import {startPortalBrowser} from './helpers/portal-browser.mjs'
const runtime=await startPortalBrowser()
try {
 for(const width of [320,390,1280]) {
  const page=await runtime.browser.newPage({viewport:{width,height:850}})
  const errors=[];page.on('pageerror',error=>errors.push(error.message))
  await page.goto(runtime.base+'/tests/fixtures/teacher-workspace/index.html?campus=junior&class=ECD+A&section=entry&extraEcdScopes=')
  const classes=page.getByLabel('Class',{exact:true}),learner=page.getByLabel('Learner',{exact:true})
  await classes.selectOption('ECD A')
  await learner.locator('option[value="learner-0"]').waitFor({state:'attached'})
  assert.equal(await learner.locator('option[value="ecd-b-learner"]').count(),0)
  await learner.selectOption('learner-0')
  await classes.selectOption('ECD B')
  await learner.locator('option[value="ecd-b-learner"]').waitFor({state:'attached'})
  assert.equal(await learner.inputValue(),'')
  assert.equal(await learner.locator('option[value="learner-0"]').count(),0)
  assert.equal(await learner.locator('option[value="outside-campus"]').count(),0)
  await classes.selectOption('ECD A')
  await learner.locator('option[value="learner-0"]').waitFor({state:'attached'})
  assert.equal(await learner.locator('option[value="ecd-b-learner"]').count(),0)
  const geometry=await page.evaluate(()=>({width:innerWidth,actual:document.documentElement.scrollWidth,outside:[...document.querySelectorAll('main *,header *')].filter(el=>el.getBoundingClientRect().width>0&&el.getBoundingClientRect().right>innerWidth+1).map(el=>({tag:el.tagName,class:el.className,right:el.getBoundingClientRect().right})).slice(0,12)}))
  assert.ok(geometry.actual<=geometry.width+1,JSON.stringify(geometry))
  assert.deepEqual(errors,[])
  console.log('PASS ECD A/B scope switching and mobile containment '+width+'px')
  await page.close()
 }
} finally {await runtime.close()}
