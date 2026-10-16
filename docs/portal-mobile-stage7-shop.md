# Mobile Stage 7 — shop, POS and long product forms

The product editor keeps Cancel and Save together in a mobile sticky footer on its existing single scrolling surface. Hide/Show and Main Admin-only permanent deletion have a separate action group, with deletion visually distinguished. Existing permission checks, history protection and handlers remain unchanged.

Price fields request decimal keyboards; stock/allocation/size quantities request numeric keyboards. Size rows use a compact two-column layout on phones. Focus scroll margins reserve space for the footer. Removing the competing native autofocus lets the existing modal focus hook capture the opener and restore focus on close. Shop document scrolling is immediate so focus restoration and pending-checkout recovery do not fight smooth scrolling.

Validation:

- New product-dialog suite: 320/390/768 x 480 viewports; fields and Cancel/Save unobscured, no horizontal clipping, decimal input hint and Escape focus restoration. Included in `test:portal-workflows`.
- Full workflow suite: 89 inventory, settings, product/receipt, campus class, learner-profile and desktop checks, plus pending-payment dismissal and single-request protection. Updated the synthetic receipt with its Senior campus and selected the POS campus explicitly, matching current ownership rules.
- Catalog acceptance: phone and desktop photo preview/crop/compression/upload/replace/remove, invalid files, per-size stock, campus separation, parent visibility, snapshots and checkout recovery. External fonts are blocked in this local fixture suite to remove a network dependency from screenshots.
- Targeted lint and production build pass. Existing large-bundle warning remains for Stage 8.
- Representative 390 x 480 product footer screenshot inspected locally. Test images/logs remain outside the commit.

No SQL, live transactions, fee calculations, stock rules or role grants changed. Local synthetic checks do not replace authenticated hosted or real phone keyboard/photo-picker acceptance, which remains in Stage 9. Stage 8 follows with accessibility and measured loading/data-use improvements.

Database regression: all six shop/campus tests passed, including catalog/storage RLS, accountant write denial, Main Admin deletion, parent campus guards, stock rollback and retry idempotency.
