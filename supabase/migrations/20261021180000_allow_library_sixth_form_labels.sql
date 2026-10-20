-- Preserve exact allocated/enrolled scope while accepting the school's confirmed labels.
begin;
do $$
declare target text; constraint_name text; matches integer;
begin
 foreach target in array array['learning_resources','announcement_targets'] loop
 select count(*),min(c.conname) into matches,constraint_name from pg_constraint c
 where c.conrelid=('public.'||target)::regclass and c.contype='c'
 and pg_get_constraintdef(c.oid) like '%campus%' and pg_get_constraintdef(c.oid) like '%class_level%'
 and pg_get_constraintdef(c.oid) like '%Form%';
 if matches<>1 then raise exception 'Expected one content class-scope constraint on %',target; end if;
 execute format('alter table public.%I drop constraint %I',target,constraint_name);
 end loop;
end; $$;
alter table public.learning_resources add constraint library_valid_class_scope check(
 (campus='junior' and class_level ~ '^(ECD [AB]|Grade [1-7])$')
 or (campus='senior' and (class_level ~ '^Form [1-6]$' or class_level in ('Lower Six','Upper Six'))));
alter table public.announcement_targets add constraint newsletter_valid_class_scope check(
 class_level='' or (campus='junior' and class_level ~ '^(ECD [AB]|Grade [1-7])$')
 or (campus='senior' and (class_level ~ '^Form [1-6]$' or class_level in ('Lower Six','Upper Six'))));
notify pgrst,'reload schema';
commit;
