import StatCard from './StatCard'

export default function DashboardHero({ title, subtitle, stats = [], actions = [] }) {
  return <section className="dashboard-hero"><div><p className="dashboard-kicker">Reliance Learning Centre</p><h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</div><div className="dashboard-actions">{actions.map(action => <button key={action.label} className={`dashboard-button ${action.color === 'secondary' ? 'secondary' : ''}`} onClick={action.onClick}>{action.label}</button>)}</div><div className="dashboard-stat-grid">{stats.map(stat => <StatCard key={stat.label} {...stat} compact />)}</div></section>
}
