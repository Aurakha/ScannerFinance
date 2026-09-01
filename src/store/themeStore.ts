import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { Colors } from '@/constants/theme';

export type ThemeMode = 'dark' | 'light';

interface ThemeState {
  mode: ThemeMode;
  theme: typeof Colors.dark;
  toggleTheme: () => void;
  setThemeMode: (mode: ThemeMode) => void;
  loadTheme: () => Promise<void>;
}

const THEME_STORAGE_KEY = '@scanfinance_theme_mode';
const isSSR = Platform.OS === 'web' && typeof window === 'undefined';

export const useThemeStore = create<ThemeState>((set, get) => ({
  mode: 'dark',
  theme: Colors.dark,

  toggleTheme: () => {
    const nextMode: ThemeMode = get().mode === 'dark' ? 'light' : 'dark';
    get().setThemeMode(nextMode);
  },

  setThemeMode: (mode: ThemeMode) => {
    set({ mode, theme: Colors[mode] });
    if (!isSSR) {
      AsyncStorage.setItem(THEME_STORAGE_KEY, mode).catch(() => {});
    }
  },

  loadTheme: async () => {
    if (isSSR) return;
    try {
      const saved = await AsyncStorage.getItem(THEME_STORAGE_KEY);
      if (saved === 'dark' || saved === 'light') {
        set({ mode: saved, theme: Colors[saved] });
      }
    } catch {}
  },
}));
