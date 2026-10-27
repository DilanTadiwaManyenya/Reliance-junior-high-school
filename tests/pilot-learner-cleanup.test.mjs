import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { PGlite } from '@electric-sql/pglite'
const sql = await readFile(new URL('../supabase/maintenance/20261027_remove_confirmed_pilot_learners.sql', import.meta.url), 'utf8')
async function fixture() {
  const db = new PGlite()
  await db.exec(`
    create table students(id integer primary key, admission_number text unique, full_name text, campus text, class_level text, class_stream text, enrolled_year integer, status text);
    insert into students values
      (1,'F1-2026-032','ANGEL MUSHANYUKI','senior','Form 1','White',2026,'inactive'),
      (2,'F1-2026-039','ANDREW DUBE','senior','Form 1','White',2026,'inactive'),
      (3,'F1-2026-046','ALBERT MVURA','senior','Form 1','White',2026,'inactive'),
      (4,'UNRELATED','Unrelated fixture','senior','Form 1','White',2026,'active');
    create table fee_payments(student_id integer references students(id) on delete cascade, academic_year integer);
    insert into fee_payments values (1,2026),(2,2026),(3,2026),(4,2026);
    create table audit_events(student_id integer);
    create function audit_payment() returns trigger language plpgsql as $$ begin insert into audit_events values(old.student_id); return old; end $$;
    create trigger payment_audit after delete on fee_payments for each row execute function audit_payment();
  `)
  for (const table of ['pos_sales', 'parent_uniform_orders', 'year_rollover_entries', 'academic_records', 'junior_component_marks', 'junior_developmental_ratings', 'report_card_comments', 'coursework_marks', 'report_period_contexts']) {
    await db.exec(`create table ${table}(student_id integer references students(id) on delete restrict)`)
  }
  await db.exec('insert into academic_records values(1); insert into report_period_contexts values(1)')
  return db
}
async function unchangedAfterFailure(db) {
  await assert.rejects(db.exec(sql))
  await db.exec('rollback')
  assert.equal((await db.query('select count(*)::int as n from students')).rows[0].n, 4)
  assert.equal((await db.query('select count(*)::int as n from fee_payments')).rows[0].n, 4)
  assert.equal((await db.query('select count(*)::int as n from audit_events')).rows[0].n, 0)
}
test('authorized pilot cleanup deletes exactly three learners and their payments, retains unrelated rows and audit', async () => {
  const db = await fixture()
  try {
    await db.exec(sql)
    assert.deepEqual((await db.query('select id from students')).rows, [{ id: 4 }])
    assert.deepEqual((await db.query('select student_id from fee_payments')).rows, [{ student_id: 4 }])
    assert.equal((await db.query('select count(*)::int as n from audit_events')).rows[0].n, 3)
    await assert.rejects(db.exec(sql))
    await db.exec('rollback')
    assert.deepEqual((await db.query('select id from students')).rows, [{ id: 4 }])
  } finally { await db.close() }
})
test('cleanup aborts for wrong learner scope and protected histories without partial writes', async () => {
  for (const setup of [
    "update students set status='active' where id=1",
    "update students set class_stream='Green' where id=1",
    "update students set full_name='Different learner' where id=1",
    'insert into pos_sales values(1)',
    'insert into parent_uniform_orders values(1)',
    'insert into year_rollover_entries values(1)',
    'update fee_payments set academic_year=2025 where student_id=1',
  ]) {
    const db = await fixture()
    try { await db.exec(setup); await unchangedAfterFailure(db) } finally { await db.close() }
  }
})
test('reporting guard failure rolls back payments and their audit events', async () => {
  const db = await fixture()
  try {
    await db.exec(`create function report_guard() returns trigger language plpgsql as $$ begin raise exception 'Reporting period closed'; end $$;
      create trigger report_guard before delete on academic_records for each row execute function report_guard()`)
    await unchangedAfterFailure(db)
  } finally { await db.close() }
})
