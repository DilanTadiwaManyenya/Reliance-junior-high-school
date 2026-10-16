import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { startPortalBrowser, openPortal, portalLayoutMetrics } from './helpers/portal-browser.mjs'
const runtime=await startPortalBrowser()
await mkdir('tmp/mobile-acceptance',{recursive:true})
let count=0
try {
 for(const width of [599,600,899,900,1199,1200]) for(const scenario of [
  {role:'admin',campus:'all',multi:''},
  {role:'accountant',campus:'junior'},
  {role:'teacher',campus:'senior'},
  {role:'teacher',campus:'junior'},
  {role:'parent'},
 ]) {
  const page=await openPortal(runtime.browser,runtime.base,scenario,width,600)
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))))
  const metrics=await portalLayoutMetrics(page)
  assert.ok(metrics.documentWidth<=width+1,`overflow ${scenario.role} ${width}`)
  assert.deepEqual(metrics.clipped,[],`clipped ${scenario.role} ${width}`)
  if(width<=900)assert.deepEqual(metrics.smallFields,[])
  assert.deepEqual(page.portalErrors,[])
  if(width===600||width===900)await page.screenshot({path:`tmp/mobile-acceptance/${scenario.role}-${scenario.campus||'family'}-${width}.png`})
  await page.close();count++
  console.log(`PASS boundary ${scenario.role} ${scenario.campus||'family'} ${width}px`)
 }
 for(const width of [320,1280]) {
  const page=await openPortal(runtime.browser,runtime.base,{role:'admin',route:'/portal/admin-dashboard'},width)
  const metrics=await portalLayoutMetrics(page)
  assert.ok(metrics.documentWidth<=width+1)
  assert.deepEqual(metrics.clipped,[])
  assert.deepEqual(page.portalErrors,[])
  await page.close();count++
 }
 console.log(`PASS ${count} acceptance boundary/alternate-dashboard layouts`)
} finally {await runtime.close()}
