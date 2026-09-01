import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { supabase } from './supabase';
import { Category, MonthlyStats, Transaction } from '@/types';
import { DEFAULT_CATEGORIES } from '@/constants/categories';

const LOCAL_TRANSACTIONS_KEY = '@scanfinance_local_transactions';
const LOCAL_CATEGORIES_KEY = '@scanfinance_local_categories';

const isSSR = Platform.OS === 'web' && typeof window === 'undefined';

let inMemoryTransactions: Transaction[] | null = null;
let inMemoryCategories: Category[] | null = null;

// Dummy seed data awal
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
    merchant_name: 'ShopeeFood - Bakmi Jogja',
    transaction_date: new Date().toISOString(),
    total_amount: 70500,
    subtotal: 68000,
    tax_amount: 0,
    discount_amount: 12000,
    shipping_fee: 8000,
    admin_fee: 6500,
    payment_method: 'e-wallet',
    notes: 'No. Pesanan: 3223849468528128954',
    items: [
      { item_name: 'Bakmi Godog', quantity: 1, unit_price: 34000, total_price: 34000 },
      { item_name: 'Bakmi Goreng', quantity: 1, unit_price: 34000, total_price: 34000 },
    ],
    created_at: new Date().toISOString(),
  },
];

/**
 * Otomatis mengunggah data transaksi lokal yang belum masuk ke Supabase
 */
export async function syncLocalTransactionsToSupabase(): Promise<void> {
  if (isSSR) return;
  try {
    const raw = await AsyncStorage.getItem(LOCAL_TRANSACTIONS_KEY);
    if (!raw) return;
    const localTx: Transaction[] = JSON.parse(raw);
    const nonSeed = localTx.filter((t) => !t.id.startsWith('tx-seed-'));
    if (nonSeed.length === 0) return;

    // Ambil sesi user saat ini jika ada
    const { data: sessionRes } = await supabase.auth.getSession();
    const currentUserId = sessionRes?.session?.user?.id || null;

    // Ambil data transaksi yang sudah ada di Supabase
    let query = supabase.from('transactions').select('id, merchant_name, transaction_date');
    if (currentUserId) {
      query = query.eq('user_id', currentUserId);
    }
    const { data: cloudData } = await query;

    const cloudKeys = new Set(
      (cloudData || []).map((c) => `${c.merchant_name}_${c.transaction_date}`)
    );

    for (const tx of nonSeed) {
      const key = `${tx.merchant_name}_${tx.transaction_date}`;
      if (!cloudKeys.has(key)) {
        let sbCatId: string | null = null;
        if (tx.category_id && tx.category_id.includes('-') && tx.category_id.length === 36) {
          sbCatId = tx.category_id;
        } else if (tx.category?.name) {
          const { data: catRes } = await supabase
            .from('categories')
            .select('id')
            .ilike('name', tx.category.name)
            .limit(1)
            .single();
          if (catRes?.id) sbCatId = catRes.id;
        }

        const { data: inserted } = await supabase
          .from('transactions')
          .insert({
            user_id: currentUserId,
            category_id: sbCatId,
            merchant_name: tx.merchant_name,
            transaction_date: tx.transaction_date,
            total_amount: tx.total_amount,
            subtotal: tx.subtotal || tx.total_amount,
            tax_amount: tx.tax_amount || 0,
            discount_amount: tx.discount_amount || 0,
            shipping_fee: tx.shipping_fee || 0,
            admin_fee: tx.admin_fee || 0,
            payment_method: tx.payment_method || 'cash',
            notes: tx.notes || '',
            receipt_image_url: tx.receipt_image_url || null,
          })
          .select()
          .single();

        if (inserted && tx.items && tx.items.length > 0) {
          const itemsToInsert = tx.items.map((it) => ({
            transaction_id: inserted.id,
            item_name: it.item_name,
            quantity: it.quantity || 1,
            unit_price: it.unit_price || 0,
            total_price: it.total_price || (it.quantity || 1) * (it.unit_price || 0),
          }));
          await supabase.from('transaction_items').insert(itemsToInsert);
        }
      }
    }
  } catch (err) {
    console.warn('Auto sync notice:', err);
  }
}

export async function getTransactions(targetUserId?: string): Promise<Transaction[]> {
  if (isSSR) {
    return inMemoryTransactions || SEED_TRANSACTIONS;
  }

  // 1. Coba sinkronkan data lokal ke cloud Supabase
  await syncLocalTransactionsToSupabase();

  // 2. Ambil seluruh transaksi live dari Supabase Cloud berdasarkan user_id
  let currentUserId: string | null = targetUserId || null;
  try {
    if (!currentUserId) {
      const { data: sessionRes } = await supabase.auth.getSession();
      currentUserId = sessionRes?.session?.user?.id || null;
    }

    let query = supabase
      .from('transactions')
      .select(`
        *,
        category:categories(*),
        items:transaction_items(*)
      `)
      .order('transaction_date', { ascending: false });

    if (currentUserId) {
      query = query.eq('user_id', currentUserId);
    }

    const { data, error } = await query;

    if (!error && data && data.length > 0) {
      const formatted = data.map((d: any) => ({
        ...d,
        items: d.items || [],
      }));
      await AsyncStorage.setItem(LOCAL_TRANSACTIONS_KEY, JSON.stringify(formatted));
      return formatted as Transaction[];
    }
  } catch (err) {
    console.warn('Supabase fetch transactions notice:', err);
  }

  // 3. Fallback ke Local Storage (Filter per user jika ada user_id)
  try {
    const raw = await AsyncStorage.getItem(LOCAL_TRANSACTIONS_KEY);
    if (raw) {
      const allTx: Transaction[] = JSON.parse(raw);
      if (currentUserId) {
        const userTx = allTx.filter((t) => t.user_id === currentUserId);
        return userTx.length > 0 ? userTx : allTx;
      }
      return allTx;
    }
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

  // 1. Simpan langsung ke Supabase PostgreSQL
  try {
    const { data: sessionRes } = await supabase.auth.getSession();
    const currentUserId = sessionRes?.session?.user?.id || null;

    let sbCategoryId: string | null = null;
    if (newTx.category_id && newTx.category_id.includes('-') && newTx.category_id.length === 36) {
      sbCategoryId = newTx.category_id;
    } else if (newTx.category?.name) {
      const { data: catData } = await supabase
        .from('categories')
        .select('id')
        .ilike('name', newTx.category.name)
        .limit(1)
        .single();
      if (catData?.id) {
        sbCategoryId = catData.id;
      }
    }

    const { data: insertedTx, error: txError } = await supabase
      .from('transactions')
      .insert({
        user_id: currentUserId,
        category_id: sbCategoryId,
        merchant_name: newTx.merchant_name,
        transaction_date: newTx.transaction_date,
        total_amount: newTx.total_amount,
        subtotal: newTx.subtotal || newTx.total_amount,
        tax_amount: newTx.tax_amount || 0,
        discount_amount: newTx.discount_amount || 0,
        shipping_fee: newTx.shipping_fee || 0,
        admin_fee: newTx.admin_fee || 0,
        payment_method: newTx.payment_method || 'cash',
        notes: newTx.notes || '',
        receipt_image_url: newTx.receipt_image_url || null,
      })
      .select()
      .single();

    if (!txError && insertedTx) {
      newTx.id = insertedTx.id;

      // Simpan rincian items ke tabel transaction_items
      if (newTx.items && newTx.items.length > 0) {
        const itemsToInsert = newTx.items.map((it) => ({
          transaction_id: insertedTx.id,
          item_name: it.item_name,
          quantity: it.quantity || 1,
          unit_price: it.unit_price || 0,
          total_price: it.total_price || (it.quantity || 1) * (it.unit_price || 0),
        }));
        await supabase.from('transaction_items').insert(itemsToInsert);
      }
    }
  } catch (err) {
    console.warn('Supabase sync error:', err);
  }

  // 2. Update local storage sebagai offline cache
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
    await supabase.from('transactions').delete().eq('id', id);
  } catch (err) {
    console.warn('Supabase delete notice:', err);
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
    const { data, error } = await supabase.from('categories').select('*');
    if (!error && data && data.length > 0) {
      return data as Category[];
    }
  } catch {}

  try {
    const raw = await AsyncStorage.getItem(LOCAL_CATEGORIES_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {}
  return DEFAULT_CATEGORIES;
}

/**
 * Menghitung statistik pengeluaran.
 * Jika bulan berjalan belum memiliki data, otomatis menggunakan seluruh transaksi aktif agar dashboard tidak kosong (Rp 0).
 */
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

  // Tampilkan data bulan ini, atau jika belum ada transaksi di bulan ini, gunakan seluruh transaksi aktif
  const targetTx = thisMonthTx.length > 0 ? thisMonthTx : transactions;

  const totalExpense = targetTx
    .filter((t) => t.category?.type !== 'income')
    .reduce((sum, t) => sum + Number(t.total_amount || 0), 0);

  const totalIncome = targetTx
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

  targetTx.forEach((t) => {
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
    receiptCount: targetTx.length,
    categoryBreakdown,
  };
}
