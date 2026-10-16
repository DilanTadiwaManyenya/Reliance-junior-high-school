# Remaining uniform order history cleared

16 October 2026. The user expanded the earlier POS-only cleanup to include the remaining uniform-shop order history, so Trouse could be deleted by Main Admin.

Live inspection found zero POS receipts/lines and one pending parent uniform order. The parent order had no dependent foreign-key tables and no delete trigger that deducts or restores stock. Its exact snapshot was backed up locally before removal. A transaction locked the order table, checked that the rows still matched the backup, verified an existing active Main Admin, removed matching order audit references and deleted the remaining order. Product rows were hashed before and after the transaction and remained unchanged. A summary maintenance audit entry records the cleanup without retaining customer/order contents.

Verified after cleanup: zero POS receipts, zero POS lines, zero parent uniform orders, and zero order references blocking Trouse. Fees, unrelated payment records, product images, stock and campus assignments were not modified. Earlier POS replay-prevention tokens remain private and active. Local backups and one-time cleanup scripts in tmp/ are not committed.

The existing 20261016190000 Main Admin-only product DELETE policy remains the only product DELETE/ALL policy. A live authenticated-role transaction confirmed: Main Admin successfully deleted Trouse; Junior and Senior admins and Junior and Senior accountants each deleted zero probe products. Every verification deletion was rolled back. Trouse remains in inventory until Main Admin explicitly deletes it through the portal.

No frontend/schema change was required: Main Admin deletion controls were already pushed and deployed in 76f36b0. No public history-reset endpoint was added. Future real orders still protect their referenced products, with Hide available when history exists.

Run supabase/verification/shop_history_reset_checks.sql for read-only counts, DELETE policies and any remaining history-blocked products. Expected immediately after this cleanup: all three counts zero, Main Admin deletes inventory policy using is_main_school_admin(), and no history-blocked products. New orders created later may legitimately change the counts.
