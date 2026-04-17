import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { Roster } from '@/types';
import { RosterGrid } from '@/components/RosterGrid';
import { Spinner } from '@/components/ui/Spinner';

export default function TeamRosterPage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

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
          <h1 className="text-2xl font-bold text-slate-900">Team Roster</h1>
          <p className="text-slate-500 text-sm mt-1">Full team schedule</p>
        </div>
        <div className="flex gap-2">
          <select value={month} onChange={e => setMonth(+e.target.value)} className="px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white">
            {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
          <select value={year} onChange={e => setYear(+e.target.value)} className="px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white">
            {[year - 1, year, year + 1].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {/* Legend */}
      <div className="flex gap-4 mb-4 text-xs">
        {[['M', 'bg-sky-100 text-sky-700 border-sky-200', 'Morning'], ['N', 'bg-indigo-100 text-indigo-700 border-indigo-200', 'Night'], ['O', 'bg-slate-100 text-slate-500 border-slate-200', 'Off'], ['WO', 'bg-emerald-100 text-emerald-700 border-emerald-200', 'Weekly Off']].map(([abbr, cls, label]) => (
          <div key={abbr} className="flex items-center gap-1.5">
            <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-semibold border ${cls}`}>{abbr}</span>
            <span className="text-slate-500">{label}</span>
          </div>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Spinner className="w-6 h-6" /></div>
      ) : roster ? (
        <RosterGrid roster={roster} />
      ) : (
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <p className="text-slate-400 text-lg font-medium">No published roster for this month</p>
          <p className="text-slate-400 text-sm mt-1">Check back once the admin publishes the schedule.</p>
        </div>
      )}
    </div>
  );
}
