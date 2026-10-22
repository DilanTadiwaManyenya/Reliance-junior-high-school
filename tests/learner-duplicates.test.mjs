import {test} from 'node:test'
import assert from 'node:assert/strict'
import {learnerNameDistance,possibleLearnerDuplicates} from '../src/lib/learnerDuplicates.js'
test('name matching handles four edits, accents, case and reversed name order',()=>{
 assert.equal(learnerNameDistance('Jane Chipo','CHIPO Jane'),0)
 assert.equal(learnerNameDistance('José Banda','Jose Banda'),0)
 assert.equal(learnerNameDistance('abcdefgh','abcdwxyz'),4)
 assert.equal(possibleLearnerDuplicates([{id:'a',full_name:'abcdefgh'},{id:'b',full_name:'zzzzzzzzzzzz'}],{full_name:'abcdwxyz'}).length,1)
 assert.deepEqual(possibleLearnerDuplicates([{full_name:'Jane'}],{full_name:''}),[])
})
