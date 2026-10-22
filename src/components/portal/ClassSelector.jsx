import { useEffect, useState, useMemo } from 'react'

const SESSION_KEY = 'reliance_active_portal_class'

export function parseClassKey(key) {
  if (!key || key === 'ALL') return { level: null, stream: null }
  if (key.includes(':')) {
    const [level, stream] = key.split(':')
    return { level, stream: stream || null }
  }
  const lastSpaceIdx = key.lastIndexOf(' ')
  if (lastSpaceIdx > 0) {
    return {
      level: key.slice(0, lastSpaceIdx),
      stream: key.slice(lastSpaceIdx + 1)
    }
  }
  return { level: key, stream: null }
}

/**
 * ClassSelector Component
 * 
 * Shared reusable class selector / switcher.
 * - Admin/Accountant: Shows all distinct classes or "All classes".
 * - Multi-class Teacher: Switcher between assigned classes.
 * - Single-class Teacher: Shows static badge of assigned class.
 * - Persists active selection in sessionStorage across Roster, Dashboard, Attendance, Fees, Academic Records.
 */
export default function ClassSelector({ 
  role = 'admin', 
  assignedClasses = [], // Array of { class_level, class_stream } for teachers
  allClasses = [],      // Array of strings e.g. ["Form 1 Green", "Form 1 White"] or objects for Admin
  activeClassKey, 
  onClassChange,
  showAllOption = true,
  allOptionLabel = 'All classes',
  // Campus Administrators never choose a campus in this control. Their
  // permitted campus is established by their profile and by Supabase RLS.
  campusScope = 'all',
  storageScope = 'default',
}) {
  const sessionKey = `${SESSION_KEY}:${storageScope}:${role}:${campusScope}`
  const isTeacher = role === 'teacher'
  const isCampusLocked = ['junior', 'senior'].includes(campusScope)

  // Formatted teacher class options
  const teacherOptions = useMemo(() => {
    if (!isTeacher) return []
    return assignedClasses.map(c => ({
      key: `${c.class_level}:${c.class_stream || ''}`,
      label: `${c.class_level} ${c.class_stream || ''}`.trim(),
      level: c.class_level,
      stream: c.class_stream
    })).sort((a, b) => a.label.localeCompare(b.label))
  }, [isTeacher, assignedClasses])

  const [campusFilter, setCampusFilter] = useState('all')
  const displayCampusFilter = isCampusLocked ? campusScope : campusFilter

  // Formatted admin class options
  const adminOptions = useMemo(() => {
    if (isTeacher) return []
    let options = allClasses.map(c => {
      let level
      let stream
      if (typeof c === 'object' && c !== null && (c.class_level || c.level)) {
        level = c.class_level || c.level
        stream = c.class_stream || c.stream || null
      } else if (typeof c === 'string') {
        const parsed = parseClassKey(c)
        level = parsed.level
        stream = parsed.stream || null
      } else {
        level = String(c)
        stream = null
      }
      
      return {
        key: stream ? `${level}:${stream}` : level,
        label: `${level} ${stream || ''}`.trim(),
        level,
        stream,
        campus: c?.campus || null,
      }
    })

    const effectiveCampusFilter = displayCampusFilter

    if (effectiveCampusFilter === 'junior') {
      options = options.filter(o => o.campus ? o.campus === 'junior' : (o.level.includes('Grade') || o.level.includes('ECD')))
    } else if (effectiveCampusFilter === 'senior') {
      options = options.filter(o => o.campus ? o.campus === 'senior' : (o.level.includes('Form') || o.level.includes('Six')))
    }

    return [...new Map(options.map(option => [option.key, option])).values()]
  }, [isTeacher, allClasses, campusFilter, campusScope, isCampusLocked, displayCampusFilter])

  // Auto-initialize active selection if not set or invalid
  useEffect(() => {
    if (isTeacher) {
      if (!teacherOptions.length) return
      // A selection made in the markbook or class workspace is authoritative.
      // Restoring an older session choice here used to switch ECD B back to A.
      if (teacherOptions.some(option => option.key === activeClassKey)) {
        sessionStorage.setItem(sessionKey, activeClassKey)
        return
      }
      
      const stored = sessionStorage.getItem(sessionKey)
      const validStored = teacherOptions.find(o => o.key === stored)
      
      if (validStored) {
        if (activeClassKey !== validStored.key) {
          onClassChange(validStored.key, validStored)
        }
      } else {
        const defaultClass = teacherOptions[0]
        sessionStorage.setItem(sessionKey, defaultClass.key)
        if (activeClassKey !== defaultClass.key) {
          onClassChange(defaultClass.key, defaultClass)
        }
      }
    } else {
      // Admin / Accountant mode
      const stored = sessionStorage.getItem(sessionKey)
      if (stored) {
        if (stored === 'ALL') {
          if (activeClassKey !== 'ALL') onClassChange('ALL')
        } else {
          // If the stored value doesn't match the current filter, switch to 'ALL'
          const directMatch = adminOptions.find(o => o.key === stored)
          if (directMatch) {
            if (activeClassKey !== directMatch.key) onClassChange(directMatch.key)
          } else {
            // We changed filter and active class is not in the list anymore
            if (activeClassKey !== 'ALL') onClassChange('ALL')
          }
        }
      }
    }
  }, [isTeacher, teacherOptions, adminOptions, campusFilter])

  const handleCampusChange = (nextCampus) => {
    setCampusFilter(nextCampus)
    sessionStorage.setItem(sessionKey, 'ALL')
    onClassChange('ALL')
  }

  const handleSelect = (key) => {
    sessionStorage.setItem(sessionKey, key)
    const opt = teacherOptions.find(o => o.key === key) || adminOptions.find(o => o.key === key)
    if (!isTeacher && opt?.campus && !isCampusLocked && campusFilter !== opt.campus) setCampusFilter(opt.campus)
    onClassChange(key, opt)
  }

  if (isTeacher) {
    if (teacherOptions.length === 0) {
      return (
        <div className="class-selector-bar teacher-bar empty">
          <span className="class-badge">No classes assigned</span>
        </div>
      )
    }

    if (teacherOptions.length === 1) {
      const single = teacherOptions[0]
      return (
        <div className="class-selector-bar teacher-bar single">
          <span className="class-label">Assigned class:</span>
          <span className="class-badge-active">{single.label}</span>
        </div>
      )
    }

    return (
      <div className="class-selector-bar teacher-bar multi">
        <label htmlFor="portal-class-switcher" className="class-switcher-label">
          Currently viewing:
        </label>
        <select
          id="portal-class-switcher"
          className="class-switcher-select"
          value={activeClassKey || teacherOptions[0]?.key || ''}
          onChange={(e) => handleSelect(e.target.value)}
        >
          {teacherOptions.map((opt) => (
            <option key={opt.key} value={opt.key}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    )
  }

  return (
    <div className="admin-class-selector-container">
      {isCampusLocked ? (
        <div className="campus-context-lock" aria-label={`Campus locked to ${campusScope} school`}>
          <span>Campus</span>
          <strong>{campusScope === 'junior' ? 'Junior School' : 'Senior School'}</strong>
        </div>
      ) : (
        <div className="campus-toggle" aria-label="Campus scope">
          <span>Campus</span>
          <button type="button" className={campusFilter === 'all' ? 'is-active' : ''} onClick={() => handleCampusChange('all')}>All school</button>
          <button type="button" className={campusFilter === 'junior' ? 'is-active' : ''} onClick={() => handleCampusChange('junior')}>Junior</button>
          <button type="button" className={campusFilter === 'senior' ? 'is-active' : ''} onClick={() => handleCampusChange('senior')}>Senior</button>
        </div>
      )}
      <div className="class-selector-bar admin-bar">
        <label htmlFor="admin-class-selector" className="class-switcher-label">
          Class scope
        </label>
        <select
          id="admin-class-selector"
          className="class-switcher-select"
          value={activeClassKey || (showAllOption ? 'ALL' : adminOptions[0]?.key || '')}
          onChange={(e) => handleSelect(e.target.value)}
        >
          {showAllOption && <option value="ALL">{allOptionLabel}</option>}
          {adminOptions.map((opt) => (
            <option key={opt.key} value={opt.key}>
              {displayCampusFilter === 'all' && opt.campus ? `${opt.label} · ${opt.campus === 'junior' ? 'Junior' : 'Senior'}` : opt.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}
