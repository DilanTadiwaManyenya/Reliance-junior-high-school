import assert from 'node:assert/strict'
import { test } from 'node:test'
import { csvText, readAllRows, reportSheets, reportTotals, workbookSheets } from '../src/lib/operationsExport.js'

test('CSV protects text formulas and preserves numeric credits, quotes and identifiers', () => {
  const text = csvText([['0000123',' \t=SUM(1,2)','\r@danger','a"b\nc',-25,0,null]])
  assert.equal(text, '\ufeff"0000123","\' \t=SUM(1,2)","\'\r@danger","a""b\nc","-25","0",""')
})
test('Paged exports read beyond API limits, fail without partial success and honour aborts', async () => {
  const source = Array.from({length:1007},(_,id)=>({id})), pages=[]
  const query = () => ({ order(key) { assert.equal(key,'id');return this }, range(from,to) { pages.push([from,to]);return Promise.resolve({data:source.slice(from,to+1)}) } })
  assert.deepEqual(await readAllRows(query), source)
  assert.deepEqual(pages,[[0,499],[500,999],[1000,1499]])
  await assert.rejects(readAllRows(query,{limit:500}),/exceeds/)
  await assert.rejects(readAllRows(()=>({order(){return this},range(){return {error:{message:'Offline'}}}})),/Offline/)
  const controller=new AbortController();controller.abort()
  await assert.rejects(readAllRows(query,{signal:controller.signal}),/abort/i)
})
test('Exports reconcile stored totals, keep statuses separate and never resolve names from current catalog', () => {
  const sale={id:'sale',receipt_number:'00001',total:15,amount_paid:20,pos_sale_items:[{product_id:'p',product_name:'Old shirt name',quantity:1,unit_price:15,line_total:15,unit_cost:null,size_label:'M'}]}
  const sales=reportSheets('sales',[sale])
  assert.equal(sales[1].rows[1][2],'Old shirt name')
  assert.equal(sales[1].rows[1][7],15)
  assert.equal(sales[1].rows[1][8],'')
  assert.deepEqual(reportTotals('sales',[sale]),{'Sales USD':'15.00',Receipts:'1','Reversed receipts excluded':'0'})
  assert.deepEqual(reportTotals('sales', [
    { total: 20, currency: 'USD' },
    { total: 500, currency: 'ZWG' },
  ]), { 'Sales USD': '20.00', 'Sales ZWG': '500.00', Receipts: '2', 'Reversed receipts excluded':'0' })
  assert.deepEqual(reportTotals('sales',[sale,{...sale,id:'reversed',total:100,status:'reversed'}]),{'Sales USD':'15.00',Receipts:'2','Reversed receipts excluded':'1'})
  assert.equal(reportSheets('sales',[{...sale,status:'reversed'}])[0].rows[1][9],'reversed')
  const fees=[{total_fees:160,amount_paid:25},{total_fees:160,amount_paid:180}]
  assert.deepEqual(reportTotals('fees',fees),{'Term fees USD':'320.00','Paid USD':'205.00','Net balance USD':'115.00'})
  assert.equal(reportSheets('fees',fees)[0].rows[2][9],-20)
  assert.deepEqual(reportTotals('expenses',[{status:'pending',amount:40},{status:'approved',amount:20},{status:'rejected',amount:5}]),{'pending USD':'40.00','approved USD':'20.00','rejected USD':'5.00'})
  assert.deepEqual(reportTotals('expenses', [
    { status: 'approved', amount: 12, currency: 'USD' },
    { status: 'approved', amount: 700, currency: 'ZWG' },
  ]), { 'approved USD': '12.00', 'approved ZWG': '700.00' })
  const order=reportSheets('orders',[{id:'o',items:[{name:'Original tie',quantity:2,unit_price:5}],total:10}])
  assert.equal(order[1].rows[1][2],'Original tie');assert.equal(order[1].rows[1][6],5);assert.equal(order[1].rows[1][7],10)
})
test('Variant stock is exported per size without double-counting parent stock; workbook uses literal text', () => {
  const stock=[{id:'p',name:'=shirt',quantity_on_hand:99,product_variants:[{id:'s',size:'S',quantity_on_hand:2,active:false},{id:'m',size:'M',quantity_on_hand:3,active:true}]}]
  const sheets=reportSheets('stock',stock)
  assert.equal(sheets[0].rows.length,3)
  assert.equal(reportTotals('stock',stock)['Stock units (including hidden sizes)'],'5')
  const workbook=workbookSheets(sheets,{Campus:'senior'})
  assert.equal(workbook[0].data[1][1].type,String)
  assert.equal(workbook[0].data[1][1].value,'=shirt')
  assert.equal(workbook[0].data[1][9].type,Number)
})
