import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { requireAdmin, requireAuth } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../types';
import { Role, Grade, UserStatus } from '@prisma/client';

const router = Router();

const userSelect = { id: true, name: true, email: true, grade: true, role: true, status: true } as const;

// GET /users — admin: all doctors (active + pending); doctor: self
router.get('/', requireAuth, async (req: AuthRequest, res: Response) => {
  if (req.user?.role === 'ADMIN') {
    const users = await prisma.user.findMany({
      where: { role: Role.DOCTOR },
      select: userSelect,
      orderBy: [{ status: 'asc' }, { grade: 'asc' }, { name: 'asc' }],
    });
    res.json(users);
  } else {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: userSelect,
    });
    res.json(user);
  }
});

// POST /users — create doctor directly (admin only, immediately ACTIVE)
router.post('/', requireAdmin, async (req: AuthRequest, res: Response) => {
  const { name, email, password, grade } = req.body;
  if (!name || !email || !password || !grade) {
    res.status(400).json({ error: 'name, email, password, grade required' });
    return;
  }
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    res.status(409).json({ error: 'Email already in use' });
    return;
  }
  const user = await prisma.user.create({
    data: {
      name,
      email,
      password: bcrypt.hashSync(password, 10),
      role: Role.DOCTOR,
      grade: grade as Grade,
      status: UserStatus.ACTIVE,
    },
    select: userSelect,
  });
  res.status(201).json(user);
});

// PUT /users/:id/approve — approve a pending doctor (admin only)
router.put('/:id/approve', requireAdmin, async (req: AuthRequest, res: Response) => {
  const { grade } = req.body;
  const user = await prisma.user.update({
    where: { id: req.params.id },
    data: {
      status: UserStatus.ACTIVE,
      ...(grade ? { grade: grade as Grade } : {}),
    },
    select: userSelect,
  });
  res.json(user);
});

// DELETE /users/:id — remove doctor (admin only)
router.delete('/:id', requireAdmin, async (req: AuthRequest, res: Response) => {
  await prisma.user.delete({ where: { id: req.params.id } });
  res.json({ message: 'Deleted' });
});

export default router;
