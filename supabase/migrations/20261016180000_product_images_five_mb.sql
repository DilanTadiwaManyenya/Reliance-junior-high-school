begin;

-- Increase the catalog photo limit without changing public reads or campus write policies.
update storage.buckets set file_size_limit = 5242880 where id = 'product-images';
do $$
begin
  if not exists (select 1 from storage.buckets where id = 'product-images' and file_size_limit = 5242880) then
    raise exception 'Product image bucket missing or size limit was not applied';
  end if;
end $$;

commit;
