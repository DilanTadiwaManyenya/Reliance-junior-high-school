export const CAMPUS_MAP = Object.freeze({
  'ECD A': 'junior', 'ECD B': 'junior',
  'Grade 1': 'junior', 'Grade 2': 'junior', 'Grade 3': 'junior',
  'Grade 4': 'junior', 'Grade 5': 'junior', 'Grade 6': 'junior', 'Grade 7': 'junior',
  'Form 1': 'senior', 'Form 2': 'senior', 'Form 3': 'senior', 'Form 4': 'senior', 'Form 5': 'senior', 'Form 6': 'senior',
})

export const getExpectedCampus = classLevel => CAMPUS_MAP[classLevel] ?? 'unknown'
export const filterByCampus = (students, campus) => campus === 'all' ? students : students.filter(student => student.campus === campus)
export const filterByJuniorCampus = students => filterByCampus(students, 'junior')
export const filterBySeniorCampus = students => filterByCampus(students, 'senior')
export const validateCampusAssignment = student => student?.campus === getExpectedCampus(student?.class_level)
