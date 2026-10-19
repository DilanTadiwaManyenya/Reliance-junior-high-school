// Preserve the school's ECD casing in authentication identifiers.
export function normalizeStudentAdmission(value) {
  return String(value ?? '').trim()
    .replace(/^(\d{2})([fg])/i, (_, year, code) => year + code.toLowerCase())
    .replace(/^(\d{2})e([ab])/i, (_, year, code) => year + 'e' + code.toUpperCase())
}
export const validStudentAdmission = value => /^(?:\d{4,6}|\d{2}(?:f[1-6]|g[1-7]|e[AB])\d{2})$/.test(value)
export function validStudentBirthDate(value, today = new Date().toISOString().slice(0, 10)) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value > today) return false
  const date = new Date(value + 'T00:00:00Z')
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}
export const studentPortalEmail = admission => 'student-' + normalizeStudentAdmission(admission) + '@portal.reliance.local'
