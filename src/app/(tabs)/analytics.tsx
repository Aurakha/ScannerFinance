import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  TextInput,
  Modal,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Header } from '@/components/common/Header';
import { CategoryPieChart } from '@/components/charts/CategoryPieChart';
import { SpendingBarChart } from '@/components/charts/SpendingBarChart';
import { Palette } from '@/constants/theme';
import { useTransactionStore } from '@/store/transactionStore';
import { useCashAdvanceStore } from '@/store/cashAdvanceStore';
import { useAuthStore } from '@/store/authStore';
import { useThemeStore } from '@/store/themeStore';
import { useLanguageStore } from '@/store/languageStore';
import { getLocalizedCategoryName, translations } from '@/i18n/translations';
import { formatPercent, formatRupiah } from '@/utils/formatters';
import { CashAdvance, UserProfile } from '@/types';

export default function InputScreen() {
  const { user, getAllUsers } = useAuthStore();
  const { stats, transactions, setBudgetLimit } = useTransactionStore();
  const {
    cashAdvances,
    activeCashAdvanceId,
    loadCashAdvances,
    createCashAdvance,
    updateCashAdvance,
    deleteCashAdvance,
    setActiveCashAdvanceId,
    getActiveCashAdvance,
  } = useCashAdvanceStore();

  const { theme, mode, toggleTheme } = useThemeStore();
  const { t, language } = useLanguageStore();

  // Mode Sub-Tab: 'cash_advance' (Kelola Cash Advance & Proyek) atau 'statistics' (Statistik & Pengeluaran)
  const [activeSubTab, setActiveSubTab] = useState<'cash_advance' | 'statistics'>('cash_advance');

  // Daftar Pengguna Terdaftar untuk Pilihan Kolaborator
  const [availableUsers, setAvailableUsers] = useState<UserProfile[]>([]);

  // State Modal Tambah / Ubah Cash Advance
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [projectName, setProjectName] = useState('');
  const [initialAmount, setInitialAmount] = useState('');
  const [city, setCity] = useState('');
  const [verifierName, setVerifierName] = useState('');
  const [approverName, setApproverName] = useState('');
  const [collaborators, setCollaborators] = useState<string[]>([]);
  const [collaboratorInput, setCollaboratorInput] = useState('');
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState('');

  useEffect(() => {
    loadCashAdvances(user?.id);
    getAllUsers().then((users) => {
      if (users && users.length > 0) {
        setAvailableUsers(users);
      }
    });
  }, [user]);

  const activeCA = getActiveCashAdvance();

  // Sinkronisasi batas anggaran (budget limit) dengan plafon Cash Advance aktif
  useEffect(() => {
    if (activeCA?.initial_amount && stats.budgetLimit !== activeCA.initial_amount) {
      setBudgetLimit(activeCA.initial_amount);
    }
  }, [activeCA?.initial_amount, stats.budgetLimit, setBudgetLimit]);

  // Buka Modal Tambah Baru
  const handleOpenCreateModal = () => {
    setEditingId(null);
    setProjectName('');
    setInitialAmount(new Intl.NumberFormat('id-ID').format(7000000));
    setCity(user?.city || 'Jakarta');
    setVerifierName(user?.verifier_name || 'Yunitha');
    setApproverName(user?.approver_name || 'Dwi Hartanto');
    setCollaborators([]);
    setCollaboratorInput('');
    setNotes('');
    setFormError('');
    setIsModalOpen(true);
  };

  // Buka Modal Edit
  const handleOpenEditModal = (ca: CashAdvance) => {
    setEditingId(ca.id);
    setProjectName(ca.project_name);
    setInitialAmount(new Intl.NumberFormat('id-ID').format(ca.initial_amount));
    setCity(ca.city);
    setVerifierName(ca.verifier_name);
    setApproverName(ca.approver_name);
    setCollaborators([...ca.collaborators]);
    setCollaboratorInput('');
    setNotes(ca.notes || '');
    setFormError('');
    setIsModalOpen(true);
  };

  // Format angka uang secara dinamis di input (hanya tampilan front-end)
  const handleAmountChange = (rawText: string) => {
    const digitsOnly = rawText.replace(/[^0-9]/g, '');
    if (!digitsOnly) {
      setInitialAmount('');
      return;
    }
    const formatted = new Intl.NumberFormat('id-ID').format(Number(digitsOnly));
    setInitialAmount(formatted);
    if (formError) setFormError('');
  };

  // Tambah Kolaborator
  const handleAddCollaborator = (customEmail?: string) => {
    const target = (typeof customEmail === 'string' ? customEmail : collaboratorInput).trim();
    if (!target) return;
    if (collaborators.includes(target)) {
      setCollaboratorInput('');
      return;
    }
    setCollaborators([...collaborators, target]);
    setCollaboratorInput('');
  };

  // Hapus Kolaborator
  const handleRemoveCollaborator = (target: string) => {
    setCollaborators(collaborators.filter((c) => c !== target));
  };

  // Simpan Cash Advance
  const handleSaveCashAdvance = async () => {
    if (!projectName.trim()) {
      setFormError(language === 'id' ? 'Nama Project / Lokasi Penugasan wajib diisi.' : 'Project Name is required.');
      return;
    }
    const parsedAmount = parseFloat(initialAmount.replace(/[^0-9]/g, '')) || 0;
    if (parsedAmount <= 0) {
      setFormError(language === 'id' ? 'Nominal Cash Advance harus lebih dari 0.' : 'Cash Advance amount must be > 0.');
      return;
    }

    setFormError('');
    if (editingId) {
      await updateCashAdvance(editingId, {
        project_name: projectName.trim(),
        initial_amount: parsedAmount,
        city: city.trim() || 'Jakarta',
        verifier_name: verifierName.trim() || 'Pemeriksa',
        approver_name: approverName.trim() || 'Penyetuju',
        collaborators,
        notes: notes.trim(),
      });
    } else {
      await createCashAdvance(
        {
          project_name: projectName.trim(),
          initial_amount: parsedAmount,
          city: city.trim() || 'Jakarta',
          verifier_name: verifierName.trim() || 'Pemeriksa',
          approver_name: approverName.trim() || 'Penyetuju',
          collaborators,
          status: 'active',
          notes: notes.trim(),
        },
        user?.id
      );
    }
    setIsModalOpen(false);
  };

  // Hapus Cash Advance
  const handleDeleteCashAdvance = (id: string, name: string) => {
    const confirmMsg = language === 'id'
      ? `Apakah Anda yakin ingin menghapus cash advance "${name}"?`
      : `Are you sure you want to delete cash advance "${name}"?`;

    if (Platform.OS === 'web') {
      if (window.confirm(confirmMsg)) {
        deleteCashAdvance(id);
      }
      return;
    }

    Alert.alert(
      language === 'id' ? 'Hapus Cash Advance' : 'Delete Cash Advance',
      confirmMsg,
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('common.delete'), style: 'destructive', onPress: () => deleteCashAdvance(id) },
      ]
    );
  };

  // Siapkan data pengeluaran 7 hari terakhir untuk sub-tab statistik
  const daysOfWeek = translations[language].months.daysShort;
  const now = new Date();
  const last7Days = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date();
    d.setDate(now.getDate() - (6 - i));
    const dayLabel = daysOfWeek[d.getDay()];
    const dateNumber = d.getDate();

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

  // Filter akun terdaftar yang belum ditambahkan sebagai kolaborator
  const unaddedRegisteredUsers = availableUsers.filter(
    (u) => u.email && !collaborators.includes(u.email)
  );

  // Batasi hanya 3 akun terbaru saat belum mengetik agar tidak ramai
  const recentUserSuggestions = unaddedRegisteredUsers.slice(0, 3);

  // Autocomplete saat mengetik (mulai dari 1 huruf, maks 4 hasil)
  const isTyping = collaboratorInput.trim().length > 0;
  const filteredSuggestions = isTyping
    ? unaddedRegisteredUsers
        .filter(
          (u) =>
            u.email.toLowerCase().includes(collaboratorInput.toLowerCase()) ||
            (u.full_name && u.full_name.toLowerCase().includes(collaboratorInput.toLowerCase()))
        )
        .slice(0, 4)
    : [];

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <Header
          title={language === 'id' ? 'Input & Kelola' : 'Input & Manage'}
          subtitle={
            language === 'id'
              ? 'Kelola cash advance, proyek, kolaborator, & statistik'
              : 'Manage cash advances, projects, collaborators, & analytics'
          }
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

        {/* Sub-Tab Navigation Switcher */}
        <View style={[styles.subTabContainer, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <TouchableOpacity
            style={[
              styles.subTabBtn,
              activeSubTab === 'cash_advance' && {
                backgroundColor: Palette.primary,
              },
            ]}
            onPress={() => setActiveSubTab('cash_advance')}
            activeOpacity={0.8}
          >
            <Ionicons
              name="wallet-outline"
              size={16}
              color={activeSubTab === 'cash_advance' ? '#FFFFFF' : theme.textSecondary}
            />
            <Text
              style={[
                styles.subTabBtnText,
                { color: activeSubTab === 'cash_advance' ? '#FFFFFF' : theme.textSecondary },
              ]}
            >
              {language === 'id' ? 'Cash Advance & Proyek' : 'Cash Advance & Projects'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.subTabBtn,
              activeSubTab === 'statistics' && {
                backgroundColor: Palette.primary,
              },
            ]}
            onPress={() => setActiveSubTab('statistics')}
            activeOpacity={0.8}
          >
            <Ionicons
              name="pie-chart-outline"
              size={16}
              color={activeSubTab === 'statistics' ? '#FFFFFF' : theme.textSecondary}
            />
            <Text
              style={[
                styles.subTabBtnText,
                { color: activeSubTab === 'statistics' ? '#FFFFFF' : theme.textSecondary },
              ]}
            >
              {language === 'id' ? 'Statistik & Pengeluaran' : 'Stats & Expenses'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* TAB 1: KELOLA CASH ADVANCE & PROYEK */}
        {activeSubTab === 'cash_advance' ? (
          <View style={styles.tabContent}>
            {/* Header Action Banner */}
            <View
              style={[
                styles.caBannerCard,
                { backgroundColor: theme.card, borderColor: theme.border },
              ]}
            >
              <View style={styles.caBannerLeft}>
                <View style={styles.caIconWrap}>
                  <Ionicons name="briefcase" size={24} color={Palette.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.caBannerTitle, { color: theme.text }]}>
                    {language === 'id' ? 'Daftar Pengajuan Cash Advance' : 'Cash Advance Applications'}
                  </Text>
                  <Text style={[styles.caBannerSub, { color: theme.textSecondary }]}>
                    {language === 'id'
                      ? 'Tiap akun dapat memiliki lebih dari 1 cash advance untuk tujuan proyek berbeda bersama kolaborator.'
                      : 'You can hold multiple cash advances for different projects with multiple collaborators.'}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.createCABtn}
                onPress={handleOpenCreateModal}
                activeOpacity={0.85}
              >
                <Ionicons name="add-circle-outline" size={18} color="#FFFFFF" />
                <Text style={styles.createCABtnText}>
                  {language === 'id' ? 'Tambah Cash Advance' : 'New Cash Advance'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* List of Cash Advances */}
            <View style={styles.caList}>
              {cashAdvances.map((ca) => {
                const isActive = ca.id === activeCashAdvanceId;
                return (
                  <View
                    key={ca.id}
                    style={[
                      styles.caItemCard,
                      {
                        backgroundColor: theme.card,
                        borderColor: isActive ? Palette.primary : theme.border,
                        borderWidth: isActive ? 1.5 : 1,
                      },
                    ]}
                  >
                    {/* Header Card */}
                    <View style={styles.caItemHeader}>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <Text style={[styles.caProjectTitle, { color: theme.text }]}>
                            {ca.project_name}
                          </Text>
                          {isActive ? (
                            <View style={styles.activePill}>
                              <Ionicons name="checkmark-circle" size={12} color="#FFFFFF" />
                              <Text style={styles.activePillText}>
                                {language === 'id' ? 'Aktif Digunakan' : 'Active'}
                              </Text>
                            </View>
                          ) : (
                            <TouchableOpacity
                              style={styles.setAsActiveBtn}
                              onPress={() => setActiveCashAdvanceId(ca.id)}
                            >
                              <Text style={styles.setAsActiveBtnText}>
                                {language === 'id' ? 'Jadikan Aktif' : 'Set as Active'}
                              </Text>
                            </TouchableOpacity>
                          )}
                        </View>
                        <Text style={[styles.caItemCity, { color: theme.textSecondary }]}>
                          📍 {ca.city || 'Kota belum diisi'}
                        </Text>
                      </View>

                      {/* Action buttons (Edit & Delete) */}
                      <View style={styles.caItemActions}>
                        <TouchableOpacity
                          style={[styles.iconActionBtn, { backgroundColor: theme.cardHover }]}
                          onPress={() => handleOpenEditModal(ca)}
                        >
                          <Ionicons name="pencil-outline" size={16} color={Palette.primary} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.iconActionBtn, { backgroundColor: 'rgba(239, 68, 68, 0.1)' }]}
                          onPress={() => handleDeleteCashAdvance(ca.id, ca.project_name)}
                        >
                          <Ionicons name="trash-outline" size={16} color={Palette.coral} />
                        </TouchableOpacity>
                      </View>
                    </View>

                    {/* Plafon Amount */}
                    <View style={[styles.caAmountBox, { backgroundColor: theme.background }]}>
                      <Text style={[styles.caAmountLabel, { color: theme.textSecondary }]}>
                        {language === 'id' ? 'Plafon Cash Advance Awal' : 'Initial Cash Advance Amount'}
                      </Text>
                      <Text style={[styles.caAmountValue, { color: Palette.primary }]}>
                        {formatRupiah(ca.initial_amount)}
                      </Text>
                    </View>

                    {/* Metadata: Pemeriksa & Penyetuju */}
                    <View style={styles.caMetaRow}>
                      <View style={styles.caMetaCol}>
                        <Text style={[styles.caMetaLabel, { color: theme.textMuted }]}>
                          {language === 'id' ? 'Pemeriksa:' : 'Verifier:'}
                        </Text>
                        <Text style={[styles.caMetaVal, { color: theme.text }]}>
                          {ca.verifier_name || '-'}
                        </Text>
                      </View>
                      <View style={styles.caMetaCol}>
                        <Text style={[styles.caMetaLabel, { color: theme.textMuted }]}>
                          {language === 'id' ? 'Penyetuju:' : 'Approver:'}
                        </Text>
                        <Text style={[styles.caMetaVal, { color: theme.text }]}>
                          {ca.approver_name || '-'}
                        </Text>
                      </View>
                    </View>

                    {/* Kolaborator Chips */}
                    <View style={styles.collaboratorsWrap}>
                      <Text style={[styles.collabSectionTitle, { color: theme.textSecondary }]}>
                        👥 {language === 'id' ? 'Kolaborator' : 'Collaborators'} ({ca.collaborators.length}):
                      </Text>
                      <View style={styles.collabChipsList}>
                        {ca.collaborators.length > 0 ? (
                          ca.collaborators.map((c, idx) => (
                            <View
                              key={`${c}-${idx}`}
                              style={[
                                styles.collabChip,
                                { backgroundColor: 'rgba(88, 101, 242, 0.1)', borderColor: 'rgba(88, 101, 242, 0.25)' },
                              ]}
                            >
                              <Ionicons name="person-circle" size={14} color={Palette.primary} />
                              <Text style={[styles.collabChipText, { color: Palette.primary }]}>
                                {c}
                              </Text>
                            </View>
                          ))
                        ) : (
                          <Text style={[styles.emptyCollabText, { color: theme.textMuted }]}>
                            {language === 'id'
                              ? 'Belum ada kolaborator ditambahkan'
                              : 'No collaborators added yet'}
                          </Text>
                        )}
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        ) : (
          /* TAB 2: STATISTIK & PENGELUARAN (PRESERVED ALL EXISTING CHARTS) */
          <View style={styles.tabContent}>
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
                    {language === 'id' ? 'Batas: ' : 'Limit: '}{formatRupiah(activeCA?.initial_amount || stats.budgetLimit)}
                  </Text>
                </View>

                <View
                  style={[
                    styles.statusPill,
                    {
                      backgroundColor:
                        stats.budgetUsedPercentage >= 100
                          ? 'rgba(239, 68, 68, 0.15)'
                          : stats.budgetUsedPercentage >= 80
                          ? 'rgba(240, 178, 50, 0.15)'
                          : 'rgba(35, 165, 90, 0.15)',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.statusPillText,
                      {
                        color:
                          stats.budgetUsedPercentage >= 100
                            ? Palette.coral
                            : stats.budgetUsedPercentage >= 80
                            ? Palette.amber
                            : Palette.greenOnline,
                      },
                    ]}
                  >
                    {stats.budgetUsedPercentage >= 100
                      ? t('analytics.budgetHealthDanger')
                      : stats.budgetUsedPercentage >= 80
                      ? t('analytics.budgetHealthWarning')
                      : t('analytics.budgetHealthGood')}
                  </Text>
                </View>
              </View>

              {/* Progress Bar */}
              <View style={[styles.progressBarTrack, { backgroundColor: theme.border }]}>
                <View
                  style={[
                    styles.progressBarFill,
                    {
                      width: `${Math.min(stats.budgetUsedPercentage, 100)}%`,
                      backgroundColor:
                        stats.budgetUsedPercentage >= 100
                          ? Palette.coral
                          : stats.budgetUsedPercentage >= 80
                          ? Palette.amber
                          : Palette.primary,
                    },
                  ]}
                />
              </View>

              <View style={styles.progressMetrics}>
                <Text style={[styles.progressMetricText, { color: theme.textSecondary }]}>
                  {t('dashboard.budgetUsed', {
                    used: formatRupiah(stats.totalExpense),
                    limit: formatRupiah(activeCA?.initial_amount || stats.budgetLimit),
                  })}
                </Text>
                <Text style={[styles.progressPercentage, { color: Palette.primary }]}>
                  {formatPercent(stats.budgetUsedPercentage)}
                </Text>
              </View>
            </View>

            {/* Daily Spending Trend (Last 7 Days) */}
            <View
              style={[
                styles.chartCard,
                { backgroundColor: theme.card, borderColor: theme.border },
              ]}
            >
              <View style={styles.cardHeaderRow}>
                <View>
                  <Text style={[styles.cardTitle, { color: theme.text }]}>
                    {t('analytics.spending7Days')}
                  </Text>
                  <Text style={[styles.cardSubtitle, { color: theme.textSecondary }]}>
                    {t('analytics.dailyAverageLabel')} {formatRupiah(stats.dailyAverage)}
                  </Text>
                </View>

                <View style={[styles.badgeDaily, { backgroundColor: theme.cardHover }]}>
                  <Text style={[styles.badgeDailyText, { color: Palette.primary }]}>
                    {language === 'id' ? '7 Hari Terakhir' : 'Last 7 Days'}
                  </Text>
                </View>
              </View>

              <SpendingBarChart data={last7Days} />
            </View>

            {/* Category Breakdown Pie Chart */}
            <View
              style={[
                styles.chartCard,
                { backgroundColor: theme.card, borderColor: theme.border },
              ]}
            >
              <View style={styles.cardHeaderRow}>
                <View>
                  <Text style={[styles.cardTitle, { color: theme.text }]}>
                    {t('analytics.categoryDistribution')}
                  </Text>
                  <Text style={[styles.cardSubtitle, { color: theme.textSecondary }]}>
                    {language === 'id' ? 'Distribusi pengeluaran berdasarkan kategori pos anggaran' : 'Distribution across expense categories'}
                  </Text>
                </View>
              </View>

              <CategoryPieChart data={stats.categoryBreakdown} totalAmount={stats.totalExpense} />
            </View>

            {/* Category Detail List */}
            <View
              style={[
                styles.chartCard,
                { backgroundColor: theme.card, borderColor: theme.border },
              ]}
            >
              <Text style={[styles.cardTitle, { color: theme.text, marginBottom: 14 }]}>
                {t('analytics.highestCategoryBreakdown')}
              </Text>

              <View style={styles.categoryList}>
                {stats.categoryBreakdown.length > 0 ? (
                  stats.categoryBreakdown.map((cat) => (
                    <View
                      key={cat.categoryId}
                      style={[
                        styles.categoryRow,
                        { borderBottomColor: theme.border },
                      ]}
                    >
                      <View style={styles.categoryInfoLeft}>
                        <View
                          style={[
                            styles.categoryColorDot,
                            { backgroundColor: cat.categoryColor },
                          ]}
                        />
                        <Text style={[styles.categoryNameText, { color: theme.text }]}>
                          {getLocalizedCategoryName(cat.categoryName, language)}
                        </Text>
                      </View>

                      <View style={styles.categoryInfoRight}>
                        <Text style={[styles.categoryAmountText, { color: theme.text }]}>
                          {formatRupiah(cat.amount)}
                        </Text>
                        <Text style={[styles.categoryPercentText, { color: theme.textSecondary }]}>
                          {formatPercent(cat.percentage)}
                        </Text>
                      </View>
                    </View>
                  ))
                ) : (
                  <Text style={[styles.emptyText, { color: theme.textMuted }]}>
                    {t('transactions.noTransactionsFound')}
                  </Text>
                )}
              </View>
            </View>
          </View>
        )}
      </ScrollView>

      {/* MODAL FORM TAMBAH / UBAH CASH ADVANCE */}
      <Modal visible={isModalOpen} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            {/* Header Modal */}
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="wallet-outline" size={20} color={Palette.primary} />
                <Text style={[styles.modalTitle, { color: theme.text }]}>
                  {editingId
                    ? (language === 'id' ? 'Ubah Cash Advance' : 'Edit Cash Advance')
                    : (language === 'id' ? 'Tambah Cash Advance Baru' : 'New Cash Advance')}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setIsModalOpen(false)}>
                <Ionicons name="close" size={22} color={theme.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 520 }}>
              {formError ? (
                <View style={styles.errorBox}>
                  <Ionicons name="alert-circle-outline" size={16} color={Palette.coral} />
                  <Text style={styles.errorText}>{formError}</Text>
                </View>
              ) : null}

              <View style={styles.formGroup}>
                <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>
                  {language === 'id' ? 'Nama Project / Lokasi Penugasan *' : 'Project Name / Duty Location *'}
                </Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
                  value={projectName}
                  onChangeText={(val) => {
                    setProjectName(val);
                    if (formError) setFormError('');
                  }}
                  placeholder="Misal: Tangerang Project / Head Office"
                  placeholderTextColor={theme.textMuted}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>
                  {language === 'id' ? 'Nominal Cash Advance Awal (Rp) *' : 'Initial Cash Advance Amount (Rp) *'}
                </Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
                  value={initialAmount}
                  onChangeText={handleAmountChange}
                  keyboardType="numeric"
                  placeholder="Misal: 7.117.500"
                  placeholderTextColor={theme.textMuted}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>
                  {language === 'id' ? 'Kota Penugasan' : 'City'}
                </Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
                  value={city}
                  onChangeText={setCity}
                  placeholder="Misal: Tangerang / Jakarta"
                  placeholderTextColor={theme.textMuted}
                />
              </View>

              <View style={styles.rowTwoInputs}>
                <View style={[styles.formGroup, { flex: 1 }]}>
                  <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>
                    {language === 'id' ? 'Nama Pemeriksa' : 'Verifier Name'}
                  </Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
                    value={verifierName}
                    onChangeText={setVerifierName}
                    placeholder="Misal: Yunitha"
                    placeholderTextColor={theme.textMuted}
                  />
                </View>

                <View style={[styles.formGroup, { flex: 1 }]}>
                  <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>
                    {language === 'id' ? 'Nama Penyetuju' : 'Approver Name'}
                  </Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
                    value={approverName}
                    onChangeText={setApproverName}
                    placeholder="Misal: Dwi Hartanto"
                    placeholderTextColor={theme.textMuted}
                  />
                </View>
              </View>

              {/* Kolaborator Input */}
              <View style={styles.formGroup}>
                <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>
                  {language === 'id' ? 'Kolaborator (Bisa lebih dari 1 akun)' : 'Collaborators (Multiple accounts)'}
                </Text>
                <View style={styles.addCollabRow}>
                  <TextInput
                    style={[
                      styles.input,
                      { flex: 1, backgroundColor: theme.background, color: theme.text, borderColor: theme.border },
                    ]}
                    value={collaboratorInput}
                    onChangeText={setCollaboratorInput}
                    placeholder="Ketik email / nama kolaborator..."
                    placeholderTextColor={theme.textMuted}
                    onSubmitEditing={() => handleAddCollaborator()}
                  />
                  <TouchableOpacity
                    style={styles.addCollabBtn}
                    onPress={() => handleAddCollaborator()}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="add" size={18} color="#FFFFFF" />
                    <Text style={styles.addCollabBtnText}>
                      {language === 'id' ? 'Tambah' : 'Add'}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Autocomplete Dropdown saat mengetik (hanya muncul saat user mengetik) */}
                {isTyping && (
                  filteredSuggestions.length > 0 ? (
                    <View
                      style={{
                        backgroundColor: theme.card,
                        borderColor: Palette.primary,
                        borderWidth: 1.5,
                        borderRadius: 12,
                        marginTop: 6,
                        overflow: 'hidden',
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: 0.15,
                        shadowRadius: 8,
                        elevation: 4,
                      }}
                    >
                      {filteredSuggestions.map((item) => (
                        <TouchableOpacity
                          key={item.id}
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            paddingHorizontal: 12,
                            paddingVertical: 10,
                            borderBottomWidth: 1,
                            borderBottomColor: theme.border,
                          }}
                          onPress={() => handleAddCollaborator(item.email)}
                        >
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                            <View
                              style={{
                                width: 28,
                                height: 28,
                                borderRadius: 14,
                                backgroundColor: 'rgba(88, 101, 242, 0.12)',
                                justifyContent: 'center',
                                alignItems: 'center',
                              }}
                            >
                              <Ionicons name="person" size={14} color={Palette.primary} />
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={{ fontSize: 13, fontWeight: '700', color: theme.text }}>
                                {item.email}
                              </Text>
                              {item.full_name ? (
                                <Text style={{ fontSize: 11, color: theme.textSecondary }}>
                                  {item.full_name} {item.department ? `• ${item.department}` : ''}
                                </Text>
                              ) : null}
                            </View>
                          </View>
                          <View
                            style={{
                              backgroundColor: 'rgba(88, 101, 242, 0.12)',
                              paddingHorizontal: 10,
                              paddingVertical: 4,
                              borderRadius: 6,
                            }}
                          >
                            <Text style={{ fontSize: 11, fontWeight: '700', color: Palette.primary }}>
                              {language === 'id' ? '+ Tambah' : '+ Add'}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      ))}
                    </View>
                  ) : (
                    <View
                      style={{
                        padding: 8,
                        marginTop: 4,
                        borderRadius: 8,
                        backgroundColor: theme.cardHover,
                      }}
                    >
                      <Text style={{ fontSize: 11, color: theme.textMuted }}>
                        {language === 'id'
                          ? '💡 Email belum terdaftar di sistem. Klik tombol "+ Tambah" di samping untuk tetap menambahkannya.'
                          : '💡 Email not registered yet. Click "+ Add" to add it manually.'}
                      </Text>
                    </View>
                  )
                )}

                {/* Rekomendasi 2-3 Akun Terbaru (Hanya muncul saat belum mengetik agar tidak ramai) */}
                {!isTyping && recentUserSuggestions.length > 0 && (
                  <View style={{ marginTop: 8, gap: 6 }}>
                    <Text style={{ fontSize: 11, fontWeight: '600', color: theme.textMuted }}>
                      {language === 'id'
                        ? '⚡ Saran Akun Terbaru:'
                        : '⚡ Recent Accounts:'}
                    </Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                      {recentUserSuggestions.map((item) => (
                        <TouchableOpacity
                          key={item.id}
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 4,
                            backgroundColor: theme.cardHover,
                            borderColor: theme.border,
                            borderWidth: 1,
                            paddingHorizontal: 8,
                            paddingVertical: 4,
                            borderRadius: 8,
                          }}
                          onPress={() => handleAddCollaborator(item.email)}
                        >
                          <Ionicons name="person-outline" size={12} color={Palette.primary} />
                          <Text style={{ fontSize: 11, fontWeight: '600', color: theme.text }}>
                            {item.email}
                          </Text>
                          <Ionicons name="add" size={12} color={Palette.primary} />
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}

                {/* Chips Kolaborator yang sudah dipilih */}
                <View style={styles.collabChipsWrapper}>
                  {collaborators.map((c, idx) => (
                    <View
                      key={`${c}-${idx}`}
                      style={[
                        styles.chipWithDelete,
                        { backgroundColor: 'rgba(88, 101, 242, 0.12)', borderColor: Palette.primary },
                      ]}
                    >
                      <Text style={[styles.chipText, { color: Palette.primary }]}>{c}</Text>
                      <TouchableOpacity onPress={() => handleRemoveCollaborator(c)}>
                        <Ionicons name="close-circle" size={16} color={Palette.coral} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>
                  {language === 'id' ? 'Catatan Tambahan (Opsional)' : 'Notes (Optional)'}
                </Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Kebutuhan khusus atau info proyek..."
                  placeholderTextColor={theme.textMuted}
                />
              </View>
            </ScrollView>

            {/* Action Buttons */}
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.cancelBtn, { borderColor: theme.border }]}
                onPress={() => setIsModalOpen(false)}
              >
                <Text style={[styles.cancelBtnText, { color: theme.textSecondary }]}>
                  {t('common.cancel')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.submitBtn}
                onPress={handleSaveCashAdvance}
              >
                <Ionicons name="checkmark-circle-outline" size={18} color="#FFFFFF" />
                <Text style={styles.submitBtnText}>
                  {language === 'id' ? 'Simpan Cash Advance' : 'Save Cash Advance'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    paddingHorizontal: 16,
    paddingBottom: 90,
  },
  themeToggleBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  subTabContainer: {
    flexDirection: 'row',
    borderRadius: 16,
    borderWidth: 1,
    padding: 6,
    marginTop: 14,
    marginBottom: 18,
    gap: 8,
  },
  subTabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  subTabBtnText: {
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 16,
    textAlign: 'center',
    flexShrink: 1,
  },
  tabContent: {
    gap: 16,
  },
  caBannerCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 14,
  },
  caBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  caIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(88, 101, 242, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  caBannerTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  caBannerSub: {
    fontSize: 12,
    lineHeight: 16,
  },
  createCABtn: {
    backgroundColor: Palette.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
  },
  createCABtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  caList: {
    gap: 14,
  },
  caItemCard: {
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  caItemHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
    flexWrap: 'wrap',
  },
  caProjectTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  activePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Palette.greenOnline,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  activePillText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  setAsActiveBtn: {
    backgroundColor: 'rgba(88, 101, 242, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  setAsActiveBtnText: {
    color: Palette.primary,
    fontSize: 10,
    fontWeight: '700',
  },
  caItemCity: {
    fontSize: 12,
    marginTop: 2,
  },
  caItemActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginLeft: 'auto',
  },
  iconActionBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  caAmountBox: {
    borderRadius: 12,
    padding: 12,
  },
  caAmountLabel: {
    fontSize: 11,
    fontWeight: '500',
    marginBottom: 2,
  },
  caAmountValue: {
    fontSize: 20,
    fontWeight: '800',
  },
  caMetaRow: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
  },
  caMetaCol: {
    flex: 1,
    flexDirection: 'row',
    gap: 4,
    minWidth: 140,
  },
  caMetaLabel: {
    fontSize: 12,
  },
  caMetaVal: {
    fontSize: 12,
    fontWeight: '600',
  },
  collaboratorsWrap: {
    gap: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(150, 150, 150, 0.1)',
    paddingTop: 10,
  },
  collabSectionTitle: {
    fontSize: 12,
    fontWeight: '600',
  },
  collabChipsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  collabChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  collabChipText: {
    fontSize: 11,
    fontWeight: '600',
  },
  emptyCollabText: {
    fontSize: 11,
    fontStyle: 'italic',
  },
  budgetCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  budgetCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  budgetCardTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  budgetCardSub: {
    fontSize: 12,
    marginTop: 2,
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  progressBarTrack: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressMetrics: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressMetricText: {
    fontSize: 11,
  },
  progressPercentage: {
    fontSize: 12,
    fontWeight: '700',
  },
  chartCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  cardSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  badgeDaily: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeDailyText: {
    fontSize: 11,
    fontWeight: '600',
  },
  categoryList: {
    gap: 8,
  },
  categoryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  categoryInfoLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  categoryColorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  categoryNameText: {
    fontSize: 13,
    fontWeight: '500',
  },
  categoryInfoRight: {
    alignItems: 'flex-end',
  },
  categoryAmountText: {
    fontSize: 13,
    fontWeight: '600',
  },
  categoryPercentText: {
    fontSize: 11,
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 13,
    marginVertical: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 520,
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(242, 63, 67, 0.1)',
    borderColor: Palette.coral,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
  },
  errorText: {
    color: Palette.coral,
    fontSize: 12,
    fontWeight: '500',
  },
  formGroup: {
    gap: 6,
    marginBottom: 12,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 42,
    fontSize: 13,
  },
  rowTwoInputs: {
    flexDirection: 'row',
    gap: 10,
  },
  addCollabRow: {
    flexDirection: 'row',
    gap: 8,
  },
  addCollabBtn: {
    backgroundColor: Palette.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  addCollabBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  collabChipsWrapper: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  chipWithDelete: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  cancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  submitBtn: {
    flex: 2,
    backgroundColor: Palette.primary,
    borderRadius: 12,
    height: 44,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
});
