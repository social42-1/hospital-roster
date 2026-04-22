import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import api from '@/lib/api';
import { Roster, Violation, ShiftType, Grade } from '@/types';
import { RosterGrid, ShiftClickInfo } from '@/components/RosterGrid';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/Toast';
import { AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react';

export default function RosterPage() {
  const [params] = useSearchParams();
  const now = new Date();
  const [month, setMonth] = useState(parseInt(params.get('month') ?? String(now.getMonth() + 1)));
  const [year, setYear] = useState(parseInt(params.get('year') ?? String(now.getFullYear())));
  const [violations, setViolations] = useState<Violation[]>([]);
  const [showViolations, setShowViolations] = useState(false);
  const [editTarget, setEditTarget] = useState<ShiftClickInfo | null>(null);
  const [filterShift, setFilterShift] = useState<ShiftType | null>(null);
  const [filterGrade, setFilterGrade] = useState<Grade | null>(null);
  const qc = useQueryClient();
  const toast = useToast((s) => s.show);

  const { data: roster, isLoading } = useQuery<Roster>({
    queryKey: ['roster', month, year],
    queryFn: () => api.get(`/roster/${month}/${year}`).then(r => r.data),
    retry: false,
  });

  const generateMutation = useMutation({
    mutationFn: () => api.post('/roster/generate', { month, year }).then(r => r.data),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['roster', month, year] });
      qc.invalidateQueries({ queryKey: ['rosters'] });
      setViolations(data.violations ?? []);
      toast(`Roster generated for ${monthName} ${year}`, 'success');
    },
    onError: () => toast('Failed to generate roster', 'error'),
  });

  const shiftEditMutation = useMutation({
    mutationFn: ({ shiftId, type }: { shiftId: string; type: ShiftType }) =>
      api.put(`/roster/shift/${shiftId}`, { type }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['roster', month, year] });
      setEditTarget(null);
      toast('Shift updated', 'success');
    },
    onError: () => toast('Failed to update shift', 'error'),
  });

  const publishMutation = useMutation({
    mutationFn: () => api.put(`/roster/${roster!.id}/publish`).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['roster', month, year] });
      qc.invalidateQueries({ queryKey: ['rosters'] });
      toast('Roster published — doctors can now view it', 'success');
    },
    onError: () => toast('Failed to publish roster', 'error'),
  });

  const unpublishMutation = useMutation({
    mutationFn: () => api.put(`/roster/${roster!.id}/unpublish`).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['roster', month, year] });
      qc.invalidateQueries({ queryKey: ['rosters'] });
      toast('Roster reverted to draft', 'success');
    },
    onError: () => toast('Failed to unpublish roster', 'error'),
  });

  const monthName = new Date(year, month - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const months = Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: new Date(year, i).toLocaleDateString('en-US', { month: 'long' }) }));
  const years = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1];

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Roster</h1>
          <p className="text-slate-500 text-sm mt-1">Generate and manage monthly schedules</p>
        </div>
        <div className="flex items-center gap-3">
          <select value={month} onChange={(e) => setMonth(+e.target.value)} className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 text-sm bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200">
            {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
          <select value={year} onChange={(e) => setYear(+e.target.value)} className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 text-sm bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200">
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <Button onClick={() => generateMutation.mutate()} loading={generateMutation.isPending} variant="secondary">
            Generate Roster
          </Button>
          {roster?.status === 'DRAFT' && (
            <Button onClick={() => publishMutation.mutate()} loading={publishMutation.isPending}>
              Publish
            </Button>
          )}
          {roster?.status === 'PUBLISHED' && (
            <Button variant="secondary" onClick={() => unpublishMutation.mutate()} loading={unpublishMutation.isPending}>
              Unpublish
            </Button>
          )}
        </div>
      </div>

      {violations.length > 0 && (
        <div className="mb-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
          <button onClick={() => setShowViolations(!showViolations)} className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-medium text-sm w-full text-left">
            <AlertTriangle className="w-4 h-4" />
            {violations.length} constraint warning{violations.length > 1 ? 's' : ''} detected
            {showViolations ? <ChevronDown className="w-4 h-4 ml-auto" /> : <ChevronRight className="w-4 h-4 ml-auto" />}
          </button>
          {showViolations && (
            <ul className="mt-3 space-y-1">
              {violations.map((v, i) => <li key={i} className="text-xs text-amber-700 dark:text-amber-400">• {v.message}</li>)}
            </ul>
          )}
        </div>
      )}

      {roster?.status === 'DRAFT' && (
        <div className="mb-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-3 text-sm text-amber-700 dark:text-amber-300 font-medium flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          Draft — not visible to doctors yet. Publish to share.
        </div>
      )}

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
        <div className="flex items-center justify-center h-64">
          <Spinner className="w-8 h-8" />
        </div>
      ) : roster ? (
        <RosterGrid roster={roster} onShiftClick={setEditTarget} filterShift={filterShift} filterGrade={filterGrade} />
      ) : (
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <p className="text-slate-400 text-lg font-medium">No roster for {monthName}</p>
          <p className="text-slate-400 text-sm mt-1">Click "Generate Roster" to create one.</p>
        </div>
      )}
      {editTarget && (
        <Modal
          open={!!editTarget}
          onClose={() => setEditTarget(null)}
          title="Edit Shift"
        >
          <p className="text-sm text-slate-500 mb-4">
            <span className="font-medium text-slate-700">{editTarget.doctorName}</span>
            {' · '}
            {new Date(editTarget.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
          </p>
          <div className="grid grid-cols-2 gap-3">
            {(['MORNING', 'NIGHT', 'OFF', 'WO', 'LEAVE'] as ShiftType[]).map((type) => {
              const styles: Record<ShiftType, string> = {
                MORNING: 'bg-sky-50 border-sky-200 text-sky-700 hover:bg-sky-100',
                NIGHT: 'bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100',
                OFF: 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100',
                WO: 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100',
                LEAVE: 'bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100',
              };
              const labels: Record<ShiftType, string> = {
                MORNING: 'Morning',
                NIGHT: 'Night',
                OFF: 'Day Off',
                WO: 'Weekend Off',
                LEAVE: 'Leave',
              };
              const isActive = editTarget.currentType === type;
              return (
                <button
                  key={type}
                  onClick={() => shiftEditMutation.mutate({ shiftId: editTarget.shiftId, type })}
                  disabled={shiftEditMutation.isPending}
                  className={`px-4 py-3 rounded-lg border-2 text-sm font-semibold transition-colors ${styles[type]} ${isActive ? 'ring-2 ring-offset-1 ring-current' : ''}`}
                >
                  {labels[type]}
                  {isActive && <span className="ml-1 text-xs opacity-60">(current)</span>}
                </button>
              );
            })}
          </div>
          <div className="flex justify-end mt-4">
            <Button variant="secondary" onClick={() => setEditTarget(null)}>Cancel</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
