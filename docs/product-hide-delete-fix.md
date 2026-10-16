# Product deletion and unassigned visibility

16 October 2026. The reported message is the intended order-history protection, not an image or Storage error. The guard checks the exact product UUID against parent JSON order lines and POS sale items. Live read-only inspection found references for Skirt, Hat, Trouse and Anorak Jacket; these records must remain for history. Unordered products may still be permanently deleted by an authorized admin.

The usability defect was the fallback: saving Show in shop=false on an unassigned product required completing campus allocation. The product editor now offers immediate Hide product / Show product buttons that update only active and updated_at. No campus or allocation is required for this action; existing RLS still authorizes the actual product campus (unassigned remains Main Admin-only). Other unsaved name/price/photo/campus edits stay in the form and are not persisted by visibility changes. A status message makes this explicit.

No schema, deletion guard, stock, order, fee or payment logic is changed. Photos remain attached when hidden; old orders keep their snapshots. Hidden products remain in staff inventory and disappear from parent catalog/POS availability under existing active filters.

Live rollback-only verification using the existing Main Admin role passed: an ordered unassigned product rejected permanent deletion, accepted hide and show, and retained its original campus and quantity. All probe writes were rolled back; no actual products were deleted or retained as hidden by this run.

Checks: two SQL regression tests passed (catalog/deletion protection and campus admin permissions). Targeted lint and production build passed, with the existing bundle-size warning. Browser coverage exercises an ordered-product delete rejection followed by direct Hide, preserved parent history, and an unassigned hide/show with unchanged name/campus/stock while the unsaved form name stays intact.

The mobile tab strip also no longer uses a negative outer gutter: its own horizontal scrolling is retained, while the page stays at the viewport width (390px verified) after modal/tab interactions.

Expanded 390px browser regression passed: the delete rejection is followed by successful Hide, parent history remains, and unassigned Hide/Show preserves stock, campus and unsaved form fields.
