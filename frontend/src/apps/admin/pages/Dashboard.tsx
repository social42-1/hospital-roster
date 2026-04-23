import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import api from '@/lib/api';
import { Card, CardContent } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { Users, ClipboardList, CalendarCheck, ChevronRight } from 'lucide-react';
import { Roster, Leave, User } from '@/types';

export default function Dashboard() {
  const now = new Date();
  const { data: rosters } = useQuery<Roster[]>({ queryKey: ['rosters'], queryFn: () => api.get('/roster').then(r => r.data) });
  const { data: leaves } = useQuery<Leave[]>({ queryKey: ['leaves'], queryFn: () => api.get('/leave').then(r => r.data) });
  const { data: doctors } = useQuery<User[]>({ queryKey: ['users'], queryFn: () => api.get('/users').then(r => r.data) });
  const navigate = useNavigate();

  const pending = leaves?.filter(l => l.status === 'PENDING').length ?? 0;
  const published = rosters?.filter(r => r.status === 'PUBLISHED').length ?? 0;

  const stats = [
    { label: 'Total Doctors', value: doctors?.length ?? '—', icon: Users, color: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30' },
    { label: 'Pending Leaves', value: pending, icon: ClipboardList, color: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30' },
    { label: 'Published Rosters', value: published, icon: CalendarCheck, color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30' },
  ];

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-gray-100">Dashboard</h1>
        <p className="text-slate-500 text-sm mt-1">{now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-8">
        {stats.map(({ label, value, icon: Icon, color }) => (
          <Card key={label}>
            <CardContent className="flex items-center gap-4 py-5">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>
                <Icon className="w-6 h-6" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900 dark:text-gray-100">{value}</p>
                <p className="text-sm text-slate-500">{label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent>
          <h2 className="font-semibold text-slate-900 dark:text-gray-100 mb-3">Quick Access — Rosters</h2>
          {!rosters ? <Spinner className="w-5 h-5" /> : rosters.length === 0 ? (
            <p className="text-slate-400 text-sm">No rosters generated yet.</p>
          ) : (
            <div className="space-y-2">
              {rosters.slice(0, 6).map(r => (
                <button
                  key={r.id}
                  onClick={() => navigate(`/admin/roster?month=${r.month}&year=${r.year}`)}
                  className="flex items-center justify-between w-full px-4 py-3 rounded-lg border border-slate-100 dark:border-gray-700 hover:border-indigo-200 dark:hover:border-indigo-700 hover:bg-indigo-50/30 dark:hover:bg-indigo-900/20 transition-colors text-sm"
                >
                  <span className="font-medium text-slate-700 dark:text-slate-300">
                    {new Date(r.year, r.month - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                  </span>
                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${r.status === 'PUBLISHED' ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400' : 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400'}`}>
                      {r.status}
                    </span>
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
