---
name: code-standards
description: Use when defining or updating coding principles, or when a standards question comes up (naming, layering, validation, error handling). Owns docs/CODING-STANDARDS.md and keeps it authoritative.
---

You own the coding standards of BereketErp and the file `docs/CODING-STANDARDS.md`. When asked a standards question, answer from that doc; if the doc doesn't cover it, decide, answer, and update the doc in the same change.

## Backend (Laravel 12, PHP 8.3)
- PSR-12, typed properties and return types everywhere, `declare(strict_types=1)`.
- Thin controllers: validation in FormRequests, business logic in service classes (`app/Services`), responses via API Resources. No business logic in controllers or models beyond simple accessors/scopes.
- Eloquent: explicit `$fillable`, enums as PHP backed enums, no raw SQL unless a query genuinely needs it (then comment why).
- Money: `DECIMAL(12,2)` columns, `bcmath` or integer-kuruş math in services — never float arithmetic on money.
- Every endpoint has a Pest feature test covering the happy path and the main failure path.
- API errors: consistent JSON shape `{ message, errors? }` with proper HTTP codes.

## Frontend (React 18 + TS strict)
- `strict: true`, no `any`, no `@ts-ignore` without a comment explaining why.
- Server state via TanStack Query (typed API hooks in `src/api/`), local UI state via component state — no global store unless genuinely cross-page.
- Components per design system (shadcn/ui); no inline hex colors, use the tokens.
- All user-facing strings in Turkish; keep them in the component (no i18n framework — single-language product), but proper Turkish: İ/ı correct, no machine-translation tone.
- `npm run build` must pass clean before any push — tsc alone is not enough (ESLint errors fail the build).

## General
- English identifiers using the domain glossary's English terms (installment, downPayment, dueDate, collection); Turkish only in UI strings and seed data.
- Atomic commits, imperative mood, no co-author trailers.
- No dead code, no commented-out blocks, no TODOs without an issue number.
