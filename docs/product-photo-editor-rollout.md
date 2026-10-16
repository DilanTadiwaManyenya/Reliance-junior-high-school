# Product photo editing rollout

## Stage 1 — editor and compression

New photo selection opens an inline editor inside the product modal. Default Fit whole image adds white padding in a square frame; Crop to square, drag positioning, keyboard-accessible horizontal/vertical sliders, zoom, quarter-turn rotation and reset are available. The source selection limit remains 5 MB for JPG/PNG/WebP.

Compression presets target approximately 90 KB (Smaller), 160 KB (Balanced/default) or 220 KB (More detail). WebP quality is reduced before dimensions; output is at most 1000px per side, with 800/640px fallbacks for detailed photos. Targets are best effort, and the actual compressed size/dimensions are shown before applying. A simple image can be much smaller than the target. Edits run locally; no image-processing service receives the original.

Use edited photo applies the preview to the form; Save product performs the upload. Product save is blocked while an edit is unfinished. Cancel photo edit retains the prior form photo. Removing the photo still requires saving the product. Edit photo fetches an existing photo (or uses the unsaved blob); external images require browser CORS access. If an old external image cannot be loaded, choose its original file. Saving a crop replaces the saved photo; previously discarded areas cannot be recovered from that saved crop.

No migration, role/policy, campus allocation, order, stock, fee or payment changes are needed. Existing photos are untouched until an authorized admin saves an edit. Existing cache-safe upload URLs and prior-photo cleanup remain.

Verification: targeted lint and production build passed. Real-component browser coverage exercises new-photo editing; existing-photo crop/rotate/zoom/reset; cancellation without upload; save gating; replacement cleanup; and pixel-level fit/padding/crop/rotation checks. Regression coverage retains the 5 MB limits, variant/cart flows, campus authorization UI and historical order display.

## Stage 2 — catalog display and mobile acceptance

The shared ProductImage component now imports its own frame stylesheet so parent display does not depend on the inventory page loading CSS. Admin grid cards, editor previews and parent cards use a reserved square frame; the image is positioned within it with object-fit: contain, so intrinsic tall/wide image dimensions cannot expand the frame and crop the visible photo. List thumbnails stay 72px. Existing lazy loading, async decoding and missing/broken-image placeholders remain. No old files are rewritten for this display change.

Acceptance adds portrait (300x900) and landscape (900x300) image probes in both catalogs, checking square frame geometry, contained image bounds and lazy loading. Editor interaction also exercises pointer dragging, alongside sliders. Run npm run test:shop:browser for the full independent 390px and 1280px workflows.

Stage 1 result: expanded 390px browser suite passed, including existing-image editing, cancel/no-upload checks, square fit/crop geometry, rotation and WebP output.

Stage 1 commit a6f171a is pushed and both connected Vercel deployments report success. Hosted signed-in UI was not directly inspected; real-component browser tests run against isolated backend fixtures. No Supabase migration or data changes are part of these two photo stages.

Stage 2 result: npm run test:shop:browser passed both 390px and 1280px workflows, including pointer positioning and tall/wide legacy image containment in admin and parent catalogs. Targeted lint and production build passed, with the existing bundle-size warning. Mobile and desktop screenshots were visually reviewed.
