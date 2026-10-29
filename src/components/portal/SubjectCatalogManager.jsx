import { useCallback, useEffect, useMemo, useState } from 'react'
import './subjectCatalogManager.css'

const blankForm = { id: null, code: '', name: '', groups: [] }
const subjectCode = label => String(label || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 80)

export default function SubjectCatalogManager({ supabase }) {
  const [subjects, setSubjects] = useState([])
  const [groups, setGroups] = useState([])
  const [memberships, setMemberships] = useState([])
  const [form, setForm] = useState(blankForm)
  const [query, setQuery] = useState('')
  const [groupFilter, setGroupFilter] = useState('')
  const [showRetired, setShowRetired] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [subjectResult, groupResult, membershipResult] = await Promise.all([
        supabase.from('subject_catalog').select('id,subject_code,display_name,is_active').order('display_name'),
        supabase.from('curriculum_subject_groups').select('group_code,display_name,sort_order').order('sort_order'),
        supabase.from('subject_catalog_group_memberships').select('subject_id,group_code'),
      ])
      const failed = subjectResult.error || groupResult.error || membershipResult.error
      if (failed) throw new Error(failed.message || 'Could not load the subject catalog.')
      setSubjects(subjectResult.data || [])
      setGroups(groupResult.data || [])
      setMemberships(membershipResult.data || [])
    } catch (loadError) {
      setError(loadError.message || 'Could not load the subject catalog.')
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => { void load() }, [load])

  const membershipsBySubject = useMemo(() => {
    const map = new Map()
    for (const membership of memberships) {
      const subjectGroups = map.get(membership.subject_id) || []
      subjectGroups.push(membership.group_code)
      map.set(membership.subject_id, subjectGroups)
    }
    return map
  }, [memberships])

  const visibleSubjects = useMemo(() => subjects.filter(subject => {
    if (!showRetired && !subject.is_active) return false
    if (groupFilter && !(membershipsBySubject.get(subject.id) || []).includes(groupFilter)) return false
    return `${subject.display_name} ${subject.subject_code}`.toLowerCase().includes(query.trim().toLowerCase())
  }), [subjects, showRetired, groupFilter, membershipsBySubject, query])

  const editSubject = subject => {
    setError('')
    setNotice('')
    setForm({ id: subject.id, code: subject.subject_code, name: subject.display_name, groups: membershipsBySubject.get(subject.id) || [] })
  }

  const saveSubject = async event => {
    event.preventDefault()
    if (saving) return
    const cleanName = form.name.trim()
    if (cleanName.length < 2 || form.groups.length < 1) return setError('Enter a subject name and select at least one curriculum group.')
    setSaving(true)
    setError('')
    setNotice('')
    try {
      const { error: saveError } = await supabase.rpc('save_subject_catalog_entry', {
        p_subject_id: form.id,
        p_subject_code: form.id ? form.code : subjectCode(cleanName),
        p_display_name: cleanName,
        p_group_codes: form.groups,
      })
      if (saveError) throw saveError
      setForm(blankForm)
      setNotice(form.id ? 'Subject details and current allocation labels updated.' : 'Subject added to the selected curriculum groups.')
      await load()
    } catch (saveError) {
      setError(saveError.message || 'Could not save this subject.')
    } finally {
      setSaving(false)
    }
  }

  const setActive = async (subject, isActive) => {
    if (saving) return
    setSaving(true); setError(''); setNotice('')
    try {
      const { error: actionError } = await supabase.rpc('set_subject_catalog_active', { p_subject_id: subject.id, p_is_active: isActive })
      if (actionError) throw actionError
      setNotice(isActive ? `${subject.display_name} restored to the active catalog.` : `${subject.display_name} retired from new allocations.`)
      await load()
    } catch (actionError) {
      setError(actionError.message || 'Could not update this subject.')
    } finally { setSaving(false) }
  }

  const deleteSubject = async subject => {
    if (!window.confirm(`Permanently delete “${subject.display_name}” from the catalog? This is available only when no teacher allocation references it.`)) return
    if (saving) return
    setSaving(true); setError(''); setNotice('')
    try {
      const { error: deleteError } = await supabase.rpc('delete_unused_subject_catalog_entry', { p_subject_id: subject.id })
      if (deleteError) throw deleteError
      setNotice(`${subject.display_name} deleted from the unused catalog.`)
      if (form.id === subject.id) setForm(blankForm)
      await load()
    } catch (deleteError) {
      setError(deleteError.message || 'Could not delete this subject. Retire it if it still has allocations.')
    } finally { setSaving(false) }
  }

  return <section className="dash-section subject-catalog-manager">
    <header className="dash-page-header"><div><p className="eyebrow">Academic setup</p><h1 className="dash-page-title">Subject catalog</h1><p className="dash-page-sub">Manage official subject names and where they are offered. Existing saved report snapshots keep their recorded subject labels.</p></div></header>
    {notice && <p role="status" className="portal-notice">{notice}</p>}
    {error && <p role="alert" className="portal-notice error">{error}</p>}
    <form className="subject-catalog-form" onSubmit={saveSubject}>
      <div><p className="eyebrow">{form.id ? 'Edit subject' : 'New subject'}</p><h2>{form.id ? form.name || 'Subject details' : 'Add a subject'}</h2></div>
      <label>Official subject name<input required minLength={2} maxLength={120} value={form.name} onChange={event => setForm(value => ({ ...value, name: event.target.value }))} /></label>
      {form.id && <p className="subject-catalog-code">Stable code: <code>{form.code}</code></p>}
      <fieldset><legend>Curriculum groups</legend><div className="subject-catalog-groups">{groups.map(group => <label className="subject-catalog-group" key={group.group_code}><input type="checkbox" checked={form.groups.includes(group.group_code)} onChange={event => setForm(value => ({ ...value, groups: event.target.checked ? [...new Set([...value.groups, group.group_code])] : value.groups.filter(code => code !== group.group_code) }))} /><span>{group.display_name}</span></label>)}</div></fieldset>
      <p className="muted">Renaming updates current teacher allocation labels. Historical report snapshots stay as recorded.</p>
      <div className="portal-action-row"><button className="btn primary" type="submit" disabled={saving || loading}>{saving ? 'Saving…' : form.id ? 'Save subject' : 'Add subject'}</button>{form.id && <button className="btn secondary" type="button" disabled={saving} onClick={() => setForm(blankForm)}>Cancel edit</button>}</div>
    </form>
    <div className="subject-catalog-toolbar"><label>Search subjects<input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search by name or code" /></label><label>Curriculum group<select value={groupFilter} onChange={event => setGroupFilter(event.target.value)}><option value="">All groups</option>{groups.map(group => <option key={group.group_code} value={group.group_code}>{group.display_name}</option>)}</select></label><label className="subject-catalog-retired"><input type="checkbox" checked={showRetired} onChange={event => setShowRetired(event.target.checked)} />Show retired subjects</label><button type="button" className="btn secondary" onClick={() => void load()} disabled={loading}>Refresh</button></div>
    {loading ? <p role="status">Loading subject catalog…</p> : <div className="subject-catalog-list">{visibleSubjects.length ? visibleSubjects.map(subject => {
      const names = (membershipsBySubject.get(subject.id) || []).map(code => groups.find(group => group.group_code === code)?.display_name).filter(Boolean)
      return <article className={`subject-catalog-row${subject.is_active ? '' : ' is-retired'}`} key={subject.id}><div><h2>{subject.display_name}{!subject.is_active && <span className="subject-catalog-status">Retired</span>}</h2><p>{names.length ? names.join(' · ') : 'No curriculum group assigned'}<span className="subject-catalog-code"> · {subject.subject_code}</span></p></div><div className="portal-action-row"><button type="button" className="btn secondary" onClick={() => editSubject(subject)} disabled={saving}>Edit</button>{subject.is_active ? <button type="button" className="btn secondary" onClick={() => void setActive(subject, false)} disabled={saving}>Retire</button> : <button type="button" className="btn secondary" onClick={() => void setActive(subject, true)} disabled={saving}>Restore</button>}<button type="button" className="btn danger" onClick={() => void deleteSubject(subject)} disabled={saving}>Delete unused</button></div></article>
    }) : <p className="muted">No subjects match these filters.</p>}</div>}
  </section>
}
