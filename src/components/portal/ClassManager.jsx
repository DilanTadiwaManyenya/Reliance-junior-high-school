import { useEffect, useMemo, useState } from "react";
import Button from "../ui/Button";
import Card from "../ui/Card";
import PortalNotice from "./PortalNotice";
import { nextAdmissionNumber } from "../../lib/admissionNumber";
import { getSubjectsByGradeStream } from "../../utils/CurriculumData";
import { useLocation, useNavigate } from "react-router-dom";

const blankClass = { class_level: "", class_stream: "", campus: "junior", capacity: "50" };
const blankLearner = {
  full_name: "",
  admission_number: "",
  date_of_birth: "",
  enrolled_year: new Date().getFullYear(),
};
const classLabel = (row) =>
  `${row.class_level}${row.class_stream ? ` · ${row.class_stream}` : ""}`;

export default function ClassManager({ supabase, onChanged }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [classes, setClasses] = useState([]);
  const [students, setStudents] = useState([]);
  const [teacherAssignments, setTeacherAssignments] = useState([]);
  const [subjectAssignments, setSubjectAssignments] = useState([]);
  const [staffProfiles, setStaffProfiles] = useState([]);
  const [form, setForm] = useState(blankClass);
  const [learner, setLearner] = useState(blankLearner);
  const [selectedId, setSelectedId] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [correctionTargetId, setCorrectionTargetId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [setupRequired, setSetupRequired] = useState(false);
  const [showInactive, setShowInactive] = useState(false);
  const isMissingTable = (value) => ["PGRST205", "42P01"].includes(value?.code);
  const selectedClass = classes.find((row) => row.id === selectedId);
  const displayedClasses = showInactive ? classes : classes.filter((row) => row.active);
  const query = new URLSearchParams(location.search);
  const selectedLevel = query.get("classLevel") || "";
  const selectedCampus = query.get("campus") || "";
  const selectedStreamId = query.get("stream") || "";
  const classPageRows = displayedClasses.filter((row) => row.class_level === selectedLevel && row.campus === selectedCampus);
  const selectedStream = classPageRows.find((row) => row.id === selectedStreamId) || null;
  const workspaceStudents = selectedStream
    ? students.filter((row) =>
        row.class_level === selectedStream.class_level &&
        (row.class_stream || "") === (selectedStream.class_stream || ""),
      )
    : [];
  const campusGroups = [
    { id: "junior", title: "Junior School", description: "Grade-based classes" },
    { id: "senior", title: "Senior School", description: "Form and stream classes" },
  ].map((group) => ({ ...group, classes: displayedClasses.filter((row) => row.campus === group.id) }));
  const classStudents = useMemo(
    () =>
      selectedClass
        ? students.filter(
            (row) =>
              row.class_level === selectedClass.class_level &&
              (row.class_stream || "") === (selectedClass.class_stream || ""),
          )
        : [],
    [students, selectedClass],
  );
  const activeClassStudents = classStudents.filter(
    (row) => row.status === "active",
  ).length;
  const activeLearnersForClass = (classRow) => students.filter(
    (student) => student.status === "active"
      && student.class_level === classRow.class_level
      && (student.class_stream || "") === (classRow.class_stream || ""),
  ).length;
  const capacityStatus = (classRow) => {
    const enrolled = activeLearnersForClass(classRow);
    const capacity = Number(classRow.capacity || 0);
    if (!capacity) return { enrolled, label: `${enrolled} enrolled`, tone: "is-inactive" };
    if (enrolled >= capacity) return { enrolled, label: `${enrolled}/${capacity} · New stream recommended`, tone: "is-full" };
    if (enrolled >= capacity * 0.9) return { enrolled, label: `${enrolled}/${capacity} · Nearly full`, tone: "is-near" };
    return { enrolled, label: `${enrolled}/${capacity} enrolled`, tone: "is-active" };
  };
  const teacherForClass = (classRow) => {
    // Junior teachers are allocated to a grade, not a particular stream. A
    // Grade 5 teacher therefore covers Grade 5 Blue (and any future stream).
    // Senior allocations remain specific to both level and stream.
    const matches = teacherAssignments.filter((item) =>
      item.class_level === classRow.class_level &&
      item.campus === classRow.campus &&
      (classRow.campus === "junior" ||
        (item.class_stream || "") === (classRow.class_stream || "")),
    );
    return matches
      .map((assignment) => staffProfiles.find((profile) => profile.id === assignment.teacher_id))
      .find((teacher) => teacher && teacher.portal_access_enabled !== false) || null;
  };
  const subjectKey = (subject) => String(subject || "")
    .toLowerCase()
    .replace(/english language/g, "english")
    .replace(/heritage studies/g, "heritage")
    .replace(/family religious studies/g, "frs")
    .replace(/chishona/g, "shona")
    .replace(/[^a-z0-9]/g, "");
  const subjectCoverageForClass = (classRow) => {
    const expected = getSubjectsByGradeStream(
      classRow.class_level,
      classRow.class_stream || (classRow.campus === "junior" ? "Blue" : ""),
    );
    const assigned = subjectAssignments.filter((item) =>
      item.class_level === classRow.class_level &&
      item.campus === classRow.campus &&
      (classRow.campus === "junior" || !item.class_stream || item.class_stream === classRow.class_stream),
    );
    return expected.map((subject) => {
      const assignment = assigned.find((item) => subjectKey(item.subject) === subjectKey(subject));
      const teacher = assignment && staffProfiles.find((profile) => profile.id === assignment.teacher_id && profile.portal_access_enabled !== false);
      return { subject, teacher };
    });
  };
  const load = async () => {
    const [classResult, studentResult, assignmentResult, subjectResult, staffResult] = await Promise.all([
      supabase
        .from("school_classes")
        .select("*")
        .order("campus")
        .order("class_level"),
      supabase.from("students").select("*").order("full_name"),
      supabase.from("teacher_class_assignments").select("teacher_id, class_level, class_stream, campus"),
      supabase.from("teacher_class_subject_assignments").select("teacher_id, class_level, class_stream, subject, campus"),
      supabase.from("profiles").select("id, full_name, portal_access_enabled").eq("role", "teacher"),
    ]);
    if (classResult.error) {
      if (isMissingTable(classResult.error)) setSetupRequired(true);
      else setError(classResult.error.message);
      return;
    }
    setSetupRequired(false);
    setClasses(classResult.data ?? []);
    if (studentResult.error) setError(studentResult.error.message);
    else setStudents(studentResult.data ?? []);
    if (assignmentResult.error) setError(assignmentResult.error.message);
    else setTeacherAssignments(assignmentResult.data ?? []);
    if (subjectResult.error) setError(subjectResult.error.message);
    else setSubjectAssignments(subjectResult.data ?? []);
    if (staffResult.error) setError(staffResult.error.message);
    else setStaffProfiles(staffResult.data ?? []);
  };
  useEffect(() => {
    load();
  }, [supabase]);
  useEffect(() => {
    const learnerDestination = selectedClass || selectedStream;
    if (learnerDestination && !learner.admission_number)
      setLearner((value) => ({
        ...value,
        admission_number: nextAdmissionNumber(students, value.enrolled_year),
      }));
  }, [selectedClass, selectedStream, students]);
  const saveClass = async (event) => {
    event.preventDefault();
    setError("");
    const row = {
      ...form,
      class_level: form.class_level.trim(),
      class_stream: form.campus === "junior" ? null : form.class_stream.trim() || null,
      capacity: form.capacity === "" ? null : Number(form.capacity),
      updated_at: new Date().toISOString(),
    };
    const previous = classes.find((item) => item.id === editingId);
    if (
      previous &&
      (previous.class_level !== row.class_level ||
        (previous.class_stream || "") !== (row.class_stream || ""))
    ) return setError("Class names and streams are corrected with the safe correction tool below. Cancel this edit, then choose the existing target class.");
    const { error: saveError } = await (editingId
      ? supabase.from("school_classes").update(row).eq("id", editingId)
      : supabase.from("school_classes").insert(row));
    if (saveError)
      return isMissingTable(saveError)
        ? setSetupRequired(true)
        : setError(saveError.message);
    setNotice(
      editingId ? "Class and enrolled learners updated." : "Class added.",
    );
    setForm(blankClass);
    setEditingId(null);
    await load();
    onChanged?.();
  };
  const editClass = (row) => {
    setSelectedId(row.id);
    setEditingId(row.id);
    setCorrectionTargetId("");
    setForm({
      class_level: row.class_level,
      class_stream: row.class_stream || "",
      campus: row.campus,
      capacity: row.capacity == null ? "" : String(row.capacity),
    });
  };
  const openClassPage = (row) => navigate({ pathname: location.pathname, search: `?section=classes&campus=${encodeURIComponent(row.campus)}&classLevel=${encodeURIComponent(row.class_level)}` });
  const backToClasses = () => navigate({ pathname: location.pathname, search: "?section=classes" });
  const openStreamPage = (row) => navigate({ pathname: location.pathname, search: `?section=classes&campus=${encodeURIComponent(row.campus)}&classLevel=${encodeURIComponent(row.class_level)}&stream=${encodeURIComponent(row.id)}` });
  const backToClassPage = () => navigate({ pathname: location.pathname, search: `?section=classes&campus=${encodeURIComponent(selectedCampus)}&classLevel=${encodeURIComponent(selectedLevel)}` });
  const updateWorkspaceCapacity = async (event) => {
    event.preventDefault();
    if (!selectedStream) return;
    const capacity = Number(new FormData(event.currentTarget).get("capacity"));
    if (!Number.isInteger(capacity) || capacity < 1) return setError("Capacity must be a whole number of at least 1.");
    const { error: saveError } = await supabase
      .from("school_classes")
      .update({ capacity, updated_at: new Date().toISOString() })
      .eq("id", selectedStream.id);
    if (saveError) return setError(saveError.message);
    setNotice(`Capacity for ${classLabel(selectedStream)} updated to ${capacity}.`);
    await load();
    onChanged?.();
  };
  const cancelEdit = () => {
    setEditingId(null);
    setCorrectionTargetId("");
    setForm(blankClass);
  };
  const correctClass = async () => {
    if (!editingId || !correctionTargetId) return setError("Choose the correct target class first.");
    const source = classes.find((item) => item.id === editingId);
    const target = classes.find((item) => item.id === correctionTargetId);
    if (!source || !target) return setError("The source or target class is no longer available.");
    if (!window.confirm(`Correct ${classLabel(source)} to ${classLabel(target)}? Learners, teacher allocations, subject allocations, and coursework will move together. The old stream will be kept as inactive with an audit record.`)) return;
    setError("");
    const { data, error: correctionError } = await supabase.rpc("correct_school_class", {
      p_source_class_id: source.id,
      p_target_class_id: target.id,
    });
    if (correctionError) return setError(correctionError.message);
    setNotice(`${classLabel(source)} was corrected to ${classLabel(target)}. Moved ${data?.learners_moved ?? 0} learners, ${data?.class_assignments_moved ?? 0} class allocations, ${data?.subject_assignments_moved ?? 0} subject allocations, and ${data?.coursework_assessments_moved ?? 0} coursework assessments.`);
    cancelEdit();
    await load();
    onChanged?.();
  };
  const startRecommendedStream = (row) => {
    setEditingId(null);
    setSelectedId("");
    setForm({
      class_level: row.class_level,
      class_stream: "",
      campus: row.campus,
      capacity: row.capacity == null ? "50" : String(row.capacity),
    });
    setNotice(`Create the next ${row.class_level} stream. Choose its stream name, then save it.`);
  };
  const removeClass = async (row) => {
    if (
      !window.confirm(
        `Remove ${classLabel(row)} from class management? Existing learner history will be kept.`,
      )
    )
      return;
    const { error: removeError } = await supabase
      .from("school_classes")
      .delete()
      .eq("id", row.id);
    if (removeError) return setError(removeError.message);
    setSelectedId((current) => (current === row.id ? "" : current));
    setNotice("Class removed. Learner records were not deleted.");
    await load();
    onChanged?.();
  };
  const toggleClass = async (row) => {
    const { error: saveError } = await supabase
      .from("school_classes")
      .update({ active: !row.active, updated_at: new Date().toISOString() })
      .eq("id", row.id);
    if (saveError) setError(saveError.message);
    else {
      setNotice(`Class ${row.active ? "deactivated" : "activated"}.`);
      await load();
      onChanged?.();
    }
  };
  const addLearner = async (event) => {
    event.preventDefault();
    const learnerDestination = selectedClass || selectedStream;
    if (!learnerDestination) return setError("Choose a class first.");
    const admissionNumber = nextAdmissionNumber(
      students,
      learner.enrolled_year,
    );
    const { error: saveError } = await supabase.from("students").insert({
      ...learner,
      admission_number: admissionNumber,
      enrolled_year: Number(learner.enrolled_year),
      class_level: learnerDestination.class_level,
      class_stream: learnerDestination.class_stream || null,
      campus: learnerDestination.campus,
      status: "active",
      inactive_reason: null,
    });
    if (saveError) return setError(saveError.message);
    setLearner({
      ...blankLearner,
      admission_number: nextAdmissionNumber(
        [
          ...students,
          {
            enrolled_year: learner.enrolled_year,
            admission_number: admissionNumber,
          },
        ],
        learner.enrolled_year,
      ),
    });
    setNotice("Learner added to this class.");
    await load();
    onChanged?.();
  };
  const deactivateLearner = async (row) => {
    if (
      !window.confirm(
        `Mark ${row.full_name} as no longer enrolled? Their records remain available to linked parents as historical records.`,
      )
    )
      return;
    const { error: saveError } = await supabase
      .from("students")
      .update({ status: "inactive", inactive_reason: "left_school" })
      .eq("id", row.id);
    if (saveError) return setError(saveError.message);
    setNotice(
      `${row.full_name} is marked as no longer enrolled. Their history has been retained.`,
    );
    await load();
    onChanged?.();
  };
  const reactivateLearner = async (row) => {
    if (
      !window.confirm(
        `Reactivate ${row.full_name}? They will appear as enrolled again across teacher, finance, and parent portals.`,
      )
    )
      return;
    const { error: saveError } = await supabase
      .from("students")
      .update({ status: "active", inactive_reason: null })
      .eq("id", row.id);
    if (saveError) return setError(saveError.message);
    setNotice(`${row.full_name} has been reactivated and is enrolled again.`);
    await load();
    onChanged?.();
  };
  if (setupRequired)
    return (
      <div className="dash-section">
        <div className="dash-page-header">
          <div>
            <h1 className="dash-page-title">Class management</h1>
          </div>
        </div>
        <Card>
          <h2>Class management setup required</h2>
          <p className="muted">
            Apply the latest Supabase migrations, then return here to manage
            classes.
          </p>
        </Card>
      </div>
    );
  if (selectedLevel && selectedCampus) {
    const isJunior = selectedCampus === "junior";
    const heading = isJunior ? `${selectedLevel} workspace` : `${selectedLevel} streams`;
    const workspaceCoverage = selectedStream ? subjectCoverageForClass(selectedStream) : [];
    const workspaceTeacher = selectedStream ? teacherForClass(selectedStream) : null;
    const workspaceCapacity = selectedStream ? capacityStatus(selectedStream) : null;
    return <div className="dash-section class-manager class-page">
      <button type="button" className="class-page-back" onClick={selectedStream ? backToClassPage : backToClasses}>← {selectedStream ? heading : "All classes"}</button>
      {error && <PortalNotice tone="error">{error}</PortalNotice>}
      {notice && <PortalNotice tone="success">{notice}</PortalNotice>}
      {!selectedStream && <>
        <header className="class-page-hero"><div><p className="eyebrow">{isJunior ? "Junior School · class workspace" : "Senior School · select a stream"}</p><h1 className="dash-page-title">{heading}</h1><p className="dash-page-sub">{isJunior ? "This grade does not use streams. Its learners and class actions live together." : "Choose a stream before managing learners, teachers, and subject coverage."}</p></div><span>{classPageRows.length} {isJunior ? "grade" : "stream"}{classPageRows.length === 1 ? "" : "s"}</span></header>
        {isJunior ? <section className="class-page-card"><div><p className="eyebrow">Whole grade</p><h2>{selectedLevel}</h2><p>{activeLearnersForClass(classPageRows[0] || {})} active learners · capacity {classPageRows[0]?.capacity || "—"}</p></div><button type="button" className="btn primary" onClick={() => classPageRows[0] && openStreamPage(classPageRows[0])}>Open grade workspace →</button></section> : <section className="class-stream-grid">{classPageRows.map((row) => { const capacity = capacityStatus(row); return <button type="button" className="class-stream-card" key={row.id} onClick={() => openStreamPage(row)}><span>Stream</span><strong>{row.class_stream || "Whole form"}</strong><small>{capacity.label}</small><b>Open workspace →</b></button> })}</section>}
      </>}
      {selectedStream && <section className="class-workspace">
        <header className="class-page-hero"><div><p className="eyebrow">{isJunior ? "Junior School · whole grade" : "Senior School · stream workspace"}</p><h1 className="dash-page-title">{classLabel(selectedStream)}</h1><p className="dash-page-sub">Manage this {isJunior ? "grade" : "stream"} without leaving its dedicated workspace.</p></div><span>{workspaceCapacity.label}</span></header>
        <div className="class-workspace-summary">
          <article><span>Class teacher</span><strong>{workspaceTeacher?.full_name || "Not assigned"}</strong></article>
          <article><span>Subject coverage</span><strong>{workspaceCoverage.filter((item) => item.teacher).length}/{workspaceCoverage.length} assigned</strong></article>
          <article><span>Active learners</span><strong>{workspaceCapacity.enrolled}</strong></article>
        </div>
        <div className="class-workspace-grid">
          <section className="class-workspace-panel"><h2>Class capacity</h2><p>Set the enrolment point at which another stream should be considered.</p><form onSubmit={updateWorkspaceCapacity}><label>Capacity<input name="capacity" type="number" min="1" defaultValue={selectedStream.capacity || 50} /></label><Button type="submit">Save capacity</Button></form></section>
          <section className="class-workspace-panel"><h2>Allocated subject teachers</h2><div className="class-coverage-list">{workspaceCoverage.map((item) => <div key={item.subject}><span>{item.subject}</span><strong>{item.teacher?.full_name || "Unassigned"}</strong></div>)}</div></section>
        </div>
        <section className="class-workspace-panel class-workspace-register"><div className="class-workspace-panel-head"><div><h2>Learner register</h2><p>{workspaceStudents.length} learner{workspaceStudents.length === 1 ? "" : "s"} recorded for {classLabel(selectedStream)}.</p></div></div><div className="portal-table-wrap"><table className="portal-table"><thead><tr><th>Learner</th><th>Admission no.</th><th>Status</th><th>Action</th></tr></thead><tbody>{workspaceStudents.length ? workspaceStudents.map((row) => <tr key={row.id}><td>{row.full_name}</td><td>{row.admission_number}</td><td><span className={row.status === "active" ? "status-chip is-active" : "status-chip is-inactive"}>{row.status === "active" ? "Enrolled" : "Inactive"}</span></td><td><Button type="button" variant="secondary" onClick={() => row.status === "active" ? deactivateLearner(row) : reactivateLearner(row)}>{row.status === "active" ? "Deactivate" : "Reactivate"}</Button></td></tr>) : <tr><td colSpan="4">No learners are recorded in this {isJunior ? "grade" : "stream"} yet.</td></tr>}</tbody></table></div></section>
        <section className="class-workspace-panel class-workspace-add"><h2>Add learner to {classLabel(selectedStream)}</h2><form className="portal-form" onSubmit={addLearner}><label>Full name<input required value={learner.full_name} onChange={(event) => setLearner({ ...learner, full_name: event.target.value })} /></label><label>Admission number<input value={learner.admission_number} readOnly /></label><label>Date of birth<input type="date" value={learner.date_of_birth} onChange={(event) => setLearner({ ...learner, date_of_birth: event.target.value })} /></label><label>Enrolled year<input type="number" min="2000" max="2100" value={learner.enrolled_year} onChange={(event) => setLearner({ ...learner, enrolled_year: event.target.value })} /></label><Button type="submit">Add learner</Button></form></section>
      </section>}
    </div>;
  }
  return (
    <div className="dash-section class-manager">
      <div className="dash-page-header class-manager-header">
        <div>
          <p className="class-manager-eyebrow">Administration</p>
          <h1 className="dash-page-title">Class management</h1>
          <p className="dash-page-sub">
            Set up classes, organise learners and preserve their school history.
          </p>
        </div>
        <div className="class-manager-summary">
          <strong>{displayedClasses.length}</strong>
          <span>{showInactive ? "classes" : "active classes"}</span>
        </div>
      </div>
      {error && <PortalNotice tone="error">{error}</PortalNotice>}
      {notice && <PortalNotice>{notice}</PortalNotice>}
      <div className="portal-workspace class-manager-workspace">
        <Card className="class-manager-panel class-manager-create">
          <div className="class-manager-panel-heading">
            <div>
              <h2>{editingId ? "Edit class" : "Add a class"}</h2>
              <p>
                {editingId
                  ? "Update details; enrolled learners move with this class."
                  : "Create a class. Junior classes do not use streams."}
              </p>
            </div>
          </div>
          <form
            className="form portal-form class-manager-form"
            onSubmit={saveClass}
          >
            <label>
              Class level
              <input
                required
                value={form.class_level}
                placeholder="e.g. Grade 8"
                onChange={(e) =>
                  setForm((value) => ({
                    ...value,
                    class_level: e.target.value,
                  }))
                }
              />
            </label>
            {form.campus === "senior" ? (
              <label>
                Stream <span className="field-optional">Optional</span>
                <input
                  value={form.class_stream}
                  placeholder="e.g. Blue"
                  onChange={(e) =>
                    setForm((value) => ({ ...value, class_stream: e.target.value }))
                  }
                />
              </label>
            ) : (
              <p className="muted">Junior classes are grade-based and do not use streams.</p>
            )}
            <label>
              Campus
              <select
                value={form.campus}
                onChange={(e) =>
                  setForm((value) => ({
                    ...value,
                    campus: e.target.value,
                    class_stream: e.target.value === "junior" ? "" : value.class_stream,
                  }))
                }
              >
                <option value="junior">Junior campus</option>
                <option value="senior">Senior campus</option>
              </select>
            </label>
            <label>
              Capacity
              <input
                type="number"
                min="1"
                value={form.capacity}
                placeholder="50"
                onChange={(e) => setForm((value) => ({ ...value, capacity: e.target.value }))}
              />
              <small>When enrolment reaches this number, the system recommends another stream.</small>
            </label>
            {editingId && (
              <fieldset style={{ gridColumn: "1 / -1" }}>
                <legend>Correct this class or stream</legend>
                <p className="muted">Use this when a class already has learners or teaching records and its name or stream is wrong. The old class is retained as inactive with a correction audit record.</p>
                <div className="portal-action-row">
                  <select value={correctionTargetId} onChange={(event) => setCorrectionTargetId(event.target.value)}>
                    <option value="">Choose the correct active class</option>
                    {classes.filter((item) => item.id !== editingId && item.active && item.campus === form.campus).map((item) => (
                      <option key={item.id} value={item.id}>{classLabel(item)}</option>
                    ))}
                  </select>
                  <Button type="button" variant="secondary" disabled={!correctionTargetId} onClick={correctClass}>Correct and move records</Button>
                </div>
              </fieldset>
            )}
            <div className="portal-action-row class-manager-form-actions">
              <Button type="submit">
                {editingId ? "Save changes" : "Add class"}
              </Button>
              {editingId && (
                <Button type="button" variant="secondary" onClick={cancelEdit}>
                  Cancel
                </Button>
              )}
            </div>
          </form>
        </Card>
        <Card className="class-manager-panel class-manager-list">
          <div className="class-manager-panel-heading">
            <div>
              <h2>Classes</h2>
              <p>Select a class to view learners or make changes.</p>
            </div>
            <div className="portal-action-row"><span className="class-manager-count">{displayedClasses.length} {showInactive ? 'total' : 'active'}</span><Button type="button" variant="secondary" onClick={() => setShowInactive((value) => !value)}>{showInactive ? 'Hide inactive' : 'Show inactive'}</Button></div>
          </div>
          <div className="portal-table-wrap">
            <table className="portal-table class-manager-table">
              <thead>
                <tr>
                  <th>Class</th>
                  <th>Enrolment</th>
                  <th>Campus</th>
                  <th>Teacher</th>
                  <th>Subject coverage</th>
                  <th>Status</th>
                  <th className="class-manager-actions-head">Manage</th>
                </tr>
              </thead>
              <tbody>
                {displayedClasses.length ? (
                  campusGroups.flatMap((group) => [
                    <tr className="class-manager-campus-divider" key={`${group.id}-divider`}><td colSpan="7"><strong>{group.title}</strong><span>{group.description} · {group.classes.length} class{group.classes.length === 1 ? "" : "es"}</span></td></tr>,
                    ...group.classes.map((row) => (
                    <tr
                      key={row.id}
                      className={selectedId === row.id ? "is-selected" : ""}
                    >
                      <td>
                        <strong>{classLabel(row)}</strong>
                        <small>
                          {row.class_stream
                            ? `${row.class_level} stream`
                            : "No stream assigned"}
                        </small>
                      </td>
                      <td>
                        {(() => {
                          const capacity = capacityStatus(row);
                          return <span className={`class-status ${capacity.tone}`}>{capacity.label}</span>;
                        })()}
                      </td>
                      <td>
                        <span className="class-campus">{row.campus}</span>
                      </td>
                      <td>
                        {teacherForClass(row) ? (
                          <strong>{teacherForClass(row).full_name}</strong>
                        ) : (
                          <span className="class-status is-inactive">Unassigned</span>
                        )}
                      </td>
                      <td>
                        {(() => {
                          const coverage = subjectCoverageForClass(row);
                          const covered = coverage.filter((item) => item.teacher).length;
                          return coverage.length ? <><strong>{covered}/{coverage.length}</strong><small>{coverage.length - covered ? `${coverage.length - covered} unassigned` : "Fully assigned"}</small></> : <span className="class-status is-inactive">No subject plan</span>;
                        })()}
                      </td>
                      <td>
                        <span
                          className={`class-status ${row.active ? "is-active" : "is-inactive"}`}
                        >
                          {row.active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td>
                        <div className="portal-action-row class-manager-actions">
                          <Button
                            className="class-manager-view"
                            variant="secondary"
                            type="button"
                            onClick={() => openClassPage(row)}
                          >
                            {selectedId === row.id
                              ? "Viewing learners"
                              : "View learners"}
                          </Button>
                          <Button
                            variant="secondary"
                            type="button"
                            onClick={() => editClass(row)}
                          >
                            Edit
                          </Button>
                          {Number(row.capacity || 0) > 0 && activeLearnersForClass(row) >= Number(row.capacity) && (
                            <Button
                              variant="secondary"
                              type="button"
                              onClick={() => startRecommendedStream(row)}
                            >
                              Add new stream
                            </Button>
                          )}
                          <Button
                            className={
                              row.active ? "class-manager-warning" : ""
                            }
                            variant="secondary"
                            type="button"
                            onClick={() => toggleClass(row)}
                          >
                            {row.active ? "Deactivate" : "Activate"}
                          </Button>
                          <Button
                            className="class-manager-danger"
                            variant="secondary"
                            type="button"
                            onClick={() => removeClass(row)}
                          >
                            Remove
                          </Button>
                        </div>
                      </td>
                    </tr>
                    )),
                  ])
                ) : (
                  <tr>
                    <td colSpan="7" className="muted class-manager-empty">
                      No classes have been added yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
        {selectedClass && (
          <section
            className="class-manager-selected"
            aria-label={`${classLabel(selectedClass)} learners`}
          >
            <div className="class-manager-context">
              <div>
                <p>Selected class</p>
                <h2>{classLabel(selectedClass)}</h2>
                <span>
                  {selectedClass.campus} campus · {classStudents.length} learner
                  {classStudents.length === 1 ? "" : "s"}
                </span>
              </div>
              <div className="class-manager-insights">
                <div>
                  <strong>{activeClassStudents}</strong>
                  <span>active</span>
                </div>
                <div>
                  <strong>{classStudents.length - activeClassStudents}</strong>
                  <span>history</span>
                </div>
              </div>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setSelectedId("")}
              >
                Close
              </Button>
            </div>
            <div className="class-manager-subject-teachers" aria-label="Assigned subject teachers">
              <strong>Subject teachers</strong>
              <div>{subjectCoverageForClass(selectedClass).map((item) => <span key={item.subject}><b>{item.subject}</b> — {item.teacher?.full_name || "Unassigned"}</span>)}</div>
            </div>
            <div className="class-manager-detail-grid">
              <Card className="class-manager-panel class-manager-coverage">
                <div className="class-manager-panel-heading">
                  <div>
                    <h2>Subject coverage</h2>
                    <p>Assigned teachers are shown per subject. Gaps need a teacher allocation.</p>
                  </div>
                </div>
                {subjectCoverageForClass(selectedClass).length ? <div className="class-subject-coverage">{subjectCoverageForClass(selectedClass).map((item) => <div className="class-subject-coverage-row" key={item.subject}><span>{item.subject}</span>{item.teacher ? <strong>Teacher: {item.teacher.full_name}</strong> : <span className="class-status is-inactive">Unassigned</span>}</div>)}</div> : <p className="muted">No curriculum subjects are configured for this class yet.</p>}
              </Card>
              <Card className="class-manager-panel class-manager-enrol">
                <div className="class-manager-panel-heading">
                  <div>
                    <h2>Add learner</h2>
                    <p>They will be enrolled directly into this class.</p>
                  </div>
                </div>
                <form
                  className="form portal-form class-manager-form"
                  onSubmit={addLearner}
                >
                  <label>
                    Admission number
                    <input
                      readOnly
                      value={learner.admission_number}
                      aria-describedby="admission-help"
                    />
                    <small id="admission-help">
                      Generated automatically in 5-digit format.
                    </small>
                  </label>
                  <label>
                    Full name
                    <input
                      required
                      value={learner.full_name}
                      placeholder="Learner's full name"
                      onChange={(e) =>
                        setLearner((value) => ({
                          ...value,
                          full_name: e.target.value,
                        }))
                      }
                    />
                  </label>
                  <label>
                    Date of birth
                    <input
                      required
                      type="date"
                      value={learner.date_of_birth}
                      onChange={(e) =>
                        setLearner((value) => ({
                          ...value,
                          date_of_birth: e.target.value,
                        }))
                      }
                    />
                  </label>
                  <label>
                    Enrolled year
                    <input
                      required
                      type="number"
                      value={learner.enrolled_year}
                      onChange={(e) =>
                        setLearner((value) => ({
                          ...value,
                          enrolled_year: e.target.value,
                        }))
                      }
                    />
                  </label>
                  <div className="class-manager-form-actions">
                    <Button type="submit">Add learner</Button>
                  </div>
                </form>
              </Card>
              <Card className="class-manager-panel class-manager-learners">
                <div className="class-manager-panel-heading">
                  <div>
                    <h2>Class register</h2>
                    <p>Inactive learners remain as historical records.</p>
                  </div>
                  <span className="class-manager-count">
                    {classStudents.length} enrolled
                  </span>
                </div>
                <div className="portal-table-wrap">
                  <table className="portal-table class-manager-table">
                    <thead>
                      <tr>
                        <th>Learner</th>
                        <th>Admission no.</th>
                        <th>Status</th>
                        <th>Record</th>
                      </tr>
                    </thead>
                    <tbody>
                      {classStudents.length ? (
                        classStudents.map((row) => (
                          <tr key={row.id}>
                            <td>
                              <strong>{row.full_name}</strong>
                            </td>
                            <td>{row.admission_number}</td>
                            <td>
                              <span
                                className={`class-status ${row.status === "active" ? "is-active" : "is-inactive"}`}
                              >
                                {row.status === "active"
                                  ? "Active"
                                  : "No longer enrolled"}
                              </span>
                            </td>
                            <td>
                              {row.status === "active" ? (
                                <Button
                                  className="class-manager-warning"
                                  type="button"
                                  variant="secondary"
                                  onClick={() => deactivateLearner(row)}
                                >
                                  Deactivate
                                </Button>
                              ) : (
                                <Button
                                  className="class-manager-reactivate"
                                  type="button"
                                  variant="secondary"
                                  onClick={() => reactivateLearner(row)}
                                >
                                  Reactivate
                                </Button>
                              )}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="4" className="muted class-manager-empty">
                            No learners are in this class.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
