import InventoryPOS from "../../components/portal/InventoryPOS";
import ExpensesCashbook from "../../components/portal/ExpensesCashbook";
import { useCallback, useEffect, useMemo, useState } from "react";
import Button from "../../components/ui/Button";
import PasswordInput from "../../components/ui/PasswordInput";
import Card from "../../components/ui/Card";
import PortalNotice from "../../components/portal/PortalNotice";
import StudentSelector from "../../components/portal/StudentSelector";
import FeesDashboard from "../../components/portal/FeesDashboard";
import { useSection } from "../../components/portal/StaffPortalLayout";
import { useAuth } from "../../context/useAuth";
import { invokeEdgeFunction } from "../../lib/edgeFunction";
import { isJuniorLevel } from "../../data/classOptions";
import ClassSelector, {
  parseClassKey,
} from "../../components/portal/ClassSelector";
import TeacherGradeEntry from "../../components/portal/TeacherGradeEntryV2";
import SlideOver from "../../components/ui/SlideOver";
import ActivityLog from "../../components/portal/ActivityLog";
import ClassManager from "../../components/portal/ClassManager";
import TeacherAttendanceHistory from "../../components/portal/TeacherAttendanceHistory";
import StaffLearnerProfile from "../../components/portal/StaffLearnerProfile";
import { logActivity } from "../../lib/logActivity";
import { nextAdmissionNumber } from "../../lib/admissionNumber";
import BulkStudentImport from "../../components/portal/BulkStudentImport";
import ReportTermSettings from "../../components/portal/ReportTermSettings";
import GradeBands from "../../components/portal/GradeBands";
import ProgressReports from "../../components/portal/ProgressReports";
import CourseWork from "../../components/portal/CourseWork";
import { getSubjectsByGradeStream } from "../../utils/CurriculumData";

function StaffSubjectAssignments({ staff }) {
  if (staff.role !== "teacher") return "—";

  const assignments = staff.teacher_class_subject_assignments ?? [];
  if (!assignments.length) {
    return <span className="staff-subjects-empty">No subjects assigned</span>;
  }

  const assignmentsByClass = assignments.reduce((groups, assignment) => {
    const classLabel = assignment.class_stream
      ? `${assignment.class_level} ${assignment.class_stream}`
      : assignment.class_level
        ? `${assignment.class_level} · Whole form`
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

function SubjectWorkspaceLanding({ assignments, students, schoolClasses, selectedSubject, selectedSubjectLevel, selectedAllocationId, selectedClassStream, onSelect, onSelectClass, onBack }) {
  const options = [...assignments.reduce((groups, assignment) => {
    const key = `${assignment.subject}::${assignment.class_level}`;
    if (!groups.has(key)) groups.set(key, { subject: assignment.subject, classLevel: assignment.class_level, assignments: [] });
    groups.get(key).assignments.push(assignment);
    return groups;
  }, new Map()).values()].sort((a, b) => `${a.subject} ${a.classLevel}`.localeCompare(`${b.subject} ${b.classLevel}`));
  const selectedOption = options.find(option => option.subject === selectedSubject && option.classLevel === selectedSubjectLevel);
  const selectedAllocation = selectedOption?.assignments.find(assignment => assignment.id === selectedAllocationId);
  const classChoices = selectedOption ? selectedOption.assignments.flatMap((assignment) => assignment.class_stream ? [{ assignment, classStream: assignment.class_stream }] : schoolClasses.filter((schoolClass) => schoolClass.active && schoolClass.class_level === assignment.class_level && schoolClass.campus === assignment.campus).map((schoolClass) => ({ assignment, classStream: schoolClass.class_stream || '' }))).filter((choice, index, all) => all.findIndex((item) => item.assignment.id === choice.assignment.id && item.classStream === choice.classStream) === index) : [];
  if (selectedAllocation && selectedClassStream !== '') return <div className="staff-content-area"><section className="subject-workspace-landing"><header className="dash-page-header"><div><p className="eyebrow">Subject class learners</p><h1 className="dash-page-title">{selectedAllocation.subject} · {selectedAllocation.class_level} {selectedClassStream}</h1><p className="dash-page-sub">Learners in this assigned subject class.</p></div></header><Card><div className="portal-card-title"><h2>Learners</h2><span className="muted">{students.length} learner{students.length === 1 ? '' : 's'}</span></div>{students.length ? <div className="portal-table-wrap"><table className="portal-table"><thead><tr><th>Learner</th><th>Admission no.</th><th>Class</th></tr></thead><tbody>{students.map(student => <tr key={student.id}><td><strong>{student.full_name}</strong></td><td>{student.admission_number || '—'}</td><td>{student.class_level} {student.class_stream || ''}</td></tr>)}</tbody></table></div> : <p className="muted">No learners are enrolled in this class.</p>}</Card><button type="button" className="subject-workspace-back" onClick={() => onSelect(selectedSubject, selectedSubjectLevel)}>← Choose another class</button></section></div>;
  return <div className="staff-content-area"><section className="subject-workspace-landing"><header className="dash-page-header"><div><p className="eyebrow">Subject workspace</p><h1 className="dash-page-title">{selectedOption ? `${selectedOption.subject} · ${selectedOption.classLevel}` : 'Choose a subject and form'}</h1><p className="dash-page-sub">{selectedOption ? 'Choose a class to see its learners.' : 'Select one of your teaching allocations to continue.'}</p></div></header>{selectedOption ? <><div className="subject-workspace-options">{classChoices.map((choice, index) => <button type="button" className={selectedAllocationId === choice.assignment.id && selectedClassStream === choice.classStream ? 'active' : ''} key={`${choice.assignment.id}-${choice.classStream}-${index}`} onClick={() => onSelectClass(choice.assignment.id, choice.classStream)}><strong>{choice.assignment.class_level} {choice.classStream || 'Whole form'}</strong><span>{choice.assignment.class_stream ? 'Assigned class' : 'Whole-form allocation'}</span></button>)}</div><button type="button" className="subject-workspace-back" onClick={onBack}>← Choose another subject</button></> : options.length ? <div className="subject-workspace-options">{options.map(option => <button type="button" key={`${option.subject}-${option.classLevel}`} onClick={() => onSelect(option.subject, option.classLevel)}><strong>{option.subject}</strong><span>{option.classLevel}</span></button>)}</div> : <p className="muted">No subject classes have been assigned to you yet.</p>}</section></div>
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
  const [phone, setPhone] = useState(profile?.phone || "");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
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
  return <div className="dash-section account-settings-page"><div className="dash-page-header"><div><h1 className="dash-page-title">Account settings</h1><p className="dash-page-sub">Update your own teacher portal phone number and sign-in password.</p></div></div><Card><form className="portal-form account-settings-form" onSubmit={save}><label>Mobile number<input type="tel" inputMode="tel" value={phone} onChange={event => setPhone(event.target.value)} placeholder="+263 77 123 4567" required /></label><label>New password<PasswordInput id="teacher-new-password" label="" minLength={8} autoComplete="new-password" value={password} onChange={event => setPassword(event.target.value)} /></label><label>Confirm new password<PasswordInput id="teacher-confirm-password" label="" minLength={8} autoComplete="new-password" value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} /></label>{error && <PortalNotice tone="error">{error}</PortalNotice>}{notice && <PortalNotice>{notice}</PortalNotice>}<Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save account settings"}</Button></form></Card></div>
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
function DashboardHome({
  students,
  staff,
  loading,
  setSection,
  role,
  supabase,
}) {
  const isTeacher = role === "teacher";
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
  const title = isTeacher ? "Teaching dashboard" : "School dashboard";
  const subtitle = isTeacher
    ? "Your learner records and marking workspace"
    : "A clear overview of learners and school operations";
  const actionLabel = isTeacher ? "Enter learner grades" : "Manage learners";
  const listTitle = isTeacher ? "Your learners" : "Recent learners";

  useEffect(() => {
    let mounted = true;
    const loadOverview = async () => {
      const year = new Date().getFullYear();
      const [attendanceResult, parentResult, feesResult] = await Promise.all([
        supabase
          .from("attendance")
          .select("date, status, student_id")
          .order("date", { ascending: true }),
        isTeacher
          ? Promise.resolve({ data: null })
          : supabase
              .from("parent_student")
              .select("id", { count: "exact", head: true })
              .not("verified_at", "is", null),
        isTeacher
          ? Promise.resolve({ data: null })
          : supabase
              .from("fee_balances")
              .select("amount_paid")
              .eq("academic_year", year),
      ]);
      if (!mounted) return;
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
    };
    loadOverview();
    return () => {
      mounted = false;
    };
  }, [isTeacher, supabase, students]);

  const todayDate = new Date().toISOString().slice(0, 10);
  const todayBreakdown = Object.entries(
    students.reduce((acc, student) => {
      const record = overview.rawAttendance?.find(
        (r) => r.student_id === student.id && r.date === todayDate,
      );
      const className =
        `${student.class_level} ${student.class_stream || ""}`.trim() ||
        "Unassigned";
      if (!acc[className]) acc[className] = { present: 0, absent: 0 };
      if (record?.status === "present" || record?.status === "late") {
        acc[className].present++;
      } else {
        acc[className].absent++;
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
            {isTeacher ? "Teaching workspace" : "School overview"}
          </p>
          <h1 className="dash-page-title">{title}</h1>
          <p className="dash-page-sub">{subtitle}</p>
        </div>
        <div className="dashboard-header-controls">
          <Button
            className="dashboard-ghost-action"
            variant="secondary"
            onClick={() => setSection(isTeacher ? "entry" : "roster")}
          >
            {actionLabel}
          </Button>
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
                : staff.filter((member) => member.role === "teacher").length
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
                Live breakdown for {isTeacher ? "your classes" : "all classes"}.
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
            {todayBreakdown.length === 0 ? (
              <p className="muted">No classes to display</p>
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
          <div className="portal-table-wrap">
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
        )}
      </div>
    </div>
  );
}
/* ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ Main export ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ */
export default function StaffDashboard() {
  const { supabase, user, profile, activeRole, setActiveRole } = useAuth();
  const { section, setSection, activeClassFilter, teacherWorkspace, selectedSubjectAllocationId, selectedSubjectClassStream, selectedSubject, selectedSubjectLevel, setSubjectGroup, setSubjectAllocation, clearSubjectGroup } = useSection();

  const manager = ["admin", "principal"].includes(profile?.role);
  const isAdmin = profile?.role === "admin";
  const isMainAdmin = isAdmin && profile?.campus === "all";
  const accountant = profile?.role === "accountant";
  const canViewLearnerProfile = manager || accountant;

  const [students, setStudents] = useState([]);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [tab, setTab] = useState("attendance");
  const [forms, setForms] = useState(emptyForms);
  const [recent, setRecent] = useState([]);
  const [student, setStudent] = useState(emptyStudent);
  const [editingId, setEditingId] = useState(null);
  const [staff, setStaff] = useState([]);
  const [staffForm, setStaffForm] = useState({
    fullName: "",
    phone: "",
    password: "",
    role: "teacher",
    campus: "junior",
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
    campus: "junior",
    classAssignments: [],
    classStream: "",
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
  const [attendanceStudent, setAttendanceStudent] = useState(null);
  const [profileStudent, setProfileStudent] = useState(null);
  const [profileInitialTab, setProfileInitialTab] = useState("Summary");

  const selected = students.find((row) => row.id === selectedId);
  const staffCategoryCounts = useMemo(() => ({
    all: staff.length,
    admins: staff.filter((row) => row.portal_access_enabled !== false && ["admin", "principal"].includes(row.role)).length,
    teachers: staff.filter((row) => row.portal_access_enabled !== false && row.role === "teacher").length,
    accountants: staff.filter((row) => row.portal_access_enabled !== false && row.role === "accountant").length,
    deactivated: staff.filter((row) => row.portal_access_enabled === false).length,
  }), [staff]);
  const visibleStaff = staff.filter((row) => {
    const matchesSearch = [row.full_name, row.phone, row.role].some((value) =>
      value?.toLowerCase().includes(staffQuery.toLowerCase()),
    );
    const matchesCampus = staffCampusFilter === "all" || row.campus === staffCampusFilter;
    const matchesCategory = staffCategory === "all"
      || (staffCategory === "admins" && row.portal_access_enabled !== false && ["admin", "principal"].includes(row.role))
      || (staffCategory === "teachers" && row.portal_access_enabled !== false && row.role === "teacher")
      || (staffCategory === "accountants" && row.portal_access_enabled !== false && row.role === "accountant")
      || (staffCategory === "deactivated" && row.portal_access_enabled === false);
    return matchesSearch && matchesCampus && matchesCategory;
  });
  const showError = (value) => {
    setNotice("");
    setError(value);
  };

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
    const { data, error: requestError } = await supabase
      .from("students")
      .select("*")
      .order("full_name");
    if (requestError) showError(requestError.message);
    else setStudents(data ?? []);

    const today = new Date().toISOString().slice(0, 10);
    const { data: attendanceData } = await supabase
      .from("attendance")
      .select("student_id, status")
      .eq("date", today);
    if (attendanceData) {
      const map = {};
      attendanceData.forEach((r) => (map[r.student_id] = r.status));
      setTodayAttendance(map);
    }

    setLoading(false);
  }, [supabase]);

  const loadStaff = useCallback(async () => {
    if (!manager) return;
    const { data, error: requestError } = await supabase
      .from("profiles")
      .select(
        "id, full_name, phone, role, campus, portal_access_enabled, teacher_class_assignments (class_level, class_stream), teacher_class_subject_assignments (id, class_level, class_stream, subject, campus)",
      )
      .order("full_name");
    if (requestError) showError(requestError.message);
    else setStaff(data ?? []);
    console.log("Loaded staff data", data);
    console.log("Loaded staff count", (data ?? []).length, data);
  }, [manager, supabase]);
  const loadSchoolClasses = useCallback(async () => {
    const { data } = await supabase
      .from("school_classes")
      .select("class_level, class_stream, campus")
      .eq("active", true);
    setSchoolClasses(data ?? []);
  }, [supabase]);

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

  const saveStudent = async (event) => {
    event.preventDefault();
    if (!isAdmin && profile?.role !== "teacher")
      return showError(
        "Only administrators or assigned teachers can add learners.",
      );

    if (!isAdmin && profile?.role === "teacher") {
      if (editingId) return showError("Only administrators can edit learners.");
      const isAssigned = teacherAssignments.some(
        (a) =>
          a.class_level === student.class_level &&
          (!student.class_stream ||
            a.class_stream === student.class_stream ||
            !a.class_stream),
      );
      if (!isAssigned)
        return showError("You can only add learners to your assigned classes.");
    }

    const row = {
      ...student,
      admission_number: editingId
        ? student.admission_number
        : nextAdmissionNumber(students, student.enrolled_year),
      enrolled_year: Number(student.enrolled_year),
      class_stream: student.class_stream || null,
      inactive_reason:
        student.status === "inactive" ? student.inactive_reason : null,
    };
    const request = editingId
      ? supabase.from("students").update(row).eq("id", editingId)
      : supabase.from("students").insert(row);
    const { error: requestError } = await request;
    if (requestError) return showError(requestError.message);
    logActivity(supabase, user, profile, {
      actionType: editingId ? "update" : "create",
      description: `${editingId ? "Updated" : "Created"} learner ${student.full_name}`,
      targetTable: "students",
      targetId: editingId,
    });
    setNotice(
      editingId
        ? "Learner updated successfully."
        : "Learner added successfully.",
    );
    setStudent(emptyStudent());
    setEditingId(null);
    loadStudents();
  };

  const editStudent = (row) => {
    setStudent({ ...row, class_stream: row.class_stream ?? "" });
    setEditingId(row.id);
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
      staffForm,
    );
    if (requestError || data?.error)
      return showError(data?.error || requestError.message);
    logActivity(supabase, user, profile, {
      actionType: "create",
      description: `Created ${staffForm.campus} ${staffForm.role} account for ${staffForm.fullName}`,
      targetTable: "profiles",
      targetId: data?.user_id,
    });
    setNotice(data?.message || "Staff account created successfully.");
    setStaffForm({
      fullName: "",
      phone: "",
      password: "",
      role: "teacher",
      campus: "junior",
      classLevel: "",
      classStream: "",
      classAssignments: [],
      subjectAssignments: [],
      subjectName: "",
    });
    loadStaff();
    setStaffModal(false);
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
      campus: row.campus === "senior" ? "senior" : "junior",
      classAssignments: assignments.map((assignment) => assignment.class_level),
      classStream: assignments.find((assignment) => assignment.class_stream)?.class_stream || "",
      allocationTab: "classes",
      subjectAssignments: row.teacher_class_subject_assignments || [],
      subjectName: "",
      subjectLevel: "",
      subjectStream: "",
      saving: false,
    });
  };

  const closeStaffEditor = () =>
    setStaffEditor({ open: false, staff: null, fullName: "", campus: "junior", classAssignments: [], classStream: "", allocationTab: "classes", subjectAssignments: [], subjectName: "", subjectLevel: "", subjectStream: "", saving: false });

  const addSubjectAllocation = () => {
    const subject = staffEditor.subjectName.trim();
    const classLevel = staffEditor.subjectLevel;
    const classStream = "";
    if (!subject || !classLevel) {
      showError("Choose a form and subject before adding the subject allocation.");
      return;
    }
    const exists = staffEditor.subjectAssignments.some((assignment) =>
      assignment.subject.toLowerCase() === subject.toLowerCase()
      && assignment.class_level === classLevel
      && (assignment.class_stream || "") === classStream,
    );
    if (exists) return showError("That subject is already allocated to this teacher for the selected form.");
    setError("");
    setStaffEditor((value) => ({
      ...value,
      subjectAssignments: [...value.subjectAssignments, { subject, class_level: classLevel, class_stream: classStream, campus: value.campus }],
      subjectName: "",
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
      full_name: staffEditor.fullName,
      campus: staffEditor.campus,
      class_assignments: staffEditor.classAssignments,
      class_stream: staffEditor.campus === "senior" ? staffEditor.classStream : "",
      class_subject_assignments: staffEditor.subjectAssignments.map((assignment) => ({
        subject: assignment.subject,
        class_level: assignment.class_level,
        class_stream: assignment.class_stream || "",
      })),
    });
    setStaffEditor((value) => ({ ...value, saving: false }));
    if (requestError || data?.success === false || data?.error)
      return showError(data?.error || requestError?.message || "Unable to update staff account.");
    logActivity(supabase, user, profile, {
      actionType: "update",
      description: `Updated staff account for ${staffEditor.fullName}`,
      targetTable: "profiles",
      targetId: staffEditor.staff.id,
    });
    setNotice(data?.message || "Staff account updated.");
    closeStaffEditor();
    loadStaff();
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

  const isTeacher = profile?.role === "teacher";
  const teacherAssignments = profile?.teacher_class_assignments || [];
  const teacherSubjectAssignments = profile?.teacher_class_subject_assignments || [];
  const adminClassLevels = [
    ...new Set(schoolClasses.map((row) => row.class_level)),
  ];
  const streamsForAdminLevel = (level) => [
    ...new Set([
      ...schoolClasses
        .filter((row) => row.class_level === level)
        .map((row) => row.class_stream)
        .filter(Boolean),
    ]),
  ];
  const subjectOptionsForLevel = (level, campus) => {
    if (!level) return [];
    if (campus !== "senior") return getSubjectsByGradeStream(level, "Blue");
    return [...new Set(streamsForAdminLevel(level).flatMap((stream) => getSubjectsByGradeStream(level, stream)))];
  };

  // Filter students based on active class selection (class_level & class_stream)
  const filteredStudents = useMemo(() => {
    const { level, stream } = isTeacher && teacherWorkspace === "subjects" ? { level: null, stream: null } : activeClassFilter;
    const activeSubjectAssignments = selectedSubjectAllocationId ? teacherSubjectAssignments.filter((assignment) => assignment.id === selectedSubjectAllocationId) : teacherSubjectAssignments;
    const workspaceStudents = isTeacher && teacherWorkspace === "subjects"
      ? students.filter((student) => activeSubjectAssignments.some((assignment) => assignment.class_level === student.class_level && (!assignment.class_stream || assignment.class_stream === (student.class_stream || "")) && (!selectedSubjectClassStream || selectedSubjectClassStream === (student.class_stream || ""))))
      : students;
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
              s.class_level === level &&
              (stream ? s.class_stream === stream : true),
          ).length
        : workspaceStudents.length,
    });

    if (!level) return workspaceStudents;
    return workspaceStudents.filter(
      (s) =>
        s.class_level === level && (stream ? s.class_stream === stream : true),
    );
  }, [students, activeClassFilter, isTeacher, teacherSubjectAssignments, teacherWorkspace, selectedSubjectAllocationId, selectedSubjectClassStream]);

  const visible = filteredStudents.filter((row) =>
    `${row.full_name} ${row.admission_number}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );

  if (isTeacher && teacherWorkspace === "subjects" && section === "dashboard")
    return <SubjectWorkspaceLanding assignments={teacherSubjectAssignments} students={filteredStudents} schoolClasses={schoolClasses} selectedSubject={selectedSubject} selectedSubjectLevel={selectedSubjectLevel} selectedAllocationId={selectedSubjectAllocationId} selectedClassStream={selectedSubjectClassStream} onSelect={setSubjectGroup} onSelectClass={setSubjectAllocation} onBack={clearSubjectGroup} />;

  const shopRole = profile?.active_role ?? profile?.role;
  if (section === "inventory" && ["admin", "accountant"].includes(shopRole))
    return (
      <div className="staff-content-area">
        {accountant && (
          <nav
            className="shop-accountant-nav"
            aria-label="Accountant workspace"
          >
            <button onClick={() => setSection("fees")}>Finance</button>
            <button aria-current="page">Inventory & POS</button>
          </nav>
        )}
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
    ["admin", "principal", "accountant"].includes(shopRole)
  )
    return (
      <div className="staff-content-area">
        <ExpensesCashbook supabase={supabase} user={user} profile={profile} />
      </div>
    );

  if (profileStudent)
    return (
      <StaffLearnerProfile
        supabase={supabase}
        student={profileStudent}
        teacherView={isTeacher}
        initialTab={profileInitialTab}
        onBack={() => { setProfileStudent(null); setProfileInitialTab("Summary"); }}
      />
    );

  /* Accountant: show fees dashboard */
  if (accountant)
    return (
      <div className="staff-content-area">
        <nav className="shop-accountant-nav" aria-label="Accountant workspace">
          <button aria-current="page">Finance</button>
          <button onClick={() => setSection("expenses")}>
            Expenses & Cashbook
          </button>
          {["admin", "accountant"].includes(shopRole) && (
            <button onClick={() => setSection("inventory")}>
              Inventory & POS
            </button>
          )}
        </nav>
        <FeesDashboard
          students={filteredStudents}
          loading={loading}
          supabase={supabase}
          user={user}
          profile={profile}
          onOpenStudent={setProfileStudent}
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
          onOpenStudent={setProfileStudent}
          onStudentAdded={loadStudents}
        />
      </div>
    );

  if (section === "activity" && manager)
    return (
      <div className="staff-content-area">
        <ActivityLog />
      </div>
    );
  if (section === "bulk-import" && isAdmin)
    return (
      <div className="staff-content-area">
        <div className="dash-section">
          <div className="dash-page-header">
            <div>
              <h1 className="dash-page-title">Bulk learner import</h1>
              <p className="dash-page-sub">Upload a validated CSV to add learners and their current-term fee records.</p>
            </div>
          </div>
          <BulkStudentImport supabase={supabase} onSaved={loadStudents} />
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
            onClose={() => setSection("dashboard")}
            onSaved={() => setNotice("Report settings saved.")}
          />
        </div>
      </div>
    );
  if (section === "grade-bands" && isAdmin)
    return <div className="staff-content-area"><GradeBands /></div>;
  if (section === "progress-reports" && (isAdmin || isTeacher))
    return <div className="staff-content-area"><ProgressReports students={filteredStudents} loading={loading} onOpenReport={student => { setProfileInitialTab("Academics"); setProfileStudent(student); }} /></div>;
  if (section === "coursework" && isTeacher)
    return <div className="staff-content-area"><CourseWork /></div>;
  if (section === "classes" && isAdmin)
    return (
      <div className="staff-content-area">
        <ClassManager supabase={supabase} onChanged={loadSchoolClasses} />
      </div>
    );

  if (section === "settings")
    return (
      <div className="staff-content-area">
        <StaffAccountSettings supabase={supabase} profile={profile} />
      </div>
    );

  return (
    <div className="staff-content-area">
      {notice && <PortalNotice>{notice}</PortalNotice>}
      {error && <PortalNotice tone="error">{error}</PortalNotice>}

      {/* Dashboard Home */}
      {section === "dashboard" && (
        <DashboardHome
          students={filteredStudents}
          staff={staff}
          loading={loading}
          setSection={setSection}
          role={profile?.role}
          supabase={supabase}
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
                  ? "Mark today’s register, then open a learner for weekly and monthly attendance history."
                  : "All enrolled learners and records"}
              </p>
            </div>
          </div>

          <div className="portal-workspace">
            <Card>
              <div className="portal-card-title">
                <h2>Learner roster</h2>
                <label className="portal-inline-search">
                  Search
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Name or admission number"
                  />
                </label>
                <label className="portal-inline-search">Campus<select value={staffCampusFilter} onChange={(e) => setStaffCampusFilter(e.target.value)}><option value="all">All campuses</option><option value="junior">Junior School</option><option value="senior">Senior School</option></select></label>
              </div>
              {loading ? (
                <p className="muted">
                  Loading
                  learnersÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¦
                </p>
              ) : (
                <div className="portal-table-wrap">
                  <table className="portal-table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Admission no.</th>
                        <th>Class</th>
                        <th>Stream</th>
                        <th>Status</th>
                        {isTeacher && <th>Today's Attendance</th>}
                        {isAdmin && <th />}
                      </tr>
                    </thead>
                    <tbody>
                      {visible.map((row) => (
                        <tr key={row.id} className="dash-table-row">
                          <td className="dash-td-name">
                            <span className="dash-learner-avatar">
                              {row.full_name?.[0] ?? "?"}
                            </span>
                            {isTeacher ? (
                              <button
                                type="button"
                                className="roster-learner-link"
                                onClick={() => setProfileStudent(row)}
                                aria-label={`Open learner profile for ${row.full_name}`}
                              >
                                {row.full_name}
                              </button>
                            ) : canViewLearnerProfile ? (
                              <button
                                type="button"
                                className="roster-learner-link"
                                onClick={() => setProfileStudent(row)}
                                aria-label={`Open profile for ${row.full_name}`}
                              >
                                {row.full_name}
                              </button>
                            ) : (
                              row.full_name
                            )}
                          </td>
                          <td className="mono">{row.admission_number}</td>
                          <td>
                            {row.role === "teacher"
                              ? row.teacher_class_assignments
                                  ?.map((a) => a.class_level)
                                  .join(", ") || "-"
                              : row.class_level}
                          </td>
                          <td>
                            {row.role === "teacher"
                              ? row.teacher_class_assignments
                                  ?.map((a) => a.class_stream)
                                  .filter(Boolean)
                                  .join(", ") || "-"
                              : row.class_stream || "-"}
                          </td>
                          <td>
                            <StatusPill status={row.status} />
                          </td>
                          {isTeacher && (
                            <td>
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
                                  Left school
                                </span>
                              )}
                            </td>
                          )}
                          {isAdmin && (
                            <td>
                              <Button
                                variant="secondary"
                                onClick={() => editStudent(row)}
                              >
                                Edit
                              </Button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
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

            {(isAdmin || profile?.role === "teacher" || accountant) && (
              <Card>
                <h2>{editingId ? "Edit learner" : "Add learner"}</h2>
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
                      placeholder="0012026"
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
                        : "The next school-wide yearly number is assigned when the learner is saved."}
                    </small>
                  </label>
                  <label>
                    Date of birth
                    <input
                      required
                      type="date"
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
                    <Button type="submit">
                      {editingId ? "Save changes" : "Add learner"}
                    </Button>
                    {editingId && (
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => {
                          setStudent(emptyStudent());
                          setEditingId(null);
                        }}
                      >
                        Cancel
                      </Button>
                    )}
                  </div>
                </form>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚ÂÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â Data Entry ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚ÂÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â */}
      {section === "entry" &&
        (profile?.role === "teacher" ? (
          <TeacherGradeEntry />
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
              <h1 className="dash-page-title">Staff Management</h1>
              <p className="dash-page-sub">Create and manage staff accounts</p>
              {isAdmin && (
                <Button type="button" onClick={() => setStaffModal(true)}>
                  + Add Staff Member
                </Button>
              )}
            </div>
          </div>

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
                    Full name
                    <input
                      required
                      value={staffForm.fullName}
                      onChange={(e) =>
                        setStaffForm((x) => ({
                          ...x,
                          fullName: e.target.value,
                        }))
                      }
                    />
                  </label>
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
                      <option value="admin">Admin</option>
                      <option value="principal">Principal</option>
                    </select>
                  </label>
                  <label>
                    Campus
                    <select value={staffForm.campus} onChange={(e) => setStaffForm((x) => ({ ...x, campus: e.target.value, classLevel: "", classStream: "", classAssignments: [], subjectAssignments: [], subjectName: "" }))}>
                      <option value="junior">Junior School</option>
                      <option value="senior">Senior School</option>
                    </select>
                  </label>
                  {staffForm.role === "teacher" && (
                    <>
                      <fieldset style={{ gridColumn: "1 / -1" }}>
                        <legend>Class assignments</legend>
                        <p className="muted" style={{ marginTop: 0 }}>
                          Select every class this teacher teaches. One teacher can be assigned to more than one class.
                        </p>
                        {adminClassLevels.filter((level) => staffForm.campus === "junior" ? isJuniorLevel(level) : !isJuniorLevel(level)).map((level) => (
                          <label key={level} style={{ display: "inline-flex", marginRight: "12px", gap: "6px" }}>
                            <input
                              type="checkbox"
                              checked={staffForm.classAssignments.includes(level)}
                              onChange={(e) => setStaffForm((x) => {
                                const classAssignments = e.target.checked
                                  ? [...new Set([...x.classAssignments, level])]
                                  : x.classAssignments.filter((value) => value !== level);
                                return {
                                  ...x,
                                  classAssignments,
                                  // Keep the legacy primary-class value in sync with the chosen assignments.
                                  classLevel: classAssignments[0] || "",
                                  classStream: x.campus === "junior" ? "" : x.classStream,
                                };
                              })}
                            />
                            {level}
                          </label>
                        ))}
                        <p className="muted" style={{ marginBottom: 0 }}>
                          {staffForm.classAssignments.length
                            ? `${staffForm.classAssignments.length} class${staffForm.classAssignments.length === 1 ? "" : "es"} selected.`
                            : "Select at least one class to create a teacher account."}
                        </p>
                      </fieldset>
                      {staffForm.campus === "senior" ? (
                        <label>
                          Class stream
                          <select
                            required
                            disabled={!staffForm.classAssignments.length}
                            value={staffForm.classStream}
                            onChange={(e) =>
                              setStaffForm((x) => ({ ...x, classStream: e.target.value }))
                            }
                          >
                            <option value="">Choose class stream</option>
                            {streamsForAdminLevel(staffForm.classLevel).map((stream) => (
                              <option key={stream}>{stream}</option>
                            ))}
                          </select>
                        </label>
                      ) : (
                        <p className="muted" style={{ alignSelf: "end" }}>
                          Junior classes currently do not use streams.
                        </p>
                      )}
                      <fieldset style={{ gridColumn: "1 / -1" }}>
                        <legend>Subject allocations</legend>
                        <p className="muted" style={{ marginTop: 0 }}>Add the subjects this teacher teaches. These are available immediately in their Subject workspace.</p>
                        <div className="portal-action-row">
                          <select value={staffForm.subjectName} disabled={!staffForm.classLevel} onChange={(e) => setStaffForm((x) => ({ ...x, subjectName: e.target.value }))}>
                            <option value="">Choose subject</option>
                            {subjectOptionsForLevel(staffForm.classLevel, staffForm.campus).map((subject) => <option key={subject} value={subject}>{subject}</option>)}
                          </select>
                          <Button type="button" variant="secondary" onClick={() => setStaffForm((x) => !x.subjectName ? x : ({ ...x, subjectAssignments: x.subjectAssignments.includes(x.subjectName) ? x.subjectAssignments : [...x.subjectAssignments, x.subjectName], subjectName: "" }))}>Add subject</Button>
                        </div>
                        {staffForm.subjectAssignments.length ? <div className="allocation-chip-list">{staffForm.subjectAssignments.map((subject) => <span className="allocation-chip" key={subject}>{subject}<button type="button" onClick={() => setStaffForm((x) => ({ ...x, subjectAssignments: x.subjectAssignments.filter((value) => value !== subject) }))}>×</button></span>)}</div> : <p className="muted">No subjects selected yet.</p>}
                      </fieldset>
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
                    Full name
                    <input
                      required
                      value={staffEditor.fullName}
                      onChange={(e) => setStaffEditor((value) => ({ ...value, fullName: e.target.value }))}
                    />
                  </label>
                  <label>
                    Campus
                    <select
                      value={staffEditor.campus}
                      onChange={(e) => setStaffEditor((value) => ({
                        ...value,
                        campus: e.target.value,
                        classAssignments: [],
                        classStream: "",
                        subjectAssignments: [],
                        subjectLevel: "",
                        subjectStream: "",
                      }))}
                    >
                      <option value="junior">Junior School</option>
                      <option value="senior">Senior School</option>
                    </select>
                  </label>
                  {staffEditor.staff?.role === "teacher" && (
                    <>
                      <fieldset style={{ gridColumn: "1 / -1" }}>
                        <legend>Teaching allocations</legend>
                        <div className="portal-action-row" role="tablist" aria-label="Teacher allocation type">
                          <Button type="button" variant={staffEditor.allocationTab === "classes" ? "primary" : "secondary"} onClick={() => setStaffEditor((value) => ({ ...value, allocationTab: "classes" }))}>Classes</Button>
                          <Button type="button" variant={staffEditor.allocationTab === "subjects" ? "primary" : "secondary"} onClick={() => setStaffEditor((value) => ({ ...value, allocationTab: "subjects" }))}>Subjects</Button>
                        </div>
                        {staffEditor.allocationTab === "classes" ? <>
                        <p className="muted" style={{ marginTop: 0 }}>
                          Untick a class to remove this teacher from it. A class with no active teacher will be marked Unassigned in Class Management.
                        </p>
                        {adminClassLevels.filter((level) => staffEditor.campus === "junior" ? isJuniorLevel(level) : !isJuniorLevel(level)).map((level) => (
                          <label key={level} style={{ display: "inline-flex", marginRight: "12px", gap: "6px" }}>
                            <input
                              type="checkbox"
                              checked={staffEditor.classAssignments.includes(level)}
                              onChange={(e) => setStaffEditor((value) => ({
                                ...value,
                                classAssignments: e.target.checked
                                  ? [...new Set([...value.classAssignments, level])]
                                  : value.classAssignments.filter((assignment) => assignment !== level),
                              }))}
                            />
                            {level}
                          </label>
                        ))}
                        </> : <>
                          <p className="muted" style={{ marginTop: 0 }}>
                            Senior subject allocations apply to the whole form and every active stream. Class-teacher responsibility remains controlled by the Classes tab.
                          </p>
                          <div className="portal-form" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", alignItems: "end" }}>
                            <label>Class<select value={staffEditor.subjectLevel} onChange={(e) => setStaffEditor((value) => ({ ...value, subjectLevel: e.target.value, subjectStream: "" }))}><option value="">Choose class</option>{adminClassLevels.filter((level) => staffEditor.campus === "junior" ? isJuniorLevel(level) : !isJuniorLevel(level)).map((level) => <option key={level} value={level}>{level}</option>)}</select></label>
                            <label>Subject<select value={staffEditor.subjectName} disabled={!staffEditor.subjectLevel} onChange={(e) => setStaffEditor((value) => ({ ...value, subjectName: e.target.value }))}><option value="">Choose subject</option>{subjectOptionsForLevel(staffEditor.subjectLevel, staffEditor.campus).map((subject) => <option key={subject} value={subject}>{subject}</option>)}</select></label>
                            <Button type="button" onClick={addSubjectAllocation}>Add subject</Button>
                          </div>
                          {staffEditor.subjectAssignments.length ? <div className="allocation-chip-list">{staffEditor.subjectAssignments.map((assignment, index) => <span className="allocation-chip" key={`${assignment.subject}-${assignment.class_level}-${assignment.class_stream}-${index}`}>{assignment.subject} · {assignment.class_level} · Whole form<button type="button" aria-label={`Remove ${assignment.subject} from ${assignment.class_level}`} onClick={() => setStaffEditor((value) => ({ ...value, subjectAssignments: value.subjectAssignments.filter((_, position) => position !== index) }))}>×</button></span>)}</div> : <p className="muted">No subjects allocated yet.</p>}
                        </>}
                      </fieldset>
                      {staffEditor.campus === "senior" ? (
                        <label>
                          Class stream
                          <select
                            required
                            disabled={!staffEditor.classAssignments.length}
                            value={staffEditor.classStream}
                            onChange={(e) => setStaffEditor((value) => ({ ...value, classStream: e.target.value }))}
                          >
                            <option value="">Choose class stream</option>
                            {streamsForAdminLevel(staffEditor.classAssignments[0] || "").map((stream) => <option key={stream}>{stream}</option>)}
                          </select>
                        </label>
                      ) : (
                        <p className="muted">Junior classes do not require a stream.</p>
                      )}
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
                    <strong>{staff.length}</strong>
                    <span>Total staff</span>
                  </div>
                  <div>
                    <strong>
                      {staff.filter((row) => row.role === "teacher").length}
                    </strong>
                    <span>Teachers</span>
                  </div>
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
              {staffCategory === "teachers" && (
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
                <table className="portal-table staff-directory-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Phone</th>
                      <th>Role</th>
                      <th>Campus</th>
                      <th>Class</th>
                      <th>Subjects assigned</th>
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
                            <strong>{row.full_name}</strong>
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
                                Manage
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
                </table>
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
