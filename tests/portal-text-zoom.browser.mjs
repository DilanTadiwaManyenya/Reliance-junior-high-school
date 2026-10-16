import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { startPortalBrowser, openPortal, portalLayoutMetrics } from './helpers/portal-browser.mjs'
const runtime = await startPortalBrowser()
try {
 await mkdir('tmp/mobile-navigation-review',{recursive:true})
 for(const scenario of [{role:'accountant',campus:'junior'},{role:'admin',multi:''},{role:'teacher',campus:'junior'},{role:'parent'},{role:'parent',route:'/portal/login'}]) {
  const page = await openPortal(runtime.browser,runtime.base,scenario,390)
  await page.screenshot({path:`tmp/mobile-navigation-review/${scenario.route?'login':scenario.role}-390.png`,fullPage:true})
  if (scenario.route) {
   const prefix=page.locator('.phone-number > span').first()
   assert.equal(await prefix.evaluate(el=>getComputedStyle(el).whiteSpace),'nowrap')
  }
  await page.evaluate(()=>document.documentElement.style.fontSize='200%')
  const metrics=await portalLayoutMetrics(page)
  assert.ok(metrics.documentWidth<=391,`${JSON.stringify(scenario)} enlarged overflow ${metrics.documentWidth}`)
  assert.deepEqual(metrics.clipped,[],`${JSON.stringify(scenario)} enlarged clipping`)
  console.log(`PASS 200% text ${scenario.route||scenario.role}`)
  await page.close()
 }
} finally {await runtime.close()}
