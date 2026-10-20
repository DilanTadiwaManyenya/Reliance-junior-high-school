import './portalMobileComposition.css'
import './lib/draftHistoryGuard'
import { lazy, Suspense } from 'react'
import { Route, Routes, useLocation } from 'react-router-dom'
import RouteLoadBoundary from './components/RouteLoadBoundary'
import './routeLoading.css'
import ProtectedRoute from './components/portal/ProtectedRoute'
import ActivityLogger from './components/portal/ActivityLogger'
import ConnectionStatus from './components/ConnectionStatus'

const Footer = lazy(() => import('./components/layout/Footer'))
const Navbar = lazy(() => import('./components/layout/Navbar'))
const About = lazy(() => import('./pages/About'))
const Academics = lazy(() => import('./pages/Academics'))
const Admissions = lazy(() => import('./pages/Admissions'))
const Contact = lazy(() => import('./pages/Contact'))
const Facilities = lazy(() => import('./pages/Facilities'))
const Gallery = lazy(() => import('./pages/Gallery'))
const Home = lazy(() => import('./pages/Home'))
const News = lazy(() => import('./pages/News'))
const NotFound = lazy(() => import('./pages/NotFound'))
const Staff = lazy(() => import('./pages/Staff'))
const StudentLife = lazy(() => import('./pages/StudentLife'))
const PortalLogin = lazy(() => import('./pages/portal/PortalLogin'))
const PortalSignup = lazy(() => import('./pages/portal/PortalSignup'))
const ForgotPassword = lazy(() => import('./pages/portal/ForgotPassword'))
const ParentDashboard = lazy(() => import('./pages/portal/ParentDashboard'))
const ParentUniformCatalogue = lazy(() => import('./pages/portal/ParentUniformCatalogue'))
const ParentRecordPage = lazy(() => import('./pages/portal/ParentRecordPage'))
const StaffDashboard = lazy(() => import('./pages/portal/StaffDashboard'))
const PortalLayout = lazy(() => import('./components/portal/PortalLayout'))
const StaffPortalLayout = lazy(() => import('./components/portal/StaffPortalLayout'))
const PortalEntry = lazy(() => import('./pages/portal/PortalEntry'))
const Announcements = lazy(() => import('./pages/portal/Announcements'))
const TeacherFirstLogin = lazy(() => import('./pages/portal/TeacherFirstLogin'))
const SetNewPassword = lazy(() => import('./pages/portal/SetNewPassword'))
const RoleDashboard = lazy(() => import('./pages/portal/RoleDashboard.jsx'))

function App() {
  const location = useLocation()
  const portal = location.pathname.startsWith('/portal')
  return <div className={portal ? 'portal-shell' : 'site-shell'}><ActivityLogger /><ConnectionStatus enabled={portal} /><RouteLoadBoundary key={location.pathname}><Suspense fallback={<section className="route-loading" role="status" aria-live="polite" aria-busy="true"><p>Opening page…</p></section>}>{!portal && <Navbar />}<main><Routes>
    <Route path="/" element={<Home />} /><Route path="/about" element={<About />} />
    <Route path="/academics" element={<Academics />} /><Route path="/admissions" element={<Admissions />} />
    <Route path="/student-life" element={<StudentLife />} /><Route path="/facilities" element={<Facilities />} />
    <Route path="/staff" element={<Staff />} /><Route path="/gallery" element={<Gallery />} />
    <Route path="/news" element={<News />} /><Route path="/contact" element={<Contact />} />
    <Route path="/portal" element={<PortalEntry />} /><Route path="/portal/login" element={<PortalLogin />} /><Route path="/portal/staff-login" element={<PortalLogin staff />} /><Route path="/portal/signup" element={<PortalSignup />} />
    <Route path="/portal/forgot-password" element={<ForgotPassword />} />
    <Route element={<ProtectedRoute />}>
      <Route path="/portal/set-password" element={<SetNewPassword />} />
      <Route path="/portal/first-login" element={<TeacherFirstLogin />} />
      <Route element={<PortalLayout />}>
        <Route path="/portal/dashboard" element={<ParentDashboard />} />
        <Route path="/portal/uniforms" element={<ParentUniformCatalogue />} />
        <Route path="/portal/learner/:studentId/:view" element={<ParentRecordPage />} />
        <Route path="/portal/announcements" element={<Announcements />} />
      </Route>
      <Route element={<StaffPortalLayout />}>
        <Route element={<ProtectedRoute roles={['admin', 'principal']} />}>
            <Route path="/portal/staff" element={<StaffDashboard />} />
            <Route path="/portal/admin-dashboard" element={<RoleDashboard role='admin' />} />
        </Route>
        <Route element={<ProtectedRoute roles={['teacher']} />}>
          <Route path="/portal/teacher" element={<StaffDashboard />} />
        </Route>
        <Route element={<ProtectedRoute roles={['accountant']} />}>
          <Route path="/portal/accountant" element={<StaffDashboard />} />
        </Route>
      </Route>
    </Route>
    <Route path="*" element={<NotFound />} />
  </Routes></main>{!portal && <Footer />}</Suspense></RouteLoadBoundary></div>
}
export default App
