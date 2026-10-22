import { useEffect, useState, useMemo } from 'react'
import { canonicalizeClassLevel } from '../../data/classOptions'

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
  campusFilter: controlledCampusFilter,
  onCampusChange,
}) {
  const sessionKey = `${SESSION_KEY}:${storageScope}:${role}:${campusScope}`
  const isTeacher = role === 'teacher'
  const isCampusLocked = ['junior', 'senior'].includes(campusScope)
  const canonicalTeacherKey = (key) => {
    if (!key) return ''
    const { level, stream } = parseClassKey(key)
    return level ? `${canonicalizeClassLevel(level)}:${stream || ''}` : ''
  }

  // Formatted teacher class options
  const teacherOptions = useMemo(() => {
    if (!isTeacher) return []
    const options = assignedClasses.map(c => {
      const level = canonicalizeClassLevel(c.class_level)
      const stream = String(c.class_stream || '').trim()
      return {
        key: `${level}:${stream}`,
        label: `${level} ${stream}`.trim(),
        level,
        stream: stream || null
      }
    })
    return [...new Map(options.map(option => [option.key, option])).values()]
      .sort((a, b) => a.label.localeCompare(b.label))
  }, [isTeacher, assignedClasses])

  const [localCampusFilter, setLocalCampusFilter] = useState('all')
  const campusFilter = controlledCampusFilter ?? localCampusFilter
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
      const activeOption = teacherOptions.find(option => option.key === canonicalTeacherKey(activeClassKey))
      if (activeOption) {
        sessionStorage.setItem(sessionKey, activeOption.key)
        if (activeClassKey !== activeOption.key) onClassChange(activeOption.key, activeOption)
        return
      }
      
      const stored = sessionStorage.getItem(sessionKey)
      const validStored = teacherOptions.find(o => o.key === canonicalTeacherKey(stored))
      
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
    setLocalCampusFilter(nextCampus)
    onCampusChange?.(nextCampus)
    sessionStorage.setItem(sessionKey, 'ALL')
    onClassChange('ALL')
  }

  const handleSelect = (key) => {
    sessionStorage.setItem(sessionKey, key)
    const opt = teacherOptions.find(o => o.key === key) || adminOptions.find(o => o.key === key)
    if (!isTeacher && opt?.campus && !isCampusLocked && campusFilter !== opt.campus) {
      setLocalCampusFilter(opt.campus)
      onCampusChange?.(opt.campus)
    }
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
      {!isCampusLocked && <select
        className="campus-scope-mobile"
        aria-label="Campus and class scope"
        value={activeClassKey && activeClassKey !== 'ALL' ? activeClassKey : `@campus:${campusFilter}`}
        onChange={(event) => {
          const value = event.target.value
          if (value.startsWith('@campus:')) handleCampusChange(value.slice('@campus:'.length))
          else handleSelect(value)
        }}
      >
        <option value="@campus:all">All school · all classes</option>
        <option value="@campus:junior">Junior School · all classes</option>
        <option value="@campus:senior">Senior School · all classes</option>
        {adminOptions.length > 0 && <optgroup label="Choose a class">
          {adminOptions.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}
        </optgroup>}
      </select>}
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
