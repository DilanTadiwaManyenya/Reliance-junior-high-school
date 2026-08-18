import { Outlet } from 'react-router-dom'
import PortalHeader from './PortalHeader'
import { motion } from 'framer-motion'

export default function PortalLayout() { return <div className="portal-shell"><PortalHeader /><motion.main initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.28, ease: 'easeOut' }}><Outlet /></motion.main></div> }
