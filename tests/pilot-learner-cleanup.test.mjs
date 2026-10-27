import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { PGlite } from '@electric-sql/pglite'
const sql = await readFile(new URL('../supabase/maintenance/20261027_remove_confirmed_pilot_learners.sql', import.meta.url), 'utf8')
const ids = ['857f0939-6ab3-4458-9c88-f287ace0fad3', 'f67b347d-8fc9-488f-87d6-3eba5178e161', '2f732608-d3a8-4750-a73f-475d94b02d46', '00000000-0000-4000-8000-000000000004']
async function fixture() {
  const db = new PGlite()
  await db.exec(`
    create table students(id uuid primary key, admission_number text unique, full_name text, campus text, class_level text, class_stream text, enrolled_year integer, status text);
    insert into students values
      ('${ids[0]}','26f132','ANGEL MUSHANYUKI','senior','Form 1','White',2026,'inactive'),
      ('${ids[1]}','26f139','ANDREW DUBE','senior','Form 1','White',2026,'inactive'),
      ('${ids[2]}','26f146','ALBERT MVURA','senior','Form 1','White',2026,'inactive'),
      ('${ids[3]}','UNRELATED','Unrelated fixture','senior','Form 1','White',2026,'active');
    create table fee_balances(id uuid primary key, student_id uuid references students(id) on delete cascade, academic_year integer);
    insert into fee_balances select id,id,2026 from students;
    create table fee_payment_requests(request_id uuid primary key, fee_balance_id uuid not null references fee_balances(id), payload jsonb not null);
    insert into fee_payment_requests select id,id,jsonb_build_object('student_id',student_id,'year',2026) from fee_balances;
    create table fee_payments(student_id uuid references students(id) on delete cascade, academic_year integer);
    insert into fee_payments values ('${ids[0]}',2026),('${ids[1]}',2026),('${ids[2]}',2026),('${ids[3]}',2026);
    create table audit_events(student_id uuid);
    create function audit_payment() returns trigger language plpgsql as $$ begin insert into audit_events values(old.student_id); return old; end $$;
    create trigger payment_audit after delete on fee_payments for each row execute function audit_payment();
  `)
  for (const table of ['pos_sales', 'parent_uniform_orders', 'year_rollover_entries', 'academic_records', 'junior_component_marks', 'junior_developmental_ratings', 'report_card_comments', 'coursework_marks', 'report_period_contexts']) {
    await db.exec(`create table ${table}(student_id uuid references students(id) on delete restrict)`)
  }
  await db.exec(`insert into academic_records values('${ids[0]}'); insert into report_period_contexts values('${ids[0]}')`)
  return db
}
async function unchangedAfterFailure(db) {
  await assert.rejects(db.exec(sql))
  await db.exec('rollback')
  assert.equal((await db.query('select count(*)::int as n from students')).rows[0].n, 4)
  assert.equal((await db.query('select count(*)::int as n from fee_payments')).rows[0].n, 4)
  assert.equal((await db.query('select count(*)::int as n from audit_events')).rows[0].n, 0)
  assert.equal((await db.query('select count(*)::int as n from fee_payment_requests')).rows[0].n, 4)
  assert.equal((await db.query('select count(*)::int as n from fee_balances')).rows[0].n, 4)
}
test('verified live identifiers target exactly three pilot learners; unrelated rows and audit survive', async () => {
  const db = await fixture()
  try {
    await db.exec(sql)
    assert.deepEqual((await db.query('select id from students')).rows, [{ id: ids[3] }])
    assert.deepEqual((await db.query('select student_id from fee_payments')).rows, [{ student_id: ids[3] }])
    assert.equal((await db.query('select count(*)::int as n from audit_events')).rows[0].n, 3)
    assert.deepEqual((await db.query('select fee_balance_id from fee_payment_requests')).rows, [{ fee_balance_id: ids[3] }])
    assert.deepEqual((await db.query('select student_id from fee_balances')).rows, [{ student_id: ids[3] }])
    await assert.rejects(db.exec(sql))
    await db.exec('rollback')
    assert.deepEqual((await db.query('select id from students')).rows, [{ id: ids[3] }])
  } finally { await db.close() }
})
test('cleanup aborts for mismatched live identity, scope or protected history without partial writes', async () => {
  for (const setup of [
    `update students set status='active' where id='${ids[0]}'`,
    `update students set class_stream='Green' where id='${ids[0]}'`,
    `update students set full_name='Different learner' where id='${ids[0]}'`,
    `update students set admission_number='F1-2026-032' where id='${ids[0]}'`,
    `insert into pos_sales values('${ids[0]}')`,
    `insert into parent_uniform_orders values('${ids[0]}')`,
    `insert into year_rollover_entries values('${ids[0]}')`,
    `update fee_payments set academic_year=2025 where student_id='${ids[0]}'`,
    `update fee_balances set academic_year=2025 where student_id='${ids[0]}'`,
    `update fee_payment_requests set payload=jsonb_build_object('student_id','unrelated','year',2026) where fee_balance_id='${ids[0]}'`,
  ]) {
    const db = await fixture()
    try { await db.exec(setup); await unchangedAfterFailure(db) } finally { await db.close() }
  }
})
test('matching admission number and name on a different learner UUID cannot be deleted', async () => {
  const db = await fixture()
  try {
    // Reassign the expected UUID across every fixture reference without removing rows.
    for (const table of ['fee_payments', 'academic_records', 'report_period_contexts']) {
      await db.exec(`delete from ${table} where student_id='${ids[0]}'`)
    }
    await db.exec(`delete from fee_payment_requests where fee_balance_id='${ids[0]}';
      delete from fee_balances where student_id='${ids[0]}';
      delete from audit_events; update students set id='00000000-0000-4000-8000-000000000099' where id='${ids[0]}';
      insert into fee_payments values('00000000-0000-4000-8000-000000000099',2026);
      insert into fee_balances values('${ids[0]}','00000000-0000-4000-8000-000000000099',2026);
      insert into fee_payment_requests values('${ids[0]}','${ids[0]}',jsonb_build_object('student_id','00000000-0000-4000-8000-000000000099','year',2026))`)
    await unchangedAfterFailure(db)
  } finally { await db.close() }
})
test('reporting guard failure rolls back payments and their audit events', async () => {
  const db = await fixture()
  try {
    await db.exec(`create function report_guard() returns trigger language plpgsql as $$ begin raise exception 'Reporting period closed'; end $$;
      create trigger report_guard before delete on academic_records for each row execute function report_guard()`)
    await unchangedAfterFailure(db)
  } finally { await db.close() }
})
