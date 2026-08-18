import { useCallback, useEffect, useState } from 'react'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import PortalNotice from '../../components/portal/PortalNotice'
import StudentSelector from '../../components/portal/StudentSelector'
import { useAuth } from '../../context/useAuth'

const today = () => new Date().toISOString().slice(0, 10)
const blankStudent = { full_name: '', admission_number: '', date_of_birth: '', class_level: '', class_stream: '', enrolled_year: new Date().getFullYear(), status: 'active' }
const blankForms = () => ({ attendance: { date: today(), status: 'present', late_minutes: '', note: '' }, academic: { term: '', subject: '', score: '', grade: '', comment: '' }, behavior: { category: '', description: '', severity: 'positive' }, sports: { activity: '', term: '', achievement: '', note: '' } })
const records = { attendance: 'attendance', academic: 'academic_records', behavior: 'behavior_notes', sports: 'sports_records' }

export default function StaffDashboard() {
  const { supabase, user, profile } = useAuth()
  const isAdmin = profile?.role === 'admin'
  const [section, setSection] = useState('roster')
  const [entryTab, setEntryTab] = useState('attendance')
  const [students, setStudents] = useState([])
  const [studentQuery, setStudentQuery] = useState('')
  const [selectedId, setSelectedId] = useState('')
  const [rosterQuery, setRosterQuery] = useState('')
  const [studentForm, setStudentForm] = useState(blankStudent)
  const [editingId, setEditingId] = useState(null)
  const [forms, setForms] = useState(blankForms)
  const [recent, setRecent] = useState([])
  const [parentLinks, setParentLinks] = useState([])
  const [parentSearch, setParentSearch] = useState('')
  const [auditQuery, setAuditQuery] = useState('')
  const [loadingStudents, setLoadingStudents] = useState(true)
  const [loadingRecent, setLoadingRecent] = useState(false)
  const [loadingParentLinks, setLoadingParentLinks] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [resetForm, setResetForm] = useState({ targetUserId: '', newPassword: '', confirmPassword: '' })
  const [resettingPassword, setResettingPassword] = useState(false)

  const showError = (value) => { setMessage(''); setError(value) }
  const loadStudents = useCallback(async () => {
    setLoadingStudents(true)
    const { data, error: requestError } = await supabase.from('students').select('*').order('full_name')
    if (requestError) showError(requestError.message)
    else setStudents(data ?? [])
    setLoadingStudents(false)
  }, [supabase])
  const loadParentLinks = useCallback(async () => {
    if (!isAdmin) return
    setLoadingParentLinks(true)
    const { data, error: requestError } = await supabase.from('parent_student').select('id, parent_id, created_at, parent:profiles(full_name, phone), student:students(full_name, admission_number)').not('verified_at', 'is', null).order('created_at', { ascending: false })
    if (requestError) showError(requestError.message)
    else setParentLinks(data ?? [])
    setLoadingParentLinks(false)
  }, [isAdmin, supabase])
  useEffect(() => {
    const timer = setTimeout(() => { loadStudents(); if (isAdmin) loadParentLinks() }, 0)
    return () => clearTimeout(timer)
  }, [isAdmin, loadParentLinks, loadStudents])
  const loadRecent = useCallback(async () => {
    if (!selectedId) { setRecent([]); return }
    setLoadingRecent(true)
    const orderColumn = entryTab === 'attendance' ? 'date' : 'created_at'
    const { data, error: requestError } = await supabase.from(records[entryTab]).select('*').eq('student_id', selectedId).order(orderColumn, { ascending: false }).limit(10)
    if (requestError) showError(requestError.message)
    else setRecent(data ?? [])
    setLoadingRecent(false)
  }, [entryTab, selectedId, supabase])
  useEffect(() => {
    const timer = setTimeout(loadRecent, 0)
    return () => clearTimeout(timer)
  }, [loadRecent])

  const updateForm = (name, field) => (event) => setForms((current) => ({ ...current, [name]: { ...current[name], [field]: event.target.value } }))
  const submitRecord = async (event) => {
    event.preventDefault(); setError(''); setMessage('')
    if (!selectedId) return showError('Select a learner before saving a record.')
    const values = forms[entryTab]
    if (entryTab === 'attendance' && values.status === 'late' && !values.late_minutes) return showError('Enter the number of minutes late.')
    const row = { ...values, student_id: selectedId, recorded_by: user.id }
    if (entryTab === 'attendance') row.late_minutes = values.status === 'late' ? Number(values.late_minutes) : null
    if (entryTab === 'academic') row.score = Number(values.score)
    const { error: requestError } = await supabase.from(records[entryTab]).insert(row)
    if (requestError) return showError(requestError.message)
    setMessage('Record saved successfully.'); setForms((current) => ({ ...current, [entryTab]: blankForms()[entryTab] })); loadRecent()
  }
  const saveStudent = async (event) => {
    event.preventDefault(); setError(''); setMessage('')
    const row = { ...studentForm, enrolled_year: Number(studentForm.enrolled_year), class_stream: studentForm.class_stream || null }
    const request = editingId ? supabase.from('students').update(row).eq('id', editingId) : supabase.from('students').insert(row)
    const { error: requestError } = await request
    if (requestError) return showError(requestError.message)
    setMessage(editingId ? 'Learner updated successfully.' : 'Learner added successfully.')
    setStudentForm(blankStudent); setEditingId(null); loadStudents()
  }
  const startEdit = (student) => { setEditingId(student.id); setStudentForm({ ...student, class_stream: student.class_stream ?? '' }); setSection('roster') }
  const revokeLink = async (link) => {
    setError(''); setMessage('')
    const studentName = link.student?.full_name || 'this learner'
    if (!window.confirm(`Remove this parent's access to ${studentName}?`)) return
    const { error: requestError } = await supabase.from('parent_student').delete().eq('id', link.id)
    if (requestError) return showError(requestError.message)
    setMessage('Parent access removed.'); loadParentLinks()
  }
  const resetParentPassword = async (event) => {
    event.preventDefault(); setError(''); setMessage('')
    if (!resetForm.targetUserId) return showError('Select a parent account.')
    if (resetForm.newPassword.length < 8) return showError('The new password must be at least 8 characters.')
    if (resetForm.newPassword !== resetForm.confirmPassword) return showError('Passwords do not match.')
    setResettingPassword(true)
    const { data, error: functionError } = await supabase.functions.invoke('reset-parent-password', { body: { targetUserId: resetForm.targetUserId, newPassword: resetForm.newPassword } })
    setResettingPassword(false)
    if (functionError || data?.error) return showError(data?.error || functionError.message)
    setMessage(data?.message || 'Parent password reset successfully.')
    setResetForm({ targetUserId: '', newPassword: '', confirmPassword: '' })
  }
  const visibleStudents = students.filter((student) => `${student.full_name} ${student.admission_number}`.toLowerCase().includes(rosterQuery.toLowerCase()))
  const visibleParentLinks = parentLinks.filter((link) => `${link.parent?.full_name || ''} ${link.parent?.phone || ''} ${link.student?.full_name || ''} ${link.student?.admission_number || ''}`.toLowerCase().includes(auditQuery.toLowerCase()))
  const selectedStudent = students.find((student) => student.id === selectedId)

  return <section className="section white"><div className="container portal-content"><p className="eyebrow">Internal tool</p><h1>Staff dashboard</h1><p className="muted">{section === 'password-reset' ? 'Reset parent password' : section === 'audit' ? 'Active parent links' : section === 'entry' ? 'Record data entry' : 'Learner roster'}</p>{message && <PortalNotice>{message}</PortalNotice>}{error && <PortalNotice tone="error">{error}</PortalNotice>}
    <nav className="portal-tabs" aria-label="Staff dashboard sections"><Button variant={section === 'roster' ? 'primary' : 'secondary'} onClick={() => setSection('roster')}>Roster</Button>{isAdmin && <Button variant={section === 'audit' ? 'primary' : 'secondary'} onClick={() => setSection('audit')}>Active Parent Links</Button>}{isAdmin && <Button variant={section === 'password-reset' ? 'primary' : 'secondary'} onClick={() => setSection('password-reset')}>Reset parent password</Button>}<Button variant={section === 'entry' ? 'primary' : 'secondary'} onClick={() => setSection('entry')}>Data entry</Button></nav>
    {section === 'roster' && <div className="portal-workspace"><Card><div className="portal-card-title"><h2>Learner roster</h2><label className="portal-inline-search">Search<input value={rosterQuery} onChange={(event) => setRosterQuery(event.target.value)} placeholder="Name or admission number" /></label></div>{loadingStudents ? <p className="muted">Loading learners…</p> : visibleStudents.length ? <div className="portal-table-wrap"><table className="portal-table"><thead><tr><th>Name</th><th>Admission no.</th><th>Class</th><th>Stream</th><th>Status</th>{isAdmin && <th />}</tr></thead><tbody>{visibleStudents.map((student) => <tr key={student.id}><td>{student.full_name}</td><td>{student.admission_number}</td><td>{student.class_level}</td><td>{student.class_stream || '—'}</td><td><span className={`portal-status ${student.status === 'active' ? 'present' : 'absent'}`}>{student.status}</span></td>{isAdmin && <td><Button variant="secondary" onClick={() => startEdit(student)}>Edit</Button></td>}</tr>)}</tbody></table></div> : <p className="muted">No learners match this search.</p>}</Card>
      {isAdmin && <Card><h2>{editingId ? 'Edit learner' : 'Add learner'}</h2><form className="form portal-form" onSubmit={saveStudent}>{Object.entries({ full_name: 'Full name', admission_number: 'Admission number', date_of_birth: 'Date of birth', class_level: 'Class level', class_stream: 'Class stream', enrolled_year: 'Enrolled year' }).map(([field, label]) => <label key={field}>{label}<input type={field === 'date_of_birth' ? 'date' : field === 'enrolled_year' ? 'number' : 'text'} value={studentForm[field]} onChange={(event) => setStudentForm((current) => ({ ...current, [field]: event.target.value }))} required={field !== 'class_stream'} /></label>)}<label>Status<select value={studentForm.status} onChange={(event) => setStudentForm((current) => ({ ...current, status: event.target.value }))}><option value="active">Active</option><option value="inactive">Inactive</option></select></label><div className="portal-action-row"><Button type="submit">{editingId ? 'Save changes' : 'Add learner'}</Button>{editingId && <Button type="button" variant="secondary" onClick={() => { setEditingId(null); setStudentForm(blankStudent) }}>Cancel</Button>}</div></form></Card>}</div>}
    {section === 'audit' && isAdmin && <Card className="portal-workspace"><div className="portal-card-title"><h2>Active Parent Links</h2><label className="portal-inline-search">Search<input value={auditQuery} onChange={(event) => setAuditQuery(event.target.value)} placeholder="Parent or learner name" /></label></div>{loadingParentLinks ? <p className="muted">Loading active parent links…</p> : visibleParentLinks.length ? <div className="portal-table-wrap"><table className="portal-table"><thead><tr><th>Parent</th><th>Phone</th><th>Learner</th><th>Admission no.</th><th /></tr></thead><tbody>{visibleParentLinks.map((link) => <tr key={link.id}><td>{link.parent?.full_name || 'Parent account'}</td><td>{link.parent?.phone || '—'}</td><td>{link.student?.full_name || 'Learner'}</td><td>{link.student?.admission_number || '—'}</td><td><Button variant="secondary" onClick={() => revokeLink(link)}>Revoke Access</Button></td></tr>)}</tbody></table></div> : <p className="muted">No active parent links match this search.</p>}</Card>}
    {section === 'entry' && <div className="portal-workspace"><Card><h2>Record data</h2><StudentSelector students={students} value={selectedId} onChange={setSelectedId} query={studentQuery} onQueryChange={setStudentQuery} loading={loadingStudents} />{selectedStudent && <p className="muted">Recording for <strong>{selectedStudent.full_name}</strong> · {selectedStudent.admission_number}</p>}<div className="portal-tabs portal-entry-tabs">{Object.keys(records).map((tab) => <Button key={tab} variant={entryTab === tab ? 'primary' : 'secondary'} onClick={() => setEntryTab(tab)}>{tab === 'academic' ? 'Academic' : tab === 'behavior' ? 'Behaviour' : tab[0].toUpperCase() + tab.slice(1)}</Button>)}</div><form className="form portal-form" onSubmit={submitRecord}>{entryTab === 'attendance' && <><label>Date<input type="date" value={forms.attendance.date} onChange={updateForm('attendance', 'date')} required /></label><label>Status<select value={forms.attendance.status} onChange={updateForm('attendance', 'status')}><option>present</option><option>late</option><option>absent</option></select></label>{forms.attendance.status === 'late' && <label>Minutes late<input type="number" min="1" value={forms.attendance.late_minutes} onChange={updateForm('attendance', 'late_minutes')} required /></label>}<label>Note<textarea value={forms.attendance.note} onChange={updateForm('attendance', 'note')} /></label></>}{entryTab === 'academic' && <><label>Term<input value={forms.academic.term} onChange={updateForm('academic', 'term')} required /></label><label>Subject<input value={forms.academic.subject} onChange={updateForm('academic', 'subject')} required /></label><label>Score<input type="number" min="0" value={forms.academic.score} onChange={updateForm('academic', 'score')} required /></label><label>Grade<input value={forms.academic.grade} onChange={updateForm('academic', 'grade')} required /></label><label>Comment<textarea value={forms.academic.comment} onChange={updateForm('academic', 'comment')} /></label></>}{entryTab === 'behavior' && <><label>Category<input value={forms.behavior.category} onChange={updateForm('behavior', 'category')} required /></label><label>Severity<select value={forms.behavior.severity} onChange={updateForm('behavior', 'severity')}><option>positive</option><option>minor</option><option>major</option></select></label><label>Description<textarea value={forms.behavior.description} onChange={updateForm('behavior', 'description')} required /></label></>}{entryTab === 'sports' && <><label>Activity<input value={forms.sports.activity} onChange={updateForm('sports', 'activity')} required /></label><label>Term<input value={forms.sports.term} onChange={updateForm('sports', 'term')} required /></label><label>Achievement<input value={forms.sports.achievement} onChange={updateForm('sports', 'achievement')} /></label><label>Note<textarea value={forms.sports.note} onChange={updateForm('sports', 'note')} /></label></>}<Button type="submit">Save {entryTab === 'behavior' ? 'behaviour note' : entryTab === 'academic' ? 'academic record' : entryTab}</Button></form></Card><Card><h2>Recent entries</h2>{!selectedId ? <p className="muted">Select a learner to view recent entries.</p> : loadingRecent ? <p className="muted">Loading recent entries…</p> : recent.length ? <div className="portal-list">{recent.map((record) => <p key={record.id}><strong>{entryTab === 'attendance' ? `${record.date} · ${record.status}` : entryTab === 'academic' ? `${record.subject} · ${record.score} (${record.grade})` : entryTab === 'behavior' ? `${record.category} · ${record.severity}` : `${record.activity} · ${record.term}`}</strong><br /><span className="muted">{record.note || record.comment || record.description || record.achievement || 'No additional note.'}</span></p>)}</div> : <p className="muted">No recent entries for this learner.</p>}</Card></div>}
    {section === 'password-reset' && isAdmin && <Card className="portal-workspace"><h2>Reset parent password</h2><p className="muted">Search by parent name, phone number, learner name, or admission number, then select the parent account to reset.</p><form className="form portal-form" onSubmit={resetParentPassword}><label>Find parent or learner<input value={parentSearch} onChange={(event) => setParentSearch(event.target.value)} placeholder="Name, phone, or admission number" /></label><label>Parent account<select value={resetForm.targetUserId} onChange={(event) => setResetForm(current => ({ ...current, targetUserId: event.target.value }))} required><option value="">Select a parent account</option>{parentLinks.filter((link) => `${link.parent?.full_name || ''} ${link.parent?.phone || ''} ${link.student?.full_name || ''} ${link.student?.admission_number || ''}`.toLowerCase().includes(parentSearch.toLowerCase())).map((link) => <option key={`${link.parent_id}-${link.student?.admission_number || link.parent_id}`} value={link.parent_id}>{link.parent?.full_name || 'Parent account'}{link.parent?.phone ? ` (${link.parent.phone})` : ''} — {link.student?.full_name || 'Learner'} ({link.student?.admission_number || 'No admission number'})</option>)}</select></label><label>New password<input type="password" minLength="8" value={resetForm.newPassword} onChange={(event) => setResetForm(current => ({ ...current, newPassword: event.target.value }))} autoComplete="new-password" required /></label><p className="muted">Use at least 8 characters. A longer password with a mix of letters, numbers, and symbols is stronger.</p><label>Confirm new password<input type="password" minLength="8" value={resetForm.confirmPassword} onChange={(event) => setResetForm(current => ({ ...current, confirmPassword: event.target.value }))} autoComplete="new-password" required /></label><Button type="submit" disabled={resettingPassword}>{resettingPassword ? 'Resetting password…' : 'Reset parent password'}</Button></form></Card>}
  </div></section>
}
