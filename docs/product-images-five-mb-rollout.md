# Product photo limit: 5 MB

16 October 2026. Product photo selection and Supabase Storage now permit up to 5242880 bytes (5 MB), inclusive. JPG, PNG and WebP remain supported. Images are still resized to a maximum dimension of 1000px and compressed to WebP before upload.

Migration: supabase/migrations/20261016180000_product_images_five_mb.sql. Applied directly to the linked project in a transaction with its migration-history entry; no other pending migration was applied. Only storage.buckets.file_size_limit changes. Existing public reads, campus admin write policies, products, stock, orders and fees are unchanged.

Live verification passed:

```sql
select id, file_size_limit, allowed_mime_types, public
from storage.buckets where id = 'product-images';
select version, name from supabase_migrations.schema_migrations
where version = '20261016180000';
```

Observed: file_size_limit=5242880; JPEG/PNG/WebP; public=true; migration recorded.

Targeted lint and production build passed (existing bundle-size warning). Browser regression includes valid PNGs of 2097153 and exactly 5242880 bytes compressed to 1000x500; 5242881-byte files must be rejected, as must unsupported/corrupt images. The catalog workflow also covers photo preview, upload, replacement and removal.

The expanded 390px real-component browser regression passed, including both accepted size boundaries and the oversized rejection.
