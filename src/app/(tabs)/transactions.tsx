import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  ActivityIndicator,
  Platform,
  Linking,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Header } from '@/components/common/Header';
import { TransactionCard } from '@/components/transactions/TransactionCard';
import { Palette } from '@/constants/theme';
import { useTransactionStore } from '@/store/transactionStore';
import { useAuthStore } from '@/store/authStore';
import { useThemeStore } from '@/store/themeStore';
import { useLanguageStore } from '@/store/languageStore';
import { formatRupiah } from '@/utils/formatters';
import { downloadCSV, exportExcelReport, categorizeColumn, MonthExpenseGroup } from '@/utils/exportReport';
import { ExcelPreviewModal } from '@/components/modals/ExcelPreviewModal';
import { ExcelExportOptionsModal } from '@/components/modals/ExcelExportOptionsModal';
import { DEFAULT_CATEGORIES } from '@/constants/categories';

import {
  getLocalizedCategoryName,
  getLocalizedMonthLabel,
  translations,
  Language,
} from '@/i18n/translations';

function getCurrentMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function formatMonthLabel(monthKey: string, lang: Language = 'id'): string {
  return getLocalizedMonthLabel(monthKey, lang);
}

function getMonthNameOnly(monthKey: string, lang: Language = 'id'): string {
  if (monthKey === 'all') return translations[lang].months.allData;
  const [, month] = monthKey.split('-').map(Number);
  const keys = [
    'january', 'february', 'march', 'april', 'may', 'june',
    'july', 'august', 'september', 'october', 'november', 'december',
  ] as const;
  return (translations[lang].months as any)[keys[month - 1]] || monthKey;
}

function shiftMonth(monthKey: string, delta: number): string {
  const [year, month] = monthKey.split('-').map(Number);
  const d = new Date(year, month - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function TransactionsScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { theme, mode, toggleTheme } = useThemeStore();
  const { t, language } = useLanguageStore();
  const {
    transactions,
    categories,
    activeFilter,
    searchQuery,
    setActiveFilter,
    setSearchQuery,
    removeTransaction,
    loadData,
  } = useTransactionStore();

  const [showExcelPreview, setShowExcelPreview] = useState(false);
  const [showExportOptionsModal, setShowExportOptionsModal] = useState(false);
  const [previewMonthGroups, setPreviewMonthGroups] = useState<MonthExpenseGroup[]>([]);
  const [previewScopeTitle, setPreviewScopeTitle] = useState<string>('');
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showCalendarModal, setShowCalendarModal] = useState(false);
  const [calendarPickerYear, setCalendarPickerYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<string>(getCurrentMonthKey);
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [showSortModal, setShowSortModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; merchant: string } | null>(null);

  React.useEffect(() => {
    loadData(user?.id);
  }, [user]);

  // Selected category helper
  const selectedCategory = categories.find((c) => c.id === activeFilter);

  // Pilihan bulan (Semua Data + 6 bulan terakhir)
  const recent6Months = useMemo(() => {
    const now = new Date();
    const list: string[] = ['all'];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      list.push(key);
    }
    // Jika user memilih bulan dari kalender di luar daftar ini, masukkan agar tetap aktif
    if (!list.includes(selectedMonth)) {
      list.push(selectedMonth);
    }
    return list;
  }, [selectedMonth]);

  // Available months derived from transactions
  const availableMonths = useMemo(() => {
    const monthSet = new Set<string>();
    monthSet.add(getCurrentMonthKey()); // always include current month
    transactions.forEach((t) => {
      try {
        const d = new Date(t.transaction_date);
        if (!isNaN(d.getTime())) {
          monthSet.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
        }
      } catch {}
    });
    return Array.from(monthSet).sort();
  }, [transactions]);

  // Filter transactions by month, category, and search
  const filteredTransactions = transactions.filter((t) => {
    // Month filter (abaikan jika user memilih 'all')
    if (selectedMonth !== 'all') {
      try {
        const d = new Date(t.transaction_date);
        const txMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        if (txMonth !== selectedMonth) return false;
      } catch {
        return false;
      }
    }

    const resolvedCat =
      t.category ||
      DEFAULT_CATEGORIES.find((c) => c.id === t.category_id) ||
      DEFAULT_CATEGORIES.find((c) => {
        const catKey = categorizeColumn(t.merchant_name || '');
        return categorizeColumn(c.name) === catKey;
      }) ||
      DEFAULT_CATEGORIES[0];

    const matchCategory =
      activeFilter === 'all' ||
      t.category_id === activeFilter ||
      t.category?.id === activeFilter ||
      resolvedCat?.id === activeFilter;

    const matchSearch =
      !searchQuery ||
      t.merchant_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.notes?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.items?.some((i) => i.item_name.toLowerCase().includes(searchQuery.toLowerCase()));

    return matchCategory && matchSearch;
  });

  // Urutkan transaksi: 'newest' (terbaru ke terlama) atau 'oldest' (paling lama ke paling baru masuk)
  const sortedTransactions = useMemo(() => {
    return [...filteredTransactions].sort((a, b) => {
      const timeA = new Date(a.transaction_date || a.created_at || 0).getTime();
      const timeB = new Date(b.transaction_date || b.created_at || 0).getTime();
      return sortOrder === 'newest' ? timeB - timeA : timeA - timeB;
    });
  }, [filteredTransactions, sortOrder]);

  const totalFilteredAmount = sortedTransactions.reduce(
    (sum, t) => sum + Number(t.total_amount || 0),
    0
  );

  const handleDelete = (id: string, merchant: string) => {
    setDeleteTarget({ id, merchant });
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await removeTransaction(deleteTarget.id);
      setDeleteTarget(null);
    } catch (err: any) {
      Alert.alert('Gagal Menghapus', err?.message || 'Terjadi kesalahan saat menghapus transaksi.');
    }
  };

  const handleExportExcel = () => {
    try {
      setIsExportingExcel(true);
      exportExcelReport(filteredTransactions, user || undefined);
      setTimeout(() => setIsExportingExcel(false), 800);
      if (Platform.OS === 'web') {
        // Otomatis terunduh
      } else {
        Alert.alert('Sukses', 'File Excel (.xls) berhasil diunduh.');
      }
    } catch (err: any) {
      setIsExportingExcel(false);
      Alert.alert('Gagal Ekspor Excel', err.message || 'Terjadi kesalahan saat mengunduh file Excel.');
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <View style={styles.container}>
        {/* Header */}
        <Header
          title={t('transactions.title')}
          subtitle={t('transactions.totalCount', { count: sortedTransactions.length })}
          rightAction={
            <TouchableOpacity
              style={[styles.themeToggleBtn, { backgroundColor: theme.cardHover }]}
              onPress={toggleTheme}
            >
              <Ionicons
                name={mode === 'dark' ? 'sunny' : 'moon'}
                size={18}
                color={mode === 'dark' ? Palette.amber : Palette.primary}
              />
            </TouchableOpacity>
          }
        />

        {/* Month Tabs Bar (6 Bulan Terakhir & Tombol Kalender di Kanan) */}
        <View
          style={[
            styles.monthTabBarContainer,
            {
              backgroundColor: theme.card,
              borderColor: theme.border,
            },
          ]}
        >
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.monthTabsScroll}
          >
            {recent6Months.map((mKey) => {
              const isSelected = mKey === selectedMonth;
              const monthName = getMonthNameOnly(mKey, language);
              const [y] = mKey.split('-');
              const isDiffYear = mKey !== 'all' && Number(y) !== new Date().getFullYear();

              return (
                <TouchableOpacity
                  key={mKey}
                  style={[styles.monthTabItem, isSelected && styles.monthTabItemActive]}
                  onPress={() => setSelectedMonth(mKey)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.monthTabText,
                      { color: isSelected ? Palette.primary : theme.textSecondary },
                      isSelected && styles.monthTabTextActive,
                    ]}
                  >
                    {monthName}{isDiffYear ? ` '${y.slice(-2)}` : ''}
                  </Text>
                  {isSelected && (
                    <View style={[styles.activeTabIndicator, { backgroundColor: Palette.primary }]} />
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <View style={[styles.calendarBtnDivider, { backgroundColor: theme.border }]} />

          {/* Tombol Kalender di Kanan */}
          <TouchableOpacity
            style={[
              styles.calendarSearchBtn,
              {
                backgroundColor:
                  mode === 'dark' ? 'rgba(88, 101, 242, 0.15)' : 'rgba(88, 101, 242, 0.08)',
              },
            ]}
            onPress={() => {
              setCalendarPickerYear(Number(selectedMonth.split('-')[0]));
              setShowCalendarModal(true);
            }}
            activeOpacity={0.7}
          >
            <Ionicons name="calendar-outline" size={18} color={Palette.primary} />
          </TouchableOpacity>
        </View>

        {/* Export Banner */}
        <View
          style={[
            styles.spreadsheetBanner,
            {
              backgroundColor: mode === 'dark' ? 'rgba(35, 165, 90, 0.12)' : 'rgba(35, 165, 90, 0.08)',
              borderColor: 'rgba(35, 165, 90, 0.3)',
            },
          ]}
        >
          <View style={styles.bannerLeftCol}>
            <View style={styles.spreadsheetIconCircle}>
              <Ionicons name="document-text" size={22} color={Palette.greenOnline} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.spreadsheetBannerTitle, { color: theme.text }]}>
                {t('transactions.excelReportTitle')}
              </Text>
              <Text style={[styles.spreadsheetBannerSub, { color: theme.textSecondary }]}>
                {user?.company_name || 'PT. San Kawan Abadi'} • {formatMonthLabel(selectedMonth, language)}
              </Text>
            </View>
          </View>

          <View style={styles.bannerBtnGroup}>
            {/* Tombol Pratinjau Excel */}
            <TouchableOpacity
              style={[styles.openSpreadsheetBtn, { backgroundColor: Palette.primary }]}
              onPress={() => setShowExportOptionsModal(true)}
              activeOpacity={0.8}
            >
              <Ionicons name="eye-outline" size={15} color="#FFFFFF" />
              <Text style={styles.openSpreadsheetBtnText}>{t('transactions.previewExcel')}</Text>
            </TouchableOpacity>

            {/* Tombol Unduh Excel */}
            <TouchableOpacity
              style={[styles.openSpreadsheetBtn, { backgroundColor: '#107C41' }]}
              onPress={() => setShowExportOptionsModal(true)}
              activeOpacity={0.8}
            >
              <Ionicons name="download-outline" size={15} color="#FFFFFF" />
              <Text style={styles.openSpreadsheetBtnText}>{t('transactions.downloadExcel')}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Search Bar */}
        <View
          style={[
            styles.searchBar,
            { backgroundColor: theme.card, borderColor: theme.border },
          ]}
        >
          <Ionicons name="search-outline" size={18} color={theme.textMuted} />
          <TextInput
            style={[styles.searchInput, { color: theme.text }]}
            placeholder={t('transactions.searchPlaceholder')}
            placeholderTextColor={theme.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color={theme.textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Compact Category Filter Trigger & Sort Order Trigger */}
        <View style={styles.filterControlRow}>
          <TouchableOpacity
            style={[
              styles.categoryFilterBtn,
              activeFilter !== 'all' && styles.categoryFilterBtnActive,
              {
                backgroundColor: activeFilter !== 'all' ? `${selectedCategory?.color || Palette.primary}18` : theme.card,
                borderColor: activeFilter !== 'all' ? (selectedCategory?.color || Palette.primary) : theme.border,
              },
            ]}
            onPress={() => setShowCategoryModal(true)}
          >
            <Ionicons
              name={activeFilter !== 'all' ? 'funnel' : 'funnel-outline'}
              size={14}
              color={activeFilter !== 'all' ? (selectedCategory?.color || Palette.primary) : theme.textSecondary}
            />
            {activeFilter !== 'all' && selectedCategory && (
              <View style={[styles.dot, { backgroundColor: selectedCategory.color }]} />
            )}
            <Text
              style={[
                styles.categoryFilterBtnText,
                {
                  color: activeFilter !== 'all' ? (selectedCategory?.color || Palette.primary) : theme.text,
                  fontWeight: activeFilter !== 'all' ? '700' : '600',
                },
              ]}
            >
              {activeFilter === 'all'
                ? t('transactions.filterCategory')
                : getLocalizedCategoryName(selectedCategory?.name || '', language)}
            </Text>
            <Ionicons
              name="chevron-down"
              size={14}
              color={activeFilter !== 'all' ? (selectedCategory?.color || Palette.primary) : theme.textMuted}
            />
          </TouchableOpacity>

          {/* Tombol Urutkan Transaksi (Bentuk & Style Sama Persis dengan Filter Kategori) */}
          <TouchableOpacity
            style={[
              styles.categoryFilterBtn,
              {
                backgroundColor: theme.card,
                borderColor: theme.border,
              },
            ]}
            onPress={() => setShowSortModal(true)}
            activeOpacity={0.7}
          >
            <Ionicons
              name={sortOrder === 'newest' ? 'arrow-down' : 'arrow-up'}
              size={14}
              color={Palette.primary}
            />
            <Text
              style={[
                styles.categoryFilterBtnText,
                {
                  color: theme.text,
                  fontWeight: '600',
                },
              ]}
            >
              {sortOrder === 'newest'
                ? (language === 'id' ? 'Urutan: Terbaru' : 'Sort: Newest')
                : (language === 'id' ? 'Urutan: Terlama' : 'Sort: Oldest')}
            </Text>
            <Ionicons
              name="chevron-down"
              size={14}
              color={theme.textMuted}
            />
          </TouchableOpacity>

          {activeFilter !== 'all' && (
            <TouchableOpacity
              style={[styles.resetFilterBtn, { backgroundColor: theme.cardHover }]}
              onPress={() => setActiveFilter('all')}
            >
              <Ionicons name="close-circle" size={15} color={theme.textMuted} />
              <Text style={[styles.resetFilterText, { color: theme.textSecondary }]}>Reset</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Subtotal Summary Header */}
        <View style={styles.totalHeader}>
          <Text style={[styles.totalCountText, { color: theme.textMuted }]}>
            {language === 'id' ? 'Total Tercatat' : 'Recorded Total'} ({selectedMonth === 'all' ? (language === 'id' ? 'Semua Waktu' : 'All Time') : formatMonthLabel(selectedMonth, language)}):
          </Text>
          <Text style={[styles.totalAmountText, { color: theme.text }]}>
            {formatRupiah(totalFilteredAmount)}
          </Text>
        </View>

        {/* Transactions List */}
        <ScrollView
          style={styles.listContainer}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        >
          {sortedTransactions.length === 0 ? (
            <View
              style={[
                styles.emptyState,
                { backgroundColor: theme.card, borderColor: theme.border },
              ]}
            >
              <Ionicons name="receipt-outline" size={48} color={theme.textMuted} />
              <Text style={[styles.emptyTitle, { color: theme.text }]}>
                {t('transactions.noTransactionsFound')}
              </Text>
              <Text style={[styles.emptySubtitle, { color: theme.textMuted }]}>
                {searchQuery
                  ? t('transactions.noTransactionsFoundDesc')
                  : selectedMonth === 'all'
                  ? t('transactions.noTransactionsAll')
                  : t('transactions.noTransactionsInMonth', { month: formatMonthLabel(selectedMonth, language) })}
              </Text>
            </View>
          ) : (
            sortedTransactions.map((tx) => (
              <TransactionCard
                key={tx.id}
                transaction={tx}
                onPress={() => router.push(`/transaction/${tx.id}`)}
                onDelete={() => handleDelete(tx.id, tx.merchant_name)}
              />
            ))
          )}
        </ScrollView>

        {/* Modal Pemilih Kategori (Muncul saat tombol filter ditekan) */}
        <Modal
          visible={showCategoryModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowCategoryModal(false)}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setShowCategoryModal(false)}
          >
            <View
              style={[
                styles.modalCard,
                { backgroundColor: theme.card, borderColor: theme.border },
              ]}
              onStartShouldSetResponder={() => true}
            >
              <View style={styles.modalHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name="funnel" size={18} color={Palette.primary} />
                  <Text style={[styles.modalTitle, { color: theme.text }]}>{t('transactions.selectCategory')}</Text>
                </View>
                <TouchableOpacity
                  style={[styles.modalCloseBtn, { backgroundColor: theme.cardHover }]}
                  onPress={() => setShowCategoryModal(false)}
                >
                  <Ionicons name="close" size={18} color={theme.textMuted} />
                </TouchableOpacity>
              </View>

              <ScrollView style={{ maxHeight: 360 }} showsVerticalScrollIndicator={false}>
                {/* Opsi Semua Kategori */}
                <TouchableOpacity
                  style={[
                    styles.categoryOptionItem,
                    activeFilter === 'all' && {
                      backgroundColor: `${Palette.primary}18`,
                    },
                  ]}
                  onPress={() => {
                    setActiveFilter('all');
                    setShowCategoryModal(false);
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <View
                      style={[
                        styles.categoryIconBox,
                        { backgroundColor: activeFilter === 'all' ? Palette.primary : theme.cardHover },
                      ]}
                    >
                      <Ionicons
                        name="apps"
                        size={16}
                        color={activeFilter === 'all' ? '#FFFFFF' : theme.textSecondary}
                      />
                    </View>
                    <Text
                      style={[
                        styles.categoryOptionName,
                        {
                          color: activeFilter === 'all' ? Palette.primary : theme.text,
                          fontWeight: activeFilter === 'all' ? '700' : '500',
                        },
                      ]}
                    >
                      {t('transactions.allCategories')}
                    </Text>
                  </View>
                  {activeFilter === 'all' && (
                    <Ionicons name="checkmark-circle" size={20} color={Palette.primary} />
                  )}
                </TouchableOpacity>

                {/* List Kategori */}
                {categories.map((cat) => {
                  const isSelected = activeFilter === cat.id;
                  return (
                    <TouchableOpacity
                      key={cat.id}
                      style={[
                        styles.categoryOptionItem,
                        isSelected && {
                          backgroundColor: `${cat.color}18`,
                        },
                      ]}
                      onPress={() => {
                        setActiveFilter(cat.id);
                        setShowCategoryModal(false);
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                        <View
                          style={[
                            styles.categoryIconBox,
                            { backgroundColor: isSelected ? cat.color : `${cat.color}25` },
                          ]}
                        >
                          <Ionicons
                            name={(cat.icon as any) || 'pricetag'}
                            size={16}
                            color={isSelected ? '#FFFFFF' : cat.color}
                          />
                        </View>
                        <Text
                          style={[
                            styles.categoryOptionName,
                            {
                              color: isSelected ? cat.color : theme.text,
                              fontWeight: isSelected ? '700' : '500',
                            },
                          ]}
                        >
                          {getLocalizedCategoryName(cat.name, language)}
                        </Text>
                      </View>
                      {isSelected && (
                        <Ionicons name="checkmark-circle" size={20} color={cat.color} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          </TouchableOpacity>
        </Modal>

        {/* Modal Pemilih Urutan Transaksi (Bentuk & Style Sama dengan Modal Kategori) */}
        <Modal
          visible={showSortModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowSortModal(false)}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setShowSortModal(false)}
          >
            <View
              style={[
                styles.modalCard,
                { backgroundColor: theme.card, borderColor: theme.border },
              ]}
              onStartShouldSetResponder={() => true}
            >
              <View style={styles.modalHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name="swap-vertical" size={18} color={Palette.primary} />
                  <Text style={[styles.modalTitle, { color: theme.text }]}>{t('transactions.sortTitle')}</Text>
                </View>
                <TouchableOpacity
                  style={[styles.modalCloseBtn, { backgroundColor: theme.cardHover }]}
                  onPress={() => setShowSortModal(false)}
                >
                  <Ionicons name="close" size={18} color={theme.textMuted} />
                </TouchableOpacity>
              </View>

              <View style={{ paddingVertical: 4 }}>
                {/* Opsi Terbaru ke Terlama */}
                <TouchableOpacity
                  style={[
                    styles.categoryOptionItem,
                    sortOrder === 'newest' && {
                      backgroundColor: `${Palette.primary}18`,
                    },
                  ]}
                  onPress={() => {
                    setSortOrder('newest');
                    setShowSortModal(false);
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <View
                      style={[
                        styles.categoryIconBox,
                        { backgroundColor: sortOrder === 'newest' ? Palette.primary : theme.cardHover },
                      ]}
                    >
                      <Ionicons
                        name="arrow-down"
                        size={16}
                        color={sortOrder === 'newest' ? '#FFFFFF' : theme.textSecondary}
                      />
                    </View>
                    <View>
                      <Text
                        style={[
                          styles.categoryOptionName,
                          {
                            color: sortOrder === 'newest' ? Palette.primary : theme.text,
                            fontWeight: sortOrder === 'newest' ? '700' : '600',
                          },
                        ]}
                      >
                        {t('transactions.sortNewest')}
                      </Text>
                      <Text style={{ fontSize: 11, color: theme.textMuted, marginTop: 2 }}>
                        {t('transactions.sortNewestDesc')}
                      </Text>
                    </View>
                  </View>
                  {sortOrder === 'newest' && (
                    <Ionicons name="checkmark-circle" size={20} color={Palette.primary} />
                  )}
                </TouchableOpacity>

                {/* Opsi Terlama ke Terbaru */}
                <TouchableOpacity
                  style={[
                    styles.categoryOptionItem,
                    sortOrder === 'oldest' && {
                      backgroundColor: `${Palette.primary}18`,
                    },
                  ]}
                  onPress={() => {
                    setSortOrder('oldest');
                    setShowSortModal(false);
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <View
                      style={[
                        styles.categoryIconBox,
                        { backgroundColor: sortOrder === 'oldest' ? Palette.primary : theme.cardHover },
                      ]}
                    >
                      <Ionicons
                        name="arrow-up"
                        size={16}
                        color={sortOrder === 'oldest' ? '#FFFFFF' : theme.textSecondary}
                      />
                    </View>
                    <View>
                      <Text
                        style={[
                          styles.categoryOptionName,
                          {
                            color: sortOrder === 'oldest' ? Palette.primary : theme.text,
                            fontWeight: sortOrder === 'oldest' ? '700' : '600',
                          },
                        ]}
                      >
                        {t('transactions.sortOldest')}
                      </Text>
                      <Text style={{ fontSize: 11, color: theme.textMuted, marginTop: 2 }}>
                        {t('transactions.sortOldestDesc')}
                      </Text>
                    </View>
                  </View>
                  {sortOrder === 'oldest' && (
                    <Ionicons name="checkmark-circle" size={20} color={Palette.primary} />
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </Modal>

        {/* Modal Konfirmasi Hapus Transaksi (UI Khusus, Bukan Browser Alert) */}
        <Modal
          visible={Boolean(deleteTarget)}
          transparent
          animationType="fade"
          onRequestClose={() => setDeleteTarget(null)}
        >
          <View style={styles.deleteModalOverlay}>
            <View style={[styles.deleteModalCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <View style={styles.deleteWarningIconBox}>
                <Ionicons name="trash" size={26} color={Palette.coral} />
              </View>

              <Text style={[styles.deleteModalTitle, { color: theme.text }]}>
                {t('transactions.deleteTitle')}
              </Text>
              <Text style={[styles.deleteModalDesc, { color: theme.textSecondary }]}>
                {t('transactions.deleteConfirm', { merchant: deleteTarget?.merchant || '' })}
              </Text>

              <View style={styles.deleteModalActions}>
                <TouchableOpacity
                  style={[styles.deleteCancelBtn, { backgroundColor: theme.cardHover }]}
                  onPress={() => setDeleteTarget(null)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.deleteCancelBtnText, { color: theme.text }]}>
                    {t('common.cancel')}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.deleteConfirmBtn}
                  onPress={handleConfirmDelete}
                  activeOpacity={0.8}
                >
                  <Ionicons name="trash" size={15} color="#FFFFFF" />
                  <Text style={styles.deleteConfirmBtnText}>
                    {t('common.delete')}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Modal Kalender / Pemilih Bulan & Tahun */}
        <Modal visible={showCalendarModal} transparent animationType="fade">
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setShowCalendarModal(false)}
          >
            <View
              style={[
                styles.calendarModalCard,
                { backgroundColor: theme.card, borderColor: theme.border },
              ]}
              onStartShouldSetResponder={() => true}
            >
              {/* Modal Header */}
              <View style={styles.calendarModalHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={styles.calendarIconCircle}>
                    <Ionicons name="calendar" size={18} color={Palette.primary} />
                  </View>
                  <Text style={[styles.calendarModalTitle, { color: theme.text }]}>
                    {t('months.selectMonthYear')}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => setShowCalendarModal(false)}
                  style={[styles.calendarCloseBtn, { backgroundColor: theme.cardHover }]}
                >
                  <Ionicons name="close" size={18} color={theme.textMuted} />
                </TouchableOpacity>
              </View>

              {/* Year Selector */}
              <View
                style={[
                  styles.yearSelectorRow,
                  { backgroundColor: theme.background, borderColor: theme.border },
                ]}
              >
                <TouchableOpacity
                  style={styles.yearArrowBtn}
                  onPress={() => setCalendarPickerYear((prev) => prev - 1)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="chevron-back" size={18} color={theme.text} />
                </TouchableOpacity>

                <Text style={[styles.yearText, { color: theme.text }]}>
                  {calendarPickerYear}
                </Text>

                <TouchableOpacity
                  style={styles.yearArrowBtn}
                  onPress={() => setCalendarPickerYear((prev) => prev + 1)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="chevron-forward" size={18} color={theme.text} />
                </TouchableOpacity>
              </View>

              {/* 12 Months Grid */}
              <View style={styles.monthsGrid}>
                {Array.from({ length: 12 }).map((_, idx) => {
                  const mKey = `${calendarPickerYear}-${String(idx + 1).padStart(2, '0')}`;
                  const isSelected = mKey === selectedMonth;
                  const isCurrentMonth = mKey === getCurrentMonthKey();
                  const monthName = getMonthNameOnly(mKey, language);

                  return (
                    <TouchableOpacity
                      key={mKey}
                      style={[
                        styles.monthGridItem,
                        {
                          backgroundColor: isSelected ? Palette.primary : theme.background,
                          borderColor: isSelected ? Palette.primary : theme.border,
                        },
                      ]}
                      onPress={() => {
                        setSelectedMonth(mKey);
                        setShowCalendarModal(false);
                      }}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.monthGridText,
                          { color: isSelected ? '#FFFFFF' : theme.text },
                          isSelected && { fontWeight: '800' },
                        ]}
                      >
                        {monthName}
                      </Text>
                      {isCurrentMonth && !isSelected && (
                        <View style={styles.currentMonthDot} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Quick Action: Bulan Ini */}
              <TouchableOpacity
                style={[
                  styles.jumpToCurrentMonthBtn,
                  {
                    backgroundColor:
                      mode === 'dark' ? 'rgba(88, 101, 242, 0.15)' : 'rgba(88, 101, 242, 0.08)',
                  },
                ]}
                onPress={() => {
                  const cur = getCurrentMonthKey();
                  setSelectedMonth(cur);
                  setShowCalendarModal(false);
                }}
                activeOpacity={0.7}
              >
                <Text style={[styles.jumpToCurrentMonthText, { color: Palette.primary }]}>
                  {t('months.jumpToCurrentMonth', { month: formatMonthLabel(getCurrentMonthKey(), language) })}
                </Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>

        {/* Modal Opsi Ekspor & Pratinjau Excel (Bulan Ini, Semua Data Multi-Sheet, Kustom) */}
        <ExcelExportOptionsModal
          visible={showExportOptionsModal}
          onClose={() => setShowExportOptionsModal(false)}
          transactions={transactions}
          user={user}
          currentMonthKey={selectedMonth === 'all' ? getCurrentMonthKey() : selectedMonth}
          onOpenPreview={(groups, scopeTitle) => {
            setPreviewMonthGroups(groups);
            setPreviewScopeTitle(scopeTitle);
            setShowExcelPreview(true);
          }}
        />

        {/* Modal Pratinjau Excel (.xlsx / .xls) Multi-Sheet */}
        <ExcelPreviewModal
          visible={showExcelPreview}
          onClose={() => setShowExcelPreview(false)}
          transactions={filteredTransactions}
          monthGroups={previewMonthGroups}
          scopeTitle={previewScopeTitle}
          user={user}
          selectedMonth={selectedMonth}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  themeToggleBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Month Tabs Bar (5 Bulan Terakhir + Calendar Button)
  monthTabBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  monthTabsScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    gap: 4,
  },
  monthTabItem: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  monthTabItemActive: {
    // Active state
  },
  monthTabText: {
    fontSize: 13,
    fontWeight: '500',
  },
  monthTabTextActive: {
    fontWeight: '800',
  },
  activeTabIndicator: {
    position: 'absolute',
    bottom: 0,
    height: 3,
    width: '60%',
    borderRadius: 2,
  },
  calendarBtnDivider: {
    width: 1,
    height: 24,
    marginHorizontal: 4,
  },
  calendarSearchBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  spreadsheetBanner: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 14,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    gap: 10,
  },
  bannerLeftCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  spreadsheetIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: 'rgba(35, 165, 90, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  spreadsheetBannerTitle: {
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 18,
  },
  spreadsheetBannerSub: {
    fontSize: 11,
    marginTop: 2,
    lineHeight: 15,
  },
  bannerBtnGroup: {
    flexDirection: 'column',
    gap: 6,
    width: 124,
    justifyContent: 'center',
  },
  openSpreadsheetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  openSpreadsheetBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 11,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 10,
    paddingHorizontal: 12,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
  },
  filterControlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 10,
    gap: 8,
  },
  categoryFilterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    gap: 6,
  },
  categoryFilterBtnActive: {
    borderWidth: 1.5,
  },
  categoryFilterBtnText: {
    fontSize: 12,
  },
  sortOrderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    gap: 6,
  },
  sortOrderBtnText: {
    fontSize: 12,
  },
  resetFilterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    gap: 4,
  },
  resetFilterText: {
    fontSize: 11,
    fontWeight: '600',
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  totalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  totalCountText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  totalAmountText: {
    fontSize: 15,
    fontWeight: '800',
  },
  listContainer: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 90,
  },
  emptyState: {
    marginHorizontal: 16,
    marginTop: 20,
    padding: 30,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 18,
    borderWidth: 1,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(150, 150, 150, 0.15)',
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  modalCloseBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryOptionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    marginBottom: 4,
  },
  categoryIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryOptionName: {
    fontSize: 13,
  },
  // Calendar Modal Styles
  calendarModalCard: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 20,
    borderWidth: 1,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
  },
  calendarModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  calendarIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(88, 101, 242, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  calendarModalTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  calendarCloseBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  yearSelectorRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 14,
  },
  yearArrowBtn: {
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  yearText: {
    fontSize: 16,
    fontWeight: '800',
  },
  monthsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  monthGridItem: {
    width: '31%',
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  monthGridText: {
    fontSize: 12,
    fontWeight: '600',
  },
  currentMonthDot: {
    position: 'absolute',
    bottom: 3,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: Palette.primary,
  },
  jumpToCurrentMonthBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
  },
  jumpToCurrentMonthText: {
    fontSize: 12,
    fontWeight: '700',
  },
  deleteModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  deleteModalCard: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 20,
    padding: 22,
    alignItems: 'center',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 10,
  },
  deleteWarningIconBox: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(242, 63, 67, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  deleteModalTitle: {
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center',
  },
  deleteModalDesc: {
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 8,
  },
  deleteModalActions: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  deleteCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteCancelBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  deleteConfirmBtn: {
    flex: 1.2,
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: Palette.coral,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteConfirmBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
