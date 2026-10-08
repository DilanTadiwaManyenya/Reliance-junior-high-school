import { useEffect, useState } from 'react'
import PortalNotice from './PortalNotice'

const SCHOOL_LEVELS = ['ECD A', 'ECD B', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6', 'Grade 7', 'Form 1', 'Form 2', 'Form 3', 'Form 4', 'Lower Six', 'Upper Six']
const JUNIOR_LEVELS = SCHOOL_LEVELS.filter(level => level.startsWith('ECD') || level.startsWith('Grade'))
const SENIOR_LEVELS = SCHOOL_LEVELS.filter(level => !JUNIOR_LEVELS.includes(level))
const currentYear = new Date().getFullYear()

export default function ReportTermSettings({ supabase, onClose, onSaved }) {
  const [year, setYear] = useState(currentYear)
  const [term, setTerm] = useState('3')
  const [nextTermDates, setNextTermDates] = useState({ junior: '', senior: '' })
  const [separateDatesAvailable, setSeparateDatesAvailable] = useState(true)
  const [fees, setFees] = useState(Object.fromEntries(SCHOOL_LEVELS.map(level => [level, ''])))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    const load = async () => {
      let settings = await supabase.from('term_settings').select('next_term_begins_on, junior_next_term_begins_on, senior_next_term_begins_on').eq('academic_year', Number(year)).eq('term', Number(term)).maybeSingle()
      if (settings.error?.code === '42703') {
        settings = await supabase.from('term_settings').select('next_term_begins_on').eq('academic_year', Number(year)).eq('term', Number(term)).maybeSingle()
        setSeparateDatesAvailable(false)
      } else setSeparateDatesAvailable(true)
      const schedule = await supabase.from('report_term_fee_settings').select('class_level, amount').eq('academic_year', Number(year)).eq('term', Number(term))
      if (settings.error || schedule.error) return setError(settings.error?.message || schedule.error?.message || 'Unable to load report term settings.')
      setNextTermDates({ junior: settings.data?.junior_next_term_begins_on || settings.data?.next_term_begins_on || '', senior: settings.data?.senior_next_term_begins_on || settings.data?.next_term_begins_on || '' })
      setFees(Object.fromEntries(SCHOOL_LEVELS.map(level => [level, String(schedule.data?.find(row => row.class_level === level)?.amount ?? '')])))
    }
    load()
  }, [supabase, term, year])

  const saveDates = async () => {
    setError(''); setNotice(''); setSaving(true)
    let settings = await supabase.from('term_settings').upsert({ academic_year: Number(year), term: Number(term), next_term_begins_on: nextTermDates.junior || nextTermDates.senior || null, junior_next_term_begins_on: nextTermDates.junior || null, senior_next_term_begins_on: nextTermDates.senior || null }, { onConflict: 'academic_year,term' })
    if (settings.error?.code === '42703') settings = await supabase.from('term_settings').upsert({ academic_year: Number(year), term: Number(term), next_term_begins_on: nextTermDates.junior || nextTermDates.senior || null }, { onConflict: 'academic_year,term' })
    setSaving(false)
    if (settings.error) return setError(settings.error.message || 'Unable to save reopening dates.')
    setNotice('Reopening dates saved.'); onSaved?.()
  }
  const saveFees = async () => {
    setError(''); setNotice(''); setSaving(true)
    const amounts = SCHOOL_LEVELS.map(level => Number(fees[level]))
    if (amounts.some(amount => !Number.isFinite(amount) || amount < 0)) { setSaving(false); return setError('Enter a valid fee for every class level.') }
    const schedule = await supabase.from('report_term_fee_settings').upsert(SCHOOL_LEVELS.map(level => ({ academic_year: Number(year), term: Number(term), class_level: level, amount: Number(fees[level]), updated_at: new Date().toISOString() })), { onConflict: 'academic_year,term,class_level' })
    setSaving(false)
    if (schedule.error) return setError(schedule.error.message || 'Unable to save fee schedule.')
    setNotice('Fee schedules saved.'); onSaved?.()
  }

  const updateDate = (campus, value) => setNextTermDates(current => separateDatesAvailable ? { ...current, [campus]: value } : { junior: value, senior: value })
  const feeFields = (title, levels) => <section style={{ gridColumn: '1 / -1', paddingTop: '8px', borderTop: '1px solid #e2e8f0' }}><h3 style={{ margin: '8px 0' }}>{title} fee schedule</h3><div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '1rem' }}>{levels.map(level => <label key={level}>{level} next-term fee<input type="number" min="0" step="0.01" value={fees[level]} onChange={event => setFees(current => ({ ...current, [level]: event.target.value }))} required /></label>)}</div></section>
  return <div className="fee-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="report-term-settings-title" onClick={event => event.target === event.currentTarget && onClose()}><div className="fee-modal"><div className="fee-modal-head"><div><p className="fee-modal-eyebrow">Academic report book</p><h2 id="report-term-settings-title">Report term settings</h2><p>Junior and Senior campuses can have different reopening dates and fee schedules.</p></div><button type="button" className="fee-icon-button" onClick={onClose} aria-label="Close report term settings">×</button></div>{!separateDatesAvailable && <PortalNotice>Campus-specific dates will save as one school-wide date until the supplied Supabase migration is applied.</PortalNotice>}{error && <PortalNotice tone="error">{error}</PortalNotice>}{notice && <PortalNotice>{notice}</PortalNotice>}<div className="fee-modal-fields" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}><label>Report year<input type="number" min="2020" value={year} onChange={event => setYear(event.target.value)} required /></label><label>Report term<select value={term} onChange={event => setTerm(event.target.value)}><option value="1">Term 1</option><option value="2">Term 2</option><option value="3">Term 3</option></select></label><section style={{ gridColumn: '1 / -1', paddingTop: '8px', borderTop: '1px solid #e2e8f0' }}><h3 style={{ margin: '8px 0' }}>Reopening dates</h3><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}><label>Junior next term begins<input type="date" value={nextTermDates.junior} onChange={event => updateDate('junior', event.target.value)} /></label><label>Senior next term begins<input type="date" value={nextTermDates.senior} onChange={event => updateDate('senior', event.target.value)} disabled={!separateDatesAvailable} /></label></div><button type="button" className="fee-button fee-button-primary" onClick={saveDates} disabled={saving}>{saving ? 'Saving…' : 'Save reopening dates'}</button></section>{feeFields('Junior school', JUNIOR_LEVELS)}{feeFields('Senior school', SENIOR_LEVELS)}</div><div className="fee-modal-actions"><button type="button" className="fee-button fee-button-secondary" onClick={onClose}>Close</button><button type="button" className="fee-button fee-button-primary" onClick={saveFees} disabled={saving}>{saving ? 'Saving…' : 'Save fee schedules'}</button></div></div></div>
}
