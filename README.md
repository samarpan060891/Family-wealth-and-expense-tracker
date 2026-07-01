# FamilyWealth Tracker

A mobile-first (portrait) family finance tracker covering expenses, income,
investments, debts, assets and insurance — with multi-user login and
per-family-member sharing controls.

## Features

- **Multi-user login** — email/password auth with hashed passwords (bcrypt)
  and a signed httpOnly session cookie. Password field has a show/hide toggle.
- **Household model** — the person who registers becomes the main account
  holder (admin). They can add family members and choose, per module and per
  category, whether each member has no access / view-only / view & edit.
- **Six modules**: Expenses, Income, Investments, Debts, Assets, Insurance —
  each with an "Add" form, category/type classification, and delete.
- **Sources of funds** — every expense/income records how it happened (Cash,
  Debit/Credit Card, UPI, Bank Transfer, Auto Debit, Cheque, Dividend, etc.).
- **Recurring entries** — mark any income/expense as recurring (monthly,
  quarterly, half-yearly, yearly) for auto-debits, salary, SIPs, etc.
- **Monthly trend** — income vs. expense bar chart, and category breakdown
  for the current month, on the dashboard.
- **Expiry management** — insurance renewal dates, loan payoff dates, and
  investment maturity dates within the next 90 days surface as alerts.
- **12-month cashflow projection** — combines recurring income/expenses,
  active loan EMIs, insurance premiums (amortized to a monthly equivalent),
  and a 3-month trailing average of discretionary spend.
- **Attachments** — capture a photo, or upload a PDF/Excel file, against any
  expense, investment, debt, asset or insurance record (bills, statements,
  policy copies). Stored in the database as base64; no external storage
  required. (Automatic OCR/auto-categorization is not wired up yet — see
  "Next steps".)
- **Mobile-first** — dark, portrait-optimized layout with a bottom tab bar,
  installable as a PWA (`manifest.json`).

## Tech stack

- **Next.js 16** (App Router, TypeScript, Tailwind CSS v4)
- **Drizzle ORM** over Postgres. In development, an embedded **PGlite**
  (WASM Postgres) database is used automatically — no Docker/Postgres
  install required. In production, point `DATABASE_URL` at a real Postgres
  instance (Neon, Supabase, RDS, etc.) and the same schema/queries apply.
- **jose** (JWT) + **bcryptjs** for auth, **zod** for input validation,
  **recharts** for charts.

## Getting started

```bash
npm install
npm run db:generate   # only needed after changing src/db/schema.ts
npm run db:migrate    # applies drizzle/*.sql to the database
npm run dev
```

Open http://localhost:3000 — you'll land on `/register` to create your
household as the main account holder.

### Using a real Postgres database

Copy `.env.example` to `.env` and set `DATABASE_URL` to your Postgres
connection string, then run `npm run db:migrate` again before starting the
app. Also set `AUTH_SECRET` to a long random string in any shared/production
environment.

## Project structure

- `src/db/schema.ts` — Drizzle schema (households, users, share_permissions,
  categories, transactions, investments, debts, assets, insurances,
  attachments).
- `src/lib/permissions.ts` — computes what a family member is allowed to see
  based on `share_permissions` rows (admins always see everything).
- `src/lib/cashflow.ts` — the 12-month cashflow projection and "upcoming
  expiries" calculations.
- `src/app/api/**` — REST-ish route handlers, one per module.
- `src/app/(app)/**` — authenticated pages (dashboard + 6 modules + family
  sharing management), wrapped in a shared mobile nav shell.

## Next steps / ideas not yet implemented

- Automatic category/amount extraction from uploaded bills (OCR). The
  attachment upload/storage plumbing is already in place; wiring in an
  OCR/AI extraction step to pre-fill the add-entry form would slot in
  naturally at `AttachmentUploader`.
- Push notifications for expiring policies/EMI due dates.
- Editing existing entries (currently add + delete; no update yet).
