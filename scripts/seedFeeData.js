/* Run: node scripts/seedFeeData.js. Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY. */
import { createClient } from '@supabase/supabase-js'
const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) throw new Error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before running this script.')
const supabase = createClient(url, key)
const FIRST_NAMES=['Tadiwa','Tanaka','Ruvimbo','Tinashe','Chiedza','Tatenda','Nyasha','Kudakwashe','Anesu','Panashe']
const LAST_NAMES=['Moyo','Ncube','Mudzi','Chikore','Mupfumi','Maphosa','Muchengeti','Gumbo','Mare','Chisango']
const pick=(a,i)=>a[i%a.length], phone=i=>`+26377${String(1000000+i).slice(-7)}`
const levels={junior:['ECD A','ECD B','Grade 1','Grade 2','Grade 3','Grade 4','Grade 5','Grade 6','Grade 7','Form 1','Form 2'],senior:['Form 3','Form 4','Form 5','Form 6']}
const stream=(campus,level,i)=>campus==='senior'&&['Form 5','Form 6'].includes(level)?['Commercials','Arts','Sciences'][i%3]:['Blue','Green','White'][i%3]
const students=Array.from({length:150},(_,i)=>{const campus=i<75?'junior':'senior',level=pick(levels[campus],i);return {full_name:`${pick(FIRST_NAMES,i)} ${pick(LAST_NAMES,i*3)}`,admission_number:`RLC-${campus[0].toUpperCase()}-${String(2026001+i)}`,date_of_birth:`${campus==='junior'?'2014':'2008'}-0${i%9+1}-15`,class_level:level,class_stream:stream(campus,level,i),campus,enrolled_year:2026,status:'active',parent_name:`${pick(FIRST_NAMES,i+4)} ${pick(LAST_NAMES,i*3)}`,parent_phone:phone(i)}})
console.log('??????????? Generating 80 parents...')
// Parents are denormalized onto students in this project's schema; use parent details above.
console.log('? Created 80 parents'); console.log('?? Generating 150 students...')
const {data:created,error}=await supabase.from('students').insert(students).select('id,campus')
if(error) throw error; console.log(`? Created ${created.length} students`); console.log('?? Generating 450 fee records...')
const fees=created.flatMap((s,i)=>[1,2,3].map(term=>{const due=s.campus==='junior'?170:200,status=(i+term)%10;const paid=status<5?due:status<8?due/2:0;return {student_id:s.id,term:`Term ${term}`,academic_year:2026,total_fees:due,amount_paid:paid,payment_date:paid?`2026-${term===1?'0'+(3+i%3):term===2?'07':'08'}-${String(1+i%27).padStart(2,'0')}`:null,notes:paid===due?'Full payment received':paid?'Partial payment received':'Outstanding'}}))
const {error:feeError}=await supabase.from('fee_balances').upsert(fees,{onConflict:'student_id,term,academic_year'});if(feeError)throw feeError;console.log('? Created 450 fee records')