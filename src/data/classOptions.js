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

export const isJuniorLevel = level => JUNIOR_LEVELS.includes(level)
export const isSeniorLevel = level => SENIOR_LEVELS.includes(level)

export const getStreamsForLevel = level => {
  if (['Lower Six', 'Upper Six', 'Form 5', 'Form 6'].includes(level)) return ['Commercials', 'Arts', 'Sciences']
  if (isJuniorLevel(level)) return [] // No streams for Junior classes
  return ['Blue', 'Green', 'White']
}

export const getCampusForLevel = level =>
  JUNIOR_LEVELS.includes(level) ? 'junior' : 'senior'

export const ALL_CLASS_OPTIONS = CLASS_LEVELS.flatMap(level => {
  const streams = getStreamsForLevel(level)
  if (streams.length === 0) return [{ class_level: level, class_stream: '' }]
  return streams.map(stream => ({ class_level: level, class_stream: stream }))
})
