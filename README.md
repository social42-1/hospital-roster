# MediRoster

Hospital shift roster management system. Auto-generates monthly schedules, handles leave with automatic repair, and provides separate portals for admins and doctors.

## Stack

- **Frontend** — React 19, TypeScript, Vite, Tailwind CSS v4, TanStack Query, Zustand
- **Backend** — Node.js, Express, TypeScript, Prisma 5, PostgreSQL
- **Auth** — JWT access + refresh tokens

## Quick Start

**Prerequisites:** Node.js 18+, PostgreSQL

```bash
# Install all dependencies
npm install

# Backend env — create backend/.env
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

## Seed Credentials

| Role | Email | Password |
|---|---|---|
| Admin | admin@hospital.com | admin123 |
| Doctor (any) | alice@hospital.com … irene@hospital.com | doctor123 |

## Features

**Admin Portal**
- Generate monthly rosters with one click; preview constraint violations before publishing
- Manually override any individual shift
- Approve/reject leave requests — approval auto-repairs the affected roster day
- Manage staff (add, remove, set Senior/Junior grade)

**Doctor Portal**
- Personal shift calendar view for any month
- Full team grid (published rosters only)
- Submit leave requests and track their status

## Roster Algorithm

Runs in five phases per month:
1. Assign NIGHT — 1 Junior + 1 Senior per day, no consecutive nights, max ~5–6 per doctor
2. Force OFF the day after every NIGHT shift
3. Distribute 6–7 WOs per doctor on remaining free days
4. Fill remaining days with MORNING
5. Repair — convert a WO to MORNING on any day short of minimum coverage

Leave approval finds a same-grade replacement for any vacated NIGHT slot and re-runs repair.

## API

```
POST  /api/auth/login
POST  /api/auth/refresh

GET   /api/users                   admin
POST  /api/users                   admin
DELETE /api/users/:id              admin

POST  /api/roster/generate         admin
GET   /api/roster                  admin — list all
GET   /api/roster/:month/:year
PUT   /api/roster/:id/publish
PUT   /api/roster/shift/:id        admin — manual override

POST  /api/leave                   doctor
GET   /api/leave
PUT   /api/leave/:id/approve       admin
PUT   /api/leave/:id/reject        admin
```
