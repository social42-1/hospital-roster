# MediRoster

A production-ready hospital roster management system. Automatically generates monthly shift schedules for medical staff, handles leave requests with automatic schedule repair, and provides separate portals for admins and doctors.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19 + TypeScript + Vite 8 |
| Styling | Tailwind CSS v4 + Radix UI |
| State | TanStack Query + Zustand |
| Backend | Node.js + Express + TypeScript |
| ORM | Prisma 5 |
| Database | PostgreSQL |
| Auth | JWT (access + refresh tokens) |

---

## Project Structure

```
hospital-roster/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma        # DB models
│   │   ├── seed.ts              # Seed admin + 9 doctors
│   │   └── migrations/
│   └── src/
│       ├── routes/              # auth, users, roster, leave
│       ├── services/
│       │   ├── rosterEngine.ts  # Core scheduling algorithm
│       │   ├── rosterValidator.ts
│       │   └── rosterRepairer.ts
│       └── middleware/          # JWT auth, error handling
└── frontend/
    └── src/
        ├── apps/
        │   ├── admin/           # Admin portal
        │   └── user/            # Doctor portal
        ├── components/          # RosterGrid, ShiftBadge, UI primitives
        ├── lib/                 # Axios client
        └── store/               # Zustand auth store
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL running locally

### 1. Backend

```bash
cd backend
npm install
```

Create a `.env` file:

```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/hospital_roster"
JWT_SECRET="your-secret-key"
JWT_REFRESH_SECRET="your-refresh-secret"
PORT=4000
```

Run migrations and seed the database:

```bash
npx prisma migrate dev --name init
npx ts-node prisma/seed.ts
```

Start the dev server:

```bash
npm run dev        # runs on http://localhost:4000
```

### 2. Frontend

```bash
cd frontend
npm install
npm run dev        # runs on http://localhost:5173
```

The frontend proxies `/api` requests to `http://localhost:4000`.

---

## Seed Credentials

| Role | Email | Password |
|---|---|---|
| Admin | admin@hospital.com | admin123 |
| Doctor (Senior) | alice@hospital.com | doctor123 |
| Doctor (Senior) | bob@hospital.com | doctor123 |
| Doctor (Senior) | charlie@hospital.com | doctor123 |
| Doctor (Senior) | diana@hospital.com | doctor123 |
| Doctor (Junior) | ethan@hospital.com | doctor123 |
| Doctor (Junior) | frank@hospital.com | doctor123 |
| Doctor (Junior) | grace@hospital.com | doctor123 |
| Doctor (Junior) | henry@hospital.com | doctor123 |
| Doctor (Junior) | irene@hospital.com | doctor123 |

---

## Features

### Admin Portal (`/admin`)
- **Dashboard** — monthly stats: night coverage, WO distribution, leave requests
- **Roster** — generate a monthly schedule, preview constraint violations, publish to doctors, manually override any individual shift
- **Staff** — add, view, and remove doctors; assign Senior/Junior grade
- **Leave Management** — approve or reject pending leave requests; approval automatically repairs the roster

### Doctor Portal (`/user`)
- **My Roster** — personal shift calendar for the selected month
- **Team Roster** — read-only view of the full team grid (published rosters only)
- **Leave Request** — submit a leave for a specific date with a reason; track approval status

---

## Roster Generation Algorithm

Schedules are generated in five phases for each month:

1. **Night shifts** — assign exactly 1 Junior + 1 Senior per day, distributed evenly (max 5–6 nights per doctor), no consecutive nights
2. **Post-night OFFs** — any doctor on NIGHT on day D gets day D+1 forced to OFF
3. **Weekend Offs (WO)** — 6–7 WOs per doctor, spread with minimum gaps; only placed when at least one other same-grade doctor remains available for morning
4. **Morning fill** — remaining unassigned days become MORNING
5. **Repair** — if any day is short on morning coverage, a WO is converted to MORNING

When a leave is approved, the engine finds an eligible same-grade replacement for the vacated night shift and re-runs repair on the affected day.

---

## API Reference

```
POST   /auth/login
POST   /auth/refresh

GET    /users                    admin only
POST   /users                    admin only
DELETE /users/:id                admin only

POST   /roster/generate          admin — generate for month/year
GET    /roster/:month/:year      returns 404 for unpublished (doctors)
PUT    /roster/:id/publish
PUT    /roster/shift/:id         admin — manual shift override
GET    /roster                   admin — list all rosters

POST   /leave                    doctor — submit leave
GET    /leave                    admin: all leaves · doctor: own leaves
PUT    /leave/:id/approve        admin — triggers roster repair
PUT    /leave/:id/reject
```

---

## Shift Color Coding

| Shift | Color |
|---|---|
| MORNING | Sky blue |
| NIGHT | Indigo |
| OFF | Slate |
| WO (Weekend Off) | Emerald |
