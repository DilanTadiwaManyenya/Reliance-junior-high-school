import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { mkdir } from 'node:fs/promises'
import { createServer } from 'vite'

// Use an installed Playwright package or the host's bundled browser runtime.
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright')
const server = await createServer({ server: { host: '127.0.0.1', port: 0, hmr: false }, logLevel: 'error' })
let browser
let checks = 0
async function teacherPage(options) {
  const page = await browser.newPage(options)
  // Local interaction checks must not depend on the external font service.
  await page.route('https://fonts.googleapis.com/**', route => route.abort())
  await page.route('https://fonts.gstatic.com/**', route => route.abort())
  return page
}
const screenshotDir = process.env.TEACHER_MOBILE_SCREENSHOTS
const scenarios = [
  { campus: 'senior', stream: 'Blue' },
  { campus: 'senior', stream: 'all', multi: '' },
  { campus: 'junior', class: 'Grade 1' },
  { campus: 'junior', class: 'Grade 4', multi: '' },
]
try {
  await server.listen()
  const base = `http://127.0.0.1:${server.httpServer.address().port}`
  browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) })
  if (screenshotDir) await mkdir(screenshotDir, { recursive: true })
  for (const width of [320, 390, 600, 768, 1024, 1440]) {
    for (const scenario of scenarios) {
      const page = await teacherPage({ viewport: { width, height: 844 }, ...(width <= 600 ? { isMobile: true, hasTouch: true } : {}) })
      const errors = []
      page.on('pageerror', error => errors.push(error.message))
      const params = new URLSearchParams({ ...scenario, section: 'coursework', workspace: 'subjects', allocation: 'allocation', subject: 'Combined Science', level: 'Form 1' })
      await page.goto(`${base}/tests/fixtures/teacher-workspace/index.html?${params}`, { waitUntil: 'domcontentloaded' })
      if (scenario.campus === 'junior') {
        await page.locator('form select').nth(1).selectOption({ index: 1 })
        if (scenario.class === 'Grade 4') await page.locator('form select').nth(2).selectOption({ index: 1 })
      }
      await page.locator('.coursework-heading select').selectOption('assessment')
      const firstMark = page.getByLabel('Mark for Alexandra Example Learner With A Longer Name', { exact: true })
      await firstMark.waitFor()
      const metrics = await page.evaluate(() => {
        const root = document.querySelector('.coursework-page').getBoundingClientRect()
        const selectors = '.coursework-page > *, .coursework-page form input, .coursework-page form select, .coursework-heading select'
        return {
          pageWidth: document.documentElement.scrollWidth,
          clipped: [...document.querySelectorAll(selectors)].filter(el => { const b = el.getBoundingClientRect(); return b.right > root.right + 1 || b.left < root.left - 1 }).map(el => el.tagName),
          marksWidth: document.querySelector('.coursework-marks-wrap').scrollWidth,
          marksVisibleWidth: document.querySelector('.coursework-marks-wrap').clientWidth,
          inputHeights: [...document.querySelectorAll('.coursework-marks input')].map(el => el.getBoundingClientRect().height),
          inputMinHeights: [...document.querySelectorAll('.coursework-marks input')].map(el => parseFloat(getComputedStyle(el).minHeight)),
          minInputFont: Math.min(...[...document.querySelectorAll('.coursework-page input, .coursework-page select')].map(el => parseFloat(getComputedStyle(el).fontSize))),
          toolbar: [...document.querySelectorAll('.staff-top-bar button, .staff-top-bar select')].filter(el => el.getBoundingClientRect().width > 0).map(el => { const b=el.getBoundingClientRect(); return { left:b.left, right:b.right, height:b.height } }),
        }
      })
      assert.ok(metrics.pageWidth <= width + 1, 'Page must not overflow horizontally: ' + JSON.stringify({width, scenario, actual:metrics.pageWidth}))
      assert.deepEqual(metrics.clipped, [], 'Form controls must fit inside coursework')
      // Translated ancestors can report 43.99988 for a computed 44px target.
      assert.ok(metrics.inputMinHeights.every(height => height >= 44) && metrics.inputHeights.every(height => height >= 43.99), 'Mark fields need comfortable tap targets')
      assert.ok(metrics.minInputFont >= 16, 'Inputs need readable text without iPhone focus zoom')
      if (width <= 600) {
        assert.ok(metrics.marksWidth <= metrics.marksVisibleWidth + 1, 'Mobile mark entry must not require sideways scrolling')
        assert.ok(metrics.toolbar.every(control => control.left >= 0 && control.right <= width + 1 && control.height >= 44), 'Mobile navigation controls must fit and remain tappable')
        assert.equal(await page.locator('.top-bar-back').isVisible(), false, 'Floating return action must not cover inputs')
        assert.equal(await page.locator('.coursework-back').isVisible(), true)
        await page.getByRole('button', { name: 'Open navigation menu' }).click()
        assert.equal(await page.locator('.mobile-toggle').getAttribute('aria-expanded'), 'true', 'Open menu needs a close action')
        const sidebar = await page.locator('.sidebar-wrapper').boundingBox()
        const toolbar = await page.locator('.staff-top-bar').boundingBox()
        assert.ok(Math.abs(sidebar.y - (toolbar.y + toolbar.height)) < 4, 'Mobile sidebar must start below the toolbar')
        await page.locator('.sidebar-overlay').click({ position: { x: width - 4, y: 10 } })
        assert.equal(await page.locator('.mobile-toggle').getAttribute('aria-expanded'), 'false', 'Closed menu needs an open action')
      }
      await firstMark.fill('51')
      await page.getByRole('button', { name: /^Save \d+ marks$/ }).click()
      await page.getByText('Marks must be between 0 and 50.', { exact: true }).waitFor()
      assert.equal(await page.evaluate(() => window.fixtureWrites.filter(row => row.table === 'coursework_marks').length), 0)
      await firstMark.fill('18.5')
      await firstMark.press('Enter')
      assert.equal(await page.getByLabel('Mark for Brian Example', { exact: true }).evaluate(el => el === document.activeElement), true)
      await page.getByRole('button', { name: 'Save 2 marks', exact: true }).click()
      const saved = await page.evaluate(() => window.fixtureWrites.find(row => row.table === 'coursework_marks').payload)
      assert.deepEqual(saved.map(row => [row.student_id, row.score]), [['learner-0', 18.5], ['learner-1', 25]])
      if (scenario.class === 'Grade 4') assert.equal(await page.evaluate(() => window.fixtureWrites.some(row => row.table === 'junior_component_marks')), true)
      if (scenario.class === 'Grade 1') assert.equal(await page.evaluate(() => window.fixtureWrites.some(row => row.table === 'junior_component_marks')), false)
      if (width === 390 && screenshotDir) {
        const name = `${scenario.campus}-${scenario.class || scenario.stream}`.replaceAll(' ', '-').toLowerCase()
        await page.evaluate(() => { window.scrollTo(0, 0); document.querySelector('.staff-main').scrollTop = 0 })
        await page.screenshot({ path: `${screenshotDir}/${name}-390.png`, fullPage: true })
      }
      await page.locator('form input[placeholder="e.g. Week 4 fractions test"]').fill('Phone assessment')
      await page.locator('form input[type="number"]').fill('40')
      await page.getByRole('button', { name: 'Create assessment', exact: true }).click()
      await page.waitForFunction(() => window.fixtureWrites.some(row => row.table === 'coursework_assessments'))
      const created = await page.evaluate(() => window.fixtureWrites.find(row => row.table === 'coursework_assessments').payload)
      assert.equal(created.campus, scenario.campus)
      assert.equal(created.total_marks, 40)
      assert.equal(created.class_stream, scenario.campus === 'senior' && scenario.stream !== 'all' ? 'Blue' : null)
      assert.deepEqual(errors, [])
      console.log(`PASS ${scenario.campus} ${scenario.class || scenario.stream} at ${width}px: layout, navigation, validation, marks and assessment creation`)
      checks++
      await page.close()
    }
  }
  for (const width of [320, 768]) for (const campus of ['junior', 'senior']) for (const section of ['dashboard', 'entry', 'roster']) {
    const page = await teacherPage({ viewport: { width, height: 844 } })
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    const params = new URLSearchParams({ campus, class: 'Grade 1', section, workspace: section === 'roster' ? 'classes' : 'subjects', allocation: 'allocation', subject: 'Combined Science', level: 'Form 1', multi: '' })
    await page.goto(`${base}/tests/fixtures/teacher-workspace/index.html?${params}`, { waitUntil: 'domcontentloaded' })
    await page.locator('.staff-content-area').waitFor()
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
    assert.deepEqual(errors, [])
    if (section === 'roster' && width <= 320) {
      const roster = page.locator('.teacher-roster-table')
      await roster.waitFor()
      assert.equal(await roster.evaluate(element => getComputedStyle(element).display), 'block', 'Teacher roster should reflow into mobile cards')
      assert.ok(await page.evaluate(() => {
        const wrap = document.querySelector('.teacher-roster-table').parentElement
        return wrap.scrollWidth <= wrap.clientWidth + 1
      }), 'Teacher roster cards must fit without sideways scrolling')
      const statusFilters = page.locator('.portal-actions[aria-label="Learner roster status filter"] > button')
      assert.equal(await statusFilters.count(), 2, 'Teachers should be able to switch active and disabled roster views')
      assert.ok(await statusFilters.evaluateAll(buttons => buttons.every(button => {
        const box = button.getBoundingClientRect()
        return box.height >= 44 && box.left >= 0 && box.right <= innerWidth + 1
      })), 'Roster status filters must remain full-width tap targets on phones')
    }
    if (section !== 'dashboard') {
      assert.equal(await page.locator('.teacher-workspace-return').isVisible(), true)
      assert.equal(await page.locator('.top-bar-back').isVisible(), false)
      await page.locator('.teacher-workspace-return button').click()
      await page.waitForFunction(expected => new URLSearchParams(location.search).get('section') === expected, campus === 'senior' && section === 'entry' ? 'subject-allocations' : null)
    }
    console.log(`PASS ${campus} ${section} at ${width}px: teacher workspace and return navigation`)
    await page.close()
  }
  // ECD teachers retain the developmental-markbook route instead of coursework.
  const page = await teacherPage({ viewport: { width: 320, height: 640 }, isMobile: true, hasTouch: true })
  await page.goto(`${base}/tests/fixtures/teacher-workspace/index.html?campus=junior&class=ECD+A&section=coursework`, { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Open developmental markbook' }).waitFor()
  assert.equal(await page.locator('.coursework-page form').count(), 0)
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
  await page.getByRole('button', { name: 'Open developmental markbook' }).click()
  await page.locator('.coursework-page').waitFor({ state: 'detached' })
  await page.close()
  console.log(`Verified ${checks} coursework viewport/scenario combinations , 12 surrounding teacher workspace views, and the ECD route using synthetic records only.`)
} finally {
  await browser?.close()
  await server.close()
}
