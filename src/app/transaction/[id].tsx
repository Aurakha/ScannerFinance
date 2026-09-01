import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  Image,
  Linking,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Palette } from '@/constants/theme';
import { useTransactionStore } from '@/store/transactionStore';
import { formatDateOnly, formatFriendlyDate, formatRupiah } from '@/utils/formatters';
import { Badge } from '@/components/common/Badge';

export default function TransactionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { transactions, removeTransaction } = useTransactionStore();

  const transaction = transactions.find((t) => t.id === id);

  if (!transaction) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.notFoundContainer}>
          <Ionicons name="alert-circle-outline" size={54} color={Palette.coral} />
          <Text style={styles.notFoundTitle}>Transaksi Tidak Ditemukan</Text>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.backBtnText}>Kembali</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const category = transaction.category;
  const categoryColor = category?.color || Palette.primary;
  const items = transaction.items || [];
  const isGoogleDriveLink = transaction.receipt_image_url?.includes('drive.google.com');

  const handleDelete = () => {
    Alert.alert(
      'Hapus Transaksi',
      `Yakin ingin menghapus data belanja dari "${transaction.merchant_name}"?`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus',
          style: 'destructive',
          onPress: async () => {
            await removeTransaction(transaction.id);
            router.back();
          },
        },
      ]
    );
  };

  const handleOpenDriveLink = () => {
    if (transaction.receipt_image_url) {
      Linking.openURL(transaction.receipt_image_url);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.headerBar}>
        <TouchableOpacity style={styles.circleBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color={Palette.darkText} />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Rincian Transaksi</Text>

        <TouchableOpacity style={styles.circleBtn} onPress={handleDelete}>
          <Ionicons name="trash-outline" size={20} color={Palette.coral} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Main Card */}
        <View style={styles.mainCard}>
          <View style={[styles.categoryIconCircle, { backgroundColor: `${categoryColor}20` }]}>
            <Ionicons
              name={(category?.icon as any) || 'receipt-outline'}
              size={32}
              color={categoryColor}
            />
          </View>

          <Text style={styles.merchantName}>{transaction.merchant_name}</Text>
          <Text style={styles.totalAmount}>{formatRupiah(transaction.total_amount)}</Text>

          <View style={styles.badgeRow}>
            <Badge
              label={category?.name || 'Lainnya'}
              color={categoryColor}
              icon={(category?.icon as any) || 'pricetag-outline'}
            />
            <Badge
              label={transaction.payment_method.toUpperCase()}
              color={Palette.darkTextSecondary}
              icon="card-outline"
            />
          </View>

          <Text style={styles.dateText}>
            📅 {formatDateOnly(transaction.transaction_date)} (
            {formatFriendlyDate(transaction.transaction_date)})
          </Text>
        </View>

        {/* Receipt Image Preview or Google Drive Link */}
        {transaction.receipt_image_url ? (
          <View style={styles.receiptImageCard}>
            <View style={styles.receiptHeaderRow}>
              <Text style={styles.sectionHeaderTitle}>
                {isGoogleDriveLink ? 'Foto Struk (Google Drive)' : 'Foto Struk'}
              </Text>
              {isGoogleDriveLink && (
                <TouchableOpacity style={styles.driveLinkBtn} onPress={handleOpenDriveLink}>
                  <Ionicons name="logo-google" size={14} color="#3B82F6" />
                  <Text style={styles.driveLinkText}>Buka di Drive ↗</Text>
                </TouchableOpacity>
              )}
            </View>

            {!isGoogleDriveLink ? (
              <Image
                source={{ uri: transaction.receipt_image_url }}
                style={styles.receiptImage}
                resizeMode="cover"
              />
            ) : (
              <TouchableOpacity
                style={styles.drivePreviewBox}
                onPress={handleOpenDriveLink}
                activeOpacity={0.8}
              >
                <Ionicons name="document-attach-outline" size={32} color="#3B82F6" />
                <Text style={styles.driveBoxTitle}>Tersimpan di Google Drive</Text>
                <Text style={styles.driveBoxSub}>Klik untuk membuka foto struk asli</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : null}

        {/* Items Breakdown Table */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionHeaderTitle}>
            Daftar Barang Belanja ({items.length})
          </Text>

          {items.length === 0 ? (
            <Text style={styles.noItemsText}>Tidak ada rincian item terpisah.</Text>
          ) : (
            items.map((it, idx) => (
              <View
                key={idx}
                style={[
                  styles.itemRow,
                  idx !== items.length - 1 && styles.itemRowBorder,
                ]}
              >
                <View style={styles.itemLeft}>
                  <Text style={styles.itemName}>{it.item_name}</Text>
                  <Text style={styles.itemDetail}>
                    {it.quantity} × {formatRupiah(it.unit_price)}
                  </Text>
                </View>

                <Text style={styles.itemTotalPrice}>{formatRupiah(it.total_price)}</Text>
              </View>
            ))
          )}

          {/* Pricing Breakdown Summary */}
          <View style={styles.summaryBox}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Subtotal:</Text>
              <Text style={styles.summaryValue}>
                {formatRupiah(transaction.subtotal || transaction.total_amount)}
              </Text>
            </View>

            {Number(transaction.tax_amount) > 0 && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Pajak:</Text>
                <Text style={styles.summaryValue}>
                  +{formatRupiah(transaction.tax_amount)}
                </Text>
              </View>
            )}

            {Number(transaction.discount_amount) > 0 && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Diskon:</Text>
                <Text style={[styles.summaryValue, { color: Palette.coral }]}>
                  -{formatRupiah(transaction.discount_amount)}
                </Text>
              </View>
            )}

            <View style={[styles.summaryRow, styles.totalSummaryRow]}>
              <Text style={styles.totalSummaryLabel}>Total Dibayar:</Text>
              <Text style={styles.totalSummaryValue}>
                {formatRupiah(transaction.total_amount)}
              </Text>
            </View>
          </View>
        </View>

        {/* Notes Card */}
        {transaction.notes ? (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionHeaderTitle}>Catatan</Text>
            <Text style={styles.notesBody}>{transaction.notes}</Text>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Palette.darkBg,
  },
  headerBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  circleBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Palette.darkCard,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Palette.darkText,
  },
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  mainCard: {
    backgroundColor: Palette.darkCard,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 16,
  },
  categoryIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  merchantName: {
    fontSize: 20,
    fontWeight: '800',
    color: Palette.darkText,
    textAlign: 'center',
    marginBottom: 6,
  },
  totalAmount: {
    fontSize: 28,
    fontWeight: '800',
    color: Palette.primary,
    marginBottom: 12,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  dateText: {
    fontSize: 12,
    color: Palette.darkTextMuted,
  },
  receiptImageCard: {
    backgroundColor: Palette.darkCard,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 16,
  },
  receiptHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  driveLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  driveLinkText: {
    color: '#3B82F6',
    fontSize: 11,
    fontWeight: '700',
  },
  receiptImage: {
    width: '100%',
    height: 180,
    borderRadius: 12,
    marginTop: 6,
  },
  drivePreviewBox: {
    backgroundColor: 'rgba(59, 130, 246, 0.06)',
    borderRadius: 14,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.2)',
    marginTop: 6,
  },
  driveBoxTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Palette.darkText,
    marginTop: 8,
  },
  driveBoxSub: {
    fontSize: 12,
    color: Palette.darkTextSecondary,
    marginTop: 2,
  },
  sectionCard: {
    backgroundColor: Palette.darkCard,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 16,
  },
  sectionHeaderTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Palette.darkText,
  },
  noItemsText: {
    fontSize: 13,
    color: Palette.darkTextMuted,
    fontStyle: 'italic',
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  itemRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  itemLeft: {
    flex: 1,
    marginRight: 10,
  },
  itemName: {
    fontSize: 13,
    fontWeight: '600',
    color: Palette.darkText,
    marginBottom: 2,
  },
  itemDetail: {
    fontSize: 11,
    color: Palette.darkTextMuted,
  },
  itemTotalPrice: {
    fontSize: 13,
    fontWeight: '700',
    color: Palette.darkText,
  },
  summaryBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 14,
    padding: 12,
    marginTop: 14,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  summaryLabel: {
    fontSize: 12,
    color: Palette.darkTextSecondary,
  },
  summaryValue: {
    fontSize: 12,
    fontWeight: '600',
    color: Palette.darkText,
  },
  totalSummaryRow: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    paddingTop: 8,
    marginTop: 4,
    marginBottom: 0,
  },
  totalSummaryLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: Palette.darkText,
  },
  totalSummaryValue: {
    fontSize: 16,
    fontWeight: '800',
    color: Palette.primary,
  },
  notesBody: {
    fontSize: 13,
    color: Palette.darkTextSecondary,
    lineHeight: 18,
  },
  notFoundContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  notFoundTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Palette.darkText,
    marginTop: 14,
    marginBottom: 16,
  },
  backBtn: {
    backgroundColor: Palette.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
  },
  backBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
