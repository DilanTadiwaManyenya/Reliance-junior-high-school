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
  const [resumingSetup, setResumingSetup] = useState(false)
  const [selected, setSelected] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [copyNotice, setCopyNotice] = useState('')
  const [launchNotice, setLaunchNotice] = useState('')
  const setupKey = useRef(null)
  const verificationCode = useRef(null)
  const copySetupKey = async () => {
    setCopyNotice('')
    try {
      await navigator.clipboard.writeText(pending.totp.secret)
      setCopyNotice('Setup key copied. Paste it into your authenticator app.')
      verificationCode.current?.scrollIntoView({block:'center',behavior:'smooth'})
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
        const settings = await bounded(supabase.from('portal_security_settings').select('require_admin_mfa').eq('id', 1).single())
        if (settings.error || typeof settings.data?.require_admin_mfa !== 'boolean') throw new Error('Unable to check sign-in requirements. Please retry.')
        if (!settings.data.require_admin_mfa) { if (alive) setStatus('ready'); return }
        const assurance = await bounded(supabase.auth.mfa.getAuthenticatorAssuranceLevel())
        if (assurance.error) throw assurance.error
        if (assurance.data?.currentLevel === 'aal2') { if (alive) setStatus('ready'); return }
        const list = await bounded(supabase.auth.mfa.listFactors())
        if (list.error) throw list.error
        if (!alive) return
        const verified = (list.data?.totp ?? []).filter(factor => factor.status === 'verified')
        const all = list.data?.all ?? []
        const unfinished = all.filter(factor => factor.factor_type === 'totp' && factor.status === 'unverified' && factor.friendly_name?.startsWith('Reliance admin '))
          .sort((a,b) => String(b.created_at || b.friendly_name).localeCompare(String(a.created_at || a.friendly_name)))[0]
        setFactors(all)
        setResumingSetup(!verified.length && Boolean(unfinished))
        setSelected(verified[0]?.id ?? unfinished?.id ?? '')
        setStatus(verified.length || unfinished ? 'verify' : 'enrol')
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
      setPending(result.data); setResumingSetup(false); setSelected(result.data.id); setCode(''); setCopyNotice(''); setLaunchNotice(''); setStatus('verify')
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
      setPending(null); setResumingSetup(false); setCode(''); setStatus('ready')
    } catch (failure) { setCode(''); setError(failure.message || 'Code not accepted. Try the current code from your app.') }
    finally { setBusy(false) }
  }
  if (status === 'ready') return children
  const authenticatorUri = pending?.totp?.uri?.startsWith('otpauth://totp/') ? pending.totp.uri : null
  const verified = factors.filter(factor => factor.factor_type === 'totp' && factor.status === 'verified')
  return <section className="portal-auth admin-mfa" aria-busy={busy || status === 'loading'}><div className="portal-auth-card"><p className="eyebrow">Admin account security</p><h1>{resumingSetup ? 'Finish authenticator setup' : pending || status === 'enrol' ? 'Set up two-factor authentication' : 'Verify your sign-in'}</h1><p>Admin access requires a code from your authenticator app after signing in with your password.</p>{error && <PortalNotice tone="error">{error}</PortalNotice>}
    {status === 'loading' && <p role="status">Checking your secure sign-in…</p>}
    {resumingSetup && <p>Your unfinished setup is still available. If you already added Reliance to your authenticator, enter its current six-digit code below. You do not need to copy the setup key again.</p>}
    {status === 'error' && <button className="btn primary" onClick={() => { setError(''); setStatus('loading'); setRevision(value => value + 1) }}>Try again</button>}
    {(status === 'enrol' || pending) && <section className="admin-mfa-install" aria-label="Install an authenticator app"><h2>1. Install the free app</h2><p>Already have Google Authenticator or Microsoft Authenticator? Use your existing app. Otherwise, choose your phone below.</p><a className="btn secondary" href="https://play.google.com/store/apps/details?id=com.google.android.apps.authenticator2" target="_blank" rel="noopener noreferrer">Install Google Authenticator for Android</a><a className="btn secondary" href="https://apps.apple.com/app/google-authenticator/id388497605" target="_blank" rel="noopener noreferrer">Install Google Authenticator for iPhone</a><p className="muted">Opens the official app store in a new tab. Install the app, then return to this portal tab to finish setup.</p><h2>2. Connect your Reliance account</h2></section>}
    {status === 'enrol' && <><p>This uses free app-generated codes. No Twilio account or paid SMS service is needed.</p><p>Once your app is installed, choose Set up authenticator below. Then choose Open authenticator app to connect on this phone, or scan the QR code using another device. Keep access to the app: you will need its codes for future sign-ins.</p><button className="btn primary" disabled={busy} onClick={enrol}>{busy ? 'Starting setup…' : 'Set up authenticator'}</button></>}
    {authenticatorUri && <div className="admin-mfa-launch"><p>Already installed on this phone?</p><a className="btn primary" href={authenticatorUri} referrerPolicy="no-referrer" onClick={() => setLaunchNotice('If your app opens, confirm adding the Reliance account, then return here with its six-digit code. If nothing opens, use Copy setup key below and add it in your app manually.')}>Open authenticator app</a><p>This opens a compatible app to add your Reliance account. Your phone may ask which authenticator to use.</p>{launchNotice && <p role="status">{launchNotice}</p>}</div>}
    {pending && <div className="admin-mfa-setup"><p>Scan this QR code with your authenticator app, then enter its six-digit code below.</p><img src={pending.totp.qr_code} alt="Authenticator setup QR code" /><details><summary>On the same phone? Copy a setup key</summary><p>This key is generated for you. Copy it into Google Authenticator or Microsoft Authenticator; you do not type into this field.</p><label>Setup key<input ref={setupKey} readOnly value={pending.totp.secret} autoComplete="off" autoCapitalize="none" spellCheck={false} onClick={event => event.currentTarget.select()} /></label><button type="button" className="btn secondary" onClick={copySetupKey}>Copy setup key</button>{copyNotice && <p role="status">{copyNotice}</p>}<p>In your authenticator app, add an account using a setup key. Name it Reliance Learning Centre and choose time-based codes. Return here and type the app’s six-digit code in the field below. Keep this key private.</p></details></div>}
    {status === 'verify' && <form className="form" onSubmit={verify}>{pending && <h2>3. Enter the code from your app</h2>}{!pending && verified.length > 1 && <label>Authenticator<select value={selected} onChange={event => setSelected(event.target.value)}>{verified.map(factor => <option key={factor.id} value={factor.id}>{factor.friendly_name || 'Authenticator'}</option>)}</select></label>}<label>Six-digit code<input ref={verificationCode} type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6} pattern="[0-9]{6}" value={code} onChange={event => setCode(event.target.value.replace(/\D/g, ''))} required /></label><button className="btn primary" disabled={busy || !selected}>{busy ? 'Verifying…' : 'Verify and continue'}</button></form>}
    {status === 'verify' && <p className="muted">Only the six-digit code changes. If it changes before you return, enter the newest one. Keep your phone’s date and time set to automatic.</p>}
    {resumingSetup && <details><summary>Haven’t added Reliance to your app yet?</summary><p>The setup key cannot be displayed again after a reload. Restart only if you have not added this account. A new setup replaces the previous key.</p><button type="button" className="btn secondary" disabled={busy} onClick={() => { setResumingSetup(false); setPending(null); setSelected(''); setCode(''); setError(''); setStatus('enrol') }}>Review starting a new setup</button></details>}
    <p className="muted">Lost access to your authenticator? Contact the school’s authorised system owner for identity-checked recovery. Password reset does not remove two-factor authentication.</p><button className="btn secondary" disabled={busy} onClick={() => { setPending(null); setCode(''); signOut().catch(failure => setError(failure.message || 'Unable to sign out. Try again.')) }}>Sign out</button>
  </div></section>
}
