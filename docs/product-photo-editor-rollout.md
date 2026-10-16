# Product photo editing rollout

## Stage 1 — editor and compression

New photo selection opens an inline editor inside the product modal. Default Fit whole image adds white padding in a square frame; Crop to square, drag positioning, keyboard-accessible horizontal/vertical sliders, zoom, quarter-turn rotation and reset are available. The source selection limit remains 5 MB for JPG/PNG/WebP.

Compression presets target approximately 90 KB (Smaller), 160 KB (Balanced/default) or 220 KB (More detail). WebP quality is reduced before dimensions; output is at most 1000px per side, with 800/640px fallbacks for detailed photos. Targets are best effort, and the actual compressed size/dimensions are shown before applying. A simple image can be much smaller than the target. Edits run locally; no image-processing service receives the original.

Use edited photo applies the preview to the form; Save product performs the upload. Product save is blocked while an edit is unfinished. Cancel photo edit retains the prior form photo. Removing the photo still requires saving the product. Edit photo fetches an existing photo (or uses the unsaved blob); external images require browser CORS access. If an old external image cannot be loaded, choose its original file. Saving a crop replaces the saved photo; previously discarded areas cannot be recovered from that saved crop.

No migration, role/policy, campus allocation, order, stock, fee or payment changes are needed. Existing photos are untouched until an authorized admin saves an edit. Existing cache-safe upload URLs and prior-photo cleanup remain.

Verification: targeted lint and production build passed. Real-component browser coverage exercises new-photo editing; existing-photo crop/rotate/zoom/reset; cancellation without upload; save gating; replacement cleanup; and pixel-level fit/padding/crop/rotation checks. Regression coverage retains the 5 MB limits, variant/cart flows, campus authorization UI and historical order display.

## Stage 2 — catalog display and mobile acceptance

Pending after the Stage 1 push: use a consistent square frame that contains the entire image in admin and parent catalogs, including portrait/landscape legacy images. Retain lazy loading, error placeholders and bounded list thumbnails. Verify mobile/desktop layouts and editor controls before pushing Stage 2.

Stage 1 result: expanded 390px browser suite passed, including existing-image editing, cancel/no-upload checks, square fit/crop geometry, rotation and WebP output.
