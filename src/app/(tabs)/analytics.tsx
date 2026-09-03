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
import { useThemeStore } from '@/store/themeStore';
import { useLanguageStore } from '@/store/languageStore';
import { getLocalizedCategoryName, translations } from '@/i18n/translations';
import { formatPercent, formatRupiah } from '@/utils/formatters';

export default function AnalyticsScreen() {
  const { stats, transactions } = useTransactionStore();
  const { theme, mode, toggleTheme } = useThemeStore();
  const { t, language } = useLanguageStore();
  const [activePeriod, setActivePeriod] = useState<'month' | 'week'>('month');

  // Siapkan data pengeluaran 7 hari terakhir
  const daysOfWeek = translations[language].months.daysShort;
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
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <Header
          title={t('analytics.title')}
          subtitle={t('analytics.subtitle')}
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

        {/* Budget Health Card */}
        <View
          style={[
            styles.budgetCard,
            { backgroundColor: theme.card, borderColor: theme.border },
          ]}
        >
          <View style={styles.budgetCardHeader}>
            <View>
              <Text style={[styles.budgetCardTitle, { color: theme.text }]}>
                {t('analytics.budgetStatusTitle')}
              </Text>
              <Text style={[styles.budgetCardSub, { color: theme.textSecondary }]}>
                {language === 'id' ? 'Batas: ' : 'Limit: '}{formatRupiah(stats.budgetLimit)}
              </Text>
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
                  ? (language === 'id' ? 'Kritis' : 'Critical')
                  : stats.budgetUsedPercentage > 70
                  ? (language === 'id' ? 'Waspada' : 'Warning')
                  : (language === 'id' ? 'Aman' : 'Safe')}
              </Text>
            </View>
          </View>

          <View
            style={[
              styles.budgetMetricsRow,
              { backgroundColor: theme.background, borderColor: theme.border },
            ]}
          >
            <View style={styles.metricBox}>
              <Text style={[styles.metricLabel, { color: theme.textMuted }]}>
                {language === 'id' ? 'Terpakai' : 'Used'}
              </Text>
              <Text style={[styles.metricVal, { color: theme.text }]}>
                {formatRupiah(stats.totalExpense)}
              </Text>
            </View>
            <View style={[styles.metricDivider, { backgroundColor: theme.border }]} />
            <View style={styles.metricBox}>
              <Text style={[styles.metricLabel, { color: theme.textMuted }]}>
                {language === 'id' ? 'Sisa Anggaran' : 'Remaining Budget'}
              </Text>
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
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              {t('analytics.categoryDistribution')}
            </Text>
          </View>
          <CategoryPieChart
            data={stats.categoryBreakdown}
            totalAmount={stats.totalExpense}
          />
        </View>

        {/* Top Expense Breakdown List */}
        <View style={styles.sectionMargin}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              {t('analytics.highestCategoryBreakdown')}
            </Text>
          </View>

          <View
            style={[
              styles.breakdownCard,
              { backgroundColor: theme.card, borderColor: theme.border },
            ]}
          >
            {stats.categoryBreakdown.map((cat, idx) => (
              <View
                key={cat.categoryId}
                style={[
                  styles.breakdownRow,
                  idx !== stats.categoryBreakdown.length - 1 && {
                    borderBottomWidth: 1,
                    borderBottomColor: theme.border,
                  },
                ]}
              >
                <View style={[styles.catIconBox, { backgroundColor: `${cat.categoryColor}20` }]}>
                  <Ionicons name={cat.categoryIcon as any} size={20} color={cat.categoryColor} />
                </View>

                <View style={styles.catInfo}>
                  <View style={styles.catNameRow}>
                    <Text style={[styles.catName, { color: theme.text }]}>
                      {getLocalizedCategoryName(cat.categoryName, language)}
                    </Text>
                    <Text style={[styles.catAmount, { color: theme.text }]}>
                      {formatRupiah(cat.amount)}
                    </Text>
                  </View>

                  <View style={styles.progressRow}>
                    <View
                      style={[styles.catProgressBg, { backgroundColor: theme.background }]}
                    >
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
                    <Text style={[styles.catPercentText, { color: theme.textSecondary }]}>
                      {formatPercent(cat.percentage)}
                    </Text>
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
  },
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 40,
  },
  themeToggleBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  budgetCard: {
    marginHorizontal: 16,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    marginBottom: 16,
  },
  budgetCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  budgetCardTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  budgetCardSub: {
    fontSize: 12,
    marginTop: 2,
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  budgetMetricsRow: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
  },
  metricBox: {
    flex: 1,
    alignItems: 'center',
  },
  metricDivider: {
    width: 1,
  },
  metricLabel: {
    fontSize: 11,
    marginBottom: 4,
  },
  metricVal: {
    fontSize: 14,
    fontWeight: '800',
  },
  sectionMargin: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
  sectionHeader: {
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  breakdownCard: {
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  catIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
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
  },
  catAmount: {
    fontSize: 13,
    fontWeight: '700',
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  catProgressBg: {
    flex: 1,
    height: 6,
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
    width: 34,
    textAlign: 'right',
  },
});
