import { Router, Response } from 'express';
import { requireAdmin, requireAuth } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../types';
import { LeaveStatus, Grade, RosterStatus, ShiftType } from '@prisma/client';
import { applyLeaveAndRepair } from '../services/rosterRepairer';
import { DoctorInfo, RosterGrid, DaySchedule } from '../services/rosterEngine';

const router = Router();

// POST /leave — doctor submits leave
router.post('/', requireAuth, async (req: AuthRequest, res: Response) => {
  const { date, reason } = req.body;
  if (!date || !reason) {
    res.status(400).json({ error: 'date and reason required' });
    return;
  }

  // Block submission if the roster for that month is already published
  const leaveDate = new Date(date);
  const month = leaveDate.getUTCMonth() + 1;
  const year = leaveDate.getUTCFullYear();

  const roster = await prisma.roster.findUnique({
    where: { month_year: { month, year } },
    select: { status: true },
  });

  if (roster?.status === RosterStatus.PUBLISHED) {
    res.status(409).json({
      error: 'The roster for this month is already published. Leave requests can only be submitted before the roster is published.',
    });
    return;
  }

  const leave = await prisma.leave.create({
    data: {
      userId: req.user!.userId,
      date: new Date(date),
      reason,
      status: LeaveStatus.PENDING,
    },
    include: { user: { select: { id: true, name: true, grade: true } } },
  });
  res.status(201).json(leave);
});

// GET /leave — admin: all; doctor: own
router.get('/', requireAuth, async (req: AuthRequest, res: Response) => {
  if (req.user?.role === 'ADMIN') {
    const leaves = await prisma.leave.findMany({
      include: { user: { select: { id: true, name: true, grade: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(leaves);
  } else {
    const leaves = await prisma.leave.findMany({
      where: { userId: req.user!.userId },
      orderBy: { date: 'asc' },
    });
    res.json(leaves);
  }
});

// PUT /leave/:id/approve — admin approves + triggers repair
router.put('/:id/approve', requireAdmin, async (req: AuthRequest, res: Response) => {
  const leave = await prisma.leave.findUnique({
    where: { id: req.params.id },
    include: { user: true },
  });
  if (!leave) {
    res.status(404).json({ error: 'Leave not found' });
    return;
  }

  const leaveDate = new Date(leave.date);
  const month = leaveDate.getUTCMonth() + 1;
  const year = leaveDate.getUTCFullYear();

  // Find the roster for that month
  const roster = await prisma.roster.findUnique({
    where: { month_year: { month, year } },
    include: {
      shifts: {
        include: { user: { select: { id: true, grade: true, name: true } } },
      },
    },
  });

  if (roster) {
    // Build grid from DB shifts
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const doctors = await prisma.user.findMany({
      where: { role: 'DOCTOR' },
      select: { id: true, grade: true, name: true },
    });
    const doctorInfos: DoctorInfo[] = doctors.map((d) => ({
      id: d.id,
      grade: d.grade as Grade,
      name: d.name,
    }));

    // Reconstruct grid
    const grid: RosterGrid = Array.from({ length: daysInMonth }, () => ({}));
    for (const shift of roster.shifts) {
      const d = new Date(shift.date);
      const dayIdx = d.getUTCDate() - 1;
      grid[dayIdx][shift.userId] = shift.type;
    }

    const dayIndex = leaveDate.getUTCDate() - 1;
    const repairedGrid = applyLeaveAndRepair(grid, leave.userId, dayIndex, doctorInfos);

    // Persist repaired shifts
    await prisma.$transaction(
      repairedGrid.flatMap((daySchedule, dayIdx) =>
        Object.entries(daySchedule).map(([userId, type]) =>
          prisma.shift.upsert({
            where: {
              rosterId_userId_date: {
                rosterId: roster.id,
                userId,
                date: new Date(Date.UTC(year, month - 1, dayIdx + 1)),
              },
            },
            update: { type: type as ShiftType },
            create: {
              rosterId: roster.id,
              userId,
              date: new Date(Date.UTC(year, month - 1, dayIdx + 1)),
              type: type as ShiftType,
            },
          })
        )
      )
    );
  }

  const updated = await prisma.leave.update({
    where: { id: req.params.id },
    data: { status: LeaveStatus.APPROVED },
    include: { user: { select: { id: true, name: true, grade: true } } },
  });
  res.json(updated);
});

// PUT /leave/:id/reject
router.put('/:id/reject', requireAdmin, async (req: AuthRequest, res: Response) => {
  const leave = await prisma.leave.update({
    where: { id: req.params.id },
    data: { status: LeaveStatus.REJECTED },
    include: { user: { select: { id: true, name: true, grade: true } } },
  });
  res.json(leave);
});

export default router;
