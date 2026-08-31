import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import './portal.css'
import './portalPolish.css'
import './staffPortal.css'
import './feesDashboard.css'
import App from './App'
import { AuthProvider } from './context/AuthProvider'

// TEMP DEBUG - remove after confirming env vars load
console.log('Supabase environment configuration', {
  url: import.meta.env.VITE_SUPABASE_URL,
  anonKeyLength: import.meta.env.VITE_SUPABASE_ANON_KEY?.length ?? 0,
})

createRoot(document.getElementById('root')).render(<StrictMode><BrowserRouter><AuthProvider><App /></AuthProvider></BrowserRouter></StrictMode>)
