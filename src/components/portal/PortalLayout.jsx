import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import PortalHeader from './PortalHeader'
import { motion, useReducedMotion } from 'framer-motion'
import { useAuth } from '../../context/useAuth'
import { PortalBrandCampusContext } from './PortalBrandCampusContext'

function learnerFromLocation(location) {
  return new URLSearchParams(location.search).get('learner')
    || location.pathname.match(/^\/portal\/learner\/([^/]+)/)?.[1]
    || null
}

export default function PortalLayout() {
  const reducedMotion = useReducedMotion()
  const { activeRole, profile, user, supabase } = useAuth()
  const location = useLocation()
  const pathname = location.pathname
  const search = location.search
  const learnerId = learnerFromLocation({ pathname, search })
  const parentCampusKey = `${user?.id || ''}:${learnerId || 'default'}`
  const [parentCampus, setParentCampus] = useState(null)
  const assignedCampus = ['junior', 'senior'].includes(profile?.campus) ? profile.campus : 'all'
  const campus = activeRole === 'parent'
    ? parentCampus?.key === parentCampusKey ? parentCampus.campus : 'all'
    : assignedCampus

  useEffect(() => {
    let current = true
    if (activeRole !== 'parent' || !user?.id || !supabase) return () => { current = false }
    let query = supabase.from('parent_student').select('student:students(campus)')
      .eq('parent_id', user.id).not('verified_at', 'is', null)
    if (learnerId) query = query.eq('student_id', learnerId)
    query.limit(1).then(({ data, error }) => {
      if (current && !error) {
        const learnerCampus = data?.[0]?.student?.campus
        setParentCampus({ key: parentCampusKey, campus: ['junior', 'senior'].includes(learnerCampus) ? learnerCampus : 'all' })
      }
    }).catch(error => console.warn('Could not load parent campus branding:', error))

    return () => { current = false }
  }, [activeRole, user?.id, supabase, parentCampusKey, learnerId])

  return <PortalBrandCampusContext.Provider value={campus}>
    <div className="portal-shell parent-portal-shell" data-campus={campus}>
      <PortalHeader />
      <motion.main initial={reducedMotion ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.28, ease: 'easeOut' }}><Outlet /></motion.main>
    </div>
  </PortalBrandCampusContext.Provider>
}
