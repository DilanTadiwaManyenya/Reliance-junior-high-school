import { canonicalizeClassLevel } from '../data/classOptions.js'

export function normalizeStaffClassAssignments(assignments, fallbackStream = '') {
  const seen = new Set()
  const normalized = (Array.isArray(assignments) ? assignments : []).map((assignment) => {
    const isLegacyLevel = typeof assignment === 'string'
    const class_level = canonicalizeClassLevel(isLegacyLevel ? assignment : assignment?.class_level)
    const class_stream = String(isLegacyLevel ? fallbackStream : assignment?.class_stream || '').trim()
    return { class_level, class_stream }
  }).filter(({ class_level, class_stream }) => {
    if (!class_level) return false
    const key = `${class_level.toLowerCase()}::${class_stream.toLowerCase()}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
  const wholeFormLevels = new Set(normalized.filter((assignment) => !assignment.class_stream).map((assignment) => assignment.class_level.toLowerCase()))
  return normalized.filter((assignment) => !assignment.class_stream || !wholeFormLevels.has(assignment.class_level.toLowerCase()))
}

export function staffClassAssignmentConflict(assignments, candidate) {
  const level = canonicalizeClassLevel(candidate?.class_level).toLowerCase()
  const stream = String(candidate?.class_stream || '').trim().toLowerCase()
  const existing = normalizeStaffClassAssignments(assignments)
    .filter((assignment) => assignment.class_level.toLowerCase() === level)

  if (!existing.length) return ''
  if (existing.some((assignment) => !assignment.class_stream) || !stream) {
    return 'A whole-form assignment overlaps every stream in that class. Remove it before adding another scope.'
  }
  if (existing.some((assignment) => assignment.class_stream.toLowerCase() === stream)) {
    return 'That class and stream are already assigned to this teacher.'
  }
  return ''
}

export function staffClassAssignmentLabel(assignment) {
  const isJuniorLevel = /^(ECD|Grade)\b/.test(assignment.class_level)
  return `${assignment.class_level}${assignment.class_stream ? ` · ${assignment.class_stream}` : isJuniorLevel ? '' : ' · Whole form'}`
}
