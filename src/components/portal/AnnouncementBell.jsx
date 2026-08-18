import { useEffect, useState } from 'react'
import { FiBell } from 'react-icons/fi'
import { useAuth } from '../../context/useAuth'

const relative = (value) => { const n = Math.max(0, Date.now() - new Date(value)); const m = Math.floor(n / 60000); return m < 1 ? 'Just now' : m < 60 ? `${m}m ago` : m < 1440 ? `${Math.floor(m / 60)}h ago` : `${Math.floor(m / 1440)}d ago` }
export default function AnnouncementBell() {
  const { supabase, user } = useAuth(); const [items, setItems] = useState([]); const [open, setOpen] = useState(false)
  const load = async () => { const { data } = await supabase.from('announcements').select('*, announcement_reads!left(user_id)').order('created_at', { ascending: false }).limit(8); setItems((data ?? []).map(a => ({ ...a, read: (a.announcement_reads ?? []).some(r => r.user_id === user.id) }))) }
  useEffect(() => { if (supabase && user) load() }, [supabase, user])
  const view = async (item) => { if (!item.read) await supabase.from('announcement_reads').upsert({ announcement_id: item.id, user_id: user.id }, { onConflict: 'announcement_id,user_id' }); await load(); window.alert(`${item.title}\n\n${item.body}`) }
  const unread = items.filter(i => !i.read).length
  return <div className="announcement-bell"><button className="portal-bell" aria-label="Announcements" onClick={() => setOpen(v => !v)}><FiBell />{unread > 0 && <b>{unread}</b>}</button>{open && <div className="announcement-dropdown">{items.length ? items.map(item => <button className={!item.read ? 'unread' : ''} key={item.id} onClick={() => view(item)}><span><strong>{item.title}</strong><em className={`announcement-category ${item.category}`}>{item.category}</em></span><small>{relative(item.created_at)}</small></button>) : <p className="muted">No announcements yet</p>}</div>}</div>
}
