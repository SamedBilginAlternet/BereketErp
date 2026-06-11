# BereketErp — Roadmap & Decisions

Custom ERP for Bereket Tekstil: promissory note (senet) & installment sales, collection, stock, and sales management. Full spec: issue #1 (transcription of `bereket-teklif.pdf`).

## Locked decisions (2026-06-11)

| Topic | Decision |
|---|---|
| Stack | Docker · Laravel 12 API (PHP 8.3) · MySQL 8 · React 18 + TS + Vite |
| UI foundation | Tailwind + shadcn/ui — white, minimalist design language |
| Language | Turkish UI & seed data; English code, identifiers, commits |
| Auth | Single admin user (Sanctum). No RBAC yet; `user_id` still recorded on payments/calls |
| Payments | Partial installment payments allowed (`amount` vs `paid_amount`) |
| Sale content | Amounts + free-text description (real product lines arrive in Phase 3) |
| Overdue | Status flag only — no late fees/penalties |
| Reminders | In-app only (dashboard + call lists); no SMS/WhatsApp for now |
| Ledger migration | Both: keyboard-first manual fast-entry screen AND Excel/CSV bulk import |
| Deployment | Undecided — docker keeps store-PC and VPS both viable |
| Money/dates | `DECIMAL(12,2)`, integer-kuruş math, last installment absorbs rounding; `Europe/Istanbul`, due dates are `DATE` |

## Phases

1. **Phase 1 — Senet & Taksit Yönetimi** *(must be production-ready first, ships independently)*
   Customers with legacy ledger fields (defter adı / sayfa / satır), sale + automatic installment engine, payment recording, customer balance screen, daily dashboard (bugün vadesi gelen / gecikmiş / yarın), ledger fast-entry + Excel import.
2. **Phase 2 — Tahsilat Çağrı Merkezi**
   Daily auto-generated calling list from due/overdue installments; call outcomes (promise → resurfaces on promised date; unreachable → recall list); chronological customer timeline (calls, promises, payments); agent call screen.
3. **Phase 3 — Stok & Barkod** *(later)* — product catalog, barcode generation, label printing, low-stock alerts.
4. **Phase 4 — Depo, Şube & Satış** *(later)* — weighted costing, POS/cashier screen, multi-branch transfers.

## Repo layout

```
BereketErp/
├── docker-compose.yml
├── docker/            # service Dockerfiles & configs
├── backend/           # Laravel 12 API
├── frontend/          # React + TS + Vite
├── docs/              # this file, DESIGN-SYSTEM.md, CODING-STANDARDS.md, adr/
└── .claude/agents/    # architect, code-standards, ui-designer, laravel-backend,
                       # react-frontend, backend-reviewer, frontend-reviewer, qa-tester
```

## Working agreement

- Every feature starts from a GitHub issue with acceptance criteria (milestones: Phase 1, Phase 2).
- Design before code: ui-designer spec → react-frontend implements; architect ADR before schema/API changes.
- Reviewers (backend-reviewer / frontend-reviewer) run before every push; qa-tester verifies against acceptance criteria in the running docker stack before an issue closes.
