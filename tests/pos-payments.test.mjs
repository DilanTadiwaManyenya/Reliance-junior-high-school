import assert from 'node:assert/strict'
import { test } from 'node:test'
import { salePaid, saleBalance, saleCollections } from '../src/lib/posPayments.js'
import { buildReconciliationEntries, summarizeReconciliationEntries } from '../src/lib/financeReconciliation.js'

test('Legacy tender is not misreported as payment, and a new 25/20/5 sale keeps its balance',()=>{
  const old={id:'old',total:25,amount_paid:30,currency:'USD',created_at:'2026-10-01'}
  const partial={id:'new',total:25,amount_paid:20,paid_total:20,payment_tracking:true,currency:'USD',pos_payments:[{id:'p1',amount:20,created_at:'2026-10-21',currency:'USD'}]}
  assert.equal(salePaid(old),25);assert.equal(saleBalance(old),0)
  assert.equal(salePaid(partial),20);assert.equal(saleBalance(partial),5)
  assert.equal(saleCollections([old,partial]).reduce((sum,p)=>sum+Number(p.amount),0),45)
  assert.equal(saleBalance({...partial,status:'reversed'}),0)
  assert.equal(saleCollections([{...partial,status:'reversed'}]).length,0)
})

test('Reconciliation counts each payment on its own date and never also counts the tracked sale total',()=>{
  const rows=buildReconciliationEntries({sales:[{id:'sale',total:25,payment_tracking:true,created_at:'2026-10-21'}],posPayments:[
    {id:'first',amount:20,paid_on:'2026-10-21',currency:'USD',campus:'senior',pos_sales:{status:'completed',receipt_number:'R1'}},
    {id:'final',amount:5,paid_on:'2026-11-01',currency:'USD',campus:'senior',pos_sales:{status:'completed',receipt_number:'R1'}},
  ]})
  assert.equal(rows.length,2);assert.equal(summarizeReconciliationEntries(rows).USD.collected,25)
  assert.equal(rows.find(row=>row.sourceId==='final').date,'2026-11-01')
  const reversed=buildReconciliationEntries({posPayments:[{id:'p',amount:20,currency:'USD',pos_sales:{status:'reversed'}}]})
  assert.equal(summarizeReconciliationEntries(reversed).USD.collected,0)
})
