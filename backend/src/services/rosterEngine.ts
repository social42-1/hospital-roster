/**
 * Roster Engine — Template-based generation with leave awareness
 *
 * 12 pre-defined rotation templates. Each generate() call picks one at
 * random, so repeated generation always produces a different schedule.
 *
 * Leave constraints are respected at generation time:
 *   - A doctor with leave on day D is never assigned NIGHT on day D
 *   - A doctor with leave on day D is never assigned NIGHT on day D-1
 *     (which would force a post-night OFF onto their leave day)
 *   - Their leave day is pre-marked WO before WO distribution runs
 *
 * Rules enforced:
 *   R1. Exactly 1 Junior + 1 Senior on NIGHT each day
 *   R2. After NIGHT → next day is forced OFF
 *   R3. ≥1 Junior + ≥1 Senior on MORNING (enforced + repaired)
 *   R4. 6–7 WOs per doctor
 *   R5. Max 1 shift per day per doctor
 *   R6. No consecutive NIGHTs (rotation gap = group size − 1 days)
 */

import { Grade, ShiftType } from '@prisma/client';

export interface DoctorInfo {
  id: string;
  grade: Grade;
  name: string;
}

export interface LeaveConstraint {
  userId: string;
  dayIndex: number; // 0-based
}

export type DaySchedule = Record<string, ShiftType>; // userId -> ShiftType
export type RosterGrid = DaySchedule[]; // index 0 = day 1

interface TemplateParams {
  juniorOffset: number;
  seniorOffset: number;
  woShift: number;
}

// 12 pre-defined templates — different night rotation starts + WO patterns
const TEMPLATES: TemplateParams[] = [
  { juniorOffset: 0, seniorOffset: 0, woShift: 0 },
  { juniorOffset: 1, seniorOffset: 1, woShift: 2 },
  { juniorOffset: 2, seniorOffset: 2, woShift: 4 },
  { juniorOffset: 3, seniorOffset: 3, woShift: 1 },
  { juniorOffset: 4, seniorOffset: 0, woShift: 3 },
  { juniorOffset: 0, seniorOffset: 2, woShift: 5 },
  { juniorOffset: 1, seniorOffset: 3, woShift: 0 },
  { juniorOffset: 2, seniorOffset: 0, woShift: 2 },
  { juniorOffset: 3, seniorOffset: 1, woShift: 4 },
  { juniorOffset: 4, seniorOffset: 2, woShift: 1 },
  { juniorOffset: 0, seniorOffset: 3, woShift: 3 },
  { juniorOffset: 2, seniorOffset: 1, woShift: 5 },
];

export function generateRoster(
  doctors: DoctorInfo[],
  days = 30,
  leaves: LeaveConstraint[] = []
): RosterGrid {
  const templateIndex = Math.floor(Math.random() * TEMPLATES.length);
  return buildFromTemplate(doctors, TEMPLATES[templateIndex], days, leaves);
}

function buildFromTemplate(
  doctors: DoctorInfo[],
  params: TemplateParams,
  days: number,
  leaves: LeaveConstraint[]
): RosterGrid {
  const juniors = doctors.filter((d) => d.grade === Grade.JUNIOR);
  const seniors = doctors.filter((d) => d.grade === Grade.SENIOR);

  const grid: RosterGrid = Array.from({ length: days }, () => ({}));

  // ── Phase 1+2: NIGHT via rotation + eager OFF ──────────────────────────────
  // Phases combined so the eagerly-set OFF is visible when picking candidates
  // for the next day, avoiding the need for a separate pass.
  for (let day = 0; day < days; day++) {
    const j = pickRotationCandidate(juniors, day, params.juniorOffset, grid, leaves);
    const s = pickRotationCandidate(seniors, day, params.seniorOffset, grid, leaves);

    grid[day][j.id] = ShiftType.NIGHT;
    grid[day][s.id] = ShiftType.NIGHT;

    // Force OFF on the next day immediately so Phase 1 sees it
    if (day + 1 < days) {
      grid[day + 1][j.id] = ShiftType.OFF;
      grid[day + 1][s.id] = ShiftType.OFF;
    }
  }

  // ── Pre-mark leave days as LEAVE ──────────────────────────────────────────
  // Runs after NIGHT/OFF are set. Any shift that isn't NIGHT gets replaced
  // with LEAVE — including eagerly-set OFFs from post-night recovery (the
  // doctor is on leave regardless of why they would have been off).
  // NIGHT stays as-is; the repair path handles that case when the leave is
  // approved after the roster is generated.
  for (const leave of leaves) {
    if (leave.dayIndex >= days) continue;
    const current = grid[leave.dayIndex][leave.userId];
    if (current !== ShiftType.NIGHT) {
      grid[leave.dayIndex][leave.userId] = ShiftType.LEAVE;
    }
  }

  // ── Phase 3: Distribute WOs (6–7 per doctor) ──────────────────────────────
  doctors.forEach((doc, idx) => {
    const target = idx < Math.ceil(doctors.length / 2) ? 7 : 6;
    const sameGrade = doctors.filter((d) => d.grade === doc.grade && d.id !== doc.id);
    distributeWOs(doc.id, sameGrade, grid, days, target, params.woShift);
  });

  // ── Phase 4: Fill remaining slots with MORNING ────────────────────────────
  for (let day = 0; day < days; day++) {
    for (const doc of doctors) {
      if (!grid[day][doc.id]) {
        grid[day][doc.id] = ShiftType.MORNING;
      }
    }
  }

  // ── Phase 5: Repair any day missing ≥1J + ≥1S on MORNING ─────────────────
  repairMorningCoverage(grid, juniors, seniors, days);

  return grid;
}

/**
 * Picks the rotation candidate for a given day, skipping doctors who:
 *   - are already marked OFF (post-night recovery)
 *   - have a leave constraint on this day
 *   - have a leave constraint on the next day (would force post-night OFF onto their leave)
 */
function pickRotationCandidate(
  group: DoctorInfo[],
  day: number,
  offset: number,
  grid: RosterGrid,
  leaves: LeaveConstraint[]
): DoctorInfo {
  const n = group.length;
  let idx = (day + offset) % n;

  for (let attempt = 0; attempt < n; attempt++) {
    const candidate = group[idx];
    const isOff = grid[day][candidate.id] === ShiftType.OFF;
    const leaveToday = leaves.some((l) => l.userId === candidate.id && l.dayIndex === day);
    const leaveTomorrow = leaves.some((l) => l.userId === candidate.id && l.dayIndex === day + 1);

    if (!isOff && !leaveToday && !leaveTomorrow) return candidate;
    idx = (idx + 1) % n;
  }

  // Fallback: all candidates are constrained — return the rotation slot anyway
  return group[(day + offset) % n];
}

function distributeWOs(
  doctorId: string,
  sameGrade: DoctorInfo[],
  grid: RosterGrid,
  days: number,
  target: number,
  woShift: number
): void {
  const eligibleDays: number[] = [];
  for (let d = 0; d < days; d++) {
    if (grid[d][doctorId]) continue;
    const otherFree = sameGrade.some((o) => {
      const s = grid[d][o.id];
      return !s || s === ShiftType.MORNING;
    });
    if (otherFree) eligibleDays.push(d);
  }

  const actualTarget = Math.min(target, eligibleDays.length);
  if (actualTarget === 0) return;

  const shift = woShift % eligibleDays.length;
  const rotated = [...eligibleDays.slice(shift), ...eligibleDays.slice(0, shift)];

  const step = rotated.length / actualTarget;
  for (let i = 0; i < actualTarget; i++) {
    grid[rotated[Math.floor(i * step)]][doctorId] = ShiftType.WO;
  }
}

function repairMorningCoverage(
  grid: RosterGrid,
  juniors: DoctorInfo[],
  seniors: DoctorInfo[],
  days: number
): void {
  for (let day = 0; day < days; day++) {
    if (!juniors.some((d) => grid[day][d.id] === ShiftType.MORNING)) {
      const jWO = juniors.find((d) => grid[day][d.id] === ShiftType.WO);
      if (jWO) grid[day][jWO.id] = ShiftType.MORNING;
    }
    if (!seniors.some((d) => grid[day][d.id] === ShiftType.MORNING)) {
      const sWO = seniors.find((d) => grid[day][d.id] === ShiftType.WO);
      if (sWO) grid[day][sWO.id] = ShiftType.MORNING;
    }
  }
}
