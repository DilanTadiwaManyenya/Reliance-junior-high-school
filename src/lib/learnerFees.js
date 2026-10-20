import { formatMoney } from './currency.js'

const CURRENT_ACADEMIC_YEAR = 2026
const CURRENT_TERM = 'Term 3'
const normalizedTerm = term => String(term ?? '').trim().toLowerCase().replace(/^term\s*/, '')

export const activeFeeBalance = (fees = []) => {
  const current = fees.filter(row => Number(row.academic_year) === CURRENT_ACADEMIC_YEAR && normalizedTerm(row.term) === normalizedTerm(CURRENT_TERM))
  return current.find(row => String(row.term).trim().toLowerCase() === CURRENT_TERM.toLowerCase())
    ?? current.sort((a, b) => new Date(b.updated_at ?? 0) - new Date(a.updated_at ?? 0))[0]
    ?? [...fees].sort((a, b) => new Date(b.updated_at ?? 0) - new Date(a.updated_at ?? 0))[0]
}

export const currentFeeBalances = (fees = []) => {
  const current = fees.filter(row => Number(row.academic_year) === CURRENT_ACADEMIC_YEAR && normalizedTerm(row.term) === normalizedTerm(CURRENT_TERM))
  if (current.length) return current
  const latest = activeFeeBalance(fees)
  return latest ? [latest] : []
}

export const totalOwing = (fees = []) => currentFeeBalances(fees)
  .reduce((total, row) => total + Math.max(0, Number(row.total_fees ?? 0) - Number(row.amount_paid ?? 0)), 0)

export const feeOwingSummary = (fees = []) => {
  const balances = currentFeeBalances(fees).reduce((groups, row) => {
    const currency = row.currency || 'USD'
    groups[currency] = (groups[currency] || 0) + Math.max(0, Number(row.total_fees ?? 0) - Number(row.amount_paid ?? 0))
    return groups
  }, {})
  return Object.entries(balances).filter(([, amount]) => amount > 0).map(([currency, amount]) => formatMoney(amount, currency)).join(' · ') || formatMoney(0, 'USD')
}
