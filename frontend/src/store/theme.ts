import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ThemeState {
  isDark: boolean;
  toggle: () => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      isDark: false,
      toggle: () => {
        const next = !get().isDark;
        document.documentElement.classList.toggle('dark', next);
        set({ isDark: next });
      },
    }),
    { name: 'theme-store' }
  )
);

export function initTheme() {
  const stored = localStorage.getItem('theme-store');
  if (stored) {
    const isDark = JSON.parse(stored)?.state?.isDark;
    document.documentElement.classList.toggle('dark', !!isDark);
  }
}
