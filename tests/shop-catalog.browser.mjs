import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { startPortalBrowser } from './helpers/portal-browser.mjs'

await mkdir('tmp/catalog-review', { recursive: true })
const runtime = await startPortalBrowser()
const products = []
const orders = []
const sales = []
const stockReceipts = []
const stockBatches = []
const checkoutRequests = []
const retiredRequests = new Set()
let interruptNextCheckout = false
let holdNextJuniorCatalog = false
let releaseJuniorCatalog
let onJuniorCatalogHeld
const images = new Map()
const uploads = []
const errors = []
const viewportWidth = Number(process.env.CATALOG_VIEWPORT_WIDTH || 390)
assert.ok([390, 1280].includes(viewportWidth), 'Catalog acceptance width must be 390 or 1280')
const context = await runtime.browser.newContext({ viewport: { width: viewportWidth, height: 844 } })
context.setDefaultNavigationTimeout(45000)
// Keep local catalog acceptance independent of external font availability.
await context.route('https://fonts.googleapis.com/**', route => route.abort())
await context.route('https://fonts.gstatic.com/**', route => route.abort())
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
    if(retiredRequests.has(payload.p_request_id)) return route.fulfill({status:400,contentType:'application/json',body:JSON.stringify({code:'P0001',message:'This test checkout was cleared by Main Admin. Clear the old pending basket and start a new sale.'})})
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
  if (url.pathname.includes('/rpc/receive_shop_stock')) {
    const payload = req.postDataJSON()
    let receipt = stockReceipts.find(row => row.request_id === payload.p_request_id)
    if (!receipt) {
      receipt = { id: crypto.randomUUID(), request_id: payload.p_request_id, supplier_name: payload.p_supplier_name, supplier_reference: payload.p_supplier_reference, notes: payload.p_notes, receipt_kind: 'supplier', created_at: new Date().toISOString() }
      stockReceipts.push(receipt)
      for (const item of payload.p_items) {
        const product = products.find(row => row.id === item.product_id)
        const variant = item.variant_id ? product.product_variants.find(row => row.id === item.variant_id) : null
        const quantity = Number(item.quantity), unitCost = Number(item.unit_cost)
        if (variant) {
          variant.quantity_on_hand += quantity
          product.quantity_on_hand = product.product_variants.filter(row => row.active).reduce((sum, row) => sum + row.quantity_on_hand, 0)
        } else product.quantity_on_hand += quantity
        stockBatches.push({ id: crypto.randomUUID(), receipt_id: receipt.id, product_id: product.id, variant_id: variant?.id || null, campus: product.campus, currency: product.currency || 'USD', quantity_received: quantity, quantity_remaining: quantity, unit_cost: unitCost })
      }
    }
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(receipt.id)})
  }
  if (url.pathname.includes('/rpc/split_unassigned_shop_product')) {
    const { p_product, p_campus, p_quantity, p_details }=req.postDataJSON()
    const source=products.find(product=>product.id===p_product)
    let allocated
    if(p_quantity===source.quantity_on_hand) {
      Object.assign(source,p_details,{campus:p_campus,quantity_on_hand:p_quantity})
      allocated=source
    } else {
      source.quantity_on_hand-=p_quantity
      allocated={ ...source, ...p_details, id:crypto.randomUUID(), campus:p_campus, quantity_on_hand:p_quantity }
      products.push(allocated)
    }
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(allocated.id)})
  }
  if (url.pathname.includes('/images/')) {
    if (method === 'POST') { const body = req.postDataBuffer(); images.set(url.pathname, body); uploads.push(body); return route.fulfill({ status: 200, body: '{}' }) }
    if (method === 'DELETE') { images.delete(url.pathname); return route.fulfill({ status: 200, body: '{}' }) }
    return route.fulfill(images.has(url.pathname) ? { status: 200, contentType: 'image/webp', body: images.get(url.pathname) } : { status: 404 })
  }
  const table = url.pathname.split('/').at(-1)
  const tables = { inventory_products: products, parent_uniform_orders: orders, pos_sales: sales, shop_stock_receipts: stockReceipts, shop_stock_batches: stockBatches, students: [], shop_audit: [], shop_settings: [{ id: true, store_name: 'Test shop', receipt_header: 'Uniforms', low_stock_alerts_enabled: true }] }
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
  if (method === 'DELETE' && table === 'inventory_products') {
    if(rows.some(product=>orders.some(order=>order.items.some(item=>item.product_id===product.id)))) return route.fulfill({status:400,contentType:'application/json',body:JSON.stringify({message:'This product has order history. Hide it instead of deleting it.',code:'P0001'})})
    rows.forEach(row=>products.splice(products.indexOf(row),1))
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
  await page.goto(`${runtime.base}/tests/fixtures/catalog/index.html?role=admin`, { waitUntil: 'domcontentloaded' })
  if (viewportWidth <= 1050) {
    const tabLayout = await page.locator('.shop-tabs').evaluate(element => ({
      scrollWidth: element.scrollWidth,
      clientWidth: element.clientWidth,
      tabs: [...element.querySelectorAll('button')].map(button => ({ left: button.getBoundingClientRect().left, right: button.getBoundingClientRect().right })),
      right: element.getBoundingClientRect().right,
    }))
    assert.ok(tabLayout.scrollWidth <= tabLayout.clientWidth + 1, 'Shop navigation tabs fit without horizontal scrolling on compact screens')
    assert.ok(tabLayout.tabs.every(tab => tab.left >= -1 && tab.right <= tabLayout.right + 1), 'All shop tabs remain visible on compact screens')
  }
  await page.getByRole('button', { name: 'Products', exact: true }).click()
  await page.getByRole('heading', { name: 'Receive supplier stock', exact: true }).waitFor()
  await page.getByRole('heading', { name: 'Recent stock receipts', exact: true }).waitFor()
  await page.getByRole('button', { name: 'Add product', exact: true }).click()
  await page.getByLabel('Product name', { exact: true }).fill('Catalog test shirt')
  await page.getByLabel('Selling price (USD)', { exact: true }).fill('12')
  await page.getByLabel('Default correction cost (USD)', { exact: true }).fill('6')
  await page.getByRole('dialog').getByLabel('Campus',{exact:true}).selectOption('junior')
  const image = await page.evaluate(() => { const c=document.createElement('canvas'); c.width=1800;c.height=1200;const ctx=c.getContext('2d');ctx.fillStyle='#3172ad';ctx.fillRect(0,0,c.width,c.height);return c.toDataURL('image/png').split(',')[1] })
  const file = { name: 'shirt.png', mimeType: 'image/png', buffer: Buffer.from(image, 'base64') }
  await page.getByLabel('Product photo (JPG, PNG or WebP, up to 5 MB)').setInputFiles(file)
  await page.getByRole('button',{name:'Use edited photo',exact:true}).click()
  await page.locator('.shop-image-preview img').waitFor()
  assert.equal(uploads.length,0,'Photo is previewed before uploading')
  await page.getByRole('button',{name:'Save product',exact:true}).click()
  await page.getByRole('dialog',{name:'Product editor'}).waitFor({state:'detached'})
  assert.equal(products.length,1);assert.equal(products[0].quantity_on_hand,0);assert.equal(uploads.length,1)
  assert.ok(uploads[0].length < 2*1024*1024)
  const size = await page.evaluate(async url => { const b=await createImageBitmap(await (await fetch(url)).blob());const result={width:b.width,height:b.height};b.close();return result },products[0].image_url)
  assert.equal(size.width,1000);assert.ok(size.height<=1000)
  stockReceipts.push({ id:'receipt-ledger-test', supplier_name:'Ledger Test Supplier', supplier_reference:'INV-TEST-01', notes:'Browser ledger check', receipt_kind:'supplier', created_at:new Date().toISOString() })
  stockBatches.push({ id:'batch-ledger-test', receipt_id:'receipt-ledger-test', product_id:products[0].id, variant_id:null, campus:'junior', currency:'USD', quantity_received:10, quantity_remaining:0, unit_cost:6 })
  await page.getByRole('button',{name:'Refresh',exact:true}).click()
  const ledgerEntry=page.locator('.shop-stock-ledger-entry').filter({hasText:'Ledger Test Supplier'})
  await ledgerEntry.locator('summary').click()
  await ledgerEntry.getByText('INV-TEST-01').waitFor()
  await ledgerEntry.getByText('Browser ledger check').waitFor()
  await ledgerEntry.getByText('Catalog test shirt',{exact:true}).waitFor()
  await ledgerEntry.getByText('10',{exact:true}).waitFor()
  await ledgerEntry.getByText('6.00',{exact:false}).waitFor()
  await page.getByRole('button',{name:/Catalog test shirt/}).click()
  await page.getByLabel('New size',{exact:true}).fill('Small')
  await page.getByLabel('New size stock',{exact:true}).fill('4')
  await page.getByRole('button',{name:'Add size',exact:true}).click()
  await page.getByText('Size saved. Product stock now totals its visible sizes.').waitFor()
  await page.getByRole('button',{name:'Cancel',exact:true}).click()
  const parent = await context.newPage()
  parent.on('pageerror', e=>errors.push(e.message))
  await parent.goto(`${runtime.base}/tests/fixtures/catalog/index.html?role=parent`, { waitUntil: 'domcontentloaded' })
  await parent.getByRole('heading',{name:'Catalog test shirt',exact:true}).waitFor()
  await parent.getByLabel('Size for Catalog test shirt').selectOption(products[0].product_variants[0].id)
  assert.equal(await parent.getByRole('button',{name:'Add to cart',exact:true}).isEnabled(),true)
  await parent.getByRole('button',{name:'Add to cart',exact:true}).click()
  await parent.getByText('Catalog test shirt · Small',{exact:true}).waitFor()
  await parent.getByLabel('Pay at collection',{exact:true}).check()
  await parent.getByRole('button',{name:/Place order/}).click()
  await parent.getByText(/1 × Catalog test shirt · Small/).waitFor()
  assert.equal((await parent.locator('.parent-uniform-history li').first().textContent()).replace(/\s+/g,' '), '1 × Catalog test shirt · Small — USD 12.00 each')
  await parent.screenshot({ path: 'tmp/catalog-review/parent-catalog.png', fullPage: true })
  // Existing photos can be edited, cancelled, cropped and saved without a new file.
  await page.getByRole('button',{name:/Catalog test shirt/}).click()
  const beforeEditing = uploads.length
  await page.getByRole('button',{name:'Edit photo',exact:true}).click()
  await page.getByRole('button',{name:'Use edited photo',exact:true}).waitFor()
  assert.equal(await page.getByRole('button',{name:'Save product',exact:true}).isDisabled(),true)
  await page.getByLabel('Photo framing',{exact:true}).selectOption('crop')
  await page.getByRole('button',{name:'Rotate photo',exact:true}).click()
  await page.getByLabel('Photo zoom',{exact:true}).fill('1.5')
  await page.getByLabel('Horizontal photo position',{exact:true}).fill('0.3')
  await page.locator('.shop-photo-editor').getByText(/Ready to save:/).waitFor()
  const cropCanvas=page.getByLabel('Square photo crop preview',{exact:true})
  await cropCanvas.scrollIntoViewIfNeeded()
  const box=await cropCanvas.boundingBox()
  await page.mouse.move(box.x+box.width/2,box.y+box.height/2)
  await page.mouse.down();await page.mouse.move(box.x+box.width*0.7,box.y+box.height*0.6);await page.mouse.up()
  assert.notEqual(await page.getByLabel('Horizontal photo position',{exact:true}).inputValue(),'0.3','Pointer drag repositions the photo')
  await page.screenshot({path:`tmp/catalog-review/photo-editor-${viewportWidth}.png`})
  await page.getByRole('button',{name:'Reset photo',exact:true}).click()
  assert.equal(await page.getByLabel('Photo zoom',{exact:true}).inputValue(),'1')
  await page.getByRole('button',{name:'Cancel photo edit',exact:true}).click()
  assert.equal(uploads.length,beforeEditing)
  const unchangedImage=products[0].image_url
  await page.getByRole('button',{name:'Edit photo',exact:true}).click()
  await page.getByLabel('Photo framing',{exact:true}).selectOption('crop')
  await page.getByLabel('Photo compression',{exact:true}).selectOption('small')
  await page.getByRole('button',{name:'Use edited photo',exact:true}).click()
  assert.equal(uploads.length,beforeEditing,'Applying photo does not upload until product save')
  await page.getByRole('button',{name:'Save product',exact:true}).click()
  await page.getByRole('dialog',{name:'Product editor'}).waitFor({state:'detached'})
  assert.notEqual(products[0].image_url,unchangedImage)
  assert.equal(images.has(new URL(unchangedImage).pathname),false)
  const oldUrl = products[0].image_url
  await page.getByRole('button',{name:/Catalog test shirt/}).click()
  await page.getByLabel('Product photo (JPG, PNG or WebP, up to 5 MB)').setInputFiles(file)
  await page.getByRole('button',{name:'Use edited photo',exact:true}).click()
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
  page.once('dialog',dialog=>dialog.accept())
  await page.getByRole('button',{name:'Delete unused product',exact:true}).click()
  await page.getByRole('dialog',{name:'Product editor'}).getByRole('alert').filter({hasText:'This product has order history.'}).waitFor()
  await page.getByRole('button',{name:'Hide product',exact:true}).click()
  await page.getByText('Product hidden. Order history is preserved. Other edits remain unsaved.',{exact:true}).waitFor()
  assert.equal(products[0].active,false)
  await page.getByRole('button',{name:'Cancel',exact:true}).click()
  await parent.getByRole('button',{name:'Refresh catalog',exact:true}).click()
  await parent.getByText('No uniform items are currently available.').waitFor()
  await parent.getByText(/1 × Catalog test shirt · Small/).waitFor()
  // Regression: legacy products have no campus and must allow a one-time assignment.
  const legacy = { id: crypto.randomUUID(), name: 'Legacy jacket', category: 'Uniforms', campus: null, selling_price: 25, cost_price: 18, quantity_on_hand: 5, reorder_level: 5, active: true, has_variants: false, product_variants: [] }
  products.push(legacy)
  await page.getByRole('button',{name:'Refresh',exact:true}).click()
  await page.getByRole('button',{name:/Legacy jacket/}).click()
  // Visibility applies without the required campus and must not save unrelated form edits.
  await page.getByLabel('Product name',{exact:true}).fill('Unsaved draft name')
  await page.getByRole('button',{name:'Hide product',exact:true}).click()
  await page.getByText('Product hidden. Order history is preserved. Other edits remain unsaved.',{exact:true}).waitFor()
  assert.equal(legacy.active,false);assert.equal(legacy.campus,null);assert.equal(legacy.quantity_on_hand,5);assert.equal(legacy.name,'Legacy jacket')
  assert.equal(await page.getByLabel('Product name',{exact:true}).inputValue(),'Unsaved draft name')
  await page.getByRole('button',{name:'Show product',exact:true}).click()
  await page.getByText('Product shown. Other edits remain unsaved.',{exact:true}).waitFor()
  assert.equal(legacy.active,true);assert.equal(legacy.campus,null)
  await page.getByLabel('Product name',{exact:true}).fill('Legacy jacket')
  const campus = page.getByRole('dialog').getByLabel('Campus',{exact:true})
  assert.equal(await campus.isEnabled(),true,'Unassigned legacy campus can be selected')
  await page.getByLabel('Product photo (JPG, PNG or WebP, up to 5 MB)').setInputFiles(file)
  await page.getByRole('button',{name:'Use edited photo',exact:true}).click()
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
  assert.equal(await page.getByRole('dialog').getByLabel('Campus',{exact:true}).isDisabled(),true,'Assigned campus stays locked')
  await page.getByRole('button',{name:'Cancel',exact:true}).click()
  // Stage 1: explicit stock split, copied campus photo, scoped admin views and no accountant editor.
  const shared={...legacy,id:crypto.randomUUID(),name:'Shared campus stock',campus:null,quantity_on_hand:10}
  products.push(shared)
  await page.getByRole('button',{name:'Refresh',exact:true}).click()
  await page.getByRole('button',{name:/Shared campus stock/}).click()
  await page.getByRole('dialog').getByLabel('Campus',{exact:true}).selectOption('senior')
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
    await scoped.goto(`${runtime.base}/tests/fixtures/catalog/index.html?role=admin&campus=${staffCampus}`, { waitUntil: 'domcontentloaded' })
    await scoped.getByRole('heading',{name:staffCampus==='junior'?'Junior school inventory':'Senior school inventory'}).waitFor()
    await scoped.getByRole('button',{name:'Add product',exact:true}).waitFor()
    assert.equal(await scoped.getByRole('button',{name:'Point of sale',exact:true}).count(),1,'Campus admins can open their own POS')
    assert.equal(await scoped.getByLabel('Catalog campus',{exact:true}).count(),0)
    if(staffCampus==='junior') assert.equal(await scoped.getByRole('button',{name:/Shared campus stock/}).count(),0)
    else await scoped.getByRole('button',{name:/Shared campus stock/}).waitFor()
    if(await scoped.getByRole('button',{name:/Shared campus stock/}).count()) {
      await scoped.getByRole('button',{name:/Shared campus stock/}).click()
      assert.equal(await scoped.getByRole('button',{name:'Delete unused product',exact:true}).count(),0,'Campus admin cannot permanently delete')
      await scoped.getByRole('button',{name:'Cancel',exact:true}).click()
    }
    await scoped.getByRole('button',{name:'Add product',exact:true}).click()
    const selector=scoped.getByRole('dialog').getByLabel('Campus',{exact:true})
    assert.equal(await selector.inputValue(),staffCampus);assert.equal(await selector.isDisabled(),true)
    await scoped.close()
  }
  const cashier=await context.newPage()
  await cashier.goto(`${runtime.base}/tests/fixtures/catalog/index.html?role=accountant&campus=junior`, { waitUntil: 'domcontentloaded' })
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
  await restricted.goto(`${runtime.base}/tests/fixtures/catalog/index.html?role=accountant&campus=junior`, { waitUntil: 'domcontentloaded' })
  await restricted.getByRole('button',{name:/Legacy jacket/}).waitFor()
  assert.deepEqual(await restricted.locator('.shop-tabs button').allTextContents(),['Point of sale','Sales & receipts'])
  assert.equal(await restricted.getByLabel('Checkout campus',{exact:true}).count(),0)
  await restricted.getByRole('button',{name:/Legacy jacket/}).click()
  await restricted.reload()
  await restricted.locator('.shop-cart-line').getByText('Legacy jacket',{exact:true}).waitFor()
  await restricted.goto(`${runtime.base}/tests/fixtures/catalog/index.html?role=accountant&campus=senior`, { waitUntil: 'domcontentloaded' })
  await restricted.getByRole('button',{name:/Shared campus stock/}).waitFor()
  assert.equal(await restricted.locator('.shop-cart-line').count(),0)
  await restricted.close()
  // Legacy unscoped pending state is preserved until explicit same-ID recovery.
  const recovery=await context.newPage()
  const legacyId=crypto.randomUUID()
  await recovery.addInitScript(({legacyId,productId})=>sessionStorage.setItem('reliance-shop:staff',JSON.stringify({pending:{id:legacyId,items:[{product_id:productId,quantity:1}],payment:'cash',paid:25,customer:'Earlier customer'}})),{legacyId,productId:legacy.id})
  await recovery.goto(`${runtime.base}/tests/fixtures/catalog/index.html?role=accountant&campus=junior`, { waitUntil: 'domcontentloaded' })
  await recovery.getByRole('button',{name:'Recover earlier checkout',exact:true}).waitFor()
  assert.equal(await recovery.getByRole('button',{name:'Complete checkout',exact:true}).isDisabled(),true)
  await recovery.getByRole('button',{name:'Recover earlier checkout',exact:true}).click()
  await recovery.getByRole('dialog',{name:'Sale receipt'}).waitFor()
  assert.equal(checkoutRequests.at(-1).p_request_id,legacyId)
  assert.equal(await recovery.evaluate(()=>JSON.parse(sessionStorage.getItem('reliance-shop:staff')).pending),null)
  await recovery.close()
  const cleared=await context.newPage(),clearedId=crypto.randomUUID(),salesBeforeClearRetry=sales.length
  retiredRequests.add(clearedId)
  await cleared.addInitScript(({id,productId})=>sessionStorage.setItem('reliance-shop:staff',JSON.stringify({pending:{id,items:[{product_id:productId,quantity:1}],payment:'cash',paid:25,customer:'Cleared test'}})),{id:clearedId,productId:legacy.id})
  await cleared.goto(`${runtime.base}/tests/fixtures/catalog/index.html?role=accountant&campus=junior`, { waitUntil: 'domcontentloaded' })
  await cleared.getByRole('button',{name:'Recover earlier checkout',exact:true}).click()
  await cleared.getByRole('alert').filter({hasText:'This test checkout was cleared by Main Admin.'}).waitFor()
  assert.equal(await cleared.evaluate(()=>JSON.parse(sessionStorage.getItem('reliance-shop:staff')).pending),null)
  assert.equal(sales.length,salesBeforeClearRetry,'Cleared test receipts cannot be recreated')
  assert.equal(await cleared.getByRole('button',{name:'Recover earlier checkout',exact:true}).count(),0)
  await cleared.close()
  // Stage 3: selected learner campus, clean carts/size choices, and stale response isolation.
  const familyJunior={id:crypto.randomUUID(),name:'Junior only blazer',campus:'junior',category:'Uniforms',active:true,selling_price:20,cost_price:10,quantity_on_hand:3,reorder_level:1,has_variants:true,image_url:legacy.image_url,product_variants:[{id:'family-junior-size',size:'Small',quantity_on_hand:3,active:true}]}
  const familySenior={id:crypto.randomUUID(),name:'Senior only blazer',campus:'senior',category:'Uniforms',active:true,selling_price:30,cost_price:15,quantity_on_hand:4,reorder_level:1,has_variants:true,image_url:allocated.image_url,product_variants:[{id:'family-senior-size',size:'Large',quantity_on_hand:4,active:true}]}
  products.push(familyJunior,familySenior)
  for(const [studentId,name] of [['student-junior','Historic Junior uniform'],['student-senior','Historic Senior uniform'],['student-missing','Legacy unassigned learner order']]) orders.push({id:crypto.randomUUID(),parent_id:'parent',student_id:studentId,items:[{name,quantity:1,unit_price:9}],total:9,payment_status:'pending',created_at:new Date().toISOString()})
  const family=await context.newPage()
  family.on('pageerror',error=>errors.push(error.message))
  await family.goto(`${runtime.base}/tests/fixtures/catalog/index.html?role=parent&family=1`, { waitUntil: 'domcontentloaded' })
  await family.getByRole('heading',{name:'Junior only blazer',exact:true}).waitFor()
  assert.equal(await family.getByRole('heading',{name:'Senior only blazer',exact:true}).count(),0)
  await family.getByText('1 × Historic Junior uniform — USD 9.00 each',{exact:true}).waitFor()
  await family.getByLabel('Size for Junior only blazer').selectOption('family-junior-size')
  await family.locator('.parent-product-card').filter({has:family.getByRole('heading',{name:'Junior only blazer',exact:true})}).getByRole('button',{name:'Add to cart',exact:true}).click()
  await family.locator('.parent-cart-lines').getByText('Junior only blazer · Small',{exact:true}).waitFor()
  await family.getByLabel('Buying for',{exact:false}).selectOption('student-senior')
  assert.equal(await family.getByText('1 × Historic Junior uniform — USD 9.00 each',{exact:true}).count(),0)
  assert.equal(await family.getByRole('heading',{name:'Junior only blazer',exact:true}).count(),0)
  await family.getByRole('heading',{name:'Senior only blazer',exact:true}).waitFor()
  assert.equal(await family.locator('.parent-cart-lines').count(),0)
  await family.getByLabel('Size for Senior only blazer').selectOption('family-senior-size')
  await family.locator('.parent-product-card').filter({has:family.getByRole('heading',{name:'Senior only blazer',exact:true})}).getByRole('button',{name:'Add to cart',exact:true}).click()
  await family.getByLabel('Pay at collection',{exact:true}).check()
  await family.getByRole('button',{name:/Place order/}).click()
  await family.getByText('1 × Senior only blazer · Large — USD 30.00 each',{exact:true}).waitFor()
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
  await family.getByText('1 × Legacy unassigned learner order — USD 9.00 each',{exact:true}).waitFor()
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
    for(const f of [new File(['<svg/>'],'x.svg',{type:'image/svg+xml'}),new File([new Uint8Array(5242881)],'large.png',{type:'image/png'}),new File(['invalid'],'broken.png',{type:'image/png'})]) {
      try{await prepareProductImage(f);results.push('accepted')}catch(error){results.push(error.message)}
    }
    return results
  })
  assert.match(validation[0],/JPG, PNG or WebP/);assert.match(validation[1],/5 MB/);assert.match(validation[2],/could not be read/)
  const acceptedSizes = await page.evaluate(async () => {
    const { prepareProductImage } = await import('/src/lib/productImages.js')
    const canvas = document.createElement('canvas'); canvas.width = 1200; canvas.height = 600
    const png = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'))
    const results = []
    for (const size of [2097153, 5242880]) {
      const file = new File([png, new Uint8Array(size - png.size)], 'large-valid.png', { type: 'image/png' })
      const compressed = await prepareProductImage(file)
      const image = await createImageBitmap(compressed)
      results.push({ source: file.size, bytes: compressed.size, width: image.width, height: image.height })
      image.close()
    }
    return results
  })
  assert.equal(acceptedSizes.length, 2)
  for (const result of acceptedSizes) {
    assert.ok(result.bytes < result.source, 'Large valid photo is compressed')
    assert.equal(result.width, 1000); assert.equal(result.height, 500)
  }
  // Tall/wide legacy uploads must use the complete image within a stable square.
  const layoutProbe=async target=>target.locator('.catalog-image:has(img)').first().evaluate(async frame=>{
    const img=frame.querySelector('img');const original=img.src
    const dimensions=[]
    for(const [width,height] of [[300,900],[900,300]]) {
      const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height
      canvas.getContext('2d').fillRect(0,0,width,height)
      img.src=canvas.toDataURL('image/png');await img.decode()
      const rect=frame.getBoundingClientRect(),imageRect=img.getBoundingClientRect()
      dimensions.push({width:rect.width,height:rect.height,imageWidth:imageRect.width,imageHeight:imageRect.height,fit:getComputedStyle(img).objectFit,lazy:img.loading})
    }
    img.src=original
    return dimensions
  })
  // Close a recovered sale receipt before returning to the staff catalog.
  if(await page.getByRole('dialog',{name:'Sale receipt'}).count()) await page.getByRole('dialog',{name:'Sale receipt'}).getByRole('button',{name:'Close',exact:true}).click()
  await page.getByRole('button',{name:'Products',exact:true}).click()
  await page.getByLabel('Catalog campus',{exact:true}).selectOption('all')
  // Receiving the same SKU at different supplier costs preserves each cost lot.
  const receiptForm = page.locator('.shop-receive-form')
  await page.getByRole('button',{name:'Add product',exact:true}).click()
  await page.getByLabel('Product name',{exact:true}).fill('Supplier cost test item')
  await page.getByLabel('Selling price (USD)',{exact:true}).fill('15')
  await page.getByLabel('Default correction cost (USD)',{exact:true}).fill('5')
  await page.getByRole('dialog').getByLabel('Campus',{exact:true}).selectOption('junior')
  await page.getByRole('button',{name:'Save product',exact:true}).click()
  await page.getByRole('dialog',{name:'Product editor'}).waitFor({state:'detached'})
  const receiptProduct = products.at(-1)
  assert.equal(receiptProduct.quantity_on_hand,0,'New test product starts with no stock')
  await receiptForm.getByLabel('Supplier',{exact:true}).fill('First supplier')
  await receiptForm.getByLabel('Supplier reference',{exact:false}).fill('INV-FIRST-01')
  const receiptLine = receiptForm.locator('.shop-receipt-line').first()
  await receiptLine.locator('select').first().selectOption(receiptProduct.id)
  await receiptLine.locator('input[type="number"]').first().fill('2')
  await receiptLine.locator('input[type="number"]').nth(1).fill('7.25')
  await receiptForm.getByRole('button',{name:'Record stock receipt',exact:true}).click()
  await page.getByText('Stock receipt recorded',{exact:false}).waitFor()
  const firstReceipt = page.locator('.shop-stock-ledger-entry').filter({hasText:'First supplier'})
  await firstReceipt.locator('summary').click()
  await firstReceipt.getByText('Supplier cost test item',{exact:true}).waitFor()
  await firstReceipt.getByText('7.25',{exact:false}).waitFor()
  assert.equal(receiptProduct.quantity_on_hand,2,'The multi-product receiving form adds its entered quantity')
  // The product workflow receives a second delivery at a different supplier cost.
  await page.getByRole('button',{name:/Supplier cost test item/}).click()
  const productDialog=page.getByRole('dialog',{name:'Product editor'})
  const productReceive=productDialog.locator('.shop-product-stock-receive')
  await productReceive.locator('summary').click()
  if(viewportWidth===390) {
    const mobileReceive=await productReceive.evaluate(element=>({scrollWidth:element.scrollWidth,clientWidth:element.clientWidth,buttonHeight:element.querySelector('button').getBoundingClientRect().height,top:element.getBoundingClientRect().top,fieldsTop:element.parentElement.querySelector('.shop-product-fields').getBoundingClientRect().top}))
    assert.ok(mobileReceive.scrollWidth<=mobileReceive.clientWidth+1,'Product receipt form fits the mobile editor width')
    assert.ok(mobileReceive.buttonHeight>=44,'Mobile receipt action has a comfortable tap target')
    assert.ok(mobileReceive.top<mobileReceive.fieldsTop,'Stock receiving is the first section in the mobile product editor')
    await productDialog.screenshot({path:'tmp/catalog-review/mobile-product-receive.png'})
  }
  await productReceive.getByLabel('Supplier',{exact:true}).fill('Second supplier')
  await productReceive.getByLabel('Supplier reference',{exact:false}).fill('INV-SECOND-02')
  await productReceive.getByLabel('Quantity to receive',{exact:true}).fill('2')
  await productReceive.getByLabel('Supplier unit cost (USD)',{exact:true}).fill('9.10')
  await productReceive.getByRole('button',{name:'Record this delivery',exact:true}).click()
  await productDialog.waitFor({state:'detached'})
  await page.getByText('Stock received for Supplier cost test item',{exact:false}).waitFor()
  const secondReceipt=page.locator('.shop-stock-ledger-entry').filter({hasText:'Second supplier'})
  await secondReceipt.locator('summary').click()
  await secondReceipt.getByText('Supplier cost test item',{exact:true}).waitFor()
  await secondReceipt.getByText('9.10',{exact:false}).waitFor()
  assert.equal(receiptProduct.quantity_on_hand,4,'Both supplier receipts add their received stock')
  assert.deepEqual(stockReceipts.filter(row=>row.supplier_name.endsWith('supplier')).map(row=>row.supplier_name),['First supplier','Second supplier'])
  assert.deepEqual(stockBatches.filter(row=>row.product_id===receiptProduct.id).map(row=>row.unit_cost.toFixed(2)),['7.25','9.10'])
  sales.splice(0,sales.length)
  sales.push({
    id:'batch-cost-report-test',receipt_number:'RLC-COST-TEST',created_at:new Date().toISOString(),campus:'junior',currency:'USD',
    status:'completed',customer_name:'Cost report check',payment_method:'cash',total:50,amount_paid:50,
    pos_sale_items:[{id:'batch-cost-report-line',product_id:receiptProduct.id,product_name:receiptProduct.name,quantity:2,unit_price:25,unit_cost:8.175,cost_total:16.35,line_total:50}],
  })
  await page.getByRole('button',{name:'Refresh',exact:true}).click()
  await page.getByRole('button',{name:'Profit & loss',exact:true}).click()
  const profitRow=page.locator('.shop-profit-layout tbody tr').filter({hasText:'Supplier cost test item'})
  const profitText=(await profitRow.textContent()).replace(/\s+/g,' ')
  assert.match(profitText,/16\.35/,'P&L uses the cost snapshot from received batches')
  assert.match(profitText,/33\.65/,'P&L computes gross profit from the batch cost snapshot')
  assert.match(profitText,/67\.3%/,'P&L computes gross margin from the batch cost snapshot')
  await page.getByRole('button',{name:'Products',exact:true}).click()
  await parent.getByRole('button',{name:'Refresh catalog',exact:true}).click()
  await parent.getByRole('heading',{name:'Legacy jacket',exact:true}).waitFor()
  for(const target of [page,parent]) for(const result of await layoutProbe(target)) {
    assert.ok(Math.abs(result.width-result.height)<2,'Catalog frame is square')
    assert.ok(Math.abs(result.imageWidth-result.width)<2 && Math.abs(result.imageHeight-result.height)<2,'Photo stays within its frame')
    assert.equal(result.fit,'contain');assert.equal(result.lazy,'lazy')
  }
  await parent.screenshot({path:`tmp/catalog-review/parent-photo-display-${viewportWidth}.png`,fullPage:true})
  assert.equal(await page.locator('.shop-catalog').evaluate(grid=>[grid,...grid.querySelectorAll('.shop-product,.catalog-image')].every(element=>{const box=element.getBoundingClientRect();return box.left>=-1 && box.right<=innerWidth+1})),true,'Admin catalog cards and photo frames stay inside the viewport')
  const geometry=await page.evaluate(async()=>{
    const {drawProductPhoto,compressProductPhoto,DEFAULT_PHOTO_EDIT}=await import('/src/lib/productPhotoEditor.js')
    const source=document.createElement('canvas');source.width=1200;source.height=600
    const ctx=source.getContext('2d');ctx.fillStyle='#ff0000';ctx.fillRect(0,0,600,600);ctx.fillStyle='#0000ff';ctx.fillRect(600,0,600,600)
    const output=document.createElement('canvas')
    const pixel=(x,y)=>Array.from(output.getContext('2d').getImageData(x,y,1,1).data).slice(0,3)
    drawProductPhoto(output,source,DEFAULT_PHOTO_EDIT)
    const fitTop=pixel(500,20),fitLeft=pixel(20,500),fitRight=pixel(980,500)
    drawProductPhoto(output,source,{...DEFAULT_PHOTO_EDIT,mode:'crop',x:1})
    const cropRight=pixel(980,500)
    drawProductPhoto(output,source,{...DEFAULT_PHOTO_EDIT,rotation:90})
    const rotateTop=pixel(500,20),rotateBottom=pixel(500,980)
    const compressed=await compressProductPhoto(output,'balanced')
    return {fitTop,fitLeft,fitRight,cropRight,rotateTop,rotateBottom,bytes:compressed.blob.size,type:compressed.blob.type}
  })
  assert.deepEqual(geometry.fitTop,[255,255,255],'Whole photo has white padding')
  assert.deepEqual(geometry.fitLeft,[255,0,0]);assert.deepEqual(geometry.fitRight,[0,0,255])
  assert.deepEqual(geometry.cropRight,[255,0,0],'Crop position changes visible part')
  assert.deepEqual(geometry.rotateTop,[255,0,0]);assert.deepEqual(geometry.rotateBottom,[0,0,255])
  assert.equal(geometry.type,'image/webp');assert.ok(geometry.bytes<=160*1024)
  assert.deepEqual(errors,[])
  const overflow=await parent.evaluate(()=>document.documentElement.scrollWidth>innerWidth)
  assert.equal(overflow,false,'Parent mobile catalog does not overflow')
  console.log(`PASS (${viewportWidth}px): product stock receiving, separate supplier batch costs, profit reporting, mobile tap targets and dialog fit.`)
} finally { await context.close(); await runtime.close() }
