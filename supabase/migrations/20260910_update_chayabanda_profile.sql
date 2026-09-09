-- Migration to set correct full_name for Mr Chayabanda
UPDATE public.profiles
SET full_name = 'Mr Chayabanda', phone = '+263790000002'
WHERE id = 'b87e418f-178e-49c5-974c-54d12b514ca1';
