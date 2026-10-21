import MobileRecordTable from './MobileRecordTable'
import OperationsExports from './OperationsExports'
import { downloadCsv, downloadWorkbook, readAllRows } from '../../lib/operationsExport'
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  LuBuilding2,
  LuChevronLeft,
  LuChevronRight,
  LuCircleAlert,
  LuCircleCheck,
  LuCircleX,
  LuCreditCard,
  LuDownload,
  LuFilter,
  LuPencil,
  LuSearch,
  LuWallet,
} from "react-icons/lu";
import PortalNotice from "./PortalNotice";
import { useModalFocus } from "../../hooks/useModalFocus";
import ReportTermSettings from "./ReportTermSettings";
import { getFeeAmount } from "../../lib/FeeStructure";
import { logActivity } from "../../lib/logActivity";
import {
  CLASS_LEVELS,
} from "../../data/classOptions";
import { useSchoolClasses } from "../../hooks/useSchoolClasses";
import { FINANCE_CURRENCIES, formatMoney } from "../../lib/currency";
import { feePaymentStorageKey, loadFeePayment, saveFeePayment } from '../../lib/feePaymentRetry';

const CURRENT_YEAR = 2026;
const CURRENT_TERM = "Term 3";
const TERMS = ["Term 1", "Term 2", "Term 3"];
const money = (value, currency = "USD") => formatMoney(value, currency);
const defaultFee = (level) => getFeeAmount(level);
const initials = (name) =>
  (name ?? "?")
    .split(" ")
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

const statusMeta = {
  credit: {
    label: "Credit",
    filter: "Overpaid",
    icon: LuCircleCheck,
    card: "credit",
  },
  full: {
    label: "Settled",
    filter: "Fully Paid",
    icon: LuCircleCheck,
    card: "success",
  },
  half: {
    label: "Partial",
    filter: "Partially Paid",
    icon: LuCircleAlert,
    card: "warning",
  },
  unpaid: {
    label: "Overdue",
    filter: "Unpaid",
    icon: LuCircleX,
    card: "danger",
  },
};

function PaymentModal({ student, onClose, onSave, saving, error }) {
  const modalRef = useRef(null);
  useModalFocus(true, modalRef, () => { if (!saving) onClose(); });
  const [amountReceived, setAmountReceived] = useState("");
  const [paidOn, setPaidOn] = useState(new Date().toISOString().slice(0, 10));
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [referenceNumber, setReferenceNumber] = useState("");
  const balance = Number(student.totalFees) - (Number(student.amountPaid) + Number(amountReceived || 0));
  const isCredit = balance < 0;

  return (
    <div
      className="fee-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="payment-dialog-title"
      onClick={(event) => !saving && event.target === event.currentTarget && onClose()}
    >
      <form
        ref={modalRef} tabIndex={-1} className="fee-modal"
        onSubmit={(event) => {
          event.preventDefault();
          onSave(student, {
            amount: amountReceived,
            paid_on: paidOn,
            payment_method: paymentMethod,
            reference_number: referenceNumber,
          });
        }}
      >
        <div className="fee-modal-head">
          <div>
            <p className="fee-modal-eyebrow">Payment collection</p>
            <h2 id="payment-dialog-title">Update payment</h2>
            <p>
              {student.full_name} · {student.admission_number}
            </p>
          </div>
          <button
            type="button"
            disabled={saving} className="fee-icon-button"
            onClick={onClose}
            aria-label="Close payment dialog"
          >
            ×
          </button>
        </div>
        <div className="fee-modal-fields">
          {error && <p role="alert">{error}</p>}
          <label>
            Total term fee
            <input
              type="number"
              value={student.totalFees}
              readOnly
            />
          </label>
          <label>
            Already received
            <input
              type="number"
              value={student.amountPaid}
              readOnly
            />
          </label>
          <label>
            New amount received
            <input type="number" min="0.01" step="0.01" value={amountReceived} onChange={(event) => setAmountReceived(event.target.value)} required autoFocus />
          </label>
          <label>
            Payment date
            <input
              type="date"
              value={paidOn}
              onChange={(event) => setPaidOn(event.target.value)}
              required
            />
          </label>
          <label>
            Payment method
            <select
              value={paymentMethod}
              onChange={(event) => setPaymentMethod(event.target.value)}
            >
              <option value="cash">Cash</option>
              <option value="ecocash">EcoCash</option>
              <option value="swipe">Swipe / card</option>
              <option value="transfer">Bank transfer</option>
              <option value="bank_deposit">Bank deposit</option>
            </select>
          </label>
          <label>
            Receipt / reference <span className="field-optional">Optional</span>
            <input
              value={referenceNumber}
              onChange={(event) => setReferenceNumber(event.target.value)}
              placeholder="Receipt number or reference"
            />
          </label>
        </div>
        <div className={`fee-modal-balance${isCredit ? " is-credit" : ""}`}>
          <span>
            {isCredit
              ? "Credit after update (overpaid)"
              : "Balance after this payment"}
          </span>
          <strong>{money(balance, student.currency)}</strong>
        </div>
        <div className="fee-modal-actions">
          <button
            type="button"
            className="fee-button fee-button-secondary"
            disabled={saving}
            onClick={onClose}
          >
            Cancel
          </button>
          <button className="fee-button fee-button-primary" disabled={saving}>
            {saving ? "Recording…" : "Record payment"}
          </button>
        </div>
      </form>
    </div>
  );
}

function EnrolmentModal({ supabase, onClose, onSaved, classLevels, streamsForLevel }) {
  const modalRef = useRef(null);
  useModalFocus(true, modalRef, () => { if (!saving) onClose(); });
  const [form, setForm] = useState({
    full_name: "",
    date_of_birth: "",
    class_level: "",
    class_stream: "",
    enrolled_year: new Date().getFullYear(),
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const update = (key) => (event) =>
    setForm((current) => ({ ...current, [key]: event.target.value }));
  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    const { error: saveError } = await supabase
      .from("students")
      .insert({
        ...form,
        enrolled_year: Number(form.enrolled_year),
        class_stream: form.class_stream || null,
        status: "active",
        inactive_reason: null,
      });
    setSaving(false);
    if (saveError) return setError(saveError.message);
    onSaved?.();
    onClose();
  };
  return (
    <div
      className="fee-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="enrolment-dialog-title"
      onClick={(event) => !saving && event.target === event.currentTarget && onClose()}
    >
      <form ref={modalRef} tabIndex={-1} className="fee-modal" onSubmit={submit}>
        <div className="fee-modal-head">
          <div>
            <p className="fee-modal-eyebrow">Learner enrolment</p>
            <h2 id="enrolment-dialog-title">Add learner</h2>
            <p>The admission number is assigned securely when saved.</p>
          </div>
          <button
            type="button"
            disabled={saving} className="fee-icon-button"
            onClick={onClose}
            aria-label="Close enrolment dialog"
          >
            ×
          </button>
        </div>
        {error && <PortalNotice tone="error">{error}</PortalNotice>}
        <div className="fee-modal-fields">
          <label>
            Full name
            <input
              required
              value={form.full_name}
              onChange={update("full_name")}
            />
          </label>
          <label>
            Date of birth
            <input
              required
              type="date"
              value={form.date_of_birth}
              onChange={update("date_of_birth")}
            />
          </label>
          <label>
            Class level
            <select
              required
              value={form.class_level}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  class_level: event.target.value,
                  class_stream: "",
                }))
              }
            >
              <option value="">Choose class level</option>
              {classLevels.map((level) => (
                <option key={level}>{level}</option>
              ))}
            </select>
          </label>
          <label>
            Class stream
            <select
              required
              disabled={!form.class_level || !streamsForLevel(form.class_level).length}
              value={form.class_stream}
              onChange={update("class_stream")}
            >
              <option value="">
                {!streamsForLevel(form.class_level).length
                  ? "N/A (single class)"
                  : "Choose class stream"}
              </option>
              {streamsForLevel(form.class_level).map((stream) => (
                <option key={stream}>{stream}</option>
              ))}
            </select>
          </label>
          <label>
            Enrolled year
            <input
              required
              type="number"
              value={form.enrolled_year}
              onChange={update("enrolled_year")}
            />
          </label>
          <label>
            Admission number
            <input readOnly value="Assigned securely on save" />
          </label>
        </div>
        <div className="fee-modal-actions">
          <button
            type="button"
            className="fee-button fee-button-secondary"
            onClick={onClose}
          >
            Cancel
          </button>
          <button className="fee-button fee-button-primary" disabled={saving}>
            {saving ? "Enrolling…" : "Enrol learner"}
          </button>
        </div>
      </form>
    </div>
  );
}

function FeeStructureModal({ mapping, currency, onClose, onSave, saving }) {
  const modalRef = useRef(null);
  useModalFocus(true, modalRef, () => { if (!saving) onClose(); });
  const [bands, setBands] = useState([...mapping]);

  const updateBand = (id, amount) => {
    setBands(
      bands.map((b) =>
        b.band_id === id ? { ...b, amount: Number(amount) } : b,
      ),
    );
  };

  return (
    <div
      className="fee-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="fee-structure-dialog-title"
      onClick={(event) => !saving && event.target === event.currentTarget && onClose()}
    >
      <form
        ref={modalRef} tabIndex={-1} className="fee-modal"
        onSubmit={(event) => {
          event.preventDefault();
          onSave(bands);
        }}
      >
        <div className="fee-modal-head">
          <div>
            <p className="fee-modal-eyebrow">School Settings</p>
            <h2 id="fee-structure-dialog-title">{currency} fee structure</h2>
            <p>Set each class band in {currency}. No exchange conversion is applied.</p>
          </div>
          <button type="button" disabled={saving} className="fee-icon-button" onClick={onClose} aria-label="Close fee structure dialog">
            ×
          </button>
        </div>
        <div
          className="fee-modal-fields"
          style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
        >
          {bands.map((band) => (
            <label key={band.band_id}>
              {band.band_name} ({currency})
              <input
                type="number"
                min="0"
                step="0.01"
                value={band.amount}
                onChange={(e) => updateBand(band.band_id, e.target.value)}
                required
              />
            </label>
          ))}
        </div>
        <div className="fee-modal-actions">
          <button
            type="button"
            className="fee-button fee-button-secondary"
            onClick={onClose}
          >
            Cancel
          </button>
          <button className="fee-button fee-button-primary" disabled={saving}>
            {saving ? "Saving..." : "Save Structure"}
          </button>
        </div>
      </form>
    </div>
  );
}

function MasterTable({
  students,
  onEdit,
  onHistory,
  onOpenStudent,
  onExport,
  readOnly,
  quickStatus,
  campusScope,
  scopeLabel,
  currency,
}) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [campusFilter, setCampusFilter] = useState(campusScope || "all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedIds, setSelectedIds] = useState(new Set());

  useEffect(() => {
    if (quickStatus) {
      setStatusFilter(quickStatus);
      setPage(1);
    }
  }, [quickStatus]);

  useEffect(() => {
    setCampusFilter(campusScope || "all");
    setPage(1);
  }, [campusScope]);

  const filtered = useMemo(
    () =>
      students.filter(
        (student) =>
          `${student.full_name} ${student.admission_number} ${student.class_level} ${student.status === "active" ? "enrolled active" : "left school inactive"}`
            .toLowerCase()
            .includes(query.toLowerCase()) &&
          (statusFilter === "all" || student.category === statusFilter) &&
          (campusFilter === "all" || student.campus === campusFilter),
      ),
    [students, query, statusFilter, campusFilter],
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const visible = filtered.slice((page - 1) * pageSize, page * pageSize);
  const selected = filtered.filter((student) => selectedIds.has(student.id));

  const toggleRow = (id) =>
    setSelectedIds((current) => {
      const next = new Set(current);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  const togglePage = () =>
    setSelectedIds((current) =>
      visible.every((student) => current.has(student.id))
        ? new Set(
            [...current].filter(
              (id) => !visible.some((student) => student.id === id),
            ),
          )
        : new Set([...current, ...visible.map((student) => student.id)]),
    );

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  return (
    <section
      className="fees-master-card"
      aria-labelledby="student-fees-heading"
    >
      <div className="fees-table-heading">
        <div>
          <p className="fees-kicker">Term collection register</p>
          <h2 id="student-fees-heading">Student fee balances</h2>
          <p>
            {campusScope
              ? `Search, filter and collect payments for ${scopeLabel}.`
              : readOnly
                ? "Search and filter the school-wide fee collection register."
                : "Search, filter and collect payments from one consolidated view."}
          </p>
        </div>
        <button
          className="fee-button fee-button-export"
          onClick={() => onExport(filtered)}
        >
          <LuDownload size={17} /> Export report
        </button>
        <button className="fee-button fee-button-export" onClick={() => onExport(filtered, 'xlsx')}>Excel report</button>
      </div>
      <div className="fees-table-controls">
        <button
          type="button"
          className="fees-filter-icon"
          aria-label="Filter register"
        >
          <LuFilter size={18} />
        </button>
        <label className="fees-search">
          <LuSearch size={19} />
          <span className="sr-only">Search students</span>
          <input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
            placeholder="Search student name, admission ID or class"
          />
        </label>
        <label className="fees-select-label">
          Status filter
          <select
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value);
              setPage(1);
            }}
          >
            <option value="all">All statuses</option>
            <option value="full">Fully paid</option>
            <option value="half">Partially paid</option>
            <option value="unpaid">Unpaid</option>
          </select>
        </label>
        {!campusScope && <label className="fees-select-label">
          Campus
          <select
            value={campusFilter}
            onChange={(event) => {
              setCampusFilter(event.target.value);
              setPage(1);
            }}
          >
            <option value="all">All school</option>
            <option value="junior">Junior School</option>
            <option value="senior">Senior School</option>
          </select>
        </label>}
      </div>
      {selected.length > 0 && (
        <div className="fees-bulk-toolbar" role="status">
          <strong>{selected.length} selected</strong>
          <div>
            <button type="button" onClick={() => setSelectedIds(new Set())}>
              Clear selection
            </button>
            <button type="button" onClick={() => onExport(selected)}>
              <LuDownload size={15} /> Export selected
            </button>
            <button type="button" onClick={() => onExport(selected, 'xlsx')}>Excel selected</button>
          </div>
        </div>
      )}
      <div className="fee-table-wrap">
        <MobileRecordTable className="fee-table fee-master-table mobile-record-table" aria-label="Learner fee balances">
          <thead>
            <tr>
              <th className="selection-column" aria-label="Selection">
                <input
                  type="checkbox"
                  checked={
                    visible.length > 0 &&
                    visible.every((student) => selectedIds.has(student.id))
                  }
                  onChange={togglePage}
                  aria-label="Select all rows on this page"
                />
              </th>
              <th>Student name</th>
              <th>Admission ID</th>
              <th>Class / Grade</th>
              {!campusScope && <th>Campus</th>}
              <th className="currency">Total term fee ({currency})</th>
              <th className="currency">Amount paid ({currency})</th>
              <th className="currency">Balance owed ({currency})</th>
              <th>Fee status</th>
              <th>Enrolment</th>
              {!readOnly && <th className="actions-column">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {visible.length ? (
              visible.map((student) => {
                const meta = statusMeta[student.category];
                const StatusIcon = meta.icon;
                const isActive = student.status === "active";
                return (
                  <tr
                    key={student.id}
                    className={selectedIds.has(student.id) ? "is-selected" : ""}
                  >
                    <td className="selection-column">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(student.id)}
                        onChange={() => toggleRow(student.id)}
                        aria-label={`Select ${student.full_name}`}
                      />
                    </td>
                    <td>
                      <div className="fee-student">
                        <span className="fee-avatar">
                          {initials(student.full_name)}
                        </span>
                        <button
                          type="button"
                          className="fee-student-link"
                          onClick={() => onOpenStudent?.(student)}
                        >
                          {student.full_name}
                        </button>
                      </div>
                    </td>
                    <td className="fee-mono">
                      {student.admission_number || "—"}
                    </td>
                    <td>
                      {student.class_level}
                      {student.class_stream ? ` · ${student.class_stream}` : ""}
                    </td>
                    {!campusScope && (
                      <td>
                        <span
                          className={`fee-campus-badge ${student.campus === "junior" ? "junior" : "senior"}`}
                        >
                          <LuBuilding2 size={13} />
                          {student.campus === "junior" ? "Junior" : "Senior"}
                        </span>
                      </td>
                    )}
                    <td className="currency">{money(student.totalFees, student.currency)}</td>
                    <td className="currency paid-value">
                      {money(student.amountPaid, student.currency)}
                    </td>
                    <td
                      className={`currency balance-value ${student.balance > 0 ? "owing" : student.balance < 0 ? "credit" : ""}`}
                    >
                      {money(student.balance, student.currency)}
                    </td>
                    <td>
                      <span className={`fee-status ${meta.card}`}>
                        <StatusIcon size={15} />
                        {meta.label}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`fee-enrolment-status ${isActive ? "is-active" : "is-inactive"}`}
                      >
                        {isActive ? "Enrolled" : "Left school"}
                      </span>
                    </td>
                    {!readOnly && (
                      <td className="actions-column">
                        <div className="fee-row-actions">
                          <button
                            type="button"
                            className="fee-collect-button"
                            onClick={() => onEdit(student)}
                          >
                            <LuCreditCard size={15} /> Collect payment
                          </button>
                          <button
                            type="button"
                            className="fee-profile-button"
                            onClick={() => onHistory(student)}
                          >
                            Open account
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={(readOnly ? 10 : 11) - (campusScope ? 1 : 0)} className="fee-empty-state">
                  No students match the current search and filters.
                </td>
              </tr>
            )}
          </tbody>
        </MobileRecordTable>
      </div>
      <div className="fee-pagination">
        <span>
          Showing{" "}
          <strong>
            {filtered.length ? (page - 1) * pageSize + 1 : 0}–
            {Math.min(page * pageSize, filtered.length)}
          </strong>{" "}
          of <strong>{filtered.length}</strong> students
        </span>
        <div>
          <label>
            Rows per page:
            <select
              value={pageSize}
              onChange={(event) => {
                setPageSize(Number(event.target.value));
                setPage(1);
              }}
            >
              <option value="10">10</option>
              <option value="25">25</option>
              <option value="50">50</option>
            </select>
          </label>
          <button
            type="button"
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            disabled={page === 1}
            aria-label="Previous page"
          >
            <LuChevronLeft size={18} />
          </button>
          <span>
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            onClick={() =>
              setPage((current) => Math.min(totalPages, current + 1))
            }
            disabled={page === totalPages}
            aria-label="Next page"
          >
            <LuChevronRight size={18} />
          </button>
        </div>
      </div>
    </section>
  );
}

export default function FeesDashboard({
  students = [],
  loading,
  supabase,
  user,
  profile,
  onOpenStudent,
  onOpenPaymentHistory,
  onStudentAdded,
}) {
  const [feeRecords, setFeeRecords] = useState([]);
  const [feeMapping, setFeeMapping] = useState([]);
  const [term, setTerm] = useState(CURRENT_TERM);
  const [year, setYear] = useState(CURRENT_YEAR);
  const [currency, setCurrency] = useState("USD");
  const paymentStorageKey = feePaymentStorageKey(user?.id);
  const [pendingPayment, setPendingPayment] = useState(() => {
    try { return loadFeePayment(sessionStorage, paymentStorageKey); }
    catch { return { invalid: true }; }
  });
  const paymentBusy = useRef(false);

  const [error, setError] = useState("");
  const [feeLoading, setFeeLoading] = useState(true);
  const [editTarget, setEditTarget] = useState(null);
  const [saving, setSaving] = useState(false);
  const [showEnrolmentModal, setShowEnrolmentModal] = useState(false);
  const [toast, setToast] = useState("");
  const [quickStatus, setQuickStatus] = useState("");
  const role = profile?.active_role ?? profile?.role;
  const readOnly = role === "principal";
  const isMainAdmin = role === "admin" && profile?.campus === "all";
  const campusScope = !isMainAdmin && ["junior", "senior"].includes(profile?.campus) ? profile.campus : null;
  const scopeLabel = profile?.campus === "junior" ? "Junior School" : "Senior School";
  const { levels: registryLevels, streamsForLevel } = useSchoolClasses(supabase);
  const classLevels = registryLevels.length ? registryLevels : CLASS_LEVELS;

  const loadFees = useCallback(async () => {
    if (!supabase) return;
    setFeeLoading(true);
    const [balancesResult, mappingResult] = await Promise.all([
      readAllRows(() => supabase
        .from("fee_balances")
        .select("*")
        .eq("term", term)
        .eq("academic_year", year)).then(data => ({ data }), error => ({ error })),
      supabase.from("fee_structure_mapping").select("*"),
    ]);
    if (balancesResult.error) setError(balancesResult.error.message);
    else setFeeRecords(balancesResult.data ?? []);

    if (mappingResult.error) setError(mappingResult.error.message);
    else setFeeMapping(mappingResult.data ?? []);

    setFeeLoading(false);
  }, [supabase, term, year]);
  useEffect(() => {
    loadFees();
  }, [loadFees]);
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(""), 3500);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const getDynamicFee = (classLevel, feeCurrency = currency) => {
    const level = String(classLevel || "")
      .toLowerCase()
      .trim();
    if (level.includes("ecd"))
      return feeMapping.find((m) => m.band_name === "ECD A & B" && m.currency === feeCurrency)?.amount || 0;
    if (level.includes("grade"))
      return feeMapping.find((m) => m.band_name === "Grade 1-7" && m.currency === feeCurrency)?.amount || 0;
    if (level === "form 1" || level === "form 2")
      return feeMapping.find((m) => m.band_name === "Form 1-2" && m.currency === feeCurrency)?.amount || 0;
    if (level === "form 3" || level === "form 4")
      return feeMapping.find((m) => m.band_name === "Form 3-4" && m.currency === feeCurrency)?.amount || 0;
    if (
      level.includes("form 5") ||
      level.includes("form 6") ||
      level.includes("six")
    )
      return (
        feeMapping.find((m) => m.band_name === "Lower & Upper Six" && m.currency === feeCurrency)?.amount || 0
      );
    return 0;
  };

  const enriched = useMemo(
    () =>
      students.filter(student => !campusScope || student.campus === campusScope).map((student) => {
        const fee = feeRecords.find(
          (record) => record.student_id === student.id && record.currency === currency,
        );
        const totalFees = fee
          ? Number(fee.total_fees)
          : getDynamicFee(student.class_level, currency);
        const amountPaid = fee ? Number(fee.amount_paid) : 0;
        const balance = totalFees - amountPaid;
        return {
          ...student,
          currency,
          totalFees,
          amountPaid,
          balance,
          category:
            balance < 0
              ? "credit"
              : balance === 0
                ? "full"
                : amountPaid > 0
                  ? "half"
                  : "unpaid",
        };
      }),
    [students, feeRecords, feeMapping, campusScope, currency],
  );
  const stats = useMemo(
    () => ({
      full: enriched.filter((student) => student.category === "full"),
      credit: enriched.filter((student) => student.category === "credit"),
      half: enriched.filter((student) => student.category === "half"),
      unpaid: enriched.filter((student) => student.category === "unpaid"),
    }),
    [enriched],
  );
  const outstanding = useMemo(
    () =>
      enriched.reduce((sum, student) => sum + Math.max(0, student.balance), 0),
    [enriched],
  );
  const credits = useMemo(
    () =>
      enriched.reduce(
        (sum, student) => sum + Math.abs(Math.min(0, student.balance)),
        0,
      ),
    [enriched],
  );
  const isLoading = loading || feeLoading;

  const [showStructureModal, setShowStructureModal] = useState(false);
  const [showReportTermSettings, setShowReportTermSettings] = useState(false);
  const [savingStructure, setSavingStructure] = useState(false);

  const submitPayment = async (submission) => {
    if (paymentBusy.current || submission?.invalid) return;
    paymentBusy.current = true;
    setSaving(true);
    setError("");
    let timeout;
    try {
    const { error: saveError } = await Promise.race([
      supabase.rpc("record_learner_fee_payment", submission.payload),
      new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error('Confirmation timed out')), 15000); }),
    ]);
    if (saveError) throw saveError;
    sessionStorage.removeItem(paymentStorageKey);
    setPendingPayment(null);
    setEditTarget(null);
    setToast(`Payment confirmed for ${submission.name}`);
    logActivity(supabase, user, profile, {
      actionType: "update", description: `Confirmed fee payment for ${submission.name}`,
      targetTable: "fee_balances", targetId: submission.payload.p_student_id,
    });
    await loadFees();
    } catch (failure) {
      // An explicit database validation exception rolls back the whole RPC.
      // Network errors and changed-request conflicts remain unresolved.
      if (failure.code === 'P0001') {
        sessionStorage.removeItem(paymentStorageKey);
        setPendingPayment(null);
        setError(failure.message);
      } else {
        setEditTarget(null);
        setError('Payment confirmation is unresolved. Use Retry saved payment below before collecting another payment. The same submission will not be charged twice.');
      }
    } finally {
      clearTimeout(timeout);
      paymentBusy.current = false;
      setSaving(false);
    }
  };
  const savePayment = async (student, form) => {
    if (paymentBusy.current || pendingPayment) return;
    const submission = { name: student.full_name, payload: {
      p_student_id: student.id, p_term: term, p_academic_year: year,
      p_amount: Number(form.amount), p_paid_on: form.paid_on,
      p_payment_method: form.payment_method, p_reference_number: form.reference_number || null,
      p_currency: student.currency,
      p_total_fees: Number(student.totalFees),
      p_request_id: crypto.randomUUID(),
    } };
    try { saveFeePayment(sessionStorage, paymentStorageKey, submission); }
    catch {
      setError('This browser cannot save payment recovery details. Enable session storage before collecting payment.');
      return;
    }
    setPendingPayment(submission);
    await submitPayment(submission);
  };

  const openStructure = () => {
    const current = feeMapping.filter((band) => band.currency === currency);
    const usd = feeMapping.filter((band) => band.currency === "USD");
    const rows = current.length ? current : usd.map((band) => ({ ...band, amount: "" }));
    setStructureBands(rows.map((band) => ({ ...band, amount: band.amount === "" ? "" : Number(band.amount) })));
    setShowStructureModal(true);
  };
  const [structureBands, setStructureBands] = useState(null);
  const saveStructure = async (bands) => {
    setSavingStructure(true);
    setError("");
    const { error: saveError } = await supabase
      .from("fee_structure_mapping")
      .upsert(
        bands.map((b) => ({
          band_id: b.band_id,
          currency,
          amount: Number(b.amount),
          band_name: b.band_name,
          updated_at: new Date().toISOString(),
        })),
        { onConflict: "band_id,currency" },
      );
    setSavingStructure(false);
    if (saveError) {
      setError(saveError.message);
      return;
    }
    logActivity(supabase, user, profile, {
      actionType: "update",
      description: "Updated fee structure",
      targetTable: "fee_structure_mapping",
    });
    setShowStructureModal(false);
    setStructureBands(null);
    setToast("Fee structure updated");
    loadFees();
  };
  const exportReport = async (rows, format = 'csv') => {
    const headings = [
      "Student Name",
      "Admission ID",
      "Class",
      "Campus",
      `Total Term Fee ${currency}`,
      `Amount Paid ${currency}`,
      `Balance Owed ${currency}`,
      "Status",
    ];
    const reportRows = [
      ['School', 'Reliance Learning Centre'],
      ['Campus', campusScope || 'all-school'],
      ['Period', `${term} ${year}`],
      ['Currency', currency],
      ['Scope', 'Current filtered or selected learner rows'],
      ['Learners', rows.length],
      ['Generated at', new Date().toISOString()],
      [],
      headings,
      ...rows.map((student) => [
        student.full_name,
        student.admission_number,
        student.class_level,
        student.campus === "junior" ? "Junior" : "Senior",
        student.totalFees,
        student.amountPaid,
        student.balance,
        statusMeta[student.category].label,
      ]),
    ];
    const filename = `fees-report-${campusScope || "all-school"}-${term.toLowerCase().replace(" ", "-")}-${year}`;
    if (format === 'xlsx') {
      try {
        await downloadWorkbook([{name:'Fee balances', rows:reportRows.slice(8)}], Object.fromEntries(reportRows.slice(0,7)), `${filename}.xlsx`);
      } catch (cause) { setError(`Export failed: ${cause.message}`) }
    } else downloadCsv(reportRows, `${filename}.csv`);
  };

  const metricCards = [
    {
      label: "Full payments",
      value: stats.full.length,
      note: `${stats.full.length} student${stats.full.length === 1 ? "" : "s"} settled · ${money(credits, currency)} in credits`,
      icon: LuCircleCheck,
      tone: "success",
    },
    {
      label: "Partial payments",
      value: stats.half.length,
      note: `${stats.half.length} student${stats.half.length === 1 ? "" : "s"} remaining`,
      icon: LuCircleAlert,
      tone: "warning",
    },
    {
      label: "Unpaid",
      value: stats.unpaid.length,
      note: `${stats.unpaid.length} student${stats.unpaid.length === 1 ? "" : "s"} need attention`,
      icon: LuCircleX,
      tone: "danger",
    },
    {
      label: "Total outstanding balance",
      value: money(outstanding, currency),
      note: `${stats.half.length + stats.unpaid.length} students with a balance`,
      icon: LuWallet,
      tone: "slate",
    },
  ];

  return (
    <div className="fees-dashboard">
      {pendingPayment && <section role="status" className="card">
        <h2>Saved payment awaiting confirmation</h2>
        {pendingPayment.invalid ? <p>Saved recovery details could not be read. Ask Main Admin to reconcile the payment before collecting again.</p> : <>
          <p>{pendingPayment.name} · {money(pendingPayment.payload.p_amount, pendingPayment.payload.p_currency)} · {pendingPayment.payload.p_term} {pendingPayment.payload.p_academic_year}</p>
          <button type="button" className="fee-button fee-button-primary" disabled={saving} onClick={() => submitPayment(pendingPayment)}>{saving ? 'Confirming…' : 'Retry saved payment'}</button>
        </>}
      </section>}
      <header className="fees-page-header">
        <div>
          <p className="fees-kicker">
            {campusScope ? `${scopeLabel} finance` : "Main Admin · all-school finance"} · {term} {year}
          </p>
          <h1>Fees tracking</h1>
          <p>
            Monitor collection progress and resolve outstanding balances with
            confidence.
          </p>
        </div>
        <div className="fees-period-controls">
          <label>
            Term
            <select
              value={term}
              onChange={(event) => setTerm(event.target.value)}
            >
              {TERMS.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
          <label>
            Year
            <select
              value={year}
              onChange={(event) => setYear(Number(event.target.value))}
            >
              {[2025, 2026, 2027].map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
          <label>
            Currency
            <select aria-label="Fee currency" value={currency} onChange={(event) => setCurrency(event.target.value)}>
              {FINANCE_CURRENCIES.map((code) => <option key={code} value={code}>{code}</option>)}
            </select>
          </label>
          {isMainAdmin && (
            <>
              <button
                className="fee-button fee-button-secondary"
                onClick={openStructure}
              >
                Edit {currency} fee structure
              </button>
              <button
                className="fee-button fee-button-secondary"
                onClick={() => setShowReportTermSettings(true)}
              >
                Report term settings
              </button>
            </>
          )}
          {!readOnly && (
            <button
              className="fee-button fee-button-primary"
              onClick={() => setShowEnrolmentModal(true)}
            >
              Add learner
            </button>
          )}
        </div>
      </header>
      {error && <PortalNotice tone="error">{error}</PortalNotice>}
      <OperationsExports supabase={supabase} profile={profile} kinds={['fees','payments']} />
      <section className="fees-stat-row" aria-label="Payment summary">
        {metricCards.map((card) => {
          const Icon = card.icon;
          const actionable =
            card.label === "Partial payments" || card.label === "Unpaid";
          const filter = card.label === "Partial payments" ? "half" : "unpaid";
          return (
            <article
              className={`fees-stat-card ${card.tone} ${card.tone === "slate" ? "primary-kpi" : ""}`}
              key={card.label}
            >
              <span className="fees-stat-icon">
                <Icon size={22} />
              </span>
              <div>
                <p>{card.label}</p>
                <strong>{isLoading ? "—" : card.value}</strong>
                <span>{isLoading ? "Loading summary…" : card.note}</span>
                {actionable && !isLoading && Number(card.value) > 0 && (
                  <button
                    type="button"
                    className="fees-kpi-link"
                    onClick={() => setQuickStatus(filter)}
                  >
                    View {card.value}{" "}
                    {card.label === "Unpaid" ? "unpaid" : "partial"} students
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </section>
      {isLoading ? (
        <div className="fees-loading">
          <div />
          <div />
          <div />
        </div>
      ) : (
        <MasterTable
          students={enriched}
          onEdit={student => { if (!pendingPayment && !saving) setEditTarget(student); else setError('Confirm the saved payment before collecting another payment.'); }}
          onHistory={onOpenPaymentHistory || onOpenStudent}
          onOpenStudent={onOpenStudent}
          onExport={exportReport}
          readOnly={readOnly}
          quickStatus={quickStatus}
          campusScope={campusScope}
          scopeLabel={scopeLabel}
          currency={currency}
        />
      )}
      {editTarget && (
        <PaymentModal
          student={editTarget}
          onClose={() => setEditTarget(null)}
          onSave={savePayment}
          saving={saving}
          error={error}
        />
      )}
      {showEnrolmentModal && (
        <EnrolmentModal
          supabase={supabase}
          onClose={() => setShowEnrolmentModal(false)}
          onSaved={() => {
            onStudentAdded?.();
            setToast("Learner enrolled — admission number and current-term fee account are ready");
          }}
          classLevels={classLevels}
          streamsForLevel={streamsForLevel}
        />
      )}
      {showStructureModal && structureBands && (
        <FeeStructureModal
          mapping={structureBands}
          currency={currency}
          onClose={() => { setShowStructureModal(false); setStructureBands(null); }}
          onSave={saveStructure}
          saving={savingStructure}
        />
      )}
      {showReportTermSettings && (
        <ReportTermSettings
          supabase={supabase}
          onClose={() => setShowReportTermSettings(false)}
          onSaved={() => setToast("Report term settings saved")}
        />
      )}
      {toast && (
        <div className="fee-toast" role="status">
          <LuCircleCheck size={18} />
          {toast}
        </div>
      )}
    </div>
  );
}
