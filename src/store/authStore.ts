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
  impersonatingUser: UserProfile | null;
  setUser: (user: UserProfile | null) => void;
  setGeminiApiKey: (key: string) => Promise<void>;
  initializeAuth: () => Promise<void>;
  loginAsDemo: () => void;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error?: string }>;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  updateProfile: (data: Partial<UserProfile>) => Promise<void>;
  // Admin Features
  getAllUsers: () => Promise<UserProfile[]>;
  createUserByAdmin: (data: {
    full_name: string;
    email: string;
    password?: string;
    company_name?: string;
    department?: string;
    project_name?: string;
    city?: string;
    cash_advance_amount?: number;
  }) => Promise<{ success: boolean; error?: string }>;
  impersonateUser: (targetUser: UserProfile) => void;
  exitImpersonation: () => void;
}

const PROFILE_STORAGE_KEY = '@scanfinance_user_profile';
const REGISTERED_USERS_KEY = '@scanfinance_registered_users_list';
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
  role: 'user',
};

const SEED_USERS: UserProfile[] = [
  {
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
    role: 'user',
    created_at: new Date().toISOString(),
  },
  {
    id: 'user-raka-2',
    email: 'haharakha@gmail.com',
    full_name: 'Raka Renata',
    company_name: 'PT. San Kawan Abadi',
    department: 'Operation & Field',
    project_name: 'Tangerang Project',
    city: 'Tangerang',
    verifier_name: 'Yunitha',
    approver_name: 'Dwi Hartanto',
    cash_advance_amount: 7117500,
    currency: 'IDR',
    monthly_income_budget: 12000000,
    monthly_expense_budget: 7000000,
    role: 'user',
    created_at: new Date().toISOString(),
  },
];

export const useAuthStore = create<AuthState>((set, get) => ({
  user: DEFAULT_PROFILE,
  session: null,
  isLoading: false,
  geminiApiKey: '',
  isDemoMode: true,
  impersonatingUser: null,

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
          submission_date: dbProfile?.submission_date || localProfile.submission_date,
          role: dbProfile?.role || 'user',
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
      user: { ...DEFAULT_PROFILE, role: 'user' },
      session: { user: { id: 'user-default-1', email: 'demo@scanfinance.com' } },
      isDemoMode: false,
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
            role: 'user',
          },
        },
      });

      if (error) {
        let msg = error.message;
        if (msg.includes('User already registered') || msg.includes('already exists')) {
          msg = 'Email ini sudah terdaftar. Silakan langsung masuk ke akun Anda.';
        } else if (msg.includes('Password should be at least')) {
          msg = 'Kata sandi minimal harus 6 karakter.';
        } else if (msg.includes('valid email')) {
          msg = 'Format alamat email tidak valid.';
        }
        return { error: msg };
      }

      if (data.user) {
        const newProf: UserProfile = {
          ...DEFAULT_PROFILE,
          id: data.user.id,
          email: data.user.email || email,
          full_name: fullName,
          role: 'user',
        };
        set({ user: newProf, session: data.session, isDemoMode: false });
        await AsyncStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(newProf));

        // Simpan ke local list user
        const users = await get().getAllUsers();
        const updatedUsers = [newProf, ...users.filter((u) => u.id !== newProf.id)];
        await AsyncStorage.setItem(REGISTERED_USERS_KEY, JSON.stringify(updatedUsers));
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
        let msg = error.message;
        if (msg.includes('Invalid login credentials')) {
          msg = 'Email atau kata sandi salah. Silakan periksa kembali atau buat akun baru jika belum terdaftar.';
        } else if (msg.includes('Email not confirmed')) {
          msg = 'Email belum diverifikasi. Cek inbox email Anda atau nonaktifkan "Confirm email" di pengaturan Supabase Auth.';
        } else if (msg.includes('rate limit') || msg.includes('Too many requests')) {
          msg = 'Terlalu banyak percobaan masuk. Mohon tunggu beberapa saat.';
        }
        return { error: msg };
      }

      if (data.user) {
        const u = data.user;
        let dbProfile: any = null;
        try {
          const { data: prof } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', u.id)
            .single();
          dbProfile = prof;
        } catch {}

        const current = get().user || DEFAULT_PROFILE;
        const merged: UserProfile = {
          ...current,
          id: u.id,
          email: u.email || email,
          full_name: dbProfile?.full_name || u.user_metadata?.full_name || current.full_name,
          company_name: dbProfile?.company_name || current.company_name,
          department: dbProfile?.department || current.department,
          project_name: dbProfile?.project_name || current.project_name,
          city: dbProfile?.city || current.city,
          verifier_name: dbProfile?.verifier_name || current.verifier_name,
          approver_name: dbProfile?.approver_name || current.approver_name,
          cash_advance_amount: dbProfile?.cash_advance_amount ?? current.cash_advance_amount,
          submission_date: dbProfile?.submission_date || current.submission_date,
          role: dbProfile?.role || 'user',
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
    if (!isSSR) {
      try {
        await AsyncStorage.removeItem(PROFILE_STORAGE_KEY);
      } catch {}
    }
    set({ user: null, session: null, isDemoMode: false, impersonatingUser: null });
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

  getAllUsers: async () => {
    if (isSSR) return SEED_USERS;

    // 1. Coba ambil dari database Supabase profiles
    try {
      const { data, error } = await supabase.from('profiles').select('*');
      if (!error && data && data.length > 0) {
        const formatted: UserProfile[] = data.map((d: any) => ({
          ...DEFAULT_PROFILE,
          ...d,
        }));
        await AsyncStorage.setItem(REGISTERED_USERS_KEY, JSON.stringify(formatted));
        return formatted;
      }
    } catch (err) {
      console.warn('Supabase fetch profiles notice:', err);
    }

    // 2. Ambil dari local storage
    try {
      const raw = await AsyncStorage.getItem(REGISTERED_USERS_KEY);
      if (raw) {
        return JSON.parse(raw);
      }
      await AsyncStorage.setItem(REGISTERED_USERS_KEY, JSON.stringify(SEED_USERS));
      return SEED_USERS;
    } catch {
      return SEED_USERS;
    }
  },

  createUserByAdmin: async (userData) => {
    const newId = `user-adm-${Date.now()}`;
    const newUser: UserProfile = {
      ...DEFAULT_PROFILE,
      id: newId,
      email: userData.email,
      full_name: userData.full_name,
      company_name: userData.company_name || 'PT. Nama Perusahaan',
      department: userData.department || 'Divisi Operasional',
      project_name: userData.project_name || 'Head Office / Proyek 1',
      city: userData.city || 'Jakarta',
      cash_advance_amount: userData.cash_advance_amount ?? 5000000,
      created_at: new Date().toISOString(),
    };

    // 1. Jika ada Supabase Auth, coba daftarkan
    if (userData.password) {
      try {
        await supabase.auth.signUp({
          email: userData.email,
          password: userData.password,
          options: {
            data: { full_name: userData.full_name },
          },
        });
      } catch {}
    }

    // 2. Simpan ke local list
    try {
      const existing = await get().getAllUsers();
      const updated = [newUser, ...existing.filter((u) => u.email !== newUser.email)];
      await AsyncStorage.setItem(REGISTERED_USERS_KEY, JSON.stringify(updated));
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Gagal menambahkan user.' };
    }
  },

  impersonateUser: (targetUser: UserProfile) => {
    const originalUser = get().user;
    set({
      impersonatingUser: originalUser,
      user: targetUser,
    });
  },

  exitImpersonation: () => {
    const orig = get().impersonatingUser;
    if (orig) {
      set({
        user: orig,
        impersonatingUser: null,
      });
    }
  },
}));
