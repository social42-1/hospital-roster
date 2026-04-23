import { createBrowserRouter, Navigate } from 'react-router-dom';
import { useAuthStore } from '@/store/auth';
import LoginPage from '@/pages/LoginPage';
import SignupPage from '@/pages/SignupPage';
import AdminLayout from '@/apps/admin/AdminLayout';
import Dashboard from '@/apps/admin/pages/Dashboard';
import RosterPage from '@/apps/admin/pages/RosterPage';
import StaffPage from '@/apps/admin/pages/StaffPage';
import LeavePage from '@/apps/admin/pages/LeavePage';
import UserLayout from '@/apps/user/UserLayout';
import MyRosterPage from '@/apps/user/pages/MyRosterPage';
import TeamRosterPage from '@/apps/user/pages/TeamRosterPage';
import LeaveRequestPage from '@/apps/user/pages/LeaveRequestPage';

function RequireRole({ role, children }: { role: 'ADMIN' | 'DOCTOR'; children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user);
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== role) return <Navigate to={user.role === 'ADMIN' ? '/admin' : '/user'} replace />;
  return <>{children}</>;
}

export const router = createBrowserRouter([
  { path: '/', element: <Navigate to="/login" replace /> },
  { path: '/login', element: <LoginPage /> },
  { path: '/signup', element: <SignupPage /> },
  {
    path: '/admin',
    element: <RequireRole role="ADMIN"><AdminLayout /></RequireRole>,
    children: [
      { index: true, element: <Dashboard /> },
      { path: 'roster', element: <RosterPage /> },
      { path: 'staff', element: <StaffPage /> },
      { path: 'leave', element: <LeavePage /> },
    ],
  },
  {
    path: '/user',
    element: <RequireRole role="DOCTOR"><UserLayout /></RequireRole>,
    children: [
      { index: true, element: <MyRosterPage /> },
      { path: 'team', element: <TeamRosterPage /> },
      { path: 'leave', element: <LeaveRequestPage /> },
    ],
  },
]);
