import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { supabase } from './supabase';
import { Category, MonthlyStats, Transaction } from '@/types';
import { DEFAULT_CATEGORIES } from '@/constants/categories';
import { categorizeColumn } from '@/utils/exportReport';

const LOCAL_TRANSACTIONS_KEY = '@scanfinance_local_transactions';
const LOCAL_CATEGORIES_KEY = '@scanfinance_local_categories';
const GUEST_TRANSACTIONS_KEY = '@scanfinance_guest_sandbox_transactions';

const isSSR = Platform.OS === 'web' && typeof window === 'undefined';

let inMemoryTransactions: Transaction[] | null = null;
let inMemoryCategories: Category[] | null = null;

export const isGuestUser = (userId?: string | null): boolean => {
  if (!userId) return true;
  const clean = userId.trim().toLowerCase();
  return (
    clean === 'user-default-1' ||
    clean === 'guest' ||
    clean === 'user-guest' ||
    clean === 'guest@scanfinance.com'
  );
};

// Data simulasi awal untuk mode tamu agar grafik dan statistik langsung terlihat hidup
const SEED_GUEST_TRANSACTIONS: Transaction[] = [
  {
    id: 'tx-guest-demo-1',
    user_id: 'user-default-1',
    category_id: 'cat-operational',
    merchant_name: 'SPBU Pertamina 34-15102',
    transaction_date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 1).toISOString(),
    total_amount: 350000,
    subtotal: 350000,
    tax_amount: 0,
    discount_amount: 0,
    shipping_fee: 0,
    admin_fee: 0,
    payment_method: 'cash',
    notes: 'BBM mobil dinas operasional proyek (Simulasi Demo)',
    // receipt_image_url omitted
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 1).toISOString(),
    category: {
      id: 'cat-operational',
      name: 'Operational',
      icon: 'briefcase-outline',
      color: '#EAB308',
      type: 'expense',
      is_default: true,
    },
    items: [
      {
        id: 'item-demo-1',
        transaction_id: 'tx-guest-demo-1',
        item_name: 'BBM Pertamax Operasional',
        quantity: 1,
        unit_price: 350000,
        total_price: 350000,
      },
    ],
  },
  {
    id: 'tx-guest-demo-2',
    user_id: 'user-default-1',
    category_id: 'cat-pantry',
    merchant_name: 'Indomaret Point',
    transaction_date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(),
    total_amount: 85000,
    subtotal: 85000,
    tax_amount: 0,
    discount_amount: 0,
    shipping_fee: 0,
    admin_fee: 0,
    payment_method: 'cash',
    notes: 'Konsumsi dan air galon operasional (Simulasi Demo)',
    // receipt_image_url omitted
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(),
    category: {
      id: 'cat-pantry',
      name: 'Pantry',
      icon: 'restaurant-outline',
      color: '#10B981',
      type: 'expense',
      is_default: true,
    },
    items: [
      {
        id: 'item-demo-2',
        transaction_id: 'tx-guest-demo-2',
        item_name: 'Kopi & Teh Kemasan',
        quantity: 1,
        unit_price: 45000,
        total_price: 45000,
      },
      {
        id: 'item-demo-3',
        transaction_id: 'tx-guest-demo-2',
        item_name: 'Air Mineral Galon',
        quantity: 2,
        unit_price: 20000,
        total_price: 40000,
      },
    ],
  },
  {
    id: 'tx-guest-demo-3',
    user_id: 'user-default-1',
    category_id: 'cat-fasilitas',
    merchant_name: 'Fotocopy & ATK Mitra',
    transaction_date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 4).toISOString(),
    total_amount: 120000,
    subtotal: 120000,
    tax_amount: 0,
    discount_amount: 0,
    shipping_fee: 0,
    admin_fee: 0,
    payment_method: 'cash',
    notes: 'Kertas dokumen dan map laporan (Simulasi Demo)',
    // receipt_image_url omitted
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 4).toISOString(),
    category: {
      id: 'cat-fasilitas',
      name: 'Fasilitas',
      icon: 'business-outline',
      color: '#EC4899',
      type: 'expense',
      is_default: true,
    },
    items: [
      {
        id: 'item-demo-4',
        transaction_id: 'tx-guest-demo-3',
        item_name: 'Kertas HVS A4 & Map Bantex',
        quantity: 1,
        unit_price: 120000,
        total_price: 120000,
      },
    ],
  },
];

/**
 * Otomatis mengunggah data transaksi lokal yang belum masuk ke Supabase
 * HANYA berjalan jika pengguna sudah login (Bukan Guest)
 */
export async function syncLocalTransactionsToSupabase(): Promise<void> {
  if (isSSR) return;
  try {
    const { data: sessionRes } = await supabase.auth.getSession();
    const currentUserId = sessionRes?.session?.user?.id || null;

    // JANGAN PERNAH SINKRONISASI JIKA GUEST (BELUM LOGIN)
    if (!currentUserId || isGuestUser(currentUserId)) {
      return;
    }

    const raw = await AsyncStorage.getItem(`${LOCAL_TRANSACTIONS_KEY}_${currentUserId}`);
    if (!raw) return;
    const localTx: Transaction[] = JSON.parse(raw);
    const nonSeed = localTx.filter((t) => !t.id.startsWith('tx-guest-demo-'));
    if (nonSeed.length === 0) return;

    // Ambil data transaksi yang sudah ada di Supabase
    const { data: cloudData } = await supabase
      .from('transactions')
      .select('id, merchant_name, transaction_date')
      .eq('user_id', currentUserId);

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
    return inMemoryTransactions || SEED_GUEST_TRANSACTIONS;
  }

  let currentUserId: string | null = targetUserId || null;
  if (!currentUserId) {
    try {
      const { data: sessionRes } = await supabase.auth.getSession();
      currentUserId = sessionRes?.session?.user?.id || null;
    } catch {}
  }

  // 1. ISOLASI GUEST MODE: HANYA BACA DARI LOCAL SANDBOX, JANGAN QUERY SUPABASE
  if (!currentUserId || isGuestUser(currentUserId)) {
    try {
      const raw = await AsyncStorage.getItem(GUEST_TRANSACTIONS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed as Transaction[];
        }
      }
      // Inisialisasi awal transaksi demo jika belum ada
      await AsyncStorage.setItem(GUEST_TRANSACTIONS_KEY, JSON.stringify(SEED_GUEST_TRANSACTIONS));
      return SEED_GUEST_TRANSACTIONS;
    } catch {
      return SEED_GUEST_TRANSACTIONS;
    }
  }

  // 2. USER TERAUTENTIKASI: AMBIL TRANSAKSI DARI CLOUD SESUAI USER_ID AKUN
  try {
    const { data, error } = await supabase
      .from('transactions')
      .select(`
        *,
        category:categories(*),
        items:transaction_items(*)
      `)
      .eq('user_id', currentUserId)
      .order('transaction_date', { ascending: false });

    if (!error) {
      const formatted = (data || []).map((d: any) => {
        let cat = d.category;
        if (!cat) {
          const catKey = categorizeColumn(d.merchant_name || '');
          cat =
            DEFAULT_CATEGORIES.find((c) => categorizeColumn(c.name) === catKey) ||
            DEFAULT_CATEGORIES[0];
        }
        return {
          ...d,
          category_id: d.category_id || cat.id,
          category: cat,
          items: d.items || [],
        };
      });
      await AsyncStorage.setItem(`${LOCAL_TRANSACTIONS_KEY}_${currentUserId}`, JSON.stringify(formatted));
      return formatted as Transaction[];
    }
  } catch (err) {
    console.warn('Supabase fetch transactions notice:', err);
  }

  // 3. Fallback jika offline untuk user login
  try {
    const raw = await AsyncStorage.getItem(`${LOCAL_TRANSACTIONS_KEY}_${currentUserId}`);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {}
  return [];
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
    inMemoryTransactions = [newTx, ...(inMemoryTransactions || SEED_GUEST_TRANSACTIONS)];
    return newTx;
  }

  const { data: sessionRes } = await supabase.auth.getSession();
  const currentUserId = sessionRes?.session?.user?.id || null;

  // JIKA GUEST (TIDAK ADA AKUN LOGIN): SIMPAN MURNI DI SANDBOX LOKAL (JANGAN SENTUH SUPABASE)
  if (!currentUserId || isGuestUser(currentUserId)) {
    try {
      const raw = await AsyncStorage.getItem(GUEST_TRANSACTIONS_KEY);
      const current: Transaction[] = raw ? JSON.parse(raw) : SEED_GUEST_TRANSACTIONS;
      const updated = [newTx, ...current.filter((t) => t.id !== newTx.id)];
      await AsyncStorage.setItem(GUEST_TRANSACTIONS_KEY, JSON.stringify(updated));
    } catch {}
    return newTx;
  }

  // USER TERDAFTAR: SIMPAN KE SUPABASE POSTGRESQL
  try {
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

  // Update offline storage cache user
  try {
    const raw = await AsyncStorage.getItem(`${LOCAL_TRANSACTIONS_KEY}_${currentUserId}`);
    const current: Transaction[] = raw ? JSON.parse(raw) : [];
    const updated = [newTx, ...current.filter((t) => t.id !== newTx.id)];
    await AsyncStorage.setItem(`${LOCAL_TRANSACTIONS_KEY}_${currentUserId}`, JSON.stringify(updated));
  } catch {}

  return newTx;
}

export async function deleteTransaction(id: string): Promise<boolean> {
  if (isSSR) {
    inMemoryTransactions = (inMemoryTransactions || SEED_GUEST_TRANSACTIONS).filter((t) => t.id !== id);
    return true;
  }

  const { data: sessionRes } = await supabase.auth.getSession();
  const currentUserId = sessionRes?.session?.user?.id || null;

  // JIKA GUEST: HAPUS DARI SANDBOX LOKAL
  if (!currentUserId || isGuestUser(currentUserId)) {
    try {
      const raw = await AsyncStorage.getItem(GUEST_TRANSACTIONS_KEY);
      if (raw) {
        const list: Transaction[] = JSON.parse(raw);
        const updated = list.filter((t) => t.id !== id);
        await AsyncStorage.setItem(GUEST_TRANSACTIONS_KEY, JSON.stringify(updated));
      }
    } catch {}
    return true;
  }

  // USER RESMI: HAPUS DARI SUPABASE
  try {
    await supabase.from('transaction_items').delete().eq('transaction_id', id);
    const { error } = await supabase.from('transactions').delete().eq('id', id);
    if (error) {
      console.warn('Supabase delete error:', error);
    }
  } catch (err) {
    console.warn('Supabase delete notice:', err);
  }

  try {
    const raw = await AsyncStorage.getItem(`${LOCAL_TRANSACTIONS_KEY}_${currentUserId}`);
    if (raw) {
      const allTx: Transaction[] = JSON.parse(raw);
      const updated = allTx.filter((t) => t.id !== id);
      await AsyncStorage.setItem(`${LOCAL_TRANSACTIONS_KEY}_${currentUserId}`, JSON.stringify(updated));
    }
  } catch {}

  return true;
}

export async function updateTransaction(
  id: string,
  updatedFields: Partial<Transaction>
): Promise<Transaction | null> {
  if (isSSR) {
    if (inMemoryTransactions) {
      inMemoryTransactions = inMemoryTransactions.map((t) =>
        t.id === id ? { ...t, ...updatedFields } : t
      );
      return inMemoryTransactions.find((t) => t.id === id) || null;
    }
    return null;
  }

  const { data: sessionRes } = await supabase.auth.getSession();
  const currentUserId = sessionRes?.session?.user?.id || null;

  // JIKA GUEST: UPDATE DI SANDBOX LOKAL
  if (!currentUserId || isGuestUser(currentUserId)) {
    try {
      const raw = await AsyncStorage.getItem(GUEST_TRANSACTIONS_KEY);
      const current: Transaction[] = raw ? JSON.parse(raw) : SEED_GUEST_TRANSACTIONS;
      const index = current.findIndex((t) => t.id === id);
      if (index !== -1) {
        let resolvedCategory = updatedFields.category || current[index].category;
        if (!resolvedCategory && updatedFields.category_id) {
          resolvedCategory = DEFAULT_CATEGORIES.find((c) => c.id === updatedFields.category_id);
        }
        const updatedTx: Transaction = {
          ...current[index],
          ...updatedFields,
          category: resolvedCategory,
        };
        current[index] = updatedTx;
        await AsyncStorage.setItem(GUEST_TRANSACTIONS_KEY, JSON.stringify(current));
        return updatedTx;
      }
    } catch {}
    return null;
  }

  // USER RESMI: UPDATE DI SUPABASE
  try {
    let sbCategoryId: string | null = null;
    if (
      updatedFields.category_id &&
      updatedFields.category_id.includes('-') &&
      updatedFields.category_id.length === 36
    ) {
      sbCategoryId = updatedFields.category_id;
    } else if (updatedFields.category?.name) {
      const { data: catData } = await supabase
        .from('categories')
        .select('id')
        .ilike('name', updatedFields.category.name)
        .limit(1)
        .single();
      if (catData?.id) {
        sbCategoryId = catData.id;
      }
    }

    const payload: any = {};
    if (updatedFields.merchant_name !== undefined) payload.merchant_name = updatedFields.merchant_name;
    if (updatedFields.transaction_date !== undefined) payload.transaction_date = updatedFields.transaction_date;
    if (updatedFields.total_amount !== undefined) payload.total_amount = updatedFields.total_amount;
    if (updatedFields.subtotal !== undefined) payload.subtotal = updatedFields.subtotal;
    if (updatedFields.tax_amount !== undefined) payload.tax_amount = updatedFields.tax_amount;
    if (updatedFields.discount_amount !== undefined) payload.discount_amount = updatedFields.discount_amount;
    if (updatedFields.shipping_fee !== undefined) payload.shipping_fee = updatedFields.shipping_fee;
    if (updatedFields.admin_fee !== undefined) payload.admin_fee = updatedFields.admin_fee;
    if (updatedFields.payment_method !== undefined) payload.payment_method = updatedFields.payment_method;
    if (updatedFields.notes !== undefined) payload.notes = updatedFields.notes;
    if (sbCategoryId) payload.category_id = sbCategoryId;

    await supabase.from('transactions').update(payload).eq('id', id);

    if (updatedFields.items) {
      await supabase.from('transaction_items').delete().eq('transaction_id', id);
      if (updatedFields.items.length > 0) {
        const itemsToInsert = updatedFields.items.map((it) => ({
          transaction_id: id,
          item_name: it.item_name,
          quantity: it.quantity || 1,
          unit_price: it.unit_price || 0,
          total_price: it.total_price || (it.quantity || 1) * (it.unit_price || 0),
        }));
        await supabase.from('transaction_items').insert(itemsToInsert);
      }
    }
  } catch (err) {
    console.warn('Supabase update notice:', err);
  }

  // Update offline storage cache
  try {
    const raw = await AsyncStorage.getItem(`${LOCAL_TRANSACTIONS_KEY}_${currentUserId}`);
    const current: Transaction[] = raw ? JSON.parse(raw) : [];
    const index = current.findIndex((t) => t.id === id);
    if (index !== -1) {
      let resolvedCategory = updatedFields.category || current[index].category;
      if (!resolvedCategory && updatedFields.category_id) {
        resolvedCategory = DEFAULT_CATEGORIES.find((c) => c.id === updatedFields.category_id);
      }
      const updatedTx: Transaction = {
        ...current[index],
        ...updatedFields,
        category: resolvedCategory,
      };
      current[index] = updatedTx;
      await AsyncStorage.setItem(`${LOCAL_TRANSACTIONS_KEY}_${currentUserId}`, JSON.stringify(current));
      return updatedTx;
    }
  } catch {}
  return null;
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
  budgetLimit: number = 7000000
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
