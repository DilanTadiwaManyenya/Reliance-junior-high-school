select set_config('role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub": "16aed611-12b4-4b01-8f80-50caf8af5a01"}', true);
select count(*) from students;
