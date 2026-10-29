import ReportClassHistory from '../../components/portal/ReportClassHistory'
import SubjectCatalogManager from '../../components/portal/SubjectCatalogManager'
import YearRolloverWorkflow from '../../components/portal/YearRolloverWorkflow'
import ReportingPeriods from '../../components/portal/ReportingPeriods'
import MobileRecordTable from '../../components/portal/MobileRecordTable'
import InventoryPOS from "../../components/portal/InventoryPOS";
import ExpensesCashbook from "../../components/portal/ExpensesCashbook";
import FinanceReconciliation from "../../components/portal/FinanceReconciliation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { possibleLearnerDuplicates } from '../../lib/learnerDuplicates';
import { normalizeStaffClassAssignments, staffClassAssignmentConflict, staffClassAssignmentLabel } from '../../lib/staffClassAssignments';
import Button from "../../components/ui/Button";
import DateOfBirthInput from "../../components/ui/DateOfBirthInput";
import PasswordInput from "../../components/ui/PasswordInput";
import Card from "../../components/ui/Card";
import PortalNotice from "../../components/portal/PortalNotice";
import StudentSelector from "../../components/portal/StudentSelector";
import FeesDashboard from "../../components/portal/FeesDashboard";
import { useSection } from "../../components/portal/StaffPortalLayout";
import { useAuth } from "../../context/useAuth";
import { invokeEdgeFunction } from "../../lib/edgeFunction";
import { canonicalizeClassLevel, isJuniorLevel } from "../../data/classOptions";
import ClassSelector, {
  parseClassKey,
} from "../../components/portal/ClassSelector";
import TeacherGradeEntry from "../../components/portal/TeacherGradeEntryV2";
import JuniorTeacherMarkbook from "../../components/portal/JuniorTeacherMarkbook";
import SlideOver from "../../components/ui/SlideOver";
import ActivityLog from "../../components/portal/ActivityLog";
import ClassManager from "../../components/portal/ClassManager";
import YearRolloverReadiness from "../../components/portal/YearRolloverReadiness";
import TeacherAttendanceHistory from "../../components/portal/TeacherAttendanceHistory";
import StaffLearnerProfile from "../../components/portal/StaffLearnerProfile";
import AccountantLearnerProfiles from "../../components/portal/AccountantLearnerProfiles";
import ParentAccountSupport from "../../components/portal/ParentAccountSupport";
import { logActivity } from "../../lib/logActivity";
import BulkLearnerExport from "../../components/portal/BulkLearnerExport";
import BulkLearnerActions from "../../components/portal/BulkLearnerActions";
import ReportTermSettings from "../../components/portal/ReportTermSettings";
import GradeBands from "../../components/portal/GradeBands";
import ProgressReports from "../../components/portal/ProgressReports";
import CourseWork from "../../components/portal/CourseWork";
import JuniorCourseWork from "../../components/portal/JuniorCourseWork";
import LibrarySupport from "../../components/portal/LibrarySupport";
import AdminNewsletters from "../../components/portal/AdminNewsletters";
import TeacherLearningLibrary from "../../components/portal/TeacherLearningLibrary";
import { getSubjectsByGradeStream } from "../../utils/CurriculumData";
import { matchesTeacherSubjectAllocation } from "../../lib/teacherAllocationScope";

const workingNameFor = (legalFullName, workingTitle) => {
  const names = String(legalFullName || "").trim().split(/\s+/).filter(Boolean);
  const title = workingTitle === "Mrs" ? "Mrs" : workingTitle === "Ms" ? "Ms" : "Mr";
  return names.length ? `${title} ${names[names.length - 1]}` : "";
};

const inferredWorkingTitle = (name) => {
  const workingName = String(name || "");
  if (/^mrs\.?\s/i.test(workingName)) return "Mrs";
  if (/^ms\.?\s/i.test(workingName)) return "Ms";
  return "Mr";
};

function StaffSubjectAssignments({ staff }) {
  if (staff.role !== "teacher") return "—";

  const classAssignments = staff.teacher_class_assignments ?? [];
  if (staff.campus === "junior") {
    const classLabels = [...new Set(classAssignments.map((assignment) => {
      const stream = String(assignment.class_stream || "").trim();
      return stream ? `${assignment.class_level} ${stream}` : assignment.class_level;
    }).filter(Boolean))];

    return (
      <div className="staff-junior-coverage">
        <strong>Class curriculum</strong>
        <span>{classLabels.length ? classLabels.join(", ") : "No class allocation"}</span>
        <small>Markbook &amp; Course Work</small>
      </div>
    );
  }

  const assignments = staff.teacher_class_subject_assignments ?? [];
  if (!assignments.length) {
    return <span className="staff-subjects-empty">No subjects assigned</span>;
  }

  const assignmentsByClass = assignments.reduce((groups, assignment) => {
    const classLabel = assignment.class_stream
      ? `${canonicalizeClassLevel(assignment.class_level)} ${assignment.class_stream}`
      : assignment.class_level
        ? `${canonicalizeClassLevel(assignment.class_level)} · Whole form`
        : "Unassigned class";
    if (!groups.has(classLabel)) groups.set(classLabel, new Set());
    groups.get(classLabel).add(assignment.subject);
    return groups;
  }, new Map());

  return (
    <div className="staff-subjects-by-class">
      {[...assignmentsByClass.entries()].map(([classLabel, subjects]) => (
        <div className="staff-subject-group" key={classLabel}>
          <strong>{classLabel}</strong>
          <div className="staff-subject-chip-list">
            {[...subjects].map((subject) => (
              <span className="staff-subject-chip" key={subject}>{subject}</span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function SubjectWorkspaceLanding({ assignments, students, teacherName, selectedAllocationId, onSelect, onBack, onOpenWorkspace }) {
  const options = [...assignments.reduce((groups, assignment) => {
    const classLevel = canonicalizeClassLevel(assignment.class_level);
    const key = `${assignment.subject.toLowerCase()}::${classLevel}::${(assignment.class_stream || "__all_streams").toLowerCase()}`;
    if (!groups.has(key)) groups.set(key, { subject: assignment.subject, classLevel, assignments: [] });
    groups.get(key).assignments.push(assignment);
    return groups;
  }, new Map()).values()].sort((a, b) => `${a.subject} ${a.classLevel}`.localeCompare(`${b.subject} ${b.classLevel}`));
  const selectedAllocation = assignments.find(assignment => assignment.id === selectedAllocationId);
  const learnersFor = option => students.filter(student => option.assignments.some(assignment => (
    matchesTeacherSubjectAllocation(student, assignment)
  )));
  if (selectedAllocation) {
    const selectedOption = options.find(option => option.assignments.some(assignment => assignment.id === selectedAllocationId));
    const scopedStudents = selectedOption ? learnersFor(selectedOption) : students;
    const streams = [...new Set(scopedStudents.map(student => student.class_stream).filter(Boolean))];
    return <div className="staff-content-area"><section className="subject-workspace-landing"><header className="dash-page-header"><div><p className="eyebrow">Active subject allocation</p><h1 className="dash-page-title">{selectedAllocation.subject} · {selectedAllocation.class_level}</h1><p className="dash-page-sub">{teacherName || 'Assigned teacher'} · work only with learners in this assigned subject scope.</p></div></header><div className="subject-scope-summary"><div><span>Allocated subject</span><strong>{selectedAllocation.subject}</strong></div><div><span>Form</span><strong>{selectedAllocation.class_level}</strong></div><div><span>Assigned streams</span><strong>{streams.length ? streams.join(', ') : 'No enrolled streams yet'}</strong></div><div><span>Active learners</span><strong>{scopedStudents.filter(student => student.status !== 'inactive').length}</strong></div></div><Card><div className="portal-card-title"><div><p className="eyebrow">Choose your work area</p><h2>Continue with this allocation</h2></div><span className="muted">Your subject scope stays locked as you work.</span></div><div className="subject-allocation-workspace-actions"><button type="button" className="button-primary" onClick={() => onOpenWorkspace('entry', selectedAllocation.subject, selectedAllocation.class_level, selectedAllocationId)}>Open markbook <span aria-hidden="true">→</span></button><button type="button" className="button-secondary" onClick={() => onOpenWorkspace('coursework', selectedAllocation.subject, selectedAllocation.class_level, selectedAllocationId)}>Open course work <span aria-hidden="true">→</span></button><button type="button" className="button-secondary" onClick={() => onOpenWorkspace('library', selectedAllocation.subject, selectedAllocation.class_level, selectedAllocationId)}>Open learning library <span aria-hidden="true">→</span></button></div></Card><Card><div className="portal-card-title"><h2>Subject learners</h2><span className="muted">Every learner included in this allocation</span></div>{scopedStudents.length ? <div className="portal-table-wrap"><table className="portal-table"><thead><tr><th>Learner</th><th>Admission no.</th><th>Stream</th></tr></thead><tbody>{scopedStudents.map(student => <tr key={student.id}><td><strong>{student.full_name}</strong></td><td>{student.admission_number || '—'}</td><td>{student.class_level} {student.class_stream || ''}</td></tr>)}</tbody></table></div> : <p className="muted">No learners are enrolled in your assigned streams for this subject.</p>}</Card><button type="button" className="subject-workspace-back" onClick={onBack}>← Choose another subject and form</button></section></div>;
  }
  return <div className="staff-content-area"><section className="subject-workspace-landing"><header className="dash-page-header"><div><p className="eyebrow">Teaching allocations</p><h1 className="dash-page-title">Choose a subject allocation</h1><p className="dash-page-sub">Open one allocation at a time, then choose Markbook, Course Work or Learning library for only those learners.</p></div></header><div className="teacher-subject-context"><div className="teacher-subject-context-heading"><span>Signed in as</span><strong>{teacherName || 'Teacher account'}</strong></div><p>Your allocation controls which learners are available. Separate stream allocations stay separate from one another.</p></div>{options.length ? <div className="subject-allocation-grid">{options.map(option => { const wholeForm = option.assignments.some(assignment => !assignment.class_stream); const assignedStreams = [...new Set(option.assignments.map(assignment => assignment.class_stream).filter(Boolean))]; const learners = learnersFor(option); return <button type="button" className="subject-allocation-card" key={option.assignments[0]?.id || `${option.subject}-${option.classLevel}`} onClick={() => onSelect(option.subject, option.classLevel, option.assignments[0]?.id)}><span className="subject-allocation-kicker">Assigned subject</span><strong>{option.subject}</strong><span className="subject-allocation-form">{option.classLevel}</span><span className="subject-allocation-detail">{wholeForm ? 'Whole form · all active streams' : `${assignedStreams.join(', ')} · assigned stream${assignedStreams.length === 1 ? '' : 's'}`}</span><span className="subject-allocation-metric"><b>{learners.filter(student => student.status !== 'inactive').length}</b> active learner{learners.filter(student => student.status !== 'inactive').length === 1 ? '' : 's'}</span><span className="subject-allocation-action">Review allocation <b aria-hidden="true">→</b></span></button> })}</div> : <p className="muted">No subject classes have been assigned to you yet.</p>}</section></div>
}

const records = {
  attendance: "attendance",
  academic: "academic_records",
  behavior: "behavior_notes",
  sports: "sports_records",
  awards: "student_awards",
};
const today = () => new Date().toISOString().slice(0, 10);
const currentSchoolTerm = () =>
  String(Math.min(3, Math.floor(new Date().getMonth() / 4) + 1));
const emptyForms = () => ({
  attendance: { date: today(), status: "present", late_minutes: "", note: "" },
  academic: {
    term: currentSchoolTerm(),
    year: new Date().getFullYear(),
    subject: "",
    score: "",
    grade: "",
    comment: "",
  },
  behavior: { category: "", description: "", severity: "positive" },
  sports: {
    activity: "",
    term: currentSchoolTerm(),
    year: new Date().getFullYear(),
    achievement: "",
    note: "",
  },
  awards: {
    award_type: "most_behaved",
    subject: "",
    term: currentSchoolTerm(),
    academic_year: new Date().getFullYear(),
    note: "",
  },
});
const emptyStudent = () => ({
  full_name: "",
  admission_number: "",
  date_of_birth: "",
  class_level: "",
  class_stream: "",
  enrolled_year: new Date().getFullYear(),
  status: "active",
  inactive_reason: "",
});

const confirmLearnerRequest = (request) => {
  let timer;
  return Promise.race([
    request,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error("The school server did not respond in time.")), 15000);
    }),
  ]).finally(() => clearTimeout(timer));
};

/* ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ Stat Card ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ */
function StatCard({ label, value, sub, accent, icon }) {
  return (
    <div className="dash-stat-card">
      <div
        className="dash-stat-icon"
        style={{ background: `${accent}18`, color: accent }}
      >
        {icon}
      </div>
      <div className="dash-stat-body">
        <span className="dash-stat-value" style={{ color: accent }}>
          {value}
        </span>
        <span className="dash-stat-label">{label}</span>
        {sub && <span className="dash-stat-sub">{sub}</span>}
      </div>
    </div>
  );
}

function StaffAccountSettings({ supabase, profile }) {
  const role = profile?.active_role ?? profile?.role;
  const [phone, setPhone] = useState(profile?.phone || "");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const campusName = profile?.campus === "junior" ? "Junior" : profile?.campus === "senior" ? "Senior" : "Main";
  const accountLabel = role === "admin"
    ? `${campusName} Admin account`
    : role === "principal" ? "Principal account" : "Teacher account";
  const authorityLabel = role === "admin"
    ? profile?.campus === "all" ? "School-wide authority" : `${campusName} campus authority`
    : "Personal account";
  const save = async (event) => {
    event.preventDefault(); setError(""); setNotice("");
    if (password.length < 8) return setError("Choose a password with at least 8 characters.");
    if (password !== confirmPassword) return setError("The passwords do not match.");
    setSaving(true);
    const { data, error: requestError } = await invokeEdgeFunction(supabase, "update_teacher_credentials", { phone, password });
    setSaving(false);
    if (requestError || data?.success === false) return setError(requestError?.message || data?.error || "Unable to update account settings.");
    setPassword(""); setConfirmPassword(""); setNotice("Your phone number and password have been updated.");
  };
  return <div className="dash-section account-settings-page"><div className="dash-page-header"><div><p className="eyebrow">Personal security</p><h1 className="dash-page-title">Account settings</h1><p className="dash-page-sub">Update the contact number and sign-in password for your {accountLabel.toLowerCase()}.</p></div><span className="portal-scope-label">{authorityLabel}</span></div><Card><form className="portal-form account-settings-form" onSubmit={save}><label>Mobile number<input type="tel" inputMode="tel" value={phone} onChange={event => setPhone(event.target.value)} placeholder="+263 77 123 4567" required /></label><label>New password<PasswordInput id="staff-new-password" label="" minLength={8} autoComplete="new-password" value={password} onChange={event => setPassword(event.target.value)} /></label><label>Confirm new password<PasswordInput id="staff-confirm-password" label="" minLength={8} autoComplete="new-password" value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} /></label>{error && <PortalNotice tone="error">{error}</PortalNotice>}{notice && <PortalNotice>{notice}</PortalNotice>}<Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save account settings"}</Button></form></Card></div>
}

/* ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ SVG mini icons for stat cards ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ */
const UsersIcon = () => (
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);
const StaffIcon = () => (
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="2" y="7" width="20" height="14" rx="2" />
    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
  </svg>
);
const FeesIcon = () => (
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="12" y1="1" x2="12" y2="23" />
    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
  </svg>
);

/* ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ Status pill ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ */
function StatusPill({ status }) {
  const cls = status === "active" ? "pill-active" : "pill-inactive";
  return <span className={`roster-status-pill ${cls}`}>{status}</span>;
}

/* ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ Dashboard home ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ */
function JuniorTeacherHome({ students, loading, profile, onOpenClassSection }) {
  const assignments = profile?.teacher_class_assignments || [];
  const classes = [...new Map(assignments
    .filter((assignment) => /^Grade [1-7]$|^ECD [AB]$/.test(assignment.class_level))
    .map((assignment) => [`${assignment.class_level}:${assignment.class_stream || ""}`, assignment]))
    .values()];
  const activeLearners = students.filter((student) => student.status === "active");
  const primaryClass = classes[0];
  const ecdOnlyTeacher = classes.length > 0 && classes.every(assignment => /^ECD [AB]$/.test(assignment.class_level));

  return (
    <section className="junior-teacher-home">
      <header className="junior-teacher-home-hero">
        <div>
          <p className="eyebrow">Junior School · class teacher workspace</p>
          <h1>My class</h1>
          <p>{ecdOnlyTeacher ? "Work with the learners in your assigned ECD class. Attendance, the developmental markbook and Learning library stay inside this class scope." : "Work with the learners in your assigned class. Attendance, Markbook, Course Work and Learning library all stay inside this class scope."}</p>
        </div>
        <div className="junior-teacher-home-actions">
          <Button variant="secondary" onClick={() => primaryClass && onOpenClassSection("roster", primaryClass)} disabled={!primaryClass}>Take attendance</Button>
          <Button onClick={() => primaryClass && onOpenClassSection("entry", primaryClass)} disabled={!primaryClass}>Open Markbook</Button>
        </div>
      </header>
      <div className="junior-teacher-home-stats">
        <article><span>Assigned classes</span><strong>{classes.length}</strong><small>Junior class scope{classes.length === 1 ? "" : "s"}</small></article>
        <article><span>Active learners</span><strong>{loading ? "—" : activeLearners.length}</strong><small>{loading ? "Loading class list" : "ready for attendance and marking"}</small></article>
        <article><span>Working tools</span><strong>{ecdOnlyTeacher ? "3" : "4"}</strong><small>{ecdOnlyTeacher ? "Attendance · Developmental markbook · Learning library" : "Attendance · Markbook · Course Work · Learning library"}</small></article>
      </div>
      <section className="junior-teacher-class-list">
        <div className="junior-teacher-section-heading"><div><p className="eyebrow">Your teaching access</p><h2>Choose a class workspace</h2><p>Each action opens the exact class selected below.</p></div></div>
        {classes.length ? <div className="junior-teacher-class-grid">{classes.map((assignment) => {
          const classLearners = activeLearners.filter((student) => student.class_level === assignment.class_level && (student.class_stream || "") === (assignment.class_stream || ""));
          const label = `${assignment.class_level}${assignment.class_stream ? ` · ${assignment.class_stream}` : ""}`;
          const isEcdClass = /^ECD [AB]$/.test(assignment.class_level);
          return <article key={`${assignment.class_level}:${assignment.class_stream || ""}`}><span>Assigned class</span><h3>{label}</h3><p>{loading ? "Loading learners…" : `${classLearners.length} active learner${classLearners.length === 1 ? "" : "s"}`}</p><div><button type="button" onClick={() => onOpenClassSection("roster", assignment)}>Learners</button><button type="button" onClick={() => onOpenClassSection("entry", assignment)}>{isEcdClass ? "Developmental markbook" : "Markbook"}</button>{!isEcdClass && <button type="button" onClick={() => onOpenClassSection("coursework", assignment)}>Course Work</button>}<button type="button" onClick={() => onOpenClassSection("library", assignment)}>Learning library</button></div></article>
        })}</div> : <p className="muted">No Junior class is assigned to this teacher account yet. Ask a campus administrator to assign a class.</p>}
      </section>
    </section>
  );
}

function DashboardHome({
  students,
  staff,
  loading,
  setSection,
  role,
  supabase,
  teacherScopeLabel = "",
  teacherWorkspace = "classes",
  campusScope = "all",
}) {
  const isTeacher = role === "teacher";
  const teacherInSubjectWorkspace = isTeacher && teacherWorkspace === "subjects";
  const isCampusAdmin = ["junior", "senior"].includes(campusScope);
  const isMainAdmin = !isTeacher && campusScope === "all";
  const campusName = campusScope === "junior" ? "Junior Campus" : campusScope === "senior" ? "Senior Campus" : "School";
  const active = students.filter(
    (student) => student.status === "active",
  ).length;
  const pending = students.filter(
    (student) => student.status !== "active",
  ).length;
  const recent = students.slice(0, 6);
  const [overview, setOverview] = useState({
    attendance: [],
    linkedParents: null,
    feesCollected: null,
  });
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [overviewError, setOverviewError] = useState("");
  const [overviewRefreshKey, setOverviewRefreshKey] = useState(0);
  const title = isTeacher ? "Teaching dashboard" : isCampusAdmin ? `${campusName} dashboard` : "School command centre";
  const subtitle = isTeacher
    ? teacherScopeLabel
      ? `${teacherScopeLabel}. Learners, attendance, and actions follow this active workspace.`
      : "Your learner records and marking workspace"
    : isCampusAdmin ? `A clear overview of ${campusName.toLowerCase()} learners and operations.` : "School-wide oversight across Junior and Senior, with the right next action always close by.";
  const actionLabel = isTeacher
    ? teacherInSubjectWorkspace
      ? "Open subject allocations"
      : "Open class roster"
    : "Open learner register";
  const listTitle = isTeacher ? "Your learners" : "Recent learners";

  useEffect(() => {
    let mounted = true;
    const loadOverview = async () => {
      setOverviewLoading(true);
      setOverviewError("");
      const year = new Date().getFullYear();
      const scopedLearnerIds = students.map((student) => student.id);
      const hasLearnersInScope = scopedLearnerIds.length > 0;
      const [attendanceResult, parentResult, feesResult] = await Promise.all([
        hasLearnersInScope
          ? supabase
              .from("attendance")
              .select("date, status, student_id")
              .in("student_id", scopedLearnerIds)
              .order("date", { ascending: true })
          : Promise.resolve({ data: [], error: null }),
        isTeacher
          ? Promise.resolve({ data: null })
          : hasLearnersInScope
            ? supabase
              .from("parent_student")
              .select("id", { count: "exact", head: true })
              .in("student_id", scopedLearnerIds)
              .not("verified_at", "is", null)
            : Promise.resolve({ count: 0, error: null }),
        isTeacher
          ? Promise.resolve({ data: null })
          : hasLearnersInScope
            ? supabase
              .from("fee_balances")
              .select("amount_paid")
              .eq("academic_year", year)
              .in("student_id", scopedLearnerIds)
            : Promise.resolve({ data: [], error: null }),
      ]);
      if (!mounted) return;
      const unavailable = [
        attendanceResult.error && "attendance",
        parentResult.error && "parent links",
        feesResult.error && "fee summary",
      ].filter(Boolean);
      if (unavailable.length)
        setOverviewError(`Unable to load ${unavailable.join(", ")}. You can retry this dashboard or continue to the relevant workspace.`);
      const months = Array.from({ length: 6 }, (_, index) => {
        const date = new Date(year, new Date().getMonth() - 5 + index, 1);
        return {
          key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`,
          label: date.toLocaleString("en", { month: "short" }),
        };
      });
      setOverview({
        rawAttendance: attendanceResult.data ?? [],
        attendance: months.map((month) => {
          const validStudentIds = new Set(students.map((s) => s.id));
          const records = (attendanceResult.data ?? []).filter(
            (row) =>
              row.date?.startsWith(month.key) &&
              validStudentIds.has(row.student_id),
          );
          return {
            ...month,
            present: records.filter(
              (row) => row.status === "present" || row.status === "late",
            ).length,
            absent: records.filter((row) => row.status === "absent").length,
          };
        }),
        linkedParents: parentResult.count ?? null,
        feesCollected:
          feesResult.data?.reduce(
            (sum, row) => sum + Number(row.amount_paid || 0),
            0,
          ) ?? null,
      });
      setOverviewLoading(false);
    };
    loadOverview();
    return () => {
      mounted = false;
    };
  }, [isTeacher, supabase, students, overviewRefreshKey]);

  const harareDateParts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Harare",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const todayDate = `${harareDateParts.find((part) => part.type === "year")?.value}-${harareDateParts.find((part) => part.type === "month")?.value}-${harareDateParts.find((part) => part.type === "day")?.value}`;
  const todayBreakdown = Object.entries(
    students.filter((student) => student.status === "active").reduce((acc, student) => {
      const record = overview.rawAttendance?.find(
        (r) => r.student_id === student.id && r.date === todayDate,
      );
      const className =
        `${student.class_level} ${student.class_stream || ""}`.trim() ||
        "Unassigned";
      if (!acc[className]) acc[className] = { present: 0, absent: 0, unmarked: 0 };
      if (record?.status === "present" || record?.status === "late") {
        acc[className].present++;
      } else if (record?.status === "absent") {
        acc[className].absent++;
      } else {
        acc[className].unmarked++;
      }
      return acc;
    }, {}),
  ).sort((a, b) => a[0].localeCompare(b[0]));

  const distribution = Object.entries(
    students.reduce((counts, student) => {
      const label = student.class_level || "Unassigned";
      counts[label] = (counts[label] || 0) + 1;
      return counts;
    }, {}),
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);
  const maxAttendance = Math.max(
    1,
    ...overview.attendance.flatMap((item) => [item.present, item.absent]),
  );
  const money = (value) =>
    new Intl.NumberFormat("en-ZW", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(value || 0);

  return (
    <div className="dash-home">
      <div className="dash-page-header">
        <div>
          <p className="dash-kicker">
            {isTeacher ? "Teaching workspace" : isCampusAdmin ? `${campusName} overview` : role === "principal" ? "Principal · school overview" : "Main Admin · all-school oversight"}
          </p>
          <h1 className="dash-page-title">{title}</h1>
          <p className="dash-page-sub">{subtitle}</p>
          {!isTeacher && (
            <div className="dash-command-scope">
              <span>Current scope</span>
              <strong>{isMainAdmin ? "All school" : campusName}</strong>
              <small>{isMainAdmin ? "Junior + Senior" : "Campus-only data"}</small>
            </div>
          )}
        </div>
        <div className="dashboard-header-controls">
          <Button
            className="dashboard-ghost-action"
            variant="secondary"
            onClick={() => setSection(isTeacher && teacherInSubjectWorkspace ? "entry" : "roster")}
          >
            {actionLabel}
          </Button>
          {role === "admin" && <Button className="dashboard-ghost-action" variant="secondary" onClick={() => setSection("classes")}>Open classes</Button>}
          {!isTeacher && <Button className="dashboard-ghost-action" variant="secondary" onClick={() => setSection("fees")}>Review fees</Button>}
          {!isTeacher && <Button className="dashboard-ghost-action" variant="secondary" onClick={() => setSection("staff")}>Find staff</Button>}
        </div>
      </div>

      <div className="dash-stats-row">
        <StatCard
          label={isTeacher ? "Your Learners" : "Total Learners"}
          value={loading ? "-" : students.length}
          sub={loading ? "Loading records" : `${active} active`}
          accent="#1B2A56"
          icon={<UsersIcon />}
        />
        <StatCard
          label={isTeacher ? "Active Learners" : "Teaching Staff"}
          value={
            loading
              ? "-"
              : isTeacher
                ? active
                : staff.filter((member) => member.portal_access_enabled !== false && member.role === "teacher").length
          }
          sub={isTeacher ? "ready for marking" : "active teaching team"}
          accent="#A67C00"
          icon={<StaffIcon />}
        />
        {!isTeacher && (
          <StatCard
            label="Parents Linked"
            value={overview.linkedParents ?? "—"}
            sub="verified family links"
            accent="#7A3E1D"
            icon={<UsersIcon />}
          />
        )}
        {!isTeacher && (
          <StatCard
            label="Fees Collected"
            value={
              overview.feesCollected === null
                ? "—"
                : money(overview.feesCollected)
            }
            sub={`${new Date().getFullYear()} academic year`}
            accent="#1B2A56"
            icon={<FeesIcon />}
          />
        )}
        {isTeacher && (
          <StatCard
            label="Learner Status"
            value={loading ? "-" : pending}
            sub={pending ? "need attention" : "all learners active"}
            accent="#A67C00"
            icon={<FeesIcon />}
          />
        )}
      </div>

      <div className="dash-insights-grid">
        <section className="dash-card dash-chart-card">
          <div className="dash-card-header">
            <div>
              <h2 className="dash-card-title">Attendance trend</h2>
              <p className="dash-card-subtitle">
                Present and absent records over the last six months.
              </p>
            </div>
            <div className="dash-chart-key">
              <span>
                <i className="present" />
                Present
              </span>
              <span>
                <i className="absent" />
                Absent
              </span>
            </div>
          </div>
          <div className="dash-bar-chart" aria-label="Attendance trend chart">
            {overview.attendance.map((month) => (
              <div className="dash-bar-group" key={month.key}>
                <div className="dash-bars">
                  <span
                    className="dash-bar present"
                    style={{
                      height: `${Math.max(4, (month.present / maxAttendance) * 100)}%`,
                    }}
                    title={`${month.present} present`}
                  />
                  <span
                    className="dash-bar absent"
                    style={{
                      height: `${Math.max(4, (month.absent / maxAttendance) * 100)}%`,
                    }}
                    title={`${month.absent} absent`}
                  />
                </div>
                <span>{month.label}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="dash-card">
          <div className="dash-card-header">
            <div>
              <h2 className="dash-card-title">Today's Attendance</h2>
              <p className="dash-card-subtitle">
                {isTeacher && teacherScopeLabel
                  ? `Today in ${teacherScopeLabel.replace(" · Class Work", "")}.`
                  : isTeacher
                    ? "Mark attendance from the learner roster."
                    : isCampusAdmin
                      ? `Live breakdown for the ${campusName.toLowerCase()}.`
                      : "Live breakdown for all classes."}
              </p>
            </div>
          </div>
          <div
            className="dash-distribution-body"
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "0.5rem",
              padding: "1rem",
              overflowY: "auto",
              maxHeight: "200px",
            }}
          >
            {overviewLoading ? (
              <div className="dash-attendance-state"><strong>Checking today’s register…</strong><span>Loading attendance for the current scope.</span></div>
            ) : overviewError ? (
              <div className="dash-attendance-state is-error"><strong>Dashboard data needs attention</strong><span>{overviewError}</span><button type="button" onClick={() => setOverviewRefreshKey((value) => value + 1)}>Retry dashboard</button></div>
            ) : todayBreakdown.length === 0 ? (
              <div className="dash-attendance-state"><strong>No active learners in this scope</strong><span>Add learners or change the campus and class scope to review today’s attendance.</span></div>
            ) : (
              todayBreakdown.map(([className, counts]) => (
                <div
                  key={className}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "0.5rem",
                    backgroundColor: "var(--surface-color)",
                    borderRadius: "4px",
                  }}
                >
                  <strong>{className}</strong>
                  <span>
                    <span style={{ color: "var(--success-color)" }}>
                      {counts.present} present
                    </span>
                    ,{" "}
                    <span style={{ color: "var(--error-color)" }}>
                      {counts.absent} absent
                    </span>
                    {counts.unmarked > 0 && <>
                      ,{" "}
                      <span style={{ color: "#64748b" }}>
                        {counts.unmarked} unmarked
                      </span>
                    </>}
                  </span>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      <div className="dash-card dash-table-card">
        <div className="dash-card-header">
          <div>
            <h2 className="dash-card-title">{listTitle}</h2>
            <p className="dash-card-subtitle">
              {isTeacher
                ? "Select a learner from the roster, then record a grade."
                : "The latest learners added to the school register."}
            </p>
          </div>
          {!loading && recent.length > 0 && (
            <button
              className="dash-view-all"
              onClick={() => setSection("roster")}
            >
              Open roster
            </button>
          )}
        </div>
        {loading ? (
          <p className="dash-loading-msg">Loading learners...</p>
        ) : recent.length === 0 ? (
          <div className="dash-empty-state">
            <strong>
              {isTeacher
                ? "No learners are assigned yet"
                : "No learners have been added yet"}
            </strong>
            <span>
              {isTeacher
                ? "Once learners are assigned to your class, they will appear here."
                : "Add a learner to begin building the school register."}
            </span>
            <button
              className="dash-empty-action"
              onClick={() => setSection(isTeacher ? "entry" : "roster")}
            >
              {isTeacher ? "Open grade entry" : "Open learner roster"}
            </button>
          </div>
        ) : (
          <>
          <ul className="dash-mobile-learners" aria-label="Recent learners">
            {recent.map(row => <li key={row.id}>
              <span className="dash-learner-avatar" aria-hidden="true">{row.full_name?.[0] ?? "?"}</span>
              <div><strong>{row.full_name}</strong><small>Admission no. {row.admission_number || "—"}</small><div className="dash-mobile-learner-meta"><span>{row.class_level} · {row.class_stream || "No stream"}</span><StatusPill status={row.status} /></div></div>
            </li>)}
          </ul>
          <div className="portal-table-wrap dash-desktop-learners">
            <table className="portal-table dash-preview-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Admission no.</th>
                  <th>Class</th>
                  <th>Stream</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((row) => (
                  <tr key={row.id} className="dash-table-row">
                    <td className="dash-td-name">
                      <span className="dash-learner-avatar">
                        {row.full_name?.[0] ?? "?"}
                      </span>
                      {row.full_name}
                    </td>
                    <td className="mono">{row.admission_number}</td>
                    <td>{row.class_level}</td>
                    <td>{row.class_stream || "-"}</td>
                    <td>
                      <StatusPill status={row.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>
        )}
      </div>
    </div>
  );
}
/* ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ Main export ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ */
export default function StaffDashboard() {
  const { supabase, user, profile, activeRole, setActiveRole } = useAuth();
  const { section, setSection, activeClassFilter, setActiveClassFilter, activeAdminCampusScope, setActiveClassKey, teacherWorkspace, selectedSubjectAllocationId, selectedSubjectClassStream, selectedSubject, selectedSubjectLevel, setSubjectGroup, setSubjectAllocation, clearSubjectGroup } = useSection();
  const location = useLocation();
  const navigate = useNavigate();

  const manager = ["admin", "principal"].includes(activeRole);
  const isAdmin = activeRole === "admin";
  const isAccountant = activeRole === "accountant";
  const isMainAdmin = isAdmin && profile?.campus === "all";
  const canManageJuniorAcademicSettings = isAdmin && ["all", "junior"].includes(profile?.campus);
  const adminCampusScope = isAdmin && ["junior", "senior"].includes(profile?.campus)
    ? profile.campus
    : null;
  const managerCampusScope = !isMainAdmin && ["junior", "senior"].includes(profile?.campus)
    ? profile.campus
    : null;
  const isCampusAdmin = Boolean(adminCampusScope);
  const accountant = activeRole === "accountant";
  const canViewLearnerProfile = manager || accountant;

  const [students, setStudents] = useState([]);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [showDisabledLearners, setShowDisabledLearners] = useState(false);
  const [tab, setTab] = useState("attendance");
  const [forms, setForms] = useState(emptyForms);
  const [recent, setRecent] = useState([]);
  const [student, setStudent] = useState(emptyStudent);
  const [editingId, setEditingId] = useState(null);
  const [savingLearner, setSavingLearner] = useState(false);
  const [rosterRefreshFailed, setRosterRefreshFailed] = useState(false);
  const [savedLearnerConfirmation, setSavedLearnerConfirmation] = useState(null);
  const learnerSaveBusy = useRef(false);
  const learnerAdmissionAttempt = useRef(null);
  const rosterHeading = useRef(null);
  const [duplicateLearners, setDuplicateLearners] = useState(null);
  const [staff, setStaff] = useState([]);
  const [staffForm, setStaffForm] = useState({
    fullName: "",
    legalFullName: "",
    workingTitle: "Mr",
    phone: "",
    password: "",
    role: "teacher",
    campus: adminCampusScope || "junior",
    classLevel: "",
    classStream: "",
    classAssignments: [],
    subjectAssignments: [],
    subjectName: "",
  });
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [resetModal, setResetModal] = useState({
    open: false,
    staff: null,
    phone: "",
    password: "",
    saving: false,
  });
  const [staffModal, setStaffModal] = useState(false);
  const [staffEditor, setStaffEditor] = useState({
    open: false,
    staff: null,
    fullName: "",
    legalFullName: "",
    workingTitle: "Mr",
    campus: "junior",
    classAssignments: [],
    classAllocationLevel: "",
    classAllocationStream: "",
    editingClassAssignmentIndex: null,
    allocationTab: "classes",
    subjectAssignments: [],
    subjectName: "",
    subjectLevel: "",
    subjectStream: "",
    saving: false,
  });
  const [staffQuery, setStaffQuery] = useState("");
  const [staffCampusFilter, setStaffCampusFilter] = useState("all");
  const [staffCategory, setStaffCategory] = useState("all");
  const [todayAttendance, setTodayAttendance] = useState({});
  const [savingAttendance, setSavingAttendance] = useState({});
  const [schoolClasses, setSchoolClasses] = useState([]);
  const [catalogSubjects, setCatalogSubjects] = useState([]);
  const [catalogGroups, setCatalogGroups] = useState([]);
  const [catalogMemberships, setCatalogMemberships] = useState([]);
  const [attendanceStudent, setAttendanceStudent] = useState(null);
  const [profileStudent, setProfileStudent] = useState(null);
  const [profileInitialTab, setProfileInitialTab] = useState("Summary");
  const [profileOrigin, setProfileOrigin] = useState({ section: "roster", label: "Back to learner register" });
  const [progressQuery, setProgressQuery] = useState("");

  const selected = students.find((row) => row.id === selectedId);
  const activeStaff = useMemo(() => staff.filter((row) => row.portal_access_enabled !== false), [staff]);
  const staffCategoryCounts = useMemo(() => ({
    all: activeStaff.length,
    admins: staff.filter((row) => row.portal_access_enabled !== false && ["admin", "principal"].includes(row.role)).length,
    teachers: staff.filter((row) => row.portal_access_enabled !== false && row.role === "teacher").length,
    accountants: staff.filter((row) => row.portal_access_enabled !== false && row.role === "accountant").length,
    deactivated: staff.filter((row) => row.portal_access_enabled === false).length,
  }), [activeStaff, staff]);
  const visibleStaff = staff.filter((row) => {
    const matchesSearch = [row.full_name, row.legal_full_name, row.phone, row.role].some((value) =>
      value?.toLowerCase().includes(staffQuery.toLowerCase()),
    );
    const matchesCampus = staffCampusFilter === "all" || row.campus === staffCampusFilter;
    const matchesCategory = staffCategory === "all"
      ? row.portal_access_enabled !== false
      : (staffCategory === "admins" && row.portal_access_enabled !== false && ["admin", "principal"].includes(row.role))
        || (staffCategory === "teachers" && row.portal_access_enabled !== false && row.role === "teacher")
        || (staffCategory === "accountants" && row.portal_access_enabled !== false && row.role === "accountant")
        || (staffCategory === "deactivated" && row.portal_access_enabled === false);
    return matchesSearch && matchesCampus && matchesCategory;
  });
  const showError = (value) => {
    setNotice("");
    setError(value);
  };

  const openLearnerProfile = (student, { initialTab = "Summary", origin = section } = {}) => {
    const originLabels = {
      roster: "Back to learner register",
      "progress-reports": "Back to academic progress",
      fees: "Back to finance",
      "learner-profiles": "Back to learner profiles",
    };
    setProfileOrigin({ section: origin, label: originLabels[origin] || "Back to learner register" });
    setProfileInitialTab(initialTab);
    setProfileStudent(student);
  };

  // Learner profiles are an in-page view layered over the active section.
  // When navigation changes sections, dismiss that view so it cannot mask
  // the newly selected workspace (for example, Progress Reports -> Finance).
  useEffect(() => {
    if (!profileStudent || section === profileOrigin.section) return;
    setProfileStudent(null);
    setProfileInitialTab("Summary");
  }, [profileOrigin.section, profileStudent, section]);

  const ensureAdminRole = async () => {
    if (activeRole === "admin") return true;
    try {
      await setActiveRole("admin");
      return true;
    } catch (roleError) {
      showError(roleError?.message || "This account must have the Admin role before it can manage staff.");
      return false;
    }
  };

  const loadStudents = useCallback(async () => {
    setLoading(true);
    const studentQuery = supabase
      .from("students")
      .select("*")
      .order("full_name");
    if (adminCampusScope) studentQuery.eq("campus", adminCampusScope);
    const { data, error: requestError } = await studentQuery;
    if (requestError) {
      showError(requestError.message);
      setLoading(false);
      return { ok: false, error: requestError, students: [] };
    }
    setStudents(data ?? []);
    setLoading(false);

    const today = new Date().toISOString().slice(0, 10);
    const learnerIds = (data ?? []).map((student) => student.id);
    const attendanceQuery = supabase
      .from("attendance")
      .select("student_id, status")
      .eq("date", today);
    if (adminCampusScope) attendanceQuery.in("student_id", learnerIds);
    if (learnerIds.length || !adminCampusScope) {
      void attendanceQuery.then(({ data: attendanceData }) => {
        if (attendanceData) {
          const map = {};
          attendanceData.forEach((r) => (map[r.student_id] = r.status));
          setTodayAttendance(map);
        }
      }).catch(() => {});
    } else setTodayAttendance({});
    return { ok: true, students: data ?? [] };
  }, [supabase, adminCampusScope]);

  const loadStaff = useCallback(async () => {
    if (!manager) return;
    const staffQuery = supabase
      .from("profiles")
      .select(
        "id, full_name, legal_full_name, working_title, signature_initials, phone, role, campus, portal_access_enabled, teacher_class_assignments (class_level, class_stream), teacher_class_subject_assignments (id, subject_id, class_level, class_stream, subject, campus)",
      )
      .order("full_name");
    if (adminCampusScope) staffQuery.eq("campus", adminCampusScope);
    const { data, error: requestError } = await staffQuery;
    if (requestError) showError(requestError.message);
    else setStaff(data ?? []);
  }, [manager, supabase, adminCampusScope]);
  const loadSchoolClasses = useCallback(async () => {
    const classQuery = supabase
      .from("school_classes")
      .select("class_level, class_stream, campus")
      .eq("active", true);
    if (adminCampusScope) classQuery.eq("campus", adminCampusScope);
    const { data } = await classQuery;
    setSchoolClasses(data ?? []);
  }, [supabase, adminCampusScope]);
  const loadSubjectCatalog = useCallback(async () => {
    if (!manager) return;
    const [subjectsResult, groupsResult, membershipsResult] = await Promise.all([
      supabase.from("subject_catalog").select("id,subject_code,display_name,is_active").eq("is_active", true).order("display_name"),
      supabase.from("curriculum_subject_groups").select("group_code,display_name,sort_order").order("sort_order"),
      supabase.from("subject_catalog_group_memberships").select("subject_id,group_code"),
    ]);
    if (subjectsResult.error || groupsResult.error || membershipsResult.error) return;
    setCatalogSubjects(subjectsResult.data || []);
    setCatalogGroups(groupsResult.data || []);
    setCatalogMemberships(membershipsResult.data || []);
  }, [manager, supabase]);
  useEffect(() => { void loadSubjectCatalog(); }, [loadSubjectCatalog]);

  const handleToggleAttendance = async (studentId, currentStatus) => {
    if (savingAttendance[studentId]) return;
    const newStatus = currentStatus === "present" ? undefined : "present";
    const today = new Date().toISOString().slice(0, 10);
    const restoreAttendance = () =>
      setTodayAttendance((prev) => {
        const next = { ...prev };
        if (currentStatus) next[studentId] = currentStatus;
        else delete next[studentId];
        return next;
      });

    setTodayAttendance((prev) => {
      const next = { ...prev };
      if (newStatus) next[studentId] = newStatus;
      else delete next[studentId];
      return next;
    });
    setSavingAttendance((prev) => ({ ...prev, [studentId]: true }));
    const { error: deleteError } = await supabase
      .from("attendance")
      .delete()
      .match({ student_id: studentId, date: today });
    if (deleteError) {
      restoreAttendance();
      setSavingAttendance((prev) => ({ ...prev, [studentId]: false }));
      return showError(deleteError.message);
    }
    if (newStatus) {
      const { error } = await supabase.from("attendance").insert({
        student_id: studentId,
        date: today,
        status: newStatus,
        recorded_by: user.id,
      });

      if (error) {
        showError(error.message);
        restoreAttendance();
      }
    }
    setSavingAttendance((prev) => ({ ...prev, [studentId]: false }));
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      loadStudents();
      loadStaff();
      loadSchoolClasses();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadStudents, loadStaff, loadSchoolClasses]);

  const loadRecent = useCallback(async () => {
    if (!selectedId) return setRecent([]);
    const order = tab === "attendance" ? "date" : "created_at";
    const { data, error: requestError } = await supabase
      .from(records[tab])
      .select("*")
      .eq("student_id", selectedId)
      .order(order, { ascending: false })
      .limit(10);
    if (requestError) showError(requestError.message);
    else setRecent(data ?? []);
  }, [selectedId, supabase, tab]);

  useEffect(() => {
    const timer = setTimeout(loadRecent, 0);
    return () => clearTimeout(timer);
  }, [loadRecent]);

  const update = (kind, field) => (event) =>
    setForms((current) => ({
      ...current,
      [kind]: { ...current[kind], [field]: event.target.value },
    }));

  const saveRecord = async (event) => {
    event.preventDefault();
    setError("");
    setNotice("");
    if (!selectedId) return showError("Select a learner first.");
    const row = { ...forms[tab], student_id: selectedId, recorded_by: user.id };
    if (tab === "attendance")
      row.late_minutes =
        row.status === "late" ? Number(row.late_minutes) : null;
    if (tab === "academic") row.score = Number(row.score);
    const { error: requestError } = await supabase
      .from(records[tab])
      .insert(row);
    if (requestError) return showError(requestError.message);
    logActivity(supabase, user, profile, {
      actionType: "create",
      description: `Saved ${tab} record for ${students.find((student) => student.id === selectedId)?.full_name || "learner"}`,
      targetTable: records[tab],
      targetId: selectedId,
    });
    setNotice("Record saved successfully.");
    setForms((current) => ({ ...current, [tab]: emptyForms()[tab] }));
    loadRecent();
  };

  const saveStudent = async (event, duplicateChoice = false, replacementId = null) => {
    event?.preventDefault();
    const wasEditing = Boolean(editingId);
    const returnAfterEdit = learnerReturnSearch(location.search);
    if (learnerSaveBusy.current) return;
    if (!isAdmin && activeRole !== "teacher")
      return showError(
        "Only administrators or assigned teachers can add learners.",
      );

    if (!isAdmin && activeRole === "teacher") {
      if (editingId) return showError("Only administrators can edit learners.");
      const isAssigned = teacherAssignments.some(
        (a) =>
          canonicalizeClassLevel(a.class_level) === canonicalizeClassLevel(student.class_level) &&
          (!student.class_stream ||
            a.class_stream === student.class_stream ||
            !a.class_stream),
      );
      if (!isAssigned)
        return showError("You can only add learners to your assigned classes.");
    }

    const row = {
      ...student,
      ...(isAdmin ? { campus: adminCampusScope || (isJuniorLevel(student.class_level) ? 'junior' : 'senior') } :
        activeRole === 'teacher' ? { campus: profile.campus } : {}),
      // New admission numbers are assigned by the database trigger. It holds a
      // class-level lock, so simultaneous enrolments cannot receive the same ID.
      ...(editingId ? { admission_number: student.admission_number } : {}),
      enrolled_year: Number(student.enrolled_year),
      class_stream: student.class_stream || null,
      inactive_reason:
        student.status === "inactive" ? student.inactive_reason : null,
    };
    if (!editingId && !duplicateChoice) {
      const matches = possibleLearnerDuplicates(students, row);
      if (matches.length) { setDuplicateLearners(matches); return; }
    }
    learnerSaveBusy.current = true;
    setSavingLearner(true);
    setRosterRefreshFailed(false);
    setError('');
    let saveConfirmed = false;
    try {
    if (!editingId && !replacementId) {
      const fingerprint = JSON.stringify(row);
      if (learnerAdmissionAttempt.current?.fingerprint !== fingerprint) learnerAdmissionAttempt.current = { fingerprint, id: crypto.randomUUID() };
      row.id = learnerAdmissionAttempt.current.id;
    }
    const existingAttempt = !editingId && !replacementId
      ? await confirmLearnerRequest(supabase.from('students').select('id').eq('id', row.id).maybeSingle())
      : { data: null, error: null };
    if (existingAttempt.error) return showError(`Could not check whether this learner was saved: ${existingAttempt.error.message}. Retry after the connection recovers.`);
    const request = existingAttempt.data ? Promise.resolve({ error: null }) : replacementId
      ? supabase.rpc('correct_assigned_learner', { p_student: replacementId, p_details: { full_name: row.full_name, date_of_birth: row.date_of_birth } })
      : editingId
      ? supabase.from("students").update(row).eq("id", editingId)
      : supabase.from("students").insert(row);
    const { error: requestError } = await confirmLearnerRequest(request);
    if (requestError) return showError(requestError.message);
    saveConfirmed = true;
    if (!existingAttempt.data) logActivity(supabase, user, profile, {
      actionType: editingId || replacementId ? "update" : "create",
      description: `${editingId || replacementId ? "Updated" : "Created"} learner ${student.full_name}`,
      targetTable: "students",
      targetId: replacementId || editingId,
    });
    setNotice(isTeacher ? '' : `${row.full_name} ${editingId || replacementId ? 'updated' : 'added'} successfully.`);
    if (!wasEditing) setStudent(emptyStudent());
    learnerAdmissionAttempt.current = null;
    if (!wasEditing) setEditingId(null);
    setDuplicateLearners(null);
    setQuery(row.full_name);
    const savedScope = replacementId ? students.find(item => item.id === replacementId) || row : row;
    setActiveClassKey(`${savedScope.class_level}:${savedScope.class_stream || ''}`);
    setActiveClassFilter({ level: savedScope.class_level, stream: savedScope.class_stream || null });
    if (isTeacher) setSection('roster');
    const savedLearnerId = replacementId || editingId || row.id;
    const rosterRefresh = await confirmLearnerRequest(loadStudents());
    const savedLearner = rosterRefresh?.students?.find(item => item.id === savedLearnerId);
    if (!rosterRefresh?.ok || !savedLearner) {
      const detail = rosterRefresh?.ok
        ? `${row.full_name} was saved, but this account cannot see the new row in its assigned class. Ask the administrator to check the class allocation. Do not add the learner again.`
        : `${row.full_name} was saved, but the roster did not refresh. Do not add the learner again; use Refresh learners to check the saved record.`;
      setNotice('');
      setSavedLearnerConfirmation({ id: savedLearnerId, name: row.full_name, message: detail, error: true });
      setRosterRefreshFailed(true);
    } else {
      setSavedLearnerConfirmation({
        id: savedLearnerId,
        name: savedLearner.full_name,
        message: `${savedLearner.full_name} was saved to ${savedLearner.class_level}${savedLearner.class_stream ? ` ${savedLearner.class_stream}` : ''} (${savedLearner.admission_number}) and is shown below.`,
        error: false,
      });
      setRosterRefreshFailed(false);
      if (wasEditing) {
        setStudent(emptyStudent());
        setEditingId(null);
        setDuplicateLearners(null);
        navigate({ pathname: location.pathname, search: returnAfterEdit });
      } else {
        setQuery(savedLearner.full_name);
        requestAnimationFrame(() => {
          const savedRow = document.getElementById(`learner-row-${savedLearnerId}`);
          savedRow?.scrollIntoView({ block: 'center', behavior: 'smooth' });
          rosterHeading.current?.focus({ preventScroll: true });
        });
      }
    }
    } catch (saveError) {
      showError(saveConfirmed
        ? `${row.full_name} was saved, but the roster refresh timed out. Do not add the learner again; refresh the roster to confirm.`
        : `Could not confirm the save: ${saveError.message}. Check the roster before adding this learner again.`);
      if (saveConfirmed) {
        setRosterRefreshFailed(true);
        setSavedLearnerConfirmation({ id: replacementId || editingId || row.id, name: row.full_name, message: `${row.full_name} was saved, but the roster refresh timed out. Do not add the learner again; refresh the roster to confirm.`, error: true });
      }
    } finally { learnerSaveBusy.current = false; setSavingLearner(false); }
  };

  const refreshSavedLearner = async () => {
    const savedId = savedLearnerConfirmation?.id;
    const savedName = savedLearnerConfirmation?.name || 'The learner';
    setError('');
    setRosterRefreshFailed(false);
    try {
      const refresh = await confirmLearnerRequest(loadStudents());
      const saved = refresh?.students?.find((item) => item.id === savedId);
      if (!refresh?.ok || !saved) {
        const message = refresh?.ok
          ? `${savedName} is saved, but this account still cannot see that record. Ask the administrator to verify the class allocation. Do not add the learner again.`
          : `${savedName} is saved. The roster refresh failed; please try Refresh learners again. Do not add the learner again.`;
        setSavedLearnerConfirmation({ id: savedId, name: savedName, message, error: true });
        setRosterRefreshFailed(true);
        return;
      }
      setError('');
      setSavedLearnerConfirmation({
        id: savedId,
        name: saved.full_name,
        message: `${saved.full_name} is visible in ${saved.class_level}${saved.class_stream ? ` ${saved.class_stream}` : ''} (${saved.admission_number}).`,
        error: false,
      });
      setQuery(saved.full_name);
      requestAnimationFrame(() => document.getElementById(`learner-row-${savedId}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' }));
    } catch {
      setSavedLearnerConfirmation({ id: savedId, name: savedName, message: `${savedName} is saved, but the roster refresh timed out. Do not add the learner again; tap Refresh learners to retry.`, error: true });
      setRosterRefreshFailed(true);
    }
  };

  const learnerReturnSearch = (search) => {
    const returnTo = new URLSearchParams(search).get("returnTo");
    return returnTo && new URLSearchParams(returnTo).get("section") === "roster"
      ? returnTo
      : "?section=roster";
  };

  const editStudent = (row) => {
    setStudent({ ...row, class_stream: row.class_stream ?? "" });
    setEditingId(row.id);
    const params = new URLSearchParams(location.search);
    params.set("returnTo", location.search || "?section=roster");
    params.set("section", "learner-edit");
    params.set("learner", row.id);
    navigate({ pathname: location.pathname, search: `?${params.toString()}` });
  };

  useEffect(() => {
    if (section !== "learner-edit") {
      if (editingId) {
        // Clear stale editor data when browser history leaves the URL-backed edit route.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setStudent(emptyStudent());
        setEditingId(null);
        setDuplicateLearners(null);
      }
      return;
    }
    const learnerId = new URLSearchParams(location.search).get("learner");
    const learner = students.find((row) => row.id === learnerId);
    if (learner && editingId !== learner.id) {
      setStudent({ ...learner, class_stream: learner.class_stream ?? "" });
      setEditingId(learner.id);
      setDuplicateLearners(null);
    }
  }, [section, location.search, students, editingId]);

  const disableLearner = async (row) => {
    const reason = window.prompt(`Disable ${row.full_name}? Their records will be kept. Enter the reason:`);
    if (!reason) return;
    if (reason.trim().length < 5) return showError('Enter a reason of at least five characters.');
    const { error: disableError } = await supabase.rpc('correct_assigned_learner', { p_student: row.id, p_details: { disable_reason: reason } });
    if (disableError) return showError(disableError.message);
    setNotice(`${row.full_name} disabled. Their history is retained for Main Admin review.`);
    await loadStudents();
  };

  const deleteLearner = async (row) => {
    if (!isAdmin || !window.confirm(`Permanently delete ${row.full_name}? This removes their learner and academic records and cannot be undone. Financial transactions, orders, and year rollover history prevent deletion.`)) return;
    const reason = window.prompt(`Enter the reason for permanently deleting ${row.full_name}:`);
    if (!reason || reason.trim().length < 5) return showError('Enter a deletion reason of at least five characters.');
    const { error: deleteError } = await supabase.rpc('manage_disabled_learner', { p_student: row.id, p_action: 'delete', p_reason: reason.trim() });
    if (deleteError) return showError(deleteError.message);
    setNotice(`${row.full_name} deleted.`);
    await loadStudents();
  };

  const activateDisabledLearner = async (row) => {
    if (!isAdmin || row.status !== 'inactive' || !window.confirm(`Reactivate ${row.full_name}? The learner will return to the active class roster.`)) return;
    const { error: activateError } = await supabase.rpc('manage_disabled_learner', { p_student: row.id, p_action: 'activate', p_reason: null });
    if (activateError) return showError(activateError.message);
    setNotice(`${row.full_name} reactivated.`);
    await loadStudents();
  };

  const createStaff = async (event) => {
    event.preventDefault();
    if (!isAdmin)
      return showError("Only administrators can create staff accounts.");
    if (!(await ensureAdminRole())) return;
    setError("");
    setNotice("");
    const { data, error: requestError } = await invokeEdgeFunction(
      supabase,
      "create-staff-account",
      { ...staffForm, fullName: workingNameFor(staffForm.legalFullName, staffForm.workingTitle) },
    );
    if (requestError || data?.error)
      return showError(data?.error || requestError.message);
    logActivity(supabase, user, profile, {
      actionType: "create",
      description: `Created ${staffForm.campus} ${staffForm.role} account for ${workingNameFor(staffForm.legalFullName, staffForm.workingTitle)}`,
      targetTable: "profiles",
      targetId: data?.user_id,
    });
    setNotice(data?.message || "Staff account created successfully.");
    setStaffForm({
      fullName: "",
      legalFullName: "",
      workingTitle: "Mr",
      phone: "",
      password: "",
      role: "teacher",
      campus: adminCampusScope || "junior",
      classLevel: "",
      classStream: "",
      classAssignments: [],
      subjectAssignments: [],
      subjectName: "",
    });
    loadStaff();
    setStaffModal(false);
  };

  const openStaffCreateModal = () => {
    setStaffForm({
      fullName: "",
      legalFullName: "",
      workingTitle: "Mr",
      phone: "",
      password: "",
      role: "teacher",
      campus: adminCampusScope || "junior",
      classLevel: "",
      classStream: "",
      classAssignments: [],
      subjectAssignments: [],
      subjectName: "",
    });
    setStaffModal(true);
  };

  const seedStaffing = async () => {
    if (!isAdmin)
      return showError("Only administrators can seed staffing data.");
    if (seeding) return;
    setError("");
    setNotice("");
    setSeeding(true);
    const { data, error: requestError } = await invokeEdgeFunction(
      supabase,
      "seed_reliance_staffing",
      {},
    );
    setSeeding(false);
    if (requestError || data?.success === false || data?.error)
      return showError(
        data?.error || requestError?.message || "Seeding failed.",
      );
    setNotice("Staffing data seeded successfully.");
    loadStaff();
  };

  const openResetModal = (row) => {
    setResetModal({
      open: true,
      staff: row,
      phone: row.phone || "",
      password: "",
      saving: false,
    });
  };

  const openStaffEditor = (row) => {
    const assignments = row.teacher_class_assignments || [];
    setStaffEditor({
      open: true,
      staff: row,
      fullName: row.full_name || "",
      legalFullName: row.legal_full_name || "",
      workingTitle: row.working_title || inferredWorkingTitle(row.full_name),
      campus: row.campus === "senior" ? "senior" : "junior",
      classAssignments: normalizeStaffClassAssignments(assignments),
      classAllocationLevel: "",
      classAllocationStream: "",
      editingClassAssignmentIndex: null,
      allocationTab: "classes",
      subjectAssignments: [...new Map((row.teacher_class_subject_assignments || []).map((assignment) => { const normalized = { ...assignment, class_level: canonicalizeClassLevel(assignment.class_level) }; return [`${normalized.subject_id || normalized.subject.toLowerCase()}::${normalized.class_level}::${normalized.class_stream || ""}`, normalized] })).values()],
      subjectName: "",
      subjectLevel: "",
      subjectStream: "",
      saving: false,
    });
  };

  const closeStaffEditor = () =>
    setStaffEditor({ open: false, staff: null, fullName: "", legalFullName: "", workingTitle: "Mr", campus: "junior", classAssignments: [], classAllocationLevel: "", classAllocationStream: "", editingClassAssignmentIndex: null, allocationTab: "classes", subjectAssignments: [], subjectName: "", subjectLevel: "", subjectStream: "", saving: false });

  const addSubjectAllocation = () => {
    const subject = staffEditor.subjectName.trim();
    const classLevel = staffEditor.subjectLevel;
    const classStream = staffEditor.subjectStream === "__all__" ? "" : staffEditor.subjectStream;
    const selectedOption = subjectOptionsForLevel(classLevel, staffEditor.campus, staffEditor.subjectStream).find(option => option.subject === subject);
    if (!subject || !classLevel) {
      showError("Choose a form and subject before adding the subject allocation.");
      return;
    }
    if (staffEditor.campus === "senior" && !staffEditor.subjectStream) {
      showError("Choose a Senior stream, or explicitly choose all streams, before adding the subject allocation.");
      return;
    }
    const exists = staffEditor.subjectAssignments.some((assignment) =>
      (selectedOption?.subject_id && assignment.subject_id ? assignment.subject_id === selectedOption.subject_id : assignment.subject.toLowerCase() === subject.toLowerCase())
      && canonicalizeClassLevel(assignment.class_level) === canonicalizeClassLevel(classLevel)
      && (assignment.class_stream || "") === classStream,
    );
    if (exists) return showError("That subject is already allocated to this teacher for the selected class scope.");
    setError("");
    setStaffEditor((value) => ({
      ...value,
      subjectAssignments: [...value.subjectAssignments, { subject, subject_id: selectedOption?.subject_id || null, class_level: classLevel, class_stream: classStream, campus: value.campus }],
      subjectName: "",
      subjectStream: "",
    }));
  };

  const saveStaffEditor = async (event) => {
    event.preventDefault();
    if (!staffEditor.staff) return;
    if (!(await ensureAdminRole())) return;
    setError("");
    setNotice("");
    setStaffEditor((value) => ({ ...value, saving: true }));
    const { data, error: requestError } = await invokeEdgeFunction(supabase, "manage-staff-account", {
      action: "update",
      user_id: staffEditor.staff.id,
      full_name: staffEditor.legalFullName ? workingNameFor(staffEditor.legalFullName, staffEditor.workingTitle) : staffEditor.fullName,
      legal_full_name: staffEditor.legalFullName,
      working_title: staffEditor.workingTitle,
      campus: staffEditor.campus,
      class_assignments: staffEditor.classAssignments,
      class_subject_assignments: staffEditor.subjectAssignments.map((assignment) => ({
        subject: assignment.subject,
        subject_id: assignment.subject_id || null,
        class_level: assignment.class_level,
        class_stream: assignment.class_stream || "",
      })),
    });
    setStaffEditor((value) => ({ ...value, saving: false }));
    if (requestError || data?.success === false || data?.error)
      return showError(data?.error || requestError?.message || "Unable to update staff account.");
    logActivity(supabase, user, profile, {
      actionType: "update",
      description: `Updated staff account for ${staffEditor.legalFullName ? workingNameFor(staffEditor.legalFullName, staffEditor.workingTitle) : staffEditor.fullName}`,
      targetTable: "profiles",
      targetId: staffEditor.staff.id,
    });
    setNotice(data?.message || "Staff account updated.");
    const updatedName = staffEditor.legalFullName ? workingNameFor(staffEditor.legalFullName, staffEditor.workingTitle) : staffEditor.fullName;
    setStaff((current) => current.map((row) => row.id === staffEditor.staff.id ? {
      ...row,
      full_name: updatedName,
      legal_full_name: staffEditor.legalFullName,
      working_title: staffEditor.workingTitle,
      campus: staffEditor.campus,
      teacher_class_assignments: staffEditor.classAssignments,
      teacher_class_subject_assignments: staffEditor.subjectAssignments,
    } : row));
    closeStaffEditor();
    void loadStaff();
  };

  const changeStaffAccess = async (row, action) => {
    const label = action === "deactivate" ? "deactivate" : "reactivate";
    if (!window.confirm(`${label[0].toUpperCase()}${label.slice(1)} ${row.full_name}'s portal account? Their staff record and class history will be retained.`)) return;
    if (!(await ensureAdminRole())) return;
    setError("");
    setNotice("");
    const { data, error: requestError } = await invokeEdgeFunction(supabase, "manage-staff-account", {
      action,
      user_id: row.id,
    });
    if (requestError || data?.success === false || data?.error)
      return showError(data?.error || requestError?.message || `Unable to ${label} staff account.`);
    logActivity(supabase, user, profile, {
      actionType: "update",
      description: `${action === "deactivate" ? "Deactivated" : "Reactivated"} staff account for ${row.full_name}`,
      targetTable: "profiles",
      targetId: row.id,
    });
    setNotice(data?.message || `Staff account ${label}d.`);
    loadStaff();
  };

  const deleteStaffAccount = async (row) => {
    if (!window.confirm(`Deactivate and permanently delete ${row.full_name}'s account? This cannot be undone. Their teaching assignments will be removed, and affected classes will show as unassigned.`)) return;
    if (!(await ensureAdminRole())) return;
    setError("");
    setNotice("");
    const { data, error: requestError } = await invokeEdgeFunction(supabase, "remove-staff-account", { user_id: row.id });
    if (requestError || data?.success === false || data?.error)
      return showError(data?.error || requestError?.message || "Unable to delete staff account.");
    logActivity(supabase, user, profile, {
      actionType: "delete",
      description: `Deleted staff account for ${row.full_name}`,
      targetTable: "profiles",
      targetId: row.id,
    });
    setNotice(data?.message || `${row.full_name}'s portal access and staff allocation were removed.`);
    loadStaff();
  };

  const handleResetSubmit = async (event) => {
    event.preventDefault();
    if (!isAdmin)
      return showError("Only administrators can update credentials.");
    if (!(await ensureAdminRole())) return;
    setError("");
    setNotice("");
    setResetModal((m) => ({ ...m, saving: true }));
    const { data, error: requestError } = await invokeEdgeFunction(
      supabase,
      "update_teacher_credentials",
      {
        user_id: resetModal.staff.id,
        phone: resetModal.phone,
        password: resetModal.password,
      },
    );
    setResetModal((m) => ({ ...m, saving: false }));
    if (requestError || data?.success === false || data?.error) {
      return showError(
        data?.error || requestError?.message || "Failed to update credentials.",
      );
    }
    logActivity(supabase, user, profile, {
      actionType: "update",
      description: `Reset credentials for ${resetModal.staff.full_name}`,
      targetTable: "profiles",
      targetId: resetModal.staff.id,
    });
    setNotice(
      `Credentials updated and email synced to ${data.email || "new portal email"} for ${resetModal.staff.full_name}.`,
    );
    setResetModal({
      open: false,
      staff: null,
      phone: "",
      password: "",
      saving: false,
    });
    loadStaff();
  };

  const isTeacher = activeRole === "teacher";
  const isJuniorTeacher = isTeacher && profile?.campus === "junior";
  const teacherAssignments = profile?.teacher_class_assignments || [];
  const teacherSubjectAssignments = profile?.teacher_class_subject_assignments || [];
  const hasTeacherSubjectScope = Boolean(
    teacherWorkspace === "subjects" &&
    selectedSubject &&
    selectedSubjectLevel &&
    selectedSubjectAllocationId,
  );
  const activeClassScopeLabel = activeClassFilter.level
    ? `${activeClassFilter.level}${activeClassFilter.stream ? ` · ${activeClassFilter.stream}` : " · all assigned streams"}`
    : "";
  const activeSubjectAssignment = teacherSubjectAssignments.find((assignment) => assignment.id === selectedSubjectAllocationId);
  const teacherScopeLabel = hasTeacherSubjectScope
    ? `${selectedSubject} · ${selectedSubjectLevel}${activeSubjectAssignment?.class_stream ? ` · ${activeSubjectAssignment.class_stream}` : " · all assigned streams"}`
    : isTeacher && activeClassScopeLabel
      ? `${activeClassScopeLabel} · Class Work`
      : "";
  const adminClassLevels = [
    ...new Set(schoolClasses
      .filter((row) => !adminCampusScope || row.campus === adminCampusScope)
      .map((row) => canonicalizeClassLevel(row.class_level))),
  ];
  const streamsForAdminLevel = (level) => {
    const normalizedLevel = canonicalizeClassLevel(level).toLowerCase();
    const recordedStreams = schoolClasses
      .filter((row) => (!adminCampusScope || row.campus === adminCampusScope) && canonicalizeClassLevel(row.class_level).toLowerCase() === normalizedLevel)
      .map((row) => row.class_stream)
      .filter(Boolean);
    const establishedStreams = /^form [1-4]$/.test(normalizedLevel)
      ? ["Blue", "Green", "White", "Red", "Purple"]
      : ["lower six", "upper six"].includes(normalizedLevel)
        ? ["Arts", "Commercials", "Sciences"]
        : [];
    // Class records can be added after staffing. Keep the allocation selector
    // usable for the confirmed Senior stream structure in that short gap.
    return [...new Map([...establishedStreams, ...recordedStreams].filter(Boolean).map((stream) => [String(stream).trim().toLowerCase(), String(stream).trim()])).values()];
  };
  const subjectOptionsForLevel = (level, campus, streamScope = "") => {
    if (!level) return [];
    let groupCodes = [];
    if (campus === "junior") {
      groupCodes = [/^ECD [AB]$/.test(level) ? "ecd_a_b" : /^Grade [12]$/.test(level) ? "grade_1_2" : /^Grade [3-7]$/.test(level) ? "grade_3_7" : null].filter(Boolean);
    } else if (["Form 1", "Form 2"].includes(level)) groupCodes = ["form_1_2_zgc"];
    else if (["Form 3", "Form 4"].includes(level)) groupCodes = ["form_3_4"];
    else if (["Lower Six", "Upper Six"].includes(level)) {
      const prefix = level === "Lower Six" ? "lower_six_" : "upper_six_";
      groupCodes = streamScope && streamScope !== "__all__" ? [`${prefix}${streamScope.toLowerCase()}`] : ["arts", "commercials", "sciences"].map(pathway => `${prefix}${pathway}`);
    }
    if (groupCodes.length && catalogSubjects.length && catalogGroups.length) {
      const subjectIds = new Set(catalogMemberships.filter(membership => groupCodes.includes(membership.group_code)).map(membership => membership.subject_id));
      const managedChoices = catalogSubjects.filter(subject => subjectIds.has(subject.id)).map(subject => ({ subject: subject.display_name, subject_id: subject.id }));
      if (managedChoices.length) return [...new Map(managedChoices.map(option => [option.subject_id, option])).values()].sort((a, b) => a.subject.localeCompare(b.subject));
    }
    const legacyChoices = campus === "senior"
      ? [...new Set((streamScope && streamScope !== "__all__" ? [streamScope] : streamsForAdminLevel(level)).flatMap(stream => getSubjectsByGradeStream(level, stream)))]
      : getSubjectsByGradeStream(level, "Blue");
    return legacyChoices.map(subject => ({ subject, subject_id: null }));
  };
  const addStaffClassAssignment = () => {
    const class_level = canonicalizeClassLevel(staffForm.classLevel);
    const class_stream = staffForm.campus === "senior" && staffForm.classStream !== "__all__" ? staffForm.classStream : "";
    if (!class_level) return showError("Choose a class before adding the class-teacher assignment.");
    if (staffForm.campus === "senior" && !staffForm.classStream) return showError("Choose a stream or explicitly choose the whole form.");
    const conflict = staffClassAssignmentConflict(staffForm.classAssignments, { class_level, class_stream });
    if (conflict) return showError(conflict);
    setError("");
    setStaffForm((value) => ({ ...value, classAssignments: [...value.classAssignments, { class_level, class_stream }] }));
  };
  const addEditorClassAssignment = () => {
    const class_level = canonicalizeClassLevel(staffEditor.classAllocationLevel);
    const class_stream = staffEditor.campus === "senior" && staffEditor.classAllocationStream !== "__all__" ? staffEditor.classAllocationStream : "";
    if (!class_level) return showError("Choose a class before adding the class-teacher assignment.");
    if (staffEditor.campus === "senior" && !staffEditor.classAllocationStream) return showError("Choose a stream or explicitly choose the whole form.");
    const existingAssignments = staffEditor.classAssignments.filter((_, index) => index !== staffEditor.editingClassAssignmentIndex);
    const conflict = staffClassAssignmentConflict(existingAssignments, { class_level, class_stream });
    if (conflict) return showError(conflict);
    setError("");
    setStaffEditor((value) => ({
      ...value,
      classAssignments: value.editingClassAssignmentIndex === null
        ? [...value.classAssignments, { class_level, class_stream }]
        : value.classAssignments.map((assignment, index) => index === value.editingClassAssignmentIndex ? { class_level, class_stream } : assignment),
      classAllocationLevel: "",
      classAllocationStream: "",
      editingClassAssignmentIndex: null,
    }));
  };
  const editStaffClassAssignment = (index) => {
    const assignment = staffEditor.classAssignments[index];
    if (!assignment) return;
    setStaffEditor((value) => ({
      ...value,
      classAllocationLevel: assignment.class_level,
      classAllocationStream: assignment.class_stream || "__all__",
      editingClassAssignmentIndex: index,
    }));
  };
  const cancelStaffClassAssignmentEdit = () => setStaffEditor((value) => ({
    ...value,
    classAllocationLevel: "",
    classAllocationStream: "",
    editingClassAssignmentIndex: null,
  }));
  const removeStaffClassAssignment = (index) => setStaffEditor((value) => {
    const editingRemovedAssignment = value.editingClassAssignmentIndex === index;
    return {
      ...value,
      classAssignments: value.classAssignments.filter((_, position) => position !== index),
      classAllocationLevel: editingRemovedAssignment ? "" : value.classAllocationLevel,
      classAllocationStream: editingRemovedAssignment ? "" : value.classAllocationStream,
      editingClassAssignmentIndex: editingRemovedAssignment
        ? null
        : value.editingClassAssignmentIndex !== null && value.editingClassAssignmentIndex > index
          ? value.editingClassAssignmentIndex - 1
          : value.editingClassAssignmentIndex,
    };
  });

  // Filter students based on active class selection (class_level & class_stream)
  const scopedStudents = useMemo(() => {
    const { level, stream } = isTeacher && teacherWorkspace === "subjects" ? { level: null, stream: null } : activeClassFilter;
    const activeSubjectAssignments = selectedSubjectAllocationId
      ? teacherSubjectAssignments.filter((assignment) => assignment.id === selectedSubjectAllocationId)
      : selectedSubject && selectedSubjectLevel
        ? teacherSubjectAssignments.filter((assignment) => assignment.subject === selectedSubject && assignment.class_level === selectedSubjectLevel)
        : teacherSubjectAssignments;
    const mainAdminCampusStudents = isMainAdmin && ['junior', 'senior'].includes(activeAdminCampusScope)
      ? students.filter((student) => student.campus === activeAdminCampusScope)
      : students;
    const workspaceStudents = isTeacher && teacherWorkspace === "subjects"
      ? students.filter((student) => activeSubjectAssignments.some((assignment) => matchesTeacherSubjectAllocation(student, assignment)) && (!selectedSubjectClassStream || selectedSubjectClassStream === (student.class_stream || "")))
      : isTeacher ? students.filter(student => teacherAssignments.some(assignment =>
        canonicalizeClassLevel(assignment.class_level) === canonicalizeClassLevel(student.class_level) &&
        (!assignment.class_stream || assignment.class_stream === (student.class_stream || ""))
      )) : mainAdminCampusStudents;
    const filterApplied = level
      ? `class_level = '${level}' AND class_stream = '${stream || ""}'`
      : teacherWorkspace === "subjects" ? "SUBJECT WORKSPACE ASSIGNMENTS" : "NONE (Showing all students)";

    console.log("[Admin/Teacher Class Filter Applied]", {
      sessionStorageValue: sessionStorage.getItem(
        "reliance_active_portal_class",
      ),
      parsedFilter: { class_level: level, class_stream: stream },
      filterApplied,
      matchingStudentsCount: level
        ? workspaceStudents.filter(
            (s) =>
              canonicalizeClassLevel(s.class_level) === canonicalizeClassLevel(level) &&
              (stream ? s.class_stream === stream : true),
          ).length
        : workspaceStudents.length,
    });

    if (!level) return workspaceStudents;
    return workspaceStudents.filter(
      (s) =>
        canonicalizeClassLevel(s.class_level) === canonicalizeClassLevel(level) && (stream ? s.class_stream === stream : true),
    );
  }, [students, activeClassFilter, isTeacher, isMainAdmin, activeAdminCampusScope, teacherAssignments, teacherSubjectAssignments, teacherWorkspace, selectedSubject, selectedSubjectLevel, selectedSubjectAllocationId, selectedSubjectClassStream]);

  const filteredStudents = useMemo(() => isTeacher
    ? scopedStudents.filter((row) => row.status !== 'inactive')
    : scopedStudents, [scopedStudents, isTeacher]);

  const rosterStudents = (isTeacher || isAdmin)
    ? scopedStudents.filter((row) => row.status === (showDisabledLearners ? 'inactive' : 'active'))
    : filteredStudents;

  const visible = (section === 'roster' && (isTeacher || isAdmin) ? rosterStudents : filteredStudents).filter((row) =>
    `${row.full_name} ${row.admission_number}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );

  if (
    isTeacher &&
    teacherWorkspace === "subjects" &&
    (section === "subject-allocations" || (
      ["dashboard", "entry", "coursework", "library", "progress-reports"].includes(section) &&
      !hasTeacherSubjectScope
    ))
  )
    return <SubjectWorkspaceLanding assignments={teacherSubjectAssignments} students={filteredStudents} teacherName={profile?.full_name} selectedAllocationId={selectedSubjectAllocationId} onSelect={setSubjectGroup} onBack={clearSubjectGroup} onOpenWorkspace={(nextSection, subject, level, allocationId) => setSubjectGroup(subject, level, allocationId, nextSection)} />;

  const shopRole = activeRole;
  const cancelLearnerEdit = () => {
    setStudent(emptyStudent());
    setEditingId(null);
    setDuplicateLearners(null);
    if (section === "learner-edit") navigate({ pathname: location.pathname, search: learnerReturnSearch(location.search) });
  };
  const renderLearnerEditor = () => (
              <Card>
                <div className="portal-card-title portal-form-title">
                  <div>
                    <h2>{editingId ? "Edit learner" : "Add learner"}</h2>
                    <p>{editingId ? "Update the learner’s recorded details." : "Enter the learner details, choose a class, then save to allocate the next admission number."}</p>
                  </div>
                  {isCampusAdmin && <span className="portal-scope-label">{adminCampusScope === "junior" ? "Junior School" : "Senior School"}</span>}
                </div>
                <form className="form portal-form" onSubmit={saveStudent}>
                  <label>
                    Full name
                    <input
                      required
                      value={student.full_name}
                      onChange={(e) =>
                        setStudent((v) => ({ ...v, full_name: e.target.value }))
                      }
                    />
                  </label>
                  <label>
                    Admission number
                    <input
                      required
                      readOnly
                      value={
                        editingId
                          ? student.admission_number
                          : "Assigned securely on save"
                      }
                      onChange={(e) =>
                        setStudent((v) => ({
                          ...v,
                          admission_number: e.target.value,
                        }))
                      }
                    />
                    <small>
                      {editingId
                        ? "Existing admission number."
                        : "The next class admission number is assigned securely when the learner is saved."}
                    </small>
                  </label>
                  <label>
                    Date of birth
                    <DateOfBirthInput
                      required
                      value={student.date_of_birth}
                      onChange={(e) =>
                        setStudent((v) => ({
                          ...v,
                          date_of_birth: e.target.value,
                        }))
                      }
                    />
                  </label>
                  <label>
                    Class level
                    <select
                      aria-label="Class level"
                      required
                      value={student.class_level}
                      onChange={(e) =>
                        setStudent((v) => ({
                          ...v,
                          class_level: e.target.value,
                          class_stream: "",
                        }))
                      }
                    >
                      <option value="">Choose class level</option>
                      {(isAdmin || accountant
                        ? adminClassLevels
                        : [
                            ...new Set(
                              teacherAssignments.map((a) => a.class_level),
                            ),
                          ]
                      ).map((level) => (
                        <option key={level}>{level}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Class stream
                    <select
                      aria-label="Class stream"
                      required
                      disabled={
                        !student.class_level ||
                        isJuniorLevel(student.class_level)
                      }
                      value={student.class_stream}
                      onChange={(e) =>
                        setStudent((v) => ({
                          ...v,
                          class_stream: e.target.value,
                        }))
                      }
                    >
                      <option value="">
                        {isJuniorLevel(student.class_level)
                          ? "N/A (Junior)"
                          : "Choose class stream"}
                      </option>
                      {(isAdmin || accountant
                        ? streamsForAdminLevel(student.class_level)
                        : teacherAssignments
                            .filter(
                              (a) => a.class_level === student.class_level,
                            )
                            .map((a) => a.class_stream)
                            .filter(Boolean)
                      ).map((stream) => (
                        <option key={stream}>{stream}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Enrolled year
                    <input
                      required
                      type="number"
                      value={student.enrolled_year}
                      onChange={(e) =>
                        setStudent((v) => ({
                          ...v,
                          enrolled_year: e.target.value,
                        }))
                      }
                    />
                  </label>
                  <div className="portal-action-row">
                    <Button type="submit" disabled={savingLearner}>
                      {savingLearner ? 'Saving learner…' : editingId ? "Save changes" : "Add learner"}
                    </Button>
                    {editingId && (
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={cancelLearnerEdit}
                      >
                        Cancel
                      </Button>
                    )}
                  </div>
                </form>
                {duplicateLearners && <section role="alert" className="portal-notice"><h3>Could this learner already be enrolled?</h3><p>Similar names can be different learners. Compare the date of birth and class. Replacing updates the name and birth date on the existing record and keeps its admission number, class, fees and marks.</p>{duplicateLearners.map(match => <div key={match.id}><p><strong>{match.full_name}</strong> · {match.date_of_birth} · {match.class_level} {match.class_stream} · {match.admission_number}</p><Button type="button" variant="secondary" disabled={savingLearner} onClick={() => { if (window.confirm(`Update ${match.full_name} (${match.admission_number}) with the entered name and birth date?`)) saveStudent(null, true, match.id); }}>Replace this learner's details</Button></div>)}<div className="portal-action-row"><Button type="button" disabled={savingLearner} onClick={() => saveStudent(null, true)}>Save as a different learner</Button><Button type="button" variant="secondary" disabled={savingLearner} onClick={() => setDuplicateLearners(null)}>Cancel</Button></div></section>}
              </Card>
  );

  if (section === "learner-edit" && isAdmin) {
    const params = new URLSearchParams(location.search);
    const learnerId = params.get("learner");
    const learner = students.find((row) => row.id === learnerId);
    const returnToRoster = () => navigate({ pathname: location.pathname, search: learnerReturnSearch(location.search) });
    return (
      <div className="staff-content-area">
        <div className="dash-section record-entry-page">
          <div className="dash-page-header">
            <Button type="button" variant="secondary" onClick={returnToRoster}>← Back to learner register</Button>
            <h1>Edit learner</h1>
            <p>Update this learner’s details, then return to the learner register.</p>
          </div>
          {editingId === learnerId && learner ? renderLearnerEditor() : loading ? <p role="status">Loading learner record…</p> : <PortalNotice tone="error">This learner could not be found in your school scope. Return to the learner register and choose a learner there.</PortalNotice>}
        </div>
      </div>
    );
  }
  if (section === "reconciliation" && (isMainAdmin || accountant))
    return (
      <div className="staff-content-area">
        <FinanceReconciliation supabase={supabase} profile={profile} />
      </div>
    );

  if (section === "inventory" && ((isAdmin && ["all", "junior", "senior"].includes(profile?.campus)) || (accountant && ["junior", "senior"].includes(profile?.campus))))
    return (
      <div className="staff-content-area">

        <InventoryPOS
          key={`${user.id}:${shopRole}`}
          supabase={supabase}
          user={user}
          profile={profile}
        />
      </div>
    );

  if (
    section === "expenses" &&
    (isMainAdmin || activeRole === "principal" || accountant)
  )
    return (
      <div className="staff-content-area">
        <ExpensesCashbook supabase={supabase} user={user} profile={profile} />
      </div>
    );

  if (profileStudent && section === profileOrigin.section)
    return (
      <StaffLearnerProfile
        supabase={supabase}
        student={profileStudent}
        teacherView={isTeacher}
        canManageReports={manager}
        initialTab={profileInitialTab}
        backLabel={isTeacher ? (teacherWorkspace === "subjects" ? "Back to subject learners" : "Back to class learners") : profileOrigin.label}
        teacherScopeLabel={isTeacher ? teacherScopeLabel : ""}
        onBack={() => { setProfileStudent(null); setProfileInitialTab("Summary"); setSection(profileOrigin.section); }}
      />
    );

  if (section === "learner-profiles" && accountant)
    return (
      <div className="staff-content-area">
        <AccountantLearnerProfiles
          students={filteredStudents}
          campus={profile?.campus || "junior"}
          onOpenProfile={(student) => openLearnerProfile(student, { origin: "learner-profiles" })}
        />
      </div>
    );

  if (section === "parent-accounts" && (isAdmin || isAccountant))
    return <div className="staff-content-area"><ParentAccountSupport supabase={supabase} user={user} profile={profile} /></div>;

  if (section === "progress-reports" && (isAdmin || isAccountant || isTeacher))
    return <div className="staff-content-area"><ProgressReports students={filteredStudents} loading={loading} scopeLabel={isTeacher ? teacherScopeLabel : managerCampusScope ? `${managerCampusScope === "junior" ? "Junior" : "Senior"} School` : "All school"} query={progressQuery} onQueryChange={setProgressQuery} onOpenProgress={student => openLearnerProfile(student, { initialTab: isTeacher ? "Summary" : "Academics", origin: "progress-reports" })} /></div>;
  if (section === "historical-reports" && (manager || isAccountant))
    return <div className="staff-content-area"><ReportClassHistory supabase={supabase} campusScope={managerCampusScope || "all"} canReview={isAdmin} /></div>;
  if (section === "subject-catalog" && isMainAdmin)
    return <div className="staff-content-area"><SubjectCatalogManager supabase={supabase} /></div>;

  if (section === "library-support" && (isAdmin || accountant))
    return <div className="staff-content-area"><LibrarySupport key={`${activeRole}:${profile?.campus}`} /></div>;
  /* Accountant: show fees dashboard */
  if (accountant)
    return (
      <div className="staff-content-area">
        <FeesDashboard
          students={filteredStudents}
          loading={loading}
          supabase={supabase}
          user={user}
          profile={profile}
          onOpenStudent={(student) => openLearnerProfile(student, { origin: "fees" })}
          onOpenPaymentHistory={(student) => openLearnerProfile(student, { initialTab: "Fees", origin: "fees" })}
          onStudentAdded={loadStudents}
        />
      </div>
    );

  /* Section: Fees */
  if (section === "fees")
    return (
      <div className="staff-content-area">
        <FeesDashboard
          students={filteredStudents}
          loading={loading}
          supabase={supabase}
          user={user}
          profile={profile}
          onOpenStudent={(student) => openLearnerProfile(student, { origin: "fees" })}
          onOpenPaymentHistory={(student) => openLearnerProfile(student, { initialTab: "Fees", origin: "fees" })}
          onStudentAdded={loadStudents}
        />
      </div>
    );

  if (section === "activity" && manager)
    return (
      <div className="staff-content-area">
        <ActivityLog campusScope={managerCampusScope} />
      </div>
    );
  if (section === "bulk-import" && isAdmin)
    return (
      <div className="staff-content-area">
        <div className="dash-section">
          <div className="dash-page-header">
            <div>
              <h1 className="dash-page-title">Bulk learner export</h1>
              <p className="dash-page-sub">{adminCampusScope ? `Prepare a printable learner register for classes and streams in the ${adminCampusScope} campus.` : "Prepare a printable learner register for a class, stream, campus, or the whole school."}</p>
            </div>
          </div>
          <BulkLearnerExport supabase={supabase} campusScope={adminCampusScope || "all"} />
        </div>
      </div>
    );
  if (section === "report-settings" && isAdmin)
    return (
      <div className="staff-content-area">
        <div className="dash-section">
          <div className="dash-page-header">
            <div>
              <h1 className="dash-page-title">Report settings</h1>
              <p className="dash-page-sub">Set the report term’s next-term date and fee schedule before generating report books.</p>
            </div>
          </div>
          <ReportTermSettings
            supabase={supabase}
            campusScope={adminCampusScope || "all"}
            onClose={() => setSection("dashboard")}
            onSaved={() => setNotice("Report settings saved.")}
          />
        </div>
      </div>
    );
  if (section === "grade-bands" && canManageJuniorAcademicSettings)
    return <div className="staff-content-area"><GradeBands campusScope={isMainAdmin ? "all" : "junior"} /></div>;
  if (section === "coursework" && isTeacher)
    return <div className="staff-content-area">{isJuniorTeacher ? <JuniorCourseWork /> : <CourseWork />}</div>;

  if (section === "newsletters" && isAdmin)
    return <div className="staff-content-area"><AdminNewsletters /></div>;
  if (section === "library" && isTeacher)
    return <div className="staff-content-area"><TeacherLearningLibrary /></div>;
  if (section === "classes" && isAdmin)
    return (
      <div className="staff-content-area">
        <ClassManager
          supabase={supabase}
          onChanged={loadSchoolClasses}
          campusScope={["junior", "senior"].includes(profile?.campus) ? profile.campus : "all"}
        />
      </div>
    );

  if (section === "year-planning" && isAdmin)
    return <div className="staff-content-area"><YearRolloverReadiness supabase={supabase} campusScope={adminCampusScope || "all"} /></div>;

  if (section === "year-rollover" && isAdmin)
    return <div className="staff-content-area"><YearRolloverWorkflow supabase={supabase} campusScope={adminCampusScope || "all"} /></div>;

  if (section === "reporting-periods" && isAdmin)
    return <div className="staff-content-area"><ReportingPeriods supabase={supabase} campusScope={adminCampusScope || "all"} /></div>;

  if (section === "settings")
    return (
      <div className="staff-content-area">
        <StaffAccountSettings supabase={supabase} profile={profile} />
      </div>
    );

  return (
    <div className="staff-content-area">
      {notice && <PortalNotice>{notice}</PortalNotice>}
      {error && <PortalNotice tone="error">{error}{rosterRefreshFailed && !savedLearnerConfirmation?.error && <Button type="button" variant="secondary" onClick={() => { setError(""); setRosterRefreshFailed(false); void loadStudents(); }}>Refresh learners</Button>}</PortalNotice>}

      {/* Dashboard Home */}
      {section === "dashboard" && (
        isJuniorTeacher ? <JuniorTeacherHome
          students={filteredStudents}
          loading={loading}
          setSection={setSection}
          profile={profile}
          onOpenClassSection={(nextSection, assignment) => {
            setActiveClassKey(`${assignment.class_level}:${assignment.class_stream || ""}`);
            setActiveClassFilter({ level: assignment.class_level, stream: assignment.class_stream || null });
            setSection(nextSection);
          }}
        /> : <DashboardHome
          students={filteredStudents}
          staff={staff}
          loading={loading}
          setSection={setSection}
          role={activeRole}
          supabase={supabase}
          teacherScopeLabel={teacherScopeLabel}
          teacherWorkspace={teacherWorkspace}
          campusScope={adminCampusScope || "all"}
        />
      )}

      {/* Roster */}
      {section === "roster" && (
        <div className="dash-section record-entry-page">
          <div className="dash-page-header">
            <div>
              <h1 className="dash-page-title">Learner Roster</h1>
              <p className="dash-page-sub">
                {isTeacher
                  ? activeClassScopeLabel
                    ? `Working in ${activeClassScopeLabel}. Mark today’s register, then open a learner for weekly and monthly attendance history.`
                    : "Choose a class above, then mark today’s register or open a learner for attendance history."
                  : isCampusAdmin
                    ? `Manage learner records for the ${adminCampusScope === "junior" ? "Junior" : "Senior"} campus.`
                    : "All enrolled learners and records"}
              </p>
            </div>
          </div>

          <div className="portal-workspace">
            <Card>
              <div className="portal-card-title">
                <h2 ref={rosterHeading} tabIndex={-1}>{isCampusAdmin ? `${adminCampusScope === "junior" ? "Junior" : "Senior"} learner register` : "Learner roster"}</h2>
                <label className="portal-inline-search">
                  Search
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Name or admission number"
                  />
                </label>
                {isCampusAdmin && <span className="portal-scope-label">Campus locked to {adminCampusScope === "junior" ? "Junior School" : "Senior School"}</span>}
                {isTeacher && activeClassScopeLabel && <span className="portal-scope-label">Class Work · {activeClassScopeLabel}</span>}
              </div>
              {(isTeacher || isAdmin) && (
                <div className="portal-actions" aria-label="Learner roster status filter">
                  <Button type="button" variant={showDisabledLearners ? "secondary" : "primary"} aria-pressed={!showDisabledLearners} onClick={() => setShowDisabledLearners(false)}>
                    Active learners ({scopedStudents.filter((row) => row.status === 'active').length})
                  </Button>
                  <Button type="button" variant={showDisabledLearners ? "primary" : "secondary"} aria-pressed={showDisabledLearners} onClick={() => setShowDisabledLearners(true)}>
                    {isAdmin ? 'Disabled learners' : 'Disabled · read only'} ({scopedStudents.filter((row) => row.status === 'inactive').length})
                  </Button>
                </div>
              )}
              {isMainAdmin && <BulkLearnerActions key={`${activeAdminCampusScope}:${activeClassFilter?.level || ""}:${activeClassFilter?.stream || ""}:${showDisabledLearners}:${query}`} learners={visible} onComplete={loadStudents} />}
              {isTeacher && showDisabledLearners && <p className="muted" role="status">Disabled learners are excluded from class totals and cannot be edited from the teacher portal.</p>}
              {isTeacher && savedLearnerConfirmation && (
                <PortalNotice tone={savedLearnerConfirmation.error ? 'error' : 'success'} role="status">
                  {savedLearnerConfirmation.message}
                  {savedLearnerConfirmation.error && <Button type="button" variant="secondary" onClick={refreshSavedLearner}>Refresh learners</Button>}
                </PortalNotice>
              )}
              {loading ? (
                <p className="muted">
                  Loading learners…
                </p>
              ) : (
                <div className="portal-table-wrap">
                  <MobileRecordTable className={`portal-table mobile-record-table${isTeacher ? ' teacher-roster-table' : ''}`} aria-label="Learner register">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Admission no.</th>
                        {isTeacher ? <th>Class · Stream</th> : <><th>Class</th><th>Stream</th></>}
                        <th>Status</th>
                        {isTeacher && <th>Today's Attendance</th>}
                        {(isAdmin || isTeacher) && <th>Actions</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {visible.map((row) => (
                        <tr key={row.id} id={`learner-row-${row.id}`} className="dash-table-row">
                          <td className={`dash-td-name${isTeacher ? ' teacher-roster-name-cell' : ''}`}>
                            <span className="dash-learner-avatar">
                              {row.full_name?.[0] ?? "?"}
                            </span>
                            {isTeacher ? (
                              row.status === 'inactive' ? <span>{row.full_name}</span> : <button
                                type="button"
                                className="roster-learner-link"
                                onClick={() => openLearnerProfile(row, { origin: "roster" })}
                                aria-label={`Open learner profile for ${row.full_name}`}
                              >
                                {row.full_name}
                              </button>
                            ) : canViewLearnerProfile ? (
                              <button
                                type="button"
                                className="roster-learner-link"
                                onClick={() => openLearnerProfile(row, { origin: "roster" })}
                                aria-label={`Open profile for ${row.full_name}`}
                              >
                                {row.full_name}
                              </button>
                            ) : (
                              row.full_name
                            )}
                          </td>
                          <td className="mono">{row.admission_number}</td>
                          {isTeacher ? <td className="teacher-roster-class-cell" title={`${row.class_level || ''}${row.class_stream ? ` · ${row.class_stream}` : ''}`}>{row.class_level}{row.class_stream ? ` · ${row.class_stream}` : ''}</td> : <>
                            <td>{row.role === "teacher" ? row.teacher_class_assignments?.map((a) => a.class_level).join(", ") || "-" : row.class_level}</td>
                            <td>{row.role === "teacher" ? row.teacher_class_assignments?.map((a) => a.class_stream).filter(Boolean).join(", ") || "-" : row.class_stream || "-"}</td>
                          </>}
                          <td className="learner-status-cell">
                            <StatusPill status={row.status} />
                          </td>
                          {isTeacher && (
                            <td className={isTeacher ? 'teacher-roster-attendance-cell' : undefined}>
                              {row.status === "active" ? (
                                <button
                                  type="button"
                                  className={`roster-attendance-action${todayAttendance[row.id] === "present" ? " is-present" : ""}`}
                                  onClick={() =>
                                    handleToggleAttendance(
                                      row.id,
                                      todayAttendance[row.id],
                                    )
                                  }
                                  disabled={Boolean(savingAttendance[row.id])}
                                  aria-label={
                                    todayAttendance[row.id] === "present"
                                      ? `Marked present today for ${row.full_name}. Click to undo.`
                                      : `Mark ${row.full_name} present today`
                                  }
                                >
                                  <span aria-hidden="true">
                                    {todayAttendance[row.id] === "present"
                                      ? "✓"
                                      : "+"}
                                  </span>
                                  {savingAttendance[row.id]
                                    ? "Saving…"
                                    : todayAttendance[row.id] === "present"
                                      ? "Present today"
                                      : "Mark present"}
                                </button>
                              ) : (
                                <span className="roster-inactive-attendance">
                                  {row.record_disable_reason ? 'Disabled for review' : 'Left school'}
                                </span>
                              )}
                            </td>
                          )}
                          {(isAdmin || isTeacher) && (
                            <td className={isTeacher ? 'teacher-roster-actions-cell' : 'learner-roster-actions-cell'}>
                              {isAdmin ? <div className="learner-roster-actions">
                                <Button variant="secondary" onClick={() => editStudent(row)}>Edit</Button>
                                {row.status !== 'inactive' && <Button variant="secondary" onClick={() => disableLearner(row)}>Disable learner</Button>}
                                {row.status === 'inactive' && <Button variant="secondary" onClick={() => activateDisabledLearner(row)}>Activate learner</Button>}
                                <Button variant="secondary" onClick={() => deleteLearner(row)}>Delete learner</Button>
                              </div> : row.status !== 'inactive' && <Button variant="secondary" onClick={() => disableLearner(row)}>Disable learner</Button>}
                              {row.record_disable_reason && <small className="learner-disable-reason">{row.record_disable_reason}</small>}
                              {isTeacher && row.status === 'inactive' && <small>Read only</small>}
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </MobileRecordTable>
                  {!visible.length && <p className="muted" role="status">No learners match this search in your current scope.</p>}
                </div>
              )}
            </Card>

            {isTeacher && (
              <SlideOver
                open={Boolean(attendanceStudent)}
                onClose={() => setAttendanceStudent(null)}
                title="Attendance history"
                description="Review this learner's daily attendance by week or month."
              >
                {attendanceStudent && (
                  <TeacherAttendanceHistory
                    supabase={supabase}
                    student={attendanceStudent}
                    onClose={() => setAttendanceStudent(null)}
                  />
                )}
              </SlideOver>
            )}

            {(isAdmin || activeRole === "teacher" || accountant) && renderLearnerEditor()}
          </div>
        </div>
      )}

      {/* ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚ÂÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â Data Entry ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚ÂÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â */}
      {section === "entry" &&
        (activeRole === "teacher" ? (
          isJuniorTeacher
            ? <JuniorTeacherMarkbook />
            : <TeacherGradeEntry key={`${selectedSubjectAllocationId}:${selectedSubject}:${selectedSubjectLevel}`} />
        ) : (
          <div className="dash-section record-entry-page">
            <div className="dash-page-header">
              <div>
                <h1 className="dash-page-title">Data Entry</h1>
                <p className="dash-page-sub">
                  Record attendance, academic, behaviour and sports data
                </p>
              </div>
            </div>

            <div className="portal-workspace record-entry-workspace">
              <Card className="record-entry-card">
                <div className="record-entry-heading">
                  <div>
                    <p className="record-entry-kicker">Step 1</p>
                    <h2>Choose learner &amp; record type</h2>
                    <p>
                      Find a learner first, then select the type of school
                      record to add.
                    </p>
                  </div>
                  {selected && (
                    <div className="record-entry-selected">
                      <strong>{selected.full_name}</strong>
                      <span>
                        {selected.admission_number} · {selected.class_level}{" "}
                        {selected.class_stream || ""}
                      </span>
                    </div>
                  )}
                </div>
                <StudentSelector
                  students={filteredStudents}
                  value={selectedId}
                  onChange={setSelectedId}
                  query={query}
                  onQueryChange={setQuery}
                  loading={loading}
                />
                <div
                  className="portal-tabs portal-entry-tabs record-entry-tabs"
                  aria-label="Record type"
                >
                  {Object.keys(records).map((key) => (
                    <Button
                      key={key}
                      variant={tab === key ? "primary" : "secondary"}
                      onClick={() => setTab(key)}
                    >
                      {key === "behavior"
                        ? "Behaviour"
                        : key[0].toUpperCase() + key.slice(1)}
                    </Button>
                  ))}
                </div>
                <form
                  className="form portal-form record-entry-form"
                  onSubmit={saveRecord}
                >
                  {tab === "attendance" && (
                    <>
                      <label>
                        Date
                        <input
                          required
                          type="date"
                          value={forms.attendance.date}
                          onChange={update("attendance", "date")}
                        />
                      </label>
                      <label>
                        Status
                        <select
                          value={forms.attendance.status}
                          onChange={update("attendance", "status")}
                        >
                          <option>present</option>
                          <option>late</option>
                          <option>absent</option>
                        </select>
                      </label>
                      <label>
                        Note
                        <textarea
                          value={forms.attendance.note}
                          onChange={update("attendance", "note")}
                        />
                      </label>
                    </>
                  )}
                  {tab === "academic" && (
                    <>
                      {["term", "subject", "score", "grade", "comment"].map(
                        (key) => (
                          <label key={key}>
                            {key}
                            <input
                              required={key !== "comment"}
                              type={key === "score" ? "number" : "text"}
                              value={forms.academic[key]}
                              onChange={update("academic", key)}
                            />
                          </label>
                        ),
                      )}
                    </>
                  )}
                  {tab === "behavior" && (
                    <>
                      {["category", "description"].map((key) => (
                        <label key={key}>
                          {key}
                          <input
                            required
                            value={forms.behavior[key]}
                            onChange={update("behavior", key)}
                          />
                        </label>
                      ))}
                      <label>
                        Severity
                        <select
                          value={forms.behavior.severity}
                          onChange={update("behavior", "severity")}
                        >
                          <option>positive</option>
                          <option>minor</option>
                          <option>major</option>
                        </select>
                      </label>
                    </>
                  )}
                  {tab === "sports" && (
                    <>
                      {["activity", "term", "achievement", "note"].map(
                        (key) => (
                          <label key={key}>
                            {key}
                            <input
                              required={key === "activity" || key === "term"}
                              value={forms.sports[key]}
                              onChange={update("sports", key)}
                            />
                          </label>
                        ),
                      )}
                    </>
                  )}
                  {tab === "awards" && (
                    <>
                      <label>
                        Award
                        <select
                          value={forms.awards.award_type}
                          onChange={update("awards", "award_type")}
                        >
                          <option value="most_behaved">Most Behaved</option>
                          <option value="smartest">Smartest</option>
                          <option value="best_in_subject">
                            Best Student in Subject
                          </option>
                          <option value="overall_best_student">
                            Overall Best Student
                          </option>
                          <option value="sports_person">Sports Person</option>
                        </select>
                      </label>
                      {forms.awards.award_type === "best_in_subject" && (
                        <label>
                          Subject
                          <input
                            required
                            value={forms.awards.subject}
                            onChange={update("awards", "subject")}
                          />
                        </label>
                      )}
                      <label>
                        Term
                        <input
                          required
                          value={forms.awards.term}
                          onChange={update("awards", "term")}
                        />
                      </label>
                      <label>
                        Year
                        <input
                          required
                          type="number"
                          value={forms.awards.academic_year}
                          onChange={update("awards", "academic_year")}
                        />
                      </label>
                      <label>
                        Note
                        <textarea
                          value={forms.awards.note}
                          onChange={update("awards", "note")}
                        />
                      </label>
                    </>
                  )}
                  <div className="record-entry-save">
                    <span>
                      {selected
                        ? `Saving to ${selected.full_name}'s record`
                        : "Choose a learner to enable saving"}
                    </span>
                    <Button type="submit" disabled={!selected}>
                      Save {tab === "behavior" ? "behaviour" : tab} record
                    </Button>
                  </div>
                </form>
              </Card>

              <Card className="record-entry-recent">
                <div className="record-entry-heading">
                  <div>
                    <p className="record-entry-kicker">Activity</p>
                    <h2>Recent entries</h2>
                    <p>
                      {selected
                        ? `Latest records for ${selected.full_name}.`
                        : "Choose a learner to reveal their recent records."}
                    </p>
                  </div>
                </div>
                {selected ? (
                  recent.map((row) => (
                    <div className="record-entry-row" key={row.id}>
                      <strong>
                        {row.date ||
                          row.subject ||
                          row.category ||
                          row.activity}
                      </strong>
                      <span>
                        {row.status || row.grade || row.severity || row.term}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="muted">Select a learner to view entries.</p>
                )}
              </Card>
            </div>
          </div>
        ))}

      {/* ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚ÂÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â Staff ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚ÂÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â */}
      {section === "staff" && manager && (
        <div className="dash-section staff-management-page">
          <div className="dash-page-header">
            <div>
              <p className="eyebrow">{activeRole === "principal" ? "Staff directory" : isMainAdmin ? "School administration" : `${managerCampusScope === "junior" ? "Junior" : "Senior"} campus administration`}</p>
              <h1 className="dash-page-title">Staff Management</h1>
              <p className="dash-page-sub">{activeRole === "principal" ? "Review staff accounts and teaching allocations across the school." : isMainAdmin ? "Create and manage staff accounts across Reliance Learning Centre." : `Manage non-admin staff accounts and assignments for the ${managerCampusScope} campus only.`}</p>
              {isAdmin && (
                <Button type="button" onClick={openStaffCreateModal}>
                  + Add Staff Member
                </Button>
              )}
            </div>
          </div>

          {isAdmin && <div className={`staff-management-authority ${isMainAdmin ? "is-main" : "is-campus"}`}>
            <strong>{isMainAdmin ? "School-wide staff authority" : `${adminCampusScope === "junior" ? "Junior" : "Senior"} campus staff authority`}</strong>
            <span>{isMainAdmin ? "You can manage staff across both campuses, including campus administrators and credentials." : "Main Admin accounts, the other campus, and administrator credentials remain protected."}</span>
          </div>}

          <div className="portal-workspace staff-management-workspace">
            {isAdmin && (
              <SlideOver
                open={staffModal}
                onClose={() => setStaffModal(false)}
                title="Add staff member"
                description="Create a secure portal account and set the appropriate role."
              >
                <form className="form portal-form" onSubmit={createStaff}>
                  <label>
                    Full legal name
                    <input
                      required
                      value={staffForm.legalFullName}
                      onChange={(e) =>
                        setStaffForm((x) => ({
                          ...x,
                          legalFullName: e.target.value,
                        }))
                      }
                    />
                  </label>
                  <label>
                    Working title
                    <select value={staffForm.workingTitle} onChange={(e) => setStaffForm((x) => ({ ...x, workingTitle: e.target.value }))}>
                      <option value="Mr">Mr</option>
                      <option value="Ms">Ms</option>
                      <option value="Mrs">Mrs</option>
                    </select>
                  </label>
                  <p className="muted" style={{ gridColumn: "1 / -1", marginTop: 0 }}>
                    Portal working name: <strong>{workingNameFor(staffForm.legalFullName, staffForm.workingTitle) || "Enter the legal name to preview"}</strong>. The legal name is kept for verified records and future signature initials.
                  </p>
                  <label>
                    Phone
                    <input
                      required
                      value={staffForm.phone}
                      onChange={(e) =>
                        setStaffForm((x) => ({ ...x, phone: e.target.value }))
                      }
                    />
                  </label>
                  <PasswordInput
                    id="new-staff-password"
                    label="Password"
                    required
                    minLength={8}
                    autoComplete="new-password"
                    value={staffForm.password}
                    onChange={(e) =>
                      setStaffForm((x) => ({ ...x, password: e.target.value }))
                    }
                  />
                  <label>
                    Role
                    <select
                      value={staffForm.role}
                      onChange={(e) =>
                        setStaffForm((x) => ({
                          ...x,
                          role: e.target.value,
                          classLevel: "",
                          classStream: "",
                          classAssignments: [],
                          subjectAssignments: [],
                          subjectName: "",
                        }))
                      }
                    >
                      <option value="teacher">Teacher</option>
                      <option value="accountant">Accountant</option>
                      {!isCampusAdmin && <option value="admin">Admin</option>}
                      {!isCampusAdmin && <option value="principal">Principal</option>}
                    </select>
                  </label>
                  <label>
                    Campus
                    {isCampusAdmin ? (
                      <input readOnly value={`${adminCampusScope === "junior" ? "Junior" : "Senior"} School`} aria-label="Campus locked to your admin campus" />
                    ) : (
                      <select value={staffForm.campus} onChange={(e) => setStaffForm((x) => ({ ...x, campus: e.target.value, classLevel: "", classStream: "", classAssignments: [], subjectAssignments: [], subjectName: "" }))}>
                        <option value="junior">Junior School</option>
                        <option value="senior">Senior School</option>
                      </select>
                    )}
                  </label>
                  {staffForm.role === "teacher" && (
                    <>
                      <fieldset style={{ gridColumn: "1 / -1" }}>
                        <legend>Class-teacher responsibility <span className="muted">(optional)</span></legend>
                        <p className="muted" style={{ marginTop: 0 }}>
                          Add every class and stream this teacher leads. Subject-only teachers can be created without a class assignment.
                        </p>
                        <div className="portal-form" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", alignItems: "end" }}>
                          <label>Class<select value={staffForm.classLevel} onChange={(e) => setStaffForm((x) => ({ ...x, classLevel: e.target.value, classStream: "" }))}><option value="">Choose class</option>{adminClassLevels.filter((level) => staffForm.campus === "junior" ? isJuniorLevel(level) : !isJuniorLevel(level)).map((level) => <option key={level} value={level}>{level}</option>)}</select></label>
                          {staffForm.campus === "senior" ? <label>Stream scope<select value={staffForm.classStream} disabled={!staffForm.classLevel} onChange={(e) => setStaffForm((x) => ({ ...x, classStream: e.target.value }))}><option value="">Choose a stream scope</option><option value="__all__">Whole form · all streams</option>{streamsForAdminLevel(staffForm.classLevel).map((stream) => <option key={stream} value={stream}>{stream}</option>)}</select></label> : <p className="muted" style={{ margin: 0 }}>Junior classes do not use streams.</p>}
                          <Button type="button" variant="secondary" onClick={addStaffClassAssignment}>Add class</Button>
                        </div>
                        {staffForm.classAssignments.length ? <div className="allocation-chip-list">{staffForm.classAssignments.map((assignment, index) => <span className="allocation-chip" key={`${assignment.class_level}-${assignment.class_stream}-${index}`}>{staffClassAssignmentLabel(assignment)}<button type="button" aria-label={`Remove ${staffClassAssignmentLabel(assignment)}`} onClick={() => setStaffForm((x) => ({ ...x, classAssignments: x.classAssignments.filter((_, position) => position !== index) }))}>×</button></span>)}</div> : null}
                        <p className="muted" style={{ marginBottom: 0 }}>
                          {staffForm.classAssignments.length
                            ? `${staffForm.classAssignments.length} class${staffForm.classAssignments.length === 1 ? "" : "es"} selected.`
                            : "No class teacher assignment — this teacher can still be given subject allocations later."}
                        </p>
                      </fieldset>
                      {staffForm.campus === "senior" ? <fieldset style={{ gridColumn: "1 / -1" }}>
                        <legend>Subject allocations</legend>
                        <p className="muted" style={{ marginTop: 0 }}>Add the subjects this teacher teaches. These are available immediately in their Subject workspace.</p>
                        <div className="portal-action-row">
                          <select value={staffForm.subjectName} disabled={!staffForm.classLevel} onChange={(e) => setStaffForm((x) => ({ ...x, subjectName: e.target.value }))}>
                            <option value="">Choose subject</option>
                            {subjectOptionsForLevel(staffForm.classLevel, staffForm.campus, staffForm.classStream).map(({ subject }) => <option key={subject} value={subject}>{subject}</option>)}
                          </select>
                          <Button type="button" variant="secondary" onClick={() => setStaffForm((x) => !x.subjectName ? x : ({ ...x, subjectAssignments: x.subjectAssignments.includes(x.subjectName) ? x.subjectAssignments : [...x.subjectAssignments, x.subjectName], subjectName: "" }))}>Add subject</Button>
                        </div>
                        {staffForm.subjectAssignments.length ? <div className="allocation-chip-list">{staffForm.subjectAssignments.map((subject) => <span className="allocation-chip" key={subject}>{subject}<button type="button" onClick={() => setStaffForm((x) => ({ ...x, subjectAssignments: x.subjectAssignments.filter((value) => value !== subject) }))}>×</button></span>)}</div> : <p className="muted">No subjects selected yet.</p>}
                      </fieldset> : <p className="muted" style={{ gridColumn: "1 / -1", margin: 0 }}>Junior teachers work from their class assignment only. Their Markbook and Course Work do not use subject allocations.</p>}
                    </>
                  )}
                  <div className="portal-action-row">
                    <Button type="submit">Create account</Button>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => setStaffModal(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              </SlideOver>
            )}

            {isAdmin && staffEditor.open && (
              <SlideOver
                open={staffEditor.open}
                onClose={closeStaffEditor}
                title={`Manage ${staffEditor.staff?.full_name || "staff member"}`}
                description="Update their account details, class allocations and portal access. Removing a class allocation immediately leaves that class unassigned unless another active teacher is allocated."
              >
                <form className="form portal-form" onSubmit={saveStaffEditor}>
                  <label>
                    Full legal name
                    <input
                      value={staffEditor.legalFullName}
                      onChange={(e) => setStaffEditor((value) => ({ ...value, legalFullName: e.target.value }))}
                    />
                  </label>
                  <label>
                    Working title
                    <select value={staffEditor.workingTitle} onChange={(e) => setStaffEditor((value) => ({ ...value, workingTitle: e.target.value }))}>
                      <option value="Mr">Mr</option>
                      <option value="Ms">Ms</option>
                      <option value="Mrs">Mrs</option>
                    </select>
                  </label>
                  <p className="muted" style={{ gridColumn: "1 / -1", marginTop: 0 }}>
                    {staffEditor.legalFullName
                      ? <>Portal working name: <strong>{workingNameFor(staffEditor.legalFullName, staffEditor.workingTitle)}</strong>.</>
                      : <>This existing account keeps its current working name <strong>{staffEditor.fullName || "—"}</strong> until its verified legal full name is entered. No name has been guessed.</>}
                  </p>
                  <label>
                    Campus
                    {isCampusAdmin ? (
                      <input readOnly value={`${adminCampusScope === "junior" ? "Junior" : "Senior"} School`} aria-label="Campus locked to your admin campus" />
                    ) : (
                      <select
                        value={staffEditor.campus}
                        onChange={(e) => setStaffEditor((value) => ({
                          ...value,
                          campus: e.target.value,
                          classAssignments: [],
                          classAllocationLevel: "",
                          classAllocationStream: "",
                          editingClassAssignmentIndex: null,
                          subjectAssignments: [],
                          subjectLevel: "",
                          subjectStream: "",
                        }))}
                      >
                        <option value="junior">Junior School</option>
                        <option value="senior">Senior School</option>
                      </select>
                    )}
                  </label>
                  {staffEditor.staff?.role === "teacher" && (
                    <>
                      <fieldset style={{ gridColumn: "1 / -1" }}>
                        <legend>Teaching allocations</legend>
                        <div className="portal-action-row" role="tablist" aria-label="Teacher allocation type">
                          <Button type="button" variant={staffEditor.allocationTab === "classes" ? "primary" : "secondary"} onClick={() => setStaffEditor((value) => ({ ...value, allocationTab: "classes" }))}>Classes</Button>
                          {staffEditor.campus === "senior" && <Button type="button" variant={staffEditor.allocationTab === "subjects" ? "primary" : "secondary"} onClick={() => setStaffEditor((value) => ({ ...value, allocationTab: "subjects" }))}>Subjects</Button>}
                        </div>
                        {staffEditor.allocationTab === "classes" || staffEditor.campus === "junior" ? <>
                        <p className="muted" style={{ marginTop: 0 }}>
                          Add each class and stream this teacher leads. A class with no active teacher will be marked Unassigned in Class Management.
                        </p>
                        <div className="portal-form" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", alignItems: "end" }}>
                          <label>Class<select value={staffEditor.classAllocationLevel} onChange={(e) => setStaffEditor((value) => ({ ...value, classAllocationLevel: e.target.value, classAllocationStream: "" }))}><option value="">Choose class</option>{adminClassLevels.filter((level) => staffEditor.campus === "junior" ? isJuniorLevel(level) : !isJuniorLevel(level)).map((level) => <option key={level} value={level}>{level}</option>)}</select></label>
                          {staffEditor.campus === "senior" ? <label>Stream scope<select value={staffEditor.classAllocationStream} disabled={!staffEditor.classAllocationLevel} onChange={(e) => setStaffEditor((value) => ({ ...value, classAllocationStream: e.target.value }))}><option value="">Choose a stream scope</option><option value="__all__">Whole form · all streams</option>{streamsForAdminLevel(staffEditor.classAllocationLevel).map((stream) => <option key={stream} value={stream}>{stream}</option>)}</select></label> : <p className="muted" style={{ margin: 0 }}>Junior classes do not use streams.</p>}
                          <div className="portal-action-row">
                            <Button type="button" variant="secondary" onClick={addEditorClassAssignment}>{staffEditor.editingClassAssignmentIndex === null ? "Add class" : "Update allocation"}</Button>
                            {staffEditor.editingClassAssignmentIndex !== null && <Button type="button" variant="secondary" onClick={cancelStaffClassAssignmentEdit}>Cancel edit</Button>}
                          </div>
                        </div>
                        {staffEditor.classAssignments.length ? <div className="allocation-chip-list">{staffEditor.classAssignments.map((assignment, index) => <span className="allocation-chip" key={`${assignment.class_level}-${assignment.class_stream}-${index}`}><span>{staffClassAssignmentLabel(assignment)}</span><button className="allocation-chip-edit" type="button" aria-label={`Edit ${staffClassAssignmentLabel(assignment)}`} onClick={() => editStaffClassAssignment(index)}>Edit</button><button className="allocation-chip-remove" type="button" aria-label={`Remove ${staffClassAssignmentLabel(assignment)}`} onClick={() => removeStaffClassAssignment(index)}>Remove</button></span>)}</div> : <p className="muted">No class-teacher allocations are assigned.</p>}
                        </> : <>
                          <p className="muted" style={{ marginTop: 0 }}>
                            Choose the whole form or one stream for every subject allocation. Class-teacher responsibility remains optional and is controlled by the Classes tab.
                          </p>
                          <div className="portal-form" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", alignItems: "end" }}>
                            <label>Class<select value={staffEditor.subjectLevel} onChange={(e) => setStaffEditor((value) => ({ ...value, subjectLevel: e.target.value, subjectStream: "" }))}><option value="">Choose class</option>{adminClassLevels.filter((level) => staffEditor.campus === "junior" ? isJuniorLevel(level) : !isJuniorLevel(level)).map((level) => <option key={level} value={level}>{level}</option>)}</select></label>
                            <label>Teaching scope<select required={staffEditor.campus === "senior"} value={staffEditor.subjectStream} disabled={!staffEditor.subjectLevel} onChange={(e) => setStaffEditor((value) => ({ ...value, subjectStream: e.target.value }))}><option value="">{staffEditor.campus === "senior" ? "Choose a stream scope" : "Junior class · no streams"}</option>{staffEditor.campus === "senior" && <option value="__all__">All streams · whole form</option>}{streamsForAdminLevel(staffEditor.subjectLevel).map((stream) => <option key={stream} value={stream}>{stream} only</option>)}</select></label>
                            <label>Subject<select value={staffEditor.subjectName} disabled={!staffEditor.subjectLevel} onChange={(e) => setStaffEditor((value) => ({ ...value, subjectName: e.target.value }))}><option value="">Choose subject</option>{subjectOptionsForLevel(staffEditor.subjectLevel, staffEditor.campus, staffEditor.subjectStream).map(({ subject }) => <option key={subject} value={subject}>{subject}</option>)}</select></label>
                            <Button type="button" onClick={addSubjectAllocation}>Add subject</Button>
                          </div>
                          {staffEditor.subjectAssignments.length ? <div className="allocation-chip-list">{staffEditor.subjectAssignments.map((assignment, index) => <span className="allocation-chip" key={`${assignment.subject}-${assignment.class_level}-${assignment.class_stream}-${index}`}>{assignment.subject} · {assignment.class_level} · {assignment.class_stream || "Whole form"}<button type="button" aria-label={`Remove ${assignment.subject} from ${assignment.class_level}`} onClick={() => setStaffEditor((value) => ({ ...value, subjectAssignments: value.subjectAssignments.filter((_, position) => position !== index) }))}>×</button></span>)}</div> : <p className="muted">No subjects allocated yet.</p>}
                        </>}
                      </fieldset>
                    </>
                  )}
                  <div className="portal-action-row">
                    <Button type="submit" disabled={staffEditor.saving}>
                      {staffEditor.saving ? "Saving…" : "Save staff changes"}
                    </Button>
                    <Button type="button" variant="secondary" onClick={closeStaffEditor}>Cancel</Button>
                  </div>
                  <hr />
                  <div className="portal-action-row">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => changeStaffAccess(staffEditor.staff, staffEditor.staff.portal_access_enabled === false ? "reactivate" : "deactivate")}
                    >
                      {staffEditor.staff?.portal_access_enabled === false ? "Reactivate account" : "Deactivate account"}
                    </Button>
                    {isMainAdmin && (
                      <Button type="button" variant="secondary" className="class-manager-danger" onClick={() => deleteStaffAccount(staffEditor.staff)}>
                        Deactivate &amp; delete account
                      </Button>
                    )}
                  </div>
                </form>
              </SlideOver>
            )}

            {isAdmin && resetModal.open && (
              <Card>
                <h2>Reset credentials: {resetModal.staff?.full_name}</h2>
                <p className="muted" style={{ marginBottom: "1rem" }}>
                  Updating the phone number will automatically update their
                  login email to match{" "}
                  <code>portal-&lt;phone&gt;@portal.reliance.local</code>.
                </p>
                <form className="form portal-form" onSubmit={handleResetSubmit}>
                  <label>
                    Phone number
                    <input
                      required
                      value={resetModal.phone}
                      onChange={(e) =>
                        setResetModal((m) => ({ ...m, phone: e.target.value }))
                      }
                    />
                  </label>
                  <PasswordInput
                    id="reset-staff-password"
                    label="New password"
                    required
                    minLength={8}
                    autoComplete="new-password"
                    value={resetModal.password}
                    onChange={(e) =>
                      setResetModal((m) => ({ ...m, password: e.target.value }))
                    }
                  />
                  <div
                    className="portal-action-row"
                    style={{ marginTop: "1rem" }}
                  >
                    <Button type="submit" disabled={resetModal.saving}>
                      {resetModal.saving ? "Updating…" : "Save & Sync Email"}
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() =>
                        setResetModal({
                          open: false,
                          staff: null,
                          phone: "",
                          password: "",
                          saving: false,
                        })
                      }
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              </Card>
            )}

            <Card className="staff-directory-card">
              <div className="staff-directory-hero">
                <div>
                  <p className="staff-directory-kicker">People directory</p>
                  <h2>Existing staff</h2>
                  <p>
                    View roles, teaching allocations and account support actions
                    in one place.
                  </p>
                </div>
                <div className="staff-directory-stats">
                  <div>
                    <strong>{activeStaff.length}</strong>
                    <span>Total staff</span>
                  </div>
                  <div>
                    <strong>
                      {activeStaff.filter((row) => row.role === "teacher").length}
                    </strong>
                    <span>Teachers</span>
                  </div>
                  {isAdmin && <div>
                    <strong>{activeStaff.filter((row) => !row.legal_full_name || !row.signature_initials).length}</strong>
                    <span>Identity checks</span>
                  </div>}
                </div>
              </div>
              <div className="staff-directory-controls">
                <span className="staff-directory-results">
                  {visibleStaff.length} matching staff
                </span>
                <label className="portal-inline-search">
                  Search staff
                  <input
                    value={staffQuery}
                    onChange={(e) => setStaffQuery(e.target.value)}
                    placeholder="Search name, phone or role"
                  />
                </label>
              </div>
              {isAdmin && staff.some((row) => !row.legal_full_name || !row.signature_initials) && (
                <p className="muted" style={{ margin: "0 0 1rem" }}>
                  Staff marked <strong>Identity needs verification</strong> keep their current portal name, but cannot add a verified initials signature to a report until an administrator confirms their full legal name.
                </p>
              )}
              <div className="staff-category-tabs" role="tablist" aria-label="Staff categories">
                {[
                  ["all", "All staff"],
                  ["admins", "Admins"],
                  ["teachers", "Teachers"],
                  ["accountants", "Accountants"],
                  ["deactivated", "Deactivated accounts"],
                ].map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    role="tab"
                    aria-selected={staffCategory === id}
                    className={staffCategory === id ? "is-active" : ""}
                    onClick={() => {
                      setStaffCategory(id);
                      if (id !== "teachers") setStaffCampusFilter("all");
                    }}
                  >
                    {label} <span>{staffCategoryCounts[id]}</span>
                  </button>
                ))}
              </div>
              {staffCategory === "teachers" && isMainAdmin && (
                <div className="staff-campus-tabs" role="tablist" aria-label="Teacher campus">
                  <span>Teacher campus</span>
                  {[
                    ["all", "All teachers"],
                    ["junior", "Junior School"],
                    ["senior", "Senior School"],
                  ].map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      role="tab"
                      aria-selected={staffCampusFilter === id}
                      className={staffCampusFilter === id ? "is-active" : ""}
                      onClick={() => setStaffCampusFilter(id)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
              <div className="portal-table-wrap">
                <MobileRecordTable className="portal-table staff-directory-table mobile-record-table" aria-label="Staff directory">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Phone</th>
                      <th>Role</th>
                      <th>Campus</th>
                      <th>Class</th>
                      <th>Teaching coverage</th>
                      <th>Status</th>
                      {isAdmin && <th>Action</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {visibleStaff.length ? visibleStaff.map((row) => (
                      <tr
                        key={row.id}
                        className={isAdmin ? "staff-directory-row-action" : undefined}
                        onClick={isAdmin ? () => openStaffEditor(row) : undefined}
                      >
                        <td>
                          <div className="staff-directory-person">
                            <span>
                              {row.full_name
                                ?.split(/\s+/)
                                .filter(Boolean)
                                .slice(0, 2)
                                .map((name) => name[0])
                                .join("")
                                .toUpperCase() || "?"}
                            </span>
                            <div>
                              <strong>{row.full_name}</strong>
                              {isAdmin && row.legal_full_name && <small className="muted">Legal name: {row.legal_full_name}</small>}
                              {isAdmin && (!row.legal_full_name || !row.signature_initials) && <small className="muted">Legal full name needed</small>}
                            </div>
                          </div>
                        </td>
                        <td className="staff-directory-phone">
                          {row.phone || "—"}
                        </td>
                        <td>
                          <span className={`staff-role-pill is-${row.role}`}>
                            {row.role}
                          </span>
                        </td>
                        <td>{row.campus === "junior" ? "Junior" : row.campus === "senior" ? "Senior" : "—"}</td>
                        <td>
                          <span className="staff-class-list">
                            {row.role === "teacher"
                              ? row.teacher_class_assignments
                                  ?.map(
                                    (a) =>
                                      `${a.class_level} ${a.class_stream || ""}`,
                                  )
                                  .join(", ") ||
                                [row.class_level, row.class_stream]
                                  .filter(Boolean)
                                  .join(" ") ||
                                "No class allocation"
                              : "—"}
                          </span>
                        </td>
                        <td><StaffSubjectAssignments staff={row} /></td>
                        <td>
                          <span className={`class-status ${row.portal_access_enabled === false ? "is-inactive" : "is-active"}`}>
                            {row.portal_access_enabled === false ? "Deactivated" : "Active"}
                          </span>
                        </td>
                        {isAdmin && (
                          <td>
                            <div className="portal-action-row">
                              <Button className="staff-reset-button" variant="secondary" onClick={(event) => { event.stopPropagation(); openStaffEditor(row); }}>
                                {row.legal_full_name ? "Manage" : "Add full name"}
                              </Button>
                              <Button className="staff-reset-button" variant="secondary" onClick={(event) => { event.stopPropagation(); openResetModal(row); }}>
                                Credentials
                              </Button>
                            </div>
                          </td>
                        )}
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={isAdmin ? 8 : 7} className="muted">
                          No staff match these filters.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </MobileRecordTable>
              </div>
              <div className="data-table-footer">
                <span>
                  {visibleStaff.length} result
                  {visibleStaff.length === 1 ? "" : "s"}
                </span>
                <span>Page 1 of 1</span>
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
