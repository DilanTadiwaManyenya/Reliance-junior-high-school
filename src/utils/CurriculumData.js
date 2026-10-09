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
