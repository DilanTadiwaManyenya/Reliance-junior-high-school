import test from 'node:test'
import assert from 'node:assert/strict'
import { performanceComment } from '../src/lib/reportPerformanceComment.js'
import { totalOwing } from '../src/lib/learnerFees.js'
test('automatic comments use recorded performance without treating missing marks as zero',()=>{
 assert.match(performanceComment([90,null,'',undefined]),/Excellent/)
 assert.match(performanceComment([70,65]),/Good overall/)
 assert.match(performanceComment([50,60]),/Satisfactory/)
 assert.match(performanceComment([0,20]),/additional support/)
 assert.match(performanceComment([null,'',undefined]),/not yet complete/)
 assert.match(performanceComment([4,5],{developmental:true}),/developmental progress/)
 assert.match(performanceComment([1,2],{developmental:true}),/individual support/)
})
test('settled fees unlock results, with no currency conversion or credit offset across currencies',()=>{
 const fee={academic_year:2026,term:'Term 3',total_fees:100,amount_paid:100,currency:'USD'}
 assert.equal(totalOwing([fee]),0)
 assert.equal(totalOwing([{...fee,amount_paid:101}]),0)
 assert.equal(totalOwing([fee,{...fee,currency:'ZWG',amount_paid:99}]),1)
})
