import assert from 'node:assert/strict'
import {startPortalBrowser} from './helpers/portal-browser.mjs'
const runtime=await startPortalBrowser()
try {
 for(const campus of ['junior','senior'])for(const width of [390,1280]) {
  const page=await runtime.browser.newPage({viewport:{width,height:850}})
  const errors=[];page.on('pageerror',error=>errors.push(error.message))
  await page.goto(runtime.base+'/tests/fixtures/teacher-workspace/index.html?campus='+campus+'&section=settings')
  await page.getByRole('heading',{name:'Account settings',exact:true}).waitFor()
  await page.getByLabel('Mobile number',{exact:true}).fill('+263771111222')
  await page.locator('#staff-new-password').fill('SyntheticLaunch123!')
  await page.locator('#staff-confirm-password').fill('DifferentSynthetic123!')
  await page.getByRole('button',{name:'Save account settings',exact:true}).click()
  await page.getByText('The passwords do not match.',{exact:true}).waitFor()
  assert.equal(await page.evaluate(()=>window.fixtureCredentialCalls?.length||0),0)
  await page.locator('#staff-confirm-password').fill('SyntheticLaunch123!')
  await page.evaluate(()=>{window.fixtureCredentialFail=true})
  await page.getByRole('button',{name:'Save account settings',exact:true}).click()
  await page.getByText('Synthetic credential failure',{exact:true}).waitFor()
  await page.evaluate(()=>{window.fixtureCredentialFail=false})
  await page.getByRole('button',{name:'Save account settings',exact:true}).click()
  await page.getByText('Your phone number and password have been updated.',{exact:true}).waitFor()
  const calls=await page.evaluate(()=>window.fixtureCredentialCalls)
  assert.equal(calls.length,2)
  assert.ok(calls.every(call=>call.name==='update_teacher_credentials'&&call.selfOnly&&call.passwordProvided))
  assert.equal(await page.locator('#staff-new-password').inputValue(),'')
  assert.equal(await page.locator('#staff-confirm-password').inputValue(),'')
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1))
  assert.deepEqual(errors,[])
  console.log('PASS synthetic teacher credentials '+campus+' '+width+'px: validation, self-only request, error/retry and cleared fields')
  await page.close()
 }
} finally {await runtime.close()}
