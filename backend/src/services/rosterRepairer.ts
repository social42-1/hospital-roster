/**
 * Roster Repairer
 * Called when a leave is approved for a doctor on a day that already has
 * a generated roster. Re-assigns their shift and repairs broken constraints
 * while keeping the rotation balanced.
 *
 * Replacement selection mirrors the engine's rotation spirit: among eligible
 * same-grade doctors, prefer the one with the fewest nights this month so
 * the distribution stays even.
 */

import { ShiftType } from '@prisma/client';
import { DoctorInfo, RosterGrid } from './rosterEngine';

export function applyLeaveAndRepair(
  grid: RosterGrid,
  doctorId: string,
  dayIndex: number, // 0-based
  doctors: DoctorInfo[]
): RosterGrid {
  const repairedGrid = grid.map((day) => ({ ...day }));
  const original = repairedGrid[dayIndex][doctorId];

  // Mark as LEAVE
  repairedGrid[dayIndex][doctorId] = ShiftType.LEAVE;

  if (original === ShiftType.NIGHT) {
    const doc = doctors.find((d) => d.id === doctorId);
    if (!doc) return repairedGrid; // doctor not found — can't repair

    const sameGrade = doctors.filter((d) => d.grade === doc.grade && d.id !== doctorId);

    // Count current night assignments per doctor to pick the most rested replacement
    const nightCounts: Record<string, number> = {};
    for (const d of doctors) nightCounts[d.id] = 0;
    for (const daySchedule of repairedGrid) {
      for (const [uid, type] of Object.entries(daySchedule)) {
        if (type === ShiftType.NIGHT) nightCounts[uid]++;
      }
    }

    const isEligible = (d: DoctorInfo, requiredShift: ShiftType) => {
      const today = repairedGrid[dayIndex][d.id];
      const yesterday = dayIndex > 0 ? repairedGrid[dayIndex - 1][d.id] : null;
      return today === requiredShift && yesterday !== ShiftType.NIGHT;
    };

    // Primary: prefer a MORNING doctor. Fallback: sacrifice a WO doctor if no MORNING available.
    const replacement =
      sameGrade.filter((d) => isEligible(d, ShiftType.MORNING)).sort((a, b) => nightCounts[a.id] - nightCounts[b.id])[0] ??
      sameGrade.filter((d) => isEligible(d, ShiftType.WO)).sort((a, b) => nightCounts[a.id] - nightCounts[b.id])[0];

    if (replacement) {
      repairedGrid[dayIndex][replacement.id] = ShiftType.NIGHT;

      // Replacement needs OFF the next day (post-night recovery)
      if (dayIndex + 1 < repairedGrid.length) {
        const nextShift = repairedGrid[dayIndex + 1][replacement.id];
        if (nextShift === ShiftType.MORNING || nextShift === ShiftType.WO) {
          repairedGrid[dayIndex + 1][replacement.id] = ShiftType.OFF;

          // If a WO was converted to OFF, ensure morning coverage still holds that day
          if (nextShift === ShiftType.WO) {
            const repairDay = dayIndex + 1;
            const gradeGroup = doctors.filter(
              (d) => d.grade === replacement.grade && d.id !== replacement.id
            );
            const hasMorning = gradeGroup.some(
              (d) => repairedGrid[repairDay][d.id] === ShiftType.MORNING
            );
            if (!hasMorning) {
              const woDoc = gradeGroup.find(
                (d) => repairedGrid[repairDay][d.id] === ShiftType.WO
              );
              if (woDoc) repairedGrid[repairDay][woDoc.id] = ShiftType.MORNING;
            }
          }
        }
      }
    }

    // Lift the leave doctor's post-night OFF (they weren't actually on NIGHT anymore)
    if (
      dayIndex + 1 < repairedGrid.length &&
      repairedGrid[dayIndex + 1][doctorId] === ShiftType.OFF
    ) {
      repairedGrid[dayIndex + 1][doctorId] = ShiftType.MORNING;
    }
  }

  if (original === ShiftType.MORNING) {
    const doc = doctors.find((d) => d.id === doctorId);
    if (!doc) return repairedGrid;
    const sameGrade = doctors.filter((d) => d.grade === doc.grade && d.id !== doctorId);
    const hasMorningCoverage = sameGrade.some(
      (d) => repairedGrid[dayIndex][d.id] === ShiftType.MORNING
    );
    if (!hasMorningCoverage) {
      const woDoc = sameGrade.find((d) => repairedGrid[dayIndex][d.id] === ShiftType.WO);
      if (woDoc) repairedGrid[dayIndex][woDoc.id] = ShiftType.MORNING;
    }
  }

  return repairedGrid;
}
