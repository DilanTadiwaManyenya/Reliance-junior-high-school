// Admission numbers are school-wide, sequential five digit identifiers: 00126.
export const admissionNumber = value => String(value ?? '').replace(/\D/g, '').slice(-5).padStart(5, '0')

export const nextAdmissionNumber = students => {
  const last = students.reduce((highest, student) => Math.max(highest, Number(String(student.admission_number ?? '').replace(/\D/g, '')) || 0), 0)
  return admissionNumber(last + 1)
}
