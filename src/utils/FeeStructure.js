export const CAMPUS_BY_LEVEL = Object.freeze({
  'ECD A': 'junior', 'ECD B': 'junior',
  'Grade 1': 'junior', 'Grade 2': 'junior', 'Grade 3': 'junior', 'Grade 4': 'junior',
  'Grade 5': 'junior', 'Grade 6': 'junior', 'Grade 7': 'junior',
  'Form 1': 'senior', 'Form 2': 'senior', 'Form 3': 'senior', 'Form 4': 'senior', 'Form 5': 'senior', 'Form 6': 'senior',
})

export const FEE_STRUCTURE = Object.freeze({
  'ECD A': 120, 'ECD B': 120,
  'Grade 1': 120, 'Grade 2': 120, 'Grade 3': 120, 'Grade 4': 120, 'Grade 5': 120, 'Grade 6': 120, 'Grade 7': 120,
  'Form 1': 170, 'Form 2': 170, 'Form 3': 180, 'Form 4': 180, 'Form 5': 210, 'Form 6': 210,
})

export const getCampusFromFormLevel = level => CAMPUS_BY_LEVEL[level] ?? 'unknown'
export const getFeeAmount = level => FEE_STRUCTURE[level] ?? 0
