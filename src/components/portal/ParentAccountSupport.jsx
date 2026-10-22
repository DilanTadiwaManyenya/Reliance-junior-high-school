import { useCallback, useEffect, useMemo, useState } from 'react'
import Button from '../ui/Button'
import Card from '../ui/Card'
import PortalNotice from './PortalNotice'
import { invokeEdgeFunction } from '../../lib/edgeFunction'
import { logActivity } from '../../lib/logActivity'

export default function ParentAccountSupport({ supabase, user, profile }) {
  const [accounts, setAccounts] = useState([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [selected, setSelected] = useState(null)
  const [password, setPassword] = useState('')
  const [saving, setSaving] = useState(false)

  const loadAccounts = useCallback(async () => {
    setLoading(true)
    setError('')
    const { data, error: requestError } = await supabase.rpc('parent_account_support')
    if (requestError) setError(requestError.message || 'Unable to load parent accounts.')
    else setAccounts(data || [])
    setLoading(false)
  }, [supabase])

  useEffect(() => { void Promise.resolve().then(loadAccounts) }, [loadAccounts])

  const visibleAccounts = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return accounts
    return accounts.filter(account => [account.parent_name, account.phone_number, account.child_admission_number, account.learner_name, account.class_level, account.class_stream]
      .some(value => String(value || '').toLowerCase().includes(needle)))
  }, [accounts, query])

  const resetPassword = async event => {
    event.preventDefault()
    if (!selected || password.length < 8) return
    setSaving(true)
    setError('')
    setNotice('')
    const { data, error: resetError } = await invokeEdgeFunction(supabase, 'reset-parent-password', { targetUserId: selected.parent_user_id, newPassword: password })
    if (resetError || data?.error) {
      setError(data?.error || resetError?.message || 'Unable to reset this parent password.')
      setSaving(false)
      return
    }
    logActivity(supabase, user, profile, { actionType: 'update', description: `Reset parent portal password for ${selected.parent_name || selected.phone_number}`, targetTable: 'parent_accounts', targetId: selected.parent_user_id })
    setNotice(`Temporary password set for ${selected.parent_name || selected.phone_number}. Share it privately; they will be asked to choose a new password at sign-in.`)
    setSelected(null)
    setPassword('')
    setSaving(false)
  }

  return <div className="dash-section parent-account-support">
    <div className="dash-page-header">
      <div><p className="eyebrow">Account support</p><h1>Parent accounts</h1><p className="dash-page-sub">Find a linked parent account and help restore access. Temporary passwords are never shown after reset.</p></div>
    </div>
    {error && <PortalNotice tone="error">{error}</PortalNotice>}
    {notice && <PortalNotice>{notice}</PortalNotice>}
    {selected && <Card className="parent-account-reset-card">
      <form className="form" onSubmit={resetPassword}>
        <h2>Reset parent password</h2>
        <p>For {selected.parent_name || selected.phone_number} · {selected.learner_name || selected.child_admission_number}</p>
        <label>Temporary password<input type="password" autoComplete="new-password" minLength={8} value={password} onChange={event => setPassword(event.target.value)} required /></label>
        <p className="muted">Use a password of at least 8 characters. Give it to the parent privately; they must replace it when they sign in.</p>
        <div className="portal-action-row"><Button type="submit" disabled={saving || password.length < 8}>{saving ? 'Resetting…' : 'Set temporary password'}</Button><Button type="button" variant="secondary" disabled={saving} onClick={() => { setSelected(null); setPassword('') }}>Cancel</Button></div>
      </form>
    </Card>}
    <Card>
      <div className="parent-account-toolbar">
        <label className="portal-inline-search">Search parent or learner<input value={query} onChange={event => setQuery(event.target.value)} placeholder="Name, phone or admission number" /></label>
        <span className="muted">{loading ? 'Loading accounts…' : `${visibleAccounts.length} parent account${visibleAccounts.length === 1 ? '' : 's'}`}</span>
        <Button type="button" variant="secondary" onClick={loadAccounts} disabled={loading}>Refresh</Button>
      </div>
      {loading ? <p role="status">Loading parent accounts…</p> : visibleAccounts.length ? <div className="parent-account-list">
        {visibleAccounts.map((account, index) => <article className="parent-account-card" key={`${account.parent_user_id}:${account.child_admission_number}:${index}`}>
          <div className="parent-account-identity"><strong>{account.parent_name || 'Parent account'}</strong><span>{account.phone_number}</span></div>
          <div className="parent-account-learner"><span>Learner</span><strong>{account.learner_name || 'Learner record not found'}</strong><small>{account.class_level ? `${account.class_level}${account.class_stream ? ` · ${account.class_stream}` : ''}` : account.child_admission_number}{account.campus ? ` · ${account.campus === 'junior' ? 'Junior' : 'Senior'} School` : ''}</small></div>
          <span className={`class-status ${account.verified ? 'is-active' : 'is-inactive'}`}>{account.verified ? 'Verified' : 'Needs verification'}</span>
          <Button type="button" variant="secondary" onClick={() => { setSelected(account); setPassword(''); setError(''); setNotice('') }}>Help with sign-in</Button>
        </article>)}
      </div> : <p className="portal-notice">{accounts.length ? 'No parent accounts match this search.' : 'No parent accounts are available in your campus scope yet.'}</p>}
    </Card>
  </div>
}
