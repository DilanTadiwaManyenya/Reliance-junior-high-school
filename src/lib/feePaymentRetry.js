export const feePaymentStorageKey = userId => `reliance:fee-payment:${userId}`
export function loadFeePayment(storage, key) {
 try {
  const saved = JSON.parse(storage.getItem(key) || 'null')
  if (!saved) return null
  if (!saved.payload?.p_request_id || !saved.payload?.p_student_id || !saved.name) throw new Error('Invalid saved payment')
  return saved
 } catch { return { invalid: true } }
}
export function saveFeePayment(storage, key, submission) {
 storage.setItem(key, JSON.stringify(submission))
}
