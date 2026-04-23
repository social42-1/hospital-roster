import { useState } from 'react';
import { Link } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Hospital, CheckCircle } from 'lucide-react';

export default function SignupPage() {
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '', grade: 'JUNIOR' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const loginWithGoogle = useAuthStore((s) => s.loginWithGoogle);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirm) {
      setError('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      await api.post('/auth/signup', {
        name: form.name,
        email: form.email,
        password: form.password,
        grade: form.grade,
      });
      setDone(true);
    } catch (err: any) {
      setError(err?.response?.data?.error ?? 'Signup failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async (credential: string) => {
    setError('');
    try {
      const result = await loginWithGoogle(credential);
      if (result.pending) setDone(true);
    } catch (err: any) {
      setError(err?.response?.data?.error ?? 'Google sign-in failed');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 dark:from-gray-900 dark:to-indigo-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-indigo-600 rounded-2xl mb-4 shadow-lg">
            <Hospital className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-gray-100">MediRoster</h1>
          <p className="text-slate-500 text-sm mt-1">Create a doctor account</p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-slate-200 dark:border-gray-700 p-6">
          {done ? (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <CheckCircle className="w-12 h-12 text-emerald-500" />
              <h2 className="font-semibold text-slate-900 dark:text-gray-100">Request submitted</h2>
              <p className="text-sm text-slate-500 dark:text-gray-400">
                Your account is pending admin approval. You'll be able to log in once approved.
              </p>
              <Link to="/login" className="text-sm text-indigo-600 dark:text-indigo-400 font-medium mt-2 hover:underline">
                Back to login
              </Link>
            </div>
          ) : (
            <>
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <Input label="Full Name" value={form.name} onChange={set('name')} placeholder="Dr. Jane Smith" required />
                <Input label="Email" type="email" value={form.email} onChange={set('email')} placeholder="jane@hospital.com" required />
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-slate-700 dark:text-gray-100">Grade</label>
                  <select
                    value={form.grade}
                    onChange={set('grade')}
                    className="px-3 py-2 rounded-lg border border-slate-200 dark:border-gray-600 text-sm bg-white dark:bg-gray-700 text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="JUNIOR">Junior Doctor</option>
                    <option value="SENIOR">Senior Doctor</option>
                  </select>
                </div>
                <Input label="Password" type="password" value={form.password} onChange={set('password')} placeholder="••••••••" required />
                <Input label="Confirm Password" type="password" value={form.confirm} onChange={set('confirm')} placeholder="••••••••" required />
                {error && <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 px-3 py-2 rounded-lg">{error}</p>}
                <Button type="submit" loading={loading} className="w-full justify-center mt-1">
                  Request Account
                </Button>
              </form>

              <div className="relative my-5">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200 dark:border-gray-600" />
                </div>
                <div className="relative flex justify-center">
                  <span className="px-3 text-xs text-slate-400 bg-white dark:bg-gray-800">or continue with</span>
                </div>
              </div>

              <div className="flex justify-center">
                <GoogleLogin
                  onSuccess={(res) => res.credential && handleGoogle(res.credential)}
                  onError={() => setError('Google sign-in failed')}
                  theme="outline"
                  shape="rectangular"
                  width="100%"
                />
              </div>
            </>
          )}
        </div>

        {!done && (
          <p className="text-center text-sm text-slate-500 dark:text-gray-400 mt-4">
            Already have an account?{' '}
            <Link to="/login" className="text-indigo-600 dark:text-indigo-400 font-medium hover:underline">
              Sign in
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
