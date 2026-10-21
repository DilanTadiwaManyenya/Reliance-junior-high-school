const amountOf = row => Number(row.amount ?? row.total ?? 0)
const currencyOf = row => String(row.currency || 'USD').toUpperCase()
const dateOf = value => {
  if (!value) return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Harare', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(value))
  const fields = Object.fromEntries(parts.map(part => [part.type, part.value]))
  return `${fields.year}-${fields.month}-${fields.day}`
}

export function buildReconciliationEntries({ feePayments = [], sales = [], posPayments = [], expenses = [] }) {
  return [
    ...feePayments.map(row => ({
      id: `fee:${row.id}`,
      sourceId: row.id,
      date: dateOf(row.paid_on),
      campus: row.students?.campus || row.campus || null,
      currency: currencyOf(row),
      direction: row.status === 'reversed' ? 'excluded' : 'in',
      kind: 'Fee payment',
      reference: row.reference_number || '',
      description: [row.students?.full_name, row.students?.admission_number, row.term, row.academic_year].filter(Boolean).join(' · '),
      amount: amountOf(row),
      status: row.status === 'reversed' ? 'reversed — settlement review required' : 'recorded',
    })),
    ...sales.filter(row => !row.payment_tracking).map(row => ({
      id: `pos:${row.id}`,
      sourceId: row.id,
      date: dateOf(row.created_at),
      campus: row.campus || null,
      currency: currencyOf(row),
      direction: row.status === 'reversed' ? 'excluded' : 'in',
      kind: 'POS sale',
      reference: row.receipt_number || '',
      description: row.customer_name || 'Counter sale',
      amount: amountOf(row),
      status: row.status === 'reversed' ? 'reversed — settlement review required' : 'recorded',
    })),
    ...posPayments.map(row => ({
      id: `pos-payment:${row.id}`, sourceId: row.id, date: dateOf(row.paid_on || row.created_at),
      campus: row.campus, currency: currencyOf(row), direction: row.pos_sales?.status === 'reversed' ? 'excluded' : 'in',
      kind: 'POS payment', reference: row.pos_sales?.receipt_number || row.reference_number || '',
      description: row.pos_sales?.customer_name || 'Uniform payment', amount: amountOf(row),
      status: row.pos_sales?.status === 'reversed' ? 'reversed sale — settlement review required' : 'recorded',
    })),
    ...expenses.map(row => ({
      id: `expense:${row.id}`,
      sourceId: row.id,
      date: dateOf(row.expense_date),
      campus: row.campus || null,
      currency: currencyOf(row),
      direction: row.status === 'approved' ? 'out' : 'excluded',
      kind: 'Expense',
      reference: row.receipt_reference || '',
      description: [row.category, row.description, row.supplier].filter(Boolean).join(' · '),
      amount: amountOf(row),
      status: row.status || 'unknown',
    })),
  ].sort((left, right) => right.date.localeCompare(left.date) || left.id.localeCompare(right.id))
}

export function filterReconciliationEntries(entries, filters = {}) {
  return entries.filter(row => {
    if (filters.campus && filters.campus !== 'all' && row.campus !== filters.campus) return false
    if (filters.currency && filters.currency !== 'all' && row.currency !== filters.currency) return false
    if (filters.from && row.date < filters.from) return false
    if (filters.to && row.date > filters.to) return false
    return true
  })
}

export function summarizeReconciliationEntries(entries) {
  return entries.reduce((totals, row) => {
    const currency = currencyOf(row)
    const total = totals[currency] ||= { collected: 0, approvedExpenses: 0, netMovement: 0, pendingExpenses: 0, rejectedExpenses: 0 }
    if (row.direction === 'in') total.collected += row.amount
    if (row.direction === 'out') total.approvedExpenses += row.amount
    if (row.direction === 'excluded' && row.status === 'pending') total.pendingExpenses += row.amount
    if (row.direction === 'excluded' && row.status === 'rejected') total.rejectedExpenses += row.amount
    total.netMovement = total.collected - total.approvedExpenses
    return totals
  }, {})
}
