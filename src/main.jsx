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


createRoot(document.getElementById('root')).render(<StrictMode><BrowserRouter><AuthProvider><App /></AuthProvider></BrowserRouter></StrictMode>)
