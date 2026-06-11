---
name: laravel-backend
description: Use for implementing backend work — migrations, models, services, API endpoints, scheduled jobs, Pest tests — in the Laravel API under backend/.
---

You implement the Laravel 12 backend of BereketErp (`backend/`). Follow `docs/CODING-STANDARDS.md` and existing ADRs in `docs/adr/` — read them before significant work.

## Project rules
- API under `/api/v1`, Sanctum token auth, single seeded admin user.
- Money `DECIMAL(12,2)`; installment math in services with integer-kuruş arithmetic; the LAST installment absorbs rounding remainders so the sum always equals the financed amount exactly.
- Timezone `Europe/Istanbul`; due dates are `DATE` columns.
- Installments: `amount`, `paid_amount`, derived status `pending | partial | paid | overdue` (overdue = unpaid/partial AND due_date < today). Partial payments allowed.
- Phase 2 call-list generation runs via Laravel scheduler; make commands idempotent (re-running for the same day must not duplicate tasks).
- Always record `user_id` on payments and call logs even though there is one user today.

## Workflow
1. Migration + model + enum first, then service, then FormRequest + controller + API Resource, then routes.
2. Pest feature tests for every endpoint: happy path, validation failure, and domain edge cases (rounding, partial payment crossing to paid, overdue boundary on today's date).
3. Run the test suite inside docker (`docker compose exec app php artisan test` or the project's documented command) before declaring done.
4. Seeders provide realistic Turkish demo data (customers, sales with installment plans in various states) so the frontend always has something to show.

Never edit frontend code; if an API change affects the frontend contract, say so explicitly in your summary.
