import { useEffect, useMemo, useState } from 'react'

const isoDate = value => value.toISOString().slice(0, 10)
const isPresent = status => status === 'present' || status === 'late'

function dateRange(period) {
  const end = new Date()
  end.setHours(0, 0, 0, 0)
  const start = new Date(end)
  if (period === 'week') start.setDate(end.getDate() - 6)
  else start.setDate(1)
  return { start: isoDate(start), end: isoDate(end) }
}

const labelFor = value => new Date(`${value}T00:00:00`).toLocaleDateString('en-ZW', { weekday: 'short', day: 'numeric', month: 'short' })

export default function TeacherAttendanceHistory({ supabase, student, onClose }) {
  const [period, setPeriod] = useState('week')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const range = useMemo(() => dateRange(period), [period])

  useEffect(() => {
    let active = true
    const load = async () => {
      setLoading(true)
      setError('')
      const { data, error: requestError } = await supabase
        .from('attendance')
        .select('id, date, status, late_minutes, note')
        .eq('student_id', student.id)
        .gte('date', range.start)
        .lte('date', range.end)
        .order('date', { ascending: false })
      if (!active) return
      if (requestError) setError(requestError.message)
      else setRows(data ?? [])
      setLoading(false)
    }
    load()
    return () => { active = false }
  }, [range.end, range.start, student.id, supabase])

  const summary = rows.reduce((value, row) => ({
    ...value,
    present: value.present + (isPresent(row.status) ? 1 : 0),
    absent: value.absent + (row.status === 'absent' ? 1 : 0),
    late: value.late + (row.status === 'late' ? 1 : 0),
  }), { present: 0, absent: 0, late: 0 })

  return <section className="teacher-attendance-history">
    <div className="teacher-attendance-heading">
      <div>
        <strong>{student.full_name}</strong>
        <span>{student.admission_number} · {student.class_level} {student.class_stream || ''}</span>
      </div>
      <button type="button" className="teacher-attendance-close" onClick={onClose}>Done</button>
    </div>
    <div className="teacher-attendance-tabs" role="tablist" aria-label="Attendance period">
      <button type="button" role="tab" aria-selected={period === 'week'} className={period === 'week' ? 'is-active' : ''} onClick={() => setPeriod('week')}>This week</button>
      <button type="button" role="tab" aria-selected={period === 'month'} className={period === 'month' ? 'is-active' : ''} onClick={() => setPeriod('month')}>This month</button>
    </div>
    <p className="teacher-attendance-range">{labelFor(range.start)} – {labelFor(range.end)}</p>
    <div className="teacher-attendance-summary" aria-label="Attendance summary">
      <div><b>{summary.present}</b><span>Present</span></div>
      <div><b>{summary.absent}</b><span>Absent</span></div>
      <div><b>{summary.late}</b><span>Late</span></div>
    </div>
    {loading ? <p className="muted">Loading attendance…</p> : error ? <p className="portal-notice error">{error}</p> : rows.length ? <ul className="teacher-attendance-list">
      {rows.map(row => <li key={row.id}>
        <time dateTime={row.date}>{labelFor(row.date)}</time>
        <span className={`teacher-attendance-status is-${row.status}`}>{row.status}</span>
        {row.status === 'late' && row.late_minutes != null && <small>{row.late_minutes} min late</small>}
        {row.note && <small className="teacher-attendance-note">{row.note}</small>}
      </li>)}
    </ul> : <p className="muted">No attendance has been recorded for this period.</p>}
  </section>
}
