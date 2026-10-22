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
export function parseTypedBirthDate(value, today = new Date().toISOString().slice(0, 10)) {
  const text = String(value ?? '').trim()
  if (!text) return ''
  let match = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  let day, month, year
  if (match) [, year, month, day] = match.map(Number)
  else {
    match = text.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})$/)
    if (match) [, day, month, year] = match.map(Number)
    else {
      const digits = text.replace(/\D/g, '')
      if (!/^\d{8}$/.test(digits)) return ''
      day = Number(digits.slice(0, 2)); month = Number(digits.slice(2, 4)); year = Number(digits.slice(4))
    }
  }
  if (!Number.isInteger(year) || year < 1 || year > 9999 || !Number.isInteger(month) || month < 1 || month > 12 || !Number.isInteger(day) || day < 1 || day > 31) return ''
  const date = new Date(0)
  date.setUTCHours(0, 0, 0, 0)
  date.setUTCFullYear(year, month - 1, day)
  const iso = date.toISOString().slice(0, 10)
  return Number(iso.slice(0, 4)) === year && Number(iso.slice(5, 7)) === month && Number(iso.slice(8, 10)) === day && validStudentBirthDate(iso, today) ? iso : ''
}
export const studentPortalEmail = admission => 'student-' + normalizeStudentAdmission(admission) + '@portal.reliance.local'
