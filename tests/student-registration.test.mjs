import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { PGlite } from '@electric-sql/pglite'
import { registerStudentHandler } from '../supabase/functions/_shared/registerStudent.js'
import { normalizeStudentAdmission, parseTypedBirthDate, validStudentBirthDate } from '../shared/studentRegistration.js'

test('DOB keyboard entry accepts day-first, compact numeric and ISO dates while rejecting impossible/future dates', () => {
  const today = '2026-10-22'
  assert.equal(parseTypedBirthDate('29/02/2012', today), '2012-02-29')
  assert.equal(parseTypedBirthDate('29022012', today), '2012-02-29')
  assert.equal(parseTypedBirthDate('2012-2-29', today), '2012-02-29')
  assert.equal(parseTypedBirthDate('31/02/2012', today), '')
  assert.equal(parseTypedBirthDate('00/12/2012', today), '')
  assert.equal(parseTypedBirthDate('23/10/2026', today), '')
  assert.equal(parseTypedBirthDate('29/02/', today), '')
})

test('Registration HTTP and real SQL transaction acceptance', async t => {
  const db = new PGlite()
  let created = [], removed = [], rpcCalls = 0, loseResponse = false, failInsert = false, lookupError = false
  const reports = []
  try {
    await db.exec(`
      create role anon; create role authenticated; create role service_role;
      create schema auth;
      create table auth.users(id uuid primary key,email text unique,raw_app_meta_data jsonb,created_at timestamptz default now());
      create table profiles(id uuid primary key references auth.users on delete cascade,role text,active_role text,full_name text,campus text,class_level text,class_stream text);
      create table user_roles(user_id uuid references auth.users on delete cascade,role text,unique(user_id,role));
      create table students(id uuid primary key,admission_number text unique,date_of_birth date,status text,auth_user_id uuid unique references profiles,full_name text,campus text,class_level text,class_stream text);
      create table student_accounts(id uuid default gen_random_uuid(),user_id uuid unique references auth.users on delete cascade,admission_number text unique,phone_number text,verified boolean,verified_at timestamptz);
    `)
    const migration = await readFile(new URL('../supabase/migrations/20261017130000_atomic_student_registration.sql',import.meta.url),'utf8')
    await db.exec(migration)
    await db.exec(migration)
    const sql = async (text, args = []) => (await db.query(text,args)).rows
    const createAuth = async args => {
      try {
        const id = randomUUID()
        await sql('insert into auth.users(id,email,raw_app_meta_data) values($1,$2,$3)',[id,args.email,JSON.stringify(args.app_metadata)])
        await sql("insert into profiles(id,role,active_role) values($1,'parent','parent')",[id])
        await sql("insert into user_roles values($1,'parent')",[id])
        created.push(args)
        return {data:{user:{id}}}
      } catch { return {error:{message:'account exists'}} }
    }
    const client = {
      auth:{admin:{createUser:createAuth,deleteUser:async id => {
        removed.push(id)
        try { await sql('delete from auth.users where id=$1',[id]);return {} } catch { return {error:true} }
      }}},
      from(table) {
        assert.ok(['students','student_accounts'].includes(table))
        const filters=[],values=[]
        const query={
          select(){return query},
          eq(column,value){assert.ok(/^[a-z_]+$/.test(column));values.push(value);filters.push(column+'=$'+values.length);return query},
          is(column,value){assert.equal(value,null);filters.push(column+' is null');return query},
          async maybeSingle(){
            if(lookupError)return {error:true}
            const rows=await sql('select * from '+table+' where '+filters.join(' and '),values)
            return {data:rows[0]||null}
          },
        }
        return query
      },
      async rpc(name,args){
        assert.equal(name,'complete_student_registration');rpcCalls++
        try {
          if(failInsert) await db.exec(`create function reject_account() returns trigger language plpgsql as $$begin raise exception 'test failure';end$$;create trigger reject_account before insert on student_accounts for each row execute function reject_account();`)
          await sql('select complete_student_registration($1,$2,$3,$4,$5)',[args.p_user_id,args.p_admission_number,args.p_date_of_birth,args.p_class_level,args.p_class_stream])
          return loseResponse?{error:{message:'network lost after commit'}}:{}
        }catch{return {error:{message:'transaction rejected'}}}
        finally{if(failInsert)await db.exec('drop trigger if exists reject_account on student_accounts;drop function if exists reject_account()')}
      },
    }
    const handler=registerStudentHandler(client,code=>reports.push(code))
    const base={password:'SyntheticPassword7!',admission_number:'26f146',date_of_birth:'2012-02-29',class_level:'Form 1',class_stream:'Red'}
    const send=body=>handler(new Request('https://test.invalid',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}))
    const seed=async(admission='26f146',level='Form 1',stream='Red',campus='senior')=>{
      await db.exec('truncate student_accounts,students,user_roles,profiles,auth.users cascade')
      await sql("insert into students values($1,$2,'2012-02-29','active',null,'Synthetic learner',$3,$4,$5)",[randomUUID(),admission,campus,level,stream])
      created=[];removed=[];rpcCalls=0;loseResponse=false;failInsert=false;lookupError=false
    }
    await t.test('method, malformed JSON, impossible/future DOB and invalid payload are rejected before Auth',async()=>{
      await seed()
      assert.equal((await handler(new Request('https://test.invalid'))).status,405)
      assert.equal((await handler(new Request('https://test.invalid',{method:'OPTIONS'}))).status,200)
      assert.equal((await handler(new Request('https://test.invalid',{method:'POST',body:'{'}))).status,400)
      for(const body of [null,[],{...base,date_of_birth:'2011-02-29'},{...base,date_of_birth:'2999-01-01'},{...base,password:'weak'}])assert.equal((await send(body)).status,400)
      assert.equal(created.length,0)
      assert.equal(validStudentBirthDate('2024-02-30'),false)
    })
    await t.test('school code, no phone, trusted role and authoritative campus/class',async()=>{
      await seed()
      assert.equal((await send({...base,admission_number:' 26F146 ',role:'admin',campus:'junior',enrolled_year:2099})).status,200)
      assert.equal(created[0].email,'student-26f146@portal.reliance.local')
      assert.deepEqual(created[0].app_metadata,{role:'student'})
      assert.deepEqual((await sql('select role,active_role,campus,class_level,class_stream from profiles'))[0],{role:'student',active_role:'student',campus:'senior',class_level:'Form 1',class_stream:'Red'})
      assert.deepEqual(await sql('select role from user_roles'),[{role:'student'}])
      assert.equal((await sql('select verified from student_accounts'))[0].verified,true)
      assert.equal((await send(base)).status,400)
      assert.equal(created.length,1)
    })
    await t.test('ECD casing, no stream and Lower Six support use learner record',async()=>{
      await seed('26eA01','ECD A',null,'junior')
      assert.equal(normalizeStudentAdmission('26EA01'),'26eA01')
      assert.equal((await send({...base,admission_number:'26ea01',class_level:'ECD A',class_stream:'N/A'})).status,200)
      assert.equal(created[0].email,'student-26eA01@portal.reliance.local')
      await seed('26f501','Lower Six','Sciences')
      assert.equal((await send({...base,admission_number:'26f501',class_level:'Lower Six',class_stream:'Sciences'})).status,200)
    })
    await t.test('wrong class, inactive and missing records fail without provisioning',async()=>{
      await seed()
      for(const body of [{...base,class_level:'Grade 1'},{...base,class_stream:'Blue'},{...base,date_of_birth:'2012-02-28'}])assert.equal((await send(body)).status,400)
      await sql("update students set status='inactive'")
      assert.equal((await send(base)).status,400)
      assert.equal(created.length,0)
    })
    await t.test('database failure rolls back link, profile and membership; new Auth account cleaned',async()=>{
      await seed();failInsert=true
      assert.equal((await send(base)).status,503)
      assert.equal(removed.length,1)
      assert.equal((await sql('select auth_user_id from students'))[0].auth_user_id,null)
      assert.equal((await sql('select count(*)::int n from auth.users'))[0].n,0)
      assert.equal((await sql('select count(*)::int n from student_accounts'))[0].n,0)
    })
    await t.test('lost success response preserves linked account and permits sign-in',async()=>{
      await seed();loseResponse=true
      assert.equal((await send(base)).status,200)
      assert.equal(removed.length,0)
      assert.equal((await sql('select count(*)::int n from student_accounts'))[0].n,1)
    })
    await t.test('concurrent registrations produce one account and one learner link',async()=>{
      await seed()
      const result=await Promise.all([send(base),send(base)])
      assert.equal(result.filter(r=>r.status===200).length,1)
      assert.equal((await sql('select count(*)::int n from student_accounts'))[0].n,1)
      assert.equal((await sql('select count(*)::int n from auth.users'))[0].n,1)
    })
    await t.test('completion rechecks learner details and cannot repurpose a staff account',async()=>{
      await seed()
      const auth=await createAuth({email:'student-26f146@portal.reliance.local',app_metadata:{role:'student'}})
      const userId=auth.data.user.id
      const complete=(dob=base.date_of_birth,level=base.class_level)=>sql('select complete_student_registration($1,$2,$3,$4,$5)',[userId,base.admission_number,dob,level,base.class_stream])
      await assert.rejects(complete('2012-02-28'),/verification failed/)
      await assert.rejects(complete(base.date_of_birth,'Grade 1'),/verification failed/)
      await sql("update students set status='inactive'")
      await assert.rejects(complete(),/verification failed/)
      await sql("update students set status='active'")
      await sql("insert into user_roles values($1,'admin')",[userId])
      await assert.rejects(complete(),/not eligible/)
      assert.equal((await sql('select auth_user_id from students'))[0].auth_user_id,null)
      assert.equal((await sql('select count(*)::int n from student_accounts'))[0].n,0)
      assert.equal((await sql('select role from profiles'))[0].role,'parent')
    })
    await t.test('RPC is unavailable to anonymous, parent, teacher or admin client tokens',async()=>{
      const grants=await sql("select has_function_privilege('anon','complete_student_registration(uuid,text,date,text,text)','execute') anon,has_function_privilege('authenticated','complete_student_registration(uuid,text,date,text,text)','execute') authenticated,has_function_privilege('service_role','complete_student_registration(uuid,text,date,text,text)','execute') service")
      assert.deepEqual(grants[0],{anon:false,authenticated:false,service:true})
      for(const role of ['anon','authenticated']){
        await db.exec('set role '+role)
        await assert.rejects(sql('select complete_student_registration($1,$2,$3,$4,$5)',[randomUUID(),base.admission_number,base.date_of_birth,base.class_level,base.class_stream]),/permission denied/)
        await db.exec('reset role')
      }
    })
    await t.test('service lookup errors fail closed',async()=>{
      await seed();lookupError=true
      assert.equal((await send(base)).status,503)
      assert.equal(created.length,0)
      assert.equal(rpcCalls,0)
    })
  }finally{await db.close()}
})
