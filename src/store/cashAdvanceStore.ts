import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { CashAdvance } from '@/types';
import { useTransactionStore } from './transactionStore';
import { useAuthStore } from './authStore';

const STORAGE_KEY_PREFIX = '@scanfinance_cash_advances_';
const ACTIVE_ID_KEY_PREFIX = '@scanfinance_active_ca_id_';
const isSSR = Platform.OS === 'web' && typeof window === 'undefined';

const syncBudgetWithActiveCA = (activeCA: CashAdvance | null) => {
  if (!activeCA) return;
  const targetBudget = activeCA.initial_amount || 7000000;
  const currentBudget = useTransactionStore.getState().budgetLimit;
  if (currentBudget !== targetBudget) {
    useTransactionStore.getState().setBudgetLimit(targetBudget);
  }

  // Sinkronkan data active CA ke profil akun aktif
  const currentUser = useAuthStore.getState().user;
  if (
    currentUser &&
    (currentUser.project_name !== activeCA.project_name ||
      currentUser.cash_advance_amount !== activeCA.initial_amount ||
      currentUser.city !== activeCA.city ||
      currentUser.verifier_name !== activeCA.verifier_name ||
      currentUser.approver_name !== activeCA.approver_name)
  ) {
    useAuthStore.getState().updateProfile({
      project_name: activeCA.project_name,
      city: activeCA.city,
      verifier_name: activeCA.verifier_name,
      approver_name: activeCA.approver_name,
      cash_advance_amount: activeCA.initial_amount,
    });
  }
};

const DEFAULT_CASH_ADVANCES: CashAdvance[] = [
  {
    id: 'ca-default-1',
    user_id: 'user-default-1',
    project_name: 'Tangerang Project',
    initial_amount: 7000000,
    city: 'Tangerang',
    verifier_name: 'Yunitha',
    approver_name: 'Dwi Hartanto',
    collaborators: ['aurakharere@gmail.com', 'haharakha@gmail.com'],
    created_at: new Date().toISOString(),
    status: 'active',
    notes: 'Operasional lapangan proyek Tangerang',
  },
];

const isLegacyDefaultData = (value: unknown): value is CashAdvance[] => {
  if (!Array.isArray(value) || value.length !== 2) return false;
  const ids = value.map((item) => item?.id).sort();
  return ids[0] === 'ca-default-1' && ids[1] === 'ca-default-2';
};

export interface CashAdvanceState {
  cashAdvances: CashAdvance[];
  activeCashAdvanceId: string | null;
  isLoading: boolean;
  loadCashAdvances: (userId?: string) => Promise<void>;
  createCashAdvance: (
    data: Omit<CashAdvance, 'id' | 'user_id' | 'created_at'>,
    userId?: string
  ) => Promise<CashAdvance>;
  updateCashAdvance: (id: string, data: Partial<CashAdvance>) => Promise<void>;
  deleteCashAdvance: (id: string) => Promise<void>;
  setActiveCashAdvanceId: (id: string | null) => void;
  getActiveCashAdvance: () => CashAdvance | null;
}

export const useCashAdvanceStore = create<CashAdvanceState>((set, get) => ({
  cashAdvances: DEFAULT_CASH_ADVANCES,
  activeCashAdvanceId: 'ca-default-1',
  isLoading: false,

  loadCashAdvances: async (userId?: string) => {
    if (isSSR) return;
    const targetUserId = userId || useAuthStore.getState().user?.id || 'user-default-1';
    const storageKey = `${STORAGE_KEY_PREFIX}${targetUserId}`;
    const activeIdKey = `${ACTIVE_ID_KEY_PREFIX}${targetUserId}`;
    try {
      set({ isLoading: true });
      const [raw, savedActiveId] = await Promise.all([
        AsyncStorage.getItem(storageKey),
        AsyncStorage.getItem(activeIdKey),
      ]);

      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          if (isLegacyDefaultData(parsed)) {
            set({ cashAdvances: DEFAULT_CASH_ADVANCES, activeCashAdvanceId: 'ca-default-1' });
            await AsyncStorage.setItem(storageKey, JSON.stringify(DEFAULT_CASH_ADVANCES));
            await AsyncStorage.setItem(activeIdKey, 'ca-default-1');
            return;
          }

          const hasSavedActive = savedActiveId && parsed.some((c: CashAdvance) => c.id === savedActiveId);
          const hasCurrentActive = get().activeCashAdvanceId && parsed.some((c: CashAdvance) => c.id === get().activeCashAdvanceId);
          const resolvedActiveId = hasSavedActive ? savedActiveId : (hasCurrentActive ? get().activeCashAdvanceId : parsed[0].id);

          set({
            cashAdvances: parsed,
            activeCashAdvanceId: resolvedActiveId,
          });
          return;
        }
      }
      // Simpan default jika belum ada
      set({ cashAdvances: DEFAULT_CASH_ADVANCES, activeCashAdvanceId: 'ca-default-1' });
      await AsyncStorage.setItem(storageKey, JSON.stringify(DEFAULT_CASH_ADVANCES));
      await AsyncStorage.setItem(activeIdKey, 'ca-default-1');
    } catch (err) {
      console.warn('Load cash advances notice:', err);
    } finally {
      set({ isLoading: false });
      syncBudgetWithActiveCA(get().getActiveCashAdvance());
    }
  },

  createCashAdvance: async (data, userId) => {
    const targetUserId = userId || useAuthStore.getState().user?.id || 'user-default-1';
    const storageKey = `${STORAGE_KEY_PREFIX}${targetUserId}`;
    const activeIdKey = `${ACTIVE_ID_KEY_PREFIX}${targetUserId}`;
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
    syncBudgetWithActiveCA(newCA);

    if (!isSSR) {
      try {
        await Promise.all([
          AsyncStorage.setItem(storageKey, JSON.stringify(updated)),
          AsyncStorage.setItem(activeIdKey, newCA.id),
        ]);
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
    syncBudgetWithActiveCA(get().getActiveCashAdvance());

    if (!isSSR) {
      const activeCA = updated.find((ca) => ca.id === id);
      const targetUserId = activeCA?.user_id || useAuthStore.getState().user?.id || 'user-default-1';
      const storageKey = `${STORAGE_KEY_PREFIX}${targetUserId}`;
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
    syncBudgetWithActiveCA(get().getActiveCashAdvance());

    if (!isSSR) {
      const targetUserId = deletedCA?.user_id || useAuthStore.getState().user?.id || 'user-default-1';
      const storageKey = `${STORAGE_KEY_PREFIX}${targetUserId}`;
      const activeIdKey = `${ACTIVE_ID_KEY_PREFIX}${targetUserId}`;
      try {
        await AsyncStorage.setItem(storageKey, JSON.stringify(updated));
        if (newActiveId) {
          await AsyncStorage.setItem(activeIdKey, newActiveId);
        } else {
          await AsyncStorage.removeItem(activeIdKey);
        }
      } catch (err) {
        console.warn('Delete cash advance error:', err);
      }
    }
  },

  setActiveCashAdvanceId: (id) => {
    set({ activeCashAdvanceId: id });
    const active = get().getActiveCashAdvance();
    syncBudgetWithActiveCA(active);

    if (!isSSR) {
      const targetUserId = active?.user_id || useAuthStore.getState().user?.id || 'user-default-1';
      const activeIdKey = `${ACTIVE_ID_KEY_PREFIX}${targetUserId}`;
      if (id) {
        AsyncStorage.setItem(activeIdKey, id).catch((err) => {
          console.warn('Save active CA ID error:', err);
        });
      } else {
        AsyncStorage.removeItem(activeIdKey).catch(() => {});
      }
    }
  },

  getActiveCashAdvance: () => {
    const { cashAdvances, activeCashAdvanceId } = get();
    if (!activeCashAdvanceId) {
      return cashAdvances.length > 0 ? cashAdvances[0] : null;
    }
    return cashAdvances.find((ca) => ca.id === activeCashAdvanceId) || cashAdvances[0] || null;
  },
}));
