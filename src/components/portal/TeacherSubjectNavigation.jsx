import './teacherSubjectNavigation.css'

const areas = [
  ['entry', 'Markbook'],
  ['coursework', 'Course Work'],
  ['library', 'Library'],
]

export default function TeacherSubjectNavigation({ allocation, section, onChange, onChoose }) {
  return <nav className="teacher-subject-navigation" aria-label="Subject work areas">
    <div className="teacher-subject-navigation-context">
      <button type="button" className="btn secondary" onClick={onChoose}>← Allocations</button>
      <div><span>Current teaching allocation</span><strong>{allocation.subject} · {allocation.class_level}</strong><small>{allocation.class_stream || 'All assigned streams'}</small></div>
    </div>
    <div className="teacher-subject-navigation-areas">{areas.map(([id, label]) => <button type="button" key={id} aria-current={section === id ? 'page' : undefined} onClick={() => onChange(id)}>{label}</button>)}</div>
  </nav>
}
