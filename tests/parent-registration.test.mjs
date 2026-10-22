import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { normalizeParentLearnerDetails } from '../shared/parentRegistration.js'

test('parent learner verification canonicalizes admission number and typed DOB before database lookup', () => {
  assert.deepEqual(normalizeParentLearnerDetails(' 26F600 ', '15/06/2012'), {
    admissionNumber: '26f600',
    dateOfBirth: '2012-06-15',
  })
  assert.deepEqual(normalizeParentLearnerDetails('26EA01', '15062012'), {
    admissionNumber: '26eA01',
    dateOfBirth: '2012-06-15',
  })
  assert.deepEqual(normalizeParentLearnerDetails(' 123456 ', '2012-06-15'), {
    admissionNumber: '123456',
    dateOfBirth: '2012-06-15',
  })
})

test('parent learner verification rejects malformed IDs, wildcards, impossible and future DOBs', () => {
  assert.equal(normalizeParentLearnerDetails('26f6%', '15/06/2012'), null)
  assert.equal(normalizeParentLearnerDetails('26f600', '31/02/2012'), null)
  assert.equal(normalizeParentLearnerDetails('26f600', '01/01/2999'), null)
})

test('parent account support returns only each assigned campus and keeps unmatched records for Main Admin', async () => {
  const db = new PGlite()
  try {
    await db.exec(`
      create role anon; create role authenticated;
      create schema auth;
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.user_id', true), '')::uuid $$;
      create table public.profiles(id uuid primary key, full_name text, role text, active_role text, campus text);
      create table public.students(id uuid primary key, full_name text, admission_number text, date_of_birth date, class_level text, class_stream text, campus text);
      create table public.parent_accounts(user_id uuid primary key, phone_number text, child_admission_number text, verified boolean, verified_at timestamptz);
      create table public.parent_student(parent_id uuid, student_id uuid);
      alter table public.parent_accounts enable row level security;
      create function public.portal_mfa_satisfied() returns boolean language sql stable as $$ select true $$;
      create function public.has_active_role(expected text) returns boolean language sql stable security definer as $$ select exists(select 1 from profiles where id=auth.uid() and active_role=expected) $$;
      create function public.is_main_school_admin() returns boolean language sql stable security definer as $$ select exists(select 1 from profiles where id=auth.uid() and role='admin' and active_role='admin' and campus='all') $$;
      create function public.can_read_school_campus(target text) returns boolean language sql stable security definer as $$ select exists(select 1 from profiles where id=auth.uid() and role='admin' and active_role='admin' and campus in ('all',target)) $$;
      create function public.accountant_can_access_campus(target text) returns boolean language sql stable security definer as $$ select exists(select 1 from profiles where id=auth.uid() and role='accountant' and active_role='accountant' and campus=target) $$;
    `)
    const migration = await readFile(new URL('../supabase/migrations/20261022180000_parent_account_support.sql', import.meta.url), 'utf8')
    await db.exec(migration)
    const detailsMigration = await readFile(new URL('../supabase/migrations/20261022200000_parent_signin_registration_details.sql', import.meta.url), 'utf8')
    await db.exec(detailsMigration)
    await db.exec(`
      insert into profiles values
        ('11111111-1111-4111-8111-111111111111','Main Admin','admin','admin','all'),
        ('22222222-2222-4222-8222-222222222222','Senior Admin','admin','admin','senior'),
        ('33333333-3333-4333-8333-333333333333','Junior Accountant','accountant','accountant','junior'),
        ('44444444-4444-4444-8444-444444444444','Teacher','teacher','teacher','junior'),
        ('55555555-5555-4555-8555-555555555555','Senior Parent','parent','parent','senior'),
        ('66666666-6666-4666-8666-666666666666','Junior Parent','parent','parent','junior'),
        ('77777777-7777-4777-8777-777777777777','Unmatched Parent','parent','parent','all');
      insert into students values
        ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Senior Learner','26f601','2010-06-15','Form 1','Blue','senior'),
        ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','Junior Learner','26eA01','2020-02-03','ECD A',null,'junior'),
        ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','Second Senior Learner','26f602','2011-07-16','Form 1','Blue','senior');
      insert into parent_accounts values
        ('55555555-5555-4555-8555-555555555555','+263771111111','26F601',true,now()),
        ('66666666-6666-4666-8666-666666666666','+263772222222','26eA01',true,now()),
        ('77777777-7777-4777-8777-777777777777','+263773333333','NO-LEARNER',false,null);
      insert into parent_student values
        ('55555555-5555-4555-8555-555555555555','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
        ('55555555-5555-4555-8555-555555555555','cccccccc-cccc-4ccc-8ccc-cccccccccccc'),
        ('66666666-6666-4666-8666-666666666666','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
    `)
    const accountsFor = async id => {
      await db.query('select set_config($1,$2,false)', ['test.user_id', id])
      return (await db.query('select * from public.parent_account_support()')).rows
    }
    assert.deepEqual((await accountsFor('11111111-1111-4111-8111-111111111111')).map(row => row.parent_user_id).sort(), [
      '55555555-5555-4555-8555-555555555555', '66666666-6666-4666-8666-666666666666', '77777777-7777-4777-8777-777777777777',
    ])
    const senior = await accountsFor('22222222-2222-4222-8222-222222222222')
    assert.equal(senior.length, 1)
    assert.equal(senior[0].learner_name, 'Senior Learner')
    assert.equal(new Date(senior[0].learner_date_of_birth).toISOString().slice(0, 10), '2010-06-15')
    assert.equal(senior[0].child_admission_number, '26F601')
    const junior = await accountsFor('33333333-3333-4333-8333-333333333333')
    assert.equal(junior.length, 1)
    assert.equal(junior[0].learner_name, 'Junior Learner')
    assert.equal(new Date(junior[0].learner_date_of_birth).toISOString().slice(0, 10), '2020-02-03')
    await db.query('select set_config($1,$2,false)', ['test.user_id', '44444444-4444-4444-8444-444444444444'])
    await assert.rejects(db.query('select * from public.parent_account_support()'), /Parent account support access required/)
  } finally {
    await db.close()
  }
})
