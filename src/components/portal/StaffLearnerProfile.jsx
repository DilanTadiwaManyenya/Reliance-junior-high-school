import { useEffect, useMemo, useState } from "react";
import Card from "../ui/Card";
import PortalNotice from "./PortalNotice";
import AcademicReportCard from "./AcademicReportCard";
import { getSubjectsByGradeStream } from "../../utils/CurriculumData";

const tabs = [
  "Summary",
  "Academics",
  "Attendance",
  "Sport",
  "Behaviour",
  "Fees",
];
const money = (value) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    Number(value || 0),
  );
const date = (value) =>
  value
    ? new Intl.DateTimeFormat("en-ZW", { dateStyle: "medium" }).format(
        new Date(`${value}T00:00:00`),
      )
    : "—";
const term = (value) =>
  String(value || "").startsWith("Term") ? value : `Term ${value}`;

export default function StaffLearnerProfile({ supabase, student, onBack, teacherView = false }) {
  const [activeTab, setActiveTab] = useState("Summary");
  const [state, setState] = useState({
    loading: true,
    error: "",
    academics: [],
    attendance: [],
    sports: [],
    behavior: [],
    awards: [],
    fees: [],
    payments: [],
    termSettings: [],
    reportFees: [],
    subjectTeachers: [],
  });

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const results = await Promise.all([
        supabase
          .from("academic_records")
          .select("*")
          .eq("student_id", student.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("attendance")
          .select("*")
          .eq("student_id", student.id)
          .order("date", { ascending: false }),
        supabase
          .from("sports_records")
          .select("*")
          .eq("student_id", student.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("behavior_notes")
          .select("*")
          .eq("student_id", student.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("student_awards")
          .select("*")
          .eq("student_id", student.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("fee_balances")
          .select("*")
          .eq("student_id", student.id)
          .order("academic_year", { ascending: false }),
        supabase
          .from("fee_payments")
          .select("*")
          .eq("student_id", student.id)
          .order("paid_on", { ascending: false }),
        supabase.from("term_settings").select("*"),
        supabase
          .from("report_term_fee_settings")
          .select("academic_year, term, class_level, amount"),
        supabase
          .from("teacher_subject_assignments")
          .select("subject, form_level")
          .eq("form_level", student.class_level),
      ]);
      if (!mounted) return;
      const [
        academics,
        attendance,
        sports,
        behavior,
        awards,
        fees,
        payments,
        termSettings,
        reportFees,
        subjectTeachers,
      ] = results;
      const optionalAwardsError = ["PGRST205", "42P01"].includes(
        awards.error?.code,
      );
      setState({
        loading: false,
        error:
          academics.error?.message ||
          attendance.error?.message ||
          sports.error?.message ||
          behavior.error?.message ||
          fees.error?.message ||
          payments.error?.message ||
          termSettings.error?.message ||
          reportFees.error?.message ||
          (!optionalAwardsError && awards.error?.message) ||
          "",
        academics: academics.data || [],
        attendance: attendance.data || [],
        sports: sports.data || [],
        behavior: behavior.data || [],
        awards: awards.data || [],
        fees: fees.data || [],
        payments: payments.data || [],
        termSettings: termSettings.data || [],
        reportFees: reportFees.data || [],
        subjectTeachers: subjectTeachers.data || [],
      });
    };
    load();
    return () => {
      mounted = false;
    };
  }, [supabase, student.id]);

  const summary = useMemo(() => {
    const present = state.attendance.filter((row) =>
      ["present", "late"].includes(row.status),
    ).length;
    const absent = state.attendance.filter(
      (row) => row.status === "absent",
    ).length;
    const rate = state.attendance.length
      ? Math.round((present / state.attendance.length) * 100)
      : 0;
    const marks = state.academics
      .map((row) => Number(row.percentage ?? row.score ?? row.term_mark))
      .filter(Number.isFinite);
    const average = marks.length
      ? (marks.reduce((total, mark) => total + mark, 0) / marks.length).toFixed(
          1,
        )
      : null;
    const passed = marks.filter((mark) => mark >= 50).length;
    const owing = state.fees.reduce(
      (total, row) =>
        total + Math.max(0, Number(row.total_fees) - Number(row.amount_paid)),
      0,
    );
    const credit = state.fees.reduce(
      (total, row) =>
        total +
        Math.abs(Math.min(0, Number(row.total_fees) - Number(row.amount_paid))),
      0,
    );
    return {
      present,
      absent,
      rate,
      average,
      passed,
      subjectCount: marks.length,
      owing,
      credit,
    };
  }, [state]);

  if (state.loading)
    return (
      <div className="staff-content-area">
        <p className="muted">Loading learner profile…</p>
      </div>
    );
  const report = Object.fromEntries(
    state.termSettings.map((row) => [`${row.academic_year}-${row.term}`, row]),
  );
  const latest = (rows, renderer, empty) => (
    <Card className="learner-profile-list">
      {rows.length ? (
        <div className="portal-list">{rows.map(renderer)}</div>
      ) : (
        <p className="muted">{empty}</p>
      )}
    </Card>
  );
  const visibleTabs = teacherView ? tabs.filter((tab) => tab !== "Fees") : tabs;
  const passedAcademics = state.academics.filter((row) => Number(row.exam_mark ?? row.term_mark ?? row.percentage ?? row.score) >= 50);

  return (
    <div className="staff-content-area learner-profile-page">
      <button type="button" className="learner-profile-back" onClick={onBack}>
        ← Back to learner register
      </button>
      <header className="learner-profile-hero">
        <div>
          <p className="learner-profile-kicker">Learner 360° profile</p>
          <h1>{student.full_name}</h1>
          <p>
            {student.admission_number} · {student.class_level}
            {student.class_stream ? ` ${student.class_stream}` : ""}
          </p>
        </div>
        <span
          className={`learner-profile-status ${student.status === "active" ? "active" : "inactive"}`}
        >
          {student.status === "active" ? "Enrolled" : "Left school"}
        </span>
      </header>
      {student.status !== "active" && (
        <PortalNotice tone="error">
          This learner is no longer enrolled. Their school and finance history
          is retained for review.
        </PortalNotice>
      )}
      {state.error && (
        <PortalNotice tone="error">
          Some profile information could not be loaded: {state.error}
        </PortalNotice>
      )}
      <nav
        className="learner-profile-tabs"
        aria-label="Learner profile sections"
      >
        {visibleTabs.map((tab) => (
          <button
            type="button"
            key={tab}
            className={activeTab === tab ? "is-active" : ""}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </nav>
      {activeTab === "Summary" && (
        <>
          <section className="learner-profile-metrics">
            <Card>
              <span>Academic average</span>
              <strong>{summary.average ? `${summary.average}%` : "—"}</strong>
              <small>
                {summary.passed}/{summary.subjectCount} subjects passed
              </small>
            </Card>
            <Card>
              <span>Attendance</span>
              <strong>{summary.rate}%</strong>
              <small>
                {summary.present} present · {summary.absent} absent
              </small>
            </Card>
            <Card>
              <span>Sport & conduct</span>
              <strong>{state.sports.length + state.behavior.length}</strong>
              <small>
                {state.sports.length} sport · {state.behavior.length} behaviour
                records
              </small>
            </Card>
            {!teacherView && <Card>
              <span>
                {summary.credit ? "Overpayment credit" : "Outstanding fees"}
              </span>
              <strong
                className={summary.credit ? "learner-profile-credit" : ""}
              >
                {summary.credit
                  ? `-${money(summary.credit)}`
                  : money(summary.owing)}
              </strong>
              <small>
                {state.fees.length} fee period
                {state.fees.length === 1 ? "" : "s"} recorded
              </small>
            </Card>}
          </section>
          <section className="learner-profile-summary-grid">
            <Card>
              <h2>Academic snapshot</h2>
              <p>
                {summary.subjectCount
                  ? `${summary.passed} of ${summary.subjectCount} recorded subjects are currently passing.`
                  : "No academic marks recorded yet."}
              </p>
              <button type="button" onClick={() => setActiveTab("Academics")}>
                View academic report →
              </button>
            </Card>
            <Card>
              <h2>Attendance snapshot</h2>
              <p>
                {state.attendance.length
                  ? `${summary.present} present days from ${state.attendance.length} attendance entries.`
                  : "No attendance entries recorded yet."}
              </p>
              <button type="button" onClick={() => setActiveTab("Attendance")}>
                View attendance history →
              </button>
            </Card>
          </section>
        </>
      )}
      {activeTab === "Academics" && (
        <AcademicReportCard
          student={student}
          academics={teacherView ? passedAcademics : state.academics}
          attendance={state.attendance}
          behavior={state.behavior}
          sports={state.sports}
          awards={state.awards}
          fees={state.fees}
          subjects={teacherView ? [...new Set(passedAcademics.map((row) => row.subject).filter(Boolean))] : getSubjectsByGradeStream(
            student.class_level,
            student.class_stream,
          )}
          report={report}
          reportFees={state.reportFees}
          subjectTeachers={state.subjectTeachers}
          adminAccess
        />
      )}
      {activeTab === "Attendance" &&
        latest(
          state.attendance,
          (row) => (
            <p key={row.id}>
              <strong>{date(row.date)}</strong>{" "}
              <span className={`portal-status ${row.status}`}>
                {row.status}
              </span>
              {row.note && (
                <>
                  <br />
                  <span className="muted">{row.note}</span>
                </>
              )}
            </p>
          ),
          "No attendance records have been entered yet.",
        )}
      {activeTab === "Sport" &&
        latest(
          state.sports,
          (row) => (
            <p key={row.id}>
              <strong>{row.activity}</strong> · {term(row.term)}
              {row.achievement && ` · ${row.achievement}`}
              {row.note && (
                <>
                  <br />
                  <span className="muted">{row.note}</span>
                </>
              )}
            </p>
          ),
          "No sport records have been entered yet.",
        )}
      {activeTab === "Behaviour" &&
        latest(
          state.behavior,
          (row) => (
            <p key={row.id}>
              <span className={`portal-status ${row.severity}`}>
                {row.severity}
              </span>{" "}
              <strong>{row.category}</strong>
              <br />
              <span className="muted">{row.description}</span>
            </p>
          ),
          "No behaviour records have been entered yet.",
        )}
      {activeTab === "Fees" && (
        <section className="learner-profile-fees">
          <Card>
            <h2>Fee plan and balances</h2>
            {state.fees.length ? (
              <div className="portal-list">
                {state.fees.map((row) => (
                  <p key={row.id}>
                    <strong>
                      {term(row.term)} {row.academic_year}
                    </strong>
                    <br />
                    <span className="muted">
                      Fee: {money(row.total_fees)} · Paid:{" "}
                      {money(row.amount_paid)} · Balance:{" "}
                      {money(Number(row.total_fees) - Number(row.amount_paid))}
                    </span>
                  </p>
                ))}
              </div>
            ) : (
              <p className="muted">No fee records have been entered yet.</p>
            )}
          </Card>
          <Card>
            <h2>Payment timeline</h2>
            {state.payments.length ? (
              <div className="portal-list">
                {state.payments.map((row) => (
                  <p key={row.id}>
                    <strong>
                      {money(row.amount)} · {date(row.paid_on)}
                    </strong>
                    <br />
                    <span className="muted">
                      {term(row.term)} {row.academic_year} ·{" "}
                      {row.payment_method.replace("_", " ")} ·{" "}
                      {row.payment_plan === "instalment"
                        ? "Instalment payment"
                        : "Once-off payment"}
                      {row.reference_number
                        ? ` · Ref: ${row.reference_number}`
                        : ""}
                    </span>
                  </p>
                ))}
              </div>
            ) : (
              <p className="muted">
                No itemised payments have been recorded yet. Older balances show
                their latest payment date only.
              </p>
            )}
          </Card>
        </section>
      )}
    </div>
  );
}
