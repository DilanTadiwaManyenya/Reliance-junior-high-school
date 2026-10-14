import { useEffect, useState } from 'react'
import PortalNotice from './PortalNotice'

const SCHOOL_LEVELS = ['ECD A', 'ECD B', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6', 'Grade 7', 'Form 1', 'Form 2', 'Form 3', 'Form 4', 'Lower Six', 'Upper Six']
const JUNIOR_LEVELS = SCHOOL_LEVELS.filter(level => level.startsWith('ECD') || level.startsWith('Grade'))
const SENIOR_LEVELS = SCHOOL_LEVELS.filter(level => !JUNIOR_LEVELS.includes(level))
const currentYear = new Date().getFullYear()
const missingCampusDateColumns = error => ['42703', 'PGRST204'].includes(error?.code) || /junior_next_term_begins_on|senior_next_term_begins_on/i.test(error?.message || '')

export default function ReportTermSettings({ supabase, campusScope = 'all', onClose, onSaved }) {
  const scopedCampus = ['junior', 'senior'].includes(campusScope) ? campusScope : null
  const visibleCampuses = scopedCampus ? [scopedCampus] : ['junior', 'senior']
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
      if (missingCampusDateColumns(settings.error)) {
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

  const saveCampusSettings = async (campus, includeFees = true) => {
    const levels = campus === 'junior' ? JUNIOR_LEVELS : SENIOR_LEVELS
    const feeSchedule = includeFees ? levels.map(level => ({ class_level: level, amount: Number(fees[level]) })) : []
    if (feeSchedule.some(({ amount }) => !Number.isFinite(amount) || amount < 0)) throw new Error('Enter a valid fee for every class level.')
    const { error: rpcError } = await supabase.rpc('save_campus_report_term_settings', {
      p_academic_year: Number(year),
      p_term: Number(term),
      p_campus: campus,
      p_next_term_begins_on: nextTermDates[campus] || null,
      p_fees: feeSchedule,
    })
    if (rpcError) throw rpcError
  }

  const saveDates = async () => {
    setError(''); setNotice(''); setSaving(true)
    if (scopedCampus) {
      try { await saveCampusSettings(scopedCampus, false) } catch (rpcError) { setSaving(false); return setError(rpcError.message || 'Unable to save report settings.') }
      setSaving(false); setNotice('Report settings saved for your campus.'); onSaved?.(); return
    }
    let settings = await supabase.from('term_settings').upsert({ academic_year: Number(year), term: Number(term), next_term_begins_on: nextTermDates.junior || nextTermDates.senior || null, junior_next_term_begins_on: nextTermDates.junior || null, senior_next_term_begins_on: nextTermDates.senior || null }, { onConflict: 'academic_year,term' })
    if (missingCampusDateColumns(settings.error)) settings = await supabase.from('term_settings').upsert({ academic_year: Number(year), term: Number(term), next_term_begins_on: nextTermDates.junior || nextTermDates.senior || null }, { onConflict: 'academic_year,term' })
    setSaving(false)
    if (settings.error) return setError(settings.error.message || 'Unable to save reopening dates.')
    setNotice('Reopening dates saved.'); onSaved?.()
  }
  const saveFees = async () => {
    setError(''); setNotice(''); setSaving(true)
    const editableLevels = scopedCampus === 'junior' ? JUNIOR_LEVELS : scopedCampus === 'senior' ? SENIOR_LEVELS : SCHOOL_LEVELS
    const amounts = editableLevels.map(level => Number(fees[level]))
    if (amounts.some(amount => !Number.isFinite(amount) || amount < 0)) { setSaving(false); return setError('Enter a valid fee for every class level.') }
    if (scopedCampus) {
      try { await saveCampusSettings(scopedCampus) } catch (rpcError) { setSaving(false); return setError(rpcError.message || 'Unable to save report settings.') }
      setSaving(false); setNotice('Report settings saved for your campus.'); onSaved?.(); return
    }
    const schedule = await supabase.from('report_term_fee_settings').upsert(SCHOOL_LEVELS.map(level => ({ academic_year: Number(year), term: Number(term), class_level: level, amount: Number(fees[level]), updated_at: new Date().toISOString() })), { onConflict: 'academic_year,term,class_level' })
    setSaving(false)
    if (schedule.error) return setError(schedule.error.message || 'Unable to save fee schedule.')
    setNotice('Fee schedules saved.'); onSaved?.()
  }

  const updateDate = (campus, value) => setNextTermDates(current => separateDatesAvailable ? { ...current, [campus]: value } : { junior: value, senior: value })
  const feeFields = (title, levels) => <section className="report-policy-fee-campus"><header><h3>{title} fee schedule</h3><p>These amounts are used when the selected term’s report book is generated.</p></header><div>{levels.map(level => <label key={level}>{level} next-term fee<input type="number" min="0" step="0.01" value={fees[level]} onChange={event => setFees(current => ({ ...current, [level]: event.target.value }))} required /></label>)}</div></section>
  const scopeLabel = scopedCampus ? `${scopedCampus === 'junior' ? 'Junior' : 'Senior'} School` : 'Junior and Senior campuses'
  return <section className="report-policy-workspace" aria-labelledby="report-term-settings-title"><header className="report-policy-hero"><div><p className="eyebrow">School policy · academic reports</p><h2 id="report-term-settings-title">Report term settings</h2><p>{scopedCampus ? `You can update only the ${scopeLabel} reopening date and fee schedule.` : 'Set official report-book dates and fee rules for Junior and Senior without mixing their policies.'}</p></div><div className="report-policy-scope"><span>Editing scope</span><strong>{scopeLabel}</strong><small>{`Term ${term} · ${year}`}</small></div></header>{!separateDatesAvailable && <PortalNotice>Campus-specific dates will save as one school-wide date until the supplied Supabase migration is applied.</PortalNotice>}{error && <PortalNotice tone="error">{error}</PortalNotice>}{notice && <PortalNotice>{notice}</PortalNotice>}<div className="report-policy-cycle"><label>Report year<input type="number" min="2020" value={year} onChange={event => setYear(event.target.value)} required /></label><label>Report term<select value={term} onChange={event => setTerm(event.target.value)}><option value="1">Term 1</option><option value="2">Term 2</option><option value="3">Term 3</option></select></label><p>The controls below change official values for this reporting cycle only.</p></div><section className="report-policy-dates"><header><div><p className="eyebrow">Report calendar</p><h3>Next-term reopening dates</h3><p>Shown on the printed report books for the selected campus.</p></div><button type="button" className="btn secondary" onClick={saveDates} disabled={saving}>{saving ? 'Saving…' : 'Save reopening dates'}</button></header><div>{visibleCampuses.map(campus => <label key={campus}>{campus === 'junior' ? 'Junior School' : 'Senior School'} next term begins<input type="date" value={nextTermDates[campus]} onChange={event => updateDate(campus, event.target.value)} disabled={!separateDatesAvailable && campus === 'senior'} /></label>)}</div></section><section className="report-policy-fees"><header><div><p className="eyebrow">Report release policy</p><h3>Fee schedules</h3><p>Enter the official next-term fee by class level. These values support report-book fee messaging.</p></div><span>{scopedCampus ? 'Campus-limited' : 'All-school policy'}</span></header>{visibleCampuses.map(campus => feeFields(`${campus === 'junior' ? 'Junior School' : 'Senior School'}`, campus === 'junior' ? JUNIOR_LEVELS : SENIOR_LEVELS))}</section><footer className="report-policy-actions"><button type="button" className="btn secondary" onClick={onClose}>Back to dashboard</button><button type="button" className="btn primary" onClick={saveFees} disabled={saving}>{saving ? 'Saving official fees…' : 'Save official fee schedule'}</button></footer></section>
}
