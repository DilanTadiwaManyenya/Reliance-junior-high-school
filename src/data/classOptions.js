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

const normalizedClassLevel = level => String(level ?? '').trim().replace(/\s+/g, ' ')
const classLevelKey = level => normalizedClassLevel(level).toLowerCase()
const CANONICAL_LEVELS = new Map(CLASS_LEVELS.map(level => [classLevelKey(level), level]))
const SENIOR_LEVEL_ALIASES = new Map([
  ['lower 6', 'Lower Six'],
  ['form 5', 'Lower Six'],
  ['form5', 'Lower Six'],
  ['upper 6', 'Upper Six'],
  ['form 6', 'Upper Six'],
  ['form6', 'Upper Six'],
])

export const canonicalizeClassLevel = level => {
  const normalized = normalizedClassLevel(level)
  const key = classLevelKey(normalized)
  return SENIOR_LEVEL_ALIASES.get(key) || CANONICAL_LEVELS.get(key) || normalized
}

export const isJuniorLevel = level => JUNIOR_LEVELS.includes(canonicalizeClassLevel(level))
export const isSeniorLevel = level => SENIOR_LEVELS.includes(canonicalizeClassLevel(level))
export const getCampusForLevel = level =>
  isJuniorLevel(level) ? 'junior' : 'senior'
