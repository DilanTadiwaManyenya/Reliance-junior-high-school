import test from 'node:test';
import assert from 'node:assert/strict';
import { FINANCE_CURRENCIES, formatCurrencyTotals, formatMoney, normalizeFinanceCurrency, sumByCurrency } from '../src/lib/currency.js';
import { feeOwingSummary, totalOwing } from '../src/lib/learnerFees.js';

test('finance currency is explicit and restricted to USD and ZWG', () => {
  assert.deepEqual(FINANCE_CURRENCIES, ['USD', 'ZWG']);
  assert.equal(normalizeFinanceCurrency(undefined), 'USD');
  assert.equal(normalizeFinanceCurrency('zwg'), 'ZWG');
  assert.throws(() => normalizeFinanceCurrency('ZWL'), /Unsupported finance currency/);
});

test('amounts remain separated by currency with no conversion', () => {
  assert.deepEqual(sumByCurrency([
    { currency: 'USD', amount: 12.5 },
    { currency: 'ZWG', amount: 400 },
    { currency: 'USD', amount: 2.5 },
  ]), { USD: 15, ZWG: 400 });
});

test('formatted amounts include their currency code', () => {
  assert.match(formatMoney(10, 'USD'), /USD/);
  assert.match(formatMoney(10, 'ZWG'), /ZWG/);
});

test('currency totals render as separate labeled values', () => {
  const totals = formatCurrencyTotals({ USD: 15, ZWG: 400 });
  assert.match(totals, /USD/);
  assert.match(totals, /ZWG/);
  assert.notEqual(totals, formatMoney(415, 'USD'));
});

test('current learner fee balances lock results while showing each currency separately', () => {
  const fees = [
    { academic_year: 2026, term: 'Term 3', total_fees: 300, amount_paid: 100, currency: 'USD' },
    { academic_year: 2026, term: 'Term 3', total_fees: 5000, amount_paid: 2000, currency: 'ZWG' },
  ];
  assert.equal(totalOwing(fees) > 0, true);
  const summary = feeOwingSummary(fees);
  assert.match(summary, /USD/);
  assert.match(summary, /ZWG/);
  assert.notEqual(summary, formatMoney(3200, 'USD'));
});
