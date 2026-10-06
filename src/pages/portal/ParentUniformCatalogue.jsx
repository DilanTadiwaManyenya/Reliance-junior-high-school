import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import ParentUniformShop from '../../components/portal/ParentUniformShop'
import PortalNotice from '../../components/portal/PortalNotice'
import { useAuth } from '../../context/useAuth'

export default function ParentUniformCatalogue() {
  const { supabase, user } = useAuth()
  const [searchParams] = useSearchParams()
  const [students, setStudents] = useState([])
  const [selectedId, setSelectedId] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    const load = async () => {
      const { data, error: linkError } = await supabase.from('parent_student').select('student:students(*)').eq('parent_id', user.id).not('verified_at', 'is', null)
      if (!active) return
      if (linkError) setError(linkError.message)
      const linked = data?.map(row => row.student).filter(Boolean) ?? []
      setStudents(linked)
      const requested = searchParams.get('learner')
      setSelectedId(linked.some(student => student.id === requested) ? requested : linked[0]?.id ?? '')
      setLoading(false)
    }
    load()
    return () => { active = false }
  }, [searchParams, supabase, user])

  const student = students.find(row => row.id === selectedId)
  if (loading) return <section className="section white"><div className="container portal-content">Loading uniform catalogue…</div></section>
  return <section className="section white"><div className="container portal-content"><Link className="parent-catalogue-back" to="/portal/dashboard">← Back to dashboard</Link><div className="parent-catalogue-heading"><div><p className="eyebrow">School shop</p><h1>Uniform catalogue</h1><p className="muted">Choose the items your learner needs, then submit an order for school verification and collection.</p></div>{students.length > 1 && <label className="portal-switcher">Buying for<select value={selectedId} onChange={event => setSelectedId(event.target.value)}>{students.map(row => <option key={row.id} value={row.id}>{row.full_name} · {row.class_level} {row.class_stream}</option>)}</select></label>}</div>{error && <PortalNotice tone="error">{error}</PortalNotice>}{!student && !error && <PortalNotice tone="error">No verified learner connection is available for this account.</PortalNotice>}{student?.status !== 'active' && <PortalNotice tone="error">Uniform orders are only available for actively enrolled learners.</PortalNotice>}{student?.status === 'active' && <ParentUniformShop supabase={supabase} parentId={user.id} student={student} />}</div></section>
}
