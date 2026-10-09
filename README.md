# Studio Operations

A studio-management dashboard built with Next.js, TypeScript, Google Sheets, and a Google Apps Script web app. The spreadsheet is the shared record store; authentication and authorization happen on the server and in Apps Script, not in browser code.

## Google Sheet and tabs

The initial **Studio Operations Data** spreadsheet is [in Google Drive](https://docs.google.com/spreadsheets/d/1rXvKiiD1xKCUOIaVBIGQ4FCn6UPncG-qgHEz_AtEDjg/edit). It contains these tabs: `Users`, `Clients`, `Bookings`, `Tasks`, `Equipment`, `Episodes`, `Payments`, and `Memberships`. The bound [Apps Script project](https://script.google.com/home/projects/1tOjgaSCkTqyBZxMH3HTKOIObeQM-owfzH2Y62C0J2jyMCbClmjunCcky/edit) contains the API/authentication code. The spreadsheet ID and administrator email are already set in Script Properties; sensitive secrets and the initial password are intentionally left for the owner to enter. The users tab is for admin-managed app accounts; staff must not be added as Google Sheet collaborators. Keep the file private to the administrator because it includes business records and credential hashes.

## Required setup before using the app

1. In the spreadsheet, use **Extensions → Apps Script** and paste `google-apps-script/Code.gs` into the Apps Script project.
2. In Apps Script **Project Settings → Script properties**, add `SPREADSHEET_ID` as `1rXvKiiD1xKCUOIaVBIGQ4FCn6UPncG-qgHEz_AtEDjg`, `API_SHARED_SECRET` as a long random secret, `INITIAL_ADMIN_EMAIL` as the administrator's email, and `INITIAL_ADMIN_PASSWORD` as a temporary password with at least 12 characters.
3. Run `bootstrapAdmin` once from the Apps Script editor and approve its requested spreadsheet permissions. It creates the owner account and then removes the initial password property.
4. Deploy Apps Script as a **Web app**, execute as the owner, accessible to **Anyone**. The endpoint is public, but requests require the random `API_SHARED_SECRET`; the browser never receives it. Redeploy after code changes.
5. Locally, copy `.env.example` to `.env.local` and set the deployment URL plus two distinct random secrets. Set the same three variables in Vercel, then redeploy.
6. Visit `/login` and sign in using the email and temporary password. For staff, the admin uses **Staff & tasks → Team & attendance → Add team member**, privately sends the generated temporary password, and the staff member must replace it on first login.

Do not put passwords, `API_SHARED_SECRET`, or `STUDIO_SESSION_SECRET` in client-side variables, a public sheet, Git, or chat. Never share the spreadsheet with staff. Use strong unique secrets and back up the spreadsheet before major changes.

## Login and permissions

Accounts are created by the admin inside the app; invitations are not emailed automatically. Share the app URL and temporary password privately. Passwords are stored in the Users sheet as salted iterative SHA-256 hashes, not plain text. Staff sessions are signed, HttpOnly cookies. Available roles are admin, studio manager, reception, editor, and finance. The navigation is role-filtered; tasks are visible to the assignee and creator, while the admin can manage all tasks and staff accounts.

## Current scope and limitations

Staff account creation, sign-in, role-limited task listing, task assignment, and completion are connected to Sheets. The other studio modules still use their existing browser/demo data and have **not** been migrated to Sheets yet. A Google Sheet is convenient for a small team, but does not provide database-grade concurrency or audit guarantees; do not use it as the only secure record for regulated or highly sensitive information. Google Apps Script quotas and network latency can affect responsiveness. Payment entries do not process charges; reports and attendance remain illustrative/unconnected.

## Development and validation

Requirements: Node.js 20.9 or newer and npm. Run `npm install`, copy/configure `.env.local`, then `npm run dev`. Validate with `npm run lint` and `npm run build`.
