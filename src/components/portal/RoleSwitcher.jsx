import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/useAuth'
import { portalDestinationForRole } from '../../lib/portalRedirect'

const labels = { admin: 'Admin', principal: 'Principal', teacher: 'Teacher', accountant: 'Accountant' }

export default function RoleSwitcher() {
  const { roles, activeRole, setActiveRole } = useAuth()
  const navigate = useNavigate()
  const [switching, setSwitching] = useState(false)
  const [error, setError] = useState('')
  if (roles.length < 2) return null

  const changeRole = async event => {
    const role = event.target.value
    setSwitching(true)
    setError('')
    try {
      await setActiveRole(role)
      navigate(portalDestinationForRole(role) || '/portal/dashboard')
    } catch {
      setError('We could not switch roles. Please try again.')
    } finally { setSwitching(false) }
  }
  return <label className="top-bar-role-switcher">Viewing as: <select value={activeRole || ''} aria-label="Active portal role" aria-busy={switching} disabled={switching} onChange={changeRole}>{roles.map(role => <option key={role} value={role}>{labels[role] || role}</option>)}</select>{error && <span role="alert">{error}</span>}</label>
}
