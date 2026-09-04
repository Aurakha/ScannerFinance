import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CashAdvance, Transaction, UserProfile } from '@/types';
import { useThemeStore } from '@/store/themeStore';
import { useLanguageStore } from '@/store/languageStore';
import {
  MonthExpenseGroup,
  groupTransactionsByMonth,
  exportMultiSheetExcelReport,
  exportExcelReport,
} from '@/utils/exportReport';
import { useCashAdvanceStore } from '@/store/cashAdvanceStore';
import { formatRupiah } from '@/utils/formatters';

export type ExportScopeMode = 'current' | 'all' | 'custom';

interface ExcelExportOptionsModalProps {
  visible: boolean;
  onClose: () => void;
  transactions: Transaction[];
  user?: UserProfile | null;
  activeCA?: CashAdvance | null;
  currentMonthKey: string;
  onOpenPreview: (groups: MonthExpenseGroup[], scopeTitle: string) => void;
}

export const ExcelExportOptionsModal: React.FC<ExcelExportOptionsModalProps> = ({
  visible,
  onClose,
  transactions,
  user,
  activeCA: propActiveCA,
  currentMonthKey,
  onOpenPreview,
}) => {
  const { theme } = useThemeStore();
  const { language } = useLanguageStore();
  const { getActiveCashAdvance } = useCashAdvanceStore();
  const activeCA = propActiveCA || getActiveCashAdvance();

  const [scopeMode, setScopeMode] = useState<ExportScopeMode>('current');
  const [selectedCustomKeys, setSelectedCustomKeys] = useState<string[]>([]);
  const [isExporting, setIsExporting] = useState(false);

  // Dapatkan seluruh grup bulan yang memiliki transaksi
  const allMonthGroups = useMemo(() => {
    return groupTransactionsByMonth(transactions, undefined, language);
  }, [transactions, language]);

  // Dapatkan daftar key bulan yang tersedia
  const availableMonthKeys = useMemo(() => {
    return allMonthGroups.map((g) => g.monthKey);
  }, [allMonthGroups]);

  // Label bulan aktif saat ini
  const currentMonthGroup = useMemo(() => {
    const found = allMonthGroups.find((g) => g.monthKey === currentMonthKey);
    if (found) return found;

    const filtered = transactions.filter((t) => {
      try {
        const d = new Date(t.transaction_date);
        return (
          `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` ===
          currentMonthKey
        );
      } catch {
        return false;
      }
    });

    return {
      monthKey: currentMonthKey,
      monthLabel: currentMonthKey,
      transactions: filtered,
    };
  }, [allMonthGroups, currentMonthKey, transactions]);

  // Inisialisasi checklist bulan kustom
  React.useEffect(() => {
    if (visible && selectedCustomKeys.length === 0) {
      setSelectedCustomKeys(availableMonthKeys.slice(0, 3));
    }
  }, [visible, availableMonthKeys]);

  if (!visible) return null;

  // Tentukan grup bulan target yang akan diekspor / dipratinjau
  const targetGroups: MonthExpenseGroup[] = (() => {
    if (scopeMode === 'current') {
      return [currentMonthGroup];
    }
    if (scopeMode === 'all') {
      return allMonthGroups.length > 0 ? allMonthGroups : [currentMonthGroup];
    }
    // Mode custom
    const filtered = allMonthGroups.filter((g) =>
      selectedCustomKeys.includes(g.monthKey)
    );
    return filtered.length > 0 ? filtered : [currentMonthGroup];
  })();

  const totalTransactionsCount = targetGroups.reduce(
    (sum, g) => sum + g.transactions.length,
    0
  );
  const totalAmountSum = targetGroups.reduce(
    (sum, g) =>
      sum +
      g.transactions.reduce((s, tx) => s + (Number(tx.total_amount) || 0), 0),
    0
  );

  const toggleMonthCheck = (key: string) => {
    if (selectedCustomKeys.includes(key)) {
      if (selectedCustomKeys.length > 1) {
        setSelectedCustomKeys(selectedCustomKeys.filter((k) => k !== key));
      }
    } else {
      setSelectedCustomKeys([...selectedCustomKeys, key]);
    }
  };

  const handleSelectAll = () => {
    setSelectedCustomKeys(availableMonthKeys);
  };

  const handleClearAll = () => {
    if (availableMonthKeys.length > 0) {
      setSelectedCustomKeys([availableMonthKeys[0]]);
    }
  };

  const handleExecutePreview = () => {
    const title =
      scopeMode === 'current'
        ? currentMonthGroup.monthLabel
        : scopeMode === 'all'
        ? language === 'id'
          ? 'Semua Data (Multi-Sheet)'
          : 'All Data (Multi-Sheet)'
        : language === 'id'
        ? `${targetGroups.length} Bulan Terpilih`
        : `${targetGroups.length} Selected Months`;

    onClose();
    onOpenPreview(targetGroups, title);
  };

  const handleExecuteDownload = () => {
    try {
      setIsExporting(true);
      if (targetGroups.length === 1) {
        exportExcelReport(targetGroups[0].transactions, user || undefined, undefined, activeCA);
      } else {
        exportMultiSheetExcelReport(targetGroups, user || undefined, undefined, activeCA);
      }
      onClose();
    } finally {
      setTimeout(() => setIsExporting(false), 500);
    }
  };

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <SafeAreaView style={styles.centerContainer}>
          <View style={[styles.modalCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            {/* Header */}
            <View style={styles.modalHeader}>
              <View style={styles.headerLeft}>
                <View style={styles.excelIconBox}>
                  <Ionicons name="document-text" size={22} color="#FFFFFF" />
                </View>
                <View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={[styles.modalTitle, { color: theme.text }]}>
                      {language === 'id' ? 'Ekspor Formulir Excel' : 'Export Excel Report'}
                    </Text>
                    <View style={styles.badgeXls}>
                      <Text style={styles.badgeXlsText}>.XLSX</Text>
                    </View>
                  </View>
                  <Text style={[styles.modalSub, { color: theme.textSecondary }]}>
                    {language === 'id'
                      ? 'Format resmi SKA: 1 Sheet = 1 Bulan transaksi'
                      : 'SKA official format: 1 Sheet = 1 Month of expenses'}
                  </Text>
                </View>
              </View>

              <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7}>
                <Ionicons name="close" size={20} color={theme.textMuted} />
              </TouchableOpacity>
            </View>

            {/* Scope Options */}
            <ScrollView style={styles.bodyScroll} showsVerticalScrollIndicator={false}>
              <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>
                {language === 'id' ? 'PILIH CAKUPAN DATA' : 'SELECT DATA SCOPE'}
              </Text>

              {/* Option 1: Current Month */}
              <TouchableOpacity
                style={[
                  styles.optionCard,
                  { backgroundColor: theme.background, borderColor: theme.border },
                  scopeMode === 'current' && styles.optionCardActive,
                ]}
                onPress={() => setScopeMode('current')}
                activeOpacity={0.8}
              >
                <View style={styles.radioOuter}>
                  {scopeMode === 'current' && <View style={styles.radioInner} />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.optionTitle, { color: theme.text }]}>
                    {language === 'id' ? 'Bulan Ini Saja' : 'Current Month Only'} (
                    {currentMonthGroup.monthLabel})
                  </Text>
                  <Text style={[styles.optionDesc, { color: theme.textSecondary }]}>
                    {language === 'id'
                      ? `1 Sheet berisikan ${currentMonthGroup.transactions.length} transaksi di bulan ${currentMonthGroup.monthLabel}`
                      : `1 Sheet containing ${currentMonthGroup.transactions.length} transactions for ${currentMonthGroup.monthLabel}`}
                  </Text>
                </View>
                <View style={styles.sheetPill}>
                  <Text style={styles.sheetPillText}>1 Sheet</Text>
                </View>
              </TouchableOpacity>

              {/* Option 2: All Data (1 Sheet = 1 Month) */}
              <TouchableOpacity
                style={[
                  styles.optionCard,
                  { backgroundColor: theme.background, borderColor: theme.border },
                  scopeMode === 'all' && styles.optionCardActive,
                ]}
                onPress={() => setScopeMode('all')}
                activeOpacity={0.8}
              >
                <View style={styles.radioOuter}>
                  {scopeMode === 'all' && <View style={styles.radioInner} />}
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={[styles.optionTitle, { color: theme.text }]}>
                      {language === 'id' ? 'Semua Data' : 'All Recorded Data'}
                    </Text>
                    <View style={[styles.recomBadge, { backgroundColor: 'rgba(35, 165, 90, 0.15)' }]}>
                      <Text style={[styles.recomBadgeText, { color: '#23A55A' }]}>
                        {language === 'id' ? 'Multi-Sheet' : 'Multi-Sheet'}
                      </Text>
                    </View>
                  </View>
                  <Text style={[styles.optionDesc, { color: theme.textSecondary }]}>
                    {language === 'id'
                      ? `Seluruh transaksi otomatis dipisahkan ke sheet masing-masing (${allMonthGroups.length} bulan = ${allMonthGroups.length} sheet)`
                      : `All transactions automatically divided into separate monthly tabs (${allMonthGroups.length} months = ${allMonthGroups.length} sheets)`}
                  </Text>
                </View>
                <View style={[styles.sheetPill, { backgroundColor: '#107C41' }]}>
                  <Text style={[styles.sheetPillText, { color: '#FFFFFF' }]}>
                    {allMonthGroups.length} Sheets
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Option 3: Custom Selected Months */}
              <TouchableOpacity
                style={[
                  styles.optionCard,
                  { backgroundColor: theme.background, borderColor: theme.border },
                  scopeMode === 'custom' && styles.optionCardActive,
                ]}
                onPress={() => setScopeMode('custom')}
                activeOpacity={0.8}
              >
                <View style={styles.radioOuter}>
                  {scopeMode === 'custom' && <View style={styles.radioInner} />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.optionTitle, { color: theme.text }]}>
                    {language === 'id' ? 'Pilih Bulan Tertentu (Kustom)' : 'Select Custom Months'}
                  </Text>
                  <Text style={[styles.optionDesc, { color: theme.textSecondary }]}>
                    {language === 'id'
                      ? 'Centang bulan mana saja yang ingin disertakan ke file Excel'
                      : 'Choose specific months to include in the exported Excel workbook'}
                  </Text>
                </View>
                <View style={styles.sheetPill}>
                  <Text style={styles.sheetPillText}>
                    {selectedCustomKeys.length} {language === 'id' ? 'Dipilih' : 'Selected'}
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Checklist Bulan jika mode kustom aktif */}
              {scopeMode === 'custom' && (
                <View
                  style={[
                    styles.customChecklistContainer,
                    { backgroundColor: theme.background, borderColor: theme.border },
                  ]}
                >
                  <View style={styles.customChecklistHeader}>
                    <Text style={[styles.customChecklistTitle, { color: theme.textSecondary }]}>
                      {language === 'id' ? 'DAFTAR BULAN TERSEDIA' : 'AVAILABLE MONTHS'}
                    </Text>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <TouchableOpacity onPress={handleSelectAll}>
                        <Text style={styles.actionLink}>
                          {language === 'id' ? 'Pilih Semua' : 'Select All'}
                        </Text>
                      </TouchableOpacity>
                      <Text style={{ color: theme.textMuted }}>•</Text>
                      <TouchableOpacity onPress={handleClearAll}>
                        <Text style={styles.actionLink}>
                          {language === 'id' ? 'Reset' : 'Reset'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={styles.checklistGrid}>
                    {allMonthGroups.map((g) => {
                      const isChecked = selectedCustomKeys.includes(g.monthKey);
                      return (
                        <TouchableOpacity
                          key={g.monthKey}
                          style={[
                            styles.checkItem,
                            { borderColor: theme.border },
                            isChecked && styles.checkItemActive,
                          ]}
                          onPress={() => toggleMonthCheck(g.monthKey)}
                          activeOpacity={0.7}
                        >
                          <Ionicons
                            name={isChecked ? 'checkbox' : 'square-outline'}
                            size={18}
                            color={isChecked ? '#107C41' : theme.textMuted}
                          />
                          <View style={{ flex: 1, marginLeft: 8 }}>
                            <Text
                              style={[
                                styles.checkItemLabel,
                                { color: theme.text },
                                isChecked && { fontWeight: '700', color: '#107C41' },
                              ]}
                            >
                              {g.monthLabel}
                            </Text>
                            <Text style={[styles.checkItemCount, { color: theme.textSecondary }]}>
                              {g.transactions.length} {language === 'id' ? 'transaksi' : 'items'}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}

              {/* Summary Box */}
              <View style={[styles.summaryBox, { backgroundColor: theme.cardHover, borderColor: theme.border }]}>
                <View style={styles.summaryItem}>
                  <Text style={[styles.summaryLabel, { color: theme.textMuted }]}>
                    {language === 'id' ? 'Lembar Sheet:' : 'Total Sheets:'}
                  </Text>
                  <Text style={[styles.summaryValue, { color: theme.text }]}>
                    {targetGroups.length} {language === 'id' ? 'Sheet (1/bulan)' : 'Sheets (1/mo)'}
                  </Text>
                </View>
                <View style={[styles.summaryDivider, { backgroundColor: theme.border }]} />
                <View style={styles.summaryItem}>
                  <Text style={[styles.summaryLabel, { color: theme.textMuted }]}>
                    {language === 'id' ? 'Total Transaksi:' : 'Transactions:'}
                  </Text>
                  <Text style={[styles.summaryValue, { color: theme.text }]}>
                    {totalTransactionsCount} {language === 'id' ? 'item' : 'items'}
                  </Text>
                </View>
                <View style={[styles.summaryDivider, { backgroundColor: theme.border }]} />
                <View style={styles.summaryItem}>
                  <Text style={[styles.summaryLabel, { color: theme.textMuted }]}>
                    {language === 'id' ? 'Total Biaya:' : 'Total Sum:'}
                  </Text>
                  <Text style={[styles.summaryValue, { color: '#107C41', fontWeight: '800' }]}>
                    {formatRupiah(totalAmountSum)}
                  </Text>
                </View>
              </View>
            </ScrollView>

            {/* Footer Buttons */}
            <View style={[styles.modalFooter, { borderTopColor: theme.border }]}>
              <TouchableOpacity
                style={[styles.previewActionBtn, { borderColor: '#107C41' }]}
                onPress={handleExecutePreview}
                activeOpacity={0.8}
              >
                <Ionicons name="eye-outline" size={17} color="#107C41" />
                <Text style={styles.previewActionBtnText}>
                  {language === 'id' ? 'Lihat Pratinjau' : 'Preview Sheets'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.downloadActionBtn}
                onPress={handleExecuteDownload}
                disabled={isExporting}
                activeOpacity={0.85}
              >
                <Ionicons name="download-outline" size={17} color="#FFFFFF" />
                <Text style={styles.downloadActionBtnText}>
                  {isExporting
                    ? language === 'id'
                      ? 'Mengunduh...'
                      : 'Downloading...'
                    : language === 'id'
                    ? 'Unduh File Excel'
                    : 'Download Excel'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  centerContainer: {
    width: '100%',
    maxWidth: 580,
    maxHeight: '90%',
  },
  modalCard: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
    elevation: 10,
    flexDirection: 'column',
    maxHeight: '100%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  excelIconBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#107C41',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#107C41',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  badgeXls: {
    backgroundColor: 'rgba(16, 124, 65, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeXlsText: {
    color: '#107C41',
    fontSize: 10,
    fontWeight: '800',
  },
  modalSub: {
    fontSize: 12,
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 8,
  },
  bodyScroll: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    maxHeight: 460,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    marginBottom: 10,
  },
  optionCardActive: {
    borderColor: '#107C41',
    backgroundColor: 'rgba(16, 124, 65, 0.06)',
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#107C41',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#107C41',
  },
  optionTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  optionDesc: {
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },
  recomBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  recomBadgeText: {
    fontSize: 9,
    fontWeight: '800',
  },
  sheetPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(16, 124, 65, 0.15)',
  },
  sheetPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#107C41',
  },
  customChecklistContainer: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    marginTop: 2,
    marginBottom: 12,
  },
  customChecklistHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  customChecklistTitle: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  actionLink: {
    fontSize: 11,
    fontWeight: '700',
    color: '#107C41',
  },
  checklistGrid: {
    flexDirection: 'column',
    gap: 8,
  },
  checkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  checkItemActive: {
    borderColor: '#107C41',
    backgroundColor: 'rgba(16, 124, 65, 0.08)',
  },
  checkItemLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  checkItemCount: {
    fontSize: 11,
    marginTop: 1,
  },
  summaryBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 6,
    marginBottom: 8,
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 11,
  },
  summaryValue: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  summaryDivider: {
    width: 1,
    height: 24,
  },
  modalFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: 1,
  },
  previewActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  previewActionBtnText: {
    color: '#107C41',
    fontSize: 13,
    fontWeight: '700',
  },
  downloadActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 10,
    backgroundColor: '#107C41',
    shadowColor: '#107C41',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  downloadActionBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
});
