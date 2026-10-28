import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import ParentUniformShop from '../../components/portal/ParentUniformShop'
import PortalNotice from '../../components/portal/PortalNotice'
import { useAuth } from '../../context/useAuth'

export default function ParentUniformCatalogue() {
  const { supabase, user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [students, setStudents] = useState([])
  const [selectedId, setSelectedId] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)

  useEffect(() => {
    let active = true
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15000)
    const load = async () => {
      setLoading(true)
      setError('')
      try {
        const { data, error: linkError } = await supabase.from('parent_student').select('student:students(*)').eq('parent_id', user.id).not('verified_at', 'is', null).abortSignal(controller.signal)
        if (linkError) throw linkError
        if (!active) return
        const linked = data?.map(row => row.student).filter(Boolean) ?? []
        setStudents(linked)
        const requested = searchParams.get('learner')
        setSelectedId(linked.some(student => student.id === requested) ? requested : linked[0]?.id ?? '')
      } catch {
        if (active) {
          setStudents([])
          setSelectedId('')
          setError('We could not load your verified learner connections. Check your connection and try again.')
        }
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => { active = false; clearTimeout(timeout); controller.abort() }
  }, [searchParams, supabase, user.id, revision])

  const student = students.find(row => row.id === selectedId)
  if (loading) return <section className="section white"><div className="container portal-content"><p role="status">Loading uniform catalogue…</p></div></section>
  const selectStudent = id => {
    const next = new URLSearchParams(searchParams)
    next.set('learner', id)
    setSelectedId(id)
    setSearchParams(next, { replace: true })
  }

  return <section className="section white"><div className="container portal-content"><Link className="parent-catalogue-back" to={selectedId ? `/portal/dashboard?learner=${encodeURIComponent(selectedId)}` : '/portal/dashboard'}>← Back to dashboard</Link><div className="parent-catalogue-heading"><div><p className="eyebrow">School shop</p><h1>Uniform catalogue</h1><p className="muted">Choose the items your learner needs, then submit an order for school verification and collection.</p></div>{students.length > 1 && <label className="portal-switcher">Buying for<select value={selectedId} onChange={event => selectStudent(event.target.value)}>{students.map(row => <option key={row.id} value={row.id}>{row.full_name} · {row.class_level} {row.class_stream}</option>)}</select></label>}</div>{error && <PortalNotice tone="error">{error} <button type="button" className="btn secondary" onClick={() => setRevision(value => value + 1)}>Retry learner connections</button></PortalNotice>}{!student && !error && <PortalNotice tone="error">No verified learner connection is available for this account.</PortalNotice>}{student && <ParentUniformShop supabase={supabase} parentId={user.id} student={student} />}</div></section>
}
