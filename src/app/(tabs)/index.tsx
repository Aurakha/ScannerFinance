import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
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
import { useThemeStore } from '@/store/themeStore';
import { useLanguageStore } from '@/store/languageStore';
import { useCashAdvanceStore } from '@/store/cashAdvanceStore';
import { formatPercent, formatRupiah } from '@/utils/formatters';

export default function DashboardScreen() {
  const router = useRouter();
  const { user, isDemoMode, impersonatingUser, exitImpersonation } = useAuthStore();
  const { transactions, stats, loadData, setBudgetLimit } = useTransactionStore();
  const {
    cashAdvances,
    activeCashAdvanceId,
    setActiveCashAdvanceId,
    getActiveCashAdvance,
    loadCashAdvances,
  } = useCashAdvanceStore();
  const { theme, mode, toggleTheme } = useThemeStore();
  const { t, language } = useLanguageStore();

  useEffect(() => {
    loadData(user?.id);
    loadCashAdvances(user?.id);
  }, [user]);

  const activeCA = getActiveCashAdvance();

  // Sinkronisasi batas anggaran (budget limit) dengan plafon Cash Advance aktif
  useEffect(() => {
    if (activeCA?.initial_amount && stats.budgetLimit !== activeCA.initial_amount) {
      setBudgetLimit(activeCA.initial_amount);
    }
  }, [activeCA?.initial_amount, stats.budgetLimit, setBudgetLimit]);

  const handleReturnToAdmin = () => {
    exitImpersonation();
    router.push('/admin' as any);
  };

  const recentTransactions = transactions.slice(0, 5);

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Admin Impersonation Notice Banner */}
        {impersonatingUser && (
          <View style={styles.impersonationBanner}>
            <View style={styles.impersonationLeft}>
              <Ionicons name="shield-checkmark" size={16} color="#FFFFFF" />
              <Text style={styles.impersonationText}>
                {t('header.adminModeNotice', { name: user?.full_name || '' })}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.impersonationExitBtn}
              onPress={handleReturnToAdmin}
            >
              <Text style={styles.impersonationExitBtnText}>{t('header.backToAdmin')}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Header */}
        <Header
          title={t('header.greeting', {
            name: isDemoMode || !user?.full_name ? 'Guest' : (user.full_name.split(' ')[0] || 'Guest'),
          })}
          subtitle={user?.company_name || t('header.defaultSubtitle')}
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

        {/* Multi-Cash Advance Switcher & Status Card */}
        <View
          style={[
            styles.heroCard,
            {
              backgroundColor: theme.card,
              borderColor: 'rgba(88, 101, 242, 0.3)',
              marginBottom: 16,
            },
          ]}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, minWidth: 180 }}>
              <Ionicons name="wallet-outline" size={18} color={Palette.primary} />
              <Text style={{ fontSize: 13, fontWeight: '700', color: theme.text }}>
                {language === 'id' ? 'Tanggungan Cash Advance Proyek' : 'Project Cash Advance'}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => router.push('/(tabs)/analytics')}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 'auto' }}
            >
              <Text style={{ fontSize: 11, fontWeight: '600', color: Palette.primary }}>
                {language === 'id' ? 'Kelola di Menu Input ➔' : 'Manage in Input ➔'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Horizontal Cash Advance Switcher Pills */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {cashAdvances.map((ca) => {
                const isSelected = ca.id === activeCashAdvanceId;
                return (
                  <TouchableOpacity
                    key={ca.id}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 6,
                      backgroundColor: isSelected ? Palette.primary : theme.cardHover,
                      borderColor: isSelected ? Palette.primary : theme.border,
                      borderWidth: 1,
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      borderRadius: 12,
                    }}
                    onPress={() => setActiveCashAdvanceId(ca.id)}
                    activeOpacity={0.8}
                  >
                    <Ionicons
                      name={isSelected ? 'checkmark-circle' : 'briefcase-outline'}
                      size={14}
                      color={isSelected ? '#FFFFFF' : theme.textSecondary}
                    />
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: '700',
                        color: isSelected ? '#FFFFFF' : theme.text,
                      }}
                    >
                      {ca.project_name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>

          {/* Selected Cash Advance Details */}
          {activeCA ? (
            <View style={{ backgroundColor: theme.background, borderRadius: 12, padding: 12, gap: 8 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
                <View style={{ flex: 1, minWidth: 130 }}>
                  <Text style={{ fontSize: 11, color: theme.textSecondary }}>
                    {language === 'id' ? 'Plafon Awal Proyek' : 'Initial Budget'}
                  </Text>
                  <Text style={{ fontSize: 18, fontWeight: '800', color: theme.text }}>
                    {formatRupiah(activeCA.initial_amount)}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end', minWidth: 130 }}>
                  <Text style={{ fontSize: 11, color: theme.textSecondary }}>
                    {language === 'id' ? 'Sisa Saldo Klaim' : 'Remaining Balance'}
                  </Text>
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: '800',
                      color:
                        activeCA.initial_amount - stats.totalExpense < 0
                          ? Palette.coral
                          : Palette.greenOnline,
                    }}
                  >
                    {formatRupiah(activeCA.initial_amount - stats.totalExpense)}
                  </Text>
                </View>
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <Text style={{ fontSize: 11, color: theme.textMuted }}>
                  📍 {activeCA.city} • Pemeriksa: {activeCA.verifier_name} • Penyetuju: {activeCA.approver_name}
                </Text>
              </View>

              {/* Kolaborator List */}
              {activeCA.collaborators.length > 0 && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', paddingTop: 6, borderTopWidth: 1, borderTopColor: theme.border }}>
                  <Text style={{ fontSize: 11, fontWeight: '600', color: theme.textSecondary }}>
                    👥 Kolaborator:
                  </Text>
                  {activeCA.collaborators.map((collab, idx) => (
                    <View
                      key={`${collab}-${idx}`}
                      style={{
                        backgroundColor: 'rgba(88, 101, 242, 0.1)',
                        paddingHorizontal: 8,
                        paddingVertical: 2,
                        borderRadius: 6,
                      }}
                    >
                      <Text style={{ fontSize: 10, fontWeight: '600', color: Palette.primary }}>
                        {collab}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          ) : null}
        </View>

        {/* Discord Hero Financial Overview */}
        <View
          style={[
            styles.heroCard,
            {
              backgroundColor: theme.card,
              borderColor: mode === 'dark' ? 'rgba(88, 101, 242, 0.25)' : 'rgba(88, 101, 242, 0.4)',
            },
          ]}
        >
          <View style={styles.heroHeader}>
            <Text style={[styles.heroLabel, { color: theme.textSecondary }]}>
              {t('dashboard.totalRecordedExpenses')}
            </Text>
            <View style={[styles.badgeMonth, { backgroundColor: theme.cardHover }]}>
              <Text style={[styles.badgeMonthText, { color: theme.text }]}>
                {t('common.active')}
              </Text>
            </View>
          </View>

          <Text style={[styles.heroAmount, { color: theme.text }]}>
            {formatRupiah(stats.totalExpense)}
          </Text>

          {/* Budget Limit Progress Bar */}
          <View style={styles.budgetProgressContainer}>
            <View style={styles.budgetLabels}>
              <Text style={[styles.budgetSubText, { color: theme.textSecondary }]}>
                {t('dashboard.budgetUsed', {
                  used: formatPercent(stats.budgetUsedPercentage),
                  limit: formatRupiah(activeCA?.initial_amount || stats.budgetLimit),
                })}
              </Text>
              <Text
                style={[
                  styles.budgetRemainingText,
                  { color: stats.balance < 0 ? Palette.coral : Palette.primaryLight },
                ]}
              >
                {t('dashboard.budgetRemaining', {
                  remaining: formatRupiah(stats.balance),
                })}
              </Text>
            </View>

            <View style={[styles.progressBarBg, { backgroundColor: theme.cardHover }]}>
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
              title={t('dashboard.dailyAverage')}
              amount={stats.dailyAverage}
              icon="calendar-outline"
              color={Palette.primary}
              badgeText={t('dashboard.dailyBadge')}
              badgeType="info"
            />
          </View>
          <View style={{ flex: 1 }}>
            <StatCard
              title={t('dashboard.receiptsScanned')}
              amount={stats.receiptCount}
              isCount
              icon="document-text-outline"
              color={Palette.amber}
              subtitle={t('dashboard.receiptsSaved')}
              badgeText={t('dashboard.aiVisionBadge')}
              badgeType="warning"
            />
          </View>
        </View>

        {/* Quick Scan CTA Card */}
        <TouchableOpacity
          style={[
            styles.quickScanCard,
            {
              backgroundColor:
                mode === 'dark' ? 'rgba(88, 101, 242, 0.12)' : 'rgba(88, 101, 242, 0.08)',
              borderColor: 'rgba(88, 101, 242, 0.3)',
            },
          ]}
          onPress={() => router.push('/(tabs)/scanner')}
          activeOpacity={0.85}
        >
          <View style={styles.quickScanLeft}>
            <View style={styles.quickScanIcon}>
              <Ionicons name="camera" size={24} color="#FFFFFF" />
            </View>
            <View>
              <Text style={[styles.quickScanTitle, { color: theme.text }]}>
                {t('dashboard.quickScanTitle')}
              </Text>
              <Text style={[styles.quickScanSubtitle, { color: theme.textSecondary }]}>
                {t('dashboard.quickScanSubtitle')}
              </Text>
            </View>
          </View>

          <Ionicons name="chevron-forward" size={22} color={theme.textSecondary} />
        </TouchableOpacity>

        {/* Expense Category Donut Chart */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            {t('dashboard.expenseDistribution')}
          </Text>
          <TouchableOpacity onPress={() => router.push('/(tabs)/analytics')}>
            <Text style={styles.seeAllText}>{t('dashboard.analyticsDetail')}</Text>
          </TouchableOpacity>
        </View>

        <CategoryPieChart
          data={stats.categoryBreakdown}
          totalAmount={stats.totalExpense}
        />

        {/* Recent Transactions List */}
        <View style={[styles.sectionHeader, { marginTop: 24 }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            {t('dashboard.recentTransactions')}
          </Text>
          <TouchableOpacity onPress={() => router.push('/(tabs)/transactions')}>
            <Text style={styles.seeAllText}>{t('common.seeAll')}</Text>
          </TouchableOpacity>
        </View>

        {recentTransactions.length === 0 ? (
          <View
            style={[
              styles.emptyCard,
              { backgroundColor: theme.card, borderColor: theme.border },
            ]}
          >
            <Ionicons name="receipt-outline" size={40} color={theme.textMuted} />
            <Text style={[styles.emptyTitle, { color: theme.text }]}>
              {t('dashboard.noTransactions')}
            </Text>
            <Text style={[styles.emptySubtitle, { color: theme.textMuted }]}>
              {t('dashboard.noTransactionsDesc')}
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
  impersonationBanner: {
    backgroundColor: Palette.amberIdle,
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  impersonationLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  impersonationText: {
    color: '#000000',
    fontSize: 12,
    fontWeight: '700',
    flex: 1,
  },
  impersonationExitBtn: {
    backgroundColor: '#000000',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  impersonationExitBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  heroCard: {
    marginHorizontal: 16,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    shadowColor: Palette.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 6,
    marginBottom: 14,
  },
  heroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  heroLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  badgeMonth: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeMonthText: {
    fontSize: 11,
    fontWeight: '700',
  },
  heroAmount: {
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: -1,
    marginBottom: 14,
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
  },
  budgetRemainingText: {
    fontSize: 12,
    fontWeight: '700',
  },
  progressBarBg: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  statsGrid: {
    flexDirection: 'row',
    marginHorizontal: 16,
    gap: 12,
    marginBottom: 14,
  },
  quickScanCard: {
    marginHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    marginBottom: 18,
  },
  quickScanLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  quickScanIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Palette.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickScanTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  quickScanSubtitle: {
    fontSize: 11,
    marginTop: 2,
    paddingRight: 10,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  seeAllText: {
    fontSize: 13,
    color: Palette.primaryLight,
    fontWeight: '600',
  },
  emptyCard: {
    marginHorizontal: 16,
    borderRadius: 18,
    padding: 26,
    alignItems: 'center',
    borderWidth: 1,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginTop: 10,
  },
  emptySubtitle: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
  },
});
