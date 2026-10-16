import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { startPortalBrowser } from './helpers/portal-browser.mjs'

await mkdir('tmp/catalog-review', { recursive: true })
const runtime = await startPortalBrowser()
const products = []
const orders = []
const images = new Map()
const uploads = []
const errors = []
const context = await runtime.browser.newContext({ viewport: { width: 390, height: 844 } })
await context.route('**/catalog-api/**', async route => {
  const req = route.request(), url = new URL(req.url()), method = req.method()
  if (url.pathname.includes('/images/')) {
    if (method === 'POST') { const body = req.postDataBuffer(); images.set(url.pathname, body); uploads.push(body); return route.fulfill({ status: 200, body: '{}' }) }
    if (method === 'DELETE') { images.delete(url.pathname); return route.fulfill({ status: 200, body: '{}' }) }
    return route.fulfill(images.has(url.pathname) ? { status: 200, contentType: 'image/webp', body: images.get(url.pathname) } : { status: 404 })
  }
  const table = url.pathname.split('/').at(-1)
  const tables = { inventory_products: products, parent_uniform_orders: orders, pos_sales: [], students: [], shop_audit: [], shop_settings: [{ id: true, store_name: 'Test shop', receipt_header: 'Uniforms', low_stock_alerts_enabled: true }] }
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
