-- Create table for fee bands
create table if not exists public.fee_structure_mapping (
  band_id text primary key,
  band_name text not null,
  amount numeric not null,
  updated_at timestamp with time zone default now()
);

-- Enable RLS
alter table public.fee_structure_mapping enable row level security;

-- Policies
create policy "Allow read access to authenticated users"
  on public.fee_structure_mapping for select
  to authenticated
  using (true);

create policy "Allow update access to admins"
  on public.fee_structure_mapping for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
      and profiles.role = 'admin'
    )
  );

-- Insert initial values based on existing structure
insert into public.fee_structure_mapping (band_id, band_name, amount) values
  ('ecd_a_b', 'ECD A & B', 120),
  ('grade_1_7', 'Grade 1-7', 120),
  ('form_1_2', 'Form 1 & 2', 170),
  ('form_3_4', 'Form 3 & 4', 180),
  ('lower_upper_six', 'Lower & Upper Six', 210)
on conflict (band_id) do update set amount = excluded.amount;

-- Update the existing function to pull from the table
create or replace function public.get_fee_amount(p_class_level text)
returns numeric language sql stable as $$
  select coalesce(
    (select amount from public.fee_structure_mapping where band_id = (
      case 
        when p_class_level in ('ECD A', 'ECD B') then 'ecd_a_b'
        when p_class_level like 'Grade%' then 'grade_1_7'
        when p_class_level in ('Form 1', 'Form 2') then 'form_1_2'
        when p_class_level in ('Form 3', 'Form 4') then 'form_3_4'
        when p_class_level in ('Form 5', 'Form 6', 'Lower Six', 'Upper Six') then 'lower_upper_six'
        else 'grade_1_7'
      end
    )),
    120.00
  );
$$;
