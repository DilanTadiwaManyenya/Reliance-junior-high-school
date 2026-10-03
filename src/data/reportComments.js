// Editable bilingual facilitator comments for printable academic reports.
// Keep English and Shona wording paired so both lines communicate the same idea.
export const REPORT_COMMENT_BANK = {
  A: [
    { english: 'Excellent work this term.', shona: 'Zvakanaka chaizvo patemu ino.' },
    { english: 'Outstanding achievement; keep aiming high.', shona: 'Wagona zvikuru; ramba uchivavarira pamusoro.' },
    { english: 'A confident and impressive performance.', shona: 'Mashandiro ane chivimbo uye anofadza.' },
    { english: 'Consistently strong work throughout the term.', shona: 'Wakashanda nesimba nguva yose yetemu.' },
    { english: 'Exceptional effort and understanding shown.', shona: 'Waratidza kushanda nesimba nekunzwisisa kukuru.' },
    { english: 'A highly accomplished result; continue to lead by example.', shona: 'Mhedzisiro yepamusoro; ramba uchitungamira nevamwe nemuenzaniso wakanaka.' },
    { english: 'You have mastered the work well this term.', shona: 'Wanyatsoziva basa racho zvakanaka patemu ino.' },
    { english: 'Excellent discipline and thoughtful application.', shona: 'Waratidza kuzvidzora uye kushandisa pfungwa zvakanaka.' },
  ],
  B: [
    { english: 'Very good performance; keep it up.', shona: 'Mabasa akanaka; ramba uchiedza.' },
    { english: 'Strong work with clear progress.', shona: 'Basa rakanaka rine kufambira mberi kuri pachena.' },
    { english: 'A good result; aim even higher next term.', shona: 'Mhedzisiro yakanaka; vavarira pamusoro patemu inotevera.' },
    { english: 'Good understanding and steady effort.', shona: 'Kunzwisisa kwakanaka nekushanda nesimba nguva dzose.' },
    { english: 'A pleasing performance; maintain this focus.', shona: 'Mashandiro anofadza; ramba wakatarisa pabasa.' },
    { english: 'Reliable effort is producing encouraging results.', shona: 'Kushanda nesimba kuri kuburitsa mhedzisiro inokurudzira.' },
    { english: 'You are working well; keep building on this progress.', shona: 'Uri kushanda zvakanaka; ramba uchivaka pakufambira mberi uku.' },
    { english: 'A solid result with the potential to go further.', shona: 'Mhedzisiro yakasimba ine mukana wekukwira pamusoro.' },
  ],
  C: [
    { english: 'Satisfactory; there is room for improvement.', shona: 'Zvakanaka, asi pane zvinodiwa kuvandudzwa.' },
    { english: 'A fair result; practise more consistently.', shona: 'Mhedzisiro iri pakati; dzidzira nguva dzose.' },
    { english: 'Progress is visible; keep working to improve.', shona: 'Kufambira mberi kuri kuoneka; ramba uchishanda kuti uvandudzike.' },
    { english: 'Competent work, with more effort needed.', shona: 'Basa rakanaka, asi panodiwa kushanda nesimba.' },
    { english: 'A sound foundation; aim for a stronger result.', shona: 'Pane hwaro hwakanaka; vavarira mhedzisiro iri nani.' },
    { english: 'Keep practising the key skills to strengthen your result.', shona: 'Ramba uchidzidzira hunyanzvi hunokosha kuti mhedzisiro isimbe.' },
    { english: 'More careful revision will help you make progress.', shona: 'Kudzokorora zvidzidzo nekuchenjerera kuchakubatsira kufambira mberi.' },
    { english: 'You can improve further by staying focused in each lesson.', shona: 'Unogona kuvandudzika zvikuru nekutarisa pachidzidzo chega chega.' },
  ],
  D: [
    { english: 'Needs more effort and focus.', shona: 'Zvinoda kushanda nesimba uye kutarisisa.' },
    { english: 'More regular study and practice are needed.', shona: 'Panodiwa kudzidza nekudzidzira nguva dzose.' },
    { english: 'Seek help early and concentrate in class.', shona: 'Kumbira rubatsiro nekukurumidza uye teerera mukirasi.' },
    { english: 'Improvement is possible with committed effort.', shona: 'Kuvandudzika kunogoneka kana ukashanda nesimba.' },
    { english: 'Build confidence through steady revision.', shona: 'Vaka chivimbo nekudzokorora zvidzidzo nguva dzose.' },
    { english: 'Complete classwork carefully and ask questions when needed.', shona: 'Pedzisa basa remukirasi nekuchenjerera uye bvunza paunoda rubatsiro.' },
    { english: 'Set aside regular study time to improve this subject.', shona: 'Ronga nguva yekudzidza nguva dzose kuti uvandudze chidzidzo ichi.' },
    { english: 'Small, consistent steps will lead to better achievement.', shona: 'Matanho madiki anoitwa nguva dzose anounza mhedzisiro iri nani.' },
  ],
  FAIL: [
    { english: 'Requires urgent attention and support.', shona: 'Zvinoda kubatsirwa nekukurumidza.' },
    { english: 'Please seek support and practise consistently.', shona: 'Ndapota kumbira rubatsiro uye dzidzira nguva dzose.' },
    { english: 'A focused recovery plan is needed.', shona: 'Panodiwa hurongwa hwekushanda nesimba kuti uvandudzike.' },
    { english: 'More commitment is needed to improve this result.', shona: 'Panodiwa kuzvipira zvakanyanya kuti mhedzisiro ivandudzike.' },
    { english: 'Extra support and regular revision are essential.', shona: 'Rubatsiro rwakawedzerwa nekudzokorora zvidzidzo zvakakosha.' },
    { english: 'Work closely with your facilitator to rebuild the key skills.', shona: 'Shanda pedyo nemufambisi wako kuti udzore hunyanzvi hunokosha.' },
    { english: 'A daily study routine will help you recover steadily.', shona: 'Maitiro ekudzidza mazuva ose achakubatsira kuvandudzika zvishoma nezvishoma.' },
    { english: 'Start with the basics and seek support whenever you are unsure.', shona: 'Tanga nezvinokosha uye kumbira rubatsiro pese paunenge usina chokwadi.' },
  ],
}

const commentBand = grade => ['A', 'B', 'C', 'D'].includes(String(grade).toUpperCase()) ? String(grade).toUpperCase() : 'FAIL'

const stableIndex = (key, length) => {
  let hash = 0
  for (const character of String(key)) hash = ((hash << 5) - hash + character.charCodeAt(0)) | 0
  return Math.abs(hash) % length
}

export function getReportComment({ studentId, subject, term, year, grade }) {
  const options = REPORT_COMMENT_BANK[commentBand(grade)]
  return options[stableIndex(`${studentId}|${subject}|${term}|${year}`, options.length)]
}

export function getSubjectReportComment(details) {
  const comment = getReportComment(details)
  const normalizedSubject = String(details.subject ?? '').trim().toLowerCase()
  return normalizedSubject === 'chishona' || normalizedSubject === 'shona'
    ? { language: 'shona', text: comment.shona }
    : { language: 'english', text: comment.english }
}
