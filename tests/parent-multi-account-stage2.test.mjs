import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'

const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`

test('parent learner links enforce one parent per learner and allow several learners per parent', async () => {
  const db = new PGlite()
  try {
    await db.exec(`
      create role anon; create role authenticated;
      create schema auth;
      create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$
        select nullif(current_setting('test.user_id', true), '')::uuid
      $$;
      create table public.profiles(
        id uuid primary key references auth.users(id) on delete cascade,
        full_name text not null,
        role text not null,
        active_role text not null,
        campus text not null,
        is_protected boolean not null default false
      );
      create table public.user_roles(
        user_id uuid not null references public.profiles(id) on delete cascade,
        role text not null,
        primary key(user_id, role)
      );
      create table public.students(
        id uuid primary key,
        admission_number text unique not null,
        date_of_birth date not null
      );
      create table public.parent_accounts(
        user_id uuid primary key references auth.users(id) on delete cascade,
        phone_number text not null
      );
      create table public.parent_student(
        id uuid primary key default gen_random_uuid(),
        parent_id uuid not null references public.profiles(id) on delete cascade,
        student_id uuid not null references public.students(id) on delete cascade,
        verified_at timestamptz,
        unique(parent_id, student_id)
      );
      create table public.parent_uniform_orders(
        id uuid primary key default gen_random_uuid(),
        parent_id uuid not null references public.profiles(id) on delete cascade
      );
      create table public.audit_logs(
        id uuid primary key default gen_random_uuid(),
        actor_id uuid references public.profiles(id),
        actor_role text,
        action_type text not null,
        description text,
        target_table text,
        target_id uuid,
        metadata jsonb,
        created_at timestamptz not null default now()
      );
      create function public.portal_mfa_satisfied() returns boolean language sql stable as $$ select true $$;
      create function public.has_active_role(expected_role text) returns boolean language sql stable security definer as $$
        select exists(select 1 from public.user_roles where user_id=auth.uid() and role=expected_role)
      $$;
      create function public.is_main_school_admin() returns boolean language sql stable security definer as $$
        select exists(select 1 from public.profiles p join public.user_roles r on r.user_id=p.id
          where p.id=auth.uid() and p.active_role='admin' and p.campus='all' and r.role='admin')
      $$;
    `)

    const migration = await readFile(new URL('../supabase/migrations/20261028100000_parent_multi_learner_controls.sql', import.meta.url), 'utf8')
    await db.exec(migration)

    await db.exec(`
      insert into auth.users(id) values ('${id(1)}'),('${id(2)}'),('${id(3)}');
      insert into public.profiles(id,full_name,role,active_role,campus) values
        ('${id(1)}','Main Admin','admin','admin','all'),
        ('${id(2)}','Parent One','parent','parent','all'),
        ('${id(3)}','Parent Two','parent','parent','all');
      insert into public.user_roles values ('${id(1)}','admin'),('${id(2)}','parent'),('${id(3)}','parent');
      insert into public.parent_accounts values ('${id(2)}','+263770000002'),('${id(3)}','+263770000003');
      insert into public.students values
        ('${id(101)}','26f101','2010-01-01'),
        ('${id(102)}','26f102','2011-02-02'),
        ('${id(103)}','26f103','2012-03-03');
    `)

    await db.query('select set_config($1,$2,false)', ['test.user_id', id(2)])
    assert.equal((await db.query('select public.request_parent_student_link($1,$2) as linked', ['26f101', '2010-01-01'])).rows[0].linked, true)
    assert.equal((await db.query('select public.request_parent_student_link($1,$2) as linked', ['26f102', '2011-02-02'])).rows[0].linked, true)
    assert.equal((await db.query('select count(*)::int as total from public.parent_student where parent_id=$1', [id(2)])).rows[0].total, 2)

    await db.query('update public.parent_student set verified_at=now() where parent_id=$1 and student_id=$2', [id(2), id(101)])
    assert.equal((await db.query('select public.request_parent_student_link($1,$2) as linked', ['26f101', '2010-01-01'])).rows[0].linked, true)
    assert.ok((await db.query('select verified_at from public.parent_student where parent_id=$1 and student_id=$2', [id(2), id(101)])).rows[0].verified_at)

    await db.query('select set_config($1,$2,false)', ['test.user_id', id(3)])
    await assert.rejects(
      db.query('select public.request_parent_student_link($1,$2)', ['26f101', '2010-01-01']),
      /already linked to a parent account/,
    )
    await assert.rejects(
      db.query('insert into public.parent_student(parent_id,student_id) values($1,$2)', [id(3), id(101)]),
      /parent_student_one_parent_per_student_idx/,
    )

    await db.exec(`insert into public.audit_logs(actor_id,actor_role,action_type,description) values
      ('${id(2)}','parent','page_view','parent event one'),
      ('${id(2)}','parent','page_view','parent event two'),
      ('${id(3)}','parent','page_view','parent event three');`)
    await db.query('select set_config($1,$2,false)', ['test.user_id', id(3)])
    await db.exec(`insert into public.parent_uniform_orders(parent_id) values ('${id(3)}');`)
    await db.query('select set_config($1,$2,false)', ['test.user_id', id(1)])
    await assert.rejects(db.query('select public.delete_parent_account($1)', [id(3)]), /uniform-order history/)
    assert.equal((await db.query('select count(*)::int as total from public.parent_accounts where user_id=$1', [id(3)])).rows[0].total, 1)
    await db.exec('delete from public.parent_uniform_orders;')

    await db.query('select set_config($1,$2,false)', ['test.user_id', id(2)])
    await assert.rejects(db.query('select public.delete_parent_account($1)', [id(3)]), /verified Main Admin/)
    await db.query('select set_config($1,$2,false)', ['test.user_id', id(1)])
    assert.equal((await db.query('select public.delete_parent_account($1) as anonymized', [id(2)])).rows[0].anonymized, 2)
    assert.equal((await db.query('select count(*)::int as total from public.audit_logs')).rows[0].total, 4)
    assert.equal((await db.query('select count(*)::int as total from public.audit_logs where actor_id=$1', [id(2)])).rows[0].total, 0)
    assert.equal((await db.query('select count(*)::int as total from public.parent_accounts where user_id=$1', [id(2)])).rows[0].total, 0)
    assert.equal((await db.query('select count(*)::int as total from public.parent_student where parent_id=$1', [id(2)])).rows[0].total, 0)
    assert.equal((await db.query('select count(*)::int as total from public.students')).rows[0].total, 3)
  } finally {
    await db.close()
  }
})

test('parent registration checks existing learner ownership before creating an Auth user', async () => {
  const source = await readFile(new URL('../supabase/functions/register-parent/index.ts', import.meta.url), 'utf8')
  const ownershipCheck = source.indexOf(".from('parent_student')")
  const createUser = source.indexOf('serviceClient.auth.admin.createUser')
  assert.ok(ownershipCheck >= 0 && ownershipCheck < createUser)
  assert.match(source, /This learner is already linked to a parent account/)
})
