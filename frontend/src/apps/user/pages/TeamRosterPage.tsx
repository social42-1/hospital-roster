import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { Roster, ShiftType, Grade } from '@/types';
import { RosterGrid } from '@/components/RosterGrid';
import { Spinner } from '@/components/ui/Spinner';

export default function TeamRosterPage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [filterShift, setFilterShift] = useState<ShiftType | null>(null);
  const [filterGrade, setFilterGrade] = useState<Grade | null>(null);

  const { data: roster, isLoading } = useQuery<Roster>({
    queryKey: ['roster', month, year],
    queryFn: () => api.get(`/roster/${month}/${year}`).then(r => r.data),
    retry: false,
  });

  const months = Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: new Date(year, i).toLocaleDateString('en-US', { month: 'long' }) }));

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Team Roster</h1>
          <p className="text-slate-500 text-sm mt-1">Full team schedule</p>
        </div>
        <div className="flex gap-2">
          <select value={month} onChange={e => setMonth(+e.target.value)} className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 text-sm bg-white dark:bg-slate-800 dark:text-slate-200">
            {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
          <select value={year} onChange={e => setYear(+e.target.value)} className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 text-sm bg-white dark:bg-slate-800 dark:text-slate-200">
            {[year - 1, year, year + 1].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {/* Legend */}
      <div className="flex gap-4 mb-4 text-xs">
        {[['M', 'bg-sky-100 text-sky-700 border-sky-200', 'Morning'], ['N', 'bg-indigo-100 text-indigo-700 border-indigo-200', 'Night'], ['O', 'bg-slate-100 text-slate-500 border-slate-200', 'Off'], ['WO', 'bg-emerald-100 text-emerald-700 border-emerald-200', 'Weekly Off'], ['L', 'bg-rose-100 text-rose-700 border-rose-200', 'Leave']].map(([abbr, cls, label]) => (
          <div key={abbr} className="flex items-center gap-1.5">
            <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-semibold border ${cls}`}>{abbr}</span>
            <span className="text-slate-500 dark:text-slate-400">{label}</span>
          </div>
        ))}
      </div>

      {roster && (
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Shift</span>
          {([null, 'MORNING', 'NIGHT', 'OFF', 'WO', 'LEAVE'] as (ShiftType | null)[]).map((s) => (
            <button
              key={s ?? 'ALL'}
              onClick={() => setFilterShift(s === filterShift ? null : s)}
              className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${filterShift === s ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
            >
              {s ?? 'All'}
            </button>
          ))}
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wide ml-3">Grade</span>
          {([null, 'SENIOR', 'JUNIOR'] as (Grade | null)[]).map((g) => (
            <button
              key={g ?? 'ALL'}
              onClick={() => setFilterGrade(g === filterGrade ? null : g)}
              className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${filterGrade === g ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
            >
              {g ?? 'All'}
            </button>
          ))}
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12"><Spinner className="w-6 h-6" /></div>
      ) : roster ? (
        <RosterGrid roster={roster} filterShift={filterShift} filterGrade={filterGrade} />
      ) : (
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <p className="text-slate-400 text-lg font-medium">No published roster for this month</p>
          <p className="text-slate-400 text-sm mt-1">Check back once the admin publishes the schedule.</p>
        </div>
      )}
    </div>
  );
}
