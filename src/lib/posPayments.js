export const salePaid = sale => Number(sale.payment_tracking ? sale.paid_total || 0 : sale.total || 0)
export const saleBalance = sale => sale.status === 'reversed' ? 0 : Math.max(0, Number(sale.total || 0) - salePaid(sale))

// Existing receipts were fully paid; their amount_paid field means tender,
// including change. New receipts use applied ledger amounts instead.
export function saleCollections(sales) {
  return sales.filter(sale => sale.status !== 'reversed').flatMap(sale => sale.payment_tracking
    ? (sale.pos_payments || []).map(payment => ({ ...payment, receipt_number: sale.receipt_number, sale_id: sale.id }))
    : [{ id: sale.id, sale_id: sale.id, receipt_number: sale.receipt_number, amount: Number(sale.total || 0), currency: sale.currency || 'USD', payment_method: sale.payment_method, created_at: sale.created_at }])
}
