import { cn } from '@/lib/utils';
import { ShiftType } from '@/types';

const shiftConfig: Record<ShiftType, { label: string; className: string }> = {
  MORNING: { label: 'M', className: 'bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800' },
  NIGHT: { label: 'N', className: 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800' },
  OFF: { label: 'O', className: 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-600' },
  WO: { label: 'WO', className: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800' },
  LEAVE: { label: 'L', className: 'bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800' },
};

export function ShiftBadge({ type, className }: { type: ShiftType; className?: string }) {
  const config = shiftConfig[type];
  return (
    <span className={cn('inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-semibold border', config.className, className)}>
      {config.label}
    </span>
  );
}
