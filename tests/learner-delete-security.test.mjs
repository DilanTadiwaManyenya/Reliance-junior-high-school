import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { PGlite } from '@electric-sql/pglite'

const migration = () => readFile(new URL('../supabase/migrations/20261023100000_allow_campus_admin_learner_delete.sql', import.meta.url), 'utf8')
const id = value => `00000000-0000-4000-8000-${String(value).padStart(12, '0')}`

test('learner deletion is available to campus admins only within their campus and keeps protected history', async () => {
  const db = new PGlite()
  try {
    await db.exec(`
      create role anon;
      create role authenticated;
      create schema auth;
      create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
      create table profiles(id uuid primary key, campus text not null);
      create table user_roles(user_id uuid not null, role text not null);
      create table students(id uuid primary key, campus text not null, status text not null, inactive_reason text, record_disable_reason text);
      create table fee_payments(student_id uuid not null);
      create table pos_sales(student_id uuid not null);
      create table parent_uniform_orders(student_id uuid not null);
      create table year_rollover_entries(student_id uuid not null);
      create table report_period_contexts(student_id uuid not null);
      create function has_active_role(target_role text) returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from user_roles where user_id=auth.uid() and role=target_role) $$;
      create function portal_mfa_satisfied() returns boolean language sql stable security definer set search_path=public as $$ select coalesce(current_setting('test.mfa', true), 'true') = 'true' $$;
      create function can_manage_school_campus(target_campus text) returns boolean language sql stable security definer set search_path=public as $$ select has_active_role('admin') and exists(select 1 from profiles where id=auth.uid() and campus in ('all', target_campus)) $$;
      grant usage on schema public, auth to authenticated, anon;
      grant select, insert, update, delete on students to authenticated;
    `)
    await db.query('insert into profiles values ($1,$2),($3,$4),($5,$6)', [id(1), 'all', id(2), 'junior', id(3), 'senior'])
    await db.query('insert into user_roles values ($1,$2),($3,$4),($5,$6),($7,$8)', [id(1), 'admin', id(2), 'admin', id(3), 'admin', id(4), 'teacher'])
    await db.exec(`
      insert into profiles values ('${id(4)}','junior');
      insert into students values ('${id(101)}','junior','active',null,null),('${id(102)}','senior','active',null,null),('${id(103)}','junior','inactive','old reason','old reason'),('${id(104)}','junior','active',null,null);
      insert into fee_payments values ('${id(104)}');
      insert into report_period_contexts values ('${id(101)}'),('${id(104)}');
    `)
    await db.exec(await migration())
    await db.exec('select set_config(\'test.mfa\',\'true\',false)')
    const act = async userId => {
      await db.exec('reset role')
      await db.query("select set_config('test.uid',$1,false)", [userId ? id(userId) : ''])
      await db.exec('set role authenticated')
    }
    await act(2)
    await db.query("select public.manage_disabled_learner($1,'delete',$2)", [id(101), 'Incorrect class placement'])
    await assert.rejects(db.query("select public.manage_disabled_learner($1,'delete',$2)", [id(102), 'Wrong campus placement']), /Campus administrator access is required to delete this learner/)
    await assert.rejects(db.query("select public.manage_disabled_learner($1,'delete',$2)", [id(104), 'Remove linked history']), /fee payment history/)
    await assert.rejects(db.query("select public.manage_disabled_learner($1,'delete',$2)", [id(103), 'no']), /at least five characters/)
    await db.exec('reset role')
    assert.equal((await db.query('select count(*)::int as n from students where id=$1', [id(101)])).rows[0].n, 0, 'campus admin deletion should remove the corrected learner')
    assert.equal((await db.query('select count(*)::int as n from report_period_contexts where student_id=$1', [id(101)])).rows[0].n, 0, 'learner report snapshots should be removed with an allowed deletion')
    assert.equal((await db.query('select count(*)::int as n from students where id=$1', [id(104)])).rows[0].n, 1, 'financial history must keep the learner record')
    await act(4)
    await assert.rejects(db.query("select public.manage_disabled_learner($1,'delete',$2)", [id(103), 'Teacher should not delete']), /Campus administrator access is required/)
    await act(1)
    await db.query("select public.manage_disabled_learner($1,'delete',$2)", [id(102), 'Main admin correction'])
    await db.exec('reset role')
    assert.equal((await db.query('select count(*)::int as n from students where id=$1', [id(102)])).rows[0].n, 0, 'Main Admin should retain school-wide deletion scope')
  } finally {
    await db.close()
  }
})
