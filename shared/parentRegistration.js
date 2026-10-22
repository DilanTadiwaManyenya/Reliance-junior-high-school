import { normalizeStudentAdmission, parseTypedBirthDate, validStudentAdmission } from './studentRegistration.js'

/** Canonical values used to verify a learner during parent self-registration. */
export function normalizeParentLearnerDetails(admissionNumber, dateOfBirth) {
  const admission = normalizeStudentAdmission(admissionNumber)
  const birthDate = parseTypedBirthDate(dateOfBirth)
  if (!validStudentAdmission(admission) || !birthDate) return null
  return { admissionNumber: admission, dateOfBirth: birthDate }
}
