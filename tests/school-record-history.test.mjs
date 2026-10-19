import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { PGlite } from '@electric-sql/pglite'
const read = path => readFile(new URL('../' + path, import.meta.url), 'utf8')
const id = n => '50000000-0000-4000-8000-' + String(n).padStart(12, '0')

test('Database-authored record history: identity, deltas, rollback, campus scope and MFA', async () => {
  const db = new PGlite()
  try {
    await db.exec(await read('tests/fixtures/security-rpc/schema.sql'))
    await db.exec(await read('tests/fixtures/security-rpc/baseline.sql'))
    await db.exec(`
      create function auth.jwt() returns jsonb language sql as $$select jsonb_build_object('aal',current_setting('test.aal',true),'role',current_setting('test.jwt_role',true))$$;
      create table portal_security_settings(id int,require_admin_mfa boolean);
      insert into portal_security_settings values(1,true);
      alter table students add column date_of_birth date,add column future_secret text;
      create table academic_records(id uuid primary key,student_id uuid references students on delete cascade,subject text,score numeric check(score>=0),comment text,recorded_by uuid,updated_at timestamptz);
      create table attendance(id uuid primary key,student_id uuid,status text,note text);
      create table coursework_marks(id uuid primary key,student_id uuid,assessment_id uuid,score numeric,updated_at timestamptz);
      create table junior_component_marks(id uuid primary key,student_id uuid,subject text,component text,score numeric);
      create table junior_developmental_ratings(id uuid primary key,student_id uuid,development_area text,rating int);
      grant select on profiles,user_roles to authenticated;
      grant select,insert,update,delete on academic_records to authenticated;
    `)
    const helper = async (file, name) => {
      const source = await read('supabase/migrations/' + file)
      const start = source.indexOf('create or replace function public.' + name + '(')
      assert.ok(start >= 0, name)
      const end = source.indexOf('$$;', source.indexOf('as $$', start)) + 3
      await db.exec(source.slice(start, end))
    }
    for (const name of ['portal_mfa_satisfied','has_active_role']) await helper('20261017120000_admin_mfa_guards.sql',name)
    await helper('20261012160000_restrict_schoolwide_settings_to_main_admin.sql','is_main_school_admin')
    for (const [n, role, campus] of [[1,'admin','all'],[2,'admin','junior'],[3,'admin','senior'],[4,'teacher','junior'],[5,'accountant','junior'],[6,'parent','junior'],[7,'principal','junior']]) {
      await db.query('insert into profiles(id,full_name,role,active_role,campus)values($1,$2,$3,$3,$4)',[id(n),'Staff example '+n,role,campus])
      await db.query('insert into user_roles values($1,$2)',[id(n),role])
    }
    for (const [n,campus] of [[101,'junior'],[102,'senior']]) await db.query("insert into students(id,full_name,campus,class_level,status,date_of_birth,future_secret)values($1,$2,$3,'Grade 4','active','2015-01-01','never copy future fields')",[id(n),'Learner '+n,campus])
    const migration = await read('supabase/migrations/20261019100000_school_record_change_history.sql')
    await db.exec(migration); await db.exec(migration)
    const count = async () => Number((await db.query('select count(*) n from school_record_changes')).rows[0].n)
    const act = async (n, aal='aal2', role='authenticated') => {
      await db.exec('reset role')
      await db.query("select set_config('test.uid',$1,false),set_config('test.aal',$2,false),set_config('test.jwt_role',$3,false)",[n?id(n):'',aal,role])
      await db.exec('set role '+role)
    }
    assert.equal(await count(),0,'history does not invent earlier changes')
    await act(4)
    await db.query("insert into academic_records(id,student_id,subject,score,recorded_by)values($1,$2,'Maths',60,$3)",[id(201),id(101),id(1)])
    await db.query('update academic_records set score=75,recorded_by=$1 where id=$2',[id(1),id(201)])
    await db.exec('reset role')
    let events=(await db.query('select * from school_record_changes order by created_at,id')).rows
    assert.equal(events.length,2)
    assert.equal(events[1].actor_id,id(4),'forged recorded_by cannot forge the audit actor')
    assert.equal(events[1].actor_role,'teacher')
    assert.deepEqual(events[1].old_values,{score:60})
    assert.deepEqual(events[1].new_values,{score:75})
    assert.deepEqual(events[1].changed_fields,['score'])
    assert.equal(events[1].campus,'junior')
    assert.equal(events[1].context.subject,'Maths')
    await db.query('update academic_records set score=score,updated_at=now() where id=$1',[id(201)])
    assert.equal(await count(),2,'timestamp-only and same-value saves are ignored')
    await db.exec('begin')
    await db.query('update academic_records set score=80 where id=$1',[id(201)])
    await db.exec('rollback')
    assert.equal(await count(),2,'rolled-back corrections leave no phantom events')
    await assert.rejects(db.query('update academic_records set score=-1 where id=$1',[id(201)]),/check constraint/)
    assert.equal(await count(),2)
    await db.query("update students set full_name='Renamed learner',future_secret='still private' where id=$1",[id(101)])
    events=(await db.query("select * from school_record_changes where source_table='students'")).rows
    assert.deepEqual(events[0].changed_fields,['full_name'])
    assert.equal(JSON.stringify(events).includes('future_secret'),false,'only explicitly reviewed fields are captured')
    for (const [table, columns, values] of [
      ['attendance','status,note',"'present','Corrected register'"],
      ['coursework_marks','score','45'],
      ['junior_component_marks','subject,component,score',"'English','Reading',8"],
      ['junior_developmental_ratings','development_area,rating',"'Social skills',4"],
    ]) await db.query(`insert into ${table}(id,student_id,${columns})values($1,$2,${values})`,[id(301+await count()),id(101)])
    await db.query("insert into academic_records(id,student_id,score)values($1,$2,50)",[id(202),id(102)])
    await db.query("select set_config('test.uid','',false),set_config('test.jwt_role','service_role',false)")
    await db.query("update attendance set note='Database correction' where student_id=$1",[id(101)])
    const system=(await db.query("select * from school_record_changes where new_values->>'note'='Database correction'")).rows[0]
    assert.equal(system.actor_id,null)
    assert.equal(system.actor_name,'Service / database operation')
    assert.equal(system.actor_role,'service_role')
    await db.query("update profiles set full_name='Renamed staff member',campus='senior' where id=$1",[id(4)])
    const snapshot=(await db.query("select * from school_record_changes where source_table='academic_records' and old_values->>'score'='60'")).rows[0]
    assert.equal(snapshot.actor_name,'Staff example 4','actor identity snapshot survives renaming')
    assert.equal(snapshot.campus,'junior','actor relocation cannot move an older event to another campus')
    const all=await count()
    await act(1);assert.equal(await count(),all)
    await act(2);assert.equal(await count(),all-1)
    await act(3);assert.equal(await count(),1)
    await act(7);assert.equal(await count(),all-1)
    for(const n of [4,5,6]){await act(n);assert.equal(await count(),0,'non-manager history denied')}
    await act(1,'aal1');assert.equal(await count(),0,'password-only admin history denied')
    await act(1)
    for(const command of ['delete from school_record_changes','update school_record_changes set actor_name=\'Forged\'','truncate school_record_changes',"insert into school_record_changes(source_table)values('forged')"])
      await assert.rejects(db.exec(command),/permission denied/)
    await assert.rejects(db.exec('select capture_school_record_change()'),/permission denied/)
    await act(0,'aal1','anon');await assert.rejects(db.exec('select * from school_record_changes'),/permission denied/)
    await act(0,'aal1','service_role');await assert.rejects(db.exec('delete from school_record_changes'),/permission denied/)
    await db.exec('reset role')
    await db.query("update students set campus='senior',class_level='Form 1' where id=$1",[id(101)])
    await act(2);assert.equal((await db.query("select * from school_record_changes where source_table='students' and new_values ? 'campus'")).rows.length,0)
    await act(3);assert.equal((await db.query("select * from school_record_changes where source_table='students' and new_values ? 'campus'")).rows.length,0)
    await act(1);assert.equal((await db.query("select * from school_record_changes where source_table='students' and new_values ? 'campus'")).rows.length,1,'cross-campus transfer detail is Main Admin-only')
    await db.exec('reset role')
    await db.query('delete from students where id=$1',[id(101)])
    const history=(await db.query('select * from school_record_changes where learner_id=$1',[id(101)])).rows
    assert.ok(history.some(row=>row.operation==='DELETE'&&row.source_table==='students'))
    assert.ok(history.some(row=>row.operation==='DELETE'&&row.source_table==='academic_records'))
    assert.ok(history.some(row=>row.operation==='UPDATE'&&row.old_values.score===60),'deletion preserves earlier history')
    await act(1);assert.ok(await count()>all,'Main Admin can inspect unresolved cascade campus events')
  } finally { await db.close() }
})
