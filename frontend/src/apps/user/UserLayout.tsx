import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/auth';
import { useThemeStore } from '@/store/theme';
import { Calendar, Users, FileText, Hospital, LogOut, Sun, Moon } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils';

const navItems = [
  { to: '/user', label: 'My Roster', icon: Calendar, end: true },
  { to: '/user/team', label: 'Team Roster', icon: Users },
  { to: '/user/leave', label: 'Leave Request', icon: FileText },
];

export default function UserLayout() {
  const { user, logout } = useAuthStore();
  const { isDark, toggle } = useThemeStore();
  const navigate = useNavigate();

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-gray-900">
      <aside className="w-64 bg-white dark:bg-gray-800 border-r border-slate-200 dark:border-gray-700 flex flex-col shrink-0">
        <div className="px-6 py-5 border-b border-slate-100 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center shrink-0">
              <Hospital className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-slate-900 dark:text-gray-100 font-semibold text-sm">MediRoster</p>
              <p className="text-slate-400 text-xs">Doctor Portal</p>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-b border-slate-100 dark:border-gray-700">
          <p className="font-semibold text-slate-900 dark:text-gray-100 text-sm">{user?.name}</p>
          <Badge variant={user?.grade === 'SENIOR' ? 'info' : 'warning'} className="mt-1">{user?.grade}</Badge>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn('flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300'
                    : 'text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-gray-700')
              }
            >
              <Icon className="w-4 h-4" />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="px-3 pb-4 border-t border-slate-100 dark:border-gray-700 pt-4">
          <button
            onClick={toggle}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-gray-700 transition-colors"
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            {isDark ? 'Light mode' : 'Dark mode'}
          </button>
          <button
            onClick={() => { logout(); navigate('/login'); }}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-gray-700 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
