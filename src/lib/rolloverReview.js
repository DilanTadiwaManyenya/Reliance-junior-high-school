export const rolloverStatuses = {
  enrolment_year_review: 'Future enrolment year — review roster status',
  standard_review: 'Standard progression — review required',
  source_class_review: 'Current class is missing or inactive',
  unknown_level_review: 'Class progression needs school review',
  completion_review: 'Final year — completion review',
  main_admin_transition: 'School transition — Main Admin review',
  missing_target_class: 'Destination class must be created',
  campus_transition_review: 'Junior to Senior — placement review',
  sixth_form_review: 'Sixth Form — admission and subject review',
  stream_review: 'Destination stream needs placement review',
}
export const rolloverClassLabel = row => `${row.class_level}${row.class_stream && row.class_stream !== 'N/A' ? ` · ${row.class_stream}` : ''}`
const csvCell = value => {
  let text = String(value ?? '')
  if (/^[\s]*[=+\-@]|^[\t\r\n]/.test(text)) text = "'" + text
  return `"${text.replaceAll('"', '""')}"`
}
export function rolloverReviewCsv(rows, sourceYear, targetYear) {
  const header = ['Source year','Target year','Learner','Admission number','Campus','Current class','Suggested level','Destination choices','Review status']
  const data = rows.map(row => [sourceYear,targetYear,row.full_name,row.admission_number,row.campus,
    rolloverClassLabel({class_level:row.source_level,class_stream:row.source_stream}),row.target_level || 'Completion review',
    (row.candidates || []).map(rolloverClassLabel).join('; '),rolloverStatuses[row.review_status] || row.review_status])
  return '\uFEFF' + [header,...data].map(row => row.map(csvCell).join(',')).join('\r\n')
}
