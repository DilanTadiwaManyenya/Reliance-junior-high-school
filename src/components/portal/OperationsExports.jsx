import { useEffect, useRef, useState } from 'react'
import { downloadCsv, downloadWorkbook, readAllRows, reportOptions, reportSheets, reportTotals } from '../../lib/operationsExport'

export default function OperationsExports({ supabase, profile, kinds }) {
  const [kind, setKind] = useState(kinds[0])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const request = useRef(null)
  useEffect(() => () => request.current?.abort(), [])
  const role = profile?.active_role ?? profile?.role
  if (!['admin','accountant','principal'].includes(role)) return null
  const exportReport = async format => {
    if (busy) return
    const controller = new AbortController()
    request.current = controller
    const timeout = setTimeout(() => controller.abort(), 30000)
    setBusy(true); setError(''); setMessage('')
    try {
      const [,table,select] = reportOptions[kind]
      const campus = profile?.campus
      const records = await readAllRows(() => {
        let query = supabase.from(table).select(select)
        if (['junior','senior'].includes(campus)) query = query.eq(['fees','payments','orders'].includes(kind) ? 'students.campus' : 'campus', campus)
        return query
      }, { signal: controller.signal })
      controller.signal.throwIfAborted()
      const sheets = reportSheets(kind, records)
      const details = { School: 'Reliance Learning Centre', Report: reportOptions[kind][0], Currency: 'USD', Campus: campus || 'authorised campuses', Scope: 'All dates; all statuses; database-authorised records only', 'Source records': String(records.length), 'Generated at': new Date().toISOString(), ...reportTotals(kind, records), Note: 'Read-only paged extract. Not an issued invoice or receipt. Refresh after concurrent edits.' }
      const filename = `reliance-${kind}-${campus||'authorised'}-${new Date().toISOString().slice(0,10)}`
      if (format === 'xlsx') await downloadWorkbook(sheets, details, `${filename}.xlsx`, controller.signal)
      else downloadCsv([...Object.entries(details), [], ...sheets.flatMap(sheet => [[sheet.name], ...sheet.rows, []])], `${filename}.csv`)
      if (!controller.signal.aborted) setMessage(`Exported ${records.length} source records (${sheets.length} section${sheets.length>1?'s':''}).`)
    } catch (cause) {
      if (request.current === controller) setError(controller.signal.aborted ? 'Export timed out or was cancelled. Try again.' : cause.message)
    } finally {
      clearTimeout(timeout)
      if (request.current === controller) { setBusy(false); request.current = null }
    }
  }
  return <section className="shop-panel" aria-label="Finance and operations exports">
    <h2>Download records</h2>
    <p>All dates and statuses within your campus access, in USD. These downloads include saved records; they do not issue invoices or receipts.</p>
    <div className="shop-toolbar"><label>Report<select aria-label="Export report" value={kind} disabled={busy} onChange={e => { setKind(e.target.value); setError(''); setMessage('') }}>{kinds.map(value => <option key={value} value={value}>{reportOptions[value][0]}</option>)}</select></label>
      <button disabled={busy} onClick={() => exportReport('csv')}>{busy ? 'Preparing…' : 'Download CSV'}</button>
      <button disabled={busy} onClick={() => exportReport('xlsx')}>Download Excel</button>
    </div>
    {error && <p role="alert">{error}</p>}{message && <p role="status">{message}</p>}
  </section>
}
