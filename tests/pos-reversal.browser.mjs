import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { startPortalBrowser, openPortal } from './helpers/portal-browser.mjs'

const runtime = await startPortalBrowser()
await mkdir('tests/artifacts', { recursive: true })
try {
  for (const width of [390, 1280]) for (const [role,campus] of [['admin','all'],['admin','senior'],['accountant','senior']]) {
    const page = await runtime.browser.newPage({ viewport: { width, height: 900 } })
    const errors=[]; page.on('pageerror',e=>errors.push(e.message))
    const sale={id:crypto.randomUUID(),receipt_number:'RLC-REVERSAL-TEST',created_at:new Date().toISOString(),campus:'senior',currency:'USD',total:25,amount_paid:30,payment_method:'cash',status:'completed',pos_sale_items:[{id:'line',product_id:'product',product_name:'Original jacket',quantity:1,unit_price:25,unit_cost:10,line_total:25}]}
    let calls=0,fail=true
    await page.route('https://fonts.googleapis.com/**',route=>route.abort())
    await page.route('https://fonts.gstatic.com/**',route=>route.abort())
    await page.route('**/catalog-api/**',route=>{
      const req=route.request(),url=new URL(req.url()),table=url.pathname.split('/').at(-1)
      const send=body=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)})
      if(table==='reverse_pos_sale') {
        calls++
        if(fail)return route.fulfill({status:400,contentType:'application/json',body:JSON.stringify({message:'Test reversal failed safely',code:'P0001'})})
        Object.assign(sale,{status:'reversed',reversed_at:new Date().toISOString(),reversed_by:'main-admin',reversal_reason:req.postDataJSON().p_reason})
        return send(sale)
      }
      if(table==='pos_sales')return send([sale])
      if(table==='shop_settings')return send({store_name:'Test shop',receipt_header:'Uniform receipt'})
      return send([])
    })
    await page.goto(`${runtime.base}/tests/fixtures/catalog/index.html?role=${role}&campus=${campus}`)
    await page.getByRole('button',{name:'Sales & receipts',exact:true}).click()
    await page.getByRole('button',{name:'Open',exact:true}).click()
    const receipt=page.getByRole('dialog',{name:'Sale receipt',exact:true})
    await receipt.waitFor()
    const reverse=receipt.getByRole('button',{name:'Reverse sale and restore stock',exact:true})
    if(campus!=='all')assert.equal(await reverse.count(),0)
    else {
      assert.equal(await reverse.isEnabled(),false)
      await receipt.getByLabel('Reason for reversal').fill('Wrong learner selected')
      page.once('dialog',dialog=>dialog.dismiss())
      await reverse.click(); assert.equal(calls,0)
      page.once('dialog',dialog=>dialog.accept())
      await reverse.click(); await receipt.getByRole('alert').filter({hasText:'Test reversal failed safely'}).waitFor()
      assert.equal(sale.status,'completed')
      fail=false
      page.once('dialog',dialog=>dialog.accept())
      await reverse.click()
      await receipt.getByText('REVERSED — excluded from active sales',{exact:true}).waitFor()
      assert.equal(await reverse.count(),0)
      assert.equal(await receipt.getByText('Original jacket',{exact:false}).count(),1)
      if(width===390)await page.screenshot({path:'tests/artifacts/pos-reversal-mobile.png'})
      const geometry=await page.evaluate(()=>({width:innerWidth,actual:document.documentElement.scrollWidth,outside:[...document.querySelectorAll('.shop-app > *, .shop-receipts-layout > *, .shop-dialog')].map(el=>({class:el.className,left:el.getBoundingClientRect().left,right:el.getBoundingClientRect().right})).filter(el=>el.right>innerWidth+1||el.left<0)}))
      assert.ok(geometry.actual<=geometry.width+1,JSON.stringify(geometry))
    }
    assert.deepEqual(errors,[])
    console.log(`PASS ${role}/${campus} ${width}px: reversal controls, confirmation, safe error and retained receipt`)
    await page.close()
  }
  for (const width of [390,1280]) {
    const page=await openPortal(runtime.browser,runtime.base,{role:'admin',campus:'all',section:'activity'},width)
    await page.getByRole('button',{name:'Inventory & POS audit',exact:true}).click()
    const audit=page.getByRole('region',{name:'POS financial audit',exact:true})
    await audit.getByText('Example Main Admin · admin · senior · USD',{exact:true}).first().waitFor()
    assert.equal(await audit.locator('article').count(),50)
    await audit.getByRole('button',{name:'Next',exact:true}).click()
    await page.getByText('Page 2',{exact:true}).waitFor()
    await page.waitForFunction(()=>document.querySelectorAll('.financial-event-history article').length===1)
    await audit.getByLabel('Event type').selectOption('sale_reversed')
    await page.waitForFunction(()=>document.querySelectorAll('.financial-event-history article').length===26)
    await page.evaluate(()=>{window.fixtureFinancialError=true})
    await audit.getByRole('button',{name:'Refresh financial audit',exact:true}).click()
    await audit.getByRole('alert').waitFor()
    assert.equal(await audit.locator('article').count(),0)
    await page.evaluate(()=>{window.fixtureFinancialError=false})
    await audit.getByRole('button',{name:'Retry audit',exact:true}).click()
    await page.waitForFunction(()=>document.querySelectorAll('.financial-event-history article').length===26)
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1))
    assert.deepEqual(page.portalErrors,[])
    console.log(`PASS POS audit ${width}px: authoritative events, pagination, filter, failure and retry`)
    await page.close()
  }
} finally { await runtime.close() }
