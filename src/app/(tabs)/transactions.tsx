import React, { useState } from 'react';
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
import { formatRupiah } from '@/utils/formatters';
import { downloadCSV, exportExcelReport, exportGoogleSpreadsheetReport, openPrintableReport } from '@/utils/exportReport';

export default function TransactionsScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { theme, mode, toggleTheme } = useThemeStore();
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

  const [isExportingSheet, setIsExportingSheet] = useState(false);
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);

  React.useEffect(() => {
    loadData(user?.id);
  }, [user]);

  // Selected category helper
  const selectedCategory = categories.find((c) => c.id === activeFilter);

  // Filter transactions
  const filteredTransactions = transactions.filter((t) => {
    const matchCategory = activeFilter === 'all' || t.category_id === activeFilter;
    const matchSearch =
      !searchQuery ||
      t.merchant_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.notes?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.items?.some((i) => i.item_name.toLowerCase().includes(searchQuery.toLowerCase()));

    return matchCategory && matchSearch;
  });

  const totalFilteredAmount = filteredTransactions.reduce(
    (sum, t) => sum + Number(t.total_amount || 0),
    0
  );

  const handleDelete = (id: string, merchant: string) => {
    if (Platform.OS === 'web') {
      const confirmed = window.confirm(`Apakah Anda yakin ingin menghapus transaksi dari "${merchant}"?`);
      if (confirmed) {
        removeTransaction(id);
      }
      return;
    }

    Alert.alert(
      'Hapus Transaksi',
      `Apakah Anda yakin ingin menghapus transaksi dari "${merchant}"?`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus',
          style: 'destructive',
          onPress: () => removeTransaction(id),
        },
      ]
    );
  };

  const handlePrintReport = () => {
    openPrintableReport(filteredTransactions, user || undefined);
  };

  const handleExportExcel = () => {
    try {
      setIsExportingExcel(true);
      const fileName = `Rekapitulasi_Klaim_${(user?.company_name || 'Perusahaan').replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.xls`;
      exportExcelReport(filteredTransactions, user || undefined, fileName);
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

  const handleExportGoogleSheet = async () => {
    try {
      setIsExportingSheet(true);
      const fileName = `Rekapitulasi_Klaim_${(user?.company_name || 'Perusahaan').replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}`;
      const result = await exportGoogleSpreadsheetReport(filteredTransactions, user || undefined, fileName);
      setIsExportingSheet(false);
      if (Platform.OS !== 'web') {
        Alert.alert('Google Spreadsheet', result.message);
      }
    } catch (err: any) {
      setIsExportingSheet(false);
      Alert.alert('Gagal Ekspor Spreadsheet', err.message || 'Terjadi kesalahan saat membuka Google Spreadsheet.');
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <View style={styles.container}>
        {/* Header */}
        <Header
          title="Riwayat Transaksi"
          subtitle={`${filteredTransactions.length} transaksi tercatat`}
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

        {/* 1-Click Printable, Excel & Spreadsheet Banner */}
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
                Rekap Formulir SKA Resmi 📋
              </Text>
              <Text style={[styles.spreadsheetBannerSub, { color: theme.textSecondary }]}>
                {user?.company_name || 'PT. San Kawan Abadi'} • Format Rapih & Lega
              </Text>
            </View>
          </View>

          <View style={styles.bannerBtnGroup}>
            {/* Tombol Excel */}
            <TouchableOpacity
              style={[styles.openSpreadsheetBtn, { backgroundColor: '#107C41' }]}
              onPress={handleExportExcel}
              disabled={isExportingExcel}
            >
              {isExportingExcel ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <>
                  <Ionicons name="download-outline" size={14} color="#FFFFFF" />
                  <Text style={styles.openSpreadsheetBtnText}>Excel (.xls)</Text>
                </>
              )}
            </TouchableOpacity>

            {/* Tombol Google Sheets */}
            <TouchableOpacity
              style={[styles.openSpreadsheetBtn, { backgroundColor: '#0F9D58' }]}
              onPress={handleExportGoogleSheet}
              disabled={isExportingSheet}
            >
              {isExportingSheet ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <>
                  <Ionicons name="grid-outline" size={14} color="#FFFFFF" />
                  <Text style={styles.openSpreadsheetBtnText}>Spreadsheet ↗</Text>
                </>
              )}
            </TouchableOpacity>

            {/* Tombol Cetak / PDF */}
            <TouchableOpacity
              style={[styles.openSpreadsheetBtn, { backgroundColor: Palette.primary }]}
              onPress={handlePrintReport}
            >
              <Ionicons name="print-outline" size={14} color="#FFFFFF" />
              <Text style={styles.openSpreadsheetBtnText}>Cetak / PDF</Text>
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
            placeholder="Cari toko, barang belanjaan, atau catatan..."
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

        {/* Compact Category Filter Trigger (Tidak Muncul Semua secara Default) */}
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
              {activeFilter === 'all' ? 'Filter Kategori' : selectedCategory?.name || 'Kategori Terpilih'}
            </Text>
            <Ionicons
              name="chevron-down"
              size={14}
              color={activeFilter !== 'all' ? (selectedCategory?.color || Palette.primary) : theme.textMuted}
            />
          </TouchableOpacity>

          {activeFilter !== 'all' && (
            <TouchableOpacity
              style={[styles.resetFilterBtn, { backgroundColor: theme.cardHover }]}
              onPress={() => setActiveFilter('all')}
            >
              <Ionicons name="close-circle" size={15} color={theme.textMuted} />
              <Text style={[styles.resetFilterText, { color: theme.textSecondary }]}>Reset Filter</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Subtotal Summary Header */}
        <View style={styles.totalHeader}>
          <Text style={[styles.totalCountText, { color: theme.textMuted }]}>
            Total Tercatat:
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
          {filteredTransactions.length === 0 ? (
            <View
              style={[
                styles.emptyState,
                { backgroundColor: theme.card, borderColor: theme.border },
              ]}
            >
              <Ionicons name="receipt-outline" size={48} color={theme.textMuted} />
              <Text style={[styles.emptyTitle, { color: theme.text }]}>
                Tidak ada transaksi ditemukan
              </Text>
              <Text style={[styles.emptySubtitle, { color: theme.textMuted }]}>
                {searchQuery
                  ? 'Coba gunakan kata kunci pencarian yang lain'
                  : 'Unggah struk untuk menambahkan transaksi baru'}
              </Text>
            </View>
          ) : (
            filteredTransactions.map((tx) => (
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
                  <Text style={[styles.modalTitle, { color: theme.text }]}>Pilih Kategori</Text>
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
                      Semua Kategori
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
                          {cat.name}
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
    fontSize: 13,
    fontWeight: '800',
  },
  spreadsheetBannerSub: {
    fontSize: 10,
    marginTop: 1,
  },
  bannerBtnGroup: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  openSpreadsheetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
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
});
