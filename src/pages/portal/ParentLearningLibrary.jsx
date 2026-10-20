import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../context/useAuth'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import PortalNotice from '../../components/portal/PortalNotice'
import ParentLibraryResources from '../../components/portal/ParentLibraryResources'
import ParentSchoolUpdates from '../../components/portal/ParentSchoolUpdates'
import '../../components/portal/parentLearningLibrary.css'

export default function ParentLearningLibrary({ updates = false }) {
  const { supabase, user } = useAuth()
  const [params, setParams] = useSearchParams()
  const [revision, setRevision] = useState(0)
  const [links, setLinks] = useState({ key: '', students: [], error: '' })
  const key = `${user.id}:${revision}`
  useEffect(() => {
    let active = true
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 15000)
    supabase.from('parent_student').select('student:students(id,full_name,campus,class_level,class_stream,status)')
      .eq('parent_id', user.id).not('verified_at', 'is', null).order('created_at').abortSignal(controller.signal)
      .then(({ data, error }) => {
        if (active) setLinks({ key, students: error ? [] : (data || []).map(row => row.student).filter(Boolean), error: error ? 'Could not load your verified learner connections. Please retry.' : '' })
      }).catch(() => { if (active) setLinks({ key, students: [], error: 'Could not load your learner connections. Check your connection and retry.' }) })
      .finally(() => clearTimeout(timer))
    return () => { active = false; clearTimeout(timer); controller.abort() }
  }, [supabase, user.id, key])
  const students = links.key === key ? links.students : []
  const requested = params.get('learner')
  const student = requested ? students.find(row => row.id === requested) : students[0]
  useEffect(() => {
    if (!requested && student?.id) setParams(previous => { const next = new URLSearchParams(previous); next.set('learner', student.id); return next }, { replace: true })
  }, [requested, student?.id, setParams])
  const changeLearner = id => setParams(new URLSearchParams({ learner: id }))
  return <section className="section white"><div className="container portal-content parent-library">
    <Link className="parent-library-back" to={student ? `/portal/dashboard?learner=${encodeURIComponent(student.id)}` : '/portal/dashboard'}>← Back to dashboard</Link>
    <header className="parent-library-heading"><div><p className="eyebrow">{updates ? 'School updates' : 'Learning at home'}</p><h1>{updates ? 'Newsletters and announcements' : 'Learning library'}</h1><p>{updates ? 'News from your child’s campus, grade or form.' : 'Notes and learning files shared by your child’s teachers.'}</p></div><Button type="button" variant="secondary" onClick={() => setRevision(value => value + 1)}>Refresh learner connections</Button></header>
    {links.key !== key ? <p role="status">Loading verified learner connections…</p> : links.error ? <PortalNotice tone="error">{links.error} <Button type="button" variant="secondary" onClick={() => setRevision(value => value + 1)}>Retry learner connections</Button></PortalNotice> : !students.length ? <Card><h2>No verified learner connection</h2><p>Contact the school office to connect your child to your parent account.</p></Card> : <>
      <label className="parent-library-learner">Viewing learner<select aria-label="Viewing learner" value={student?.id || ''} onChange={event => changeLearner(event.target.value)}>{!student && <option value="">Choose a linked learner</option>}{students.map(row => <option key={row.id} value={row.id}>{row.full_name} · {row.class_level}{row.class_stream ? ` · ${row.class_stream}` : ''}</option>)}</select></label>
      {!student ? <PortalNotice tone="error">That learner is not linked to this account. Choose one of your verified learners above.</PortalNotice> : student.status !== 'active' ? <Card><h2>{updates ? 'School updates are for currently enrolled learners' : 'Learning files are for currently enrolled learners'}</h2><p>You can still view this learner’s historical records from the dashboard.</p></Card> : updates ? <ParentSchoolUpdates key={student.id} supabase={supabase} student={student} /> : <ParentLibraryResources key={student.id} supabase={supabase} student={student} params={params} setParams={setParams} onRefreshLinks={() => setRevision(value => value + 1)} />}
    </>}
  </div></section>
}
