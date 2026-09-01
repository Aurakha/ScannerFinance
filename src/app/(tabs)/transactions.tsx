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
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Header } from '@/components/common/Header';
import { TransactionCard } from '@/components/transactions/TransactionCard';
import { Palette } from '@/constants/theme';
import { useTransactionStore } from '@/store/transactionStore';
import { formatRupiah } from '@/utils/formatters';

export default function TransactionsScreen() {
  const router = useRouter();
  const { transactions, categories, removeTransaction } = useTransactionStore();
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const filteredTransactions = transactions.filter((tx) => {
    // Search matching (merchant name, notes, or item name)
    const matchSearch =
      !search ||
      tx.merchant_name.toLowerCase().includes(search.toLowerCase()) ||
      (tx.notes && tx.notes.toLowerCase().includes(search.toLowerCase())) ||
      (tx.items && tx.items.some((it) => it.item_name.toLowerCase().includes(search.toLowerCase())));

    // Category matching
    const matchCat =
      selectedCategory === 'all' || tx.category_id === selectedCategory;

    return matchSearch && matchCat;
  });

  const totalFilteredExpense = filteredTransactions
    .filter((t) => t.category?.type !== 'income')
    .reduce((sum, t) => sum + Number(t.total_amount || 0), 0);

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

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Header */}
        <Header
          title="Riwayat Transaksi"
          subtitle={`${filteredTransactions.length} transaksi tercatat`}
          rightAction={{
            icon: 'add-circle-outline',
            onPress: () => router.push('/(tabs)/scanner'),
          }}
        />

        {/* Search Input */}
        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={18} color={Palette.darkTextMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Cari toko, barang belanjaan, atau catatan..."
            placeholderTextColor={Palette.darkTextMuted}
            value={search}
            onChangeText={setSearch}
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={18} color={Palette.darkTextMuted} />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Category Horizontal Filter */}
        <View style={styles.filterWrapper}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterList}
          >
            <TouchableOpacity
              style={[
                styles.filterChip,
                selectedCategory === 'all' && styles.filterChipActive,
              ]}
              onPress={() => setSelectedCategory('all')}
            >
              <Text
                style={[
                  styles.filterChipText,
                  selectedCategory === 'all' && styles.filterChipTextActive,
                ]}
              >
                Semua
              </Text>
            </TouchableOpacity>

            {categories.map((cat) => {
              const isActive = selectedCategory === cat.id;
              return (
                <TouchableOpacity
                  key={cat.id}
                  style={[
                    styles.filterChip,
                    isActive && {
                      backgroundColor: `${cat.color}25`,
                      borderColor: cat.color,
                    },
                  ]}
                  onPress={() => setSelectedCategory(cat.id)}
                >
                  <View style={[styles.dot, { backgroundColor: cat.color }]} />
                  <Text
                    style={[
                      styles.filterChipText,
                      isActive && { color: cat.color, fontWeight: '700' },
                    ]}
                  >
                    {cat.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Subtotal of filtered items */}
        <View style={styles.summaryBar}>
          <Text style={styles.summaryLabel}>Total Filter:</Text>
          <Text style={styles.summaryAmount}>{formatRupiah(totalFilteredExpense)}</Text>
        </View>

        {/* Transactions List */}
        <ScrollView
          style={styles.list}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        >
          {filteredTransactions.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="search-outline" size={48} color={Palette.darkTextMuted} />
              <Text style={styles.emptyTitle}>Tidak ada transaksi ditemukan</Text>
              <Text style={styles.emptySubtitle}>
                Coba sesuaikan kata kunci pencarian atau filter kategori Anda.
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
    backgroundColor: Palette.darkBg,
  },
  container: {
    flex: 1,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Palette.darkCard,
    marginHorizontal: 20,
    paddingHorizontal: 14,
    height: 46,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    gap: 10,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    color: Palette.darkText,
    fontSize: 13,
  },
  filterWrapper: {
    marginBottom: 12,
  },
  filterList: {
    paddingHorizontal: 20,
    gap: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Palette.darkCard,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  filterChipActive: {
    backgroundColor: Palette.primaryMuted,
    borderColor: Palette.primary,
  },
  filterChipText: {
    fontSize: 12,
    color: Palette.darkTextSecondary,
    fontWeight: '500',
  },
  filterChipTextActive: {
    color: Palette.primary,
    fontWeight: '700',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  summaryBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  summaryLabel: {
    fontSize: 12,
    color: Palette.darkTextMuted,
    fontWeight: '500',
  },
  summaryAmount: {
    fontSize: 14,
    fontWeight: '700',
    color: Palette.darkText,
  },
  list: {
    flex: 1,
  },
  listContent: {
    padding: 20,
    paddingTop: 12,
    paddingBottom: 40,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 30,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Palette.darkText,
    marginTop: 14,
  },
  emptySubtitle: {
    fontSize: 13,
    color: Palette.darkTextMuted,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
  },
});
