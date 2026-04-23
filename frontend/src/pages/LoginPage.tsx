import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import { useAuthStore } from '@/store/auth';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Hospital, CheckCircle } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [pendingApproval, setPendingApproval] = useState(false);
  const login = useAuthStore((s) => s.login);
  const loginWithGoogle = useAuthStore((s) => s.loginWithGoogle);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      const user = useAuthStore.getState().user;
      navigate(user?.role === 'ADMIN' ? '/admin' : '/user');
    } catch (err: any) {
      const msg = err?.response?.data?.error ?? 'Invalid email or password';
      if (err?.response?.status === 403) {
        setPendingApproval(true);
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async (credential: string) => {
    setError('');
    try {
      const result = await loginWithGoogle(credential);
      if (result.pending) {
        setPendingApproval(true);
        return;
      }
      const user = useAuthStore.getState().user;
      navigate(user?.role === 'ADMIN' ? '/admin' : '/user');
    } catch (err: any) {
      if (err?.response?.status === 403) {
        setPendingApproval(true);
      } else {
        setError(err?.response?.data?.error ?? 'Google sign-in failed');
      }
    }
  };

  if (pendingApproval) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 dark:from-gray-900 dark:to-indigo-950 flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 bg-indigo-600 rounded-2xl mb-4 shadow-lg">
              <Hospital className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-gray-100">MediRoster</h1>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-slate-200 dark:border-gray-700 p-6 flex flex-col items-center gap-3 text-center">
            <CheckCircle className="w-12 h-12 text-amber-500" />
            <h2 className="font-semibold text-slate-900 dark:text-gray-100">Pending approval</h2>
            <p className="text-sm text-slate-500 dark:text-gray-400">
              Your account is awaiting admin approval. You'll receive access once approved.
            </p>
            <button onClick={() => setPendingApproval(false)} className="text-sm text-indigo-600 dark:text-indigo-400 font-medium mt-2 hover:underline">
              Back to login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 dark:from-gray-900 dark:to-indigo-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-indigo-600 rounded-2xl mb-4 shadow-lg">
            <Hospital className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-gray-100">MediRoster</h1>
          <p className="text-slate-500 text-sm mt-1">Hospital Roster Management</p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-slate-200 dark:border-gray-700 p-6">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input
              id="email"
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="doctor@hospital.com"
              required
            />
            <Input
              id="password"
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
            {error && <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 px-3 py-2 rounded-lg">{error}</p>}
            <Button type="submit" loading={loading} className="w-full justify-center mt-1">
              Sign in
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
        </div>

        <p className="text-center text-sm text-slate-500 dark:text-gray-400 mt-4">
          Don't have an account?{' '}
          <Link to="/signup" className="text-indigo-600 dark:text-indigo-400 font-medium hover:underline">
            Request access
          </Link>
        </p>

        <p className="text-center text-xs text-slate-400 mt-3">
          Admin: admin@hospital.com / admin123 · Doctors: alice@hospital.com / doctor123
        </p>
      </div>
    </div>
  );
}
