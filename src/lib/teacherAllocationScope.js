import { canonicalizeClassLevel } from '../data/classOptions.js'
export function matchesTeacherSubjectAllocation(student, allocation) {
  if (!student || !allocation) return false
  if (canonicalizeClassLevel(student.class_level) !== canonicalizeClassLevel(allocation.class_level)) return false
  if (allocation.campus && student.campus !== allocation.campus) return false

  const assignedStream = String(allocation.class_stream || '').trim()
  const learnerStream = String(student.class_stream || '').trim()
  return !assignedStream || assignedStream === learnerStream
}
