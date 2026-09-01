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
import { formatDateTime, formatFriendlyDate, formatRupiah } from '@/utils/formatters';
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
            🕒 {formatDateTime(transaction.transaction_date)}
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
                <Ionicons name="document-attach-outline" size={36} color="#3B82F6" />
                <Text style={styles.drivePreviewTitle}>Foto Tersimpan di Google Drive</Text>
                <Text style={styles.drivePreviewSub}>Klik untuk membuka gambar resolusi penuh di Google Drive</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : null}

        {/* Breakdown Items List */}
        <View style={styles.itemsCard}>
          <Text style={styles.sectionHeaderTitle}>
            Rincian Barang & Biaya ({items.length} Item)
          </Text>

          {items.length === 0 ? (
            <Text style={styles.noItemsText}>Tidak ada rincian item terpisah.</Text>
          ) : (
            items.map((it, idx) => (
              <View
                key={it.id || idx}
                style={[
                  styles.itemRow,
                  idx === items.length - 1 && { borderBottomWidth: 0 },
                ]}
              >
                <View style={styles.itemLeft}>
                  <Text style={styles.itemName}>{it.item_name}</Text>
                  <Text style={styles.itemQtyPrice}>
                    {it.quantity} x {formatRupiah(it.unit_price)}
                  </Text>
                </View>

                <Text style={styles.itemTotalPrice}>{formatRupiah(it.total_price)}</Text>
              </View>
            ))
          )}

          {/* Subtotal, Tax, Discount Breakdown */}
          <View style={styles.calcSummaryBox}>
            {transaction.subtotal && transaction.subtotal !== transaction.total_amount ? (
              <View style={styles.calcRow}>
                <Text style={styles.calcLabel}>Subtotal Item:</Text>
                <Text style={styles.calcVal}>{formatRupiah(transaction.subtotal)}</Text>
              </View>
            ) : null}

            {Number(transaction.tax_amount) > 0 ? (
              <View style={styles.calcRow}>
                <Text style={styles.calcLabel}>Pajak (PPN/PB1):</Text>
                <Text style={styles.calcVal}>{formatRupiah(transaction.tax_amount)}</Text>
              </View>
            ) : null}

            {Number(transaction.discount_amount) > 0 ? (
              <View style={styles.calcRow}>
                <Text style={styles.calcLabel}>Diskon:</Text>
                <Text style={[styles.calcVal, { color: Palette.coral }]}>
                  -{formatRupiah(transaction.discount_amount)}
                </Text>
              </View>
            ) : null}

            <View style={[styles.calcRow, styles.calcTotalRow]}>
              <Text style={styles.calcTotalLabel}>Total:</Text>
              <Text style={styles.calcTotalVal}>{formatRupiah(transaction.total_amount)}</Text>
            </View>
          </View>
        </View>

        {/* Notes */}
        {transaction.notes ? (
          <View style={styles.notesCard}>
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
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  circleBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
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
    borderRadius: 22,
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
    color: Palette.primaryLight,
    marginBottom: 14,
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
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 16,
  },
  receiptHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  driveLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  driveLinkText: {
    fontSize: 11,
    color: '#3B82F6',
    fontWeight: '700',
  },
  receiptImage: {
    width: '100%',
    height: 220,
    borderRadius: 12,
  },
  drivePreviewBox: {
    backgroundColor: 'rgba(59, 130, 246, 0.08)',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.2)',
  },
  drivePreviewTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Palette.darkText,
    marginTop: 8,
  },
  drivePreviewSub: {
    fontSize: 11,
    color: Palette.darkTextSecondary,
    textAlign: 'center',
    marginTop: 4,
  },
  itemsCard: {
    backgroundColor: Palette.darkCard,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 16,
  },
  sectionHeaderTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Palette.darkText,
    marginBottom: 12,
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
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.04)',
  },
  itemLeft: {
    flex: 1,
    paddingRight: 10,
  },
  itemName: {
    fontSize: 13,
    fontWeight: '600',
    color: Palette.darkText,
  },
  itemQtyPrice: {
    fontSize: 11,
    color: Palette.darkTextMuted,
    marginTop: 2,
  },
  itemTotalPrice: {
    fontSize: 13,
    fontWeight: '700',
    color: Palette.darkText,
  },
  calcSummaryBox: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  calcRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  calcLabel: {
    fontSize: 12,
    color: Palette.darkTextSecondary,
  },
  calcVal: {
    fontSize: 12,
    fontWeight: '600',
    color: Palette.darkText,
  },
  calcTotalRow: {
    marginTop: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
    marginBottom: 0,
  },
  calcTotalLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: Palette.darkText,
  },
  calcTotalVal: {
    fontSize: 15,
    fontWeight: '800',
    color: Palette.primaryLight,
  },
  notesCard: {
    backgroundColor: Palette.darkCard,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
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
    marginBottom: 20,
  },
  backBtn: {
    backgroundColor: Palette.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 14,
  },
  backBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
});
