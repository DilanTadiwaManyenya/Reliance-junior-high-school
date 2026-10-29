import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { PGlite } from '@electric-sql/pglite'
import { subjectIdentityKey } from '../src/lib/subjectLabels.js'

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8')
const migration = 'supabase/migrations/20261029110000_canonical_subject_catalog_foundation.sql'
const reportMigration = 'supabase/migrations/20261029100000_reviewed_current_report_context_capture.sql'
const catalogManagementMigration = 'supabase/migrations/20261029120000_expand_subject_catalog_and_management.sql'
const uid = '70000000-0000-4000-8000-000000000001'
const learnerId = '70000000-0000-4000-8000-000000000101'

test('report subject labels reconcile confirmed Senior aliases without changing Junior labels', () => {
  const senior = { campus: 'senior', class_level: 'Form 2' }
  const junior = { campus: 'junior', class_level: 'Grade 1' }
  assert.equal(subjectIdentityKey('Shona', senior), subjectIdentityKey('Chishona', senior))
  assert.equal(subjectIdentityKey('English', senior), subjectIdentityKey('English Language', senior))
  assert.equal(subjectIdentityKey('Heritage', senior), subjectIdentityKey('Heritage Studies', senior))
  assert.notEqual(subjectIdentityKey('Shona', junior), subjectIdentityKey('Chishona', junior))
})

test('canonical subject migration maps confirmed aliases and preserves legacy labels', async () => {
  const db = new PGlite()
  try {
    await db.exec(await read('tests/fixtures/security-rpc/schema.sql'))
    await db.exec(await read('tests/fixtures/security-rpc/baseline.sql'))
    await db.exec(`
      create function public.portal_mfa_satisfied() returns boolean language sql stable as $$select true$$;
      insert into teacher_class_subject_assignments(teacher_id,campus,class_level,class_stream,subject)
      values ('${uid}','senior','Form 2','','Shona'),('${uid}','senior','Form 2','','English'),('${uid}','senior','Form 2','','Heritage'),
        ('${uid}','junior','Grade 1','','Shona');
    `)
    const sql = await read(migration)
    await db.exec(sql)
    await db.exec(sql)
    const rows = (await db.query(`
      select a.subject, s.subject_code, s.display_name
      from teacher_class_subject_assignments a join subject_catalog s on s.id=a.subject_id
      order by a.subject
    `)).rows
    assert.deepEqual(rows, [
      { subject: 'English', subject_code: 'english_language', display_name: 'English Language' },
      { subject: 'Heritage', subject_code: 'heritage_studies', display_name: 'Heritage Studies' },
      { subject: 'Shona', subject_code: 'chishona', display_name: 'Chishona' },
    ])
    assert.equal((await db.query("select normalize_subject_label('English Language') as label")).rows[0].label, 'englishlanguage')
    assert.equal((await db.query('select count(*)::int as count from curriculum_subject_groups')).rows[0].count, 11)
    assert.equal((await db.query("select subject_id from teacher_class_subject_assignments where campus='junior' and subject='Shona'")).rows[0].subject_id, null)
  } finally {
    await db.close()
  }
})

test('expanded curriculum catalog is complete and guarded edits preserve allocation identity', async () => {
  const db = new PGlite()
  try {
    await db.exec(await read('tests/fixtures/security-rpc/schema.sql'))
    await db.exec(await read('tests/fixtures/security-rpc/baseline.sql'))
    await db.exec(`
      create function public.portal_mfa_satisfied() returns boolean language sql stable as $$select true$$;
      create function public.report_rules_baseline(p_level text,p_stream text) returns jsonb language sql immutable as $$select '{"subjects":["Legacy subject"],"grading_scale":[]}'::jsonb$$;
      create table public.grade_bands(band_group text,grade text,points int,description text,minimum_score int);
      alter table teacher_class_subject_assignments add column id uuid default gen_random_uuid();
      create table teacher_subject_assignments(id uuid primary key default gen_random_uuid(),teacher_id uuid,subject text,form_level text);
      insert into teacher_class_subject_assignments(teacher_id,campus,class_level,class_stream,subject)
      values ('${uid}','senior','Form 2','Green','Shona');
      insert into profiles(id,full_name,role,active_role,campus) values('${uid}','Main Admin','admin','admin','all');
      insert into user_roles(user_id,role) values('${uid}','admin');
      select set_config('test.uid','${uid}',false);
    `)
    await db.exec(await read(migration))
    await db.exec(await read(catalogManagementMigration))
    assert.equal((await db.query('select count(*)::int as count from curriculum_subject_groups')).rows[0].count, 11)
    assert.ok((await db.query('select count(*)::int as count from subject_catalog')).rows[0].count >= 35)
    const chishonaId = (await db.query("select id from subject_catalog where subject_code='chishona'")).rows[0].id
    assert.equal((await db.query('select subject_id from teacher_class_subject_assignments')).rows[0].subject_id, chishonaId)
    const initialReportRules = (await db.query("select report_rules_for_new_period('Form 2','Green') as rules")).rows[0].rules
    assert.ok(initialReportRules.subjects.includes('Chishona'))
    assert.ok(!initialReportRules.subjects.includes('Legacy subject'))
    await assert.rejects(
      db.query('select delete_unused_subject_catalog_entry($1)', [chishonaId]),
      /still has teacher allocations/,
    )
    await db.query('select save_subject_catalog_entry($1,$2,$3,$4)', [chishonaId, 'chishona', 'IsiNdebele', ['form_1_2_zgc']])
    const assignment = (await db.query('select subject,subject_id from teacher_class_subject_assignments')).rows[0]
    assert.equal(assignment.subject, 'IsiNdebele')
    assert.equal(assignment.subject_id, chishonaId)
    const renamedReportRules = (await db.query("select report_rules_for_new_period('Form 2','Green') as rules")).rows[0].rules
    assert.ok(renamedReportRules.subjects.includes('IsiNdebele'))
    await db.exec(`insert into teacher_subject_assignments(teacher_id,subject,form_level) values('${uid}','Shona','Form 2'); delete from teacher_class_subject_assignments;`)
    await assert.rejects(
      db.query('select delete_unused_subject_catalog_entry($1)', [chishonaId]),
      /legacy teacher allocations/,
    )
    await db.query('select set_subject_catalog_active($1,false)', [chishonaId])
    assert.equal((await db.query('select is_active from subject_catalog where id=$1', [chishonaId])).rows[0].is_active, false)
  } finally {
    await db.close()
  }
})

test('reviewed current report capture is campus-scoped, explicit, and audited', async () => {
  const db = new PGlite()
  try {
    await db.exec(await read('tests/fixtures/security-rpc/schema.sql'))
    await db.exec(`
      create function public.portal_mfa_satisfied() returns boolean language sql stable as $$select current_setting('test.mfa',true)='on'$$;
      create function public.has_active_role(expected_role text) returns boolean language sql stable as $$select expected_role='admin'$$;
      create function public.can_manage_school_campus(target text) returns boolean language sql stable as $$select target='senior'$$;
      create function public.report_staff_snapshot(text,text,text) returns jsonb language sql stable as $$select '{"class_teacher":null,"subject_teachers":[]}'::jsonb$$;
      create function public.report_rules_for_new_period(text,text) returns jsonb language sql stable as $$select '{"subjects":["English Language"]}'::jsonb$$;
      create table report_period_contexts(
        id uuid primary key default gen_random_uuid(), student_id uuid not null, academic_year int not null,
        term int not null, campus text not null, class_level text not null, class_stream text,
        learner_name text not null, admission_number text not null, enrolled_year int not null,
        active_when_captured boolean not null, class_teacher jsonb, subject_teachers jsonb not null,
        report_rules jsonb not null, provenance text not null, confirmed_at timestamptz,
        confirmed_by uuid, confirmation_reason text, staffing_verified_at timestamptz,
        unique(student_id,academic_year,term)
      );
      create table school_record_changes(
        id uuid primary key default gen_random_uuid(), source_table text, record_id uuid, operation text,
        actor_id uuid, actor_name text not null, actor_role text not null, learner_id uuid,
        learner_name text, campus text, previous_campus text, context jsonb, old_values jsonb,
        new_values jsonb, changed_fields text[] not null
      );
      insert into profiles(id,full_name,role,active_role,campus) values('${uid}','Campus Admin','admin','admin','senior');
      insert into students(id,full_name,admission_number,campus,class_level,class_stream,enrolled_year,status)
      values('${learnerId}','Learner One','26f269','senior','Form 2','Green',2026,'active');
      insert into students(id,full_name,admission_number,campus,class_level,class_stream,enrolled_year,status)
      values('70000000-0000-4000-8000-000000000102','Learner Two','26g010','junior','Grade 1','',2026,'active');
      select set_config('test.uid','${uid}',false), set_config('test.mfa','on',false);
    `)
    await db.exec(await read(reportMigration))
    const year = new Date().getFullYear()
    const context = (await db.query(
      'select capture_reviewed_current_report_context($1,$2,3,$3) as id',
      [learnerId, year, 'Verified against the current class register'],
    )).rows[0].id
    const row = (await db.query('select * from report_period_contexts where id=$1', [context])).rows[0]
    assert.equal(row.student_id, learnerId)
    assert.equal(row.class_level, 'Form 2')
    assert.equal(row.class_stream, 'Green')
    assert.equal(row.confirmed_by, uid)
    assert.equal(row.provenance, 'captured')
    assert.equal((await db.query("select operation from school_record_changes where record_id=$1", [context])).rows[0].operation, 'INSERT')
    await db.query("select set_config('test.mfa','off',false)")
    await assert.rejects(
      db.query('select capture_reviewed_current_report_context($1,$2,2,$3)', ['70000000-0000-4000-8000-000000000102', year, 'Verified against the current class register']),
      /Verified administrator access/,
    )
    await db.query("select set_config('test.mfa','on',false)")
    await assert.rejects(
      db.query('select capture_reviewed_current_report_context($1,$2,2,$3)', ['70000000-0000-4000-8000-000000000102', year, 'Verified against the current class register']),
      /outside your campus authority/,
    )
    await assert.rejects(
      db.query('select capture_reviewed_current_report_context($1,$2,3,$3)', [learnerId, year, 'Verified against the current class register']),
      /already exists/,
    )
  } finally {
    await db.close()
  }
})
