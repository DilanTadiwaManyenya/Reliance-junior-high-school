import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { mkdir } from 'node:fs/promises'
import { createServer } from 'vite'

// Use an installed Playwright package or the host's bundled browser runtime.
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright')
const server = await createServer({ server: { host: '127.0.0.1', port: 0, hmr: false }, logLevel: 'error' })
let browser
let checks = 0
let markbookChecks = 0
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
  if (process.env.TEACHER_FOCUSED_ONLY !== '1') {
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
      const markAttendance = page.getByRole('button', { name: 'Mark Alexandra Example Learner With A Longer Name present today' })
      const attendanceBox = await markAttendance.boundingBox()
      assert.ok(attendanceBox && attendanceBox.height >= 43.99 && attendanceBox.x >= 0 && attendanceBox.x + attendanceBox.width <= width + 1, 'Attendance entry must remain a tappable control inside each mobile learner card: ' + JSON.stringify(attendanceBox))
      await markAttendance.click()
      await page.waitForFunction(() => window.fixtureWrites.some(row => row.table === 'attendance' && row.operation === 'insert'))
      assert.equal(await page.evaluate(() => window.fixtureWrites.find(row => row.table === 'attendance' && row.operation === 'insert').payload.student_id), 'learner-0')
      const undoAttendance = page.getByRole('button', { name: 'Marked present today for Alexandra Example Learner With A Longer Name. Click to undo.' })
      await undoAttendance.click()
      await page.getByRole('button', { name: 'Mark Alexandra Example Learner With A Longer Name present today' }).waitFor()
      const learnerProfile = page.getByRole('button', { name: 'Open learner profile for Alexandra Example Learner With A Longer Name' })
      await learnerProfile.click()
      await page.getByRole('button', { name: 'Attendance', exact: true }).click()
      const attendanceHistory = page.locator('.teacher-attendance-history')
      await attendanceHistory.waitFor()
      const attendanceControlsFit = await attendanceHistory.evaluate(element => {
        const targets = element.querySelectorAll('.teacher-attendance-close, .teacher-attendance-tabs button, .teacher-attendance-period-picker button')
        return Array.from(targets).every(target => {
          const box = target.getBoundingClientRect()
          return box.height >= 44 && box.width >= 44
        })
      })
      assert.equal(attendanceControlsFit, true, 'Attendance history controls must remain at least 44px tappable on phones')
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Attendance history must not cause horizontal page overflow')
      await page.getByRole('button', { name: /Back to class learners/ }).click()
      await page.locator('.teacher-roster-table').waitFor()
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
  // Senior teachers can pick and navigate an allocation on narrow phones.
  for (const width of [320, 390]) {
    const page = await teacherPage({ viewport: { width, height: 844 }, isMobile: true, hasTouch: true })
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    const params = new URLSearchParams({ campus: 'senior', class: 'Form 1', section: 'subject-allocations', workspace: 'subjects' })
    await page.goto(`${base}/tests/fixtures/teacher-workspace/index.html?${params}`, { waitUntil: 'domcontentloaded' })
    const allocationCards = page.locator('.subject-allocation-card')
    await allocationCards.first().waitFor()
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Senior allocation picker must not create horizontal overflow')
    assert.ok(await allocationCards.evaluateAll(cards => cards.every(card => {
      const box = card.getBoundingClientRect()
      return box.width <= innerWidth + 1 && box.height >= 44
    })), 'Senior allocation cards must fit the phone and remain tappable')
    await allocationCards.first().click()
    const areaNavigation = page.locator('.teacher-subject-navigation-areas')
    await areaNavigation.waitFor()
    assert.ok(await areaNavigation.locator('button').evaluateAll(buttons => buttons.every(button => {
      const box = button.getBoundingClientRect()
      return box.height >= 44 && box.left >= 0 && box.right <= innerWidth + 1
    })), 'Senior subject work navigation must keep tappable controls within the viewport')
    await areaNavigation.getByRole('button', { name: 'Course Work', exact: true }).click()
    await page.waitForFunction(() => new URLSearchParams(location.search).get('section') === 'coursework')
    assert.deepEqual(errors, [])
    console.log(`PASS senior subject allocation navigation at ${width}px`)
    await page.close()
  }
  // Workspace shortcuts stay reachable and preserve campus/class scope on phones.
  for (const width of [320, 390]) {
    const seniorPage = await teacherPage({ viewport: { width, height: 844 }, isMobile: true, hasTouch: true })
    const seniorErrors = []
    seniorPage.on('pageerror', error => seniorErrors.push(error.message))
    const seniorParams = new URLSearchParams({ campus: 'senior', class: 'Form 1', section: 'roster', workspace: 'classes' })
    await seniorPage.goto(`${base}/tests/fixtures/teacher-workspace/index.html?${seniorParams}`, { waitUntil: 'domcontentloaded' })
    const seniorSwitch = seniorPage.locator('.teacher-workspace-switch')
    await seniorSwitch.waitFor()
    const classWork = seniorSwitch.getByRole('button', { name: 'Class work', exact: true })
    const subjectWork = seniorSwitch.getByRole('button', { name: 'Subject work', exact: true })
    assert.equal(await classWork.getAttribute('aria-pressed'), 'true')
    assert.equal(await subjectWork.getAttribute('aria-pressed'), 'false')
    assert.ok(await seniorSwitch.locator('button').evaluateAll(buttons => buttons.every(button => {
      const box = button.getBoundingClientRect()
      return box.height >= 44 && box.left >= 0 && box.right <= innerWidth + 1
    })), 'Senior workspace switches must remain tappable and fit the phone toolbar')
    await subjectWork.click()
    await seniorPage.waitForFunction(() => new URLSearchParams(location.search).get('section') === 'subject-allocations' && new URLSearchParams(location.search).get('workspace') === 'subjects')
    await seniorPage.locator('.teacher-workspace-switch').getByRole('button', { name: 'Class work', exact: true }).click()
    await seniorPage.waitForFunction(() => new URLSearchParams(location.search).get('section') === 'roster' && new URLSearchParams(location.search).get('workspace') !== 'subjects')
    assert.ok(await seniorPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Senior workspace switching must not create horizontal overflow')
    assert.deepEqual(seniorErrors, [])
    await seniorPage.close()

    const juniorPage = await teacherPage({ viewport: { width, height: 844 }, isMobile: true, hasTouch: true })
    const juniorErrors = []
    juniorPage.on('pageerror', error => juniorErrors.push(error.message))
    const juniorParams = new URLSearchParams({ campus: 'junior', class: 'Grade 4', section: 'dashboard', workspace: 'classes' })
    await juniorPage.goto(`${base}/tests/fixtures/teacher-workspace/index.html?${juniorParams}`, { waitUntil: 'domcontentloaded' })
    assert.equal(await juniorPage.locator('.teacher-workspace-switch').count(), 0, 'Junior teachers stay in their assigned-class workspace')
    const shortcuts = juniorPage.locator('.junior-teacher-home-actions button')
    assert.equal(await shortcuts.count(), 2)
    assert.ok(await shortcuts.evaluateAll(buttons => buttons.every(button => {
      const box = button.getBoundingClientRect()
      return box.height >= 44 && box.x >= 0 && box.x + box.width <= innerWidth + 1
    })), 'Junior home shortcuts must be full-width tappable controls')
    await juniorPage.getByRole('button', { name: 'Take attendance', exact: true }).click()
    await juniorPage.waitForFunction(() => new URLSearchParams(location.search).get('section') === 'roster')
    await juniorPage.locator('.dash-page-sub').filter({ hasText: 'Working in Grade 4' }).waitFor()
    assert.ok(await juniorPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Junior attendance shortcut must preserve a fitting phone layout')
    assert.deepEqual(juniorErrors, [])
    console.log(`PASS Senior workspace toggle and Junior class shortcuts at ${width}px`)
    await juniorPage.close()
  }
  }
  // Separate Upper Six Senior allocations must never share Arts and Commercials learners.
  {
    const page = await teacherPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
    const params = new URLSearchParams({ campus: 'senior', class: 'Form 1', section: 'subject-allocations', workspace: 'subjects', extraSubjectScopes: '' })
    await page.goto(`${base}/tests/fixtures/teacher-workspace/index.html?${params}`, { waitUntil: 'domcontentloaded' })
    const arts = page.locator('.subject-allocation-card').filter({ hasText: 'Accounting' }).filter({ hasText: 'Arts · assigned stream' })
    await arts.waitFor()
    await arts.click()
    await page.getByRole('heading', { name: 'Accounting · Upper Six', exact: true }).waitFor()
    assert.equal(await page.getByText('Arts Learner', { exact: true }).count(), 1)
    assert.equal(await page.getByText('Commercials Learner', { exact: true }).count(), 0)
    await page.getByRole('button', { name: 'Open markbook', exact: true }).click()
    await page.getByRole('heading', { name: 'Enter Accounting marks', exact: true }).waitFor()
    const learners = page.locator('.grade-filterbar label').filter({ hasText: 'Learner' }).locator('select option')
    const learnerOptions = await learners.allTextContents()
    assert.equal(learnerOptions.some(row => row.includes('Arts Learner')), true, JSON.stringify({ url: page.url(), learnerOptions }))
    assert.equal(learnerOptions.some(row => row.includes('Commercials Learner')), false, JSON.stringify({ url: page.url(), learnerOptions }))
    await page.close()
    console.log('PASS Senior Upper Six Arts allocation excludes Commercials learners in allocation review and Markbook')
  }
  // Markbook entry stays usable and saves synthetic records on narrow phones for both campuses.
  for (const campus of ['senior', 'junior']) for (const width of [320, 390]) {
    const page = await teacherPage({ viewport: { width, height: 844 }, isMobile: true, hasTouch: true })
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    const params = new URLSearchParams({ campus, class: campus === 'senior' ? 'Form 1' : 'Grade 4', section: 'entry', workspace: 'subjects', allocation: 'allocation', subject: 'Combined Science', level: 'Form 1' })
    await page.goto(`${base}/tests/fixtures/teacher-workspace/index.html?${params}`, { waitUntil: 'domcontentloaded' })
    const markbook = page.locator('.grade-entry-v2')
    await markbook.waitFor()
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${campus} Markbook must not create horizontal overflow at ${width}px`)
    const controlsFit = await markbook.evaluate(element => [...element.querySelectorAll('input, select, textarea, button')]
      .filter(control => control.getBoundingClientRect().width > 0)
      .every(control => {
        const box = control.getBoundingClientRect()
        return box.left >= 0 && box.right <= innerWidth + 1 && box.height >= 43.99
      }))
    assert.equal(controlsFit, true, `${campus} Markbook controls must fit and remain tappable at ${width}px`)
    const learnerPicker = page.locator('.grade-filterbar label').filter({ hasText: 'Learner' }).locator('select')
    if (campus === 'senior') {
      await learnerPicker.selectOption('learner-0')
      await page.getByLabel('Term mark (%)').fill('74')
      await page.getByRole('button', { name: 'Save Combined Science mark', exact: true }).click()
      await page.waitForFunction(() => window.fixtureWrites.some(row => row.table === 'academic_records'), null, { timeout: 5000 })
      assert.equal(await page.evaluate(() => window.fixtureWrites.some(row => row.table === 'academic_records' && row.payload.term_mark === 74)), true)
    } else {
      const subject = page.locator('.grade-filterbar label').filter({ hasText: 'Subject' }).locator('select')
      await subject.selectOption({ index: 1 })
      await learnerPicker.selectOption('learner-0')
      const papers = page.locator('.combined-paper-card')
      await papers.waitFor()
      await papers.locator('div').nth(0).getByLabel('Score').fill('34')
      await papers.locator('div').nth(1).getByLabel('Score').fill('38')
      await page.getByRole('button', { name: 'Save entry', exact: true }).click()
      await page.waitForFunction(() => window.fixtureWrites.some(row => row.table === 'junior_component_marks'), null, { timeout: 5000 })
      assert.equal(await page.evaluate(() => window.fixtureWrites.some(row => row.table === 'junior_component_marks')), true)
    }
    assert.deepEqual(errors, [])
    console.log(`PASS ${campus} Markbook entry at ${width}px: controls fit, synthetic mark saved`)
    markbookChecks++
    await page.close()
  }
  // Shorter phone viewports keep mark fields and the save action reachable for both campuses.
  let compactChecks = 0
  for (const campus of ['senior', 'junior']) for (const [width, height] of [[320, 568], [390, 667]]) {
    const compactPage = await teacherPage({ viewport: { width, height }, isMobile: true, hasTouch: true })
    const compactErrors = []
    compactPage.on('pageerror', error => compactErrors.push(error.message))
    const classLevel = campus === 'senior' ? 'Form 1' : 'Grade 4'
    const params = new URLSearchParams({ campus, class: classLevel, section: 'entry', workspace: 'subjects', allocation: 'allocation', subject: 'Combined Science', level: 'Form 1' })
    await compactPage.goto(`${base}/tests/fixtures/teacher-workspace/index.html?${params}`, { waitUntil: 'domcontentloaded' })
    const markbook = compactPage.locator('.grade-entry-v2')
    await markbook.waitFor()
    assert.ok(await compactPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${campus} Markbook must not overflow horizontally at ${width}×${height}`)
    const learnerPicker = compactPage.locator('.grade-filterbar label').filter({ hasText: 'Learner' }).locator('select')
    if (campus === 'senior') {
      await learnerPicker.selectOption('learner-0')
      await compactPage.getByLabel('Term mark (%)').fill('73')
    } else {
      await compactPage.locator('.grade-filterbar label').filter({ hasText: 'Subject' }).locator('select').selectOption({ index: 1 })
      await learnerPicker.selectOption('learner-0')
      const papers = compactPage.locator('.combined-paper-card')
      await papers.waitFor()
      await papers.locator('div').nth(0).getByLabel('Score').fill('32')
      await papers.locator('div').nth(1).getByLabel('Score').fill('37')
    }
    const saveButton = campus === 'senior'
      ? compactPage.getByRole('button', { name: 'Save Combined Science mark', exact: true })
      : compactPage.getByRole('button', { name: 'Save entry', exact: true })
    await saveButton.scrollIntoViewIfNeeded()
    const saveBox = await saveButton.boundingBox()
    const toolbarBox = await compactPage.locator('.staff-top-bar').boundingBox()
    assert.ok(saveBox && saveBox.height >= 44 && saveBox.x >= 0 && saveBox.x + saveBox.width <= width + 1 && saveBox.y >= (toolbarBox?.y || 0) + (toolbarBox?.height || 0) - 1 && saveBox.y + saveBox.height <= height + 1, `${campus} save action must remain visible, tappable, and clear of the sticky toolbar at ${width}×${height}`)
    await saveButton.click()
    const table = campus === 'senior' ? 'academic_records' : 'junior_component_marks'
    await compactPage.waitForFunction(tableName => window.fixtureWrites.some(row => row.table === tableName), table, { timeout: 5000 })
    assert.deepEqual(compactErrors, [])
    console.log(`PASS ${campus} Markbook at ${width}×${height}: save remains reachable on a short screen`)
    compactChecks++
    await compactPage.close()
  }
  // Teachers can open and return from an assigned learner profile without losing roster context.
  let profileChecks = 0
  for (const campus of ['senior', 'junior']) for (const width of [320, 390]) {
    const profilePage = await teacherPage({ viewport: { width, height: 844 }, isMobile: true, hasTouch: true })
    const profileErrors = []
    profilePage.on('pageerror', error => profileErrors.push(error.message))
    const classLevel = campus === 'senior' ? 'Form 1' : 'Grade 4'
    const params = new URLSearchParams({ campus, class: classLevel, section: 'roster', workspace: 'classes' })
    await profilePage.goto(`${base}/tests/fixtures/teacher-workspace/index.html?${params}`, { waitUntil: 'domcontentloaded' })
    const roster = profilePage.locator('.teacher-roster-table')
    await roster.waitFor()
    assert.ok(await profilePage.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${campus} roster must fit before opening a learner profile`)
    const learnerLink = profilePage.getByRole('button', { name: 'Open learner profile for Alexandra Example Learner With A Longer Name', exact: true })
    const linkFits = await learnerLink.evaluate(button => {
      const box = button.getBoundingClientRect()
      return box.height >= 44 && box.left >= 0 && box.right <= innerWidth + 1
    })
    assert.equal(linkFits, true, `${campus} learner profile action must remain tappable at ${width}px`)
    await learnerLink.click()
    await profilePage.locator('.learner-profile-page').waitFor()
    await profilePage.getByRole('heading', { name: 'Alexandra Example Learner With A Longer Name', exact: true }).waitFor()
    const returnButton = profilePage.locator('.learner-profile-back')
    const returnFits = await returnButton.evaluate(button => {
      const box = button.getBoundingClientRect()
      return box.width >= 44 && box.height >= 44 && box.left >= 0 && box.right <= innerWidth + 1
    })
    assert.equal(returnFits, true, `${campus} profile return action must remain tappable at ${width}px`)
    assert.ok(await profilePage.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${campus} learner profile must not create horizontal overflow at ${width}px`)
    await returnButton.click()
    await roster.waitFor()
    assert.deepEqual(profileErrors, [])
    console.log(`PASS ${campus} roster learner profile at ${width}px: open, fit and return to roster`)
    profileChecks++
    await profilePage.close()
  }
  // Teacher account settings keep password controls and validation usable on narrow phones.
  let settingsChecks = 0
  for (const campus of ['senior', 'junior']) for (const width of [320, 390]) {
    const settingsPage = await teacherPage({ viewport: { width, height: 844 }, isMobile: true, hasTouch: true })
    const settingsErrors = []
    settingsPage.on('pageerror', error => settingsErrors.push(error.message))
    const params = new URLSearchParams({ campus, class: campus === 'senior' ? 'Form 1' : 'Grade 4', section: 'settings', workspace: 'classes' })
    await settingsPage.goto(`${base}/tests/fixtures/teacher-workspace/index.html?${params}`, { waitUntil: 'domcontentloaded' })
    const form = settingsPage.locator('.account-settings-form')
    await form.waitFor()
    assert.ok(await settingsPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${campus} account settings must not create horizontal overflow at ${width}px`)
    const controlsFit = await form.locator('input, button').evaluateAll(controls => controls.every(control => {
      const box = control.getBoundingClientRect()
      return box.width >= 44 && box.height >= 44 && box.left >= 0 && box.right <= innerWidth + 1
    }))
    assert.equal(controlsFit, true, `${campus} account settings controls must remain tappable and fit at ${width}px`)
    await settingsPage.getByLabel('Mobile number').fill('+263 77 123 4567')
    const password = form.locator('#staff-new-password')
    await password.fill('safe-test-password-2026')
    const showPassword = form.getByRole('button', { name: 'Show password' }).first()
    await showPassword.click()
    assert.equal(await password.getAttribute('type'), 'text')
    await form.getByRole('button', { name: 'Hide password' }).first().click()
    assert.equal(await password.getAttribute('type'), 'password')
    await form.locator('#staff-confirm-password').fill('different-test-password')
    await form.getByRole('button', { name: 'Save account settings', exact: true }).click()
    await settingsPage.getByText('The passwords do not match.', { exact: true }).waitFor()
    assert.equal(await settingsPage.evaluate(() => (window.fixtureCredentialCalls || []).length), 0, 'Mismatched credentials must not be submitted')
    await form.locator('#staff-confirm-password').fill('safe-test-password-2026')
    await form.getByRole('button', { name: 'Save account settings', exact: true }).click()
    await settingsPage.getByText('Your phone number and password have been updated.', { exact: true }).waitFor()
    const credentialCall = await settingsPage.evaluate(() => window.fixtureCredentialCalls?.[0])
    assert.equal(credentialCall?.phone, '+263 77 123 4567')
    assert.equal(credentialCall?.passwordProvided, true)
    assert.equal(credentialCall?.selfOnly, true)
    assert.deepEqual(settingsErrors, [])
    console.log(`PASS ${campus} account settings at ${width}px: controls, password visibility, validation and synthetic save`)
    settingsChecks++
    await settingsPage.close()
  }
  // Junior ECD developmental ratings remain usable and save the complete checklist on narrow phones.
  let ecdChecks = 0
  for (const width of [320, 390]) {
    const ecdPage = await teacherPage({ viewport: { width, height: 844 }, isMobile: true, hasTouch: true })
    const ecdErrors = []
    ecdPage.on('pageerror', error => ecdErrors.push(error.message))
    const params = new URLSearchParams({ campus: 'junior', class: 'ECD A', section: 'entry', workspace: 'classes' })
    await ecdPage.goto(`${base}/tests/fixtures/teacher-workspace/index.html?${params}`, { waitUntil: 'domcontentloaded' })
    const ecdMarkbook = ecdPage.locator('.grade-entry-v2')
    await ecdMarkbook.waitFor()
    await ecdPage.locator('.grade-filterbar label').filter({ hasText: 'Learner' }).locator('select').selectOption('learner-0')
    const ratingRows = ecdPage.locator('.ecd-rating-row')
    await ratingRows.first().waitFor()
    assert.ok(await ecdPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `ECD Markbook must not create horizontal overflow at ${width}px`)
    const targetsFit = await ratingRows.locator('label').evaluateAll(labels => labels.every(label => {
      const box = label.getBoundingClientRect()
      return box.width >= 44 && box.height >= 44 && box.left >= 0 && box.right <= innerWidth + 1
    }))
    assert.equal(targetsFit, true, `ECD rating choices must be at least 44px and fit the viewport at ${width}px`)
    const areaCount = await ratingRows.count()
    assert.ok(areaCount > 0, 'ECD checklist must contain development areas')
    for (let index = 0; index < areaCount; index++) await ratingRows.nth(index).locator('label').nth(3).click()
    await ecdPage.getByText('Every development area is ready to save.', { exact: true }).waitFor()
    await ecdPage.getByRole('button', { name: 'Save entry', exact: true }).click()
    await ecdPage.getByText('ECD developmental checklist saved.', { exact: true }).waitFor()
    const savedRatings = await ecdPage.evaluate(() => window.fixtureWrites.find(row => row.table === 'junior_developmental_ratings')?.payload)
    assert.equal(savedRatings.length, areaCount, 'ECD save must write one rating for every development area')
    assert.ok(savedRatings.every(row => row.student_id === 'learner-0' && row.rating === 4), 'ECD save must preserve selected learner and each chosen rating')
    assert.deepEqual(ecdErrors, [])
    console.log(`PASS Junior ECD Markbook at ${width}px: all rating targets fit and complete checklist saves`)
    ecdChecks++
    await ecdPage.close()
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
  if (process.env.TEACHER_FOCUSED_ONLY === '1') console.log(`Verified ${markbookChecks} Senior and Junior Markbook phone scenarios, ${compactChecks} compact-height Markbook scenarios, ${profileChecks} learner-profile flows, ${settingsChecks} account-settings flows, and ${ecdChecks} Junior ECD checklist scenarios using synthetic records only.`)
  else console.log(`Verified ${checks} coursework viewport/scenario combinations, 12 surrounding teacher workspace views, ${markbookChecks} Markbook phone scenarios, ${compactChecks} compact-height Markbook scenarios, ${profileChecks} learner-profile flows, ${settingsChecks} account-settings flows, ${ecdChecks} ECD checklist scenarios, and the ECD route using synthetic records only.`)
} finally {
  await browser?.close()
  await server.close()
}
