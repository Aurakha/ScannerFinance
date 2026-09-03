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
  resetPasswordForEmail: (email: string) => Promise<{ error?: string }>;
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
    role?: 'admin' | 'user';
  }) => Promise<{ success: boolean; error?: string }>;
  updateUserRole: (userId: string, role: 'admin' | 'user') => Promise<{ success: boolean; error?: string }>;
  impersonateUser: (targetUser: UserProfile) => void;
  exitImpersonation: () => void;
}

const PROFILE_STORAGE_KEY = '@scanfinance_user_profile';
const REGISTERED_USERS_KEY = '@scanfinance_registered_users_list';
const GEMINI_API_KEY_STORAGE = '@scanfinance_gemini_key';
const isSSR = Platform.OS === 'web' && typeof window === 'undefined';

const DEFAULT_PROFILE: UserProfile = {
  id: 'user-default-1',
  email: 'guest@scanfinance.com',
  full_name: 'Guest',
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

export const SUPABASE_AUTH_USERS_MAP: Record<string, { email: string; full_name: string }> = {
  '06c4ff59-e531-49cc-b3b8-dbd3c3fc8e94': {
    email: 'aurakharere@gmail.com',
    full_name: 'raka2',
  },
  '68bfd819-58eb-42a8-b554-a52381214154': {
    email: 'gabrielrudra9@gmail.com',
    full_name: 'gabriel',
  },
  '432506ee-f847-41b8-a59e-5dd2c741fe04': {
    email: 'haharakha@gmail.com',
    full_name: 'raka',
  },
  '407f1456-a322-4831-8127-762b16d1991f': {
    email: 'scanfinancebucket@gmail.com',
    full_name: 'Albert',
  },
};

const SEED_USERS: UserProfile[] = [
  {
    id: '06c4ff59-e531-49cc-b3b8-dbd3c3fc8e94',
    email: 'aurakharere@gmail.com',
    full_name: 'raka2',
    company_name: 'PT. San Kawan Abadi',
    department: 'Divisi Operasional',
    project_name: 'Head Office / Proyek 1',
    city: 'Jakarta',
    verifier_name: 'Yunitha',
    approver_name: 'Dwi Hartanto',
    cash_advance_amount: 5000000,
    currency: 'IDR',
    monthly_income_budget: 15000000,
    monthly_expense_budget: 8000000,
    role: 'admin',
    created_at: '2026-09-01T09:46:52.499366+00:00',
  },
  {
    id: '68bfd819-58eb-42a8-b554-a52381214154',
    email: 'gabrielrudra9@gmail.com',
    full_name: 'gabriel',
    company_name: 'PT. San Kawan Abadi',
    department: 'Divisi Operasional',
    project_name: 'Head Office / Proyek 1',
    city: 'Jakarta',
    verifier_name: 'Yunitha',
    approver_name: 'Dwi Hartanto',
    cash_advance_amount: 5000000,
    currency: 'IDR',
    monthly_income_budget: 10000000,
    monthly_expense_budget: 5000000,
    role: 'user',
    created_at: '2026-09-03T06:30:21.387375+00:00',
  },
  {
    id: '432506ee-f847-41b8-a59e-5dd2c741fe04',
    email: 'haharakha@gmail.com',
    full_name: 'raka',
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
    role: 'admin',
    created_at: '2026-09-01T08:30:39.401004+00:00',
  },
  {
    id: '407f1456-a322-4831-8127-762b16d1991f',
    email: 'scanfinancebucket@gmail.com',
    full_name: 'Albert',
    company_name: 'PT. San Kawan Abadi',
    department: 'Divisi Operasional',
    project_name: 'Head Office / Proyek 1',
    city: 'Jakarta',
    verifier_name: 'Yunitha',
    approver_name: 'Dwi Hartanto',
    cash_advance_amount: 5000000,
    currency: 'IDR',
    monthly_income_budget: 10000000,
    monthly_expense_budget: 5000000,
    role: 'user',
    created_at: '2026-09-02T08:41:11.723424+00:00',
  },
  {
    id: 'user-test-demo',
    email: 'test@gmail.com',
    full_name: 'Pengguna Test',
    company_name: '', // Belum diisi agar memicu modal wajib isi profil perusahaan
    department: '',
    project_name: '',
    city: '',
    cash_advance_amount: 5000000,
    currency: 'IDR',
    monthly_income_budget: 10000000,
    monthly_expense_budget: 5000000,
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
          const parsed = JSON.parse(savedProfRaw);
          if (
            parsed.full_name === 'Pengguna ScanFinance' ||
            parsed.full_name === 'Pengguna' ||
            parsed.full_name === 'User 1'
          ) {
            parsed.full_name = 'Guest';
          }
          localProfile = { ...DEFAULT_PROFILE, ...parsed };
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
          .maybeSingle();

        const role = dbProfile?.role || 'user';

        const merged: UserProfile = {
          ...DEFAULT_PROFILE,
          id: u.id,
          email: u.email || localProfile.email,
          full_name:
            dbProfile?.full_name ||
            u.user_metadata?.full_name ||
            localProfile.full_name,
          role,
          company_name: dbProfile?.company_name || localProfile.company_name,
          department: dbProfile?.department || localProfile.department,
          project_name: dbProfile?.project_name || localProfile.project_name,
          city: dbProfile?.city || localProfile.city,
          verifier_name: dbProfile?.verifier_name || localProfile.verifier_name,
          approver_name: dbProfile?.approver_name || localProfile.approver_name,
          cash_advance_amount:
            dbProfile?.cash_advance_amount !== undefined
              ? Number(dbProfile.cash_advance_amount)
              : localProfile.cash_advance_amount,
        };

        set({ user: merged, session: data.session, isDemoMode: false });
        await AsyncStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(merged));
      } else {
        // Jika tidak ada sesi login, pastikan user berada di mode guest/demo dengan nama Guest
        const guestProfile: UserProfile = {
          ...localProfile,
          full_name: localProfile.full_name === 'Pengguna ScanFinance' || !localProfile.full_name ? 'Guest' : localProfile.full_name,
        };
        set({ user: guestProfile, isDemoMode: true });
      }
    } catch (e) {
      console.warn('Auth init note:', e);
    } finally {
      set({ isLoading: false });
    }
  },

  loginAsDemo: () => {
    const guestUser: UserProfile = {
      ...DEFAULT_PROFILE,
      full_name: 'Guest',
      email: 'guest@scanfinance.com',
    };
    set({
      user: guestUser,
      session: null,
      isDemoMode: true,
      impersonatingUser: null,
    });
    if (!isSSR) {
      AsyncStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(guestUser)).catch(() => {});
    }
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
        let msg = error.message;
        if (msg.includes('already registered') || msg.includes('User already registered')) {
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
    const cleanEmail = email.trim().toLowerCase();
    try {
      set({ isLoading: true });

      // Fallback instan untuk akun pengujian: test@gmail.com
      if (cleanEmail === 'test@gmail.com') {
        const testUser: UserProfile = {
          ...DEFAULT_PROFILE,
          id: 'user-test-demo',
          email: 'test@gmail.com',
          full_name: 'Pengguna Test',
          company_name: '', // Wajib kosong agar memicu onboarding modal
          department: '',
          role: 'user',
        };
        set({
          user: testUser,
          session: { user: { id: testUser.id, email: testUser.email } },
          isDemoMode: false,
        });
        await AsyncStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(testUser));
        return {};
      }

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
            .maybeSingle();
          dbProfile = prof;
        } catch {}

        const role = dbProfile?.role || 'user';

        const newProf: UserProfile = {
          ...DEFAULT_PROFILE,
          id: u.id,
          email: u.email || email,
          full_name:
            dbProfile?.full_name ||
            u.user_metadata?.full_name ||
            u.email?.split('@')[0] ||
            'Pengguna',
          role,
          company_name: dbProfile?.company_name || 'PT. Nama Perusahaan',
          department: dbProfile?.department || 'Divisi Operasional',
          project_name: dbProfile?.project_name || 'Head Office / Proyek 1',
          city: dbProfile?.city || 'Jakarta',
          verifier_name: dbProfile?.verifier_name || 'Pemeriksa 1',
          approver_name: dbProfile?.approver_name || 'Pimpinan 1',
          cash_advance_amount:
            dbProfile?.cash_advance_amount !== undefined
              ? Number(dbProfile.cash_advance_amount)
              : 5000000,
        };

        set({ user: newProf, session: data.session, isDemoMode: false });
        await AsyncStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(newProf));

        // Update di daftar all users
        const users = await get().getAllUsers();
        const updated = [newProf, ...users.filter((usr) => usr.email !== newProf.email)];
        await AsyncStorage.setItem(REGISTERED_USERS_KEY, JSON.stringify(updated));
      }
      return {};
    } catch (err: any) {
      return { error: err.message || 'Terjadi kesalahan saat masuk.' };
    } finally {
      set({ isLoading: false });
    }
  },

  resetPasswordForEmail: async (email) => {
    try {
      set({ isLoading: true });
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: Platform.OS === 'web' && typeof window !== 'undefined'
          ? `${window.location.origin}/auth/reset-password`
          : undefined,
      });
      if (error) {
        return { error: error.message };
      }
      return {};
    } catch (err: any) {
      return { error: err.message || 'Gagal mengirim link reset password.' };
    } finally {
      set({ isLoading: false });
    }
  },

  signOut: async () => {
    try {
      set({ isLoading: true });
      await supabase.auth.signOut();
      await AsyncStorage.removeItem(PROFILE_STORAGE_KEY);
      const guestUser: UserProfile = {
        ...DEFAULT_PROFILE,
        full_name: 'Guest',
        email: 'guest@scanfinance.com',
      };
      set({
        user: guestUser,
        session: null,
        isDemoMode: true,
        impersonatingUser: null,
      });
    } catch (e) {
      console.warn('Sign out note:', e);
    } finally {
      set({ isLoading: false });
    }
  },

  updateProfile: async (data) => {
    const currentUser = get().user;
    if (!currentUser) return;

    const updatedUser: UserProfile = { ...currentUser, ...data };
    set({ user: updatedUser });
    await AsyncStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(updatedUser));

    // Update di DB Supabase jika ada sesi aktif
    if (get().session?.user?.id) {
      try {
        await supabase
          .from('profiles')
          .update({
            full_name: updatedUser.full_name,
            company_name: updatedUser.company_name,
            department: updatedUser.department,
            project_name: updatedUser.project_name,
            city: updatedUser.city,
            verifier_name: updatedUser.verifier_name,
            approver_name: updatedUser.approver_name,
            cash_advance_amount: updatedUser.cash_advance_amount,
          })
          .eq('id', get().session.user.id);
      } catch (err) {
        console.warn('Update profile db note:', err);
      }
    }

    // Update di list local all users
    try {
      const all = await get().getAllUsers();
      const updatedList = all.map((u) => (u.id === updatedUser.id ? updatedUser : u));
      await AsyncStorage.setItem(REGISTERED_USERS_KEY, JSON.stringify(updatedList));
    } catch {}
  },

  getAllUsers: async () => {
    try {
      // Coba ambil dari Supabase profiles jika koneksi aktif
      const { data: dbUsers, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && dbUsers && dbUsers.length > 0) {
        const mappedUsers: UserProfile[] = dbUsers.map((p: any) => {
          const authUser = SUPABASE_AUTH_USERS_MAP[p.id];
          const realEmail = authUser?.email || p.email || (p.full_name?.includes('@') ? p.full_name : `${p.full_name?.toLowerCase().replace(/\s+/g, '')}@gmail.com`);
          const realName = p.full_name || authUser?.full_name || 'Pengguna';

          return {
            ...DEFAULT_PROFILE,
            id: p.id,
            email: realEmail,
            full_name: realName,
            company_name: p.company_name || 'PT. San Kawan Abadi',
            department: p.department || 'Divisi Operasional',
            project_name: p.project_name || 'Head Office / Proyek 1',
            city: p.city || 'Jakarta',
            verifier_name: p.verifier_name || 'Yunitha',
            approver_name: p.approver_name || 'Dwi Hartanto',
            cash_advance_amount: p.cash_advance_amount !== undefined ? Number(p.cash_advance_amount) : 5000000,
            role: p.role || 'user',
            created_at: p.created_at,
          };
        });

        // Tambahkan akun test jika belum ada
        if (!mappedUsers.some((u) => u.email === 'test@gmail.com')) {
          const testSeed = SEED_USERS.find((u) => u.email === 'test@gmail.com');
          if (testSeed) mappedUsers.push(testSeed);
        }

        await AsyncStorage.setItem(REGISTERED_USERS_KEY, JSON.stringify(mappedUsers));
        return mappedUsers;
      }

      // Fallback ke local storage
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
      role: userData.role || 'user',
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

  updateUserRole: async (userId: string, role: 'admin' | 'user') => {
    try {
      // 1. Update in Supabase
      try {
        await supabase.from('profiles').update({ role }).eq('id', userId);
      } catch {}

      // 2. Update in LocalStorage
      const users = await get().getAllUsers();
      const updated = users.map((u) => (u.id === userId ? { ...u, role } : u));
      await AsyncStorage.setItem(REGISTERED_USERS_KEY, JSON.stringify(updated));

      // Jika user yang diupdate adalah currentUser
      if (get().user?.id === userId) {
        const updatedSelf = { ...get().user!, role };
        set({ user: updatedSelf });
        await AsyncStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(updatedSelf));
      }

      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message || 'Gagal mengubah role.' };
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
