import * as ToastPrimitive from '@radix-ui/react-toast';
import { create } from 'zustand';
import { CheckCircle, XCircle, X } from 'lucide-react';
import { cn } from '@/lib/utils';

type ToastType = 'success' | 'error';
interface ToastItem { id: string; message: string; type: ToastType; }

interface ToastStore {
  toasts: ToastItem[];
  show: (message: string, type?: ToastType) => void;
  remove: (id: string) => void;
}

export const useToast = create<ToastStore>((set) => ({
  toasts: [],
  show: (message, type = 'success') => {
    const id = Math.random().toString(36).slice(2);
    set((s) => ({ toasts: [...s.toasts, { id, message, type }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 4000);
  },
  remove: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export function ToastProvider() {
  const { toasts, remove } = useToast();
  return (
    <ToastPrimitive.Provider>
      {toasts.map((t) => (
        <ToastPrimitive.Root
          key={t.id}
          open
          onOpenChange={(open) => !open && remove(t.id)}
          className={cn(
            'flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border text-sm font-medium',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            t.type === 'success' ? 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300' : 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800 text-red-800 dark:text-red-300'
          )}
        >
          {t.type === 'success' ? <CheckCircle className="w-4 h-4 flex-shrink-0" /> : <XCircle className="w-4 h-4 flex-shrink-0" />}
          <ToastPrimitive.Description className="flex-1">{t.message}</ToastPrimitive.Description>
          <ToastPrimitive.Close onClick={() => remove(t.id)}>
            <X className="w-4 h-4 opacity-60 hover:opacity-100" />
          </ToastPrimitive.Close>
        </ToastPrimitive.Root>
      ))}
      <ToastPrimitive.Viewport className="fixed bottom-4 right-4 flex flex-col gap-2 z-50 max-w-sm" />
    </ToastPrimitive.Provider>
  );
}
