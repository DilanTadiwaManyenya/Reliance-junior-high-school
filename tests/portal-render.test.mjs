import assert from 'node:assert/strict'
import { test } from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { createServer } from 'vite'

test('Portal rendering follows the active role and profile failures remain recoverable', async () => {
  const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' })
  try {
    const { AuthContext } = await server.ssrLoadModule('/src/context/authContext.js')
    const { SectionContext } = await server.ssrLoadModule('/src/components/portal/StaffPortalLayout.jsx')
    const { default: Sidebar } = await server.ssrLoadModule('/src/components/portal/PortalSidebar.jsx')
    const { default: Dashboard } = await server.ssrLoadModule('/src/pages/portal/StaffDashboard.jsx')
    const { default: Fees } = await server.ssrLoadModule('/src/components/portal/FeesDashboard.jsx')
    const { default: TopBar } = await server.ssrLoadModule('/src/components/portal/StaffTopBar.jsx')
    const { default: AcademicReport } = await server.ssrLoadModule('/src/components/portal/AcademicReportCard.jsx')
    const { default: ProtectedRoute } = await server.ssrLoadModule('/src/components/portal/ProtectedRoute.jsx')
    const render = (Component, auth, props = {}, section = {}) => renderToStaticMarkup(
      React.createElement(MemoryRouter, null,
        React.createElement(AuthContext.Provider, { value: auth },
          React.createElement(SectionContext.Provider, { value: { section: 'dashboard', activeClassFilter: {}, ...section } },
            React.createElement(Component, props)))))
    const profile = { role: 'admin', active_role: 'teacher', campus: 'junior', teacher_class_assignments: [{ class_level: 'ECD A', class_stream: '' }] }
    const auth = { profile, activeRole: 'teacher', user: { id: 'staff' }, supabase: null, roles: ['admin', 'teacher'], loading: false }
    const sidebar = render(Sidebar, auth, { teacherWorkspace: 'classes' })
    assert.match(sidebar, /Markbook/)
    assert.match(sidebar, /Learning library/)
    assert.doesNotMatch(sidebar, /School administration|Inventory &amp; POS|Report settings|Bulk learner export/)
    assert.doesNotMatch(sidebar, /Library oversight/)
    for (const [role, campus] of [['admin', 'all'], ['admin', 'junior'], ['accountant', 'senior']]) {
      const supportAuth = { ...auth, activeRole: role, profile: { ...profile, active_role: role, role, campus } }
      const support = render(Dashboard, supportAuth, {}, { section: 'library-support' })
      assert.match(support, /Library oversight/)
      assert.doesNotMatch(support, /type="file"/)
    }
    const ecd = render(Dashboard, auth)
    assert.match(ecd, /Developmental markbook/)
    assert.match(ecd, /Learning library/)
    assert.doesNotMatch(ecd, />Course Work</)
    const grade = render(Dashboard, { ...auth, profile: { ...profile, teacher_class_assignments: [{ class_level: 'Grade 1', class_stream: '' }] } })
    assert.match(grade, />Course Work</)
    const principalProfile = { role: 'admin', active_role: 'principal', campus: 'all' }
    const principalFees = render(Fees, { ...auth, activeRole: 'principal', profile: principalProfile }, { profile: principalProfile, supabase: {} })
    const adminFees = render(Fees, auth, { profile: { ...principalProfile, active_role: 'admin' }, supabase: {} })
    assert.doesNotMatch(principalFees, /Add learner/)
    assert.match(adminFees, /Add learner/)
    assert.match(render(TopBar, auth), /Viewing as:/)
    for (const level of ['Lower Six', 'Upper Six']) {
      const report = render(AcademicReport, auth, { student: { id: 'learner', full_name: 'Example Learner', class_level: level, class_stream: 'Sciences' } })
      assert.match(report, /Senior School Academic Report/)
      assert.doesNotMatch(report, /junior-report-book/)
    }
    const recovery = render(ProtectedRoute, { ...auth, supabase: {}, profile: null, profileError: new Error('Request timed out') })
    assert.match(recovery, /Try again/)
    assert.match(recovery, /connection timed out/)
    assert.doesNotMatch(recovery, /Loading your portal/)
  } finally { await server.close() }
})
