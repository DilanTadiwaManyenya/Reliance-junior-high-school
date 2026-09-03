import { ResponsiveContainer, LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, Tooltip, Legend, XAxis, YAxis } from 'recharts'
const colors = ['#1b2a56', '#2ecc71', '#f39c12', '#c41e3a', '#3fa9da']
export default function DashboardCharts({ type = 'bar', data = [], title, color = '#1b2a56' }) {
  const chart = type === 'line' ? <LineChart data={data}><XAxis dataKey="label"/><YAxis/><Tooltip/><Line type="monotone" dataKey="value" stroke={color} strokeWidth={3}/></LineChart> : type === 'pie' || type === 'donut' ? <PieChart><Pie data={data} dataKey="value" nameKey="label" innerRadius={type === 'donut' ? 52 : 0} outerRadius={78}>{data.map((_, i) => <Cell key={i} fill={colors[i % colors.length]}/>)}</Pie><Tooltip/><Legend/></PieChart> : <BarChart data={data}><XAxis dataKey="label"/><YAxis/><Tooltip/><Bar dataKey="value" fill={color} radius={[4,4,0,0]}/></BarChart>
  return <article className="dashboard-card chart-card"><h2>{title}</h2>{data.length ? <ResponsiveContainer width="100%" height={220}>{chart}</ResponsiveContainer> : <div className="dashboard-empty">No records available yet.</div>}</article>
}
