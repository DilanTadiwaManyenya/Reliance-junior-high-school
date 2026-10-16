import MobileRecordTable from './MobileRecordTable'
import { useMemo, useState } from 'react'
import Card from '../ui/Card'

export default function AccountantLearnerProfiles({ students = [], campus = 'junior', onOpenProfile }) {
  const [classLevel, setClassLevel] = useState('all')
  const [query, setQuery] = useState('')
  const levels = useMemo(() => [...new Set(students.map(student => student.class_level).filter(Boolean))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })), [students])
  const visibleStudents = useMemo(() => students
    .filter(student => classLevel === 'all' || student.class_level === classLevel)
    .filter(student => `${student.full_name} ${student.admission_number}`.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => a.full_name.localeCompare(b.full_name)), [students, classLevel, query])
  const campusLabel = campus === 'junior' ? 'Junior School' : 'Senior School'

  return <section className="accountant-learner-profiles">
    <header className="dash-page-header">
      <div><p className="eyebrow">{campusLabel} finance</p><h1 className="dash-page-title">Learner profiles</h1><p className="dash-page-sub">Find a learner by grade, then review their school profile and fee history.</p></div>
      <span className="portal-scope-label">{campusLabel} only</span>
    </header>
    <Card>
      <div className="accountant-profile-filters">
        <label>Grade level<select value={classLevel} onChange={event => setClassLevel(event.target.value)}><option value="all">All grade levels</option>{levels.map(level => <option key={level} value={level}>{level}</option>)}</select></label>
        <label>Find learner<input value={query} onChange={event => setQuery(event.target.value)} placeholder="Name or admission number" /></label>
      </div>
      <p className="muted accountant-profile-count">{visibleStudents.length} learner{visibleStudents.length === 1 ? '' : 's'} available in this view.</p>
      <div className="portal-table-wrap"><MobileRecordTable className="portal-table accountant-profile-table mobile-record-table" aria-label="Campus learner profiles"><thead><tr><th>Learner</th><th>Admission no.</th><th>Grade</th><th>Status</th><th aria-label="Open profile" /></tr></thead><tbody>{visibleStudents.length ? visibleStudents.map(student => <tr key={student.id}><td><strong>{student.full_name}</strong></td><td className="mono">{student.admission_number || '—'}</td><td>{student.class_level}{student.class_stream ? ` · ${student.class_stream}` : ''}</td><td><span className={`roster-status-pill ${student.status === 'active' ? 'pill-active' : 'pill-inactive'}`}>{student.status === 'active' ? 'Enrolled' : 'Inactive'}</span></td><td><button type="button" className="fee-profile-button" onClick={() => onOpenProfile?.(student)}>Open profile</button></td></tr>) : <tr><td colSpan="5" className="muted">No learners match this grade and search in your campus.</td></tr>}</tbody></MobileRecordTable></div>
    </Card>
  </section>
}
