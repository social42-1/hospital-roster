import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import { prisma } from '../lib/prisma';
import { Role, Grade, UserStatus } from '@prisma/client';

const router = Router();
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

function issueTokens(userId: string, role: string) {
  const payload = { userId, role };
  const accessToken = jwt.sign(payload, process.env.JWT_SECRET!, {
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
  } as jwt.SignOptions);
  const refreshToken = jwt.sign(payload, process.env.JWT_REFRESH_SECRET!, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  } as jwt.SignOptions);
  return { accessToken, refreshToken };
}

// POST /auth/login
router.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email || !password) {
    res.status(400).json({ error: 'Email and password required' });
    return;
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.password || !bcrypt.compareSync(password, user.password)) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  if (user.status === UserStatus.PENDING) {
    res.status(403).json({ error: 'Your account is pending admin approval' });
    return;
  }

  const { accessToken, refreshToken } = issueTokens(user.id, user.role);
  res.json({
    accessToken,
    refreshToken,
    user: { id: user.id, name: user.name, email: user.email, role: user.role, grade: user.grade },
  });
});

// POST /auth/signup — doctor self-registration (starts as PENDING)
router.post('/signup', async (req: Request, res: Response) => {
  const { name, email, password, grade } = req.body;
  if (!name || !email || !password || !grade) {
    res.status(400).json({ error: 'name, email, password and grade are required' });
    return;
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    res.status(409).json({ error: 'An account with this email already exists' });
    return;
  }

  await prisma.user.create({
    data: {
      name,
      email,
      password: bcrypt.hashSync(password, 10),
      role: Role.DOCTOR,
      grade: grade as Grade,
      status: UserStatus.PENDING,
    },
  });

  res.status(201).json({ message: 'Account created. An admin will review your request shortly.' });
});

// POST /auth/google — verify Google ID token, sign in or register
router.post('/google', async (req: Request, res: Response) => {
  const { credential } = req.body;
  if (!credential) {
    res.status(400).json({ error: 'Google credential required' });
    return;
  }

  const ticket = await googleClient.verifyIdToken({
    idToken: credential,
    audience: process.env.GOOGLE_CLIENT_ID,
  });
  const payload = ticket.getPayload();
  if (!payload?.email) {
    res.status(400).json({ error: 'Invalid Google token' });
    return;
  }

  // Find by googleId first, then fall back to email match
  let user = await prisma.user.findFirst({
    where: { OR: [{ googleId: payload.sub }, { email: payload.email }] },
  });

  if (!user) {
    // New user — register as PENDING doctor (no grade yet; admin sets it on approval)
    user = await prisma.user.create({
      data: {
        name: payload.name ?? payload.email,
        email: payload.email,
        googleId: payload.sub,
        role: Role.DOCTOR,
        status: UserStatus.PENDING,
      },
    });
    res.status(202).json({ pending: true, message: 'Account created. An admin will review your request shortly.' });
    return;
  }

  // Link Google ID if this is the first Google sign-in for an existing email user
  if (!user.googleId) {
    await prisma.user.update({ where: { id: user.id }, data: { googleId: payload.sub } });
  }

  if (user.status === UserStatus.PENDING) {
    res.status(403).json({ error: 'Your account is pending admin approval' });
    return;
  }

  const { accessToken, refreshToken } = issueTokens(user.id, user.role);
  res.json({
    accessToken,
    refreshToken,
    user: { id: user.id, name: user.name, email: user.email, role: user.role, grade: user.grade },
  });
});

// POST /auth/refresh
router.post('/refresh', (req: Request, res: Response) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    res.status(400).json({ error: 'Refresh token required' });
    return;
  }
  try {
    const payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET!) as {
      userId: string;
      role: string;
    };
    const accessToken = jwt.sign(
      { userId: payload.userId, role: payload.role },
      process.env.JWT_SECRET!,
      { expiresIn: process.env.JWT_EXPIRES_IN || '15m' } as jwt.SignOptions
    );
    res.json({ accessToken });
  } catch {
    res.status(401).json({ error: 'Invalid refresh token' });
  }
});

export default router;
