import { getCampusFromFormLevel, getFeeAmount } from './FeeStructure'

export const validateStudentCampusAssignment = (student, totalFees = null) => {
  const errors = []
  const campus = getCampusFromFormLevel(student.class_level)
  if (campus !== 'unknown' && student.campus !== campus) errors.push(`${student.class_level} belongs to the ${campus} campus.`)
  if (totalFees !== null && Number(totalFees) !== getFeeAmount(student.class_level)) errors.push(`${student.class_level} fee must be $${getFeeAmount(student.class_level).toFixed(2)}.`)
  return { isValid: errors.length === 0, errors }
}
