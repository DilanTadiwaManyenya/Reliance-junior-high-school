import { Route, Routes, useLocation } from 'react-router-dom'
import Footer from './components/layout/Footer'
import Navbar from './components/layout/Navbar'
import About from './pages/About'
import Academics from './pages/Academics'
import Admissions from './pages/Admissions'
import Contact from './pages/Contact'
import Facilities from './pages/Facilities'
import Gallery from './pages/Gallery'
import Home from './pages/Home'
import News from './pages/News'
import NotFound from './pages/NotFound'
import Staff from './pages/Staff'
import StudentLife from './pages/StudentLife'
import PortalLogin from './pages/portal/PortalLogin'
import PortalSignup from './pages/portal/PortalSignup'
import ForgotPassword from './pages/portal/ForgotPassword'
import ParentDashboard from './pages/portal/ParentDashboard'
import StaffDashboard from './pages/portal/StaffDashboard'
import ProtectedRoute from './components/portal/ProtectedRoute'
import PortalLayout from './components/portal/PortalLayout'
import PortalEntry from './pages/portal/PortalEntry'
import StudentSignup from './pages/portal/StudentSignup'
import StudentDashboard from './pages/portal/StudentDashboard'
import Announcements from './pages/portal/Announcements'

function App() {
  const location = useLocation()
  const portal = location.pathname.startsWith('/portal')
  return <div className={portal ? 'portal-shell' : 'site-shell'}>{!portal && <Navbar />}<main><Routes>
    <Route path="/" element={<Home />} /><Route path="/about" element={<About />} />
    <Route path="/academics" element={<Academics />} /><Route path="/admissions" element={<Admissions />} />
    <Route path="/student-life" element={<StudentLife />} /><Route path="/facilities" element={<Facilities />} />
    <Route path="/staff" element={<Staff />} /><Route path="/gallery" element={<Gallery />} />
    <Route path="/news" element={<News />} /><Route path="/contact" element={<Contact />} />
    <Route path="/portal" element={<PortalEntry />} /><Route path="/portal/login" element={<PortalLogin />} /><Route path="/portal/signup" element={<PortalSignup />} /><Route path="/portal/student-login" element={<PortalLogin student />} /><Route path="/portal/student-signup" element={<StudentSignup />} />
    <Route path="/portal/forgot-password" element={<ForgotPassword />} />
    <Route element={<ProtectedRoute />}><Route element={<PortalLayout />}><Route path="/portal/dashboard" element={<ParentDashboard />} /><Route element={<ProtectedRoute roles={['student']} />}><Route path="/portal/student-dashboard" element={<StudentDashboard />} /></Route><Route path="/portal/announcements" element={<Announcements />} /><Route element={<ProtectedRoute roles={['staff', 'admin']} />}><Route path="/portal/staff" element={<StaffDashboard />} /></Route></Route></Route>
    <Route path="*" element={<NotFound />} />
  </Routes></main>{!portal && <Footer />}</div>
}
export default App
