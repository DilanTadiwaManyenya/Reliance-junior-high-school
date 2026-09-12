import React, { useEffect, useState, useMemo } from 'react'
import { useAuth } from '../../context/useAuth'

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
  allOptionLabel = 'All classes'
}) {
  const isTeacher = role === 'teacher'

  // Formatted teacher class options
  const teacherOptions = useMemo(() => {
    if (!isTeacher) return []
    return assignedClasses.map(c => ({
      key: `${c.class_level}:${c.class_stream}`,
      label: `${c.class_level} ${c.class_stream}`.trim(),
      level: c.class_level,
      stream: c.class_stream
    })).sort((a, b) => a.label.localeCompare(b.label))
  }, [isTeacher, assignedClasses])

  const [campusFilter, setCampusFilter] = useState('all')

  // Formatted admin class options
  const adminOptions = useMemo(() => {
    if (isTeacher) return []
    let options = allClasses.map(c => {
      let level = '', stream = ''
      if (typeof c === 'object' && c !== null && c.class_level) {
        level = c.class_level
        stream = c.class_stream || ''
      } else if (typeof c === 'string') {
        const parsed = parseClassKey(c)
        level = parsed.level
        stream = parsed.stream || ''
      } else {
        level = String(c)
      }
      
      return {
        key: `${level}:${stream}`.replace(/:$/, ''),
        label: `${level} ${stream}`.trim(),
        level
      }
    })

    if (campusFilter === 'junior') {
      options = options.filter(o => {
        return o.level.includes('Grade') || o.level.includes('ECD')
      })
    } else if (campusFilter === 'senior') {
      options = options.filter(o => {
        return o.level.includes('Form') || o.level.includes('Six')
      })
    }

    return options
  }, [isTeacher, allClasses, campusFilter])

  // Auto-initialize active selection if not set or invalid
  useEffect(() => {
    if (isTeacher) {
      if (!teacherOptions.length) return
      
      const stored = sessionStorage.getItem(SESSION_KEY)
      const validStored = teacherOptions.find(o => o.key === stored)
      
      if (validStored) {
        if (activeClassKey !== validStored.key) {
          onClassChange(validStored.key, validStored)
        }
      } else {
        const defaultClass = teacherOptions[0]
        sessionStorage.setItem(SESSION_KEY, defaultClass.key)
        if (activeClassKey !== defaultClass.key) {
          onClassChange(defaultClass.key, defaultClass)
        }
      }
    } else {
      // Admin / Accountant mode
      const stored = sessionStorage.getItem(SESSION_KEY)
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

  const handleSelect = (key) => {
    sessionStorage.setItem(SESSION_KEY, key)
    const opt = teacherOptions.find(o => o.key === key) || adminOptions.find(o => o.key === key)
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
    <div className="admin-class-selector-container" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div className="campus-toggle" style={{ display: 'flex', gap: '10px', fontSize: '0.85rem' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <input type="radio" name="campusFilter" checked={campusFilter === 'all'} onChange={() => setCampusFilter('all')} />
          All Campuses
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <input type="radio" name="campusFilter" checked={campusFilter === 'junior'} onChange={() => setCampusFilter('junior')} />
          Junior
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <input type="radio" name="campusFilter" checked={campusFilter === 'senior'} onChange={() => setCampusFilter('senior')} />
          Senior
        </label>
      </div>
      <div className="class-selector-bar admin-bar">
        <label htmlFor="admin-class-selector" className="class-switcher-label">
          Filter by class:
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
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}
