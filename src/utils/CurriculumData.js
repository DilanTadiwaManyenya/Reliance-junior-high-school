const primarySubjects = ['Mathematics (Paper 1)', 'Mathematics (Paper 2)', 'English (Paper 1)', 'English (Paper 2)', 'Indigenous Language (Paper 1)', 'Indigenous Language (Paper 2)', 'Science & Technology (Paper 1)', 'Science & Technology (Paper 2)', 'F.R.M.E (Paper 1)', 'F.R.M.E (Paper 2)', 'Visual & Performance Arts (Paper 1)', 'Visual & Performance Arts (Paper 2)', 'Physical Education (Paper 1)', 'Physical Education (Paper 2)', 'Computers (ICT) (Paper 1)', 'Computers (ICT) (Paper 2)', 'Heritage & Social Studies (Paper 1)', 'Heritage & Social Studies (Paper 2)', 'Agriculture (Paper 1)', 'Agriculture (Paper 2)', 'Guidance & Counseling']
const lowerSecondaryGroups = {
  'Languages & Core Literature': ['English Language', 'English Literature', 'Chishona'],
  'Mathematical Sciences': ['Mathematics'],
  'General Sciences': ['Combined Science', 'Computer Science'],
  'Humanities & Social Sciences': ['History', 'Geography', 'Heritage Studies', 'Family Religious Studies'],
  'Commercials & Applied Skills Foundations': ['Business Studies', 'B.E.S', 'Accounting'],
}
const oLevelSubjects = Object.values(lowerSecondaryGroups).flat()
const ecdSubjects = ['English Languages', 'Indigenous Languages', 'Mathematics & Science (1)', 'Mathematics & Science (2)', 'Heritage & Science Studies (1)', 'Heritage & Science Studies (2)', 'Mass Display', 'Visual & Performing Arts', 'Physical Education', 'Computers (ICT)', 'Guidance & Counseling']

// Junior report books are deliberately component based. The existing senior
// report uses a single subject mark, but the supplied Junior books require
// separate Paper 1, Paper 2 and (where applicable) Project entries.
// These blueprints are used by the later markbook and report stages so every
// portal reads the same, level-appropriate structure.
const ecdDevelopmentAreas = [
  'Can play with others',
  'Can share',
  'Can relate to a group',
  'Can control his/her feelings',
  'Can take care of his/her possession',
  'Can take care of his/her apparatus',
  'Can concentrate and attend for 10 minutes',
  'Pride in his/her apparatus',
  'Can complete a task',
  'Gross motor co-ordination',
  'Fine motor co-ordination',
  'Auditory perception',
  'Visual perception',
  'Language',
  'Number line',
  'Computer skills',
]

const gradeOneTwoSubjects = [
  { subject: 'English', components: ['Spelling', 'Reading', 'Written', 'Project'] },
  { subject: 'Shona', components: ['Spelling', 'Reading', 'Written', 'Project'] },
  { subject: 'Mathematics', components: ['Exam', 'Project'] },
  { subject: 'Social Science', components: ['Exam', 'Project'] },
  { subject: 'Sciences & Technology, ICT', components: ['Exam', 'Project'] },
  { subject: 'PE & Arts', components: ['Exam', 'Project'] },
]

const gradeThreeSevenSubjects = [
  'English Language',
  'Shona Language',
  'Mathematics',
  'Social Science',
  'Sciences & Technology, ICT',
  'PE & Arts',
].map(subject => ({ subject, components: ['Paper 1', 'Paper 2', 'Project'] }))

export const JUNIOR_REPORT_BOOKS = {
  ECD: {
    label: 'ECD A & ECD B developmental report',
    type: 'developmental-ratings',
    ratingScale: ['1 Below Average', '2 Average', '3 Good', '4 Very Good', '5 Excellent'],
    areas: ecdDevelopmentAreas,
  },
  GRADE_1_2: {
    label: 'Grade 1 & Grade 2 report',
    type: 'component-marks',
    subjects: gradeOneTwoSubjects,
  },
  GRADE_3_7: {
    label: 'Grade 3 to Grade 7 report',
    type: 'component-marks',
    subjects: [
      ...gradeThreeSevenSubjects,
      { subject: 'Guidance & Counseling', components: ['Paper 1', 'Paper 2'] },
    ],
  },
}

export function getJuniorReportBook(classLevel = '') {
  if (/^ECD [AB]$/.test(classLevel)) return JUNIOR_REPORT_BOOKS.ECD
  if (/^Grade [12]$/.test(classLevel)) return JUNIOR_REPORT_BOOKS.GRADE_1_2
  if (/^Grade [3-7]$/.test(classLevel)) return JUNIOR_REPORT_BOOKS.GRADE_3_7
  return null
}

export const CURRICULUM_STRUCTURE = {
  sports: ['Soccer', 'Netball', 'Handball', 'Chess', 'High Jump', 'Triple Jump', 'Discus', 'Javelin', 'Athletics', 'Basketball'],
  ECD_A: { subjects: ecdSubjects }, ECD_B: { subjects: ecdSubjects },
  GRADE_1_7: Object.fromEntries(['Blue', 'Green', 'White'].map(stream => [stream, primarySubjects])),
  FORM_1_4: Object.fromEntries(['Blue', 'Green', 'White'].map(stream => [stream, oLevelSubjects])),
  FORM_5_6: {
    Arts: ['English Language', 'English Literature', 'Chishona', 'History', 'Geography', 'Heritage Studies', 'Family Religious Studies', 'Sociology', 'Communication Skills'],
    Commercials: ['Economics', 'B.E.S', 'Business Studies', 'Accounting', 'Statistics', 'Geography'],
    Sciences: ['Computer Science', 'Mathematics', 'Chemistry', 'Physics', 'Biology'],
  },
}

export function getSubjectsByGradeStream(gradeLevel = '', stream = '') {
  if (gradeLevel === 'ECD A') return CURRICULUM_STRUCTURE.ECD_A.subjects
  if (gradeLevel === 'ECD B') return CURRICULUM_STRUCTURE.ECD_B.subjects
  if (gradeLevel.startsWith('Grade ')) return CURRICULUM_STRUCTURE.GRADE_1_7[stream] ?? []
  // Senior Forms 1–4 share one O-Level subject plan across every stream.
  // Streams classify learners; they do not change the form's subject list.
  if (/^Form [1-4]$/.test(gradeLevel)) return oLevelSubjects
  return CURRICULUM_STRUCTURE.FORM_5_6[stream] ?? []
}

/** Learning-area groups used by the staff subject picker. */
export function getSubjectGroupsByGradeStream(gradeLevel = '', stream = '') {
  if (/^Form [1-4]$/.test(gradeLevel)) return lowerSecondaryGroups
  if (/^Form [5-6]$/.test(gradeLevel)) {
    const pathway = stream === 'Sciences' ? 'Pure Sciences Pathway' : stream === 'Commercials' ? 'Commercials Pathway' : 'Arts & Humanities Pathway'
    return { [pathway]: getSubjectsByGradeStream(gradeLevel, stream) }
  }
  return { Curriculum: getSubjectsByGradeStream(gradeLevel, stream) }
}
