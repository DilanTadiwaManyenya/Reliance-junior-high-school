import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../../context/useAuth'
import PortalNotice from './PortalNotice'
import './adminMfa.css'

const bounded = promise => {
  let timer
  return Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Connection timed out. Please try again.')), 12000) })]).finally(() => clearTimeout(timer))
}
export default function AdminMfaGate({ children }) {
  const { supabase, signOut } = useAuth()
  const [revision, setRevision] = useState(0)
  const [status, setStatus] = useState('loading')
  const [factors, setFactors] = useState([])
  const [pending, setPending] = useState(null)
  const [selected, setSelected] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [copyNotice, setCopyNotice] = useState('')
  const setupKey = useRef(null)
  const copySetupKey = async () => {
    setCopyNotice('')
    try {
      await navigator.clipboard.writeText(pending.totp.secret)
      setCopyNotice('Setup key copied. Paste it into your authenticator app.')
    } catch {
      setupKey.current?.focus()
      setupKey.current?.select()
      setCopyNotice('Copy is unavailable in this browser. Press and hold the selected key, then choose Copy.')
    }
  }
  useEffect(() => {
    let alive = true
    const check = async () => {
      try {
        const assurance = await bounded(supabase.auth.mfa.getAuthenticatorAssuranceLevel())
        if (assurance.error) throw assurance.error
        if (assurance.data?.currentLevel === 'aal2') { if (alive) setStatus('ready'); return }
        const list = await bounded(supabase.auth.mfa.listFactors())
        if (list.error) throw list.error
        if (!alive) return
        const verified = (list.data?.totp ?? []).filter(factor => factor.status === 'verified')
        setFactors(list.data?.all ?? [])
        setSelected(verified[0]?.id ?? '')
        setStatus(verified.length ? 'verify' : 'enrol')
      } catch (failure) { if (alive) { setError(failure.message || 'Unable to check two-factor authentication.'); setStatus('error') } }
    }
    check()
    return () => { alive = false }
  }, [supabase, revision])
  const enrol = async () => {
    setBusy(true); setError('')
    try {
      const latest = await bounded(supabase.auth.mfa.listFactors())
      if (latest.error) throw latest.error
      // Remove only abandoned unverified factors belonging to this portal setup.
      for (const factor of (latest.data?.all ?? []).filter(item => item.status === 'unverified' && item.friendly_name?.startsWith('Reliance admin '))) {
        const removed = await bounded(supabase.auth.mfa.unenroll({ factorId: factor.id }))
        if (removed.error) throw removed.error
      }
      const result = await bounded(supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: `Reliance admin ${Date.now()}`, issuer: 'Reliance Learning Centre' }))
      if (result.error) throw result.error
      setPending(result.data); setSelected(result.data.id); setCode(''); setStatus('verify')
    } catch (failure) { setError(failure.message || 'Unable to start setup.') }
    finally { setBusy(false) }
  }
  const verify = async event => {
    event.preventDefault(); setError('')
    if (!/^\d{6}$/.test(code)) { setError('Enter the six-digit code from your authenticator app.'); return }
    setBusy(true)
    try {
      const result = await bounded(supabase.auth.mfa.challengeAndVerify({ factorId: selected, code }))
      if (result.error) throw result.error
      const assurance = await bounded(supabase.auth.mfa.getAuthenticatorAssuranceLevel())
      if (assurance.error || assurance.data?.currentLevel !== 'aal2') throw new Error('Verification did not complete. Please try again.')
      setPending(null); setCode(''); setStatus('ready')
    } catch (failure) { setCode(''); setError(failure.message || 'Code not accepted. Try the current code from your app.') }
    finally { setBusy(false) }
  }
  if (status === 'ready') return children
  const verified = factors.filter(factor => factor.factor_type === 'totp' && factor.status === 'verified')
  return <section className="portal-auth admin-mfa" aria-busy={busy || status === 'loading'}><div className="portal-auth-card"><p className="eyebrow">Admin account security</p><h1>{pending || status === 'enrol' ? 'Set up two-factor authentication' : 'Verify your sign-in'}</h1><p>Admin access requires a code from your authenticator app after signing in with your password.</p>{error && <PortalNotice tone="error">{error}</PortalNotice>}
    {status === 'loading' && <p role="status">Checking your secure sign-in…</p>}
    {status === 'error' && <button className="btn primary" onClick={() => { setError(''); setStatus('loading'); setRevision(value => value + 1) }}>Try again</button>}
    {status === 'enrol' && <><p>This uses free app-generated codes. No Twilio account or paid SMS service is needed.</p><p>Open Google Authenticator or Microsoft Authenticator on your phone, then choose Set up authenticator below and scan the QR code. Keep access to the app: you will need its codes for future sign-ins.</p><button className="btn primary" disabled={busy} onClick={enrol}>{busy ? 'Starting setup…' : 'Set up authenticator'}</button></>}
    {pending && <div className="admin-mfa-setup"><p>Scan this QR code with your authenticator app, then enter its six-digit code below.</p><img src={pending.totp.qr_code} alt="Authenticator setup QR code" /><details><summary>On the same phone? Copy a setup key</summary><p>This key is generated for you. Copy it into Google Authenticator or Microsoft Authenticator; you do not type into this field.</p><label>Setup key<input ref={setupKey} readOnly value={pending.totp.secret} autoComplete="off" autoCapitalize="none" spellCheck={false} onClick={event => event.currentTarget.select()} /></label><button type="button" className="btn secondary" onClick={copySetupKey}>Copy setup key</button>{copyNotice && <p role="status">{copyNotice}</p>}<p>In your authenticator app, add an account using a setup key. Name it Reliance Learning Centre and choose time-based codes. Return here and type the app’s six-digit code in the field below. Keep this key private.</p></details></div>}
    {status === 'verify' && <form className="form" onSubmit={verify}>{!pending && verified.length > 1 && <label>Authenticator<select value={selected} onChange={event => setSelected(event.target.value)}>{verified.map(factor => <option key={factor.id} value={factor.id}>{factor.friendly_name || 'Authenticator'}</option>)}</select></label>}<label>Six-digit code<input type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6} pattern="[0-9]{6}" value={code} onChange={event => setCode(event.target.value.replace(/\D/g, ''))} required /></label><button className="btn primary" disabled={busy || !selected}>{busy ? 'Verifying…' : 'Verify and continue'}</button></form>}
    <p className="muted">Lost access to your authenticator? Contact the school’s authorised system owner for identity-checked recovery. Password reset does not remove two-factor authentication.</p><button className="btn secondary" disabled={busy} onClick={() => { setPending(null); setCode(''); signOut().catch(failure => setError(failure.message || 'Unable to sign out. Try again.')) }}>Sign out</button>
  </div></section>
}
