# Procurement Flow Portal

Digital procurement request portal for Ashdod municipality (based on Annex A form). Goal: replace Word/email flow with audited, role-based approvals and signed PDF output.

## Scope & Roles
- Roles: Initiator (מבקש), Budget Officer (חשב), Procurement Dept, Committee Coordinator, Admin.
- Authentication: only @ashdod.muni.il accounts; first-time password setup; remember-me cookie per policy.
- Ownership & statuses: Draft → Pending Budget → Pending Procurement → Pending Committee → Completed/Rejected, with return-to-fix loops and full audit trail.

## Core Workflow (condensed)
- Initiator: fills Annex A form, uploads required spec file, optional quotes, chooses budget officer, signs, sends.
- Budget officer: approve / return with note / reject / reassign; signature captured; moves to Procurement.
- Procurement: approve / return (to Initiator or Budget) / reject; signature captured; moves to Committee Coordinator.
- Committee coordinator: final approve / return / reject; signature captured → triggers PDF generation & distribution.
- System: generate sealed PDF with signatures, store in archive, email all parties, lock status to Completed.

## Data Model (draft)
- users(id, email, name, role, dept, manager_id, created_at)
- requests(id, title, description, urgency, budget_line, est_amount, initiator_id, assigned_budget_id, assigned_proc_id, status, created_at, updated_at)
- request_details(id, request_id, key, value, meta_json)
- attachments(id, request_id, filename, storage_key, type, uploaded_by, created_at)
- approvals(id, request_id, role, user_id, action, note, signature_key, created_at)
- status_log(id, request_id, from_status, to_status, actor_id, note, created_at)

## Tech Stack (free-friendly)
- Cloudflare Workers (API + auth + PDF trigger), Pages/Assets for frontend bundle.
- Cloudflare D1 for relational data; R2 for file/signature blobs; Email Routing/API for notifications.
- Frontend: React/TypeScript (or Svelte) SPA with dashboard, form wizard, signature canvas.
- PDF: server-side render (e.g., PDFKit/Playwright on Workers) with embedded signature images.

## Current Infra State
- Git repo: initialized locally (no commits yet).
- Cloudflare Worker: creation attempted via MCP, but Cloudflare API returned account routing error (invalid/missing account identifier).
- Cloudflare D1: creation/listing attempted via MCP, blocked by same account routing error.
- Action needed: verify Cloudflare MCP config (account ID/API token) then rerun Worker + D1 creation/binding.

## Local Dev Notes
- Tools: npm/pnpm for app; Wrangler for Workers/Pages.
- Commands (planned): `npm run dev` (frontend), `npm run dev:api` (wrangler dev), `npm run lint`.

## Next Steps
1) Finalize schema + migrations; seed roles/users.
2) Implement auth (domain check + password setup flow) and role-based dashboards.
3) Build request form UI with attachments + signature capture.
4) Implement workflow actions per role with audit logging and emails.
5) PDF generation + R2 storage + download/print.
6) CI/CD via GitHub Actions to Cloudflare.
