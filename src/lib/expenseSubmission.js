export const expenseSubmissionKey = userId => `reliance:expense-submission:${userId}`
export function loadExpenseSubmission(storage,key) {
 try {
  const saved=JSON.parse(storage.getItem(key)||'null')
  if (!saved) return null
  if (!saved.p_request_id || !saved.p_expense?.campus || !saved.p_expense?.amount) throw new Error('Invalid saved expense')
  return saved
 } catch { return {invalid:true} }
}
export function activeExpenseRows(rows,currency) {
 return rows.filter(row => row.status !== 'reversed' && (row.currency||'USD')===currency)
}
