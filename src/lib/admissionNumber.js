// Admission numbers are yearly enrolment identifiers: 0012026, 0022026, then 0012027.
export const admissionNumber = (sequence, year) => `${String(sequence).padStart(3, '0')}${Number(year)}`
export const nextAdmissionNumber = (students, enrolledYear = new Date().getFullYear()) => {
  const year = Number(enrolledYear), suffix = String(year)
  const highest = students.reduce((value, student) => {
    if (Number(student.enrolled_year) !== year) return value
    const admission = String(student.admission_number ?? '')
    const sequence = admission.endsWith(suffix) && /^\d{7,}$/.test(admission) ? Number(admission.slice(0, -suffix.length)) : 0
    return Math.max(value, sequence)
  }, 0)
  return admissionNumber(highest + 1, year)
}
