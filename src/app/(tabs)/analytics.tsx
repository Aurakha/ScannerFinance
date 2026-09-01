import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Header } from '@/components/common/Header';
import { CategoryPieChart } from '@/components/charts/CategoryPieChart';
import { SpendingBarChart } from '@/components/charts/SpendingBarChart';
import { Palette } from '@/constants/theme';
import { useTransactionStore } from '@/store/transactionStore';
import { formatPercent, formatRupiah } from '@/utils/formatters';

export default function AnalyticsScreen() {
  const { stats, transactions } = useTransactionStore();
  const [activePeriod, setActivePeriod] = useState<'month' | 'week'>('month');

  // Siapkan data pengeluaran 7 hari terakhir
  const daysOfWeek = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
  const now = new Date();
  const last7Days = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date();
    d.setDate(now.getDate() - (6 - i));
    const dayLabel = daysOfWeek[d.getDay()];
    const dateNumber = d.getDate();

    // Hitung pengeluaran pada tanggal tersebut
    const dayTotal = transactions
      .filter((t) => {
        const txDate = new Date(t.transaction_date);
        return (
          txDate.getDate() === d.getDate() &&
          txDate.getMonth() === d.getMonth() &&
          txDate.getFullYear() === d.getFullYear() &&
          t.category?.type !== 'income'
        );
      })
      .reduce((sum, t) => sum + Number(t.total_amount || 0), 0);

    return {
      dayLabel,
      dateNumber,
      amount: dayTotal,
      isToday: i === 6,
    };
  });

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <Header
          title="Analisis Finansial"
          subtitle="Insight pola belanja & monitoring anggaran"
        />

        {/* Budget Health Card */}
        <View style={styles.budgetCard}>
          <View style={styles.budgetCardHeader}>
            <View>
              <Text style={styles.budgetCardTitle}>Kesehatan Anggaran</Text>
              <Text style={styles.budgetCardSub}>Batas: {formatRupiah(stats.budgetLimit)}</Text>
            </View>

            <View
              style={[
                styles.statusPill,
                {
                  backgroundColor:
                    stats.budgetUsedPercentage > 90
                      ? 'rgba(239, 68, 68, 0.15)'
                      : stats.budgetUsedPercentage > 70
                      ? 'rgba(245, 158, 11, 0.15)'
                      : 'rgba(16, 185, 129, 0.15)',
                },
              ]}
            >
              <Text
                style={[
                  styles.statusPillText,
                  {
                    color:
                      stats.budgetUsedPercentage > 90
                        ? Palette.coral
                        : stats.budgetUsedPercentage > 70
                        ? Palette.amber
                        : Palette.primary,
                  },
                ]}
              >
                {stats.budgetUsedPercentage > 90
                  ? 'Kritis'
                  : stats.budgetUsedPercentage > 70
                  ? 'Waspada'
                  : 'Aman'}
              </Text>
            </View>
          </View>

          <View style={styles.budgetMetricsRow}>
            <View style={styles.metricBox}>
              <Text style={styles.metricLabel}>Terpakai</Text>
              <Text style={styles.metricVal}>{formatRupiah(stats.totalExpense)}</Text>
            </View>
            <View style={styles.metricDivider} />
            <View style={styles.metricBox}>
              <Text style={styles.metricLabel}>Sisa Anggaran</Text>
              <Text
                style={[
                  styles.metricVal,
                  { color: stats.balance < 0 ? Palette.coral : Palette.primary },
                ]}
              >
                {formatRupiah(stats.balance)}
              </Text>
            </View>
          </View>
        </View>

        {/* 7 Days Spending Bar Chart */}
        <View style={styles.sectionMargin}>
          <SpendingBarChart data={last7Days} />
        </View>

        {/* Category Breakdown Donut */}
        <View style={styles.sectionMargin}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Porsi Kategori Pengeluaran</Text>
          </View>
          <CategoryPieChart
            data={stats.categoryBreakdown}
            totalAmount={stats.totalExpense}
          />
        </View>

        {/* Top Expense Breakdown List */}
        <View style={styles.sectionMargin}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Rincian Kategori Terbesar</Text>
          </View>

          <View style={styles.breakdownCard}>
            {stats.categoryBreakdown.map((cat, idx) => (
              <View
                key={cat.categoryId}
                style={[
                  styles.breakdownRow,
                  idx !== stats.categoryBreakdown.length - 1 && styles.borderBottom,
                ]}
              >
                <View style={[styles.catIconBox, { backgroundColor: `${cat.categoryColor}20` }]}>
                  <Ionicons name={cat.categoryIcon as any} size={20} color={cat.categoryColor} />
                </View>

                <View style={styles.catInfo}>
                  <View style={styles.catNameRow}>
                    <Text style={styles.catName}>{cat.categoryName}</Text>
                    <Text style={styles.catAmount}>{formatRupiah(cat.amount)}</Text>
                  </View>

                  <View style={styles.progressRow}>
                    <View style={styles.catProgressBg}>
                      <View
                        style={[
                          styles.catProgressFill,
                          {
                            width: `${cat.percentage}%`,
                            backgroundColor: cat.categoryColor,
                          },
                        ]}
                      />
                    </View>
                    <Text style={styles.catPercentText}>{formatPercent(cat.percentage)}</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        </View>
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
  budgetCard: {
    marginHorizontal: 20,
    backgroundColor: Palette.darkCard,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 20,
  },
  budgetCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  budgetCardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Palette.darkText,
  },
  budgetCardSub: {
    fontSize: 12,
    color: Palette.darkTextSecondary,
    marginTop: 2,
  },
  statusPill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
  },
  statusPillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  budgetMetricsRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
  },
  metricBox: {
    flex: 1,
    alignItems: 'center',
  },
  metricDivider: {
    width: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  metricLabel: {
    fontSize: 11,
    color: Palette.darkTextMuted,
    marginBottom: 4,
  },
  metricVal: {
    fontSize: 15,
    fontWeight: '800',
    color: Palette.darkText,
  },
  sectionMargin: {
    marginHorizontal: 20,
    marginBottom: 20,
  },
  sectionHeader: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Palette.darkText,
  },
  breakdownCard: {
    backgroundColor: Palette.darkCard,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  borderBottom: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  catIconBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  catInfo: {
    flex: 1,
  },
  catNameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  catName: {
    fontSize: 13,
    fontWeight: '600',
    color: Palette.darkText,
  },
  catAmount: {
    fontSize: 13,
    fontWeight: '700',
    color: Palette.darkText,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  catProgressBg: {
    flex: 1,
    height: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  catProgressFill: {
    height: '100%',
    borderRadius: 3,
  },
  catPercentText: {
    fontSize: 11,
    fontWeight: '600',
    color: Palette.darkTextSecondary,
    width: 34,
    textAlign: 'right',
  },
});
