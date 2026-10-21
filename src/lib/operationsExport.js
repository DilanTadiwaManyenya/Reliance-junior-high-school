import { downloadFile } from './learnerRegisterExport.js'
import { sumByCurrency } from './currency.js'

export function csvText(rows) {
  const cell = value => {
    let text = String(value ?? '')
    const first = [...text].find(char => char.charCodeAt(0) > 32 && !/\s/.test(char))
    if (typeof value !== 'number' && first && '=+@-'.includes(first)) text = "'" + text
    return `"${text.replaceAll('"', '""')}"`
  }
  return '\ufeff' + rows.map(row => row.map(cell).join(',')).join('\r\n')
}

export function downloadCsv(rows, filename) {
  downloadFile(new Blob([csvText(rows)], { type: 'text/csv;charset=utf-8' }), filename)
}

export function workbookSheets(sheets, details) {
  return [...sheets.map(({ name, rows }) => ({
    sheet: name,
    columns: rows[0].map(() => ({ width: 24 })),
    data: rows.map((row, index) => row.map(value => ({
      value: value ?? '', type: typeof value === 'number' ? Number : String,
      ...(index === 0 ? { fontWeight: 'bold', backgroundColor: '#172B59', textColor: '#FFFFFF' } : {}),
    }))),
  })), { sheet: 'Export details', data: Object.entries(details) }]
}

export async function downloadWorkbook(sheets, details, filename, signal) {
  const { default: writeExcelFile } = await import('write-excel-file/browser')
  const blob = await writeExcelFile(workbookSheets(sheets, details)).toBlob()
  signal?.throwIfAborted()
  downloadFile(blob, filename)
}

// Retain RLS and caller filters. Never offer a silently truncated export.
export async function readAllRows(query, { signal, limit = 50000 } = {}) {
  const rows = []
  for (let offset = 0; ; offset += 500) {
    signal?.throwIfAborted()
    let request = query().order('id').range(offset, offset + 499)
    if (signal) request = request.abortSignal(signal)
    const result = await request
    if (result.error) throw new Error(result.error.message)
    rows.push(...(result.data || []))
    if (rows.length > limit) throw new Error(`Export exceeds ${limit.toLocaleString()} records. Narrow the scope.`)
    if ((result.data || []).length < 500) return rows
  }
}

const n = value => value == null ? '' : Number(value)
export const reportOptions = {
  fees: ['Fee balances', 'fee_balances', '*,students!inner(admission_number,full_name,campus)',
    ['Balance ID','Admission ID','Learner','Campus','Year','Term','Currency','Term fee','Paid','Balance'],
    r => [r.id,r.students?.admission_number,r.students?.full_name,r.students?.campus,r.academic_year,r.term,r.currency||'USD',n(r.total_fees),n(r.amount_paid),Number(r.total_fees || 0)-Number(r.amount_paid || 0)]],
  payments: ['Fee payment ledger', 'fee_payments', '*,students!inner(admission_number,full_name,campus)',
    ['Payment ID','Admission ID','Learner','Campus','Year','Term','Paid on','Currency','Amount','Method','Plan','Reference','Notes','Status','Reversed at','Reversed by','Reversal reason'],
    r => [r.id,r.students?.admission_number,r.students?.full_name,r.students?.campus,r.academic_year,r.term,r.paid_on,r.currency||'USD',n(r.amount),r.payment_method,r.payment_plan,r.reference_number,r.notes,r.status||'recorded',r.reversed_at,r.reversed_by,r.reversal_reason]],
  expenses: ['Expense cashbook', 'school_expenses', '*',
    ['Expense ID','Date','Campus','Category','Supplier','Description','Currency','Amount','Method','Reference','Status','Entered by','Approved by','Approved at'],
    r => [r.id,r.expense_date,r.campus,r.category,r.supplier,r.description,r.currency||'USD',n(r.amount),r.payment_method,r.receipt_reference,r.status,r.entered_by,r.approved_by,r.approved_at]],
  stock: ['Stock and sizes', 'inventory_products', '*,product_variants(*)',
    ['Product ID','Product','Campus','Category','Product active','Variant ID','Size','SKU','Variant active','Stock','Currency','Unit price','Unit cost','Reorder level'],
    r => (r.product_variants?.length ? r.product_variants : [null]).map(v => [r.id,r.name,r.campus||'unassigned',r.category,String(r.active),v?.id,v?.size,v?.sku||r.sku,v ? String(v.active) : '',n(v ? v.quantity_on_hand : r.quantity_on_hand),r.currency||'USD',n(r.selling_price),n(r.cost_price),n(r.reorder_level)])],
  sales: ['POS receipts', 'pos_sales', '*,pos_sale_items(*),pos_payments(*)',
    ['Sale ID','Receipt','Date','Campus','Customer','Method','Currency','Total','Initial tendered','Status','Reversed at','Reversed by','Reason','Learner ID','Paid total','Balance due'],
    r => [r.id,r.receipt_number,r.created_at,r.campus||'legacy',r.customer_name,r.payment_method,r.currency||'USD',n(r.total),n(r.amount_paid??r.total),r.status||'completed',r.reversed_at,r.reversed_by,r.reversal_reason,r.student_id,n(r.payment_tracking?r.paid_total:r.total),n(r.status==='reversed'?0:r.balance_due||0)]],
  orders: ['Parent order history', 'parent_uniform_orders', '*,students!inner(admission_number,full_name,campus)',
    ['Order ID','Date','Admission ID','Learner','Campus','Status','Method','Reference','Currency','Total'],
    r => [r.id,r.created_at,r.students?.admission_number,r.students?.full_name,r.students?.campus,r.payment_status,r.payment_method,r.transaction_reference||r.ecocash_reference,r.currency||'USD',n(r.total)]],
}

export function reportSheets(kind, records) {
  const [name,,,headings, project] = reportOptions[kind]
  const rows = kind === 'stock' ? records.flatMap(project) : records.map(project)
  const sheets = [{ name, rows: [headings, ...rows] }]
  if (kind === 'sales' || kind === 'orders') sheets.push({ name: 'Saved order lines', rows: [
    ['Order or sale ID','Product ID','Product name at purchase','Size','Quantity','Currency','Unit price','Line total','Unit cost'],
    ...records.flatMap(r => (r.pos_sale_items || r.items || []).map(line => [r.id,line.product_id,line.product_name||line.name,line.size_label,n(line.quantity),r.currency||'USD',n(line.unit_price),n(line.line_total??Number(line.quantity)*Number(line.unit_price)),n(line.unit_cost)])),
  ] })
  if (kind === 'sales') sheets.push({ name: 'POS payment entries', rows: [
    ['Receipt','Sale ID','Payment ID','Date','Currency','Applied payment','Tendered','Change','Method','Reference','Collector ID'],
    ...records.flatMap(r=>(r.pos_payments||[]).map(p=>[r.receipt_number,r.id,p.id,p.created_at,p.currency,n(p.amount),n(p.tendered),n(p.change_due),p.payment_method,p.reference_number,p.received_by])),
  ] })
  return sheets
}

export function reportTotals(kind, records) {
  const byCurrency = (rows, field) => Object.fromEntries(Object.entries(sumByCurrency(rows, row => row[field])).map(([currency, total]) => [`${currency}`, total.toFixed(2)]))
  if (kind === 'fees') return Object.fromEntries(Object.entries(sumByCurrency(records, row => row.total_fees)).flatMap(([currency, total]) => [[`Term fees ${currency}`, total.toFixed(2)], [`Paid ${currency}`, (sumByCurrency(records.filter(row => (row.currency||'USD') === currency), row => row.amount_paid)[currency] || 0).toFixed(2)], [`Net balance ${currency}`, (total - (sumByCurrency(records.filter(row => (row.currency||'USD') === currency), row => row.amount_paid)[currency] || 0)).toFixed(2)]]))
  if (kind === 'payments') return Object.fromEntries(Object.entries(byCurrency(records.filter(row => row.status !== 'reversed'), 'amount')).map(([currency,total]) => [`Ledger payments ${currency}`, total]))
  if (kind === 'expenses') return Object.fromEntries(['pending','approved','rejected'].flatMap(status => Object.entries(byCurrency(records.filter(row => row.status === status), 'amount')).map(([currency,total]) => [`${status} ${currency}`, total])))
  if (kind === 'sales') return { ...Object.fromEntries(Object.entries(byCurrency(records.filter(row => row.status !== 'reversed'), 'total')).map(([currency,total]) => [`Sales ${currency}`, total])), 'Receipts': String(records.length), 'Reversed receipts excluded': String(records.filter(row => row.status === 'reversed').length) }
  if (kind === 'orders') return Object.fromEntries(['pending','verified','rejected'].flatMap(status => Object.entries(byCurrency(records.filter(row => row.payment_status === status), 'total')).map(([currency,total]) => [`${status} orders ${currency}`, total])))
  return { 'Stock units (including hidden sizes)': String(records.reduce((total,row) => total + (row.product_variants?.length ? row.product_variants.reduce((qty,v) => qty + Number(v.quantity_on_hand||0),0) : Number(row.quantity_on_hand||0)),0)) }
}
