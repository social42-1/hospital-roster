import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { User } from '@/types';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { useToast } from '@/components/Toast';
import { UserPlus, Trash2 } from 'lucide-react';

export default function StaffPage() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', grade: 'JUNIOR' });
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const qc = useQueryClient();
  const toast = useToast((s) => s.show);

  const { data: doctors, isLoading } = useQuery<User[]>({
    queryKey: ['users'],
    queryFn: () => api.get('/users').then(r => r.data),
  });

  const createMutation = useMutation({
    mutationFn: () => api.post('/users', form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      setOpen(false);
      setForm({ name: '', email: '', password: '', grade: 'JUNIOR' });
      toast('Doctor added successfully', 'success');
    },
    onError: () => toast('Failed to add doctor', 'error'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/users/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      setDeleteId(null);
      toast('Doctor removed', 'success');
    },
    onError: () => toast('Failed to remove doctor', 'error'),
  });

  const juniors = doctors?.filter(d => d.grade === 'JUNIOR') ?? [];
  const seniors = doctors?.filter(d => d.grade === 'SENIOR') ?? [];

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-gray-100">Staff</h1>
          <p className="text-slate-500 text-sm mt-1">Manage doctors and their grades</p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <UserPlus className="w-4 h-4" />
          Add Doctor
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Spinner className="w-6 h-6" /></div>
      ) : (
        <div className="space-y-6">
          {[{ label: 'Senior Doctors', list: seniors, grade: 'SENIOR' }, { label: 'Junior Doctors', list: juniors, grade: 'JUNIOR' }].map(({ label, list }) => (
            <Card key={label}>
              <CardHeader>
                <h2 className="font-semibold text-slate-900 dark:text-gray-100">{label} <span className="text-slate-400 font-normal text-sm">({list.length})</span></h2>
              </CardHeader>
              <CardContent className="p-0">
                {list.length === 0 ? (
                  <p className="text-slate-400 text-sm px-6 py-4">No doctors in this group.</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 dark:border-gray-700 bg-slate-50/50 dark:bg-gray-800/50">
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-gray-400 uppercase tracking-wide">Name</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-gray-400 uppercase tracking-wide">Email</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-gray-400 uppercase tracking-wide">Grade</th>
                        <th className="px-6 py-3"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {list.map((doc) => (
                        <tr key={doc.id} className="border-b border-slate-700/30 hover:bg-slate-50/50 dark:hover:bg-gray-700/30">
                          <td className="px-6 py-3 font-medium text-slate-900 dark:text-gray-100">{doc.name}</td>
                          <td className="px-6 py-3 text-slate-500 dark:text-gray-400">{doc.email}</td>
                          <td className="px-6 py-3">
                            <Badge variant={doc.grade === 'SENIOR' ? 'info' : 'warning'}>{doc.grade}</Badge>
                          </td>
                          <td className="px-6 py-3 text-right">
                            <button onClick={() => setDeleteId(doc.id)} className="text-slate-400 hover:text-red-500 transition-colors">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add Doctor Modal */}
      <Modal open={open} onClose={() => setOpen(false)} title="Add Doctor">
        <div className="flex flex-col gap-4">
          <Input label="Full Name" value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Dr. Jane Smith" />
          <Input label="Email" type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} placeholder="jane@hospital.com" />
          <Input label="Password" type="password" value={form.password} onChange={e => setForm({...form, password: e.target.value})} placeholder="Temporary password" />
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-slate-700 dark:text-gray-100">Grade</label>
            <select value={form.grade} onChange={e => setForm({...form, grade: e.target.value})} className="px-3 py-2 rounded-lg border border-slate-200 dark:border-gray-600 text-sm bg-white dark:bg-gray-700 dark:text-gray-100">
              <option value="JUNIOR">Junior</option>
              <option value="SENIOR">Senior</option>
            </select>
          </div>
          <div className="flex justify-end gap-3 mt-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => createMutation.mutate()} loading={createMutation.isPending}>Add Doctor</Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirm Modal */}
      <Modal open={!!deleteId} onClose={() => setDeleteId(null)} title="Remove Doctor">
        <p className="text-slate-600 dark:text-gray-400 text-sm mb-4">Are you sure you want to remove this doctor? This action cannot be undone.</p>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setDeleteId(null)}>Cancel</Button>
          <Button variant="danger" onClick={() => deleteMutation.mutate(deleteId!)} loading={deleteMutation.isPending}>Remove</Button>
        </div>
      </Modal>
    </div>
  );
}
