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

### 1. System Overview

```mermaid
graph TD
    Browser["Browser"]

    subgraph Dev["Development"]
        Vite["Vite Dev Server\n:5173"]
        Proxy["Proxy /api → :4000"]
    end

    subgraph Prod["Production"]
        Express["Express :4000\nserves frontend/dist/"]
    end

    subgraph Backend["Backend (Express + TypeScript)"]
        Auth["routes/auth.ts\nPOST /api/auth/*"]
        Users["routes/users.ts\nGET|POST|DELETE /api/users"]
        Roster["routes/roster.ts\nGET|POST|PUT /api/roster/*"]
        Leave["routes/leave.ts\nGET|POST|PUT /api/leave/*"]

        Engine["rosterEngine.ts\n5-phase generator"]
        Validator["rosterValidator.ts\nR1–R6 checks"]
        Repairer["rosterRepairer.ts\nleave repair"]

        MW["middleware/auth.ts\nrequireAuth / requireAdmin"]
    end

    Prisma["Prisma ORM"]
    DB[("PostgreSQL")]

    Browser -->|dev| Vite
    Vite --> Proxy --> Backend
    Browser -->|prod| Express --> Backend
    Auth & Users & Roster & Leave --> MW
    Roster --> Engine --> Validator
    Leave --> Repairer
    Backend --> Prisma --> DB
```

---

### 2. Directory Structure

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
│       │   ├── auth.ts            # /api/auth — login + refresh
│       │   ├── users.ts           # /api/users — CRUD doctors
│       │   ├── roster.ts          # /api/roster — generate, publish, shift edit
│       │   └── leave.ts           # /api/leave — submit, approve, reject
│       ├── services/
│       │   ├── rosterEngine.ts    # 5-phase schedule generator
│       │   ├── rosterValidator.ts # Constraint checker (R1–R6)
│       │   └── rosterRepairer.ts  # Leave-approval roster repair
│       ├── middleware/
│       │   ├── auth.ts            # requireAuth / requireAdmin
│       │   └── errorHandler.ts    # Global async error handler
│       └── lib/
│           └── prisma.ts          # Prisma client singleton
└── frontend/
    └── src/
        ├── apps/
        │   ├── admin/             # AdminLayout + Dashboard, Roster, Staff, Leave
        │   └── user/              # UserLayout + MyRoster, TeamRoster, LeaveRequest
        ├── components/
        │   ├── RosterGrid.tsx     # Scrollable shift table
        │   ├── MonthPicker.tsx    # Horizontal month pill selector
        │   ├── ShiftBadge.tsx     # Coloured shift type pill
        │   ├── Toast.tsx          # Toast notification provider + hook
        │   └── ui/                # Button, Card, Badge, Input, Modal, Spinner
        ├── lib/
        │   └── api.ts             # Axios instance + request/response interceptors
        ├── store/
        │   ├── auth.ts            # Zustand auth store → sessionStorage
        │   └── theme.ts           # Zustand dark mode → localStorage
        ├── types/index.ts         # Shared TS interfaces + enums
        └── router.tsx             # React Router v7 + RequireRole guards
```

---

### 3. Database Schema

```mermaid
erDiagram
    User {
        string id PK
        string name
        string email UK
        string password
        Role role
        Grade grade "nullable — null for ADMIN"
        DateTime createdAt
        DateTime updatedAt
    }

    Roster {
        string id PK
        int month "1–12"
        int year
        RosterStatus status "DRAFT | PUBLISHED"
        DateTime createdAt
        DateTime updatedAt
    }

    Shift {
        string id PK
        string rosterId FK
        string userId FK
        Date date
        ShiftType type "MORNING|NIGHT|OFF|WO|LEAVE"
    }

    Leave {
        string id PK
        string userId FK
        Date date
        string reason
        LeaveStatus status "PENDING|APPROVED|REJECTED"
        DateTime createdAt
        DateTime updatedAt
    }

    User ||--o{ Shift : "has"
    User ||--o{ Leave : "requests"
    Roster ||--o{ Shift : "contains"
```

**Constraints:**
- `Roster @@unique([month, year])` — one roster per calendar month
- `Shift @@unique([rosterId, userId, date])` — one shift per doctor per day
- `User.email` is unique
- Cascade deletes: `Roster` → `Shift`; `User` → `Shift`, `Leave`

---

### 4. Authentication Flow

```mermaid
sequenceDiagram
    participant B as Browser
    participant A as api.ts (Axios)
    participant BE as Express Backend
    participant DB as PostgreSQL

    Note over B,DB: Login
    B->>A: login(email, password)
    A->>BE: POST /api/auth/login
    BE->>DB: findUnique({ where: { email } })
    DB-->>BE: User row
    BE->>BE: bcrypt.compareSync(password, hash)
    BE-->>A: { accessToken (15m), refreshToken (7d), user }
    A->>B: store in sessionStorage (auth-store)

    Note over B,DB: Authenticated Request
    B->>A: api.get('/roster/4/2026')
    A->>A: read accessToken from sessionStorage
    A->>BE: GET /api/roster/4/2026\nAuthorization: Bearer <accessToken>
    BE->>BE: requireAuth — jwt.verify(token, JWT_SECRET)
    BE->>DB: query shifts
    DB-->>BE: data
    BE-->>A: 200 roster data
    A-->>B: response

    Note over B,DB: Token Expired — Silent Refresh
    B->>A: api.get('/roster/4/2026')
    A->>BE: GET /api/roster/4/2026 (expired token)
    BE-->>A: 401 Unauthorized
    A->>A: _retry guard — attempt once
    A->>BE: POST /api/auth/refresh\n{ refreshToken }
    BE->>BE: jwt.verify(refreshToken, JWT_REFRESH_SECRET)
    BE-->>A: { accessToken (new) }
    A->>A: update sessionStorage with new accessToken
    A->>BE: retry GET /api/roster/4/2026 (new token)
    BE-->>A: 200 roster data
    A-->>B: transparent response

    Note over B,DB: Refresh Fails → Logout
    A->>BE: POST /api/auth/refresh (invalid/expired)
    BE-->>A: 401
    A->>A: sessionStorage.clear()
    A->>B: window.location.href = '/login'
```

**Auth middleware chain:**

| Middleware | Check | On fail |
|---|---|---|
| `requireAuth` | `Authorization: Bearer <token>` header present + `jwt.verify()` passes | 401 |
| `requireAdmin` | calls `requireAuth` then checks `req.user.role === 'ADMIN'` | 403 |

---

### 5. Frontend Routing

```mermaid
graph LR
    Root["/"] -->|redirect| Login["/login\nLoginPage"]

    Login -->|role=ADMIN| Admin
    Login -->|role=DOCTOR| User

    subgraph Admin["RequireRole: ADMIN"]
        AL["AdminLayout\nsidebar + outlet"]
        AL --> D["/admin\nDashboard"]
        AL --> R["/admin/roster\nRosterPage"]
        AL --> S["/admin/staff\nStaffPage"]
        AL --> L["/admin/leave\nLeavePage"]
    end

    subgraph User["RequireRole: DOCTOR"]
        UL["UserLayout\nsidebar + outlet"]
        UL --> MR["/user\nMyRosterPage"]
        UL --> TR["/user/team\nTeamRosterPage"]
        UL --> LR["/user/leave\nLeaveRequestPage"]
    end

    style Admin fill:#eef2ff,stroke:#6366f1
    style User fill:#f0fdf4,stroke:#22c55e
```

`RequireRole` logic: if `useAuthStore().user` is null → redirect `/login`; if role mismatch → redirect to own portal root (`/admin` or `/user`).

---

### 6. Backend — Entry Point (`app.ts`)

```
Request
  │
  ├─ CORS (dev only — origin: http://localhost:5173)
  ├─ express.json()
  ├─ /api/auth   → routes/auth.ts    (public)
  ├─ /api/users  → routes/users.ts   (requireAuth / requireAdmin)
  ├─ /api/roster → routes/roster.ts  (requireAuth / requireAdmin)
  ├─ /api/leave  → routes/leave.ts   (requireAuth / requireAdmin)
  ├─ /api/health → 200 { status: ok }
  ├─ [prod] express.static(frontend/dist/)
  ├─ [prod] * → index.html (SPA fallback)
  └─ errorHandler (express-async-errors catches all throws)
```

---

### 7. API Routes — Full Detail

#### Auth (`routes/auth.ts`)

| Method | Path | Auth | Request | Response |
|---|---|---|---|---|
| POST | `/api/auth/login` | public | `{ email, password }` | `{ accessToken, refreshToken, user }` |
| POST | `/api/auth/refresh` | public | `{ refreshToken }` | `{ accessToken }` |

#### Users (`routes/users.ts`)

| Method | Path | Auth | Request | Response | Notes |
|---|---|---|---|---|---|
| GET | `/api/users` | requireAuth | — | `User[]` | ADMIN sees all doctors; DOCTOR sees only self |
| POST | `/api/users` | requireAdmin | `{ name, email, password, grade }` | `User` | bcrypt hash cost 10; grade must be JUNIOR or SENIOR |
| DELETE | `/api/users/:id` | requireAdmin | — | `{ message }` | Cascade deletes shifts + leaves |

#### Roster (`routes/roster.ts`)

| Method | Path | Auth | Request | Response | Notes |
|---|---|---|---|---|---|
| POST | `/api/roster/generate` | requireAdmin | `{ month, year }` | `{ roster, violations[] }` | Deletes existing roster first; runs engine + validator |
| GET | `/api/roster` | requireAdmin | — | `Roster[]` | Summary only (no shifts); ordered year/month desc |
| GET | `/api/roster/:month/:year` | requireAuth | — | `Roster` with `shifts[]` | Doctors get 404 for DRAFT rosters |
| PUT | `/api/roster/:id/publish` | requireAdmin | — | `Roster` | DRAFT → PUBLISHED |
| PUT | `/api/roster/:id/unpublish` | requireAdmin | — | `Roster` | PUBLISHED → DRAFT |
| PUT | `/api/roster/shift/:id` | requireAdmin | `{ type: ShiftType }` | `Shift` | Manual single-shift override |

#### Leave (`routes/leave.ts`)

| Method | Path | Auth | Request | Response | Notes |
|---|---|---|---|---|---|
| POST | `/api/leave` | requireAuth | `{ date, reason }` | `Leave` | Blocked if roster for that month is PUBLISHED |
| GET | `/api/leave` | requireAuth | — | `Leave[]` | ADMIN: all leaves + user details; DOCTOR: own only |
| PUT | `/api/leave/:id/approve` | requireAdmin | — | `Leave` | Triggers `applyLeaveAndRepair` + DB transaction |
| PUT | `/api/leave/:id/reject` | requireAdmin | — | `Leave` | Status → REJECTED; no roster changes |

---

### 8. Roster Generation Pipeline

```mermaid
flowchart TD
    A([Admin: POST /roster/generate]) --> B[Fetch all doctors + leave constraints]
    B --> C[Pick 1 of 12 TemplateParams at random\njuniorOffset · seniorOffset · woShift]
    C --> D

    subgraph Engine["rosterEngine.ts — buildFromTemplate()"]
        D["Phase 1+2: For each day\npickRotationCandidate → assign NIGHT\neagerly write OFF on day+1"]
        D --> E["Pre-mark: overwrite leave days with LEAVE\n(skip if already NIGHT)"]
        E --> F["Phase 3: distributeWOs per doctor\n6–7 WOs · index-step spread · woShift rotation"]
        F --> G["Phase 4: fill remaining slots → MORNING"]
        G --> H["Phase 5: repair missing morning coverage\nconvert WO → MORNING if no junior or senior on MORNING"]
    end

    H --> I["validateRoster() — check R1–R6\nreturn Violation[]"]
    I --> J["Prisma: create Roster + Shifts in DB\nstatus = DRAFT"]
    J --> K([Response: roster + violations])
```

**`pickRotationCandidate` skip conditions:**

A doctor is skipped for NIGHT on day D if any of these are true:
1. `grid[D][doctor] === OFF` — still recovering from yesterday's NIGHT
2. Leave constraint exists for day D — they are on leave that day
3. Leave constraint exists for day D+1 — assigning them NIGHT would force OFF onto their leave day

If all candidates are constrained, the raw rotation slot is used as a fallback.

**`distributeWOs` formula:**

```
step = eligibleDays.length / target
WO assigned at: rotated[ floor(i * step) ] for i in 0..target-1
```

The `rotated` array is `eligibleDays` shifted by `woShift % eligibleDays.length`, ensuring different templates produce different WO patterns.

---

### 9. Roster Constraint Rules

| Rule | What is checked |
|---|---|
| R1 | Exactly 1 Junior + exactly 1 Senior on NIGHT per day |
| R2 | Every doctor on NIGHT on day D must be OFF or LEAVE on day D+1 |
| R3 | At least 1 Junior + at least 1 Senior on MORNING per day |
| R4 | Each doctor has between 6 and 7 WO shifts for the month |
| R5 | Every doctor has a shift assigned for every day of the month |
| R6 | No doctor has NIGHT on two consecutive days |

Violations are returned in the API response alongside the saved roster but do **not** block saving or publishing.

---

### 10. Leave Approval & Roster Repair

```mermaid
sequenceDiagram
    participant Admin
    participant BE as Backend (routes/leave.ts)
    participant Rep as rosterRepairer.ts
    participant DB as PostgreSQL

    Admin->>BE: PUT /api/leave/:id/approve
    BE->>DB: fetch leave record (userId, date)
    BE->>DB: fetch all shifts for that month
    BE->>BE: reconstruct RosterGrid from shifts
    BE->>Rep: applyLeaveAndRepair(grid, doctorId, dayIndex, doctors)

    alt Doctor was on NIGHT
        Rep->>Rep: Find same-grade replacement\n(MORNING preferred over WO;\nfewest nights this month wins)
        Rep->>Rep: replacement → NIGHT
        Rep->>Rep: replacement[day+1] → OFF
        Rep->>Rep: if day+1 was WO: re-check morning coverage\nconvert another WO → MORNING if needed
        Rep->>Rep: lift doctor's post-night OFF → MORNING
    else Doctor was on MORNING
        Rep->>Rep: check same-grade MORNING coverage\nif missing: convert a WO → MORNING
    end

    Rep->>Rep: grid[dayIndex][doctorId] = LEAVE
    Rep-->>BE: repaired RosterGrid
    BE->>DB: $transaction: upsert all shifts\n(key: rosterId + userId + date)
    BE->>DB: update leave status → APPROVED
    BE-->>Admin: { leave }
```

**Replacement selection priority (NIGHT case):**

```
candidates = same-grade doctors where:
  - today's shift is MORNING (preferred) or WO (fallback)
  - yesterday was NOT NIGHT (no consecutive nights)

sorted by: nightCount ascending (most rested first)
```

---

### 11. Frontend State Management

#### Zustand Stores

| Store | File | Persisted to | State | Actions |
|---|---|---|---|---|
| Auth | `store/auth.ts` | `sessionStorage` (key: `auth-store`) | `user`, `accessToken`, `refreshToken` | `login(email, pw)`, `logout()` |
| Theme | `store/theme.ts` | `localStorage` (key: `theme-store`) | `isDark` | `toggle()` |

`logout()` calls `sessionStorage.clear()` — no backend call needed since tokens are stateless JWTs.

#### TanStack Query Key Registry

| Query Key | Data | Used in |
|---|---|---|
| `['rosters']` | All rosters (summary, no shifts) | Dashboard, invalidated after generate/publish |
| `['roster', month, year]` | Single roster with full shifts | RosterPage, MyRosterPage, TeamRosterPage |
| `['users']` | All doctors | StaffPage, Dashboard |
| `['leaves']` | All leaves (admin) | LeavePage, Dashboard |
| `['my-leaves']` | Own leaves (doctor) | LeaveRequestPage |

All queries use `retry: false` for 404 cases (unpublished roster). Mutations call `qc.invalidateQueries()` on success to keep cache consistent.

---

### 12. API Client (`lib/api.ts`)

```
Outgoing request:
  1. Read sessionStorage['auth-store']
  2. Extract state.accessToken
  3. Attach Authorization: Bearer <token>

Incoming 401 response:
  1. Check _retry flag (prevent infinite loop)
  2. Read state.refreshToken from sessionStorage
  3. POST /api/auth/refresh { refreshToken }
  4a. Success → update accessToken in sessionStorage → retry original request
  4b. Failure → sessionStorage.clear() → redirect to /login
```

Vite proxies all `/api` requests to `http://localhost:4000` in development, so the Axios `baseURL: '/api'` works identically in dev and production.

---

### 13. Key Components

#### `RosterGrid`

| Prop | Type | Description |
|---|---|---|
| `roster` | `Roster` | Full roster object with shifts |
| `onShiftClick?` | `(info: ShiftClickInfo) => void` | Called on cell click (admin edit modal) |
| `filterGrade?` | `Grade \| null` | Hide doctors not matching grade |
| `filterShift?` | `ShiftType \| null` | Dim cells not matching shift type |
| `filterName?` | `string` | Filter doctors by name substring |

Doctors are sorted seniors-first, then alphabetically within grade. Shift lookup is memoized into a `Record<userId, Record<dateKey, {id, type}>>` map. The leftmost doctor name column is CSS `sticky` to stay visible during horizontal scroll.

#### `MonthPicker`

| Prop | Type | Description |
|---|---|---|
| `variant` | `'admin-roster' \| 'team-roster' \| 'my-roster'` | Controls which action buttons appear |
| `selectedMonth` | `number` | 1–12 |
| `selectedYear` | `number` | Min 2026 (◀ disabled at floor) |
| `onMonthChange` | `(m: number) => void` | |
| `onYearChange` | `(y: number) => void` | |
| `onPublish?` | `() => void` | admin-roster only |
| `onCopyPrev?` | `() => void` | admin-roster only |
| `onClear?` | `() => void` | admin-roster only |
| `hasRoster?` | `boolean` | Controls visibility of Clear + Publish buttons |
| `rosterStatus?` | `RosterStatus` | Switches Publish ↔ Unpublish label |

#### `ShiftBadge`

Maps `ShiftType` to a coloured inline pill:

| ShiftType | Colour |
|---|---|
| MORNING | Sky blue |
| NIGHT | Indigo |
| OFF | Slate |
| WO | Emerald |
| LEAVE | Rose |

#### `Button`

| Prop | Values | Default |
|---|---|---|
| `variant` | `primary` · `secondary` · `danger` · `ghost` | `primary` |
| `size` | `sm` · `md` · `lg` | `md` |
| `loading` | `boolean` | `false` — shows `Loader2` spinner, disables button |

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
