import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { mkdir, writeFile } from 'node:fs/promises'
import { gzipSync } from 'node:zlib'
import { preview } from 'vite'
const { chromium }=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright')
const server=await preview({preview:{host:'127.0.0.1',port:0},logLevel:'error'})
const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||'msedge'})
const samples=[]
try {
 for(let run=0;run<3;run++) {
  const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'})
  await context.route('https://fonts.googleapis.com/**',route=>route.abort())
  await context.route('https://fonts.gstatic.com/**',route=>route.abort())
  const page=await context.newPage(), downloads=[]
  page.on('response',response=>{if(new URL(response.url()).pathname.endsWith('.js'))downloads.push(response.body().then(body=>({path:new URL(response.url()).pathname,bytes:body.length,gzipBytes:gzipSync(body).length})))})
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/portal/login`,{waitUntil:'networkidle'})
  await page.getByRole('heading',{name: 'Welcome back'}).waitFor()
  const assets=await Promise.all(downloads)
  const timing=await page.evaluate(()=>({domContentLoadedMs:performance.getEntriesByType('navigation')[0].domContentLoadedEventEnd,loadMs:performance.getEntriesByType('navigation')[0].loadEventEnd}))
  assert.ok(assets.length)
  assert.ok(!assets.some(asset=>/StaffDashboard|RoleDashboard|AcademicReport|ParentRecord/.test(asset.path)), "Login must not download unrelated workspace/report pages")
  assert.ok(assets.reduce((n,a)=>n+a.bytes,0)<=600000, "Login JavaScript budget: 600 KB uncompressed")
  samples.push({run:run+1,...timing,jsBytes:assets.reduce((n,a)=>n+a.bytes,0),jsGzipBytes:assets.reduce((n,a)=>n+a.gzipBytes,0),assets})
  await context.close()
 }
 await mkdir('tmp/mobile-performance',{recursive:true})
 const label=process.env.PERF_LABEL||'baseline'
 await writeFile(`tmp/mobile-performance/${label}.json`,JSON.stringify({conditions:'Local production preview; Edge headless, 390x844; fresh contexts; no throttling; external fonts blocked; gzip sizes calculated, not network transfer measurements.',samples},null,2))
 console.log(JSON.stringify({label,samples:samples.map(({assets,...sample})=>sample)},null,2))
} finally {await browser.close();await server.close()}

