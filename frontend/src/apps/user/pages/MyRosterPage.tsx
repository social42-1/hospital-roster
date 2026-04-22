import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { Roster, ShiftType } from '@/types';
import { ShiftBadge } from '@/components/ShiftBadge';
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';

export default function MyRosterPage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [filterShift, setFilterShift] = useState<ShiftType | null>(null);
  const user = useAuthStore((s) => s.user);

  const { data: roster, isLoading } = useQuery<Roster>({
    queryKey: ['roster', month, year],
    queryFn: () => api.get(`/roster/${month}/${year}`).then(r => r.data),
    retry: false,
  });

  const myShifts = roster?.shifts.filter(s => s.userId === user?.id) ?? [];
  const shiftByDate: Record<string, string> = {};
  myShifts.forEach(s => { shiftByDate[s.date.split('T')[0]] = s.type; });

  const nights = myShifts.filter(s => s.type === 'NIGHT').length;
  const wos = myShifts.filter(s => s.type === 'WO').length;
  const mornings = myShifts.filter(s => s.type === 'MORNING').length;

  const days = Array.from({ length: 31 }, (_, i) => {
    const d = new Date(year, month - 1, i + 1);
    return d.getMonth() === month - 1 ? d : null;
  }).filter(Boolean) as Date[];

  const months = Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: new Date(year, i).toLocaleDateString('en-US', { month: 'long' }) }));

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">My Roster</h1>
          <p className="text-slate-500 text-sm mt-1">Your personal schedule</p>
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

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { label: 'Morning Shifts', value: mornings, className: 'bg-sky-50 border-sky-200 text-sky-700' },
          { label: 'Night Shifts', value: nights, className: 'bg-indigo-50 border-indigo-200 text-indigo-700' },
          { label: 'Weekly Offs', value: wos, className: 'bg-emerald-50 border-emerald-200 text-emerald-700' },
        ].map(({ label, value, className }) => (
          <div key={label} className={`rounded-xl border p-4 ${className}`}>
            <p className="text-2xl font-bold">{value}</p>
            <p className="text-sm font-medium opacity-80">{label}</p>
          </div>
        ))}
      </div>

      {roster && (
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Show</span>
          {([null, 'MORNING', 'NIGHT', 'OFF', 'WO', 'LEAVE'] as (ShiftType | null)[]).map((s) => (
            <button
              key={s ?? 'ALL'}
              onClick={() => setFilterShift(s === filterShift ? null : s)}
              className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${filterShift === s ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
            >
              {s ?? 'All'}
            </button>
          ))}
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12"><Spinner className="w-6 h-6" /></div>
      ) : !roster ? (
        <Card><CardContent><p className="text-slate-400 text-sm text-center py-4">No roster published for this month yet.</p></CardContent></Card>
      ) : (
        <Card>
          <CardHeader><h2 className="font-semibold text-slate-900">{new Date(year, month - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</h2></CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-2">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                <div key={d} className="text-center text-xs font-medium text-slate-400 py-1">{d}</div>
              ))}
              {/* Empty cells for first week offset */}
              {Array.from({ length: days[0].getDay() }).map((_, i) => <div key={`e${i}`} />)}
              {days.map(d => {
                const key = format(d, 'yyyy-MM-dd');
                const shift = shiftByDate[key];
                const isToday = format(now, 'yyyy-MM-dd') === key;
                const dimmed = filterShift && shift !== filterShift;
                return (
                  <div key={key} className={`rounded-xl p-2 text-center border transition-opacity ${dimmed ? 'opacity-20' : ''} ${isToday ? 'border-indigo-300 bg-indigo-50 dark:bg-indigo-900/30 dark:border-indigo-700' : 'border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50'}`}>
                    <p className={`text-xs font-medium mb-1 ${isToday ? 'text-indigo-600' : 'text-slate-500'}`}>{format(d, 'd')}</p>
                    {shift ? <ShiftBadge type={shift as any} className="mx-auto" /> : <span className="text-slate-300 text-xs">—</span>}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
