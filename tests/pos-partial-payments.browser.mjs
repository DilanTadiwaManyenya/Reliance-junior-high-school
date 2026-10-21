import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { startPortalBrowser } from './helpers/portal-browser.mjs'

const runtime=await startPortalBrowser()
await mkdir('tests/artifacts',{recursive:true})
try {
  for(const width of [390,1280]) {
    const context=await runtime.browser.newContext({viewport:{width,height:900}})
    const product={id:crypto.randomUUID(),name:'Anorak jacket',category:'Uniforms',active:true,campus:'senior',selling_price:25,cost_price:10,quantity_on_hand:10,reorder_level:2,currency:'USD',product_variants:[]}
    const learner={id:'student-senior',full_name:'Senior Learner',admission_number:'TEST-S1',campus:'senior',class_level:'Form 3',class_stream:'Blue',status:'active'}
    let sale=null,dropNextPayment=true
    const send=(route,body)=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)})
    const addPayment=(requestId,tendered,method)=>{
      const existing=sale.pos_payments.find(p=>p.request_id===requestId)
      if(existing)return existing
      const amount=Math.min(tendered,sale.balance_due)
      const p={id:crypto.randomUUID(),sale_id:sale.id,request_id:requestId,amount,tendered,change_due:tendered-amount,currency:'USD',campus:'senior',payment_method:method,created_at:new Date().toISOString()}
      sale.pos_payments.push(p);sale.paid_total+=amount;sale.balance_due-=amount;return p
    }
    await context.route('https://fonts.googleapis.com/**',route=>route.abort())
    await context.route('https://fonts.gstatic.com/**',route=>route.abort())
    await context.route('**/catalog-api/**',route=>{
      const req=route.request(),url=new URL(req.url()),table=url.pathname.split('/').at(-1)
      if(table==='parent_shop_student_campus')return send(route,req.postDataJSON().requested_student_id==='student-senior'?'senior':'junior')
      if(table==='parent_pos_receipts')return send(route,sale&&req.postDataJSON().p_student_id===sale.student_id?[{...sale,items:sale.pos_sale_items,payments:sale.pos_payments}]:[])
      if(table==='complete_pos_sale') {
        const p=req.postDataJSON()
        if(!sale){
          sale={id:crypto.randomUUID(),receipt_number:'RLC-PARTIAL-1',student_id:p.p_student_id,status:'completed',total:25,paid_total:0,balance_due:25,payment_tracking:true,amount_paid:p.p_amount_paid,payment_method:p.p_payment_method,currency:'USD',campus:'senior',created_at:new Date().toISOString(),issued_at:new Date().toISOString(),pos_payments:[],pos_sale_items:[{id:'line',product_id:product.id,product_name:product.name,quantity:1,unit_price:25,unit_cost:10,line_total:25}]}
          product.quantity_on_hand--;addPayment(p.p_request_id,p.p_amount_paid,p.p_payment_method)
        }
        return send(route,sale)
      }
      if(table==='record_pos_payment'){
        const p=req.postDataJSON(),payment=addPayment(p.p_request_id,p.p_tendered,p.p_payment_method)
        if(dropNextPayment){dropNextPayment=false;return route.abort('failed')}
        return send(route,payment)
      }
      if(table==='shop_settings')return send(route,{store_name:'Test school shop',receipt_header:'Uniform receipt'})
      const tables={inventory_products:[product],students:[learner],pos_sales:sale?[sale]:[],parent_uniform_orders:[],shop_audit:[]}
      const rows=(tables[table]||[]).filter(row=>[...url.searchParams].every(([key,value])=>!value.startsWith('eq.')||String(row[key])===value.slice(3)))
      return send(route,req.headers().accept?.includes('vnd.pgrst.object')?rows[0]||null:rows)
    })
    const page=await context.newPage(),errors=[]
    page.on('pageerror',error=>errors.push(error.message))
    await page.goto(`${runtime.base}/tests/fixtures/catalog/index.html?role=accountant&campus=senior`)
    await page.getByRole('button',{name:/Anorak jacket/}).click()
    await page.getByLabel('Amount received (USD)',{exact:true}).fill('20')
    assert.equal(await page.getByRole('button',{name:'Complete checkout',exact:true}).isDisabled(),true)
    await page.getByLabel('Learner for sale',{exact:true}).selectOption('student-senior')
    await page.getByRole('button',{name:'Complete checkout',exact:true}).click()
    const receipt=page.getByRole('dialog',{name:'Sale receipt',exact:true})
    await receipt.waitFor()
    assert.equal(sale.paid_total,20);assert.equal(sale.balance_due,5);assert.equal(product.quantity_on_hand,9)
    await receipt.getByText('Paid to date',{exact:true}).waitFor()
    assert.equal(await receipt.getByRole('button',{name:'Reverse sale and restore stock',exact:true}).count(),0)
    if(width===390)await page.screenshot({path:'tests/artifacts/pos-partial-payment-mobile.png'})
    const family=await context.newPage()
    await family.goto(`${runtime.base}/tests/fixtures/catalog/index.html?role=parent&family=1`)
    await family.getByLabel('Buying for',{exact:true}).selectOption('student-senior')
    const parentReceipt=family.getByRole('article',{name:'Uniform receipt RLC-PARTIAL-1',exact:true})
    await parentReceipt.waitFor()
    await parentReceipt.getByText(/Balance due:/).waitFor()
    assert.match(await parentReceipt.innerText(),/USD\s+5\.00/)
    await family.getByLabel('Buying for',{exact:true}).selectOption('student-junior')
    await parentReceipt.waitFor({state:'detached'})
    await family.close()
    await receipt.getByLabel('Amount received (USD)',{exact:true}).fill('10')
    await receipt.getByRole('button',{name:'Save balance payment',exact:true}).click()
    await page.getByRole('button',{name:'Recover pending receipt payment',exact:true}).waitFor()
    assert.equal(sale.balance_due,0);assert.equal(sale.pos_payments.length,2)
    await page.reload()
    await page.getByRole('button',{name:'Recover pending receipt payment',exact:true}).click()
    await receipt.waitFor()
    await receipt.getByText('Paid to date',{exact:true}).waitFor()
    assert.equal(sale.pos_payments.length,2);assert.equal(product.quantity_on_hand,9)
    assert.equal(sale.pos_payments[1].change_due,5)
    assert.equal(await receipt.getByRole('button',{name:'Save balance payment',exact:true}).count(),0)
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1))
    assert.deepEqual(errors,[])
    console.log(`PASS ${width}px: 25/20/5 sale, learner link, parent switch, final payment/change and response-loss recovery without duplicate stock/payment`)
    await context.close()
  }
}finally{await runtime.close()}
