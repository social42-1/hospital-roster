export type Role = 'ADMIN' | 'DOCTOR';
export type Grade = 'JUNIOR' | 'SENIOR';
export type ShiftType = 'MORNING' | 'NIGHT' | 'OFF' | 'WO' | 'LEAVE';
export type RosterStatus = 'DRAFT' | 'PUBLISHED';
export type LeaveStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type UserStatus = 'PENDING' | 'ACTIVE';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  grade: Grade | null;
  status: UserStatus;
}

export interface ShiftUser {
  id: string;
  name: string;
  grade: Grade;
}

export interface Shift {
  id: string;
  userId: string;
  rosterId: string;
  date: string;
  type: ShiftType;
  user: ShiftUser;
}

export interface Roster {
  id: string;
  month: number;
  year: number;
  status: RosterStatus;
  shifts: Shift[];
  createdAt: string;
}

export interface Leave {
  id: string;
  userId: string;
  date: string;
  reason: string;
  status: LeaveStatus;
  createdAt: string;
  user?: ShiftUser;
}

export interface Violation {
  rule: string;
  day?: number;
  doctorId?: string;
  message: string;
}
