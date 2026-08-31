/* ── Class levels ─────────────────────────────────────────────────
   Junior campus: ECD A/B, Grade 1-7, Form 1-2
   Senior campus: Form 3-6
──────────────────────────────────────────────────────────────── */
export const JUNIOR_LEVELS = [
  'ECD A', 'ECD B',
  'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6', 'Grade 7',
  'Form 1', 'Form 2',
]

export const SENIOR_LEVELS = [
  'Form 3', 'Form 4', 'Form 5', 'Form 6',
]

export const CLASS_LEVELS = [...JUNIOR_LEVELS, ...SENIOR_LEVELS]

export const isJuniorLevel = level => JUNIOR_LEVELS.includes(level)
export const isSeniorLevel = level => SENIOR_LEVELS.includes(level)

export const getStreamsForLevel = level => {
  if (['Form 5', 'Form 6'].includes(level)) return ['Commercials', 'Arts', 'Sciences']
  if (['ECD A', 'ECD B'].includes(level)) return [] // single-stream ECD classes
  return ['Blue', 'Green', 'White']
}

export const getCampusForLevel = level =>
  JUNIOR_LEVELS.includes(level) ? 'junior' : 'senior'
