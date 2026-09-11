import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { CashAdvance } from '@/types';
import { useTransactionStore } from './transactionStore';
import { useAuthStore } from './authStore';

const STORAGE_KEY_PREFIX = '@scanfinance_cash_advances_';
const ACTIVE_ID_KEY_PREFIX = '@scanfinance_active_ca_id_';
const GLOBAL_ACTIVE_ID_KEY = '@scanfinance_active_ca_id_global';
const SHARED_ALL_CA_KEY = '@scanfinance_all_cash_advances_shared';
const isSSR = Platform.OS === 'web' && typeof window === 'undefined';

const syncBudgetWithActiveCA = (activeCA: CashAdvance | null) => {
  if (!activeCA) return;
  const targetBudget = Number(activeCA.initial_amount) || 7000000;
  const currentBudget = useTransactionStore.getState().budgetLimit;
  if (currentBudget !== targetBudget) {
    useTransactionStore.getState().setBudgetLimit(targetBudget);
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
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 10).toISOString(),
    status: 'active',
    notes: 'Operasional lapangan proyek Tangerang',
  },
  {
    id: 'ca-default-2',
    user_id: 'user-default-1',
    project_name: 'Overhaul Plant Balikpapan',
    initial_amount: 12500000,
    city: 'Balikpapan',
    verifier_name: 'Yunitha',
    approver_name: 'Bambang Soeprapto',
    collaborators: ['gabrielrudra9@gmail.com', 'scanfinancebucket@gmail.com'],
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString(),
    status: 'active',
    notes: 'Perbaikan & maintenance unit site Balikpapan',
  },
  {
    id: 'ca-default-3',
    user_id: 'user-default-1',
    project_name: 'Survei Lapangan Cilegon',
    initial_amount: 3500000,
    city: 'Cilegon',
    verifier_name: 'Hendra Wijaya',
    approver_name: 'Dwi Hartanto',
    collaborators: ['haharakha@gmail.com'],
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(),
    status: 'active',
    notes: 'Survei awal lokasi fasilitas baru Cilegon',
  },
];

const isLegacyDefaultData = (value: unknown): value is CashAdvance[] => {
  if (!Array.isArray(value)) return false;
  // Jika masih memakai data single default lama (hanya ca-default-1)
  if (value.length === 1 && value[0]?.id === 'ca-default-1') return true;
  // Jika format legacy lama 2 item
  if (value.length === 2) {
    const ids = value.map((item) => item?.id).sort();
    if (ids[0] === 'ca-default-1' && ids[1] === 'ca-default-2') return true;
  }
  return false;
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
      const [raw, savedActiveId, savedGlobalId, sharedRaw] = await Promise.all([
        AsyncStorage.getItem(storageKey),
        AsyncStorage.getItem(activeIdKey),
        AsyncStorage.getItem(GLOBAL_ACTIVE_ID_KEY),
        AsyncStorage.getItem(SHARED_ALL_CA_KEY),
      ]);

      const currentUser = useAuthStore.getState().user;
      const userEmail = (currentUser?.email || '').toLowerCase().trim();
      const userName = (currentUser?.full_name || '').toLowerCase().trim();

      let sharedList: CashAdvance[] = [];
      if (sharedRaw) {
        try {
          const parsedShared = JSON.parse(sharedRaw);
          if (Array.isArray(parsedShared) && parsedShared.length > 0) {
            sharedList = parsedShared;
          }
        } catch {}
      }
      if (sharedList.length === 0) {
        sharedList = DEFAULT_CASH_ADVANCES;
        await AsyncStorage.setItem(SHARED_ALL_CA_KEY, JSON.stringify(DEFAULT_CASH_ADVANCES));
      }

      let baseList: CashAdvance[] = [];
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          baseList = isLegacyDefaultData(parsed) ? DEFAULT_CASH_ADVANCES : parsed;
        }
      }
      if (baseList.length === 0) {
        baseList = DEFAULT_CASH_ADVANCES;
      }

      // Gabungkan proyek di mana akun ini adalah pembuat atau kolaborator
      const combinedMap = new Map<string, CashAdvance>();
      baseList.forEach((ca) => combinedMap.set(ca.id, ca));

      sharedList.forEach((ca) => {
        const isOwner = ca.user_id === targetUserId;
        const isCollab = (ca.collaborators || []).some((collab) => {
          const c = collab.toLowerCase().trim();
          return (
            (userEmail && (c === userEmail || c.includes(userEmail) || userEmail.includes(c))) ||
            (userName && (c === userName || c.includes(userName)))
          );
        });
        if (isOwner || isCollab) {
          combinedMap.set(ca.id, ca);
        }
      });

      const combinedList = Array.from(combinedMap.values());

      // Prioritaskan ID aktif yang sedang ada di state memory
      const currentMemActive = get().activeCashAdvanceId;
      const hasMemActive = currentMemActive && combinedList.some((c) => c.id === currentMemActive);
      const hasSavedActive = savedActiveId && combinedList.some((c) => c.id === savedActiveId);
      const hasGlobalActive = savedGlobalId && combinedList.some((c) => c.id === savedGlobalId);

      const resolvedActiveId = hasMemActive
        ? currentMemActive
        : hasSavedActive
        ? savedActiveId
        : hasGlobalActive
        ? savedGlobalId
        : combinedList[0]?.id || 'ca-default-1';

      set({
        cashAdvances: combinedList,
        activeCashAdvanceId: resolvedActiveId,
      });

      await Promise.all([
        AsyncStorage.setItem(storageKey, JSON.stringify(combinedList)),
        AsyncStorage.setItem(activeIdKey, resolvedActiveId),
        AsyncStorage.setItem(GLOBAL_ACTIVE_ID_KEY, resolvedActiveId),
      ]);
      return;
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
        // Simpan ke storage user dan storage bersama
        const sharedRaw = await AsyncStorage.getItem(SHARED_ALL_CA_KEY);
        let sharedList: CashAdvance[] = [];
        if (sharedRaw) {
          try {
            sharedList = JSON.parse(sharedRaw) || [];
          } catch {}
        }
        const updatedShared = [newCA, ...sharedList.filter((c) => c.id !== newCA.id)];

        await Promise.all([
          AsyncStorage.setItem(storageKey, JSON.stringify(updated)),
          AsyncStorage.setItem(activeIdKey, newCA.id),
          AsyncStorage.setItem(GLOBAL_ACTIVE_ID_KEY, newCA.id),
          AsyncStorage.setItem(SHARED_ALL_CA_KEY, JSON.stringify(updatedShared)),
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
        const sharedRaw = await AsyncStorage.getItem(SHARED_ALL_CA_KEY);
        let sharedList: CashAdvance[] = [];
        if (sharedRaw) {
          try {
            sharedList = JSON.parse(sharedRaw) || [];
          } catch {}
        }
        const updatedShared = sharedList.map((ca) => (ca.id === id ? { ...ca, ...data } : ca));

        await Promise.all([
          AsyncStorage.setItem(storageKey, JSON.stringify(updated)),
          AsyncStorage.setItem(SHARED_ALL_CA_KEY, JSON.stringify(updatedShared)),
        ]);
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
        const sharedRaw = await AsyncStorage.getItem(SHARED_ALL_CA_KEY);
        let sharedList: CashAdvance[] = [];
        if (sharedRaw) {
          try {
            sharedList = JSON.parse(sharedRaw) || [];
          } catch {}
        }
        const updatedShared = sharedList.filter((ca) => ca.id !== id);

        await Promise.all([
          AsyncStorage.setItem(storageKey, JSON.stringify(updated)),
          AsyncStorage.setItem(SHARED_ALL_CA_KEY, JSON.stringify(updatedShared)),
        ]);
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
      const currentUserId = useAuthStore.getState().user?.id || 'user-default-1';
      const activeIdKey = `${ACTIVE_ID_KEY_PREFIX}${currentUserId}`;
      if (id) {
        AsyncStorage.setItem(activeIdKey, id).catch(() => {});
        AsyncStorage.setItem(GLOBAL_ACTIVE_ID_KEY, id).catch(() => {});
      } else {
        AsyncStorage.removeItem(activeIdKey).catch(() => {});
        AsyncStorage.removeItem(GLOBAL_ACTIVE_ID_KEY).catch(() => {});
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
