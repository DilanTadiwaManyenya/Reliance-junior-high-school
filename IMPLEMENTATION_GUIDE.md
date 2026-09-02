# Fees Dashboard Implementation Guide

## Prerequisites

Apply the existing fees dashboard schema migration before loading data. It adds campus fields, fee notes and payment dates, and campus-aware row-level security. Configure `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` for the web app. Use a service-role key only for local seeding; never expose it in client code.

## Loading demonstration data

The repository already contains the Term 3 seed migration. For Node-based data generation, set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`, then run `node scripts/seedFeeData.js`. It creates 150 learners (75 per campus) and one fee row per learner for each of the three 2026 terms. The database trigger derives each learner's campus from their class level.

To add Terms 1 and 2 to existing learners, paste `scripts/extendedSeedFeeData.sql` into Supabase SQL Editor and run it once. Its unique conflict target makes it safe to re-run without duplicating fee rows. Confirm results using its final grouped count query.

## Application integration

`src/lib/api.js` accepts the authenticated Supabase client from `useAuth()` rather than importing a global client. This preserves RLS for administrators and campus-scoped accountants. The API helpers return `null` for a missing single record and an empty array for a failed list request, while logging the underlying error for diagnostics.

Use `src/lib/utils.js` for all display and calculation logic. Fee rows use `total_fees`, `amount_paid`, `academic_year`, and labels such as `Term 1`. `calculateBalance` is clamped to zero and `getPaymentCategory` puts each learner in exactly one group: full, half, or unpaid.

## Validation and operations

Run `npm run lint` followed by `npm run build` before deployment. Test with an admin and an accountant assigned separately to Junior and Senior campuses, confirming that RLS prevents cross-campus fee changes. Keep the service-role environment variable out of Vercel and browser environment files.

## Testing

The component test file documents the expected dashboard behaviour. Install Jest, jsdom, and React Testing Library (or adapt it to the project's preferred test runner) before using `npm test -- FeesDashboard.test.jsx`. Mock Supabase at the boundary and cover loading, campus filtering, localStorage section state, search, categorization, modal saves, selector refreshes, responsive CSS hooks, and request failures.