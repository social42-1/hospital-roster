import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import api from '@/lib/api';
import { Leave } from '@/types';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import { useToast } from '@/components/Toast';

const statusVariant = (s: string) => s === 'APPROVED' ? 'success' : s === 'REJECTED' ? 'danger' : 'warning';

export default function LeaveRequestPage() {
  const [date, setDate] = useState('');
  const [reason, setReason] = useState('');
  const qc = useQueryClient();
  const toast = useToast((s) => s.show);

  const { data: leaves } = useQuery<Leave[]>({
    queryKey: ['my-leaves'],
    queryFn: () => api.get('/leave').then(r => r.data),
  });

  const submitMutation = useMutation({
    mutationFn: () => api.post('/leave', { date, reason }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-leaves'] });
      setDate(''); setReason('');
      toast('Leave request submitted', 'success');
    },
    onError: (err: any) => toast(err?.response?.data?.error ?? 'Failed to submit leave request', 'error'),
  });

  return (
    <div className="p-6 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-gray-100">Leave Request</h1>
        <p className="text-slate-500 text-sm mt-1">Submit a leave request for admin approval</p>
      </div>

      <Card className="mb-6">
        <CardHeader><h2 className="font-semibold text-slate-900 dark:text-gray-100">New Request</h2></CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4">
            <Input label="Date" type="date" value={date} onChange={e => setDate(e.target.value)} min={format(new Date(), 'yyyy-MM-dd')} required />
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-700 dark:text-gray-100">Reason</label>
              <textarea
                value={reason}
                onChange={e => setReason(e.target.value)}
                rows={3}
                placeholder="Brief reason for leave..."
                className="px-3 py-2 rounded-lg border border-slate-200 dark:border-gray-600 text-sm text-slate-900 dark:text-gray-100 bg-white dark:bg-gray-700 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
              />
            </div>
            <Button onClick={() => submitMutation.mutate()} loading={submitMutation.isPending} disabled={!date || !reason} className="self-start">
              Submit Request
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><h2 className="font-semibold text-slate-900 dark:text-gray-100">My Requests</h2></CardHeader>
        <CardContent className="p-0">
          {!leaves || leaves.length === 0 ? (
            <p className="text-slate-400 text-sm px-6 py-4">No leave requests yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-gray-700 bg-slate-50/50 dark:bg-gray-800/50">
                  {['Date', 'Reason', 'Status'].map(h => <th key={h} className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-gray-400 uppercase tracking-wide">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {leaves.map(l => (
                  <tr key={l.id} className="border-b border-slate-700/30 hover:bg-slate-50/50 dark:hover:bg-gray-700/30">
                    <td className="px-6 py-3 font-medium text-slate-900 dark:text-gray-100">{format(parseISO(l.date), 'dd MMM yyyy')}</td>
                    <td className="px-6 py-3 text-slate-600 dark:text-gray-400">{l.reason}</td>
                    <td className="px-6 py-3"><Badge variant={statusVariant(l.status)}>{l.status}</Badge></td>
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
