import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { startPortalBrowser, openPortal, portalLayoutMetrics } from './helpers/portal-browser.mjs'
const runtime = await startPortalBrowser()
const views = ['academics','coursework','attendance','behavior','sports','awards','insights']
const scenarios = [
  ...['/portal/dashboard','/portal/uniforms','/portal/announcements','/portal/login','/portal/staff-login','/portal/signup','/portal/forgot-password'].map(route => ({role:'parent',route})),
  ...views.map(view => ({role:'parent',route:`/portal/learner/learner-0/${view}`})),
  ...['Grade 1','Grade 4','Grade 7','ECD A','Lower Six','Upper Six'].map(learnerClass => ({role:'parent',route:'/portal/learner/learner-0/academics',learnerClass})),
  {role:'parent',route:'/portal/dashboard',empty:''},
  {role:'parent',route:'/portal/dashboard',inactive:''},
  {role:'parent',route:'/portal/learner/learner-0/academics',owing:''},
  {role:'parent',route:'/portal/set-password',mustChange:''},
]
let count=0
try {
  for(const width of [320,390,768]) for(const scenario of scenarios) {
    const page=await openPortal(runtime.browser,runtime.base,scenario,width)
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))))
    const metrics=await portalLayoutMetrics(page)
    assert.ok(metrics.documentWidth<=width+1,`${JSON.stringify(scenario)} ${width}: document overflow ${metrics.documentWidth}`)
    assert.deepEqual(metrics.clipped,[],`${JSON.stringify(scenario)} ${width}: clipped content`)
    assert.deepEqual(metrics.smallFields,[],`${JSON.stringify(scenario)} ${width}: small fields`)
    assert.deepEqual(page.portalErrors,[],`${JSON.stringify(scenario)} ${width}: runtime errors`)
    assert.ok(await page.locator('.portal-header button').evaluateAll(buttons=>buttons.every(button=>parseFloat(getComputedStyle(button).fontSize)>=12)), 'Parent header actions must keep visible text labels')
    if(scenario.learnerClass==='Lower Six'||scenario.learnerClass==='Upper Six') {
      assert.equal(await page.locator('.report-dashboard').count(),1,'Sixth-form learners must use the Senior report')
      assert.equal(await page.locator('.junior-report-book').count(),0)
    }
    if('owing' in scenario) assert.equal(await page.getByRole('button',{name:'Print / Download PDF',exact:true}).count(),0,'Unpaid academic reports must stay locked')
    if('inactive' in scenario) assert.equal(await page.getByRole('link',{name:/Open uniform catalogue/}).count(),0)
    if(width===390&&scenario.route==='/portal/learner/learner-0/academics'&&!scenario.learnerClass&&!('owing' in scenario)) {
      const region=page.getByRole('region',{name:'Academic report marks',exact:true})
      await region.focus();await page.keyboard.press('ArrowRight')
      await page.waitForFunction(()=>document.querySelector('[aria-label="Academic report marks"]').scrollLeft>0)
      await page.evaluate(()=>{window.print=()=>{window.fixturePrinted=true}})
      await page.getByRole('button',{name:'Print / Download PDF',exact:true}).click()
      assert.equal(await page.evaluate(()=>window.fixturePrinted),true)
      await page.emulateMedia({media:'print'})
      assert.equal(await page.locator('.portal-header').isVisible(),false)
      assert.equal(await page.getByRole('button',{name:'Print / Download PDF',exact:true}).isVisible(),false)
      await page.emulateMedia({media:'screen'})
    }
    if(width===390&&scenario.route==='/portal/dashboard'&&!('empty'in scenario)&&!('inactive'in scenario)) {
      await mkdir('.portal-mobile.local/review',{recursive:true})
      await page.screenshot({path:'.portal-mobile.local/review/parent-dashboard-390.png',fullPage:true})
    }
    console.log(`PASS parent ${scenario.learnerClass||scenario.route} ${width}px`)
    count++;await page.close()
  }
  // Uniform ordering is exercised against a local mock only, with each payment choice.
  for(const method of ['ecocash','bank_transfer','card','cash_collection']) {
    const page=await openPortal(runtime.browser,runtime.base,{role:'parent',route:'/portal/uniforms'},320,480)
    await page.getByRole('button',{name:'Add to cart',exact:true}).click()
    const quantity=page.getByRole('spinbutton',{name:/Quantity for/})
    await quantity.fill('2')
    await page.locator(`input[name="uniform-payment-method"][value="${method}"]`).check()
    if(method==='ecocash') await page.getByLabel('EcoCash number',{exact:true}).fill('0771234567')
    if(method!=='cash_collection') await page.getByLabel('Payment reference',{exact:true}).fill('TEST-REFERENCE')
    const metrics=await portalLayoutMetrics(page)
    assert.ok(metrics.documentWidth<=320)
    assert.deepEqual(metrics.clipped,[])
    const orderButton=page.getByRole('button',{name:/Place order/})
    await orderButton.scrollIntoViewIfNeeded()
    await orderButton.click()
    await page.getByText(/Uniform order received/).waitFor()
    const order=await page.evaluate(()=>window.fixtureWrites.find(row=>row.table==='parent_uniform_orders').payload)
    assert.equal(order.payment_method,method)
    assert.equal(order.payment_status,'pending')
    assert.equal(order.items[0].quantity,2)
    assert.equal(order.total,30)
    assert.deepEqual(page.portalErrors,[])
    await page.close()
  }
  // Password help returns staff and parents to their respective sign-in forms.
  for(const route of ['/portal/login','/portal/staff-login']) {
    const page=await openPortal(runtime.browser,runtime.base,{role:'parent',route},320)
    await page.getByRole('link',{name:'Forgot your password?',exact:true}).click()
    await page.getByRole('heading',{name:'Reset your password',exact:true}).waitFor()
    await page.getByRole('link',{name:'Back to sign in',exact:true}).click()
    await page.waitForFunction(expected=>window.fixtureRoute===expected,route)
    await page.close()
  }
  const guard=await openPortal(runtime.browser,runtime.base,{role:'parent',route:'/portal/staff'},320)
  await guard.waitForFunction(()=>window.fixtureRoute==='/portal/dashboard')
  assert.equal(await guard.locator('.staff-shell').count(),0)
  await guard.close()
  console.log(`Verified ${count} parent/account/report layouts, four uniform payment methods, password-help routing, print controls and parent route guards.`)
}finally{await runtime.close()}
