import assert from 'node:assert/strict'
import { mkdir, readFile } from 'node:fs/promises'
import { startPortalBrowser, openPortal, portalLayoutMetrics } from './helpers/portal-browser.mjs'
const runtime=await startPortalBrowser()
await mkdir('tmp/stage11-exports',{recursive:true})
try {
  for(const width of [320,390,768,1280]) {
    const page=await openPortal(runtime.browser,runtime.base,{role:'accountant',campus:'senior',section:'expenses',operationsLarge:''},width)
    const panel=page.getByRole('region',{name:'Finance and operations exports'})
    for(const [label,extension] of [['Download CSV','csv'],['Download Excel','xlsx']]) {
      const download=page.waitForEvent('download')
      await panel.getByRole('button',{name:label,exact:true}).click()
      await (await download).saveAs(`tmp/stage11-exports/cashbook-${width}.${extension}`)
      await panel.getByRole('status').filter({hasText:'Exported 1007 source records'}).waitFor()
    }
    const metrics=await portalLayoutMetrics(page)
    assert.ok(metrics.documentWidth<=width+1)
    assert.deepEqual(page.portalErrors,[])
    assert.deepEqual(await page.evaluate(()=>window.fixtureWrites.filter(write=>write.table!=='audit_logs')),[])
    if(width===390)await page.screenshot({path:'tmp/stage11-exports/cashbook-390.png'})
    await page.close()
    console.log(`PASS ${width}px cashbook: 1007 records, actual CSV/XLSX, no mutations or horizontal overflow`)
  }
  const page=await openPortal(runtime.browser,runtime.base,{role:'accountant',campus:'senior',section:'expenses',operationsError:''},390)
  const panel=page.getByRole('region',{name:'Finance and operations exports'})
  await panel.getByRole('button',{name:'Download CSV',exact:true}).click()
  await panel.getByRole('alert').filter({hasText:'Synthetic export connection failure'}).waitFor()
  await page.evaluate(()=>window.fixtureOperationsError=false)
  const retry=page.waitForEvent('download');await panel.getByRole('button',{name:'Download CSV',exact:true}).click();await retry
  assert.deepEqual(await page.evaluate(()=>window.fixtureWrites.filter(write=>write.table!=='audit_logs')),[])
  await page.close()
  for(const role of ['admin','accountant','principal']) {
    const fees=await openPortal(runtime.browser,runtime.base,{role,campus:role==='accountant'?'junior':'all',section:'fees',owing:''},390)
    const exports=fees.getByRole('region',{name:'Finance and operations exports'})
    const download=fees.waitForEvent('download');await exports.getByRole('button',{name:'Download CSV',exact:true}).click()
    const file=await download;await file.saveAs(`tmp/stage11-exports/fees-${role}.csv`)
    const csv=await readFile(`tmp/stage11-exports/fees-${role}.csv`,'utf8')
    assert.ok(csv.includes(role==='accountant'? '"Source records","1"':'"Source records","3"'))
    assert.ok(csv.includes(role==='accountant'? '"Net balance USD","135.00"':'"Net balance USD","405.00"'))
    assert.deepEqual(fees.portalErrors,[])
    await fees.close()
  }
  console.log('PASS fees: exported totals match existing admin/accountant/principal amounts; campus filter and retry verified')
  const shop=await openPortal(runtime.browser,runtime.base,{role:'admin',campus:'all',section:'inventory',operationsData:''},390)
  const exports=shop.getByRole('region',{name:'Finance and operations exports'})
  for(const kind of ['stock','sales','orders']) {
    await exports.getByLabel('Export report',{exact:true}).selectOption(kind)
    for(const [label,extension] of [['Download CSV','csv'],['Download Excel','xlsx']]) {
      const download=shop.waitForEvent('download')
      await exports.getByRole('button',{name:label,exact:true}).click()
      await (await download).saveAs(`tmp/stage11-exports/${kind}.${extension}`)
      await exports.getByRole('status').waitFor()
    }
  }
  assert.deepEqual(shop.portalErrors,[])
  assert.deepEqual(await shop.evaluate(()=>window.fixtureWrites.filter(write=>write.table!=='audit_logs')),[])
  await shop.close()
  for(const [role,campus,expected] of [['admin','junior',['stock','sales']],['accountant','senior',['sales','orders']]]) {
    const scoped=await openPortal(runtime.browser,runtime.base,{role,campus,section:'inventory'},390)
    assert.deepEqual(await scoped.getByRole('region',{name:'Finance and operations exports'}).getByLabel('Export report',{exact:true}).locator('option').evaluateAll(options=>options.map(option=>option.value)),expected)
    await scoped.close()
  }
  console.log('PASS stock/size and historical POS/order downloads; campus-admin and accountant export choices preserve existing authority')
} finally {await runtime.close()}
