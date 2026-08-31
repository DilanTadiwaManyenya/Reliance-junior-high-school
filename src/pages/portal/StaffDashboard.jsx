import { useCallback, useEffect, useState } from 'react'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import PortalNotice from '../../components/portal/PortalNotice'
import StudentSelector from '../../components/portal/StudentSelector'
import FeesDashboard from '../../components/portal/FeesDashboard'
import { useSection } from '../../components/portal/StaffPortalLayout'
import { useAuth } from '../../context/useAuth'
import { invokeEdgeFunction } from '../../lib/edgeFunction'
import { CLASS_LEVELS, getStreamsForLevel } from '../../data/classOptions'

const records     = { attendance: 'attendance', academic: 'academic_records', behavior: 'behavior_notes', sports: 'sports_records' }
const today       = () => new Date().toISOString().slice(0, 10)
const emptyForms  = () => ({ attendance: { date: today(), status: 'present', late_minutes: '', note: '' }, academic: { term: '', subject: '', score: '', grade: '', comment: '' }, behavior: { category: '', description: '', severity: 'positive' }, sports: { activity: '', term: '', achievement: '', note: '' } })
const emptyStudent = () => ({ full_name: '', admission_number: '', date_of_birth: '', class_level: '', class_stream: '', enrolled_year: new Date().getFullYear(), status: 'active', inactive_reason: '' })

/* ─── Stat Card ──────────────────────────────────────────────────── */
function StatCard({ label, value, sub, accent, icon }) {
  return (
    <div className="dash-stat-card">
      <div className="dash-stat-icon" style={{ background: `${accent}18`, color: accent }}>
        {icon}
      </div>
      <div className="dash-stat-body">
        <span className="dash-stat-value" style={{ color: accent }}>{value}</span>
        <span className="dash-stat-label">{label}</span>
        {sub && <span className="dash-stat-sub">{sub}</span>}
      </div>
    </div>
  )
}

/* ─── SVG mini icons for stat cards ─────────────────────────────── */
const UsersIcon = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
const StaffIcon = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
const FeesIcon  = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>

/* ─── Status pill ────────────────────────────────────────────────── */
function StatusPill({ status }) {
  const cls = status === 'active' ? 'pill-active' : 'pill-inactive'
  return <span className={`roster-status-pill ${cls}`}>{status}</span>
}

/* ─── Dashboard home ─────────────────────────────────────────────── */
function DashboardHome({ students, staff, loading, setSection }) {
  const active  = students.filter(s => s.status === 'active').length
  const pending = students.filter(s => s.status !== 'active').length
  const recent  = students.slice(0, 6)

  return (
    <div className="dash-home">
      {/* Page title */}
      <div className="dash-page-header">
        <div>
          <h1 className="dash-page-title">School Dashboard</h1>
          <p className="dash-page-sub">Administration overview and learner records</p>
        </div>
        <Button onClick={() => setSection('roster')}>View Full Roster →</Button>
      </div>

      {/* Stat cards */}
      <div className="dash-stats-row">
        <StatCard
          label="Total Learners"
          value={loading ? '—' : students.length}
          sub={`${active} active`}
          accent="#C41E3A"
          icon={<UsersIcon />}
        />
        <StatCard
          label="Active Staff"
          value={loading ? '—' : staff.length}
          sub="all roles"
          accent="#1B2A56"
          icon={<StaffIcon />}
        />
        <StatCard
          label="Pending Status"
          value={loading ? '—' : pending}
          sub="inactive learners"
          accent="#E3B23C"
          icon={<FeesIcon />}
        />
      </div>

      {/* Quick learner preview table */}
      <div className="dash-card dash-table-card">
        <div className="dash-card-header">
          <h2 className="dash-card-title">Recent Learners</h2>
          <button className="dash-view-all" onClick={() => setSection('roster')}>View all →</button>
        </div>
        {loading ? (
          <p className="dash-loading-msg">Loading learners…</p>
        ) : (
          <div className="portal-table-wrap">
            <table className="portal-table dash-preview-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Admission No.</th>
                  <th>Class</th>
                  <th>Stream</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {recent.map(row => (
                  <tr key={row.id} className="dash-table-row">
                    <td className="dash-td-name">
                      <span className="dash-learner-avatar">{row.full_name?.[0] ?? '?'}</span>
                      {row.full_name}
                    </td>
                    <td className="mono">{row.admission_number}</td>
                    <td>{row.class_level}</td>
                    <td>{row.class_stream || '—'}</td>
                    <td><StatusPill status={row.status} /></td>
                  </tr>
                ))}
                {recent.length === 0 && (
                  <tr><td colSpan={5} className="dash-empty-row">No learners found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

/* ─── Main export ────────────────────────────────────────────────── */
export default function StaffDashboard() {
  const { supabase, user, profile } = useAuth()
  const { section, setSection }    = useSection()

  const manager    = ['admin', 'principal'].includes(profile?.role)
  const accountant = profile?.role === 'accountant'

  const [students,   setStudents]   = useState([])
  const [query,      setQuery]      = useState('')
  const [selectedId, setSelectedId] = useState('')
  const [tab,        setTab]        = useState('attendance')
  const [forms,      setForms]      = useState(emptyForms)
  const [recent,     setRecent]     = useState([])
  const [student,    setStudent]    = useState(emptyStudent)
  const [editingId,  setEditingId]  = useState(null)
  const [staff,      setStaff]      = useState([])
  const [staffForm,  setStaffForm]  = useState({ fullName: '', phone: '', password: '', role: 'teacher', classLevel: '', classStream: '' })
  const [notice,     setNotice]     = useState('')
  const [error,      setError]      = useState('')
  const [loading,    setLoading]    = useState(true)

  const selected  = students.find(row => row.id === selectedId)
  const showError = value => { setNotice(''); setError(value) }

  const loadStudents = useCallback(async () => {
    setLoading(true)
    const { data, error: requestError } = await supabase.from('students').select('*').order('full_name')
    if (requestError) showError(requestError.message)
    else setStudents(data ?? [])
    setLoading(false)
  }, [supabase])

  const loadStaff = useCallback(async () => {
    if (!manager) return
    const { data, error: requestError } = await supabase
      .from('profiles').select('id, full_name, phone, role, class_level, class_stream')
      .in('role', ['admin', 'principal', 'teacher', 'accountant']).order('full_name')
    if (requestError) showError(requestError.message)
    else setStaff(data ?? [])
  }, [manager, supabase])

  useEffect(() => {
    const timer = setTimeout(() => { loadStudents(); loadStaff() }, 0)
    return () => clearTimeout(timer)
  }, [loadStudents, loadStaff])

  const loadRecent = useCallback(async () => {
    if (!selectedId) return setRecent([])
    const order = tab === 'attendance' ? 'date' : 'created_at'
    const { data, error: requestError } = await supabase
      .from(records[tab]).select('*').eq('student_id', selectedId)
      .order(order, { ascending: false }).limit(10)
    if (requestError) showError(requestError.message)
    else setRecent(data ?? [])
  }, [selectedId, supabase, tab])

  useEffect(() => {
    const timer = setTimeout(loadRecent, 0)
    return () => clearTimeout(timer)
  }, [loadRecent])

  const update = (kind, field) => event =>
    setForms(current => ({ ...current, [kind]: { ...current[kind], [field]: event.target.value } }))

  const saveRecord = async event => {
    event.preventDefault(); setError(''); setNotice('')
    if (!selectedId) return showError('Select a learner first.')
    const row = { ...forms[tab], student_id: selectedId, recorded_by: user.id }
    if (tab === 'attendance') row.late_minutes = row.status === 'late' ? Number(row.late_minutes) : null
    if (tab === 'academic')   row.score = Number(row.score)
    const { error: requestError } = await supabase.from(records[tab]).insert(row)
    if (requestError) return showError(requestError.message)
    setNotice('Record saved successfully.')
    setForms(current => ({ ...current, [tab]: emptyForms()[tab] }))
    loadRecent()
  }

  const saveStudent = async event => {
    event.preventDefault()
    const row = { ...student, enrolled_year: Number(student.enrolled_year), class_stream: student.class_stream || null, inactive_reason: student.status === 'inactive' ? student.inactive_reason : null }
    const request = editingId
      ? supabase.from('students').update(row).eq('id', editingId)
      : supabase.from('students').insert(row)
    const { error: requestError } = await request
    if (requestError) return showError(requestError.message)
    setNotice(editingId ? 'Learner updated successfully.' : 'Learner added successfully.')
    setStudent(emptyStudent()); setEditingId(null); loadStudents()
  }

  const editStudent = row => { setStudent({ ...row, class_stream: row.class_stream ?? '' }); setEditingId(row.id) }

  const createStaff = async event => {
    event.preventDefault(); setError(''); setNotice('')
    const { data, error: requestError } = await invokeEdgeFunction(supabase, 'create-staff-account', staffForm)
    if (requestError || data?.error) return showError(data?.error || requestError.message)
    setNotice(data?.message || 'Staff account created successfully.')
    setStaffForm({ fullName: '', phone: '', password: '', role: 'teacher', classLevel: '', classStream: '' })
    loadStaff()
  }

  const visible = students.filter(row =>
    `${row.full_name} ${row.admission_number}`.toLowerCase().includes(query.toLowerCase())
  )

  // Notices banner
  const Notices = () => (
    <>
      {notice && <PortalNotice>{notice}</PortalNotice>}
      {error  && <PortalNotice tone="error">{error}</PortalNotice>}
    </>
  )

  /* ── Accountant: always show fees dashboard ── */
  if (accountant) return (
    <div className="staff-content-area">
      <FeesDashboard students={students} loading={loading} supabase={supabase} user={user} profile={profile} />
    </div>
  )

  /* ── Section: Fees ── */
  if (section === 'fees') return (
    <div className="staff-content-area">
      <FeesDashboard students={students} loading={loading} supabase={supabase} user={user} profile={profile} />
    </div>
  )

  return (
    <div className="staff-content-area">
      <Notices />

      {/* ══ Dashboard Home ══ */}
      {section === 'dashboard' && (
        <DashboardHome students={students} staff={staff} loading={loading} setSection={setSection} />
      )}

      {/* ══ Roster ══ */}
      {section === 'roster' && (
        <div className="dash-section">
          <div className="dash-page-header">
            <div>
              <h1 className="dash-page-title">Learner Roster</h1>
              <p className="dash-page-sub">All enrolled learners and records</p>
            </div>
          </div>

          <div className="portal-workspace">
            <Card>
              <div className="portal-card-title">
                <h2>Learner roster</h2>
                <label className="portal-inline-search">
                  Search
                  <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Name or admission number" />
                </label>
              </div>
              {loading
                ? <p className="muted">Loading learners…</p>
                : (
                  <div className="portal-table-wrap">
                    <table className="portal-table">
                      <thead>
                        <tr>
                          <th>Name</th>
                          <th>Admission no.</th>
                          <th>Class</th>
                          <th>Stream</th>
                          <th>Status</th>
                          {manager && <th />}
                        </tr>
                      </thead>
                      <tbody>
                        {visible.map(row => (
                          <tr key={row.id} className="dash-table-row">
                            <td className="dash-td-name">
                              <span className="dash-learner-avatar">{row.full_name?.[0] ?? '?'}</span>
                              {row.full_name}
                            </td>
                            <td className="mono">{row.admission_number}</td>
                            <td>{row.class_level}</td>
                            <td>{row.class_stream || '—'}</td>
                            <td><StatusPill status={row.status} /></td>
                            {manager && (
                              <td>
                                <Button variant="secondary" onClick={() => editStudent(row)}>Edit</Button>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              }
            </Card>

            {manager && (
              <Card>
                <h2>{editingId ? 'Edit learner' : 'Add learner'}</h2>
                <form className="form portal-form" onSubmit={saveStudent}>
                  <label>Full name<input required value={student.full_name} onChange={e => setStudent(v => ({ ...v, full_name: e.target.value }))} /></label>
                  <label>Admission number<input required value={student.admission_number} onChange={e => setStudent(v => ({ ...v, admission_number: e.target.value }))} /></label>
                  <label>Date of birth<input required type="date" value={student.date_of_birth} onChange={e => setStudent(v => ({ ...v, date_of_birth: e.target.value }))} /></label>
                  <label>Class level
                    <select required value={student.class_level} onChange={e => setStudent(v => ({ ...v, class_level: e.target.value, class_stream: '' }))}>
                      <option value="">Choose class level</option>
                      {CLASS_LEVELS.map(level => <option key={level}>{level}</option>)}
                    </select>
                  </label>
                  <label>Class stream
                    <select required disabled={!student.class_level} value={student.class_stream} onChange={e => setStudent(v => ({ ...v, class_stream: e.target.value }))}>
                      <option value="">Choose class stream</option>
                      {getStreamsForLevel(student.class_level).map(stream => <option key={stream}>{stream}</option>)}
                    </select>
                  </label>
                  <label>Enrolled year<input required type="number" value={student.enrolled_year} onChange={e => setStudent(v => ({ ...v, enrolled_year: e.target.value }))} /></label>
                  <div className="portal-action-row">
                    <Button type="submit">{editingId ? 'Save changes' : 'Add learner'}</Button>
                    {editingId && <Button type="button" variant="secondary" onClick={() => { setStudent(emptyStudent()); setEditingId(null) }}>Cancel</Button>}
                  </div>
                </form>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* ══ Data Entry ══ */}
      {section === 'entry' && (
        <div className="dash-section">
          <div className="dash-page-header">
            <div>
              <h1 className="dash-page-title">Data Entry</h1>
              <p className="dash-page-sub">Record attendance, academic, behaviour and sports data</p>
            </div>
          </div>

          <div className="portal-workspace">
            <Card>
              <h2>Record data</h2>
              <StudentSelector students={students} value={selectedId} onChange={setSelectedId} query={query} onQueryChange={setQuery} loading={loading} />
              <div className="portal-tabs portal-entry-tabs">
                {Object.keys(records).map(key => (
                  <Button key={key} variant={tab === key ? 'primary' : 'secondary'} onClick={() => setTab(key)}>
                    {key === 'behavior' ? 'Behaviour' : key[0].toUpperCase() + key.slice(1)}
                  </Button>
                ))}
              </div>
              <form className="form portal-form" onSubmit={saveRecord}>
                {tab === 'attendance' && <>
                  <label>Date<input required type="date" value={forms.attendance.date} onChange={update('attendance', 'date')} /></label>
                  <label>Status<select value={forms.attendance.status} onChange={update('attendance', 'status')}><option>present</option><option>late</option><option>absent</option></select></label>
                  <label>Note<textarea value={forms.attendance.note} onChange={update('attendance', 'note')} /></label>
                </>}
                {tab === 'academic' && <>
                  {['term', 'subject', 'score', 'grade', 'comment'].map(key => (
                    <label key={key}>{key}<input required={key !== 'comment'} type={key === 'score' ? 'number' : 'text'} value={forms.academic[key]} onChange={update('academic', key)} /></label>
                  ))}
                </>}
                {tab === 'behavior' && <>
                  {['category', 'description'].map(key => (
                    <label key={key}>{key}<input required value={forms.behavior[key]} onChange={update('behavior', key)} /></label>
                  ))}
                  <label>Severity<select value={forms.behavior.severity} onChange={update('behavior', 'severity')}><option>positive</option><option>minor</option><option>major</option></select></label>
                </>}
                {tab === 'sports' && <>
                  {['activity', 'term', 'achievement', 'note'].map(key => (
                    <label key={key}>{key}<input required={key === 'activity' || key === 'term'} value={forms.sports[key]} onChange={update('sports', key)} /></label>
                  ))}
                </>}
                <Button type="submit">Save record</Button>
              </form>
            </Card>

            <Card>
              <h2>Recent entries</h2>
              {selected
                ? recent.map(row => (
                  <p key={row.id}>{row.date || row.subject || row.category || row.activity} · {row.status || row.grade || row.severity || row.term}</p>
                ))
                : <p className="muted">Select a learner to view entries.</p>
              }
            </Card>
          </div>
        </div>
      )}

      {/* ══ Staff ══ */}
      {section === 'staff' && manager && (
        <div className="dash-section">
          <div className="dash-page-header">
            <div>
              <h1 className="dash-page-title">Staff Management</h1>
              <p className="dash-page-sub">Create and manage staff accounts</p>
            </div>
          </div>

          <div className="portal-workspace">
            <Card>
              <h2>Create staff account</h2>
              <form className="form portal-form" onSubmit={createStaff}>
                <label>Full name<input required value={staffForm.fullName} onChange={e => setStaffForm(x => ({ ...x, fullName: e.target.value }))} /></label>
                <label>Phone<input required value={staffForm.phone} onChange={e => setStaffForm(x => ({ ...x, phone: e.target.value }))} /></label>
                <label>Password<input required minLength="8" type="password" value={staffForm.password} onChange={e => setStaffForm(x => ({ ...x, password: e.target.value }))} /></label>
                <label>Role
                  <select value={staffForm.role} onChange={e => setStaffForm(x => ({ ...x, role: e.target.value, classLevel: '', classStream: '' }))}>
                    <option value="teacher">Teacher</option>
                    <option value="accountant">Accountant</option>
                    <option value="admin">Admin</option>
                    <option value="principal">Principal</option>
                  </select>
                </label>
                {staffForm.role === 'teacher' && <>
                  <label>Class level
                    <select required value={staffForm.classLevel} onChange={e => setStaffForm(x => ({ ...x, classLevel: e.target.value, classStream: '' }))}>
                      <option value="">Choose class level</option>
                      {CLASS_LEVELS.map(level => <option key={level}>{level}</option>)}
                    </select>
                  </label>
                  <label>Class stream
                    <select required disabled={!staffForm.classLevel} value={staffForm.classStream} onChange={e => setStaffForm(x => ({ ...x, classStream: e.target.value }))}>
                      <option value="">Choose class stream</option>
                      {getStreamsForLevel(staffForm.classLevel).map(stream => <option key={stream}>{stream}</option>)}
                    </select>
                  </label>
                </>}
                <Button type="submit">Create account</Button>
              </form>
            </Card>

            <Card>
              <h2>Existing staff</h2>
              <div className="portal-table-wrap">
                <table className="portal-table">
                  <thead>
                    <tr><th>Name</th><th>Phone</th><th>Role</th><th>Class</th></tr>
                  </thead>
                  <tbody>
                    {staff.map(row => (
                      <tr key={row.id}>
                        <td>{row.full_name}</td>
                        <td>{row.phone}</td>
                        <td>{row.role}</td>
                        <td>{row.role === 'teacher' ? `${row.class_level} ${row.class_stream}` : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}
