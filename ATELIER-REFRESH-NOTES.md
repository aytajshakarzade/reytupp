# ReytUp Atelier Refresh and Backend Update

This edition retains the premium responsive UI refresh and adds the missing database work required by the Supabase deployment target.

## Backend updates
- Added PostgreSQL support through the `pg` driver and the server-only `DATABASE_URL` setting.
- Added `migrations/002_supabase_runtime.sql` for the current runtime schema.
- Enabled Row Level Security on application tables. The trusted Node server connects with its PostgreSQL connection string; database credentials are never sent to the browser.
- Preserved SQLite as a local fallback when `DATABASE_URL` is intentionally empty (also used by isolated smoke tests).
- Fixed the analysis INSERT statement that previously attempted to insert 15 values into 14 columns.
- Updated all database operations, including Stripe webhook writes, to use asynchronous queries and transactional processing.
- Improved Overpass request encoding and User-Agent handling.

## Credentials
- The matching ReytUp 4.2 `.env` file is included byte-for-byte; no variable names or values were edited.
- The existing `data/.jwt-secret` is also preserved byte-for-byte so existing signed sessions do not unexpectedly change.
- The included `DATABASE_URL` points to the existing Supabase Session Pooler host in `eu-west-1`; its password and API credentials remain private inside `.env`.
- No SMTP provider, SMTP password, or additional API key was added.
- Do not commit `.env` or share this private ZIP publicly. `.env.example` remains a placeholder template for new installations only.

## Important database migration note
The runtime creates its current schema using `migrations/002_supabase_runtime.sql`. A previous draft `001_initial.sql` used UUID IDs and is now marked deprecated. If that old UUID schema was already applied to your Supabase project, the app deliberately refuses to silently use it; take a backup and migrate existing data deliberately or use an empty schema/project.

## Verification status
`npm run check` and `npm test` pass in the local SQLite test mode. A live Supabase connection was not possible to verify from this build environment; it must be confirmed with your real connection string. After `npm install` and correct `DATABASE_URL` setup, `/api/health` must report `database: "postgres"`.
