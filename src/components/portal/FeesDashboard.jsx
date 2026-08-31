import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import PortalNotice from './PortalNotice'

/* ─── Constants ──────────────────────────────────────────────────── */
const CURRENT_YEAR  = 2026
const CURRENT_TERM  = 'Term 3'
const TERMS         = ['Term 1', 'Term 2', 'Term 3']
const JUNIOR_GRADES = ['ECD A', 'ECD B', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6', 'Grade 7', 'Form 1', 'Form 2']
const SENIOR_FORMS  = ['Form 3', 'Form 4', 'Form 5', 'Form 6']
const JUNIOR_FEE    = 170
const SENIOR_FEE    = 200

const money     = v   => `$${Number(v ?? 0).toFixed(2)}`
const isJunior  = lvl => JUNIOR_GRADES.includes(lvl)
const defaultFee = lvl => isJunior(lvl) ? JUNIOR_FEE : SENIOR_FEE
const initials  = name => (name ?? '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
const fmtDate   = iso  => iso ? new Date(iso).toLocaleDateString('en-ZW', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
const daysAgo   = iso  => {
  if (!iso) {
    const today = new Date()
    const termStart = new Date('2026-08-01')
    return Math.max(0, Math.floor((today - termStart) / 86400000))
  }
  return Math.max(0, Math.floor((Date.now() - new Date(iso)) / 86400000))
}
const overdueClass = d => d <= 14 ? 'low' : d <= 30 ? 'mid' : 'high'

/* ─── Mini SVG icons ─────────────────────────────────────────────── */
const Ico = ({ d, size = 16, fill = 'none', stroke = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill}
    stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {(Array.isArray(d) ? d : [d]).map((p, i) =>
      typeof p === 'string' && (p.startsWith('M') || p.startsWith('m') || p.startsWith('L') || p.startsWith('C') || p.startsWith('A'))
        ? <path key={i} d={p} />
        : typeof p === 'string'
          ? <polyline key={i} points={p} />
          : <circle key={i} cx={p.cx} cy={p.cy} r={p.r} />
    )}
  </svg>
)
const SearchIcon  = () => <Ico d={['M21 21l-4.35-4.35', 'M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0']} />
const EditIcon    = () => <Ico d={['M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7', 'M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z']} />
const PlusIcon    = () => <Ico d={['M12 5v14', 'M5 12h14']} />
const CloseIcon   = () => <Ico d={['M18 6L6 18', 'M6 6l12 12']} />
const CheckIcon   = () => <Ico d="M20 6L9 17l-5-5" />
const AlertIcon   = () => <Ico d={['M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z', 'M12 9v4', 'M12 17h.01']} />
const CampusIcon  = () => <Ico d={['M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z', 'M9 22V12h6v10']} />
const ClockIcon   = () => <Ico d={[{cx:12,cy:12,r:10}, 'M12 6v6l4 2']} />
const PhoneIcon   = () => <Ico size={12} d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.62 3.38 2 2 0 0 1 3.6 1.21h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.91a16 16 0 0 0 6.18 6.18l.95-.95a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />

/* ─── Category colour map ────────────────────────────────────────── */
const CAT = {
  full:   { label: 'Full Payment',  bg: '#f0fdf4', border: '#22c55e', text: '#15803d', badge: '#dcfce7', badgeText: '#166534', icon: <CheckIcon /> },
  half:   { label: 'Half Payment',  bg: '#fffbeb', border: '#f59e0b', text: '#b45309', badge: '#fef3c7', badgeText: '#92400e', icon: <AlertIcon /> },
  unpaid: { label: 'Non-Paid',      bg: '#fff1f2', border: '#f43f5e', text: '#be123c', badge: '#fecdd3', badgeText: '#9f1239', icon: <AlertIcon /> },
}

/* ── Simple toast ── */
function Toast({ message, type = 'success', onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 4000)
    return () => clearTimeout(t)
  }, [onClose])
  return (
    <div className={`fee-toast ${type}`} role="status" aria-live="polite">
      <span className="fee-toast-icon">{type === 'success' ? '✅' : '❌'}</span>
      <span>{message}</span>
      <button className="fee-toast-close" onClick={onClose} aria-label="Dismiss"><CloseIcon /></button>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════
   PAYMENT EDIT MODAL
══════════════════════════════════════════════════════════════════ */
function PaymentModal({ student, onClose, onSave, saving }) {
  const defFee = defaultFee(student.class_level)
  const [form, setForm] = useState({
    total_fees:  String(student.totalFees ?? defFee),
    amount_paid: String(student.amountPaid ?? 0),
    note:        '',
  })
  const set = field => e => setForm(f => ({ ...f, [field]: e.target.value }))
  const paid  = Number(form.amount_paid)
  const total = Number(form.total_fees)
  const bal   = total - paid
  const pct   = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0

  return (
    <div className="fee-modal-overlay" role="dialog" aria-modal="true"
      aria-label={`Update payment for ${student.full_name}`}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="fee-modal">
        {/* Header */}
        <div className="fee-modal-head">
          <div className="fee-modal-student">
            <div className="fee-modal-avatar">{initials(student.full_name)}</div>
            <div>
              <div className="fee-modal-name">{student.full_name}</div>
              <div className="fee-modal-meta">
                {student.admission_number} · {student.class_level}
                {student.class_stream ? ` ${student.class_stream}` : ''}
                <span className="fee-modal-campus-tag">
                  {isJunior(student.class_level) ? '🏫 Junior' : '🏛 Senior'}
                </span>
              </div>
            </div>
          </div>
          <button className="fee-modal-close" onClick={onClose} aria-label="Close dialog">
            <CloseIcon />
          </button>
        </div>

        {/* Progress bar */}
        <div className="fee-modal-progress-wrap">
          <div className="fee-modal-progress-bar">
            <div className="fee-modal-progress-fill" style={{
              width: `${pct}%`,
              background: pct >= 100 ? '#22c55e' : pct > 0 ? '#f59e0b' : '#f43f5e'
            }} />
          </div>
          <div className="fee-modal-progress-labels">
            <span>{pct}% paid</span>
            <span style={{ color: bal > 0 ? '#be123c' : '#15803d' }}>
              {bal > 0 ? `${money(bal)} outstanding` : 'Fully paid ✓'}
            </span>
          </div>
        </div>

        {/* Form */}
        <form className="fee-modal-form" onSubmit={e => { e.preventDefault(); onSave(student, form) }}>
          <div className="fee-modal-row">
            <label className="fee-modal-label">
              Total Fees
              <div className="fee-modal-input-wrap">
                <span className="fee-input-prefix">$</span>
                <input className="fee-modal-input" type="number" min="0" step="0.01"
                  value={form.total_fees} onChange={set('total_fees')} required />
              </div>
            </label>
            <label className="fee-modal-label">
              Amount Paid
              <div className="fee-modal-input-wrap">
                <span className="fee-input-prefix">$</span>
                <input className="fee-modal-input" type="number" min="0" step="0.01"
                  value={form.amount_paid} onChange={set('amount_paid')} required />
              </div>
            </label>
          </div>

          <label className="fee-modal-label" style={{ gridColumn: '1/-1' }}>
            Note (optional)
            <input className="fee-modal-input" type="text" style={{ paddingLeft: '12px' }}
              value={form.note} onChange={set('note')}
              placeholder={`e.g. Cash received ${new Date().toLocaleDateString('en-ZW')}`} />
          </label>

          <div className="fee-modal-summary">
            <div className="fee-summary-chip">Total <strong>{money(total)}</strong></div>
            <div className="fee-summary-chip">Paid <strong style={{ color: '#15803d' }}>{money(paid)}</strong></div>
            <div className="fee-summary-chip">Balance <strong style={{ color: bal > 0 ? '#be123c' : '#15803d' }}>{money(bal)}</strong></div>
          </div>

          <div className="fee-modal-actions">
            <button type="button" className="fee-btn-cancel" onClick={onClose} disabled={saving}>Cancel</button>
            <button type="submit" className="fee-btn-save" disabled={saving}>
              {saving ? 'Saving…' : 'Save Payment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════
   FIND-STUDENT MODAL  (for "+ Add" flow)
══════════════════════════════════════════════════════════════════ */
function FindStudentModal({ students, onSelect, onClose }) {
  const [q, setQ] = useState('')
  const results = useMemo(() =>
    q.length >= 1
      ? students.filter(s =>
          `${s.full_name} ${s.admission_number}`.toLowerCase().includes(q.toLowerCase())
        ).slice(0, 20)
      : [],
  [students, q])

  return (
    <div className="fee-modal-overlay" role="dialog" aria-modal="true" aria-label="Find student"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="fee-find-modal">
        <div className="fee-find-head">
          <h2 className="fee-find-title">Find Student</h2>
          <button className="fee-modal-close" style={{ background: '#f0f3fa', color: '#5b6b8d' }}
            onClick={onClose} aria-label="Close"><CloseIcon /></button>
        </div>
        <div className="fee-find-search">
          <div className="fee-search-wrap">
            <span className="fee-search-icon"><SearchIcon /></span>
            <input
              className="fee-search-input"
              autoFocus
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Search by name or admission number…"
            />
            {q && <button className="fee-search-clear" onClick={() => setQ('')}><CloseIcon /></button>}
          </div>
        </div>
        <div className="fee-find-results">
          {q.length < 1 && (
            <div className="fee-find-empty">Type a name or admission number to search</div>
          )}
          {q.length >= 1 && results.length === 0 && (
            <div className="fee-find-empty">No students found for "{q}"</div>
          )}
          {results.map(s => (
            <div key={s.id} className="fee-find-row" onClick={() => onSelect(s)}>
              <div className="fee-find-info">
                <span className="fee-find-name">{s.full_name}</span>
                <span className="fee-find-meta">
                  {s.admission_number} · {s.class_level}{s.class_stream ? ` ${s.class_stream}` : ''} ·
                  {isJunior(s.class_level) ? ' Junior' : ' Senior'}
                </span>
              </div>
              <button className="fee-find-select-btn">Select →</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════
   CATEGORY SECTION  (Full / Half / Unpaid)
══════════════════════════════════════════════════════════════════ */
function CategorySection({ cat, students, onEdit, onAdd, storageKey }) {
  const { label, bg, border, text, badge, badgeText, icon } = CAT[cat]

  // Persist expand state in localStorage
  const [expanded, setExpanded] = useState(() => {
    try { return JSON.parse(localStorage.getItem(`fee_expanded_${storageKey}_${cat}`) ?? 'true') }
    catch { return true }
  })
  const [q, setQ] = useState('')

  const toggle = () => setExpanded(prev => {
    const next = !prev
    try { localStorage.setItem(`fee_expanded_${storageKey}_${cat}`, JSON.stringify(next)) } catch {}
    return next
  })

  const visible = useMemo(() =>
    students.filter(s =>
      `${s.full_name} ${s.admission_number}`.toLowerCase().includes(q.toLowerCase())
    ),
  [students, q])

  const subLine = {
    full:   `Term fee: $${JUNIOR_FEE} (Junior) / $${SENIOR_FEE} (Senior) — fully settled`,
    half:   `Amount paid: partial · Balance outstanding · $${JUNIOR_FEE} (Junior) / $${SENIOR_FEE} (Senior) total`,
    unpaid: `Outstanding: $${JUNIOR_FEE} (Junior) / $${SENIOR_FEE} (Senior) per term`,
  }[cat]

  return (
    <div className="fee-section" style={{ '--cat-border': border, '--cat-bg': bg, '--cat-text': text }}>
      {/* Accordion header */}
      <button className="fee-section-head" onClick={toggle}
        aria-expanded={expanded} aria-controls={`fee-body-${cat}`}>
        <div className="fee-section-head-left">
          <div className="fee-section-icon" style={{ color: text, background: badge }}>{icon}</div>
          <div>
            <h2 className="fee-section-title" style={{ color: text }}>
              {label}
              <span className="fee-section-count" style={{ background: badge, color: badgeText }}>
                {students.length} student{students.length !== 1 ? 's' : ''}
              </span>
            </h2>
            <p className="fee-section-sub">{subLine}</p>
          </div>
        </div>
        <svg className={`fee-section-chevron${expanded ? ' open' : ''}`}
          width="20" height="20" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {expanded && (
        <div className="fee-section-body" id={`fee-body-${cat}`}>
          {/* Toolbar */}
          <div className="fee-section-toolbar">
            <div className="fee-search-wrap">
              <span className="fee-search-icon"><SearchIcon /></span>
              <input
                className="fee-search-input"
                value={q}
                onChange={e => setQ(e.target.value)}
                placeholder="Search by name or admission number…"
                aria-label={`Search ${label} students`}
              />
              {q && <button className="fee-search-clear" onClick={() => setQ('')} aria-label="Clear search"><CloseIcon /></button>}
            </div>
            <button className="fee-add-btn" onClick={onAdd}>
              <PlusIcon />
              {cat === 'full' ? 'Add Record' : 'Record Payment'}
            </button>
          </div>

          {/* Table */}
          <div className="fee-table-wrap">
            {students.length === 0 ? (
              <div className="fee-empty">
                <div className="fee-empty-icon">
                  {cat === 'full' ? '🎉' : cat === 'half' ? '⏳' : '📋'}
                </div>
                <p>
                  {cat === 'full'
                    ? 'No students have paid in full yet.'
                    : `No students in ${label.toLowerCase()} category.`}
                </p>
              </div>
            ) : visible.length === 0 ? (
              <div className="fee-empty">
                <p>No students match "<strong>{q}</strong>"</p>
              </div>
            ) : (
              <table className="fee-table" aria-label={`${label} students table`}>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Admission No.</th>
                    <th>Class</th>
                    <th>Stream</th>
                    {cat === 'full' && <th>Amount Paid</th>}
                    {cat === 'full' && <th>Payment Date</th>}
                    {cat === 'half' && <th>Amount Paid</th>}
                    {cat === 'half' && <th className="fee-th-due">Balance Due</th>}
                    {cat === 'half' && <th>Parent</th>}
                    {cat === 'unpaid' && <th className="fee-th-due">Amount Due</th>}
                    {cat === 'unpaid' && <th>Parent Contact</th>}
                    {cat === 'unpaid' && <th className="fee-th-due">Days Overdue</th>}
                    <th>Campus</th>
                    <th style={{ width: 90 }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map(row => (
                    <tr key={row.id} className="fee-tr">
                      {/* Name */}
                      <td>
                        <div className="fee-td-name">
                          <span className="fee-avatar"
                            style={{ background: `color-mix(in srgb, ${border} 18%, white)`, color: text }}>
                            {initials(row.full_name)}
                          </span>
                          <span className="fee-name-text">{row.full_name}</span>
                        </div>
                      </td>
                      {/* Admission No */}
                      <td className="fee-mono">{row.admission_number}</td>
                      {/* Class level */}
                      <td>{row.class_level}</td>
                      {/* Stream */}
                      <td>{row.class_stream || '—'}</td>

                      {/* FULL columns */}
                      {cat === 'full' && <td className="fee-amount-paid">{money(row.amountPaid)}</td>}
                      {cat === 'full' && <td className="fee-date-cell">{fmtDate(row.fee?.updated_at)}</td>}

                      {/* HALF columns */}
                      {cat === 'half' && <td className="fee-amount-paid">{money(row.amountPaid)}</td>}
                      {cat === 'half' && (
                        <td>
                          <span className="fee-balance-pill">{money(row.balance)}</span>
                        </td>
                      )}
                      {cat === 'half' && (
                        <td>
                          <div className="fee-parent-cell">
                            <span className="fee-parent-name">{row.parent_name || '—'}</span>
                          </div>
                        </td>
                      )}

                      {/* UNPAID columns */}
                      {cat === 'unpaid' && (
                        <td>
                          <span className="fee-balance-pill fee-due-full">{money(row.totalFees)}</span>
                        </td>
                      )}
                      {cat === 'unpaid' && (
                        <td>
                          <div className="fee-parent-cell">
                            <span className="fee-parent-name">{row.parent_name || '—'}</span>
                            {row.parent_phone && (
                              <span className="fee-parent-phone">
                                <PhoneIcon /> {row.parent_phone}
                              </span>
                            )}
                          </div>
                        </td>
                      )}
                      {cat === 'unpaid' && (
                        <td>
                          <span className={`fee-overdue-chip ${overdueClass(row.daysOverdue)}`}>
                            <ClockIcon />
                            {row.daysOverdue}d
                          </span>
                        </td>
                      )}

                      {/* Campus chip */}
                      <td>
                        <span className="fee-campus-chip">
                          {isJunior(row.class_level) ? '🏫 Junior' : '🏛 Senior'}
                        </span>
                      </td>

                      {/* Action */}
                      <td>
                        <button className="fee-edit-btn" onClick={() => onEdit(row)}
                          title={cat === 'full' ? 'Edit payment' : 'Record payment'}>
                          <EditIcon />
                          {cat === 'full' ? 'Edit' : 'Update'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {visible.length > 0 && (
            <div className="fee-table-footer">
              Showing {visible.length} of {students.length} student{students.length !== 1 ? 's' : ''}
              {q ? ` matching "${q}"` : ''}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════
   FEES DASHBOARD  (main export)
══════════════════════════════════════════════════════════════════ */
export default function FeesDashboard({ students, loading, supabase, user, profile }) {
  const [feeRecords,  setFeeRecords]  = useState([])
  const [term,        setTerm]        = useState(CURRENT_TERM)
  const [year,        setYear]        = useState(CURRENT_YEAR)
  const [campus,      setCampus]      = useState(() => {
    // Accountants scoped to their campus by default
    if (profile?.campus === 'junior') return 'junior'
    if (profile?.campus === 'senior') return 'senior'
    return 'all'
  })
  const [error,       setError]       = useState('')
  const [editTarget,  setEditTarget]  = useState(null)
  const [findOpen,    setFindOpen]    = useState(false)
  const [saving,      setSaving]      = useState(false)
  const [feeLoading,  setFeeLoading]  = useState(true)
  const [toast,       setToast]       = useState(null)

  // Storage key for section expand state (per term/year)
  const storageKey = `${term}_${year}`

  const showToast = (msg, type = 'success') => setToast({ msg, type })

  /* ── Load fee records ── */
  const loadFees = useCallback(async () => {
    setFeeLoading(true)
    const { data, error: err } = await supabase
      .from('fee_balances')
      .select('*')
      .eq('term', term)
      .eq('academic_year', year)
    if (err) setError(err.message)
    else setFeeRecords(data ?? [])
    setFeeLoading(false)
  }, [supabase, term, year])

  useEffect(() => { loadFees() }, [loadFees])

  /* ── Enrich students with fee + parent data ── */
  const enriched = useMemo(() => {
    return students
      .filter(s => {
        if (campus === 'junior') return JUNIOR_GRADES.includes(s.class_level)
        if (campus === 'senior') return SENIOR_FORMS.includes(s.class_level)
        return true
      })
      .map(s => {
        const fee        = feeRecords.find(f => f.student_id === s.id)
        const totalFees  = fee ? Number(fee.total_fees)  : defaultFee(s.class_level)
        const amountPaid = fee ? Number(fee.amount_paid) : 0
        const balance    = totalFees - amountPaid
        const category   = amountPaid >= totalFees ? 'full'
          : amountPaid > 0 ? 'half'
          : 'unpaid'
        const daysOverdue = category === 'unpaid' ? daysAgo(fee?.updated_at) : 0
        return {
          ...s,
          fee,
          totalFees,
          amountPaid,
          balance,
          category,
          daysOverdue,
          // parent fields (sourced from student row if denormalized, else fallback)
          parent_name:  s.parent_name  || s.parent?.name  || null,
          parent_phone: s.parent_phone || s.parent?.phone || null,
        }
      })
  }, [students, feeRecords, campus])

  const full   = useMemo(() => enriched.filter(s => s.category === 'full'),   [enriched])
  const half   = useMemo(() => enriched.filter(s => s.category === 'half'),   [enriched])
  const unpaid = useMemo(() => enriched.filter(s => s.category === 'unpaid'), [enriched])

  /* ── Total collected / outstanding ── */
  const totalCollected    = useMemo(() => enriched.reduce((a, s) => a + s.amountPaid, 0), [enriched])
  const totalOutstanding  = useMemo(() => [...half, ...unpaid].reduce((a, s) => a + s.balance, 0), [half, unpaid])

  /* ── Handle edit ── */
  const handleEdit = student => {
    setError(''); setEditTarget(student)
  }

  /* ── Handle save ── */
  const handleSave = async (student, form) => {
    setSaving(true); setError('')
    const totalF  = Number(form.total_fees)
    const paidF   = Number(form.amount_paid)
    const next = {
      student_id:    student.id,
      term,
      academic_year: year,
      total_fees:    totalF,
      amount_paid:   paidF,
      updated_by:    user?.id,
      updated_at:    new Date().toISOString(),
      notes:         form.note || null,
    }
    const { error: err } = await supabase
      .from('fee_balances')
      .upsert(next, { onConflict: 'student_id,term,academic_year' })
    if (err) {
      setError(err.message)
      showToast(`Error: ${err.message}`, 'error')
    } else {
      const bal  = totalF - paidF
      const cat  = paidF >= totalF ? 'Full Payment' : paidF > 0 ? 'Half Payment' : 'Non-Paid'
      showToast(`✓ ${student.full_name} → ${cat}${form.note ? ` · ${form.note}` : ''}`)
      setEditTarget(null)
      loadFees()
    }
    setSaving(false)
  }

  /* ── Handle "Add" button (open find-student modal) ── */
  const handleAdd = () => { setError(''); setFindOpen(true) }
  const handleFindSelect = student => { setFindOpen(false); setEditTarget(student) }

  const isLoading = loading || feeLoading

  /* ── Campus restriction for accountant ── */
  const isAccountant   = profile?.role === 'accountant'
  const campusLocked   = isAccountant && profile?.campus && profile.campus !== 'all'
  const availCampuses  = campusLocked
    ? [profile.campus]
    : ['all', 'junior', 'senior']
  const campusLabels   = { all: 'All', junior: '🏫 Junior', senior: '🏛 Senior' }

  return (
    <div className="fees-dashboard">
      {/* ── Page header ── */}
      <div className="dash-page-header fees-header-row">
        <div>
          <h1 className="dash-page-title">Fees Tracking</h1>
          <p className="dash-page-sub">Payment status by category · {term} {year}</p>
        </div>

        {/* Controls */}
        <div className="fees-controls">
          <div className="fees-control-group">
            <label className="fees-control-label">Term</label>
            <select className="fees-select" value={term} onChange={e => setTerm(e.target.value)}>
              {TERMS.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div className="fees-control-group">
            <label className="fees-control-label">Year</label>
            <select className="fees-select" value={year} onChange={e => setYear(Number(e.target.value))}>
              {[2025, 2026, 2027].map(y => <option key={y}>{y}</option>)}
            </select>
          </div>
          {!campusLocked && (
            <div className="fees-control-group">
              <label className="fees-control-label"><CampusIcon /> Campus</label>
              <div className="fees-campus-tabs" role="group" aria-label="Campus filter">
                {availCampuses.map(c => (
                  <button
                    key={c}
                    className={`fees-campus-tab${campus === c ? ' active' : ''}`}
                    onClick={() => setCampus(c)}
                    aria-pressed={campus === c}
                  >
                    {campusLabels[c]}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Error banner ── */}
      {error && <PortalNotice tone="error">{error}</PortalNotice>}

      {/* ── Stat cards ── */}
      <div className="fees-stat-row">
        {[
          {
            cat: 'full', icon: '✅',
            count: full.length,
            sub: `${money(full.reduce((a, s) => a + s.amountPaid, 0))} collected`,
          },
          {
            cat: 'half', icon: '⚠️',
            count: half.length,
            sub: `${money(half.reduce((a, s) => a + s.amountPaid, 0))} collected`,
          },
          {
            cat: 'unpaid', icon: '🔴',
            count: unpaid.length,
            sub: `${money(unpaid.reduce((a, s) => a + s.totalFees, 0))} outstanding`,
          },
          {
            label: 'Total Outstanding', icon: '💰',
            count: money(totalOutstanding),
            sub: `${half.length + unpaid.length} students owe fees`,
            accent: '#7c3aed', bg: '#f5f3ff', border: '#7c3aed',
          },
        ].map((item, i) => {
          const c = item.cat ? CAT[item.cat] : null
          return (
            <div key={i} className="fees-stat-card" style={{
              '--sc-border': item.border ?? c.border,
              '--sc-bg':     item.bg     ?? c.bg,
              '--sc-text':   item.accent ?? c.text,
            }}>
              <div className="fees-stat-emoji">{item.icon}</div>
              <div className="fees-stat-body">
                <div className="fees-stat-value" style={{ color: item.accent ?? c.text }}>
                  {isLoading ? '—' : item.count}
                </div>
                <div className="fees-stat-label">{item.label ?? c.label}</div>
                <div className="fees-stat-sub">{isLoading ? '…' : item.sub}</div>
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Loading skeleton ── */}
      {isLoading && (
        <div className="fees-loading">
          <div className="fees-skeleton" />
          <div className="fees-skeleton" />
          <div className="fees-skeleton" />
        </div>
      )}

      {/* ── Category sections ── */}
      {!isLoading && (
        <div className="fees-sections">
          <CategorySection cat="full"   students={full}   onEdit={handleEdit} onAdd={handleAdd} storageKey={storageKey} />
          <CategorySection cat="half"   students={half}   onEdit={handleEdit} onAdd={handleAdd} storageKey={storageKey} />
          <CategorySection cat="unpaid" students={unpaid} onEdit={handleEdit} onAdd={handleAdd} storageKey={storageKey} />
        </div>
      )}

      {/* ── Find student modal ── */}
      {findOpen && (
        <FindStudentModal
          students={enriched}
          onSelect={handleFindSelect}
          onClose={() => setFindOpen(false)}
        />
      )}

      {/* ── Payment edit modal ── */}
      {editTarget && (
        <PaymentModal
          student={editTarget}
          onClose={() => setEditTarget(null)}
          onSave={handleSave}
          saving={saving}
        />
      )}

      {/* ── Toast notification ── */}
      {toast && (
        <Toast
          message={toast.msg}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  )
}
