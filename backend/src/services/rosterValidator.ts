import { Grade, ShiftType } from '@prisma/client';
import { DoctorInfo, DaySchedule, RosterGrid } from './rosterEngine';

export interface Violation {
  rule: string;
  day?: number;
  doctorId?: string;
  message: string;
}

export function validateRoster(
  grid: RosterGrid,
  doctors: DoctorInfo[]
): Violation[] {
  const violations: Violation[] = [];
  const juniors = doctors.filter((d) => d.grade === Grade.JUNIOR);
  const seniors = doctors.filter((d) => d.grade === Grade.SENIOR);

  for (let day = 0; day < grid.length; day++) {
    const schedule = grid[day];

    // Rule 1: Exactly 1 Junior + 1 Senior on NIGHT
    const nightJuniors = juniors.filter((d) => schedule[d.id] === ShiftType.NIGHT);
    const nightSeniorsFixed = seniors.filter((d) => schedule[d.id] === ShiftType.NIGHT);

    if (nightJuniors.length !== 1) {
      violations.push({ rule: 'R1', day, message: `Day ${day + 1}: Need exactly 1 Junior on Night, got ${nightJuniors.length}` });
    }
    if (nightSeniorsFixed.length !== 1) {
      violations.push({ rule: 'R1', day, message: `Day ${day + 1}: Need exactly 1 Senior on Night, got ${nightSeniorsFixed.length}` });
    }

    // Rule 2: After NIGHT → must be OFF next day
    if (day < grid.length - 1) {
      for (const doc of doctors) {
        if (schedule[doc.id] === ShiftType.NIGHT && grid[day + 1][doc.id] !== ShiftType.OFF) {
          violations.push({ rule: 'R2', day, doctorId: doc.id, message: `${doc.name} on Night day ${day + 1} but not OFF on day ${day + 2}` });
        }
      }
    }

    // Rule 3: At least 1J + 1S on MORNING
    const morningJuniors = juniors.filter((d) => schedule[d.id] === ShiftType.MORNING);
    const morningSeniors = seniors.filter((d) => schedule[d.id] === ShiftType.MORNING);
    if (morningJuniors.length < 1) {
      violations.push({ rule: 'R3', day, message: `Day ${day + 1}: No Junior on Morning` });
    }
    if (morningSeniors.length < 1) {
      violations.push({ rule: 'R3', day, message: `Day ${day + 1}: No Senior on Morning` });
    }

    // Rule 5: Max 1 shift per day
    for (const doc of doctors) {
      if (!schedule[doc.id]) {
        violations.push({ rule: 'R5', day, doctorId: doc.id, message: `${doc.name} has no shift on day ${day + 1}` });
      }
    }
  }

  // Rule 4: WO count 6–7 per doctor
  for (const doc of doctors) {
    const woCount = grid.filter((day) => day[doc.id] === ShiftType.WO).length;
    if (woCount < 6 || woCount > 7) {
      violations.push({ rule: 'R4', doctorId: doc.id, message: `${doc.name} has ${woCount} WOs (expected 6–7)` });
    }
  }

  // Rule 6: No consecutive nights
  for (const doc of doctors) {
    for (let day = 0; day < grid.length - 1; day++) {
      if (grid[day][doc.id] === ShiftType.NIGHT && grid[day + 1][doc.id] === ShiftType.NIGHT) {
        violations.push({ rule: 'R6', day, doctorId: doc.id, message: `${doc.name} has consecutive nights on days ${day + 1}–${day + 2}` });
      }
    }
  }

  return violations;
}
