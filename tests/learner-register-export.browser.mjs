import assert from 'node:assert/strict'
import {mkdir} from 'node:fs/promises'
import {startPortalBrowser,openPortal,portalLayoutMetrics} from './helpers/portal-browser.mjs'
const runtime=await startPortalBrowser()
await mkdir('tmp/stage10-exports',{recursive:true})
try{
 for(const width of [320,390,667,1280]){
  const page=await openPortal(runtime.browser,runtime.base,{role:'admin',campus:'senior',section:'bulk-import',...(width===390?{registerLarge:'1'}:{})},width)
  await page.getByRole('radio',{name:/Whole campus/}).check()
  await page.getByRole('button',{name:'Preview learner list',exact:true}).click()
  await page.locator('.bulk-export-preview').waitFor()
  const expected=width===390?1007:2
  assert.equal(await page.locator('.bulk-export-table tbody tr').count(),Math.min(200,expected))
  const csvDownload=page.waitForEvent('download');await page.getByRole('button',{name:'Download CSV',exact:true}).click();const csv=await csvDownload;await csv.saveAs(`tmp/stage10-exports/register-${width}.csv`)
  const xlsxDownload=page.waitForEvent('download');await page.getByRole('button',{name:'Download Excel',exact:true}).click();const xlsx=await xlsxDownload;await xlsx.saveAs(`tmp/stage10-exports/register-${width}.xlsx`)
  const metrics=await portalLayoutMetrics(page);assert.ok(metrics.documentWidth<=width+1,JSON.stringify(metrics));assert.deepEqual(metrics.clipped,[]);assert.deepEqual(metrics.smallFields,[])
  const title=await page.title();await page.emulateMedia({media:'print'});await page.evaluate(()=>window.dispatchEvent(new Event('beforeprint')))
  assert.equal(await page.locator('.bulk-export-table tbody tr').count(),expected,'print contains every snapshot row')
  assert.equal(await page.locator('[data-print-register]').count(),1)
  assert.equal(await page.locator('[data-print-register]').evaluate(el=>getComputedStyle(el).visibility),'visible')
  const printMetrics=await page.locator('[data-print-register]').evaluate(el=>({height:el.getBoundingClientRect().height,width:el.getBoundingClientRect().width,scroll:el.scrollWidth}))
  assert.ok(printMetrics.height>100&&printMetrics.width>200,JSON.stringify(printMetrics))
  await page.pdf({path:`tmp/stage10-exports/register-${width}.pdf`,preferCSSPageSize:true,printBackground:true})
  await page.evaluate(()=>window.dispatchEvent(new Event('afterprint')));await page.emulateMedia({media:'screen'})
  assert.equal(await page.title(),title);assert.equal(await page.locator('[data-print-register]').count(),0);assert.equal(await page.locator('.bulk-export-table tbody tr').count(),Math.min(200,expected))
  await page.getByRole('radio',{name:/Class · all streams/}).check();assert.equal(await page.locator('.bulk-export-preview').count(),0,'scope change clears previous export')
  assert.deepEqual(page.portalErrors,[]);await page.close();console.log(`PASS register ${width}px: ${expected} rows, CSV/XLSX, print isolation, title restore and stale preview removal`)
 }
 const failed=await openPortal(runtime.browser,runtime.base,{role:'admin',section:'bulk-import',registerError:'1'},390)
 await failed.getByRole('button',{name:'Preview learner list',exact:true}).click();await failed.getByRole('alert').waitFor();assert.equal(await failed.getByRole('button',{name:'Download CSV',exact:true}).count(),0)
 await failed.evaluate(()=>{window.fixtureRegisterError=false});await failed.getByRole('button',{name:'Preview learner list',exact:true}).click();await failed.locator('.bulk-export-preview').waitFor();await failed.close()
 const delayed=await openPortal(runtime.browser,runtime.base,{role:'admin',section:'bulk-import',registerDelayed:'1'},390)
 await delayed.getByRole('button',{name:'Preview learner list',exact:true}).click();await delayed.waitForFunction(()=>Boolean(window.fixtureResolveRegister));await delayed.getByRole('radio',{name:/All campuses/}).check();await delayed.evaluate(()=>window.fixtureResolveRegister());await delayed.waitForTimeout(100);assert.equal(await delayed.locator('.bulk-export-preview').count(),0);await delayed.close()
 for(const role of ['parent','teacher','accountant','principal']){const page=await openPortal(runtime.browser,runtime.base,{role,section:'bulk-import'},390);assert.equal(await page.getByRole('button',{name:'Preview learner list',exact:true}).count(),0);await page.close()}
 console.log('PASS register read-error recovery, delayed-response isolation and management role gates')
}finally{await runtime.close()}
