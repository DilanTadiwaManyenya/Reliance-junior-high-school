import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildReconciliationEntries, filterReconciliationEntries, summarizeReconciliationEntries } from '../src/lib/financeReconciliation.js'

const sourceRows = () => buildReconciliationEntries({
  feePayments: [
    { id: 'f1', paid_on: '2026-10-01', amount: 25, currency: 'USD', students: { campus: 'junior', full_name: 'Learner One', admission_number: 'J001' } },
    { id: 'f2', paid_on: '2026-10-02', amount: 400, currency: 'ZWG', students: { campus: 'senior', full_name: 'Learner Two', admission_number: 'S001' } },
  ],
  sales: [
    { id: 's1', created_at: '2026-10-03T12:00:00Z', campus: 'junior', total: 20, currency: 'USD', receipt_number: 'R-1' },
  ],
  expenses: [
    { id: 'e1', expense_date: '2026-10-04', campus: 'junior', amount: 8, currency: 'USD', status: 'approved', description: 'Fuel' },
    { id: 'e2', expense_date: '2026-10-05', campus: 'junior', amount: 7, currency: 'USD', status: 'pending', description: 'Stationery' },
    { id: 'e3', expense_date: '2026-10-06', campus: 'senior', amount: 50, currency: 'ZWG', status: 'rejected', description: 'Repair' },
  ],
})

test('Reversed POS receipts stay traceable but do not count as collections', () => {
  const rows = buildReconciliationEntries({ sales: [
    { id: 'original', total: 25, currency: 'USD', status: 'reversed', created_at: '2026-10-21', campus: 'senior' },
    { id: 'valid', total: 20, currency: 'USD', status: 'completed', created_at: '2026-10-21', campus: 'senior' },
  ] })
  assert.equal(rows.length, 2)
  assert.equal(rows.find(row => row.sourceId === 'original').direction, 'excluded')
  assert.equal(summarizeReconciliationEntries(rows).USD.collected, 20)
})

test('Builds a read-only ledger from actual fee receipts, POS totals, and approved expenses', () => {
  const rows = sourceRows()
  const totals = summarizeReconciliationEntries(rows)
  assert.equal(totals.USD.collected, 45)
  assert.equal(totals.USD.approvedExpenses, 8)
  assert.equal(totals.USD.netMovement, 37)
  assert.equal(totals.USD.pendingExpenses, 7)
  assert.equal(totals.ZWG.collected, 400)
  assert.equal(totals.ZWG.rejectedExpenses, 50)
  assert.equal(totals.ZWG.netMovement, 400)
  assert.equal(rows.filter(row => row.kind === 'Parent order').length, 0)
})

test('Keeps campus, currency, and date filters independent without converting amounts', () => {
  const rows = filterReconciliationEntries(sourceRows(), { campus: 'junior', currency: 'USD', from: '2026-10-01', to: '2026-10-04' })
  assert.deepEqual(new Set(rows.map(row => row.campus)), new Set(['junior']))
  assert.deepEqual(new Set(rows.map(row => row.currency)), new Set(['USD']))
  assert.ok(rows.every(row => row.date >= '2026-10-01' && row.date <= '2026-10-04'))
  assert.equal(rows.reduce((sum, row) => sum + (row.direction === 'in' ? row.amount : 0), 0), 45)
})

test('Displays POS timestamps in the school timezone for accurate daily reconciliation', () => {
  const [sale] = buildReconciliationEntries({ sales: [{ id: 'late-sale', created_at: '2026-10-01T23:30:00Z', campus: 'senior', total: 1 }] })
  assert.equal(sale.date, '2026-10-02')
})
