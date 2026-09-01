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
  signUp: (email: string, password: string, fullName: string) => Promise<{ error?: string }>;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  updateProfile: (data: Partial<UserProfile>) => Promise<void>;
}

const PROFILE_STORAGE_KEY = '@scanfinance_user_profile';
const GEMINI_API_KEY_STORAGE = '@scanfinance_gemini_key';
const isSSR = Platform.OS === 'web' && typeof window === 'undefined';

const DEFAULT_PROFILE: UserProfile = {
  id: 'user-default-1',
  email: 'user1@company.com',
  full_name: 'User 1',
  company_name: 'PT. Nama Perusahaan',
  department: 'Divisi Operasional',
  project_name: 'Head Office / Proyek 1',
  city: 'Jakarta',
  verifier_name: 'Pemeriksa 1',
  approver_name: 'Pimpinan 1',
  cash_advance_amount: 5000000,
  currency: 'IDR',
  monthly_income_budget: 10000000,
  monthly_expense_budget: 5000000,
};

export const useAuthStore = create<AuthState>((set, get) => ({
  user: DEFAULT_PROFILE,
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

      // 1. Cek profil tersimpan di local
      const savedProfRaw = await AsyncStorage.getItem(PROFILE_STORAGE_KEY);
      let localProfile: UserProfile = DEFAULT_PROFILE;
      if (savedProfRaw) {
        try {
          localProfile = { ...DEFAULT_PROFILE, ...JSON.parse(savedProfRaw) };
          set({ user: localProfile });
        } catch {}
      }

      // 2. Cek sesi Supabase Auth
      const { data } = await supabase.auth.getSession();
      if (data?.session?.user) {
        const u = data.session.user;
        const { data: dbProfile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', u.id)
          .single();

        const merged: UserProfile = {
          ...localProfile,
          id: u.id,
          email: u.email || localProfile.email,
          full_name: dbProfile?.full_name || u.user_metadata?.full_name || localProfile.full_name,
          company_name: dbProfile?.company_name || localProfile.company_name,
          department: dbProfile?.department || localProfile.department,
          project_name: dbProfile?.project_name || localProfile.project_name,
          city: dbProfile?.city || localProfile.city,
          verifier_name: dbProfile?.verifier_name || localProfile.verifier_name,
          approver_name: dbProfile?.approver_name || localProfile.approver_name,
          cash_advance_amount: dbProfile?.cash_advance_amount ?? localProfile.cash_advance_amount,
        };

        set({
          session: data.session,
          isDemoMode: false,
          user: merged,
        });
      }
    } catch (err) {
      console.warn('Auth init notice:', err);
    } finally {
      set({ isLoading: false });
    }
  },

  loginAsDemo: () => {
    set({
      user: DEFAULT_PROFILE,
      session: null,
      isDemoMode: true,
    });
  },

  signUp: async (email, password, fullName) => {
    try {
      set({ isLoading: true });
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
        },
      });

      if (error) {
        return { error: error.message };
      }

      if (data.user) {
        const newProf: UserProfile = {
          ...DEFAULT_PROFILE,
          id: data.user.id,
          email: data.user.email || email,
          full_name: fullName,
        };
        set({ user: newProf, session: data.session, isDemoMode: false });
        await AsyncStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(newProf));
      }
      return {};
    } catch (err: any) {
      return { error: err.message || 'Terjadi kesalahan saat mendaftar.' };
    } finally {
      set({ isLoading: false });
    }
  },

  signIn: async (email, password) => {
    try {
      set({ isLoading: true });
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        return { error: error.message };
      }

      if (data.user) {
        const u = data.user;
        const current = get().user || DEFAULT_PROFILE;
        const merged: UserProfile = {
          ...current,
          id: u.id,
          email: u.email || email,
          full_name: u.user_metadata?.full_name || current.full_name,
        };
        set({ user: merged, session: data.session, isDemoMode: false });
        await AsyncStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(merged));
      }
      return {};
    } catch (err: any) {
      return { error: err.message || 'Terjadi kesalahan saat masuk.' };
    } finally {
      set({ isLoading: false });
    }
  },

  signOut: async () => {
    try {
      await supabase.auth.signOut();
    } catch {}
    set({ session: null, isDemoMode: true });
  },

  updateProfile: async (data: Partial<UserProfile>) => {
    const current = get().user || DEFAULT_PROFILE;
    const updated: UserProfile = { ...current, ...data };
    set({ user: updated });

    if (!isSSR) {
      try {
        await AsyncStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(updated));
      } catch {}
    }

    const session = get().session;
    if (session?.user?.id) {
      try {
        await supabase
          .from('profiles')
          .update({
            full_name: updated.full_name,
            company_name: updated.company_name,
            department: updated.department,
            project_name: updated.project_name,
            city: updated.city,
            verifier_name: updated.verifier_name,
            approver_name: updated.approver_name,
            cash_advance_amount: updated.cash_advance_amount,
          })
          .eq('id', session.user.id);
      } catch (err) {
        console.warn('Could not sync profile update to cloud:', err);
      }
    }
  },
}));
