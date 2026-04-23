import { ChevronLeft, ChevronRight, Check, Copy, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { RosterStatus } from '@/types';

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export interface MonthPickerProps {
  variant: 'team-roster' | 'my-roster' | 'admin-roster';
  selectedMonth: number;
  selectedYear: number;
  onMonthChange: (month: number) => void;
  onYearChange: (year: number) => void;
  // admin-roster actions
  onCopyPrev?: () => void;
  copyPrevLoading?: boolean;
  onClear?: () => void;
  clearLoading?: boolean;
  onPublish?: () => void;
  publishLoading?: boolean;
  rosterStatus?: RosterStatus;
  hasRoster?: boolean;
}

export function MonthPicker({
  variant,
  selectedMonth,
  selectedYear,
  onMonthChange,
  onYearChange,
  onCopyPrev,
  copyPrevLoading,
  onClear,
  clearLoading,
  onPublish,
  publishLoading,
  rosterStatus,
  hasRoster,
}: MonthPickerProps) {
  const isAdmin = variant === 'admin-roster';

  return (
    <div className="flex flex-col gap-3 mb-6">
      <div className="flex items-center gap-1">
        {/* Year stepper */}
        <button
          onClick={() => onYearChange(selectedYear - 1)}
          disabled={selectedYear <= 2026}
          className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-gray-700 transition-colors text-slate-500 dark:text-gray-400 disabled:opacity-30 disabled:cursor-not-allowed"
          aria-label="Previous year"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-sm font-semibold text-slate-700 dark:text-gray-200 w-11 text-center select-none">
          {selectedYear}
        </span>
        <button
          onClick={() => onYearChange(selectedYear + 1)}
          className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-gray-700 transition-colors text-slate-500 dark:text-gray-400"
          aria-label="Next year"
        >
          <ChevronRight className="w-4 h-4" />
        </button>

        {/* Admin action buttons */}
        {isAdmin && (
          <div className="flex items-center gap-2 ml-auto">
            {onCopyPrev && (
              <Button variant="secondary" size="sm" onClick={onCopyPrev} loading={copyPrevLoading}>
                <Copy className="w-3.5 h-3.5" />
                Copy Prev
              </Button>
            )}
            {onClear && hasRoster && (
              <Button variant="secondary" size="sm" onClick={onClear} loading={clearLoading}>
                <Trash2 className="w-3.5 h-3.5" />
                Clear
              </Button>
            )}
            {onPublish && hasRoster && (
              <Button size="sm" onClick={onPublish} loading={publishLoading}>
                {rosterStatus === 'PUBLISHED' ? 'Unpublish' : 'Publish'}
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Month pills */}
      <div className="overflow-x-auto pb-1 -mx-1 px-1 scrollbar-thin">
        <div className="flex gap-1.5 min-w-max">
          {MONTH_LABELS.map((label, i) => {
            const m = i + 1;
            const isSelected = m === selectedMonth;
            return (
              <button
                key={m}
                onClick={() => onMonthChange(m)}
                className={cn(
                  'flex flex-col items-center gap-0.5 px-3.5 py-2 rounded-full border text-sm font-medium transition-all whitespace-nowrap min-w-[3.5rem]',
                  isSelected
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                    : 'bg-white dark:bg-gray-800 text-slate-600 dark:text-gray-300 border-slate-200 dark:border-gray-600 hover:bg-slate-50 dark:hover:bg-gray-700'
                )}
              >
                <span className="flex items-center gap-1 leading-none">
                  {isSelected && <Check className="w-3 h-3 shrink-0" />}
                  {label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
