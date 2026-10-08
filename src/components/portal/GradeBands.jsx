import { useMemo, useState } from 'react'
import { calculateGrade } from '../../utils/GradeCalculator'

const scales = [
  { title: 'ECD & Primary', appliesTo: 'ECD A to Grade 7', rows: [['85–100', 'Unit 1', 'Excellent'], ['77–84', 'Unit 2', 'Very Good'], ['70–76', 'Unit 3', 'Good'], ['60–69', 'Unit 4', 'Satisfactory'], ['50–59', 'Unit 5', 'Fair'], ['40–49', 'Unit 6', 'Pass – Lower'], ['30–39', 'Unit 7', 'Pass – Low'], ['20–29', 'Unit 8', 'Fail'], ['0–19', 'Unit 9', 'Fail – Very Low']] },
  { title: 'O Level', appliesTo: 'Form 1 to Form 4', rows: [['75–100', 'A', 'Distinction'], ['65–74', 'B', 'Merit'], ['50–64', 'C', 'Credit – Pass'], ['40–49', 'D', 'Pass'], ['0–39', 'E', 'Fair']] },
  { title: 'A Level', appliesTo: 'Lower Six & Upper Six', rows: [['80–100', 'A', 'Outstanding'], ['70–79', 'B', 'Very Good'], ['60–69', 'C', 'Good'], ['50–59', 'D', 'Satisfactory'], ['40–49', 'E', 'Minimum Pass'], ['30–39', 'O', 'Subsidiary Pass'], ['0–29', 'F', 'Fail']] },
]

export default function GradeBands() {
  const [level, setLevel] = useState('Form 1')
  const [score, setScore] = useState('')
  const outcome = useMemo(() => calculateGrade(score, level), [level, score])

  return <div className="dash-section">
    <div className="dash-page-header"><div><h1 className="dash-page-title">Grade bands</h1><p className="dash-page-sub">The official score-to-grade rules used by mark entry and academic report books.</p></div></div>
    <section className="card" style={{ padding: '20px' }}>
      <h2 style={{ marginTop: 0 }}>Check a result</h2>
      <div className="portal-action-row" style={{ alignItems: 'end' }}>
        <label>Class level<select value={level} onChange={event => setLevel(event.target.value)}><option>ECD A</option><option>Grade 1</option><option>Grade 7</option><option>Form 1</option><option>Form 4</option><option>Lower Six</option><option>Upper Six</option></select></label>
        <label>Score (%)<input type="number" min="0" max="100" value={score} onChange={event => setScore(event.target.value)} placeholder="e.g. 68" /></label>
        <div className="portal-notice" style={{ margin: 0, minWidth: '210px' }}>{outcome ? <><strong>{outcome.grade}</strong> · {outcome.description}</> : 'Enter a score from 0 to 100.'}</div>
      </div>
    </section>
    <div className="portal-record-grid">{scales.map(scale => <section className="card" key={scale.title} style={{ padding: '20px' }}><h2 style={{ marginTop: 0 }}>{scale.title}</h2><p className="muted">{scale.appliesTo}</p><div className="portal-table-wrap"><table className="portal-table"><thead><tr><th>Score</th><th>Grade</th><th>Meaning</th></tr></thead><tbody>{scale.rows.map(([range, grade, meaning]) => <tr key={grade}><td>{range}</td><td><strong>{grade}</strong></td><td>{meaning}</td></tr>)}</tbody></table></div></section>)}</div>
  </div>
}
