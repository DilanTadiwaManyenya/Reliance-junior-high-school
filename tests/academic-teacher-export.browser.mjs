import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {startPortalBrowser,openPortal} from './helpers/portal-browser.mjs'
const runtime=await startPortalBrowser()
try{
 const page=await openPortal(runtime.browser,runtime.base,{role:'teacher',campus:'senior',section:'entry',academicTeacher:''},390)
 const panel=page.getByRole('region',{name:'Saved teacher marks export'})
 await panel.getByRole('button',{name:'Prepare saved marks export',exact:true}).click()
 const download=page.waitForEvent('download');await panel.getByRole('button',{name:'Download academic CSV',exact:true}).click();await(await download).saveAs('tmp/stage12-exports/teacher-subject.csv')
 const text=await readFile('tmp/stage12-exports/teacher-subject.csv','utf8')
 assert.ok(text.includes('Combined Science'));assert.ok(!text.includes('Mathematics'));assert.ok(!text.includes('"99"'));assert.ok(text.includes('"0"'))
 assert.deepEqual(page.portalErrors,[])
 assert.deepEqual(await page.evaluate(()=>window.fixtureWrites.filter(write=>write.table!=='audit_logs')),[])
 await page.close()
 const parent=await openPortal(runtime.browser,runtime.base,{role:'parent',owing:'',route:'/portal/learner/learner-0/academics'},390)
 await parent.locator('.report-card-locked').waitFor()
 assert.equal(await parent.getByRole('button',{name:'Download academic CSV',exact:true}).count(),0)
 assert.equal(await parent.getByRole('button',{name:'Download academic Excel',exact:true}).count(),0)
 await parent.close()
 console.log('PASS teacher saved export restricts assigned learner/subject/year/term, preserves zero and performs no business writes')
}finally{await runtime.close()}
