import assert from 'node:assert/strict'
import { startPortalBrowser, portalLayoutMetrics } from './helpers/portal-browser.mjs'
const runtime=await startPortalBrowser()
try{
 for(const width of [320,390,667,1280])for(const flow of ['setup','verify','error']){
  const page=await runtime.browser.newPage({viewport:{width,height:667===width?390:844}})
  await page.route('https://fonts.googleapis.com/**',route=>route.abort());await page.route('https://fonts.gstatic.com/**',route=>route.abort())
  const errors=[];page.on('pageerror',e=>errors.push(e.message))
  await page.goto(`${runtime.base}/tests/fixtures/portal/index.html?role=admin&mfa=${flow}`,{waitUntil:'domcontentloaded'})
  const gate=page.locator('.admin-mfa');await gate.waitFor()
  assert.equal(await page.locator('.staff-shell').count(),0,'admin data shell hidden until verified')
  if(flow==='error')await gate.getByRole('button',{name:'Try again'}).click()
  if(flow!=='verify'){
   const android=gate.getByRole('link',{name:'Install Google Authenticator for Android',exact:true})
   const iphone=gate.getByRole('link',{name:'Install Google Authenticator for iPhone',exact:true})
   assert.equal(await android.getAttribute('href'),'https://play.google.com/store/apps/details?id=com.google.android.apps.authenticator2')
   assert.equal(await iphone.getAttribute('href'),'https://apps.apple.com/app/google-authenticator/id388497605')
   for(const store of [android,iphone]){assert.equal(await store.getAttribute('target'),'_blank');assert.match(await store.getAttribute('rel'),/noreferrer/)}
   await gate.getByRole('button',{name:'Set up authenticator'}).click()
   await gate.getByAltText('Authenticator setup QR code').waitFor()
   assert.equal(await page.evaluate(()=>window.fixtureMfaEnrolls),1)
   assert.equal(await android.isVisible(),true,'store help remains available after enrollment without restarting setup')
   await gate.getByRole('heading',{name:'3. Enter the code from your app',exact:true}).waitFor()
   await gate.getByText('On the same phone? Copy a setup key').click();assert.equal(await gate.getByLabel('Setup key').inputValue(),'SYNTHETICSETUPKEY')
   await page.evaluate(()=>{Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async value=>{window.copiedFixtureKey=value}}})})
   await gate.getByRole('button',{name:'Copy setup key',exact:true}).click()
   await gate.getByText('Setup key copied. Paste it into your authenticator app.',{exact:true}).waitFor()
   assert.equal(await page.evaluate(()=>window.copiedFixtureKey),'SYNTHETICSETUPKEY')
   await page.evaluate(()=>{navigator.clipboard.writeText=async()=>{throw new Error('Clipboard denied')}})
   await gate.getByRole('button',{name:'Copy setup key',exact:true}).click()
   await gate.getByText(/Copy is unavailable in this browser/).waitFor()
   assert.equal(await gate.getByLabel('Setup key').evaluate(el=>el.selectionEnd-el.selectionStart===el.value.length),true)
  }
  const code=gate.getByLabel('Six-digit code');assert.equal(await code.getAttribute('inputmode'),'numeric');assert.equal(await code.getAttribute('readonly'),null);await code.fill('000000');await gate.getByRole('button',{name:'Verify and continue'}).click()
  await gate.getByRole('alert').waitFor();assert.equal(await page.locator('.staff-shell').count(),0)
  const metrics=await portalLayoutMetrics(page);assert.ok(metrics.documentWidth<=width+1);assert.deepEqual(metrics.clipped,[])
  await code.fill('123456');await gate.getByRole('button',{name:'Verify and continue'}).click();await page.locator('.staff-shell').waitFor();await page.waitForFunction(()=>document.querySelectorAll('.admin-mfa').length===0);assert.equal(await gate.count(),0);assert.deepEqual(errors,[])
  await page.close();console.log(`PASS MFA ${flow} ${width}px: gate, retry, invalid code, verified access and layout`)
 }
 const page=await runtime.browser.newPage();await page.goto(`${runtime.base}/tests/fixtures/portal/index.html?role=admin&mfa=verify&noUpgrade=1`,{waitUntil:'domcontentloaded'});await page.getByLabel('Six-digit code').fill('123456');await page.getByRole('button',{name:'Verify and continue'}).click();await page.getByRole('alert').waitFor();assert.equal(await page.locator('.staff-shell').count(),0);await page.close();console.log('PASS verification response without aal2 remains blocked')
}finally{await runtime.close()}
