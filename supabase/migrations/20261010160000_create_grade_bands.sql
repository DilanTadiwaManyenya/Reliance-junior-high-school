create table if not exists public.grade_bands (
  id uuid primary key default gen_random_uuid(), band_group text not null check (band_group in ('primary', 'olevel', 'alevel')),
  minimum_score integer not null check (minimum_score between 0 and 100), maximum_score integer not null check (maximum_score between 0 and 100 and maximum_score >= minimum_score),
  grade text not null, points integer, description text not null, updated_at timestamptz not null default now(), unique (band_group, minimum_score)
);
alter table public.grade_bands enable row level security;
create policy "Authenticated users read grade bands" on public.grade_bands for select to authenticated using (true);
create policy "Admins manage grade bands" on public.grade_bands for all to authenticated using (public.is_admin()) with check (public.is_admin());
insert into public.grade_bands (band_group, minimum_score, maximum_score, grade, points, description) values
('primary',85,100,'Unit 1',1,'Excellent'),('primary',77,84,'Unit 2',2,'Very Good'),('primary',70,76,'Unit 3',3,'Good'),('primary',60,69,'Unit 4',4,'Satisfactory'),('primary',50,59,'Unit 5',5,'Fair'),('primary',40,49,'Unit 6',6,'Pass - Lower'),('primary',30,39,'Unit 7',7,'Pass - Low'),('primary',20,29,'Unit 8',8,'Fail'),('primary',0,19,'Unit 9',9,'Fail - Very Low'),
('olevel',75,100,'A',5,'Distinction'),('olevel',65,74,'B',4,'Merit'),('olevel',50,64,'C',3,'Credit - Pass'),('olevel',40,49,'D',2,'Pass'),('olevel',0,39,'E',1,'Fair'),
('alevel',80,100,'A',5,'Outstanding'),('alevel',70,79,'B',4,'Very Good'),('alevel',60,69,'C',3,'Good'),('alevel',50,59,'D',2,'Satisfactory'),('alevel',40,49,'E',1,'Minimum Pass'),('alevel',30,39,'O',0,'Subsidiary Pass'),('alevel',0,29,'F',0,'Fail')
on conflict (band_group, minimum_score) do nothing;
