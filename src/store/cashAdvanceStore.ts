import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { CashAdvance } from '@/types';

interface CashAdvanceState {
  cashAdvances: CashAdvance[];
  activeCashAdvanceId: string | null;
  isLoading: boolean;
  loadCashAdvances: (userId?: string) => Promise<void>;
  createCashAdvance: (
    data: Omit<CashAdvance, 'id' | 'created_at' | 'user_id'>,
    userId?: string
  ) => Promise<CashAdvance>;
  updateCashAdvance: (id: string, data: Partial<CashAdvance>) => Promise<void>;
  deleteCashAdvance: (id: string) => Promise<void>;
  setActiveCashAdvanceId: (id: string | null) => void;
  getActiveCashAdvance: () => CashAdvance | null;
}

const STORAGE_KEY_PREFIX = '@scanfinance_cash_advances_';
const isSSR = Platform.OS === 'web' && typeof window === 'undefined';

const DEFAULT_CASH_ADVANCES: CashAdvance[] = [
  {
    id: 'ca-default-1',
    user_id: 'user-default-1',
    project_name: 'Contoh Proyek',
    initial_amount: 5000000,
    city: 'Jakarta',
    verifier_name: 'Nama Pemeriksa',
    approver_name: 'Nama Penyetuju',
    collaborators: [],
    created_at: new Date().toISOString(),
    status: 'active',
    notes: 'Ini adalah contoh cash advance. Silakan edit atau tambahkan yang baru.',
  },
];

export const useCashAdvanceStore = create<CashAdvanceState>((set, get) => ({
  cashAdvances: DEFAULT_CASH_ADVANCES,
  activeCashAdvanceId: 'ca-default-1',
  isLoading: false,

  loadCashAdvances: async (userId?: string) => {
    if (isSSR) return;
    const targetUserId = userId || 'user-default-1';
    const storageKey = `${STORAGE_KEY_PREFIX}${targetUserId}`;
    try {
      set({ isLoading: true });
      const raw = await AsyncStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          set({
            cashAdvances: parsed,
            activeCashAdvanceId: get().activeCashAdvanceId || parsed[0].id,
          });
          return;
        }
      }
      // Simpan default jika belum ada
      set({ cashAdvances: DEFAULT_CASH_ADVANCES, activeCashAdvanceId: 'ca-default-1' });
      await AsyncStorage.setItem(storageKey, JSON.stringify(DEFAULT_CASH_ADVANCES));
    } catch (err) {
      console.warn('Load cash advances notice:', err);
    } finally {
      set({ isLoading: false });
    }
  },

  createCashAdvance: async (data, userId) => {
    const targetUserId = userId || 'user-default-1';
    const storageKey = `${STORAGE_KEY_PREFIX}${targetUserId}`;
    const newCA: CashAdvance = {
      ...data,
      id: `ca-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      user_id: targetUserId,
      created_at: new Date().toISOString(),
    };

    const updated = [newCA, ...get().cashAdvances];
    set({
      cashAdvances: updated,
      activeCashAdvanceId: newCA.id,
    });

    if (!isSSR) {
      try {
        await AsyncStorage.setItem(storageKey, JSON.stringify(updated));
      } catch (err) {
        console.warn('Save cash advance error:', err);
      }
    }
    return newCA;
  },

  updateCashAdvance: async (id, data) => {
    const current = get().cashAdvances;
    const updated = current.map((ca) => (ca.id === id ? { ...ca, ...data } : ca));
    set({ cashAdvances: updated });

    if (!isSSR) {
      const activeCA = updated.find((ca) => ca.id === id);
      const storageKey = `${STORAGE_KEY_PREFIX}${activeCA?.user_id || 'user-default-1'}`;
      try {
        await AsyncStorage.setItem(storageKey, JSON.stringify(updated));
      } catch (err) {
        console.warn('Update cash advance error:', err);
      }
    }
  },

  deleteCashAdvance: async (id) => {
    const current = get().cashAdvances;
    const deletedCA = current.find((ca) => ca.id === id);
    const updated = current.filter((ca) => ca.id !== id);
    const newActiveId =
      get().activeCashAdvanceId === id
        ? updated.length > 0
          ? updated[0].id
          : null
        : get().activeCashAdvanceId;

    set({ cashAdvances: updated, activeCashAdvanceId: newActiveId });

    if (!isSSR) {
      const storageKey = `${STORAGE_KEY_PREFIX}${deletedCA?.user_id || 'user-default-1'}`;
      try {
        await AsyncStorage.setItem(storageKey, JSON.stringify(updated));
      } catch (err) {
        console.warn('Delete cash advance error:', err);
      }
    }
  },

  setActiveCashAdvanceId: (id) => {
    set({ activeCashAdvanceId: id });
  },

  getActiveCashAdvance: () => {
    const { cashAdvances, activeCashAdvanceId } = get();
    if (!activeCashAdvanceId) {
      return cashAdvances.length > 0 ? cashAdvances[0] : null;
    }
    return cashAdvances.find((ca) => ca.id === activeCashAdvanceId) || cashAdvances[0] || null;
  },
}));
