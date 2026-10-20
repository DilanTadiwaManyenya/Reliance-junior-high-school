export const FINANCE_CURRENCIES = ['USD', 'ZWG'];

export function normalizeFinanceCurrency(currency = 'USD') {
  const normalized = String(currency || 'USD').toUpperCase();
  if (!FINANCE_CURRENCIES.includes(normalized)) {
    throw new RangeError(`Unsupported finance currency: ${normalized}`);
  }
  return normalized;
}

export function formatMoney(value, currency = 'USD') {
  const code = normalizeFinanceCurrency(currency);
  return new Intl.NumberFormat('en-ZW', {
    style: 'currency',
    currency: code,
    currencyDisplay: 'code',
  }).format(Number(value || 0));
}

export function sumByCurrency(rows = [], amount = row => row.amount) {
  return rows.reduce((totals, row) => {
    const currency = normalizeFinanceCurrency(row.currency);
    totals[currency] = (totals[currency] || 0) + Number(amount(row) || 0);
    return totals;
  }, {});
}

export function formatCurrencyTotals(totals = {}) {
  return Object.entries(totals)
    .filter(([, amount]) => Number(amount) !== 0)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([currency, amount]) => formatMoney(amount, currency))
    .join(' · ') || formatMoney(0, 'USD');
}
