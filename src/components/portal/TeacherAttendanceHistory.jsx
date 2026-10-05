import { useEffect, useMemo, useState } from 'react'

const isoDate = value => value.toISOString().slice(0, 10)
const isPresent = status => status === 'present' || status === 'late'

function dateRange(period, cursor) {
  const start = new Date(cursor)
  start.setHours(0, 0, 0, 0)
  const end = new Date(cursor)
  end.setHours(0, 0, 0, 0)
  if (period === 'week') {
    const weekday = cursor.getDay()
    start.setDate(cursor.getDate() - (weekday === 0 ? 6 : weekday - 1))
    end.setTime(start.getTime())
    end.setDate(start.getDate() + 6)
  } else {
    start.setDate(1)
    end.setMonth(start.getMonth() + 1, 0)
  }
  return { start: isoDate(start), end: isoDate(end) }
}

const labelFor = value => new Date(`${value}T00:00:00`).toLocaleDateString('en-ZW', { weekday: 'short', day: 'numeric', month: 'short' })
const monthLabel = value => value.toLocaleDateString('en-ZW', { month: 'long', year: 'numeric' })

export default function TeacherAttendanceHistory({ supabase, student, onClose }) {
  const [period, setPeriod] = useState('week')
  const [cursor, setCursor] = useState(() => new Date())
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [dateSearch, setDateSearch] = useState('')
  const [searchedRecord, setSearchedRecord] = useState(null)
  const [searchingDate, setSearchingDate] = useState(false)
  const range = useMemo(() => dateRange(period, cursor), [period, cursor])
  const movePeriod = direction => setCursor(current => {
    const next = new Date(current)
    if (period === 'month') next.setMonth(next.getMonth() + direction)
    else next.setDate(next.getDate() + (direction * 7))
    return next
  })

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

  useEffect(() => {
    let active = true
    if (!dateSearch) { setSearchedRecord(null); return undefined }
    const lookup = async () => {
      setSearchingDate(true)
      const { data, error: requestError } = await supabase.from('attendance').select('id, date, status, late_minutes, note').eq('student_id', student.id).eq('date', dateSearch).maybeSingle()
      if (!active) return
      setSearchedRecord(requestError ? { error: requestError.message } : data || { missing: true })
      setSearchingDate(false)
    }
    lookup()
    return () => { active = false }
  }, [dateSearch, student.id, supabase])

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
      <button type="button" role="tab" aria-selected={period === 'week'} className={period === 'week' ? 'is-active' : ''} onClick={() => setPeriod('week')}>Week view</button>
      <button type="button" role="tab" aria-selected={period === 'month'} className={period === 'month' ? 'is-active' : ''} onClick={() => setPeriod('month')}>Month view</button>
    </div>
    <div className="teacher-attendance-period-picker">
      <button type="button" onClick={() => movePeriod(-1)} aria-label={`Previous ${period}`}>‹</button>
      <strong>{period === 'month' ? monthLabel(cursor) : `${labelFor(range.start)} – ${labelFor(range.end)}`}</strong>
      <button type="button" onClick={() => movePeriod(1)} aria-label={`Next ${period}`}>›</button>
    </div>
    <section className="teacher-attendance-date-search" aria-label="Find attendance by date">
      <div><strong>Find a date</strong><span>Check this learner’s attendance on any school day.</span></div>
      <label><span className="sr-only">Attendance date</span><input type="date" value={dateSearch} max={isoDate(new Date())} onChange={event => setDateSearch(event.target.value)} /></label>
      {dateSearch && <div className={`teacher-attendance-date-result${searchedRecord?.status ? ` is-${searchedRecord.status}` : ''}`} aria-live="polite">
        {searchingDate ? 'Checking attendance…' : searchedRecord?.error ? searchedRecord.error : searchedRecord?.missing ? <><b>No attendance recorded</b><span>{labelFor(dateSearch)} has not been marked yet.</span></> : <><b>{searchedRecord.status === 'present' ? 'Present' : searchedRecord.status === 'absent' ? 'Absent' : 'Late'}</b><span>{labelFor(dateSearch)}{searchedRecord.late_minutes != null ? ` · ${searchedRecord.late_minutes} minutes late` : ''}{searchedRecord.note ? ` · ${searchedRecord.note}` : ''}</span></>}
      </div>}
    </section>
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
