export const CLASS_LEVELS = [
  'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6', 'Grade 7',
  'Form 1', 'Form 2', 'Form 3', 'Form 4', 'Form 5', 'Form 6',
]

export const getStreamsForLevel = (level) => (
  ['Form 5', 'Form 6'].includes(level)
    ? ['Commercials', 'Arts', 'Sciences']
    : ['Blue', 'Green', 'White']
)
