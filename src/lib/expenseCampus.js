const CAMPUSES = new Set(['junior', 'senior'])

export function resolveExpenseCampus(role, assignedCampus, selectedCampus) {
  if (CAMPUSES.has(assignedCampus)) return assignedCampus
  if (role === 'admin' && CAMPUSES.has(selectedCampus)) return selectedCampus
  return null
}

export function needsExpenseCampusChoice(role, assignedCampus) {
  return role === 'admin' && !CAMPUSES.has(assignedCampus)
}
