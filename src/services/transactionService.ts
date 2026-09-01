import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { supabase } from './supabase';
import { Category, MonthlyStats, ReceiptScanResult, Transaction } from '@/types';
import { DEFAULT_CATEGORIES } from '@/constants/categories';

const LOCAL_TRANSACTIONS_KEY = '@scanfinance_local_transactions';
const LOCAL_CATEGORIES_KEY = '@scanfinance_local_categories';

const isSSR = Platform.OS === 'web' && typeof window === 'undefined';

// In-memory fallback untuk SSR
let inMemoryTransactions: Transaction[] | null = null;
let inMemoryCategories: Category[] | null = null;

// Dummy seed data awal agar tampilan dashboard langsung cantik saat pertama dibuka
const SEED_TRANSACTIONS: Transaction[] = [
  {
    id: 'tx-seed-1',
    user_id: 'local-user',
    category_id: 'cat-belanja',
    category: DEFAULT_CATEGORIES.find((c) => c.id === 'cat-belanja'),
    merchant_name: 'Indomaret Point Kemang',
    transaction_date: new Date().toISOString(),
    total_amount: 73500,
    subtotal: 78500,
    tax_amount: 0,
    discount_amount: 5000,
    payment_method: 'qris',
    notes: 'Belanja mingguan snack & susu',
    items: [
      { item_name: 'Susu UHT Ultra Milk 1L', quantity: 1, unit_price: 21500, total_price: 21500 },
      { item_name: 'Roti Gandum Sari Roti', quantity: 1, unit_price: 19000, total_price: 19000 },
      { item_name: 'Minyak Goreng Sania 2L', quantity: 1, unit_price: 34000, total_price: 34000 },
    ],
    created_at: new Date().toISOString(),
  },
  {
    id: 'tx-seed-2',
    user_id: 'local-user',
    category_id: 'cat-makanan',
    category: DEFAULT_CATEGORIES.find((c) => c.id === 'cat-makanan'),
    merchant_name: 'Kopi Kenangan Senopati',
    transaction_date: new Date(Date.now() - 3600000 * 4).toISOString(),
    total_amount: 53800,
    subtotal: 58000,
    tax_amount: 5800,
    discount_amount: 10000,
    payment_method: 'e-wallet',
    notes: 'Kopi sore bersama tim',
    items: [
      { item_name: 'Kopi Kenangan Mantan (L)', quantity: 1, unit_price: 24000, total_price: 24000 },
      { item_name: 'Avocado Coffee Ice (R)', quantity: 1, unit_price: 28000, total_price: 28000 },
      { item_name: 'Roti Coklat Klasik', quantity: 1, unit_price: 6000, total_price: 6000 },
    ],
    created_at: new Date(Date.now() - 3600000 * 4).toISOString(),
  },
  {
    id: 'tx-seed-3',
    user_id: 'local-user',
    category_id: 'cat-transportasi',
    category: DEFAULT_CATEGORIES.find((c) => c.id === 'cat-transportasi'),
    merchant_name: 'SPBU Pertamina 34-12345',
    transaction_date: new Date(Date.now() - 86400000).toISOString(),
    total_amount: 150000,
    subtotal: 150000,
    tax_amount: 0,
    discount_amount: 0,
    payment_method: 'cash',
    notes: 'Isi bensin full tank',
    items: [
      { item_name: 'Pertamax 92 (Liter)', quantity: 11.54, unit_price: 13000, total_price: 150000 },
    ],
    created_at: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: 'tx-seed-4',
    user_id: 'local-user',
    category_id: 'cat-tagihan',
    category: DEFAULT_CATEGORIES.find((c) => c.id === 'cat-tagihan'),
    merchant_name: 'PLN Pascabayar',
    transaction_date: new Date(Date.now() - 86400000 * 3).toISOString(),
    total_amount: 450000,
    subtotal: 450000,
    tax_amount: 0,
    discount_amount: 0,
    payment_method: 'transfer',
    notes: 'Tagihan listrik bulanan',
    items: [],
    created_at: new Date(Date.now() - 86400000 * 3).toISOString(),
  },
];

export async function getTransactions(): Promise<Transaction[]> {
  if (isSSR) {
    return inMemoryTransactions || SEED_TRANSACTIONS;
  }

  try {
    // 1. Coba ambil dari Supabase jika user terautentikasi
    const { data: sessionData } = await supabase.auth.getSession();
    if (sessionData?.session?.user) {
      const { data, error } = await supabase
        .from('transactions')
        .select(`
          *,
          category:categories(*),
          items:transaction_items(*)
        `)
        .order('transaction_date', { ascending: false });

      if (!error && data && data.length > 0) {
        return data as Transaction[];
      }
    }
  } catch (err) {
    console.warn('Supabase fetch transactions failed, using local storage:', err);
  }

  // 2. Fallback ke Local Storage / Seed Data
  try {
    const raw = await AsyncStorage.getItem(LOCAL_TRANSACTIONS_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
    await AsyncStorage.setItem(LOCAL_TRANSACTIONS_KEY, JSON.stringify(SEED_TRANSACTIONS));
    return SEED_TRANSACTIONS;
  } catch {
    return SEED_TRANSACTIONS;
  }
}

export async function saveTransaction(
  transactionData: Omit<Transaction, 'id' | 'created_at'> & { id?: string }
): Promise<Transaction> {
  const newTx: Transaction = {
    ...transactionData,
    id: transactionData.id || `tx-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    created_at: new Date().toISOString(),
  };

  if (isSSR) {
    inMemoryTransactions = [newTx, ...(inMemoryTransactions || SEED_TRANSACTIONS)];
    return newTx;
  }

  // Simpan ke Supabase jika login
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    if (sessionData?.session?.user) {
      const { data: insertedTx, error: txError } = await supabase
        .from('transactions')
        .insert({
          user_id: sessionData.session.user.id,
          category_id: newTx.category_id,
          merchant_name: newTx.merchant_name,
          transaction_date: newTx.transaction_date,
          total_amount: newTx.total_amount,
          subtotal: newTx.subtotal,
          tax_amount: newTx.tax_amount,
          discount_amount: newTx.discount_amount,
          payment_method: newTx.payment_method,
          notes: newTx.notes,
          receipt_image_url: newTx.receipt_image_url,
        })
        .select()
        .single();

      if (!txError && insertedTx) {
        if (newTx.items && newTx.items.length > 0) {
          const itemsToInsert = newTx.items.map((it) => ({
            transaction_id: insertedTx.id,
            item_name: it.item_name,
            quantity: it.quantity,
            unit_price: it.unit_price,
            total_price: it.total_price,
          }));
          await supabase.from('transaction_items').insert(itemsToInsert);
        }
        newTx.id = insertedTx.id;
      }
    }
  } catch (err) {
    console.warn('Could not sync to Supabase, saved locally:', err);
  }

  // Update local storage
  const current = await getTransactions();
  const updated = [newTx, ...current.filter((t) => t.id !== newTx.id)];
  try {
    await AsyncStorage.setItem(LOCAL_TRANSACTIONS_KEY, JSON.stringify(updated));
  } catch {}

  return newTx;
}

export async function deleteTransaction(id: string): Promise<boolean> {
  if (isSSR) {
    inMemoryTransactions = (inMemoryTransactions || SEED_TRANSACTIONS).filter((t) => t.id !== id);
    return true;
  }

  try {
    const { data: sessionData } = await supabase.auth.getSession();
    if (sessionData?.session?.user) {
      await supabase.from('transactions').delete().eq('id', id);
    }
  } catch (err) {
    console.warn('Supabase delete failed:', err);
  }

  const current = await getTransactions();
  const updated = current.filter((t) => t.id !== id);
  try {
    await AsyncStorage.setItem(LOCAL_TRANSACTIONS_KEY, JSON.stringify(updated));
  } catch {}
  return true;
}

export async function getCategories(): Promise<Category[]> {
  if (isSSR) {
    return inMemoryCategories || DEFAULT_CATEGORIES;
  }

  try {
    const raw = await AsyncStorage.getItem(LOCAL_CATEGORIES_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {}
  return DEFAULT_CATEGORIES;
}

export function calculateMonthlyStats(
  transactions: Transaction[],
  budgetLimit: number = 5000000
): MonthlyStats {
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();

  const thisMonthTx = transactions.filter((t) => {
    const d = new Date(t.transaction_date);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  });

  const totalExpense = thisMonthTx
    .filter((t) => t.category?.type !== 'income')
    .reduce((sum, t) => sum + Number(t.total_amount || 0), 0);

  const totalIncome = thisMonthTx
    .filter((t) => t.category?.type === 'income')
    .reduce((sum, t) => sum + Number(t.total_amount || 0), 0);

  const balance = totalIncome > 0 ? totalIncome - totalExpense : budgetLimit - totalExpense;
  const budgetUsedPercentage = budgetLimit > 0 ? Math.min(100, (totalExpense / budgetLimit) * 100) : 0;
  const currentDay = Math.max(1, new Date().getDate());
  const dailyAverage = totalExpense / currentDay;

  const categoryMap: Record<
    string,
    {
      name: string;
      color: string;
      icon: string;
      amount: number;
      count: number;
    }
  > = {};

  thisMonthTx.forEach((t) => {
    if (t.category?.type === 'income') return;
    const catName = t.category?.name || 'Lainnya';
    const catColor = t.category?.color || '#6B7280';
    const catIcon = t.category?.icon || 'ellipsis-horizontal-circle-outline';
    const catId = t.category_id || 'cat-lainnya';

    if (!categoryMap[catId]) {
      categoryMap[catId] = {
        name: catName,
        color: catColor,
        icon: catIcon,
        amount: 0,
        count: 0,
      };
    }
    categoryMap[catId].amount += Number(t.total_amount || 0);
    categoryMap[catId].count += 1;
  });

  const categoryBreakdown = Object.entries(categoryMap).map(([id, info]) => ({
    categoryId: id,
    categoryName: info.name,
    categoryColor: info.color,
    categoryIcon: info.icon,
    amount: info.amount,
    percentage: totalExpense > 0 ? (info.amount / totalExpense) * 100 : 0,
    transactionCount: info.count,
  }));

  categoryBreakdown.sort((a, b) => b.amount - a.amount);

  return {
    totalExpense,
    totalIncome,
    balance,
    budgetLimit,
    budgetUsedPercentage,
    dailyAverage,
    receiptCount: thisMonthTx.length,
    categoryBreakdown,
  };
}
