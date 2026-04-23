import { useMemo } from 'react';
import { format } from 'date-fns';
import { ShiftBadge } from './ShiftBadge';
import { Badge } from './ui/Badge';
import { Roster, Grade, ShiftType } from '@/types';

export interface ShiftClickInfo {
  shiftId: string;
  currentType: ShiftType;
  doctorName: string;
  date: string; // 'yyyy-MM-dd'
}

interface RosterGridProps {
  roster: Roster;
  onShiftClick?: (info: ShiftClickInfo) => void;
  filterGrade?: Grade | null;
  filterShift?: ShiftType | null;
  filterName?: string;
}

export function RosterGrid({ roster, onShiftClick, filterGrade, filterShift, filterName }: RosterGridProps) {
  // Get sorted unique doctors from shifts
  const doctors = useMemo(() => {
    const map = new Map<string, { id: string; name: string; grade: Grade }>();
    roster.shifts.forEach((s) => map.set(s.userId, s.user));
    const arr = Array.from(map.values());
    // Seniors first, then juniors, alphabetical within each group
    return arr
      .filter((d) => !filterGrade || d.grade === filterGrade)
      .filter((d) => !filterName || d.name.toLowerCase().includes(filterName.toLowerCase()))
      .sort((a, b) => {
        if (a.grade !== b.grade) return a.grade === 'SENIOR' ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
  }, [roster.shifts, filterGrade, filterName]);

  // Build lookup: userId -> date string -> shift
  const shiftMap = useMemo(() => {
    const map: Record<string, Record<string, { id: string; type: ShiftType }>> = {};
    roster.shifts.forEach((s) => {
      if (!map[s.userId]) map[s.userId] = {};
      const dateKey = s.date.split('T')[0];
      map[s.userId][dateKey] = { id: s.id, type: s.type };
    });
    return map;
  }, [roster.shifts]);

  // Generate day columns
  const days = useMemo(() => {
    return Array.from({ length: 31 }, (_, i) => {
      const d = new Date(roster.year, roster.month - 1, i + 1);
      if (d.getMonth() !== roster.month - 1) return null;
      return d;
    }).filter(Boolean) as Date[];
  }, [roster.month, roster.year]);

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-gray-700">
      <table className="min-w-max w-full text-sm border-collapse">
        <thead>
          <tr className="bg-slate-50 dark:bg-gray-800 border-b border-slate-200 dark:border-gray-700">
            <th className="sticky left-0 z-10 bg-slate-50 dark:bg-gray-800 px-4 py-3 text-left font-semibold text-slate-700 dark:text-gray-100 border-r border-slate-200 dark:border-gray-700 min-w-[160px]">
              Doctor
            </th>
            {days.map((d) => (
              <th key={d.toISOString()} className="px-2 py-3 text-center font-medium text-slate-500 dark:text-gray-400 min-w-[44px]">
                <div className="text-xs">{format(d, 'EEE')}</div>
                <div className="text-sm font-semibold text-slate-700 dark:text-gray-100">{format(d, 'd')}</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {doctors.map((doc, i) => (
            <tr key={doc.id} className={i % 2 === 0 ? 'bg-white dark:bg-gray-900' : 'bg-slate-50/50 dark:bg-gray-800/50'}>
              <td className="sticky left-0 z-10 bg-inherit px-4 py-2 border-r border-slate-200 dark:border-gray-700">
                <div className="flex items-center gap-2">
                  <div>
                    <p className="font-medium text-slate-900 dark:text-gray-100 whitespace-nowrap">{doc.name}</p>
                    <Badge variant={doc.grade === 'SENIOR' ? 'info' : 'warning'} className="mt-0.5">
                      {doc.grade}
                    </Badge>
                  </div>
                </div>
              </td>
              {days.map((d) => {
                const dateKey = format(d, 'yyyy-MM-dd');
                const shift = shiftMap[doc.id]?.[dateKey];
                const dimmed = filterShift && shift?.type !== filterShift;
                return (
                  <td key={dateKey} className="px-2 py-2 text-center">
                    {shift ? (
                      <button
                        onClick={() => onShiftClick?.({ shiftId: shift.id, currentType: shift.type, doctorName: doc.name, date: dateKey })}
                        className={`transition-opacity ${onShiftClick && !dimmed ? 'cursor-pointer hover:opacity-80' : 'cursor-default'} ${dimmed ? 'opacity-15' : ''}`}
                        title={shift.type}
                      >
                        <ShiftBadge type={shift.type} />
                      </button>
                    ) : (
                      <span className={`text-slate-300 dark:text-gray-600 ${dimmed ? 'opacity-15' : ''}`}>—</span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
