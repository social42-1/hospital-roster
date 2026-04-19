# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Root (npm workspaces)
```bash
npm run dev:backend      # Start backend dev server (port 4000)
npm run dev:frontend     # Start frontend dev server (port 5173)
npm run build            # Build both workspaces
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
```

## Architecture

This is a full-stack hospital shift roster application. The backend is an Express/TypeScript REST API backed by PostgreSQL via Prisma. The frontend is React + Vite + TailwindCSS.

### Backend (`backend/src/`)

**Entry point:** `app.ts` — mounts routes at `/auth`, `/users`, `/roster`, `/leave`, plus a `/health` endpoint. CORS is locked to `http://localhost:5173`.

**Auth model:** JWT access tokens + refresh tokens. `requireAuth` and `requireAdmin` middleware in `middleware/auth.ts` validate Bearer tokens from the `Authorization` header. Two roles: `ADMIN` and `DOCTOR`.

**Data model (Prisma):**
- `User` — ADMIN or DOCTOR role; doctors have a `grade` (JUNIOR | SENIOR)
- `Roster` — one per month/year, status DRAFT or PUBLISHED
- `Shift` — one per (roster, user, date); types: MORNING, NIGHT, OFF, WO (weekly off)
- `Leave` — doctor leave requests with PENDING/APPROVED/REJECTED status

**Roster generation pipeline** (`services/rosterEngine.ts`):
1. Phase 1: Assign NIGHT shifts — exactly 1 JUNIOR + 1 SENIOR per day, distributed evenly, no consecutive nights
2. Phase 2: Force OFF the day after a NIGHT shift
3. Phase 3: Distribute WOs (6–7 per doctor) on remaining free days
4. Phase 4: Fill all remaining slots with MORNING
5. Phase 5: Repair any days missing MORNING coverage (`repairMorningCoverage`)

After generation, `validateRoster` (`services/rosterValidator.ts`) checks all 6 constraint rules and returns a `Violation[]` array. Violations are returned alongside the roster in the API response but do not block saving.

**Leave approval flow** (`routes/leave.ts` → `services/rosterRepairer.ts`): When an admin approves leave, the system reconstructs the in-memory `RosterGrid` from DB shifts, calls `applyLeaveAndRepair` to mark the doctor as WO and find a same-grade replacement if the doctor was on NIGHT, then persists the entire repaired grid back via a Prisma `$transaction`.

### Frontend (`frontend/src/`)

**Routing** (`router.tsx`): Role-based guards via `RequireRole`. Two app trees:
- `/admin/*` — `AdminLayout` with pages: Dashboard, RosterPage, StaffPage, LeavePage
- `/user/*` — `UserLayout` with pages: MyRosterPage, TeamRosterPage, LeaveRequestPage

**State management:** Zustand (`store/auth.ts`) persisted to localStorage for auth state (user, accessToken, refreshToken). Server state via TanStack Query.

**API client** (`lib/api.ts`): Axios instance with base URL `/api` (proxied by Vite to the backend). Includes a 401 interceptor that auto-refreshes using the stored refreshToken before retrying the failed request.

**UI components:** Custom component library in `components/ui/` (Button, Badge, Card, Input, Modal, Spinner) built on Radix UI primitives + Tailwind. `ShiftBadge` maps `ShiftType` enum values to colored badges.

### Environment

Backend requires `backend/.env`:
```
DATABASE_URL="postgresql://..."
JWT_SECRET="..."
JWT_REFRESH_SECRET="..."
PORT=4000
```

Vite proxies `/api` → `http://localhost:4000` in dev so the frontend uses relative paths.

### Seed data
Default credentials after `npm run prisma:seed`:
- Admin: `admin@hospital.com` / `admin123`
- Doctors: `alice@hospital.com`, `bob@hospital.com`, etc. / `doctor123`
