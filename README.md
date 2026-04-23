# MediRoster

Hospital shift roster management system. Auto-generates monthly schedules, handles leave with automatic repair, and provides separate portals for admins and doctors.

## Stack

- **Frontend** — React 19, TypeScript, Vite 8, Tailwind CSS v4, TanStack Query v5, Zustand v5, Radix UI
- **Backend** — Node.js, Express, TypeScript, Prisma 5, PostgreSQL
- **Auth** — JWT access tokens (15 min) + refresh tokens (7 days)

---

## Quick Start

**Prerequisites:** Node.js 18+, PostgreSQL

```bash
# Install all dependencies (root workspaces)
npm install

# Create backend/.env
DATABASE_URL="postgresql://postgres:password@localhost:5432/hospital_roster"
JWT_SECRET="your-secret"
JWT_REFRESH_SECRET="your-refresh-secret"
PORT=4000

# Run migrations + seed (1 admin, 9 doctors)
npm run prisma:migrate --workspace=backend
npm run prisma:seed --workspace=backend

# Start dev servers
npm run dev:backend   # http://localhost:4000
npm run dev:frontend  # http://localhost:5173
```

### Production build

```bash
npm run build   # compiles frontend into frontend/dist/, then compiles backend
npm start       # NODE_ENV=production — Express serves frontend + API on port 4000
```

## Seed Credentials

| Role | Email | Password |
|---|---|---|
| Admin | admin@hospital.com | admin123 |
| Doctor (Senior) | alice / bob / charlie / diana @hospital.com | doctor123 |
| Doctor (Junior) | ethan / frank / grace / henry / irene @hospital.com | doctor123 |

---

## Architecture

### Directory structure

```
hospital-roster/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma          # DB models + enums
│   │   ├── seed.ts                # Seeds 1 admin + 9 doctors
│   │   └── migrations/
│   └── src/
│       ├── app.ts                 # Express entry point
│       ├── routes/
│       │   ├── auth.ts            # /api/auth
│       │   ├── users.ts           # /api/users
│       │   ├── roster.ts          # /api/roster
│       │   └── leave.ts           # /api/leave
│       ├── services/
│       │   ├── rosterEngine.ts    # Schedule generation algorithm
│       │   ├── rosterValidator.ts # Constraint checker (R1–R6)
│       │   └── rosterRepairer.ts  # Leave-approval repair logic
│       ├── middleware/
│       │   ├── auth.ts            # requireAuth / requireAdmin guards
│       │   └── errorHandler.ts    # Global error handler
│       └── lib/
│           └── prisma.ts          # Prisma client singleton
└── frontend/
    └── src/
        ├── apps/
        │   ├── admin/             # Admin portal (Layout + 4 pages)
        │   └── user/              # Doctor portal (Layout + 3 pages)
        ├── components/
        │   ├── RosterGrid.tsx     # Scrollable shift table
        │   ├── MonthPicker.tsx    # Horizontal month pill selector
        │   ├── ShiftBadge.tsx     # Coloured shift type pill
        │   └── ui/                # Button, Card, Badge, Input, Modal, Spinner
        ├── lib/
        │   └── api.ts             # Axios instance + token interceptors
        ├── store/
        │   ├── auth.ts            # Zustand auth store (sessionStorage)
        │   └── theme.ts           # Dark mode toggle
        ├── types/index.ts         # Shared TypeScript interfaces + enums
        └── router.tsx             # React Router v7 config + role guards
```

---

### Backend

**Entry point — `app.ts`**

Express is configured with:
- JSON body parsing
- CORS locked to `http://localhost:5173` in development only
- All routes prefixed `/api`
- In production (`NODE_ENV=production`) Express serves `frontend/dist/` as static files and catches all non-API routes with `index.html` (SPA fallback)
- Global `errorHandler` middleware catches any unhandled async errors via `express-async-errors`

---

**Database schema (Prisma)**

| Model | Key fields | Notes |
|---|---|---|
| `User` | `id`, `name`, `email`, `password`, `role` (ADMIN\|DOCTOR), `grade` (JUNIOR\|SENIOR\|null) | `grade` is null for admins |
| `Roster` | `id`, `month`, `year`, `status` (DRAFT\|PUBLISHED) | `@@unique([month, year])` — one roster per calendar month |
| `Shift` | `id`, `rosterId`, `userId`, `date`, `type` (MORNING\|NIGHT\|OFF\|WO\|LEAVE) | `@@unique([rosterId, userId, date])` — one shift per doctor per day |
| `Leave` | `id`, `userId`, `date`, `reason`, `status` (PENDING\|APPROVED\|REJECTED) | Approval triggers roster repair |

Cascade deletes: deleting a `Roster` removes all its `Shift` rows. Deleting a `User` removes their shifts and leave records.

---

**Authentication**

- `POST /api/auth/login` — verifies bcrypt password, returns a short-lived access token (15 min) + long-lived refresh token (7 days), plus the user object
- `POST /api/auth/refresh` — accepts a refresh token, issues a new access token
- `requireAuth` middleware — validates `Authorization: Bearer <token>` on every protected route; attaches `req.user` (`{ userId, role }`)
- `requireAdmin` middleware — calls `requireAuth` then checks `role === 'ADMIN'`; returns 403 otherwise

---

**Roster generation pipeline — `rosterEngine.ts`**

The core data structure is:

```ts
type DaySchedule = Record<string, ShiftType>; // userId → ShiftType
type RosterGrid  = DaySchedule[];             // index 0 = day 1 of the month
```

`generateRoster()` picks one of **12 pre-defined `TemplateParams`** at random on each call (varying `juniorOffset`, `seniorOffset`, `woShift`), so regenerating always produces a different schedule. It then runs five phases:

**Phase 1+2 — Night assignment + eager post-night OFF**

For each day, `pickRotationCandidate()` selects one Junior and one Senior for NIGHT using a round-robin offset from the template. A candidate is skipped if:
- They are already marked OFF (from yesterday's NIGHT recovery)
- They have a leave constraint on today
- They have a leave constraint on tomorrow (which would push the post-night OFF onto their leave day)

Immediately after assigning NIGHT, the next day's slot for both doctors is set to OFF. This eager write means Phase 1 can see the OFF when picking candidates for day+1, eliminating the need for a separate pass.

**Pre-mark leave days — between Phase 2 and 3**

After all NIGHT/OFF pairs are placed, any slot for a doctor with a leave constraint on that day is overwritten with LEAVE — unless it is NIGHT (that case is deferred to leave-approval repair).

**Phase 3 — WO distribution (6–7 per doctor)**

For each doctor, eligible days are those with no shift yet where at least one other same-grade doctor is available for MORNING. WOs are spread evenly across those days using an index step (`rotated.length / target`), shifted by `woShift` from the template for variety.

**Phase 4 — MORNING fill**

Every remaining empty slot is filled with MORNING.

**Phase 5 — Morning coverage repair**

For each day, if no Junior (or no Senior) is on MORNING, the first WO doctor of that grade on that day is converted to MORNING.

After generation, `validateRoster()` runs the full constraint check and returns any `Violation[]`. Violations are returned alongside the saved roster in the API response but do **not** block saving.

---

**Roster constraint rules**

| Rule | Description |
|---|---|
| R1 | Exactly 1 Junior + 1 Senior on NIGHT each day |
| R2 | Any doctor on NIGHT on day D must be OFF (or LEAVE) on day D+1 |
| R3 | At least 1 Junior + 1 Senior on MORNING each day |
| R4 | Each doctor must have 6–7 WOs per month |
| R5 | Every doctor must have a shift assigned every day |
| R6 | No doctor may have consecutive NIGHT shifts |

---

**Leave approval — `rosterRepairer.ts`**

When an admin approves a leave request, the route handler:

1. Fetches all shifts for that month from DB and reconstructs the in-memory `RosterGrid`
2. Calls `applyLeaveAndRepair(grid, doctorId, dayIndex, doctors)`:
   - Marks `grid[dayIndex][doctorId] = LEAVE`
   - **If the doctor was on NIGHT:** finds a same-grade replacement — prefers a MORNING doctor over a WO doctor, picks the one with the fewest nights this month to keep distribution balanced. The replacement is assigned NIGHT, given OFF the following day, and if that OFF displaces a WO, morning coverage for that next day is re-checked and repaired if needed. The approved doctor's own post-night OFF (if it existed) is lifted back to MORNING.
   - **If the doctor was on MORNING:** checks whether same-grade MORNING coverage still holds; if not, converts a same-grade WO doctor to MORNING.
3. Persists the entire repaired grid back to DB in a single Prisma `$transaction` using upserts on `[rosterId, userId, date]`

Doctors cannot submit leave for months where the roster is already PUBLISHED (enforced in `POST /api/leave`).

---

### Frontend

**Routing — `router.tsx`**

React Router v7 with two protected sub-trees:

```
/login              → LoginPage
/admin/*            → RequireRole(ADMIN) → AdminLayout
  /admin            → Dashboard
  /admin/roster     → RosterPage
  /admin/staff      → StaffPage
  /admin/leave      → LeavePage
/user/*             → RequireRole(DOCTOR) → UserLayout
  /user             → MyRosterPage
  /user/team        → TeamRosterPage
  /user/leave       → LeaveRequestPage
```

`RequireRole` reads from Zustand; unauthenticated users are redirected to `/login`, wrong-role users are redirected to their own portal root.

---

**API client — `lib/api.ts`**

Axios instance with `baseURL: '/api'` (Vite proxies `/api` → `http://localhost:4000` in dev).

- **Request interceptor** — reads `accessToken` from `sessionStorage` (`auth-store` key) and attaches `Authorization: Bearer <token>`
- **Response interceptor** — on a 401, attempts one silent refresh via `POST /api/auth/refresh` using the stored `refreshToken`, updates `sessionStorage`, and retries the original request. On failure, clears `sessionStorage` and redirects to `/login`

---

**State management**

| Store | Library | Persistence | Contents |
|---|---|---|---|
| `auth.ts` | Zustand + `persist` | `sessionStorage` | `user`, `accessToken`, `refreshToken`, `login()`, `logout()` |
| `theme.ts` | Zustand | `localStorage` | `dark` boolean, `toggle()` |

Server state (rosters, leaves, users) is managed entirely by **TanStack Query** with query keys like `['roster', month, year]` and `['leaves']`. Mutations invalidate relevant query keys on success.

---

**Key components**

| Component | Description |
|---|---|
| `RosterGrid` | Horizontally scrollable table; sticky doctor name column; click a shift cell to open the edit modal (admin only). Supports `filterGrade`, `filterShift`, `filterName` props. |
| `MonthPicker` | Horizontal pill row (Jan–Dec) with `◀ year ▶` stepper (min 2026). Selected pill gets indigo fill + checkmark. Admin variant (`admin-roster`) renders Publish/Unpublish, Copy Prev, and Clear action buttons inline. |
| `ShiftBadge` | Maps `ShiftType` → coloured rounded pill (sky=MORNING, indigo=NIGHT, slate=OFF, emerald=WO, rose=LEAVE) |
| `Button` | Variants: `primary` (indigo), `secondary` (bordered), `danger` (red), `ghost`. Sizes: `sm`, `md`, `lg`. Accepts `loading` prop to show spinner. |

---

## API Reference

All routes prefixed `/api`. Auth routes are public; all others require `Authorization: Bearer <token>`.

```
# Auth
POST   /api/auth/login              { email, password } → { accessToken, refreshToken, user }
POST   /api/auth/refresh            { refreshToken } → { accessToken }

# Users (admin only)
GET    /api/users                   → User[]
POST   /api/users                   { name, email, password, grade } → User
DELETE /api/users/:id

# Roster
POST   /api/roster/generate         admin — { month, year } → { roster, violations[] }
GET    /api/roster                  admin — → Roster[] (no shifts, summary only)
GET    /api/roster/:month/:year     auth — returns 404 for DRAFT rosters when called by a doctor
PUT    /api/roster/:id/publish      admin
PUT    /api/roster/:id/unpublish    admin
PUT    /api/roster/shift/:id        admin — { type } → manual shift override

# Leave
POST   /api/leave                   doctor — { date, reason } → Leave
GET    /api/leave                   admin: all leaves · doctor: own leaves only
PUT    /api/leave/:id/approve       admin — triggers roster repair
PUT    /api/leave/:id/reject        admin

# Health
GET    /api/health                  → { status: "ok" }
```

---

## Shift Color Coding

| Shift | Color | Meaning |
|---|---|---|
| MORNING | Sky blue | Standard day shift |
| NIGHT | Indigo | Overnight shift |
| OFF | Slate | Mandatory post-night rest day |
| WO | Emerald | Weekly off (6–7 per month) |
| LEAVE | Rose | Approved or pending leave |
