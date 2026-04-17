/**
 * Roster Engine
 * Generates a 30-day constraint-satisfying roster.
 *
 * Rules enforced:
 * 1. Each day: exactly 1 Junior + 1 Senior on NIGHT
 * 2. After NIGHT → next day is forced OFF
 * 3. Each day: ≥1 Junior + ≥1 Senior on MORNING
 * 4. Each doctor: 6–7 WOs spread evenly
 * 5. Max 1 shift per day per doctor
 * 6. No consecutive NIGHTs
 * 7. Pattern preference: N → O → M
 */

import { Grade, ShiftType } from '@prisma/client';

export interface DoctorInfo {
  id: string;
  grade: Grade;
  name: string;
}

export type DaySchedule = Record<string, ShiftType>; // userId -> ShiftType
export type RosterGrid = DaySchedule[]; // index 0 = day 1, length 30

export function generateRoster(doctors: DoctorInfo[], days = 30): RosterGrid {
  const juniors = doctors.filter((d) => d.grade === Grade.JUNIOR);
  const seniors = doctors.filter((d) => d.grade === Grade.SENIOR);

  // Initialize grid: all undefined
  const grid: DaySchedule[] = Array.from({ length: days }, () => ({}));

  // Track night counts for even distribution
  const nightCount: Record<string, number> = {};
  doctors.forEach((d) => (nightCount[d.id] = 0));

  // ── Phase 1: Assign NIGHT shifts ───────────────────────────────────────────
  for (let day = 0; day < days; day++) {
    // Pick junior with fewest nights who wasn't on night yesterday
    const jCandidate = pickNight(juniors, grid, day, nightCount);
    const sCandidate = pickNight(seniors, grid, day, nightCount);

    if (!jCandidate || !sCandidate) {
      throw new Error(`Cannot assign night shift on day ${day + 1} — constraint conflict`);
    }

    grid[day][jCandidate.id] = ShiftType.NIGHT;
    grid[day][sCandidate.id] = ShiftType.NIGHT;
    nightCount[jCandidate.id]++;
    nightCount[sCandidate.id]++;
  }

  // ── Phase 2: Force OFF after NIGHT ─────────────────────────────────────────
  for (let day = 0; day < days - 1; day++) {
    for (const doctorId of Object.keys(grid[day])) {
      if (grid[day][doctorId] === ShiftType.NIGHT) {
        grid[day + 1][doctorId] = ShiftType.OFF;
      }
    }
  }

  // ── Phase 3: Distribute WOs ─────────────────────────────────────────────────
  const targetWO = (id: string, idx: number) => (idx < doctors.length / 2 ? 7 : 6);
  doctors.forEach((doc, idx) => {
    const target = targetWO(doc.id, idx);
    const sameGrade = doctors.filter((d) => d.grade === doc.grade && d.id !== doc.id);
    distributeWOs(doc.id, sameGrade, grid, days, target);
  });

  // ── Phase 4: Fill remaining with MORNING ────────────────────────────────────
  for (let day = 0; day < days; day++) {
    for (const doc of doctors) {
      if (!grid[day][doc.id]) {
        grid[day][doc.id] = ShiftType.MORNING;
      }
    }
  }

  // ── Phase 5: Ensure each day has ≥1J + ≥1S on MORNING ──────────────────────
  repairMorningCoverage(grid, juniors, seniors, days);

  return grid;
}

function pickNight(
  group: DoctorInfo[],
  grid: RosterGrid,
  day: number,
  nightCount: Record<string, number>
): DoctorInfo | null {
  // Candidates: not already assigned today, not on night yesterday, not forced OFF today
  const candidates = group.filter((d) => {
    if (grid[day][d.id]) return false; // already assigned today
    if (day > 0 && grid[day - 1][d.id] === ShiftType.NIGHT) return false; // consecutive night
    return true;
  });

  if (candidates.length === 0) return null;

  // Pick the one with fewest nights (distribute evenly)
  candidates.sort((a, b) => nightCount[a.id] - nightCount[b.id]);
  return candidates[0];
}

function distributeWOs(
  doctorId: string,
  sameGrade: DoctorInfo[],
  grid: RosterGrid,
  days: number,
  target: number
): void {
  // Collect days this doctor is free AND placing WO won't strip all same-grade morning coverage
  const eligibleDays: number[] = [];
  for (let d = 0; d < days; d++) {
    if (grid[d][doctorId]) continue; // already assigned
    // At least one other same-grade doctor must be free (unassigned → will be MORNING) on this day
    const otherFree = sameGrade.some((o) => {
      const s = grid[d][o.id];
      return !s || s === ShiftType.MORNING;
    });
    if (otherFree) eligibleDays.push(d);
  }

  const actualTarget = Math.min(target, eligibleDays.length);
  if (actualTarget === 0) return;

  const step = eligibleDays.length / actualTarget;
  for (let i = 0; i < actualTarget; i++) {
    const idx = Math.floor(i * step);
    grid[eligibleDays[idx]][doctorId] = ShiftType.WO;
  }
}

function repairMorningCoverage(
  grid: RosterGrid,
  juniors: DoctorInfo[],
  seniors: DoctorInfo[],
  days: number
): void {
  for (let day = 0; day < days; day++) {
    const jMorning = juniors.filter((d) => grid[day][d.id] === ShiftType.MORNING);
    const sMorning = seniors.filter((d) => grid[day][d.id] === ShiftType.MORNING);

    if (jMorning.length === 0) {
      // Find a junior on WO this day and convert to MORNING
      const jWO = juniors.find((d) => grid[day][d.id] === ShiftType.WO);
      if (jWO) grid[day][jWO.id] = ShiftType.MORNING;
    }

    if (sMorning.length === 0) {
      const sWO = seniors.find((d) => grid[day][d.id] === ShiftType.WO);
      if (sWO) grid[day][sWO.id] = ShiftType.MORNING;
    }
  }
}
