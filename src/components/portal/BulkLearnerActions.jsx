import { useRef, useState } from 'react'
import { useAuth } from '../../context/useAuth'
import Button from '../ui/Button'
import { runBulkLearnerAction } from '../../lib/bulkLearnerActions'

export default function BulkLearnerActions({ learners, onComplete }) {
  const { supabase, activeRole, profile } = useAuth()
  const [year, setYear] = useState('')
  const [classLevel, setClassLevel] = useState('')
  const [stream, setStream] = useState('')
  const [selected, setSelected] = useState([])
  const [reason, setReason] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)
  const [message, setMessage] = useState('')
  const [results, setResults] = useState([])
  if (activeRole !== 'admin' || profile?.campus !== 'all') return null

  const candidates = learners.filter(row => year && String(row.enrolled_year) === year && (!classLevel || row.class_level === classLevel) && (!stream || row.class_stream === stream))
  const chosen = candidates.filter(row => selected.includes(row.id))
  const action = candidates[0]?.status === 'inactive' ? 'delete' : 'disable'
  const resetSelection = setter => event => { setter(event.target.value); setSelected([]); setConfirmation('') }
  const run = async () => {
    if (busyRef.current || !supabase || !chosen.length || reason.trim().length < 5 || (action === 'delete' && confirmation !== `DELETE ${chosen.length}`)) return
    const label = chosen.map(row => `${row.full_name} (${row.admission_number})`).join('\n')
    if (!window.confirm(`${action === 'delete' ? 'Permanently delete' : 'Disable'} these ${chosen.length} learners?\n\n${label}\n\n${action === 'delete' ? 'Learner and academic records will be removed permanently. Protected financial, order and rollover history can block deletion.' : 'Their records and history will be retained.'}`)) return
    busyRef.current = true
    setBusy(true); setResults([]); setMessage('Processing selected learners. Please keep this page open.')
    try {
      const outcome = await runBulkLearnerAction(supabase, chosen, action, reason, (done, total) => setMessage(`Processed ${done} of ${total} learners. Please keep this page open.`))
      setResults(outcome)
      const succeeded = outcome.filter(row => row.status === 'success').length
      setMessage(`${succeeded} ${action === 'delete' ? 'deleted' : 'disabled'}; ${outcome.filter(row => row.status === 'blocked').length} blocked; ${outcome.filter(row => row.status === 'unknown').length} unconfirmed; ${chosen.length - outcome.length} not processed.`)
      setSelected([]); setConfirmation('')
      try {
        const refresh = await onComplete()
        if (refresh?.ok === false) throw new Error('Refresh failed')
      } catch { setMessage(current => `${current} Roster refresh failed. Refresh before taking another action.`) }
    } catch (error) { setMessage(error.message) }
    finally { busyRef.current = false; setBusy(false) }
  }

  return <details className="portal-notice">
    <summary>Bulk disable or delete learners · Main Admin</summary>
    <p>Choose an enrolment year and check the learners below. Use the class, stream and roster status filters to narrow the list. Disable active learners first; permanent deletion is available in Disabled learners.</p>
    <fieldset disabled={busy} className="form">
      <legend>Bulk learner selection</legend>
      <label>Enrolment year<select aria-label="Enrolment year" value={year} onChange={resetSelection(setYear)}><option value="">Choose enrolment year</option>{[...new Set(learners.map(row => row.enrolled_year).filter(Boolean))].sort().map(value => <option key={value} value={value}>{value}</option>)}</select></label>
      <label>Class<select aria-label="Class" value={classLevel} onChange={event => { setClassLevel(event.target.value); setStream(''); setSelected([]); setConfirmation('') }}><option value="">All visible classes</option>{[...new Set(learners.map(row => row.class_level).filter(Boolean))].sort().map(value => <option key={value}>{value}</option>)}</select></label>
      <label>Stream<select aria-label="Stream" value={stream} onChange={resetSelection(setStream)}><option value="">All visible streams</option>{[...new Set(learners.filter(row => !classLevel || row.class_level === classLevel).map(row => row.class_stream).filter(Boolean))].sort().map(value => <option key={value}>{value}</option>)}</select></label>
      <div className="portal-actions"><Button type="button" variant="secondary" disabled={!candidates.length} onClick={() => { setSelected(candidates.map(row => row.id)); setConfirmation('') }}>Select all {candidates.length} matching learners</Button><Button type="button" variant="secondary" onClick={() => { setSelected([]); setConfirmation('') }}>Clear selection</Button></div>
      <div style={{ maxHeight: '18rem', overflowY: 'auto' }}>{candidates.map(row => <label key={row.id}><input type="checkbox" checked={selected.includes(row.id)} onChange={event => { setSelected(current => event.target.checked ? [...current, row.id] : current.filter(id => id !== row.id)); setConfirmation('') }} />{row.full_name} · {row.admission_number} · {row.class_level} {row.class_stream} · {row.status}</label>)}</div>
      <p>{chosen.length} selected</p>
      <label>Reason<textarea value={reason} maxLength={1000} onChange={event => setReason(event.target.value)} /></label>
      {action === 'delete' && <label>Type DELETE {chosen.length} to confirm permanent deletion<input value={confirmation} onChange={event => setConfirmation(event.target.value)} autoComplete="off" /></label>}
      <Button type="button" disabled={!chosen.length || reason.trim().length < 5 || (action === 'delete' && confirmation !== `DELETE ${chosen.length}`)} onClick={run}>{busy ? 'Processing…' : action === 'delete' ? 'Permanently delete selected learners' : 'Disable selected learners'}</Button>
    </fieldset>
    {message && <p role="status">{message}</p>}
    {!!results.length && <ul>{results.map(row => <li key={row.id}>{row.name}: {row.status === 'success' ? 'Completed' : row.message}</li>)}</ul>}
  </details>
}
