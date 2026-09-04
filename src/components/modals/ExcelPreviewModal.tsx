import React, { useState, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Platform,
  SafeAreaView,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Transaction, UserProfile } from '@/types';
import { Palette } from '@/constants/theme';
import { useThemeStore } from '@/store/themeStore';
import { useLanguageStore } from '@/store/languageStore';
import {
  MonthExpenseGroup,
  generateCompanyExpenseReportXLS,
  exportExcelReport,
  exportMultiSheetExcelReport,
  generateReportFileName,
} from '@/utils/exportReport';
import { useCashAdvanceStore } from '@/store/cashAdvanceStore';
import { formatRupiah } from '@/utils/formatters';

interface ExcelPreviewModalProps {
  visible: boolean;
  onClose: () => void;
  transactions?: Transaction[];
  monthGroups?: MonthExpenseGroup[];
  user?: UserProfile | null;
  selectedMonth?: string;
  scopeTitle?: string;
}

export const ExcelPreviewModal: React.FC<ExcelPreviewModalProps> = ({
  visible,
  onClose,
  transactions = [],
  monthGroups = [],
  user,
  selectedMonth,
  scopeTitle,
}) => {
  const { theme, mode } = useThemeStore();
  const { t, language } = useLanguageStore();
  const { getActiveCashAdvance } = useCashAdvanceStore();
  const activeCA = getActiveCashAdvance();
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [isDownloading, setIsDownloading] = useState(false);
  const [activeSheetIndex, setActiveSheetIndex] = useState(0);
  const iframeRef = useRef<any>(null);

  // Jika monthGroups diberikan, gunakan sheet yang aktif
  const hasMultipleSheets = monthGroups.length > 1;
  const currentSheetGroup = monthGroups[activeSheetIndex] || (monthGroups.length > 0 ? monthGroups[0] : null);

  const activeTransactions = currentSheetGroup ? currentSheetGroup.transactions : transactions;
  const activeReportDate = currentSheetGroup ? currentSheetGroup.monthLabel : selectedMonth;

  const totalExpense = activeTransactions.reduce(
    (sum, tx) => sum + (Number(tx.total_amount) || 0),
    0
  );

  const allExpenseTotal = useMemo(() => {
    if (hasMultipleSheets) {
      return monthGroups.reduce(
        (sum, g) =>
          sum + g.transactions.reduce((s, tx) => s + (Number(tx.total_amount) || 0), 0),
        0
      );
    }
    return totalExpense;
  }, [hasMultipleSheets, monthGroups, totalExpense]);

  const allTxCount = useMemo(() => {
    if (hasMultipleSheets) {
      return monthGroups.reduce((sum, g) => sum + g.transactions.length, 0);
    }
    return activeTransactions.length;
  }, [hasMultipleSheets, monthGroups, activeTransactions]);

  if (!visible) return null;

  const reportFileName = `${generateReportFileName(user || undefined)}.xlsx`;
  const rawHtml = generateCompanyExpenseReportXLS(
    activeTransactions,
    user || undefined,
    activeReportDate,
    activeCA
  );

  // Extract table markup
  const tableStartIndex = rawHtml.indexOf('<table>');
  const tableEndIndex = rawHtml.lastIndexOf('</table>');
  const tableMarkup =
    tableStartIndex !== -1 && tableEndIndex !== -1
      ? rawHtml.substring(tableStartIndex, tableEndIndex + 8)
      : rawHtml;

  // Wrap html with clean preview styles & print support
  const previewHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${reportFileName}</title>
        <style>
          * { box-sizing: border-box; }
          body {
            background-color: #F8FAFC;
            margin: 0;
            padding: 24px;
            display: flex;
            justify-content: center;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          }
          .sheet-page {
            background: #FFFFFF;
            padding: 28px 32px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
            border-radius: 8px;
            width: 100%;
            max-width: 1050px;
            overflow-x: auto;
          }
          table {
            border-collapse: collapse;
            width: 100%;
            font-size: 11pt;
            color: #1E293B;
          }
          td, th {
            padding: 6px 10px;
            vertical-align: middle;
          }
          .th-header {
            background-color: #F1F5F9;
            border: 1px solid #94A3B8;
            font-weight: 700;
            text-align: center;
          }
          @media print {
            body { background: #FFFFFF; padding: 0; }
            .sheet-page { box-shadow: none; border-radius: 0; padding: 0; max-width: 100%; }
          }
        </style>
      </head>
      <body>
        <div class="sheet-page">
          ${tableMarkup}
        </div>
      </body>
    </html>
  `;

  const handleDownload = () => {
    try {
      setIsDownloading(true);
      if (hasMultipleSheets) {
        exportMultiSheetExcelReport(monthGroups, user || undefined, undefined, activeCA);
      } else {
        exportExcelReport(activeTransactions, user || undefined, undefined, activeCA);
      }
    } finally {
      setTimeout(() => setIsDownloading(false), 600);
    }
  };

  const handlePrint = () => {
    if (Platform.OS === 'web' && iframeRef.current?.contentWindow) {
      try {
        iframeRef.current.contentWindow.focus();
        iframeRef.current.contentWindow.print();
      } catch (err) {
        console.warn('Print preview fallback error:', err);
      }
    }
  };

  const zoomIn = () => setZoomLevel((prev) => Math.min(1.4, Number((prev + 0.1).toFixed(1))));
  const zoomOut = () => setZoomLevel((prev) => Math.max(0.7, Number((prev - 0.1).toFixed(1))));
  const zoomReset = () => setZoomLevel(1);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalBackdrop}>
        <SafeAreaView style={[styles.modalCard, { backgroundColor: theme.card }]}>
          {/* Header Bar */}
          <View style={[styles.headerBar, { borderBottomColor: theme.border }]}>
            <View style={styles.headerLeft}>
              <View style={styles.excelIconBox}>
                <Ionicons name="document-text" size={22} color="#FFFFFF" />
              </View>
              <View>
                <View style={styles.titleRow}>
                  <Text style={[styles.modalTitle, { color: theme.text }]}>
                    {t('transactions.excelPreviewModalTitle')}
                  </Text>
                  <View style={styles.excelPill}>
                    <Text style={styles.excelPillText}>
                      {hasMultipleSheets ? '.XLSX MULTI-SHEET' : '.XLS EXCEL'}
                    </Text>
                  </View>
                </View>
                <Text style={[styles.modalSubtitle, { color: theme.textSecondary }]}>
                  {scopeTitle
                    ? `${scopeTitle} • ${t('transactions.excelPreviewModalSubtitle')}`
                    : t('transactions.excelPreviewModalSubtitle')}
                </Text>
              </View>
            </View>

            {/* Action Buttons */}
            <View style={styles.headerRight}>
              {Platform.OS === 'web' && (
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: theme.cardHover, borderColor: theme.border }]}
                  onPress={handlePrint}
                  activeOpacity={0.7}
                >
                  <Ionicons name="print-outline" size={16} color={theme.text} />
                  <Text style={[styles.actionBtnText, { color: theme.text }]}>
                    {t('transactions.printReport')}
                  </Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[styles.downloadBtn, isDownloading && { opacity: 0.6 }]}
                onPress={handleDownload}
                disabled={isDownloading}
                activeOpacity={0.85}
              >
                {isDownloading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="download" size={16} color="#FFFFFF" />
                    <Text style={styles.downloadBtnText}>
                      {hasMultipleSheets
                        ? `${t('transactions.downloadNow')} (${monthGroups.length} Sheets)`
                        : t('transactions.downloadNow')}
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.closeBtn, { backgroundColor: theme.cardHover }]}
                onPress={onClose}
                activeOpacity={0.7}
              >
                <Ionicons name="close" size={20} color={theme.text} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Tab Selector Sheet jika Multi-Sheet */}
          {hasMultipleSheets && (
            <View style={[styles.multiSheetTabBar, { backgroundColor: theme.background, borderBottomColor: theme.border }]}>
              <View style={styles.sheetTabNotice}>
                <Ionicons name="folder-open-outline" size={14} color="#107C41" />
                <Text style={[styles.sheetTabNoticeText, { color: theme.textSecondary }]}>
                  {language === 'id'
                    ? `Pilih Sheet (${activeSheetIndex + 1} dari ${monthGroups.length} bulan):`
                    : `Select Sheet (${activeSheetIndex + 1} of ${monthGroups.length} months):`}
                </Text>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.multiSheetTabsScroll}
              >
                {monthGroups.map((group, idx) => {
                  const isCur = idx === activeSheetIndex;
                  return (
                    <TouchableOpacity
                      key={group.monthKey}
                      style={[
                        styles.sheetTabBtn,
                        { backgroundColor: theme.card, borderColor: theme.border },
                        isCur && styles.sheetTabBtnActive,
                      ]}
                      onPress={() => setActiveSheetIndex(idx)}
                      activeOpacity={0.8}
                    >
                      <Ionicons
                        name={isCur ? 'document-text' : 'document-outline'}
                        size={13}
                        color={isCur ? '#FFFFFF' : '#107C41'}
                      />
                      <Text
                        style={[
                          styles.sheetTabBtnText,
                          { color: theme.text },
                          isCur && styles.sheetTabBtnTextActive,
                        ]}
                      >
                        {group.monthLabel}
                      </Text>
                      <View
                        style={[
                          styles.sheetCountPill,
                          isCur && styles.sheetCountPillActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.sheetCountPillText,
                            isCur && styles.sheetCountPillTextActive,
                          ]}
                        >
                          {group.transactions.length}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {/* Sub-toolbar (Stats & Zoom controls) */}
          <View style={[styles.subToolbar, { backgroundColor: theme.background, borderBottomColor: theme.border }]}>
            <View style={styles.statBadgesRow}>
              {hasMultipleSheets && (
                <View style={[styles.infoBadge, { backgroundColor: '#107C41' }]}>
                  <Ionicons name="layers" size={13} color="#FFFFFF" />
                  <Text style={[styles.infoBadgeText, { color: '#FFFFFF', fontWeight: '800' }]}>
                    {monthGroups.length} Sheets (1/Bulan)
                  </Text>
                </View>
              )}

              <View style={[styles.infoBadge, { backgroundColor: theme.card }]}>
                <Ionicons name="receipt-outline" size={14} color={Palette.primary} />
                <Text style={[styles.infoBadgeText, { color: theme.text }]}>
                  {hasMultipleSheets
                    ? `${activeTransactions.length} Transaksi (Sheet ${activeSheetIndex + 1})`
                    : `${activeTransactions.length} Transaksi`}
                </Text>
              </View>

              <View style={[styles.infoBadge, { backgroundColor: theme.card }]}>
                <Ionicons name="wallet-outline" size={14} color={Palette.greenOnline} />
                <Text style={[styles.infoBadgeText, { color: theme.text }]}>
                  {hasMultipleSheets
                    ? `Sheet Ini: ${formatRupiah(totalExpense)}`
                    : `Total: ${formatRupiah(totalExpense)}`}
                </Text>
              </View>

              <View style={[styles.infoBadge, { backgroundColor: theme.card }]}>
                <Ionicons name="business-outline" size={14} color={Palette.amber} />
                <Text style={[styles.infoBadgeText, { color: theme.text }]} numberOfLines={1}>
                  {user?.company_name || 'PT. San Kawan Abadi'}
                </Text>
              </View>
            </View>

            {/* Zoom Controls (Web) */}
            {Platform.OS === 'web' && (
              <View style={styles.zoomContainer}>
                <TouchableOpacity
                  style={[styles.zoomBtn, { backgroundColor: theme.card }]}
                  onPress={zoomOut}
                  disabled={zoomLevel <= 0.7}
                >
                  <Ionicons name="remove" size={16} color={theme.text} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.zoomLevelBtn, { backgroundColor: theme.card }]}
                  onPress={zoomReset}
                >
                  <Text style={[styles.zoomLevelText, { color: theme.text }]}>
                    {Math.round(zoomLevel * 100)}%
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.zoomBtn, { backgroundColor: theme.card }]}
                  onPress={zoomIn}
                  disabled={zoomLevel >= 1.4}
                >
                  <Ionicons name="add" size={16} color={theme.text} />
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Spreadsheet Sheet Content */}
          <View style={styles.previewContentArea}>
            {Platform.OS === 'web' ? (
              <View style={styles.iframeWrapper}>
                <iframe
                  ref={iframeRef}
                  srcDoc={previewHtml}
                  title="Excel Preview"
                  style={{
                    width: '100%',
                    height: '100%',
                    border: 'none',
                    transform: `scale(${zoomLevel})`,
                    transformOrigin: 'top center',
                    transition: 'transform 0.15s ease-out',
                  }}
                />
              </View>
            ) : (
              <ScrollView
                horizontal
                style={styles.mobileScrollContainer}
                contentContainerStyle={styles.mobileScrollInner}
              >
                <ScrollView style={{ flex: 1 }}>
                  <Text style={[styles.mobileFallbackNotice, { color: theme.textMuted }]}>
                    {t('transactions.excelPreviewModalSubtitle')}
                  </Text>
                </ScrollView>
              </ScrollView>
            )}
          </View>

          {/* Excel Status Bar / Bottom Tab */}
          <View style={[styles.footerStatusBar, { backgroundColor: theme.background, borderTopColor: theme.border }]}>
            <View style={styles.sheetTabBadge}>
              <Ionicons name="grid-outline" size={13} color="#107C41" />
              <Text style={styles.sheetTabText}>Expense Report</Text>
            </View>
            <Text style={[styles.statusHintText, { color: theme.textMuted }]}>
              {language === 'id'
                ? 'Formula otomatis SUM aktif • Siap dicetak & diverifikasi'
                : 'Live SUM formula calculation • Ready for export & verification'}
            </Text>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Platform.OS === 'web' ? 20 : 0,
  },
  modalCard: {
    width: '100%',
    height: '100%',
    maxWidth: 1140,
    maxHeight: 880,
    borderRadius: Platform.OS === 'web' ? 16 : 0,
    overflow: 'hidden',
    flexDirection: 'column',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 20,
  },
  headerBar: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  excelIconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#107C41',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#107C41',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 4,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  excelPill: {
    backgroundColor: 'rgba(16, 124, 65, 0.15)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(16, 124, 65, 0.3)',
  },
  excelPillText: {
    color: '#107C41',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  modalSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  downloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#107C41',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    shadowColor: '#107C41',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  downloadBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 4,
  },
  subToolbar: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  statBadgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  infoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  infoBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  zoomContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  zoomBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  zoomLevelBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  zoomLevelText: {
    fontSize: 11,
    fontWeight: '700',
  },
  previewContentArea: {
    flex: 1,
    backgroundColor: '#0F172A',
    overflow: 'hidden',
  },
  iframeWrapper: {
    width: '100%',
    height: '100%',
    backgroundColor: '#0B0F19',
  },
  mobileScrollContainer: {
    flex: 1,
    padding: 16,
  },
  mobileScrollInner: {
    paddingBottom: 24,
  },
  mobileFallbackNotice: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 40,
  },
  footerStatusBar: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderTopWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sheetTabBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(16, 124, 65, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(16, 124, 65, 0.25)',
  },
  sheetTabText: {
    color: '#107C41',
    fontSize: 11,
    fontWeight: '700',
  },
  statusHintText: {
    fontSize: 11,
  },
  multiSheetTabBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    gap: 12,
  },
  sheetTabNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  sheetTabNoticeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  multiSheetTabsScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingRight: 16,
  },
  sheetTabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1.5,
  },
  sheetTabBtnActive: {
    backgroundColor: '#107C41',
    borderColor: '#107C41',
    shadowColor: '#107C41',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  sheetTabBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  sheetTabBtnTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  sheetCountPill: {
    backgroundColor: 'rgba(16, 124, 65, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
  },
  sheetCountPillActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  sheetCountPillText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#107C41',
  },
  sheetCountPillTextActive: {
    color: '#FFFFFF',
  },
});
