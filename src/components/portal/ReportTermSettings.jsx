import { useEffect, useState } from 'react'
import PortalNotice from './PortalNotice'

const SCHOOL_LEVELS = ['ECD A', 'ECD B', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6', 'Grade 7', 'Form 1', 'Form 2', 'Form 3', 'Form 4', 'Lower Six', 'Upper Six']
const currentYear = new Date().getFullYear()

export default function ReportTermSettings({ supabase, onClose, onSaved }) {
  const [year, setYear] = useState(currentYear)
  const [term, setTerm] = useState('3')
  const [nextTermBeginsOn, setNextTermBeginsOn] = useState('')
  const [fees, setFees] = useState(Object.fromEntries(SCHOOL_LEVELS.map(level => [level, ''])))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const load = async () => {
      const [settings, schedule] = await Promise.all([
        supabase.from('term_settings').select('next_term_begins_on').eq('academic_year', Number(year)).eq('term', Number(term)).maybeSingle(),
        supabase.from('report_term_fee_settings').select('class_level, amount').eq('academic_year', Number(year)).eq('term', Number(term)),
      ])
      if (settings.error || schedule.error) return setError(settings.error?.message || schedule.error?.message || 'Unable to load report term settings.')
      setNextTermBeginsOn(settings.data?.next_term_begins_on || '')
      setFees(Object.fromEntries(SCHOOL_LEVELS.map(level => [level, String(schedule.data?.find(row => row.class_level === level)?.amount ?? '')])))
    }
    load()
  }, [supabase, term, year])

  const save = async event => {
    event.preventDefault(); setError(''); setSaving(true)
    const amounts = SCHOOL_LEVELS.map(level => Number(fees[level]))
    if (amounts.some(amount => !Number.isFinite(amount) || amount < 0)) { setSaving(false); return setError('Enter a valid fee for every class level.') }
    const settingsRequest = supabase.from('term_settings').upsert({ academic_year: Number(year), term: Number(term), next_term_begins_on: nextTermBeginsOn || null }, { onConflict: 'academic_year,term' })
    const scheduleRequest = supabase.from('report_term_fee_settings').upsert(SCHOOL_LEVELS.map(level => ({ academic_year: Number(year), term: Number(term), class_level: level, amount: Number(fees[level]), updated_at: new Date().toISOString() })), { onConflict: 'academic_year,term,class_level' })
    const [settings, schedule] = await Promise.all([settingsRequest, scheduleRequest])
    setSaving(false)
    if (settings.error || schedule.error) return setError(settings.error?.message || schedule.error?.message || 'Unable to save report term settings.')
    onSaved?.(); onClose()
  }

  return <div className="fee-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="report-term-settings-title" onClick={event => event.target === event.currentTarget && onClose()}><form className="fee-modal" onSubmit={save}><div className="fee-modal-head"><div><p className="fee-modal-eyebrow">Academic report book</p><h2 id="report-term-settings-title">Report term settings</h2><p>Set the next-term date and the fee printed for every class level.</p></div><button type="button" className="fee-icon-button" onClick={onClose} aria-label="Close report term settings">×</button></div>{error && <PortalNotice tone="error">{error}</PortalNotice>}<div className="fee-modal-fields" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}><label>Report year<input type="number" min="2020" value={year} onChange={event => setYear(event.target.value)} required /></label><label>Report term<select value={term} onChange={event => setTerm(event.target.value)}><option value="1">Term 1</option><option value="2">Term 2</option><option value="3">Term 3</option></select></label><label style={{ gridColumn: '1 / -1' }}>Next term begins on<input type="date" value={nextTermBeginsOn} onChange={event => setNextTermBeginsOn(event.target.value)} /></label>{SCHOOL_LEVELS.map(level => <label key={level}>{level} next-term fee<input type="number" min="0" step="0.01" value={fees[level]} onChange={event => setFees(current => ({ ...current, [level]: event.target.value }))} required /></label>)}</div><div className="fee-modal-actions"><button type="button" className="fee-button fee-button-secondary" onClick={onClose}>Cancel</button><button className="fee-button fee-button-primary" disabled={saving}>{saving ? 'Saving…' : 'Save report settings'}</button></div></form></div>
}
