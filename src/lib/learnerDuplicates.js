const normalized = value => String(value || '').normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim().split(/\s+/).sort().join(' ')
export function learnerNameDistance(left, right) {
  const a = normalized(left), b = normalized(right)
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const next = [i]
    for (let j = 1; j <= b.length; j++) next[j] = Math.min(next[j - 1] + 1, previous[j] + 1, previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    previous = next
  }
  return previous[b.length]
}
export function possibleLearnerDuplicates(rows, learner) {
  if (!normalized(learner.full_name)) return []
  return rows.filter(row => row.id !== learner.id && learnerNameDistance(row.full_name, learner.full_name) <= 4)
    .sort((a, b) => learnerNameDistance(a.full_name, learner.full_name) - learnerNameDistance(b.full_name, learner.full_name))
}
