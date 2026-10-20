-- Learning library and newsletters foundation. Additive; no legacy role changes.
begin;

create table public.library_curriculum_subjects (
  class_level text not null, subject text not null,
  primary key(class_level,subject)
);
insert into public.library_curriculum_subjects
select level,subject from unnest(array['ECD A','ECD B']) level
cross join unnest(array['English Languages','Indigenous Languages','Mathematics & Science (1)','Mathematics & Science (2)','Heritage & Science Studies (1)','Heritage & Science Studies (2)','Mass Display','Visual & Performing Arts','Physical Education','Computers (ICT)','Guidance & Counseling']) subject;
insert into public.library_curriculum_subjects
select level,subject from unnest(array['Grade 1','Grade 2']) level
cross join unnest(array['English','Shona','Mathematics','Social Science','Sciences & Technology, ICT','PE & Arts']) subject;
insert into public.library_curriculum_subjects
select level,subject from unnest(array['Grade 3','Grade 4','Grade 5','Grade 6','Grade 7']) level
cross join unnest(array['English Language','Shona Language','Mathematics','Social Science','Sciences & Technology, ICT','PE & Arts','Guidance & Counseling']) subject;

create table public.learning_resources (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null default auth.uid(),
  allocation_id uuid,
  campus text not null check(campus in ('junior','senior')),
  class_level text not null check(length(trim(class_level)) between 1 and 80),
  class_stream text not null default '' check(length(class_stream)<=80),
  subject text not null check(length(trim(subject)) between 1 and 160),
  academic_year integer not null check(academic_year between 2000 and 2200),
  term integer not null check(term between 1 and 3),
  title text not null check(length(trim(title)) between 1 and 200),
  description text not null default '' check(length(description)<=10000),
  state text not null default 'draft' check(state in ('draft','published','archived')),
  published_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check((campus='junior' and class_level ~ '^(ECD [AB]|Grade [1-7])$')
     or (campus='senior' and class_level ~ '^Form [1-6]$'))
);
comment on column public.learning_resources.teacher_id is
 'Immutable author ID retained after staff deletion; deliberately no cascading profile foreign key.';
comment on column public.learning_resources.allocation_id is
 'Immutable provenance, not an authorization grant. Allocations may be deleted/recreated; recheck current scope.';

create table if not exists public.announcements (
 id uuid primary key default gen_random_uuid(),
 title text not null check(length(trim(title)) between 1 and 200),
 body text not null default '' check(length(body)<=20000),
 category text not null default 'general' check(category in ('general','academic','attendance','event','urgent','newsletter')),
 audience text not null default 'all' check(audience in ('all','parents','staff','students')),
 campus text not null check(campus in ('junior','senior','all')),
 created_by uuid not null default auth.uid(),
 state text not null default 'draft' check(state in ('draft','published','archived')),
 published_at timestamptz, expires_at timestamptz, pinned boolean not null default false,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(expires_at is null or published_at is null or expires_at>published_at)
);
-- A fresh replay may already contain the legacy text-only announcement tables.
-- Existing legacy notices become private Main Admin drafts until explicitly targeted.
alter table public.announcements
 add column if not exists campus text not null default 'all' check(campus in ('junior','senior','all')),
 add column if not exists state text not null default 'draft' check(state in ('draft','published','archived')),
 add column if not exists published_at timestamptz,
 add column if not exists expires_at timestamptz,
 add column if not exists pinned boolean not null default false,
 add column if not exists updated_at timestamptz not null default now();
alter table public.announcements alter column campus drop default;
alter table public.announcements drop constraint if exists announcements_category_check;
alter table public.announcements add constraint announcements_category_check
 check(category in ('general','academic','attendance','event','urgent','newsletter'));
drop policy if exists "Users can select announcements for their audience" on public.announcements;
drop policy if exists "Staff and admins can insert announcements" on public.announcements;
create table public.announcement_targets (
 id uuid primary key default gen_random_uuid(),
 announcement_id uuid not null references public.announcements(id),
 campus text not null check(campus in ('junior','senior')),
 class_level text not null default '', class_stream text not null default '',
 unique(announcement_id,campus,class_level,class_stream),
 check(class_stream='' or class_level<>''),
 check(class_level='' or (campus='junior' and class_level ~ '^(ECD [AB]|Grade [1-7])$')
   or (campus='senior' and class_level ~ '^Form [1-6]$'))
);
create table if not exists public.announcement_reads (
 id uuid primary key default gen_random_uuid(),
 announcement_id uuid not null references public.announcements(id),
 user_id uuid not null default auth.uid(), read_at timestamptz not null default now(),
 unique(announcement_id,user_id)
);
alter table public.announcement_reads alter column user_id set default auth.uid();
drop policy if exists "Users can select their own announcement reads" on public.announcement_reads;
drop policy if exists "Users can insert their own announcement reads" on public.announcement_reads;

create table public.portal_content_files (
 id uuid primary key default gen_random_uuid(),
 resource_id uuid references public.learning_resources(id),
 announcement_id uuid references public.announcements(id),
 bucket_id text generated always as
   (case when resource_id is not null then 'learning-library' else 'school-newsletters' end) stored,
 extension text not null check(extension in ('pdf','doc','docx','ppt','pptx','jpg','jpeg','png','webp')),
 original_name text not null check(length(original_name) between 1 and 240),
 mime_type text not null,
 size_bytes bigint not null check(size_bytes between 1 and 10485760),
 uploaded_by uuid not null default auth.uid(),
 created_at timestamptz not null default now(),
 ready boolean not null default false, active boolean not null default false,
 object_path text generated always as
   (coalesce(resource_id,announcement_id)::text||'/'||id::text||'.'||extension) stored,
 check(num_nonnulls(resource_id,announcement_id)=1),
 check(not active or ready),
 check((extension='pdf' and mime_type='application/pdf')
   or (extension='doc' and mime_type='application/msword')
   or (extension='docx' and mime_type='application/vnd.openxmlformats-officedocument.wordprocessingml.document')
   or (extension='ppt' and mime_type='application/vnd.ms-powerpoint')
   or (extension='pptx' and mime_type='application/vnd.openxmlformats-officedocument.presentationml.presentation')
   or (extension in ('jpg','jpeg') and mime_type='image/jpeg')
   or (extension='png' and mime_type='image/png')
   or (extension='webp' and mime_type='image/webp')),
 unique(bucket_id,object_path)
);
create unique index library_one_active_file on public.portal_content_files(resource_id) where active and resource_id is not null;
create unique index newsletter_one_active_file on public.portal_content_files(announcement_id) where active and announcement_id is not null;
create index library_scope_idx on public.learning_resources(campus,class_level,class_stream,academic_year,term,state,published_at desc);
create index library_teacher_idx on public.learning_resources(teacher_id,created_at desc);
create index newsletter_feed_idx on public.announcements(state,published_at desc);
create index newsletter_targets_scope_idx on public.announcement_targets(campus,class_level,class_stream,announcement_id);

create table public.portal_content_events (
 id uuid primary key default gen_random_uuid(),
 resource_id uuid, announcement_id uuid,
 campus text not null, actor_id uuid, actor_role text,
 source_table text not null, operation text not null,
 old_values jsonb, new_values jsonb, created_at timestamptz not null default clock_timestamp()
);
create index portal_content_events_scope_idx on public.portal_content_events(campus,created_at desc);

create function public.library_teacher_scope(p_teacher uuid,p_campus text,p_level text,p_stream text,p_subject text)
returns boolean language sql stable security definer set search_path=public as $$
 select public.has_active_role('teacher') and p_teacher=auth.uid()
 and exists(select 1 from public.profiles where id=auth.uid() and campus=p_campus and portal_access_enabled is distinct from false)
 and public.teacher_has_coursework_allocation(p_teacher,p_level,p_stream,p_subject)
 and (p_campus='senior' or exists(select 1 from public.library_curriculum_subjects where class_level=p_level and subject=p_subject));
$$;

create function public.library_parent_scope(p_campus text,p_level text,p_stream text)
returns boolean language sql stable security definer set search_path=public as $$
 select public.has_active_role('parent') and exists(
 select 1 from public.parent_student l join public.students s on s.id=l.student_id
 where l.parent_id=auth.uid() and l.verified_at is not null and s.status='active'
 and s.campus=p_campus and (p_level='' or s.class_level=p_level)
 and (p_stream='' or coalesce(s.class_stream,'')=p_stream));
$$;
create function public.can_manage_learning_resource(p_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.learning_resources r where r.id=p_id
 and public.library_teacher_scope(r.teacher_id,r.campus,r.class_level,r.class_stream,r.subject));
$$;
create function public.can_read_learning_resource(p_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
 select public.portal_mfa_satisfied() and exists(select 1 from public.learning_resources r where r.id=p_id and (
 public.can_read_school_campus(r.campus) or public.accountant_can_access_campus(r.campus)
 or public.can_manage_learning_resource(r.id)
 or (r.state='published' and r.published_at<=now()
   and public.library_parent_scope(r.campus,r.class_level,r.class_stream))));
$$;
create function public.can_manage_school_announcement(p_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.announcements a where a.id=p_id and
 (case when a.campus='all' then public.is_main_school_admin() else public.can_manage_school_campus(a.campus) end));
$$;
create function public.can_read_school_announcement(p_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
 select public.portal_mfa_satisfied() and exists(select 1 from public.announcements a where a.id=p_id and (
 public.can_manage_school_announcement(a.id)
 or (a.state='published' and a.published_at<=now() and (a.expires_at is null or a.expires_at>now())
 and exists(select 1 from public.announcement_targets t where t.announcement_id=a.id and (
   public.can_read_school_campus(t.campus) or public.accountant_can_access_campus(t.campus)
   or (a.audience in ('all','staff') and public.has_active_role('teacher') and exists(select 1 from public.profiles p where p.id=auth.uid() and p.campus=t.campus))
   or (a.audience in ('all','parents','students') and public.library_parent_scope(t.campus,t.class_level,t.class_stream))
 )))));
$$;

create function public.guard_portal_content()
returns trigger language plpgsql security definer set search_path=public as $$
begin
 if tg_table_name='learning_resources' then
   if tg_op='UPDATE' and row(new.teacher_id,new.allocation_id,new.campus,new.class_level,new.class_stream,new.subject,new.academic_year,new.term,new.created_at)
     is distinct from row(old.teacher_id,old.allocation_id,old.campus,old.class_level,old.class_stream,old.subject,old.academic_year,old.term,old.created_at)
     then raise exception 'Resource author and teaching scope are immutable'; end if;
   if not public.library_teacher_scope(new.teacher_id,new.campus,new.class_level,new.class_stream,new.subject)
     then raise exception 'A current teaching allocation is required'; end if;
   if new.allocation_id is not null and not exists(select 1 from public.teacher_class_subject_assignments a
     where a.id=new.allocation_id and a.teacher_id=new.teacher_id and a.campus=new.campus
       and a.class_level=new.class_level and a.class_stream=new.class_stream and a.subject=new.subject)
     and tg_op='INSERT' then raise exception 'Allocation reference does not match resource scope'; end if;
   if new.state='published' and not exists(select 1 from public.portal_content_files f where f.resource_id=new.id and f.ready and f.active)
     then raise exception 'Upload and finalize a file before publishing notes'; end if;
 else
   if tg_op='UPDATE' and row(new.created_by,new.campus,new.created_at) is distinct from row(old.created_by,old.campus,old.created_at)
     then raise exception 'Newsletter author and campus are immutable'; end if;
   if tg_op='INSERT' and new.created_by<>auth.uid() then raise exception 'Invalid newsletter author'; end if;
   if not (case when new.campus='all' then public.is_main_school_admin() else public.can_manage_school_campus(new.campus) end)
     then raise exception 'Only the assigned campus Admin may publish newsletters'; end if;
   if new.state='published' and not exists(select 1 from public.announcement_targets t where t.announcement_id=new.id)
     then raise exception 'Choose a newsletter audience before publishing'; end if;
 end if;
 new.updated_at:=now();
 if new.state='published' and new.published_at is null then new.published_at:=now(); end if;
 return new;
end;
$$;
create trigger guard_library before insert or update on public.learning_resources for each row execute function public.guard_portal_content();
create trigger guard_newsletter before insert or update on public.announcements for each row execute function public.guard_portal_content();

create function public.guard_announcement_target()
returns trigger language plpgsql security definer set search_path=public as $$
declare item public.announcements; row_target public.announcement_targets;
begin
 if tg_op='DELETE' then row_target:=old; else row_target:=new; end if;
 if tg_op='UPDATE' then raise exception 'Remove and add draft audience targets instead'; end if;
 select * into item from public.announcements where id=row_target.announcement_id for update;
 if item.state<>'draft' or not public.can_manage_school_announcement(item.id)
   or (item.campus<>'all' and item.campus<>row_target.campus)
   then raise exception 'Only draft audiences within your campus may be changed'; end if;
 return row_target;
end;
$$;
create trigger guard_newsletter_target before insert or update or delete on public.announcement_targets for each row execute function public.guard_announcement_target();

create function public.content_file_manage(p_resource uuid,p_announcement uuid)
returns boolean language sql stable security definer set search_path=public as $$
 select case when p_resource is not null then public.can_manage_learning_resource(p_resource)
 else public.can_manage_school_announcement(p_announcement) end;
$$;
create function public.content_file_read(p_resource uuid,p_announcement uuid)
returns boolean language sql stable security definer set search_path=public as $$
 select case when p_resource is not null then public.can_read_learning_resource(p_resource)
 else public.can_read_school_announcement(p_announcement) end;
$$;

create function public.finalize_portal_content_file(p_file_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare f public.portal_content_files; obj storage.objects;
begin
 select * into f from public.portal_content_files where id=p_file_id;
 if not found or not public.content_file_manage(f.resource_id,f.announcement_id) then raise exception 'File access denied'; end if;
 -- Serialize replacements through their parent, including concurrent finalizations.
 if f.resource_id is not null then perform 1 from public.learning_resources where id=f.resource_id for update;
 else perform 1 from public.announcements where id=f.announcement_id for update; end if;
 select * into f from public.portal_content_files where id=p_file_id for update;
 if f.ready then return; end if;
 select * into obj from storage.objects where bucket_id=f.bucket_id and name=f.object_path;
 if not found or (obj.metadata->>'size')::bigint is distinct from f.size_bytes
   or obj.metadata->>'mimetype' is distinct from f.mime_type then
   raise exception 'Stored file is missing or does not match its declared size and format'; end if;
 update public.portal_content_files set active=false where active and
   ((f.resource_id is not null and resource_id=f.resource_id) or (f.announcement_id is not null and announcement_id=f.announcement_id));
 update public.portal_content_files set ready=true,active=true where id=f.id;
end;
$$;

create function public.portal_storage_file_access(p_bucket text,p_path text,p_write boolean)
returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.portal_content_files f where f.bucket_id=p_bucket and f.object_path=p_path
 and case when p_write then not f.ready and f.uploaded_by=auth.uid() and public.content_file_manage(f.resource_id,f.announcement_id)
 else public.content_file_manage(f.resource_id,f.announcement_id)
   or (f.ready and f.active and public.content_file_read(f.resource_id,f.announcement_id)) end);
$$;

create function public.capture_portal_content_event()
returns trigger language plpgsql security definer set search_path=public as $$
declare b jsonb; a jsonb; d jsonb; r uuid; n uuid; scope text;
begin
 if tg_op<>'INSERT' then b:=to_jsonb(old); end if;
 if tg_op<>'DELETE' then a:=to_jsonb(new); end if;
 d:=coalesce(a,b);
 if tg_table_name='learning_resources' then r:=(d->>'id')::uuid; scope:=d->>'campus';
 elsif tg_table_name='announcements' then n:=(d->>'id')::uuid; scope:=d->>'campus';
 else
 r:=(d->>'resource_id')::uuid; n:=(d->>'announcement_id')::uuid;
 if r is not null then select campus into scope from public.learning_resources where id=r;
 else select campus into scope from public.announcements where id=n; end if;
 end if;
 insert into public.portal_content_events(resource_id,announcement_id,campus,actor_id,actor_role,source_table,operation,old_values,new_values)
 values(r,n,scope,auth.uid(),(select active_role from public.profiles where id=auth.uid()),tg_table_name,tg_op,b,a);
 return null;
end;
$$;
create trigger library_audit after insert or update on public.learning_resources for each row execute function public.capture_portal_content_event();
create trigger newsletter_audit after insert or update on public.announcements for each row execute function public.capture_portal_content_event();
create trigger newsletter_target_audit after insert or delete on public.announcement_targets for each row execute function public.capture_portal_content_event();
create trigger content_file_audit after insert or update on public.portal_content_files for each row execute function public.capture_portal_content_event();

-- Default-deny table access. Published files are immutable and only the finalizer can activate replacements.
do $policies$
declare t text;
begin
 foreach t in array array['library_curriculum_subjects','learning_resources','announcements','announcement_targets','announcement_reads','portal_content_files','portal_content_events'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from public,anon,authenticated',t);
 execute format('grant select on public.%I to authenticated',t);
 execute format('grant all on public.%I to service_role',t);
 execute format('create policy "Content MFA guard" on public.%I as restrictive for all to authenticated using(public.portal_mfa_satisfied()) with check(public.portal_mfa_satisfied())',t);
 end loop;
end;
$policies$;
grant insert,update on public.learning_resources,public.announcements to authenticated;
grant insert,delete on public.announcement_targets to authenticated;
grant insert on public.portal_content_files,public.announcement_reads to authenticated;
create policy curriculum_read on public.library_curriculum_subjects for select to authenticated using(public.has_active_role('teacher') or public.has_active_role('admin'));
create policy library_read on public.learning_resources for select to authenticated using(public.can_read_learning_resource(id));
create policy library_insert on public.learning_resources for insert to authenticated with check(public.library_teacher_scope(teacher_id,campus,class_level,class_stream,subject));
create policy library_update on public.learning_resources for update to authenticated using(public.can_manage_learning_resource(id)) with check(public.can_manage_learning_resource(id));
create policy newsletter_read on public.announcements for select to authenticated using(public.can_read_school_announcement(id));
create policy newsletter_insert on public.announcements for insert to authenticated with check(created_by=auth.uid() and
 (case when campus='all' then public.is_main_school_admin() else public.can_manage_school_campus(campus) end));
create policy newsletter_update on public.announcements for update to authenticated using(public.can_manage_school_announcement(id)) with check(public.can_manage_school_announcement(id));
create policy target_read on public.announcement_targets for select to authenticated using(public.can_read_school_announcement(announcement_id));
create policy target_insert on public.announcement_targets for insert to authenticated with check(public.can_manage_school_announcement(announcement_id));
create policy target_delete on public.announcement_targets for delete to authenticated using(public.can_manage_school_announcement(announcement_id));
create policy own_notice_reads on public.announcement_reads for select to authenticated using(user_id=auth.uid() and public.can_read_school_announcement(announcement_id));
create policy own_notice_read_insert on public.announcement_reads for insert to authenticated with check(user_id=auth.uid() and public.can_read_school_announcement(announcement_id));
create policy file_read on public.portal_content_files for select to authenticated using(public.content_file_manage(resource_id,announcement_id) or
 (ready and active and public.content_file_read(resource_id,announcement_id)));
create policy file_reserve on public.portal_content_files for insert to authenticated with check(uploaded_by=auth.uid() and not ready and not active and public.content_file_manage(resource_id,announcement_id));
create policy content_audit_read on public.portal_content_events for select to authenticated using(
 public.is_main_school_admin() or (campus in ('junior','senior') and (public.can_read_school_campus(campus) or public.accountant_can_access_campus(campus))));

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
select bucket,bucket,false,10485760,array['application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document',
 'application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.presentationml.presentation','image/jpeg','image/png','image/webp']
from unnest(array['learning-library','school-newsletters']) bucket
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
create policy content_storage_read on storage.objects for select to authenticated using(
 bucket_id in ('learning-library','school-newsletters') and public.portal_storage_file_access(bucket_id,name,false));
create policy content_storage_upload on storage.objects for insert to authenticated with check(
 bucket_id in ('learning-library','school-newsletters') and public.portal_storage_file_access(bucket_id,name,true));
create policy content_storage_pending_delete on storage.objects for delete to authenticated using(
 bucket_id in ('learning-library','school-newsletters') and public.portal_storage_file_access(bucket_id,name,true));
-- No UPDATE/upsert or permanent deletion of finalized objects for browser roles.

do $grants$
declare f record;
begin
 for f in select p.oid::regprocedure as signature,p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname in ('library_teacher_scope','library_parent_scope','can_manage_learning_resource','can_read_learning_resource',
 'can_manage_school_announcement','can_read_school_announcement','guard_portal_content','guard_announcement_target',
 'content_file_manage','content_file_read','finalize_portal_content_file','portal_storage_file_access','capture_portal_content_event') loop
 execute format('revoke all on function %s from public,anon,authenticated',f.signature);
 if f.proname not in ('guard_portal_content','guard_announcement_target','capture_portal_content_event') then
 execute format('grant execute on function %s to authenticated,service_role',f.signature);
 end if;
 end loop;
end;
$grants$;
notify pgrst,'reload schema';
commit;
