import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { startPortalBrowser } from './helpers/portal-browser.mjs'

await mkdir('tmp/catalog-review', { recursive: true })
const runtime = await startPortalBrowser()
const products = []
const orders = []
const sales = []
const checkoutRequests = []
let interruptNextCheckout = false
let holdNextJuniorCatalog = false
let releaseJuniorCatalog
let onJuniorCatalogHeld
const images = new Map()
const uploads = []
const errors = []
const context = await runtime.browser.newContext({ viewport: { width: 390, height: 844 } })
await context.route('**/catalog-api/**', async route => {
  const req = route.request(), url = new URL(req.url()), method = req.method()
  if (url.pathname.includes('/rpc/parent_shop_student_campus')) {
    const { requested_student_id }=req.postDataJSON()
    const campus = requested_student_id==='student' || requested_student_id==='student-junior' ? 'junior' : requested_student_id==='student-senior' ? 'senior' : null
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(campus)})
  }
  if (url.pathname.includes('/copy/')) {
    const { source, destination } = req.postDataJSON()
    const root='/catalog-api/images/product-images/'
    if (!images.has(root+source)) return route.fulfill({ status:404,body:'{}' })
    images.set(root+destination,images.get(root+source))
    return route.fulfill({status:200,body:'{}'})
  }
  if (url.pathname.includes('/rpc/complete_pos_sale')) {
    const payload=req.postDataJSON();checkoutRequests.push(payload)
    let sale=sales.find(sale=>sale.request_id===payload.p_request_id)
    if(!sale) {
      const lines=payload.p_items.map(item=>{
        const product=products.find(product=>product.id===item.product_id)
        const variant=item.variant_id ? product.product_variants.find(variant=>variant.id===item.variant_id) : null
        if(variant) {variant.quantity_on_hand-=item.quantity;product.quantity_on_hand=product.product_variants.filter(v=>v.active).reduce((sum,v)=>sum+v.quantity_on_hand,0)}
        else product.quantity_on_hand-=item.quantity
        return {id:crypto.randomUUID(),product_id:product.id,product_name:product.name,variant_id:variant?.id,size_label:variant?.size,quantity:item.quantity,unit_price:product.selling_price,unit_cost:product.cost_price,line_total:product.selling_price*item.quantity}
      })
      sale={id:crypto.randomUUID(),receipt_number:'RLC-TEST-'+(sales.length+1),created_at:new Date().toISOString(),campus:payload.p_campus,request_id:payload.p_request_id,customer_name:payload.p_customer_name,payment_method:payload.p_payment_method,amount_paid:payload.p_amount_paid,total:lines.reduce((sum,line)=>sum+line.line_total,0),pos_sale_items:lines}
      sales.push(sale)
    }
    if(interruptNextCheckout){interruptNextCheckout=false;return route.abort('failed')}
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(sale)})
  }
  if (url.pathname.includes('/rpc/split_unassigned_shop_product')) {
    const { p_product, p_campus, p_quantity, p_details }=req.postDataJSON()
    const source=products.find(product=>product.id===p_product)
    source.quantity_on_hand-=p_quantity
    const allocated={ ...source, ...p_details, id:crypto.randomUUID(), campus:p_campus, quantity_on_hand:p_quantity }
    products.push(allocated)
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(allocated.id)})
  }
  if (url.pathname.includes('/images/')) {
    if (method === 'POST') { const body = req.postDataBuffer(); images.set(url.pathname, body); uploads.push(body); return route.fulfill({ status: 200, body: '{}' }) }
    if (method === 'DELETE') { images.delete(url.pathname); return route.fulfill({ status: 200, body: '{}' }) }
    return route.fulfill(images.has(url.pathname) ? { status: 200, contentType: 'image/webp', body: images.get(url.pathname) } : { status: 404 })
  }
  const table = url.pathname.split('/').at(-1)
  const tables = { inventory_products: products, parent_uniform_orders: orders, pos_sales: sales, students: [], shop_audit: [], shop_settings: [{ id: true, store_name: 'Test shop', receipt_header: 'Uniforms', low_stock_alerts_enabled: true }] }
  let rows = (tables[table] || []).filter(row => [...url.searchParams].every(([key, value]) => !value.startsWith('eq.') || String(row[key]) === value.slice(3)))
  if (method === 'POST') {
    const payload = req.postDataJSON()
    const row = { id: crypto.randomUUID(), created_at: new Date().toISOString(), active: true, has_variants: false, product_variants: [], ...payload }
    if (table === 'product_variants') {
      const product = products.find(p => p.id === payload.product_id)
      product.product_variants.push(row); product.has_variants = true
      product.quantity_on_hand = product.product_variants.filter(v=>v.active).reduce((sum,v)=>sum+v.quantity_on_hand,0)
    } else (tables[table] || []).push(row)
    rows = [row]
  }
  if (method === 'PATCH') rows.forEach(row => Object.assign(row, req.postDataJSON()))
  if (table==='inventory_products' && method==='GET' && url.searchParams.get('campus')==='eq.junior' && holdNextJuniorCatalog) {
    holdNextJuniorCatalog=false
    rows=structuredClone(rows)
    await new Promise(resolve=>{releaseJuniorCatalog=resolve;onJuniorCatalogHeld?.()})
  }
  const single = req.headers().accept?.includes('vnd.pgrst.object')
  return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(single ? rows[0] || null : rows) })
})
const page = await context.newPage()
page.setDefaultTimeout(10000)
page.on('pageerror', e => errors.push(e.message))
try {
  await page.goto(`${runtime.base}/tests/fixtures/catalog/index.html?role=admin`)
  await page.getByRole('button', { name: 'Products', exact: true }).click()
  await page.getByRole('button', { name: 'Add product', exact: true }).click()
  await page.getByLabel('Product name', { exact: true }).fill('Catalog test shirt')
  await page.getByLabel('Selling price (USD)', { exact: true }).fill('12')
  await page.getByLabel('Unit cost (USD)', { exact: true }).fill('6')
  await page.getByRole('dialog').locator('select').first().selectOption('junior')
  const image = await page.evaluate(() => { const c=document.createElement('canvas'); c.width=1800;c.height=1200;const ctx=c.getContext('2d');ctx.fillStyle='#3172ad';ctx.fillRect(0,0,c.width,c.height);return c.toDataURL('image/png').split(',')[1] })
  const file = { name: 'shirt.png', mimeType: 'image/png', buffer: Buffer.from(image, 'base64') }
  await page.getByLabel('Product photo (JPG, PNG or WebP, up to 2 MB)').setInputFiles(file)
  await page.locator('.shop-image-preview img').waitFor()
  assert.equal(uploads.length,0,'Photo is previewed before uploading')
  await page.getByRole('button',{name:'Save product',exact:true}).click()
  await page.getByRole('dialog',{name:'Product editor'}).waitFor({state:'detached'})
  assert.equal(products.length,1);assert.equal(uploads.length,1)
  assert.ok(uploads[0].length < 2*1024*1024)
  const size = await page.evaluate(async url => { const b=await createImageBitmap(await (await fetch(url)).blob());const result={width:b.width,height:b.height};b.close();return result },products[0].image_url)
  assert.equal(size.width,1000);assert.ok(size.height<=1000)
  await page.getByRole('button',{name:/Catalog test shirt/}).click()
  await page.getByLabel('New size',{exact:true}).fill('Small')
  await page.getByLabel('New size stock',{exact:true}).fill('4')
  await page.getByRole('button',{name:'Add size',exact:true}).click()
  await page.getByText('Size saved. Product stock now totals its visible sizes.').waitFor()
  await page.getByRole('button',{name:'Cancel',exact:true}).click()
  const parent = await context.newPage()
  parent.on('pageerror', e=>errors.push(e.message))
  await parent.goto(`${runtime.base}/tests/fixtures/catalog/index.html?role=parent`)
  await parent.getByRole('heading',{name:'Catalog test shirt',exact:true}).waitFor()
  await parent.getByLabel('Size for Catalog test shirt').selectOption(products[0].product_variants[0].id)
  assert.equal(await parent.getByRole('button',{name:'Add to cart',exact:true}).isEnabled(),true)
  await parent.getByRole('button',{name:'Add to cart',exact:true}).click()
  await parent.getByText('Catalog test shirt · Small',{exact:true}).waitFor()
  await parent.getByLabel('Pay at collection',{exact:true}).check()
  await parent.getByRole('button',{name:/Place order/}).click()
  await parent.getByText(/1 × Catalog test shirt · Small/).waitFor()
  assert.equal(await parent.locator('.parent-uniform-history li').first().textContent(), '1 × Catalog test shirt · Small — $12.00 each')
  await parent.screenshot({ path: 'tmp/catalog-review/parent-catalog.png', fullPage: true })
  const oldUrl = products[0].image_url
  await page.getByRole('button',{name:/Catalog test shirt/}).click()
  await page.getByLabel('Product photo (JPG, PNG or WebP, up to 2 MB)').setInputFiles(file)
  await page.locator('.shop-image-preview img').waitFor()
  await page.getByRole('button',{name:'Save product',exact:true}).click()
  await page.getByRole('dialog',{name:'Product editor'}).waitFor({state:'detached'})
  assert.notEqual(products[0].image_url,oldUrl,'Replacement gets a new cache-safe URL')
  assert.equal(images.has(new URL(oldUrl).pathname),false,'Previous photo is removed after save')
  await parent.getByRole('button',{name:'Refresh catalog',exact:true}).click()
  await parent.waitForFunction(url=>document.querySelector('.parent-product-visual img')?.src===url,products[0].image_url)
  await page.getByRole('button',{name:/Catalog test shirt/}).click()
  await page.getByRole('button',{name:'Remove photo',exact:true}).click()
  await page.getByRole('button',{name:'Save product',exact:true}).click()
  await page.getByRole('dialog',{name:'Product editor'}).waitFor({state:'detached'})
  await parent.getByRole('button',{name:'Refresh catalog',exact:true}).click()
  await parent.getByRole('img',{name:'No photo for Catalog test shirt',exact:true}).waitFor()
  await page.getByRole('button',{name:/Catalog test shirt/}).click()
  await page.getByLabel('Show in shop (uncheck to hide)').uncheck()
  await page.getByRole('button',{name:'Save product',exact:true}).click()
  await page.getByRole('dialog',{name:'Product editor'}).waitFor({state:'detached'})
  await parent.getByRole('button',{name:'Refresh catalog',exact:true}).click()
  await parent.getByText('No uniform items are currently available.').waitFor()
  await parent.getByText(/1 × Catalog test shirt · Small/).waitFor()
  // Regression: legacy products have no campus and must allow a one-time assignment.
  const legacy = { id: crypto.randomUUID(), name: 'Legacy jacket', category: 'Uniforms', campus: null, selling_price: 25, cost_price: 18, quantity_on_hand: 5, reorder_level: 5, active: true, has_variants: false, product_variants: [] }
  products.push(legacy)
  await page.getByRole('button',{name:'Refresh',exact:true}).click()
  await page.getByRole('button',{name:/Legacy jacket/}).click()
  const campus = page.getByRole('dialog').locator('select').first()
  assert.equal(await campus.isEnabled(),true,'Unassigned legacy campus can be selected')
  await page.getByLabel('Product photo (JPG, PNG or WebP, up to 2 MB)').setInputFiles(file)
  await page.locator('.shop-image-preview img').waitFor()
  const before = uploads.length
  await page.getByRole('button',{name:'Save product',exact:true}).click()
  assert.equal(uploads.length,before,'No upload is attempted until a valid campus is selected')
  await campus.selectOption('junior')
  await page.getByRole('button',{name:'Save product',exact:true}).click()
  await page.getByRole('dialog',{name:'Product editor'}).waitFor({state:'detached'})
  assert.equal(legacy.campus,'junior')
  assert.ok(legacy.image_url.includes('/junior/'))
  await page.getByRole('button',{name:/Legacy jacket/}).click()
  assert.equal(await page.getByRole('dialog').locator('select').first().isDisabled(),true,'Assigned campus stays locked')
  await page.getByRole('button',{name:'Cancel',exact:true}).click()
  // Stage 1: explicit stock split, copied campus photo, scoped admin views and no accountant editor.
  const shared={...legacy,id:crypto.randomUUID(),name:'Shared campus stock',campus:null,quantity_on_hand:10}
  products.push(shared)
  await page.getByRole('button',{name:'Refresh',exact:true}).click()
  await page.getByRole('button',{name:/Shared campus stock/}).click()
  await page.getByRole('dialog').locator('select').first().selectOption('senior')
  await page.getByLabel('Allocation quantity',{exact:false}).fill('4')
  await page.getByRole('button',{name:'Save product',exact:true}).click()
  await page.getByRole('dialog',{name:'Product editor'}).waitFor({state:'detached'})
  const allocated=products.find(product=>product.name===shared.name && product.campus==='senior')
  assert.equal(shared.quantity_on_hand,6);assert.equal(shared.campus,null);assert.equal(allocated.quantity_on_hand,4)
  assert.ok(allocated.image_url.includes('/senior/'));assert.notEqual(allocated.image_url,shared.image_url)
  assert.ok(images.has(new URL(shared.image_url).pathname),'Split retains source photo')
  await page.getByLabel('Catalog campus',{exact:true}).selectOption('unassigned')
  assert.equal(await page.getByRole('button',{name:/Shared campus stock/}).count(),1)
  for(const staffCampus of ['junior','senior']) {
    const scoped=await context.newPage()
    scoped.on('pageerror',e=>errors.push(e.message))
    await scoped.goto(`${runtime.base}/tests/fixtures/catalog/index.html?role=admin&campus=${staffCampus}`)
    await scoped.getByRole('heading',{name:staffCampus==='junior'?'Junior school inventory':'Senior school inventory'}).waitFor()
    await scoped.getByRole('button',{name:'Add product',exact:true}).waitFor()
    assert.equal(await scoped.getByRole('button',{name:'Point of sale',exact:true}).count(),1,'Campus admins can open their own POS')
    assert.equal(await scoped.getByLabel('Catalog campus',{exact:true}).count(),0)
    if(staffCampus==='junior') assert.equal(await scoped.getByRole('button',{name:/Shared campus stock/}).count(),0)
    else await scoped.getByRole('button',{name:/Shared campus stock/}).waitFor()
    await scoped.getByRole('button',{name:'Add product',exact:true}).click()
    const selector=scoped.getByRole('dialog').locator('select').first()
    assert.equal(await selector.inputValue(),staffCampus);assert.equal(await selector.isDisabled(),true)
    await scoped.close()
  }
  const cashier=await context.newPage()
  await cashier.goto(`${runtime.base}/tests/fixtures/catalog/index.html?role=accountant&campus=junior`)
  await cashier.getByRole('button',{name:'Point of sale',exact:true}).waitFor()
  assert.equal(await cashier.getByRole('button',{name:'Products',exact:true}).count(),0)
  assert.equal(await cashier.getByRole('button',{name:'Add product',exact:true}).count(),0)
  await cashier.close()
  // Stage 2: Main Admin selects the campus and baskets/held carts are separate.
  await page.getByRole('button',{name:'Point of sale',exact:true}).click()
  assert.equal(await page.locator('.shop-product').count(),0)
  assert.equal(await page.getByRole('button',{name:'Complete checkout',exact:true}).isDisabled(),true)
  await page.getByLabel('Checkout campus',{exact:true}).selectOption('junior')
  await page.getByRole('button',{name:/Legacy jacket/}).click()
  await page.getByRole('button',{name:'Hold cart',exact:true}).click()
  await page.getByText('Held carts (1)',{exact:true}).waitFor()
  await page.getByLabel('Checkout campus',{exact:true}).selectOption('senior')
  await page.getByText('Held carts (0)',{exact:true}).waitFor()
  await page.getByRole('button',{name:/Shared campus stock/}).click()
  await page.getByLabel('Checkout campus',{exact:true}).selectOption('junior')
  await page.getByText('Held carts (1)',{exact:true}).waitFor()
  await page.getByRole('button',{name:'Resume',exact:true}).click()
  await page.getByLabel('Amount received (USD)',{exact:true}).fill('25')
  interruptNextCheckout=true
  const stockBeforeRetry=legacy.quantity_on_hand
  await page.getByRole('button',{name:'Complete checkout',exact:true}).click()
  await page.getByRole('button',{name:'Retry pending sale',exact:true}).waitFor()
  const pendingId=checkoutRequests.at(-1).p_request_id
  assert.equal(await page.getByLabel('Checkout campus',{exact:true}).isDisabled(),true)
  await page.reload()
  await page.getByRole('button',{name:'Point of sale',exact:true}).click()
  await page.getByLabel('Checkout campus',{exact:true}).selectOption('junior')
  await page.getByRole('button',{name:'Retry pending sale',exact:true}).click()
  await page.getByRole('dialog',{name:'Sale receipt'}).waitFor()
  assert.equal(checkoutRequests.at(-1).p_request_id,pendingId)
  assert.equal(checkoutRequests.at(-1).p_campus,'junior')
  assert.equal(legacy.quantity_on_hand,stockBeforeRetry-1,'Retry after reload must not deduct stock twice')
  await page.keyboard.press('Escape')
  await page.getByLabel('Checkout campus',{exact:true}).selectOption('senior')
  await page.locator('.shop-cart-line').getByText('Shared campus stock',{exact:true}).waitFor()
  await page.getByLabel('Amount received (USD)',{exact:true}).fill('25')
  await page.screenshot({path:'tmp/catalog-review/main-admin-campus-pos.png',fullPage:true})
  await page.getByRole('button',{name:'Complete checkout',exact:true}).click()
  await page.getByRole('dialog',{name:'Sale receipt'}).waitFor()
  assert.equal(checkoutRequests.at(-1).p_campus,'senior')
  await page.keyboard.press('Escape')
  // Accountant opens directly into checkout and has only checkout/receipt tabs.
  const restricted=await context.newPage()
  restricted.on('pageerror',error=>errors.push(error.message))
  await restricted.goto(`${runtime.base}/tests/fixtures/catalog/index.html?role=accountant&campus=junior`)
  await restricted.getByRole('button',{name:/Legacy jacket/}).waitFor()
  assert.deepEqual(await restricted.locator('.shop-tabs button').allTextContents(),['Point of sale','Sales & receipts'])
  assert.equal(await restricted.getByLabel('Checkout campus',{exact:true}).count(),0)
  await restricted.getByRole('button',{name:/Legacy jacket/}).click()
  await restricted.reload()
  await restricted.locator('.shop-cart-line').getByText('Legacy jacket',{exact:true}).waitFor()
  await restricted.goto(`${runtime.base}/tests/fixtures/catalog/index.html?role=accountant&campus=senior`)
  await restricted.getByRole('button',{name:/Shared campus stock/}).waitFor()
  assert.equal(await restricted.locator('.shop-cart-line').count(),0)
  await restricted.close()
  // Legacy unscoped pending state is preserved until explicit same-ID recovery.
  const recovery=await context.newPage()
  const legacyId=crypto.randomUUID()
  await recovery.addInitScript(({legacyId,productId})=>sessionStorage.setItem('reliance-shop:staff',JSON.stringify({pending:{id:legacyId,items:[{product_id:productId,quantity:1}],payment:'cash',paid:25,customer:'Earlier customer'}})),{legacyId,productId:legacy.id})
  await recovery.goto(`${runtime.base}/tests/fixtures/catalog/index.html?role=accountant&campus=junior`)
  await recovery.getByRole('button',{name:'Recover earlier checkout',exact:true}).waitFor()
  assert.equal(await recovery.getByRole('button',{name:'Complete checkout',exact:true}).isDisabled(),true)
  await recovery.getByRole('button',{name:'Recover earlier checkout',exact:true}).click()
  await recovery.getByRole('dialog',{name:'Sale receipt'}).waitFor()
  assert.equal(checkoutRequests.at(-1).p_request_id,legacyId)
  assert.equal(await recovery.evaluate(()=>JSON.parse(sessionStorage.getItem('reliance-shop:staff')).pending),null)
  await recovery.close()
  // Stage 3: selected learner campus, clean carts/size choices, and stale response isolation.
  const familyJunior={id:crypto.randomUUID(),name:'Junior only blazer',campus:'junior',category:'Uniforms',active:true,selling_price:20,cost_price:10,quantity_on_hand:3,reorder_level:1,has_variants:true,image_url:legacy.image_url,product_variants:[{id:'family-junior-size',size:'Small',quantity_on_hand:3,active:true}]}
  const familySenior={id:crypto.randomUUID(),name:'Senior only blazer',campus:'senior',category:'Uniforms',active:true,selling_price:30,cost_price:15,quantity_on_hand:4,reorder_level:1,has_variants:true,image_url:allocated.image_url,product_variants:[{id:'family-senior-size',size:'Large',quantity_on_hand:4,active:true}]}
  products.push(familyJunior,familySenior)
  for(const [studentId,name] of [['student-junior','Historic Junior uniform'],['student-senior','Historic Senior uniform'],['student-missing','Legacy unassigned learner order']]) orders.push({id:crypto.randomUUID(),parent_id:'parent',student_id:studentId,items:[{name,quantity:1,unit_price:9}],total:9,payment_status:'pending',created_at:new Date().toISOString()})
  const family=await context.newPage()
  family.on('pageerror',error=>errors.push(error.message))
  await family.goto(`${runtime.base}/tests/fixtures/catalog/index.html?role=parent&family=1`)
  await family.getByRole('heading',{name:'Junior only blazer',exact:true}).waitFor()
  assert.equal(await family.getByRole('heading',{name:'Senior only blazer',exact:true}).count(),0)
  await family.getByText('1 × Historic Junior uniform — $9.00 each',{exact:true}).waitFor()
  await family.getByLabel('Size for Junior only blazer').selectOption('family-junior-size')
  await family.locator('.parent-product-card').filter({has:family.getByRole('heading',{name:'Junior only blazer',exact:true})}).getByRole('button',{name:'Add to cart',exact:true}).click()
  await family.locator('.parent-cart-lines').getByText('Junior only blazer · Small',{exact:true}).waitFor()
  await family.getByLabel('Buying for',{exact:false}).selectOption('student-senior')
  assert.equal(await family.getByText('1 × Historic Junior uniform — $9.00 each',{exact:true}).count(),0)
  assert.equal(await family.getByRole('heading',{name:'Junior only blazer',exact:true}).count(),0)
  await family.getByRole('heading',{name:'Senior only blazer',exact:true}).waitFor()
  assert.equal(await family.locator('.parent-cart-lines').count(),0)
  await family.getByLabel('Size for Senior only blazer').selectOption('family-senior-size')
  await family.locator('.parent-product-card').filter({has:family.getByRole('heading',{name:'Senior only blazer',exact:true})}).getByRole('button',{name:'Add to cart',exact:true}).click()
  await family.getByLabel('Pay at collection',{exact:true}).check()
  await family.getByRole('button',{name:/Place order/}).click()
  await family.getByText('1 × Senior only blazer · Large — $30.00 each',{exact:true}).waitFor()
  assert.equal(orders.at(-1).student_id,'student-senior');assert.equal(orders.at(-1).items[0].product_id,familySenior.id)
  await family.getByLabel('Buying for',{exact:false}).selectOption('student-junior')
  await family.getByRole('heading',{name:'Junior only blazer',exact:true}).waitFor()
  assert.equal(await family.getByLabel('Size for Junior only blazer').inputValue(),'','Size choice resets after learner change')
  assert.equal(await family.locator('.parent-cart-lines').count(),0)
  const heldCatalog=new Promise(resolve=>{onJuniorCatalogHeld=resolve})
  holdNextJuniorCatalog=true
  await family.getByRole('button',{name:'Refresh catalog',exact:true}).click()
  await heldCatalog
  await family.getByLabel('Buying for',{exact:false}).selectOption('student-senior')
  await family.getByRole('heading',{name:'Senior only blazer',exact:true}).waitFor()
  const staleResponse=family.waitForResponse(response=>{const url=new URL(response.url());return url.pathname.endsWith('/inventory_products') && url.searchParams.get('campus')==='eq.junior'})
  releaseJuniorCatalog();onJuniorCatalogHeld=null
  await (await staleResponse).finished()
  await family.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))))
  assert.equal(await family.getByRole('heading',{name:'Junior only blazer',exact:true}).count(),0,'Late response cannot repopulate other-campus products')
  await family.screenshot({path:'tmp/catalog-review/parent-senior-campus.png',fullPage:true})
  await family.getByLabel('Buying for',{exact:false}).selectOption('student-missing')
  await family.getByText('This learner needs a Junior or Senior campus assignment before uniforms can be ordered. Contact the school office.',{exact:true}).waitFor()
  await family.getByText('1 × Legacy unassigned learner order — $9.00 each',{exact:true}).waitFor()
  assert.equal(await family.getByRole('button',{name:'Add to cart',exact:true}).count(),0)
  await family.getByLabel('Buying for',{exact:false}).selectOption('student-inactive')
  await family.getByText('Uniform orders are only available for actively enrolled learners.',{exact:true}).waitFor()
  await family.getByLabel('Buying for',{exact:false}).selectOption('student-unverified')
  await family.getByText('This learner connection or campus changed. Reload your learners before ordering.',{exact:true}).waitFor()
  assert.equal(await family.locator('.parent-product-card').count(),0)
  await family.close()
  // Invalid files are rejected before storage writes.
  const validation=await page.evaluate(async()=>{
    const {prepareProductImage}=await import('/src/lib/productImages.js')
    const results=[]
    for(const f of [new File(['<svg/>'],'x.svg',{type:'image/svg+xml'}),new File([new Uint8Array(2097153)],'large.png',{type:'image/png'}),new File(['invalid'],'broken.png',{type:'image/png'})]) {
      try{await prepareProductImage(f);results.push('accepted')}catch(error){results.push(error.message)}
    }
    return results
  })
  assert.match(validation[0],/JPG, PNG or WebP/);assert.match(validation[1],/2 MB/);assert.match(validation[2],/could not be read/)
  assert.deepEqual(errors,[])
  const overflow=await parent.evaluate(()=>document.documentElement.scrollWidth>innerWidth)
  assert.equal(overflow,false,'Parent mobile catalog does not overflow')
  console.log('PASS: mobile photo preview/compression/upload/replace/remove, sizes, parent visibility and historical order display; invalid files rejected.')
} finally { await context.close(); await runtime.close() }
