import { Request } from 'express';

export interface AuthPayload {
  userId: string;
  role: 'ADMIN' | 'DOCTOR';
}

export interface AuthRequest extends Request {
  user?: AuthPayload;
}
