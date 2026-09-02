import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

// Default Supabase configuration & Gemini API Key
export const DEFAULT_SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://pyxffpdxwatrqvywstoi.supabase.co';

export const DEFAULT_SUPABASE_ANON_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_dWPrnwPdUesrBOR8ICp5Ng_LiFh3Fd9';

export const DEFAULT_GEMINI_API_KEY =
  process.env.EXPO_PUBLIC_GEMINI_API_KEY || '';

const isSSR = typeof window === 'undefined';

const ssrSafeStorage = {
  getItem: async (key: string): Promise<string | null> => {
    if (isSSR) return null;
    try {
      return await AsyncStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem: async (key: string, value: string): Promise<void> => {
    if (isSSR) return;
    try {
      await AsyncStorage.setItem(key, value);
    } catch {}
  },
  removeItem: async (key: string): Promise<void> => {
    if (isSSR) return;
    try {
      await AsyncStorage.removeItem(key);
    } catch {}
  },
};

export const supabase = createClient(DEFAULT_SUPABASE_URL, DEFAULT_SUPABASE_ANON_KEY, {
  auth: {
    storage: ssrSafeStorage,
    autoRefreshToken: !isSSR,
    persistSession: !isSSR,
    detectSessionInUrl: false,
  },
});

export const isSupabaseConfigured = (): boolean => {
  return Boolean(DEFAULT_SUPABASE_URL) && !DEFAULT_SUPABASE_URL.includes('xyzcompany');
};
