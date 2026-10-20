import { useAuth } from '../../context/useAuth'
import ParentLearningLibrary from './ParentLearningLibrary'
import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { newsletterRequest } from '../../lib/schoolNewsletters'
function StaffUpdates({ supabase }) {
  const [rows, setRows] = useState(null)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    let active = true
    newsletterRequest(supabase.from('announcements').select('id,title,body,category').eq('state', 'published').lte('published_at', new Date().toISOString()).or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`).order('pinned', { ascending: false }).order('published_at', { ascending: false }).limit(50))
      .then(data => { if (active) { setRows(data); setError('') } }).catch(error => { if (active) setError(error.message) })
    return () => { active = false }
  }, [supabase, revision])
  return <section className="section white"><div className="container portal-content"><h1>School updates</h1><Link to="/portal/staff">Return to staff workspace</Link><button className="btn secondary" onClick={() => setRevision(value => value + 1)}>Refresh updates</button>{error ? <p role="alert">{error}</p> : !rows ? <p role="status">Loading updates…</p> : rows.length ? rows.map(row => <article className="newsletter-card" key={row.id}><h2>{row.title}</h2><p>{row.category}</p><p className="newsletter-body">{row.body}</p></article>) : <p>No published updates.</p>}</div></section>
}
export default function Announcements() {
  const { activeRole, supabase } = useAuth()
  return activeRole === 'parent' ? <ParentLearningLibrary updates /> : <StaffUpdates supabase={supabase} />
}
