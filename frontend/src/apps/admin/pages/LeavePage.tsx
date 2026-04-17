import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import api from '@/lib/api';
import { Leave } from '@/types';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { useToast } from '@/components/Toast';

type Filter = 'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED';

const statusVariant = (s: string) => s === 'APPROVED' ? 'success' : s === 'REJECTED' ? 'danger' : 'warning';

export default function LeavePage() {
  const [filter, setFilter] = useState<Filter>('PENDING');
  const qc = useQueryClient();
  const toast = useToast((s) => s.show);

  const { data: leaves, isLoading } = useQuery<Leave[]>({
    queryKey: ['leaves'],
    queryFn: () => api.get('/leave').then(r => r.data),
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => api.put(`/leave/${id}/approve`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['leaves'] }); qc.invalidateQueries({ queryKey: ['roster'] }); toast('Leave approved, roster updated', 'success'); },
    onError: () => toast('Failed to approve leave', 'error'),
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) => api.put(`/leave/${id}/reject`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['leaves'] }); toast('Leave rejected', 'success'); },
    onError: () => toast('Failed to reject leave', 'error'),
  });

  const filtered = (filter === 'ALL' ? leaves : leaves?.filter(l => l.status === filter)) ?? [];
  const counts = { ALL: leaves?.length ?? 0, PENDING: leaves?.filter(l => l.status === 'PENDING').length ?? 0, APPROVED: leaves?.filter(l => l.status === 'APPROVED').length ?? 0, REJECTED: leaves?.filter(l => l.status === 'REJECTED').length ?? 0 };

  return (
    <div className="p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Leave Requests</h1>
        <p className="text-slate-500 text-sm mt-1">Approve or reject leave requests — roster updates automatically</p>
      </div>

      <div className="flex gap-2 mb-4">
        {(['ALL', 'PENDING', 'APPROVED', 'REJECTED'] as Filter[]).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${filter === f ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}
          >
            {f} <span className="ml-1 opacity-70">{counts[f]}</span>
          </button>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-12"><Spinner className="w-6 h-6" /></div>
          ) : filtered.length === 0 ? (
            <p className="text-slate-400 text-sm px-6 py-8 text-center">No {filter.toLowerCase()} leave requests.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  {['Doctor', 'Grade', 'Date', 'Reason', 'Status', 'Actions'].map(h => (
                    <th key={h} className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(leave => (
                  <tr key={leave.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                    <td className="px-6 py-3 font-medium text-slate-900">{leave.user?.name}</td>
                    <td className="px-6 py-3"><Badge variant={leave.user?.grade === 'SENIOR' ? 'info' : 'warning'}>{leave.user?.grade}</Badge></td>
                    <td className="px-6 py-3 text-slate-600">{format(parseISO(leave.date), 'dd MMM yyyy')}</td>
                    <td className="px-6 py-3 text-slate-600 max-w-xs truncate">{leave.reason}</td>
                    <td className="px-6 py-3"><Badge variant={statusVariant(leave.status)}>{leave.status}</Badge></td>
                    <td className="px-6 py-3">
                      {leave.status === 'PENDING' && (
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => approveMutation.mutate(leave.id)} loading={approveMutation.isPending}>Approve</Button>
                          <Button size="sm" variant="danger" onClick={() => rejectMutation.mutate(leave.id)} loading={rejectMutation.isPending}>Reject</Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
