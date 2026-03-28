# Supabase Migration Guide (For Claude Code)

This document is a request for **Claude Code** to migrate the current `jamie-cms` architecture (Express + Vercel) to a fully managed **Supabase-centric** architecture.

## Primary Goal
Remove the 24/7 Node.js backend (`server/`) and replace it with **Supabase** features (Auth, Database, Storage, and Edge Functions) to minimize maintenance and costs.

## Migration Steps (To be executed when stable)

### Phase 1: Authentication
1.  **Supabase Auth Setup**: Enable Kakao OAuth in the Supabase Dashboard.
2.  **Frontend Update**: Replace custom `authStore.js` logic with `@supabase/supabase-js`.
3.  **Removal**: Delete `server/src/routes/auth.js` and related controllers.

### Phase 2: Database & API
1.  **Row Level Security (RLS)**: Port all access-control logic from Express middleware (e.g., `authenticate.js`, `requireAdmin.js`) to Postgres RLS policies.
2.  **Direct DB Access**: For simple CRUD, update the frontend to use `supabase.from('tableName').select(...)` directly.
3.  **Edge Functions**: Move complex logic (like subscription processing or admin tasks) to **Supabase Edge Functions** (Deno).

### Phase 3: Scheduler
1.  **Auto-Debit Logic**: Port `server/src/scheduler/autoDebit.js` to a Supabase Edge Function.
2.  **Cron Trigger**: Use Supabase's built-in cron support (via `pg_cron`) or an external trigger to invoke the function at the start of each month.

### Phase 4: Cleanup & Deployment
1.  **Cleanup**: Once all features are migrated, the `server/` directory can be safely removed.
2.  **Frontend Deployment**: Ensure the React app is configured to point solely to the Supabase URL/Key.

---
**Note to Assistant**: Refer to the existing `server/supabase/schema.sql` and the `./brain/` artifacts for detailed implementation details.
