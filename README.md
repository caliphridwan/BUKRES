# Faculty of Computing Result Portal (pilot)

A result management and checking portal for the Faculty of Computing, Bayero University Kano: students see their own published results, GPA and CGPA; lecturers upload scores; results move through departmental, HOD, Faculty Board and Senate approval before anyone can see them.

> **Status: pilot, not an official university service.** Branding is configuration (`NEXT_PUBLIC_*`), the grading scale is seeded as *unconfirmed*, and the seed contains synthetic data only. See the full specification for the open policy questions to settle with the Faculty first.

## Stack

Next.js 15 (App Router, server actions) · TypeScript · Tailwind CSS 4 · PostgreSQL · Prisma 6 · Zod · Argon2id · pdf-lib + qrcode · SheetJS + PapaParse · Vitest.

## Run it locally

Requirements: Node 20+, PostgreSQL 14+ (or Docker). Works on macOS 11 Big Sur and later: `package.json` pins esbuild to 0.25.x, because esbuild 0.27+ needs macOS 12.

```bash
# 1. Database
docker run -d --name buk-pg -e POSTGRES_USER=buk -e POSTGRES_PASSWORD=buk -e POSTGRES_DB=buk_results -p 5432:5432 postgres:16

# 2. App
cp .env.example .env          # set SESSION_SECRET to a long random string
npm install
npx prisma migrate dev --name init
npm run db:seed               # synthetic demo data + demo accounts
npm run dev                   # http://localhost:3000
```

Demo password for every seeded account: `Demo-Password-2026`

| Role | Sign in as |
| --- | --- |
| Student | `DEMO/24/0001` (student tab) |
| Lecturer | `LEC001` (staff tab) |
| Dept. result officers | `DROCSC`, `DROIFT`, `DROSWE` |
| HODs | `HODCSC`, `HODIFT`, `HODSWE` |
| Faculty admin | `ADMIN01` |
| Super admin | `SUPER01` |

Try the whole flow: `LEC001` opens **SWE 2201** (empty draft), downloads the template, fills it in and uploads it, then submits → `DROSWE` approves → `HODSWE` approves → `ADMIN01` records Faculty Board and Senate ratification, then publishes → `DEMO/24/0001` sees the new result and an updated CGPA. **CSC 2203** is already waiting for `DROCSC`.

## Tests

```bash
npm test          # grading engine, import validation, authorization and workflow rules
npm run typecheck
```

The grading engine (`lib/grading/engine.ts`) is the only place GPA, CGPA, standing and degree class are calculated. Its tests cover grade boundaries, exact rounding (`2.885 → 2.89`), unit-weighted CGPA, exclusions that must never count as zero, all three repeat policies, and degree-class edges.

## Project layout

```
app/                 pages, route handlers, server actions (thin)
  student/           dashboard, results, history, statement PDF, account
  staff/             overview, courses, review queue, students, audit log
  verify/            public statement verification (minimal disclosure)
lib/
  grading/           pure GPA/CGPA engine + policy parsing   ← tested
  import/            CSV/XLSX parsing + row validation       ← tested
  workflow.ts        approval stages and transitions          ← tested
  authz.ts           can(actor, action) policy                ← tested
  auth/              sessions, Argon2id, rate limiting
  services/          business operations (results, student record, snapshots, statements, admin)
prisma/              schema, seed, SQL grants
```

## Security notes

- Students are resolved from the session, never from a URL or request body. A foreign id returns 404.
- Every server action and route handler checks `can()`; buttons are hidden as a convenience only.
- Results are versioned. Publishing a correction supersedes (never overwrites) the old row, creates a new GPA snapshot and marks earlier statements *Superseded*.
- Run `prisma/sql/app-role-grants.sql` so the app's database role cannot update or delete `AuditLog` / `ApprovalAction`.
- Turn on TOTP MFA for staff (`User.mfaEnabled`, `User.mfaSecret`); a setup screen is Phase 2.
- Emails never contain results; wire your SMTP provider in `lib/services/notify.ts`.

## Configuration

| Setting (table `Setting`) | Default | Meaning |
| --- | --- | --- |
| `SHOW_RAW_SCORES` | `true` | Show numeric scores to students, or grades only |
| `WORKFLOW_OPTIONAL_STAGES` | all four | Which of Dept. review / HOD / Faculty Board / Senate are required |
| `MAINTENANCE_BANNER` | empty | Text shown on the home page |

The active `GradeScale` row defines bands, degree classes, standing, rounding and the repeat policy. Add a new version rather than editing an old one — results keep the scale they were graded under.

## Deploy

Any Node host + managed PostgreSQL (e.g. Vercel + Neon). Set the env vars from `.env.example`, run `npm run db:deploy` in the release step, then apply the SQL grants. Never load real student records into a non-production database.
