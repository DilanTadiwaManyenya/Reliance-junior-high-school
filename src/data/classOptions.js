/* ── Class levels ─────────────────────────────────────────────────
   Junior campus: ECD A/B, Grade 1-7
   Senior campus: Form 1-4, Lower Six, Upper Six
──────────────────────────────────────────────────────────────── */
export const JUNIOR_LEVELS = [
  'ECD A', 'ECD B',
  'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6', 'Grade 7'
]

export const SENIOR_LEVELS = [
  'Form 1', 'Form 2', 'Form 3', 'Form 4', 'Lower Six', 'Upper Six'
]

export const CLASS_LEVELS = [...JUNIOR_LEVELS, ...SENIOR_LEVELS]

const SENIOR_LEVEL_ALIASES = new Map([
  ['lower 6', 'Lower Six'],
  ['form 5', 'Lower Six'],
  ['form5', 'Lower Six'],
  ['upper 6', 'Upper Six'],
  ['form 6', 'Upper Six'],
  ['form6', 'Upper Six'],
])

export const canonicalizeClassLevel = level => {
  const normalized = String(level ?? '').trim().replace(/\s+/g, ' ')
  return SENIOR_LEVEL_ALIASES.get(normalized.toLowerCase()) || normalized
}

export const isJuniorLevel = level => JUNIOR_LEVELS.includes(level)
export const isSeniorLevel = level => SENIOR_LEVELS.includes(level) || ['Form 5', 'Form 6', 'Lower 6', 'Upper 6'].includes(level)

export const getCampusForLevel = level =>
  JUNIOR_LEVELS.includes(level) ? 'junior' : 'senior'
