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

  // Formatted admin class options
  const adminOptions = useMemo(() => {
    if (isTeacher) return []
    return allClasses.map(c => {
      if (typeof c === 'object' && c !== null && c.class_level) {
        return {
          key: `${c.class_level}:${c.class_stream || ''}`.replace(/:$/, ''),
          label: `${c.class_level} ${c.class_stream || ''}`.trim()
        }
      }
      if (typeof c === 'string') {
        const { level, stream } = parseClassKey(c)
        if (level) {
          return {
            key: `${level}:${stream || ''}`.replace(/:$/, ''),
            label: `${level} ${stream || ''}`.trim()
          }
        }
        return { key: c, label: c }
      }
      return { key: String(c), label: String(c) }
    })
  }, [isTeacher, allClasses])

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
        // Requirement decision: Default to first class alphabetically
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
          const directMatch = adminOptions.find(o => o.key === stored)
          if (directMatch) {
            if (activeClassKey !== directMatch.key) onClassChange(directMatch.key)
          } else {
            const parsedStored = parseClassKey(stored)
            const parsedMatch = adminOptions.find(o => {
              const p = parseClassKey(o.key)
              return p.level === parsedStored.level && p.stream === parsedStored.stream
            })
            if (parsedMatch) {
              sessionStorage.setItem(SESSION_KEY, parsedMatch.key)
              if (activeClassKey !== parsedMatch.key) onClassChange(parsedMatch.key)
            }
          }
        }
      }
    }
  }, [isTeacher, teacherOptions, adminOptions])

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

    // Multi-class teacher switcher
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

  // Admin / Accountant view selector
  return (
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
  )
}
