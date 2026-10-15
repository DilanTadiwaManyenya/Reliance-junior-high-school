import {startPortalBrowser,openPortal} from './helpers/portal-browser.mjs'
import {mkdir} from 'node:fs/promises'
import assert from 'node:assert/strict'
const runtime=await startPortalBrowser()
await mkdir('tmp/pdfs/report-print',{recursive:true})
try {
for(const learnerClass of ['ECD A','ECD B','Grade 1','Grade 2','Grade 3','Grade 4','Grade 5','Grade 6','Grade 7','Form 1','Form 2','Form 3','Form 4','Lower Six','Upper Six']) {
 const page=await openPortal(runtime.browser,runtime.base,{role:'parent',route:'/portal/learner/learner-0/academics',learnerClass},390)
 await page.locator('.report-card').waitFor()
 await page.evaluate(()=>document.fonts.ready)
 await page.emulateMedia({media:'print'})
 await page.evaluate(()=>window.dispatchEvent(new Event('beforeprint')))
 const report=page.locator('[data-print-report]')
 assert.equal(await report.count(),1)
 assert.equal(await report.evaluate(el=>getComputedStyle(el).visibility),'visible')
 const metrics=await report.evaluate(el=>({height:el.getBoundingClientRect().height,width:el.getBoundingClientRect().width,text:el.innerText.length}))
 await page.pdf({path:`tmp/pdfs/report-print/${learnerClass.replaceAll(' ','-')}.pdf`,preferCSSPageSize:true,printBackground:true})
 console.log(learnerClass,metrics)
 await page.close()
}
}finally{await runtime.close()}
