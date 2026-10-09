# Studio Operations

A responsive business operations dashboard prototype for podcast and recording studios. The current dashboard uses illustrative sample data and interactive UI controls; integrations and persistent data are not configured.

## Requirements

- Node.js 20.9 or newer
- npm

## Run locally

Install dependencies with `npm install`, then start the development server with `npm run dev`. Open `http://localhost:3000` in a browser. To create a production build, run `npm run build`; to serve that build, run `npm start`.

## Production source visibility

Production browser source maps are explicitly disabled, and Next.js minifies production browser bundles. Client-side code must still be delivered to browsers and can be inspected; it cannot be encrypted to conceal it. Keep secrets, authorization rules, and sensitive business logic on a protected server, not in client components.

## Dashboard and connected workspaces

The overview includes daily booking and revenue metrics, pending invoices, active memberships, studio utilization, episode production stages, today’s schedule, and upcoming tasks. The sidebar and dashboard actions navigate to connected routes for bookings, new booking, clients, production, equipment, payments, memberships, staff/tasks, and reports.

Bookings can be created with client, studio, date, start/end time, package, assigned staff, and special requests. The booking form offers date/studio-specific available slots, quick duration presets, and a confirmation dialog. New bookings persist in the current browser using local storage. The full month/week/day calendar displays client names and session times inside date cells; selecting a date shows its agenda, and a new booking can be started from that date. The bookings page supports search, status filtering and updates, and booking details.

Client creation, production episode tracking/status updates, and equipment registration/status updates are available as prototype workflows. The Staff & Tasks page supports task creation/completion and sample attendance check-ins. Memberships shows sample plan credits and supports adding member accounts. Reports includes revenue/service/source charts and CSV export. The notification bell opens a read/unread notification center. These records and notification states remain in UI state unless noted otherwise.

Client and equipment creation support optional photo uploads, kept in this browser’s IndexedDB. Client profiles show a large circular photo; client and equipment directories offer card and list layouts. Booking start/end choices are filtered against occupied intervals for the selected date and studio, and successful bookings show an animated confirmation dialog. Dashboard and report charts animate on entry, with reduced-motion preferences respected.

Client list entries open individual profile pages with contact details, notes, booking history, payment history, and receipt references. The Payments & Invoices page records payments against a selected client, with Cash or Card method, invoice amount/status, and optional PDF/JPG/PNG receipt. Payment records and client records use browser local storage; receipt files and profile photos are kept in browser IndexedDB. Card payment links must be created externally and pasted into the form; the email action opens a reviewable mail draft and does not send it. No payment is charged or processed by this prototype, and local storage is not a secure document repository.

## Planned business modules

The product roadmap includes client history and files, payment processing and invoicing, memberships, production asset delivery, staff and payroll, marketing analytics, finance, workshops and events, digital checklists, WhatsApp messaging, and role-based access for administrators, reception, studio managers, editors, finance staff, and clients.

Payment processing, WhatsApp messaging, authentication, file storage, and backend persistence are not connected. Configure these only with approved provider credentials and production requirements.
