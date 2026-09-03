const number = value => Number(value)

export function isPrimaryLevel(level = '') { return level.startsWith('Grade ') || level.startsWith('ECD') }
export function isOLevel(level = '') { return /^Form [1-4]$/.test(level) }

/** Converts an assessed percentage to the school's applicable outcome. */
export function calculateGrade(percentage, gradeLevel) {
  const score = number(percentage)
  if (!Number.isFinite(score) || score < 0 || score > 100) return null
  if (isPrimaryLevel(gradeLevel)) {
    const bands = [[85, 1, 'Excellent'], [77, 2, 'Very Good'], [70, 3, 'Good'], [60, 4, 'Satisfactory'], [50, 5, 'Fair'], [40, 6, 'Pass - Lower'], [30, 7, 'Pass - Low'], [20, 8, 'Fail'], [0, 9, 'Fail - Very Low']]
    const [, unit, description] = bands.find(([minimum]) => score >= minimum)
    return { grade: `Unit ${unit}`, unit, points: unit, description }
  }
  const bands = isOLevel(gradeLevel)
    ? [[75, 'A', 5, 'Distinction'], [65, 'B', 4, 'Merit'], [50, 'C', 3, 'Credit - Pass'], [40, 'D', 2, 'Pass'], [0, 'E', 1, 'Fair']]
    : [[80, 'A', 5, 'Outstanding'], [70, 'B', 4, 'Very Good'], [60, 'C', 3, 'Good'], [50, 'D', 2, 'Satisfactory'], [40, 'E', 1, 'Minimum Pass'], [30, 'O', 0, 'Subsidiary Pass'], [0, 'F', 0, 'Fail']]
  const [, grade, points, description] = bands.find(([minimum]) => score >= minimum)
  return { grade, points, description }
}
