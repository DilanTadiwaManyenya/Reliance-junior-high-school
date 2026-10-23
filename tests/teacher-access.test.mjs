import { PGlite } from '@electric-sql/pglite'
import { readFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
import { test } from 'node:test'

test('Class teachers access the assigned form or stream within their campus only', async () => {
  const db = new PGlite()
  try {
    await db.exec(`
      create role authenticated;
      create role anon;
      create schema auth;
      create function auth.uid() returns uuid language sql as $$select '11111111-1111-4111-8111-111111111111'::uuid$$;
      create function has_active_role(text) returns boolean language sql as $$select current_setting('test.role',true) = $1$$;
      create table profiles(id uuid, campus text);
      create table teacher_class_assignments(teacher_id uuid, campus text, class_level text, class_stream text);
      create table students(id uuid, campus text, class_level text, class_stream text);
      insert into profiles values(auth.uid(),'senior');
      insert into teacher_class_assignments values(auth.uid(),'senior','Form 1','');
      insert into students values
        ('22222222-2222-4222-8222-222222222222','senior','Form 1','Blue'),
        ('33333333-3333-4333-8333-333333333333','senior','Form 1','Green'),
        ('44444444-4444-4444-8444-444444444444','junior','Form 1','Blue'),
        ('55555555-5555-4555-8555-555555555555','senior','Form 2','Blue');
      select set_config('test.role','teacher',false);
    `)
    await db.exec(await readFile(new URL('../supabase/migrations/20261015100000_allow_whole_form_class_teachers.sql', import.meta.url), 'utf8'))
    const access = async () => (await db.query('select teacher_owns_student(id) allowed from students order by id')).rows.map(row => row.allowed)
    assert.deepEqual(await access(), [true, true, false, false])
    await db.exec("update teacher_class_assignments set class_stream = 'Blue'")
    assert.deepEqual(await access(), [true, false, false, false])
    await db.exec("insert into teacher_class_assignments values(auth.uid(),'senior','Form 1','Green'),(auth.uid(),'senior','Form 2','Blue')")
    assert.deepEqual(await access(), [true, true, false, true])
    await db.exec("delete from teacher_class_assignments where class_stream = 'Green' or class_level = 'Form 2'")
    await db.exec("select set_config('test.role','principal',false)")
    assert.deepEqual(await access(), [false, false, false, false])
    await db.exec("select set_config('test.role','teacher',false); update profiles set campus='junior'")
    assert.deepEqual(await access(), [false, false, false, false])
    await db.exec("update teacher_class_assignments set campus='junior', class_stream=''; update students set campus='junior'")
    assert.deepEqual(await access(), [false, false, false, false])
    await db.exec("update students set class_stream=null where id='22222222-2222-4222-8222-222222222222'")
    assert.deepEqual(await access(), [true, false, false, false])
    assert.equal((await db.query("select has_function_privilege('anon','teacher_owns_student(uuid)','execute') allowed")).rows[0].allowed, false)
  } finally { await db.close() }
})
