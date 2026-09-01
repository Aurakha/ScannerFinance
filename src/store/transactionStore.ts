import { create } from 'zustand';
import { Category, MonthlyStats, ReceiptScanResult, Transaction } from '@/types';
import { DEFAULT_CATEGORIES } from '@/constants/categories';
import {
  calculateMonthlyStats,
  deleteTransaction,
  getCategories,
  getTransactions,
  saveTransaction,
} from '@/services/transactionService';

interface TransactionState {
  transactions: Transaction[];
  categories: Category[];
  stats: MonthlyStats;
  budgetLimit: number;
  isLoading: boolean;
  activeFilter: string; // 'all' | category_id
  searchQuery: string;
  loadData: () => Promise<void>;
  addTransaction: (tx: Omit<Transaction, 'id' | 'created_at'>) => Promise<Transaction>;
  removeTransaction: (id: string) => Promise<void>;
  setBudgetLimit: (limit: number) => void;
  setActiveFilter: (filter: string) => void;
  setSearchQuery: (query: string) => void;
}

export const useTransactionStore = create<TransactionState>((set, get) => ({
  transactions: [],
  categories: DEFAULT_CATEGORIES,
  budgetLimit: 5000000,
  stats: calculateMonthlyStats([], 5000000),
  isLoading: false,
  activeFilter: 'all',
  searchQuery: '',

  loadData: async () => {
    set({ isLoading: true });
    try {
      const [txList, catList] = await Promise.all([getTransactions(), getCategories()]);
      const currentBudget = get().budgetLimit;
      const stats = calculateMonthlyStats(txList, currentBudget);
      set({
        transactions: txList,
        categories: catList.length > 0 ? catList : DEFAULT_CATEGORIES,
        stats,
      });
    } catch (err) {
      console.warn('Failed to load transaction store data:', err);
    } finally {
      set({ isLoading: false });
    }
  },

  addTransaction: async (txData) => {
    const saved = await saveTransaction(txData);
    const updatedList = [saved, ...get().transactions.filter((t) => t.id !== saved.id)];
    const stats = calculateMonthlyStats(updatedList, get().budgetLimit);
    set({ transactions: updatedList, stats });
    return saved;
  },

  removeTransaction: async (id: string) => {
    await deleteTransaction(id);
    const updatedList = get().transactions.filter((t) => t.id !== id);
    const stats = calculateMonthlyStats(updatedList, get().budgetLimit);
    set({ transactions: updatedList, stats });
  },

  setBudgetLimit: (limit: number) => {
    const stats = calculateMonthlyStats(get().transactions, limit);
    set({ budgetLimit: limit, stats });
  },

  setActiveFilter: (filter: string) => set({ activeFilter: filter }),
  setSearchQuery: (query: string) => set({ searchQuery: query }),
}));
