import { cn } from '@/lib/utils';
import { ShiftType } from '@/types';

const shiftConfig: Record<ShiftType, { label: string; className: string }> = {
  MORNING: { label: 'M', className: 'bg-sky-100 text-sky-700 border-sky-200' },
  NIGHT: { label: 'N', className: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
  OFF: { label: 'O', className: 'bg-slate-100 text-slate-500 border-slate-200' },
  WO: { label: 'WO', className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
};

export function ShiftBadge({ type, className }: { type: ShiftType; className?: string }) {
  const config = shiftConfig[type];
  return (
    <span className={cn('inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-semibold border', config.className, className)}>
      {config.label}
    </span>
  );
}
