import { useAuth } from '../../context/useAuth'
export default function DashboardLayout({ role, children }) { const { profile } = useAuth(); return <main className={`professional-dashboard ${role}`}><header className="dashboard-topline"><span>Portal / {role}</span><span>{profile?.full_name || 'Reliance community'}</span></header>{children}<footer>© Reliance Learning Centre</footer></main> }
