import { useEffect, useMemo, useState } from 'react'
import { supabase as fallback } from '../../lib/supabaseClient'
import { useSchoolClasses } from '../../hooks/useSchoolClasses'

const scopes = [
  { id: 'class', title: 'Class · all streams', description: 'Every learner in one class level.' },
  { id: 'stream', title: 'Class · one stream', description: 'Learners in one selected stream.' },
  { id: 'campus', title: 'Whole campus', description: 'All learners in Junior or Senior.' },
  { id: 'all', title: 'All campuses', description: 'The complete school learner register.' },
]

const ageOn = (dateOfBirth) => {
  if (!dateOfBirth) return '—'
  const birth = new Date(`${dateOfBirth}T00:00:00`)
  if (Number.isNaN(birth.getTime())) return '—'
  const now = new Date()
  let years = now.getFullYear() - birth.getFullYear()
  const beforeBirthday = now.getMonth() < birth.getMonth() || (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate())
  if (beforeBirthday) years -= 1
  return years >= 0 ? years : '—'
}

const scopeTitle = ({ scope, campus, level, stream }) => {
  if (scope === 'all') return 'All campuses'
  if (scope === 'campus') return `${campus === 'junior' ? 'Junior' : 'Senior'} campus`
  if (scope === 'stream') return `${level || 'Selected class'} · ${stream || 'selected stream'}`
  return `${level || 'Selected class'} · all streams`
}

export default function BulkLearnerExport({ supabase: provided }) {
  const db = provided ?? fallback
  const { classes, loading: classesLoading } = useSchoolClasses(db)
  const [scope, setScope] = useState('class')
  const [campus, setCampus] = useState('junior')
  const [level, setLevel] = useState('')
  const [stream, setStream] = useState('')
  const [learners, setLearners] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [searched, setSearched] = useState(false)

  const levels = useMemo(() => [...new Set(classes.map(row => row.class_level))], [classes])
  const streams = useMemo(() => [...new Set(classes.filter(row => row.class_level === level).map(row => row.class_stream).filter(Boolean))], [classes, level])

  useEffect(() => {
    if (!level && levels.length) setLevel(levels[0])
  }, [level, levels])

  useEffect(() => {
    if (scope === 'stream' && !streams.includes(stream)) setStream(streams[0] || '')
  }, [scope, stream, streams])

  const canPreview = scope === 'all' || scope === 'campus' || Boolean(level && (scope !== 'stream' || stream))
  const currentScope = scopeTitle({ scope, campus, level, stream })

  const preview = async () => {
    if (!canPreview) return
    setLoading(true)
    setError('')
    setSearched(true)
    let query = db.from('students').select('id, admission_number, full_name, date_of_birth, sex, class_level, class_stream, campus, parent_name, parent_phone, address, birth_cert_no, status').order('campus').order('class_level').order('class_stream').order('full_name')
    if (scope === 'campus') query = query.eq('campus', campus)
    if (scope === 'class' || scope === 'stream') query = query.eq('class_level', level)
    if (scope === 'stream') query = query.eq('class_stream', stream)
    const { data, error: requestError } = await query
    setLearners(requestError ? [] : (data ?? []))
    setError(requestError?.message || '')
    setLoading(false)
  }

  return <section className="bulk-export">
    <div className="bulk-export-intro">
      <div><p className="eyebrow">Printable learner register</p><h2>Build the learner export</h2><p>Select exactly who belongs in the register, review the live list, then print it.</p></div>
      {searched && <div className="bulk-export-count"><b>{learners.length}</b><span>Learners in this export</span></div>}
    </div>

    <section className="bulk-export-controls" aria-label="Learner export scope">
      <fieldset><legend>1. Choose the export scope</legend><div className="bulk-export-scope-grid">{scopes.map(option => <label key={option.id} className={`bulk-export-scope${scope === option.id ? ' selected' : ''}`}><input type="radio" name="export-scope" value={option.id} checked={scope === option.id} onChange={() => setScope(option.id)} /><span><b>{option.title}</b><small>{option.description}</small></span></label>)}</div></fieldset>

      {(scope === 'campus' || scope === 'stream' || scope === 'class') && <div className="bulk-export-fields">
        {scope === 'campus' && <label>Campus<select value={campus} onChange={event => setCampus(event.target.value)}><option value="junior">Junior campus</option><option value="senior">Senior campus</option></select></label>}
        {(scope === 'class' || scope === 'stream') && <label>Class<select value={level} disabled={classesLoading} onChange={event => { setLevel(event.target.value); setStream('') }}>{levels.map(item => <option key={item} value={item}>{item}</option>)}</select></label>}
        {scope === 'stream' && <label>Stream<select value={stream} disabled={!level || classesLoading} onChange={event => setStream(event.target.value)}>{streams.map(item => <option key={item} value={item}>{item}</option>)}</select></label>}
      </div>}

      <div className="bulk-export-actions"><div><b>{currentScope}</b><small>Includes active and inactive learners currently recorded in this scope.</small></div><button type="button" className="btn primary" disabled={!canPreview || loading} onClick={preview}>{loading ? 'Loading learners…' : 'Preview learner list'}</button></div>
    </section>

    {error && <p className="portal-notice error">Unable to prepare the learner export: {error}</p>}
    {searched && !loading && !error && <section className="bulk-export-preview">
      <div className="bulk-export-preview-head"><div><p className="eyebrow">Export preview</p><h2>{currentScope}</h2><p>{learners.length} learner{learners.length === 1 ? '' : 's'} · prepared {new Date().toLocaleDateString()}</p></div><button type="button" className="btn secondary print-hide" disabled={!learners.length} onClick={() => window.print()}>Print learner register</button></div>
      {learners.length ? <div className="portal-table-wrap bulk-export-table"><table className="portal-table"><thead><tr><th>#</th><th>Admission no.</th><th>Learner full name</th><th>Age</th><th>Sex</th><th>Class</th><th>Stream</th><th>Campus</th><th>Guardian</th><th>Phone</th><th>Address</th><th>Status</th></tr></thead><tbody>{learners.map((learner, index) => <tr key={learner.id}><td>{index + 1}</td><td>{learner.admission_number || '—'}</td><td><strong>{learner.full_name}</strong></td><td>{ageOn(learner.date_of_birth)}</td><td>{learner.sex || '—'}</td><td>{learner.class_level || '—'}</td><td>{learner.class_stream || '—'}</td><td>{learner.campus ? `${learner.campus[0].toUpperCase()}${learner.campus.slice(1)}` : '—'}</td><td>{learner.parent_name || '—'}</td><td>{learner.parent_phone || '—'}</td><td>{learner.address || '—'}</td><td>{learner.status || '—'}</td></tr>)}</tbody></table></div> : <p className="bulk-export-empty">No learners are currently recorded for this selection.</p>}
    </section>}
  </section>
}
