import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Header } from '@/components/common/Header';
import { StatCard } from '@/components/common/StatCard';
import { CategoryPieChart } from '@/components/charts/CategoryPieChart';
import { TransactionCard } from '@/components/transactions/TransactionCard';
import { Palette } from '@/constants/theme';
import { useTransactionStore } from '@/store/transactionStore';
import { useAuthStore } from '@/store/authStore';
import { formatPercent, formatRupiah } from '@/utils/formatters';

export default function DashboardScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { transactions, stats } = useTransactionStore();

  const recentTransactions = transactions.slice(0, 5);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Header
          title={`Halo, ${user?.full_name?.split(' ')[0] || 'Pengguna'} 👋`}
          subtitle="Rekap & analisis pengeluaran cerdas Anda"
        />

        {/* Hero Financial Overview */}
        <View style={styles.heroCard}>
          <View style={styles.heroHeader}>
            <Text style={styles.heroLabel}>Total Pengeluaran Bulan Ini</Text>
            <View style={styles.badgeMonth}>
              <Text style={styles.badgeMonthText}>September 2026</Text>
            </View>
          </View>

          <Text style={styles.heroAmount}>{formatRupiah(stats.totalExpense)}</Text>

          {/* Budget Limit Progress Bar */}
          <View style={styles.budgetProgressContainer}>
            <View style={styles.budgetLabels}>
              <Text style={styles.budgetSubText}>
                Terpakai: {formatPercent(stats.budgetUsedPercentage)} dari {formatRupiah(stats.budgetLimit)}
              </Text>
              <Text
                style={[
                  styles.budgetRemainingText,
                  { color: stats.balance < 0 ? Palette.coral : Palette.primaryLight },
                ]}
              >
                Sisa: {formatRupiah(stats.balance)}
              </Text>
            </View>

            <View style={styles.progressBarBg}>
              <View
                style={[
                  styles.progressBarFill,
                  {
                    width: `${Math.min(100, stats.budgetUsedPercentage)}%`,
                    backgroundColor:
                      stats.budgetUsedPercentage > 85 ? Palette.coral : Palette.primary,
                  },
                ]}
              />
            </View>
          </View>
        </View>

        {/* Quick Stat Cards Grid */}
        <View style={styles.statsGrid}>
          <View style={{ flex: 1 }}>
            <StatCard
              title="Rata-rata Harian"
              amount={stats.dailyAverage}
              icon="calendar-outline"
              color={Palette.indigo}
              badgeText="Harian"
              badgeType="info"
            />
          </View>
          <View style={{ flex: 1 }}>
            <StatCard
              title="Struk Terpindai"
              amount={stats.receiptCount}
              icon="document-text-outline"
              color={Palette.amber}
              subtitle="Struk tersimpan"
              badgeText="AI Vision"
              badgeType="warning"
            />
          </View>
        </View>

        {/* Quick Scan CTA Card */}
        <TouchableOpacity
          style={styles.quickScanCard}
          onPress={() => router.push('/(tabs)/scanner')}
          activeOpacity={0.85}
        >
          <View style={styles.quickScanLeft}>
            <View style={styles.quickScanIcon}>
              <Ionicons name="camera" size={26} color="#FFFFFF" />
            </View>
            <View>
              <Text style={styles.quickScanTitle}>Scan Struk Belanja</Text>
              <Text style={styles.quickScanSubtitle}>
                AI mengekstrak toko, item, dan total otomatis
              </Text>
            </View>
          </View>

          <Ionicons name="chevron-forward" size={22} color={Palette.darkTextSecondary} />
        </TouchableOpacity>

        {/* Expense Category Donut Chart */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Distribusi Pengeluaran</Text>
          <TouchableOpacity onPress={() => router.push('/(tabs)/analytics')}>
            <Text style={styles.seeAllText}>Detail Analisis</Text>
          </TouchableOpacity>
        </View>

        <CategoryPieChart
          data={stats.categoryBreakdown}
          totalAmount={stats.totalExpense}
        />

        {/* Recent Transactions List */}
        <View style={[styles.sectionHeader, { marginTop: 24 }]}>
          <Text style={styles.sectionTitle}>Transaksi Terakhir</Text>
          <TouchableOpacity onPress={() => router.push('/(tabs)/transactions')}>
            <Text style={styles.seeAllText}>Lihat Semua</Text>
          </TouchableOpacity>
        </View>

        {recentTransactions.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="receipt-outline" size={40} color={Palette.darkTextMuted} />
            <Text style={styles.emptyTitle}>Belum ada transaksi</Text>
            <Text style={styles.emptySubtitle}>
              Ambil foto struk belanja Anda untuk mulai mencatat keuangan
            </Text>
          </View>
        ) : (
          recentTransactions.map((tx) => (
            <TransactionCard
              key={tx.id}
              transaction={tx}
              onPress={() => router.push(`/transaction/${tx.id}`)}
            />
          ))
        )}
      </ScrollView>
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
  contentContainer: {
    paddingBottom: 40,
  },
  heroCard: {
    marginHorizontal: 20,
    backgroundColor: '#0F172A',
    borderRadius: 24,
    padding: 22,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
    shadowColor: Palette.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 6,
    marginBottom: 16,
  },
  heroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  heroLabel: {
    fontSize: 13,
    color: Palette.darkTextSecondary,
    fontWeight: '500',
  },
  badgeMonth: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeMonthText: {
    fontSize: 11,
    color: Palette.darkText,
    fontWeight: '600',
  },
  heroAmount: {
    fontSize: 32,
    fontWeight: '800',
    color: Palette.darkText,
    letterSpacing: -1,
    marginBottom: 16,
  },
  budgetProgressContainer: {
    marginTop: 4,
  },
  budgetLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  budgetSubText: {
    fontSize: 12,
    color: Palette.darkTextSecondary,
  },
  budgetRemainingText: {
    fontSize: 12,
    fontWeight: '700',
  },
  progressBarBg: {
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  statsGrid: {
    flexDirection: 'row',
    marginHorizontal: 20,
    gap: 12,
    marginBottom: 16,
  },
  quickScanCard: {
    marginHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    marginBottom: 20,
  },
  quickScanLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    flex: 1,
  },
  quickScanIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Palette.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickScanTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Palette.darkText,
  },
  quickScanSubtitle: {
    fontSize: 12,
    color: Palette.darkTextSecondary,
    marginTop: 2,
    paddingRight: 10,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Palette.darkText,
  },
  seeAllText: {
    fontSize: 13,
    color: Palette.primaryLight,
    fontWeight: '600',
  },
  emptyCard: {
    marginHorizontal: 20,
    backgroundColor: Palette.darkCard,
    borderRadius: 20,
    padding: 30,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Palette.darkText,
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 12,
    color: Palette.darkTextMuted,
    textAlign: 'center',
    marginTop: 4,
  },
});
