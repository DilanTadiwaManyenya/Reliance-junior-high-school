import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { startPortalBrowser, openPortal, portalLayoutMetrics } from './helpers/portal-browser.mjs'
const runtime=await startPortalBrowser()
try {
 for(const width of [320,390,667,1280]) {
  for(const section of ['roster','staff','progress-reports']) {
   const page=await openPortal(runtime.browser,runtime.base,{role:'admin',section},width)
   const table=page.locator('.mobile-record-table')
   await table.locator('tbody tr').first().waitFor()
   assert.ok(await table.getByRole('columnheader').count()>=4)
   if(width<=767) assert.equal(await table.evaluate(el=>el.scrollWidth<=el.clientWidth+1),true,`${section} must reflow without horizontal scrolling`)
   if(section==='roster') {
    await page.getByLabel('Search',{exact:true}).fill('Alexandra')
    assert.equal(await table.locator('tbody tr').count(),1)
    await table.getByRole('button',{name:'Edit',exact:true}).click()
    assert.match(await page.getByRole('textbox',{name:'Full name',exact:true}).inputValue(),/Alexandra/)
    assert.equal(await page.getByRole('button',{name:'Save changes',exact:true}).count(),1)
   }
   if(section==='staff') {
    await page.getByLabel('Search staff',{exact:true}).fill('Example Teacher')
    assert.equal(await table.locator('tbody tr').count(),1)
    assert.match(await table.innerText(),/Example Teacher/)
    await table.getByRole('button',{name:'Manage',exact:true}).click()
    await page.getByRole('dialog').waitFor()
    await page.waitForFunction(() => { const dialog=document.querySelector('[role=dialog]'); return dialog?.contains(document.activeElement) })
    await page.keyboard.press('Escape')
    await page.getByRole('dialog').waitFor({state:'detached'})
   }
   const metrics=await portalLayoutMetrics(page)
   assert.ok(metrics.documentWidth<=width+1)
   assert.deepEqual(metrics.clipped,[])
   assert.deepEqual(page.portalErrors,[])
   if(width===390) {await mkdir('tmp/mobile-admin-review',{recursive:true});await page.screenshot({path:`tmp/mobile-admin-review/${section}-390.png`,fullPage:true})}
   await page.emulateMedia({media:'print'})
   assert.equal(await table.evaluate(el=>getComputedStyle(el).display),'table')
   await page.close()
   console.log(`PASS ${section} ${width}px: record reflow, existing actions and print table`)
  }
 }
 const principal=await openPortal(runtime.browser,runtime.base,{role:'principal'},320)
 assert.equal(await principal.getByRole('button',{name:'Open classes',exact:true}).count(),0)
 await principal.getByRole('button',{name:'Find staff',exact:true}).click()
 await principal.getByRole('table',{name:'Staff directory',exact:true}).waitFor()
 assert.equal(await principal.getByRole('button',{name:'Credentials',exact:true}).count(),0)
 await principal.close()
} finally {await runtime.close()}
