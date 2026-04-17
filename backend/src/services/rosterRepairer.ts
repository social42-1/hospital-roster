/**
 * Roster Repairer
 * Called when a leave is approved for a doctor on a given day.
 * Re-assigns their shift and repairs any broken constraints.
 */

import { Grade, ShiftType } from '@prisma/client';
import { DoctorInfo, RosterGrid } from './rosterEngine';

export function applyLeaveAndRepair(
  grid: RosterGrid,
  doctorId: string,
  dayIndex: number, // 0-based
  doctors: DoctorInfo[]
): RosterGrid {
  const repairedGrid = grid.map((day) => ({ ...day }));
  const original = repairedGrid[dayIndex][doctorId];

  // Mark as WO (leave)
  repairedGrid[dayIndex][doctorId] = ShiftType.WO;

  // If the doctor was on NIGHT, we need to find a replacement
  if (original === ShiftType.NIGHT) {
    const doc = doctors.find((d) => d.id === doctorId)!;
    const sameGrade = doctors.filter((d) => d.grade === doc.grade && d.id !== doctorId);

    const replacement = sameGrade.find((d) => {
      const todayShift = repairedGrid[dayIndex][d.id];
      const yesterdayShift = dayIndex > 0 ? repairedGrid[dayIndex - 1][d.id] : null;
      // Must not already be on Night today, not on OFF (post-night), not on WO/leave
      return (
        todayShift !== ShiftType.NIGHT &&
        todayShift !== ShiftType.OFF &&
        todayShift !== ShiftType.WO &&
        yesterdayShift !== ShiftType.NIGHT
      );
    });

    if (replacement) {
      // Swap replacement from MORNING to NIGHT
      repairedGrid[dayIndex][replacement.id] = ShiftType.NIGHT;
      // Cascade: replacement must be OFF next day
      if (dayIndex + 1 < repairedGrid.length) {
        const nextDayShift = repairedGrid[dayIndex + 1][replacement.id];
        if (nextDayShift === ShiftType.MORNING) {
          repairedGrid[dayIndex + 1][replacement.id] = ShiftType.OFF;
        }
      }
    }
    // If the original doctor was forced OFF tomorrow due to their night, lift that constraint
    if (dayIndex + 1 < repairedGrid.length && repairedGrid[dayIndex + 1][doctorId] === ShiftType.OFF) {
      repairedGrid[dayIndex + 1][doctorId] = ShiftType.MORNING;
    }
  }

  // If the doctor was on MORNING, ensure morning coverage remains
  if (original === ShiftType.MORNING) {
    const doc = doctors.find((d) => d.id === doctorId)!;
    const sameGrade = doctors.filter((d) => d.grade === doc.grade && d.id !== doctorId);
    const hasMorningCoverage = sameGrade.some(
      (d) => repairedGrid[dayIndex][d.id] === ShiftType.MORNING
    );

    if (!hasMorningCoverage) {
      // Promote someone from WO to MORNING
      const woDoctor = sameGrade.find((d) => repairedGrid[dayIndex][d.id] === ShiftType.WO);
      if (woDoctor) {
        repairedGrid[dayIndex][woDoctor.id] = ShiftType.MORNING;
      }
    }
  }

  return repairedGrid;
}
