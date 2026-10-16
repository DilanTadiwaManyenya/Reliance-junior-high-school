import { useRef } from 'react'
import Button from '../ui/Button'

export default function CourseworkMarks({ students, marks, totalMarks, saving, dirty = false, onMarkChange, onSave }) {
  const inputs = useRef([])
  const completed = students.filter(student => marks[student.id] !== '' && marks[student.id] !== undefined).length
  const moveToNextLearner = (event, index) => {
    if (event.key !== 'Enter') return
    event.preventDefault()
    if (inputs.current[index + 1]) inputs.current[index + 1].focus()
    else event.currentTarget.blur()
  }

  return <div className="coursework-marks">
    <p className="coursework-marks-progress" role="status">{saving ? 'Saving marks… ' : dirty ? 'Unsaved changes · ' : ''}{completed}/{students.length} marks entered · Missing marks remain blank until saved.</p>
    {students.length ? <div className="portal-table-wrap coursework-marks-wrap" tabIndex={0} role="region" aria-label="Coursework learner marks">
      <table className="portal-table coursework-marks-table" role="table">
        <caption className="coursework-table-caption">Learner coursework marks out of {totalMarks}</caption>
        <thead role="rowgroup"><tr role="row"><th scope="col">Learner</th><th scope="col">Class</th><th scope="col">Admission no.</th><th scope="col">Mark / {totalMarks}</th><th scope="col">Status</th></tr></thead>
        <tbody role="rowgroup">{students.map((student, index) => {
          const value = marks[student.id] ?? ''
          const invalid = value !== '' && (!Number.isFinite(Number(value)) || Number(value) < 0 || Number(value) > Number(totalMarks))
          return <tr key={student.id} role="row">
            <th scope="row" role="rowheader" className="coursework-learner-name">{student.full_name}</th>
            <td role="cell" className="coursework-learner-class" data-label="Class">{student.class_level} {student.class_stream || ''}</td>
            <td role="cell" className="coursework-learner-admission" data-label="Admission no.">{student.admission_number || '—'}</td>
            <td role="cell" className="coursework-learner-mark" data-label={`Mark / ${totalMarks}`}><input
              ref={element => { inputs.current[index] = element }}
              aria-label={`Mark for ${student.full_name}`} aria-invalid={invalid || undefined}
              type="number" inputMode="decimal" step="any" min="0" max={totalMarks}
              enterKeyHint={index < students.length - 1 ? 'next' : 'done'}
              value={value} disabled={saving}
              onChange={event => onMarkChange(student.id, event.target.value)}
              onKeyDown={event => moveToNextLearner(event, index)}
            /></td>
            <td role="cell" className="coursework-learner-status" data-label="Status"><span className={`class-status ${value === '' ? 'is-inactive' : 'is-active'}`}>{invalid ? `Enter 0–${totalMarks}` : value === '' ? 'Missing' : 'Entered'}</span></td>
          </tr>
        })}</tbody>
      </table>
    </div> : <p className="portal-notice">No learners are available for this assessment.</p>}
    <div className="coursework-save-actions"><Button type="button" onClick={onSave} disabled={saving || !students.length}>{saving ? 'Saving…' : `Save ${completed} marks`}</Button></div>
  </div>
}
