# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Root (npm workspaces)
```bash
npm run dev:backend      # Start backend dev server (port 4000)
npm run dev:frontend     # Start frontend dev server (port 5173)
npm run build            # Build both workspaces (frontend then backend)
npm start                # Run production build: NODE_ENV=production node backend/dist/app.js
```

### Backend (`cd backend` or use `--workspace=backend`)
```bash
npm run dev              # ts-node-dev with hot reload
npm run build            # tsc compile to dist/
npm run start            # Run compiled dist/app.js
npm run prisma:generate  # Regenerate Prisma client after schema changes
npm run prisma:migrate   # Run migrations (dev)
npm run prisma:seed      # Seed DB with 1 admin + 5 junior + 4 senior doctors
```

### Frontend (`cd frontend` or use `--workspace=frontend`)
```bash
npm run dev              # Vite dev server
npm run build            # tsc + vite build
npm run lint             # ESLint
npm run preview          # Vite preview of production build
```

There are no automated tests in this project.

## Architecture

Full-stack hospital shift roster application. Backend: Express/TypeScript REST API + PostgreSQL via Prisma. Frontend: React + Vite + TailwindCSS.

### Backend (`backend/src/`)

**Entry point:** `app.ts` — all routes are prefixed `/api`: `/api/auth`, `/api/users`, `/api/roster`, `/api/leave`, `/api/health` (health check only). The README lists routes without the `/api` prefix — the actual paths always include it. In dev, CORS is locked to `http://localhost:5173`. In production (`NODE_ENV=production`), Express serves the built frontend from `frontend/dist/` and handles all non-API routes with `index.html`.

**Auth model:** JWT access tokens + refresh tokens. `requireAuth` and `requireAdmin` middleware in `middleware/auth.ts` validate Bearer tokens from the `Authorization` header. Two roles: `ADMIN` and `DOCTOR`.

**Data model (Prisma `schema.prisma`):**
- `User` — ADMIN or DOCTOR role; doctors have a `grade` (JUNIOR | SENIOR)
- `Roster` — one per month/year, status DRAFT or PUBLISHED; `@@unique([month, year])`
- `Shift` — one per (roster, user, date); types: MORNING, NIGHT, OFF, WO, LEAVE; `@@unique([rosterId, userId, date])`
- `Leave` — doctor leave requests with PENDING/APPROVED/REJECTED status

**Roster generation pipeline** (`services/rosterEngine.ts`):

The engine picks one of 12 pre-defined `TemplateParams` at random on each call, so repeated generation always produces a different schedule. Each template varies `juniorOffset`, `seniorOffset`, and `woShift` to rotate which doctors get which shifts.

1. Phase 1+2 (combined): Assign NIGHT via rotation, immediately force OFF on next day so it's visible for the next day's candidate selection — no consecutive nights, no assigning NIGHT to a doctor with a leave on that day or the following day
2. Pre-mark leave days: After NIGHT/OFF are placed, mark the doctor's leave day as LEAVE (unless they're on NIGHT — that case is handled during leave approval)
3. Phase 3: Distribute WOs (6–7 per doctor) on remaining free days
4. Phase 4: Fill all remaining slots with MORNING
5. Phase 5: Repair any days missing ≥1 Junior + ≥1 Senior on MORNING by converting a WO doctor to MORNING

After generation, `validateRoster` (`services/rosterValidator.ts`) checks all 6 constraint rules (R1–R6) and returns a `Violation[]` array. Violations are returned alongside the roster in the API response but do **not** block saving.

**Roster rules enforced:**
- R1: Exactly 1 Junior + 1 Senior on NIGHT each day
- R2: After NIGHT → next day must be OFF (or LEAVE)
- R3: ≥1 Junior + ≥1 Senior on MORNING each day
- R4: 6–7 WOs per doctor
- R5: Every doctor has a shift every day
- R6: No consecutive NIGHTs

**Leave approval flow** (`routes/leave.ts` → `services/rosterRepairer.ts`):
- Doctors cannot submit leave for months where the roster is already PUBLISHED
- When an admin approves leave, the system reconstructs the in-memory `RosterGrid` from DB shifts, calls `applyLeaveAndRepair` to mark the doctor as LEAVE
- If the doctor was on NIGHT: finds a same-grade replacement (prefers MORNING over WO doctor, picks the one with fewest nights), assigns them NIGHT, gives them OFF the next day, and repairs morning coverage if the replacement's next-day WO was converted to OFF
- The entire repaired grid is persisted back via a Prisma `$transaction` with upserts

### Frontend (`frontend/src/`)

**Routing** (`router.tsx`): Role-based guards via `RequireRole`. Two app trees:
- `/admin/*` — `AdminLayout` with pages: Dashboard, RosterPage, StaffPage, LeavePage
- `/user/*` — `UserLayout` with pages: MyRosterPage, TeamRosterPage, LeaveRequestPage

**State management:** Zustand (`store/auth.ts`) persisted to **sessionStorage** (not localStorage) for auth state (user, accessToken, refreshToken). Server state via TanStack Query.

**API client** (`lib/api.ts`): Axios instance with `baseURL: '/api'` (proxied by Vite to `http://localhost:4000` in dev). Request interceptor reads the token from `sessionStorage`. A 401 response interceptor auto-refreshes via `POST /api/auth/refresh` using the stored refreshToken and retries the original request; on failure it clears sessionStorage and redirects to `/login`.

**UI components:** Custom component library in `components/ui/` (Button, Badge, Card, Input, Modal, Spinner) built on Radix UI primitives + Tailwind. `ShiftBadge` maps `ShiftType` enum values to colored badges.

### Key type: `RosterGrid`

The in-memory roster representation used across the engine, validator, and repairer:
```ts
type DaySchedule = Record<string, ShiftType>; // userId → ShiftType
type RosterGrid = DaySchedule[];              // index 0 = day 1
```

When persisting, `grid[dayIdx]` entries become `Shift` rows with `date = UTC(year, month-1, dayIdx+1)`.

### Environment

Backend requires `backend/.env`:
```
DATABASE_URL="postgresql://..."
JWT_SECRET="..."
JWT_REFRESH_SECRET="..."
PORT=4000
```

### Seed data
Default credentials after `npm run prisma:seed`:
- Admin: `admin@hospital.com` / `admin123`
- Doctors: `alice@hospital.com`, `bob@hospital.com`, etc. / `doctor123`
