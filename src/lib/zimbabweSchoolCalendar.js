const dates = (start, end) => ({ start, end })

// Published 2026 Zimbabwe school-term dates. Add future calendars here when issued.
const schoolTerms = { 2026: [dates('2026-01-13', '2026-04-01'), dates('2026-05-12', '2026-08-06'), dates('2026-09-08', '2026-12-03')] }
const publicHolidays = { 2026: { '2026-01-01': 'New Year’s Day', '2026-02-21': 'National Youth Day', '2026-04-03': 'Good Friday', '2026-04-04': 'Easter Saturday', '2026-04-05': 'Easter Sunday', '2026-04-06': 'Easter Monday', '2026-04-18': 'Independence Day', '2026-05-01': 'Workers’ Day', '2026-05-25': 'Africa Day', '2026-08-10': 'Heroes’ Day', '2026-08-11': 'Defence Forces Day', '2026-12-22': 'Unity Day', '2026-12-25': 'Christmas Day', '2026-12-26': 'Boxing Day' } }
const inTerm = (iso, terms = []) => terms.some(term => iso >= term.start && iso <= term.end)

export function zimbabweSchoolDayStatus(iso) {
  if (!iso) return null
  const date = new Date(`${iso}T00:00:00`), year = date.getFullYear(), holiday = publicHolidays[year]?.[iso]
  if (holiday) return { kind: 'holiday', label: 'Public holiday', detail: holiday }
  if (date.getDay() === 0 || date.getDay() === 6) return { kind: 'weekend', label: 'Weekend', detail: 'No school attendance is expected.' }
  if (schoolTerms[year] && !inTerm(iso, schoolTerms[year])) return { kind: 'break', label: 'School break', detail: 'Outside the 2026 Zimbabwe school terms.' }
  return { kind: 'school-day', label: 'School day', detail: 'Attendance should be recorded for this date.' }
}
