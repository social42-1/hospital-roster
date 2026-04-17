import { Router, Response } from 'express';
import { requireAdmin, requireAuth } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../types';
import { generateRoster, DoctorInfo } from '../services/rosterEngine';
import { validateRoster } from '../services/rosterValidator';
import { Grade, RosterStatus, ShiftType } from '@prisma/client';

const router = Router();

// POST /roster/generate — admin triggers generation
router.post('/generate', requireAdmin, async (req: AuthRequest, res: Response) => {
  const { month, year } = req.body; // month: 1–12
  if (!month || !year) {
    res.status(400).json({ error: 'month and year required' });
    return;
  }

  const existing = await prisma.roster.findUnique({ where: { month_year: { month, year } } });
  if (existing) {
    await prisma.roster.delete({ where: { id: existing.id } });
  }

  const doctors = await prisma.user.findMany({
    where: { role: 'DOCTOR' },
    select: { id: true, grade: true, name: true },
  });

  const doctorInfos: DoctorInfo[] = doctors.map((d) => ({
    id: d.id,
    grade: d.grade as Grade,
    name: d.name,
  }));

  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const grid = generateRoster(doctorInfos, daysInMonth);
  const violations = validateRoster(grid, doctorInfos);

  // Persist to DB
  const roster = await prisma.roster.create({
    data: {
      month,
      year,
      status: RosterStatus.DRAFT,
      shifts: {
        create: grid.flatMap((daySchedule, dayIdx) =>
          Object.entries(daySchedule).map(([userId, type]) => ({
            userId,
            date: new Date(Date.UTC(year, month - 1, dayIdx + 1)),
            type: type as ShiftType,
          }))
        ),
      },
    },
    include: { shifts: { include: { user: { select: { id: true, name: true, grade: true } } } } },
  });

  res.status(201).json({ roster, violations });
});

// GET /roster/:month/:year
router.get('/:month/:year', requireAuth, async (req: AuthRequest, res: Response) => {
  const month = parseInt(req.params.month);
  const year = parseInt(req.params.year);

  const roster = await prisma.roster.findUnique({
    where: { month_year: { month, year } },
    include: {
      shifts: {
        include: { user: { select: { id: true, name: true, grade: true } } },
        orderBy: { date: 'asc' },
      },
    },
  });

  if (!roster) {
    res.status(404).json({ error: 'Roster not found' });
    return;
  }

  // Doctors only see published rosters
  if (req.user?.role === 'DOCTOR' && roster.status !== RosterStatus.PUBLISHED) {
    res.status(404).json({ error: 'Roster not published yet' });
    return;
  }

  res.json(roster);
});

// PUT /roster/:id/publish — admin publishes draft
router.put('/:id/publish', requireAdmin, async (req: AuthRequest, res: Response) => {
  const roster = await prisma.roster.update({
    where: { id: req.params.id },
    data: { status: RosterStatus.PUBLISHED },
  });
  res.json(roster);
});

// PUT /roster/shift/:id — admin manual override
router.put('/shift/:id', requireAdmin, async (req: AuthRequest, res: Response) => {
  const { type } = req.body;
  const shift = await prisma.shift.update({
    where: { id: req.params.id },
    data: { type },
  });
  res.json(shift);
});

// GET /roster — list all rosters (admin)
router.get('/', requireAdmin, async (_req: AuthRequest, res: Response) => {
  const rosters = await prisma.roster.findMany({
    orderBy: [{ year: 'desc' }, { month: 'desc' }],
    select: { id: true, month: true, year: true, status: true, createdAt: true },
  });
  res.json(rosters);
});

export default router;
