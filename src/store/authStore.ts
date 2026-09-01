import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { supabase } from '@/services/supabase';
import { UserProfile } from '@/types';

interface AuthState {
  user: UserProfile | null;
  session: any | null;
  isLoading: boolean;
  geminiApiKey: string;
  isDemoMode: boolean;
  setUser: (user: UserProfile | null) => void;
  setGeminiApiKey: (key: string) => Promise<void>;
  initializeAuth: () => Promise<void>;
  loginAsDemo: () => void;
  signOut: () => Promise<void>;
}

const GEMINI_API_KEY_STORAGE = '@scanfinance_gemini_key';
const isSSR = Platform.OS === 'web' && typeof window === 'undefined';

export const useAuthStore = create<AuthState>((set, get) => ({
  user: {
    id: 'demo-user-123',
    email: 'demo@scanfinance.app',
    full_name: 'Pengguna Cerdas',
    currency: 'IDR',
    monthly_income_budget: 15000000,
    monthly_expense_budget: 5000000,
  },
  session: null,
  isLoading: false,
  geminiApiKey: '',
  isDemoMode: true,

  setUser: (user) => set({ user }),

  setGeminiApiKey: async (key: string) => {
    if (!isSSR) {
      try {
        await AsyncStorage.setItem(GEMINI_API_KEY_STORAGE, key);
      } catch {}
    }
    set({ geminiApiKey: key });
  },

  initializeAuth: async () => {
    if (isSSR) return;
    try {
      set({ isLoading: true });
      const storedKey = await AsyncStorage.getItem(GEMINI_API_KEY_STORAGE);
      if (storedKey) {
        set({ geminiApiKey: storedKey });
      }

      const { data } = await supabase.auth.getSession();
      if (data?.session?.user) {
        const u = data.session.user;
        set({
          session: data.session,
          isDemoMode: false,
          user: {
            id: u.id,
            email: u.email || '',
            full_name: u.user_metadata?.full_name || u.email?.split('@')[0] || 'Pengguna',
            currency: 'IDR',
            monthly_income_budget: 15000000,
            monthly_expense_budget: 5000000,
          },
        });
      }
    } catch (err) {
      console.warn('Auth init error:', err);
    } finally {
      set({ isLoading: false });
    }
  },

  loginAsDemo: () => {
    set({
      isDemoMode: true,
      user: {
        id: 'demo-user-123',
        email: 'demo@scanfinance.app',
        full_name: 'Pengguna Cerdas',
        currency: 'IDR',
        monthly_income_budget: 15000000,
        monthly_expense_budget: 5000000,
      },
    });
  },

  signOut: async () => {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      // ignore
    }
    set({ user: null, session: null, isDemoMode: false });
  },
}));
