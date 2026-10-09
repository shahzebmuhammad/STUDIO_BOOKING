# Studio Operations

A responsive studio-management app built with Next.js, TypeScript, and Supabase. When Supabase is configured, authentication, organization workspaces, and connected records use the shared database. Without Supabase environment variables, the UI falls back to its browser-based prototype data.

## Requirements

- Node.js 20.9 or newer
- npm

## Local setup

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env.local` and set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` from the Supabase project's API settings. Do not put a service-role key in a `NEXT_PUBLIC_` variable.
3. Start the app with `npm run dev` and open `http://localhost:3000`.

The Supabase project already has the initial schema from `supabase/migrations/202610090001_initial_schema.sql`. **Do not run that initial migration again against the existing database.** The storage-policy correction in `supabase/migrations/202610090002_fix_client_photo_storage_policy.sql` has been applied to the configured project. For future changes, create and apply a new incremental migration.

## First workspace

1. Open `/login` and create the owner account.
2. If email confirmation is enabled in Supabase Auth, confirm the address from the email, then sign in.
3. Complete `/setup` to create the organization and its initial Studio A and Studio B records.

Supabase Auth redirect URLs must include the deployed app's `/auth/callback` and the local development callback. Workspace records are isolated with Postgres row-level security. Use authenticated, request-scoped server actions for database reads and writes; never expose a service-role key in browser code.

## Connected data

The current Supabase-backed flows include clients and photos, bookings and status updates, equipment and status, production episodes, memberships, tasks, payment records/invoices, private receipt uploads, and dashboard aggregates. Client/equipment/receipt files are stored in private organization-scoped Supabase Storage buckets and served through short-lived signed URLs.

This is not a payment processor: payment entries document a status and do not move money. Card checkout links are supplied externally. Attendance, reports, and some prototype interactions are not yet fully database-backed and should not be treated as authoritative business reporting. Without Supabase configuration, data is illustrative/local browser state.

## Validation

Run `npm run lint` and `npm run build` before deploying. Vercel must have the same two public Supabase environment variables configured for each target environment. Keep `.env.local` untracked.
