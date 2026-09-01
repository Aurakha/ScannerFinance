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
import { downloadCSV, generateCompanyExpenseReportCSV } from '@/utils/exportReport';
import { exportToGoogleSpreadsheet } from '@/services/googleDriveService';

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

  React.useEffect(() => {
    loadData(user?.id);
  }, [user]);

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

  const handleExportGoogleSheet = async () => {
    try {
      setIsExportingSheet(true);
      const csv = generateCompanyExpenseReportCSV(filteredTransactions, user || undefined);
      const fileName = `Rekapitulasi_Klaim_${(user?.company_name || 'Perusahaan').replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}`;

      // 1. Selalu unduh file CSV otomatis ke perangkat
      downloadCSV(csv, `${fileName}.csv`);

      // 2. Buka Spreadsheet di tab baru
      const result = await exportToGoogleSpreadsheet(csv, fileName);
      setIsExportingSheet(false);

      if (result.isDirectCloud) {
        Alert.alert(
          'Google Spreadsheet Berhasil Dibuat! 📊',
          'File Google Sheets baru telah otomatis dibuat di Google Drive Anda.',
          [
            { text: 'Tutup', style: 'cancel' },
            {
              text: 'Buka Spreadsheet ↗',
              onPress: () => {
                if (Platform.OS === 'web' && typeof window !== 'undefined') {
                  window.open(result.spreadsheetUrl, '_blank');
                } else {
                  Linking.openURL(result.spreadsheetUrl);
                }
              },
            },
          ]
        );
      } else {
        Alert.alert(
          'File Rekap Berhasil Diunduh! 📊',
          'Berkas CSV rekapitulasi klaim biaya telah diunduh ke komputer Anda. Buka Google Sheets untuk melihatnya sekarang?',
          [
            { text: 'Selesai', style: 'cancel' },
            {
              text: 'Buka Google Sheets ↗',
              onPress: () => {
                if (Platform.OS === 'web' && typeof window !== 'undefined') {
                  window.open('https://sheets.new', '_blank');
                } else {
                  Linking.openURL('https://sheets.new');
                }
              },
            },
          ]
        );
      }
    } catch (err: any) {
      setIsExportingSheet(false);
      Alert.alert('Gagal Ekspor', err.message || 'Terjadi kesalahan saat mengekspor laporan.');
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

        {/* 1-Click Google Spreadsheet Export Banner (PT. San Kawan Abadi Format) */}
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
              <Ionicons name="grid" size={20} color={Palette.greenOnline} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.spreadsheetBannerTitle, { color: theme.text }]}>
                Ekspor ke Google Spreadsheet 📊
              </Text>
              <Text style={[styles.spreadsheetBannerSub, { color: theme.textSecondary }]}>
                Format tabel reimbursement resmi {user?.company_name || 'PT. Nama Perusahaan'}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.openSpreadsheetBtn}
            onPress={handleExportGoogleSheet}
            disabled={isExportingSheet}
          >
            {isExportingSheet ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <Text style={styles.openSpreadsheetBtnText}>Unduh & Buka ↗</Text>
              </>
            )}
          </TouchableOpacity>
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

        {/* Category Filters Pill Row */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterRow}
          contentContainerStyle={styles.filterContent}
        >
          <TouchableOpacity
            style={[
              styles.filterChip,
              activeFilter === 'all' && styles.filterChipActive,
              { backgroundColor: theme.card, borderColor: theme.border },
            ]}
            onPress={() => setActiveFilter('all')}
          >
            <Text
              style={[
                styles.filterChipText,
                activeFilter === 'all' && styles.filterChipTextActive,
                { color: activeFilter === 'all' ? '#FFFFFF' : theme.textSecondary },
              ]}
            >
              Semua
            </Text>
          </TouchableOpacity>

          {categories.map((cat) => {
            const isSelected = activeFilter === cat.id;
            return (
              <TouchableOpacity
                key={cat.id}
                style={[
                  styles.filterChip,
                  isSelected && {
                    backgroundColor: `${cat.color}25`,
                    borderColor: cat.color,
                  },
                  { backgroundColor: theme.card, borderColor: theme.border },
                ]}
                onPress={() => setActiveFilter(cat.id)}
              >
                <View style={[styles.dot, { backgroundColor: cat.color }]} />
                <Text
                  style={[
                    styles.filterChipText,
                    isSelected && { color: cat.color, fontWeight: '700' },
                    { color: isSelected ? cat.color : theme.textSecondary },
                  ]}
                >
                  {cat.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

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
  openSpreadsheetBtn: {
    backgroundColor: Palette.greenOnline,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
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
  filterRow: {
    maxHeight: 38,
    marginBottom: 10,
  },
  filterContent: {
    paddingHorizontal: 16,
    gap: 6,
    alignItems: 'center',
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 18,
    borderWidth: 1,
  },
  filterChipActive: {
    backgroundColor: Palette.primary,
    borderColor: Palette.primary,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  filterChipText: {
    fontSize: 11,
    fontWeight: '600',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
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
});
