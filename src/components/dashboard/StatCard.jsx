export default function StatCard({ icon = '●', label, value, subtext, color = 'navy', trend, onClick, compact = false }) {
  const Tag = onClick ? 'button' : 'article'
  return <Tag className={`dashboard-stat-card ${color} ${compact ? 'compact' : ''}`} onClick={onClick}><span className="stat-icon">{icon}</span><span className="stat-label">{label}</span><strong>{value}</strong>{(subtext || trend) && <small>{trend} {subtext}</small>}</Tag>
}
