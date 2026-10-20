import { useEffect, useState } from 'react'
import './connectionStatus.css'

export default function ConnectionStatus({ enabled = true }) {
  const [connection, setConnection] = useState(() => navigator.onLine ? 'online' : 'offline')

  useEffect(() => {
    let timer
    const offline = () => { clearTimeout(timer); setConnection('offline') }
    const online = () => {
      setConnection('restored')
      clearTimeout(timer)
      timer = setTimeout(() => setConnection('online'), 7000)
    }
    window.addEventListener('offline', offline)
    window.addEventListener('online', online)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('offline', offline)
      window.removeEventListener('online', online)
    }
  }, [])

  if (!enabled || connection === 'online') return null
  return <div className={`connection-status ${connection}`} role="status" aria-live="polite">
    {connection === 'offline'
      ? 'Your device reports that it is offline. Changes cannot be saved until the connection returns. Check an interrupted action’s status before retrying.'
      : 'Your device reports that the connection is back. Check any interrupted action before retrying it.'}
  </div>
}
