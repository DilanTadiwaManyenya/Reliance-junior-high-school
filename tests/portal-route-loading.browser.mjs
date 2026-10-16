import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { mkdir } from 'node:fs/promises'
import { preview } from 'vite'
const { chromium }=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright')
const server=await preview({preview:{host:'127.0.0.1',port:0},logLevel:'error'})
const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||'msedge'})
const base=`http://127.0.0.1:${server.httpServer.address().port}`
try {
 const context=await browser.newContext({viewport:{width:320,height:480},reducedMotion:'reduce'})
 await context.route('https://fonts.googleapis.com/**',route=>route.abort())
 await context.route('https://fonts.gstatic.com/**',route=>route.abort())
 const page=await context.newPage()
 let release
 const held=new Promise(resolve=>{release=resolve})
 await context.route('**/assets/PortalLogin-*.js',async route=>{await held;await route.continue()})
 await page.goto(base+'/portal/login',{waitUntil:'domcontentloaded'})
 await page.getByRole('status').getByText('Opening page…').waitFor()
 assert.equal(await page.getByRole('status').getAttribute('aria-busy'),'true')
 release()
 await page.getByRole('heading',{name:'Welcome back'}).waitFor()
 await context.close()
 console.log('PASS delayed production page download has an announced loading state')
 const retry=await browser.newContext({viewport:{width:320,height:480},reducedMotion:'reduce'})
 await retry.route('https://fonts.googleapis.com/**',route=>route.abort())
 await retry.route('https://fonts.gstatic.com/**',route=>route.abort())
 let fail=true
 await retry.route('**/assets/PortalLogin-*.js',route=>fail?route.abort():route.continue())
 const broken=await retry.newPage()
 await broken.goto(base+'/portal/login',{waitUntil:'domcontentloaded'})
 const message=broken.getByRole('alert')
 await message.getByRole('heading',{name:'This page could not open'}).waitFor()
 assert.equal(await message.evaluate(el=>el===document.activeElement),true)
 await broken.evaluate(()=>document.documentElement.style.fontSize='200%')
 assert.ok(await broken.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1))
 await broken.keyboard.press('Tab')
 const reload=broken.getByRole('button',{name:'Reload page'})
 assert.equal(await reload.evaluate(el=>el===document.activeElement),true)
 assert.notEqual(await reload.evaluate(el=>getComputedStyle(el).outlineStyle),'none')
 await mkdir('tmp/mobile-performance',{recursive:true})
 await broken.screenshot({path:'tmp/mobile-performance/page-retry-320.png'})
 fail=false
 await reload.click()
 await broken.getByRole('heading',{name:'Welcome back'}).waitFor()
 assert.equal(await broken.getByRole('alert').count(),0)
 for (const route of ['/', '/about', '/academics', '/admissions', '/student-life', '/facilities', '/staff', '/gallery', '/news', '/contact', '/portal', '/missing-page']) {
  await broken.goto(base+route,{waitUntil:'domcontentloaded'})
  await broken.locator('h1').first().waitFor()
  assert.equal(await broken.getByRole('heading',{name:'This page could not open'}).count(),0,route)
 }
 await broken.goto(base+'/portal/staff',{waitUntil:'domcontentloaded'})
 await broken.getByRole('heading',{name:'Welcome back'}).waitFor()
 assert.ok(broken.url().endsWith('/portal/login'),'Unauthenticated private route remains guarded')
 await retry.close()
 console.log('PASS public route chunks and unauthenticated private redirect')
 console.log('PASS failed page download: focus, keyboard, 200% reflow and explicit reload recovery')
} finally {await browser.close();await server.close()}
