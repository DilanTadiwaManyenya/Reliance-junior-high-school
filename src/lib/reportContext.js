import { calculateGrade } from '../utils/GradeCalculator.js'

export function calculateReportGrade(value, level, rules) {
  const mark = Number(value)
  if (!Number.isFinite(mark) || mark < 0 || mark > 100) return null
  if (!rules?.grading_scale?.length) return calculateGrade(value,level)
  const band = rules.grading_scale.find(item => mark >= item.minimum)
  if (!band) return null
  const outcome = { ...band }
  delete outcome.minimum
  return outcome
}
export function reportContextNotice(context) {
  const messages=[]
  if(context.provenance==='legacy_inferred'&&!context.confirmed_at) messages.push('Historical class inferred from existing records — school verification pending.')
  if(!context.staffing_verified_at) messages.push('Historical teacher allocations require school verification.')
  return messages.join(' ')
}
