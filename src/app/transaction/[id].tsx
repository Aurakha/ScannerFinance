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
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Palette } from '@/constants/theme';
import { useTransactionStore } from '@/store/transactionStore';
import { useThemeStore } from '@/store/themeStore';
import { formatDateTime, formatFriendlyDate, formatRupiah } from '@/utils/formatters';
import { Badge } from '@/components/common/Badge';

export default function TransactionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { transactions, removeTransaction } = useTransactionStore();
  const { theme, mode } = useThemeStore();

  const transaction = transactions.find((t) => t.id === id);

  if (!transaction) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
        <View style={styles.notFoundContainer}>
          <Ionicons name="alert-circle-outline" size={54} color={Palette.coral} />
          <Text style={[styles.notFoundTitle, { color: theme.text }]}>
            Transaksi Tidak Ditemukan
          </Text>
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
  const receiptUrl = transaction.receipt_image_url;
  const isGoogleDrive = receiptUrl?.includes('drive.google.com');

  const handleDelete = () => {
    Alert.alert(
      'Hapus Transaksi',
      `Apakah Anda yakin ingin menghapus transaksi dari "${transaction.merchant_name}"?`,
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

  const handleOpenReceiptPhoto = () => {
    if (!receiptUrl) {
      Alert.alert('Informasi', 'Tidak ada foto struk yang terlampir pada transaksi ini.');
      return;
    }

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.open(receiptUrl, '_blank');
    } else {
      Linking.openURL(receiptUrl).catch(() => {
        Alert.alert('Gagal Membuka', 'Tidak dapat membuka tautan foto struk.');
      });
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      {/* Top Navbar */}
      <View style={[styles.navbar, { borderBottomColor: theme.border }]}>
        <TouchableOpacity
          style={[styles.navBtn, { backgroundColor: theme.cardHover }]}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={20} color={theme.text} />
        </TouchableOpacity>

        <Text style={[styles.navTitle, { color: theme.text }]}>Detail Transaksi</Text>

        <TouchableOpacity
          style={[styles.navBtn, { backgroundColor: 'rgba(242, 63, 67, 0.12)' }]}
          onPress={handleDelete}
        >
          <Ionicons name="trash-outline" size={18} color={Palette.coral} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Main Amount Card */}
        <View
          style={[
            styles.amountCard,
            { backgroundColor: theme.card, borderColor: theme.border },
          ]}
        >
          <View style={[styles.categoryIconLarge, { backgroundColor: `${categoryColor}20` }]}>
            <Ionicons
              name={(category?.icon as any) || 'receipt-outline'}
              size={32}
              color={categoryColor}
            />
          </View>

          <Text style={[styles.merchantTitle, { color: theme.text }]}>
            {transaction.merchant_name}
          </Text>
          <Text style={[styles.categorySubtitle, { color: theme.textSecondary }]}>
            {category?.name || 'Pengeluaran'}
          </Text>

          <Text style={[styles.grandTotalText, { color: theme.text }]}>
            {formatRupiah(transaction.total_amount)}
          </Text>

          <View style={styles.badgeRow}>
            <Badge
              label={transaction.payment_method.toUpperCase()}
              color={categoryColor}
              size="md"
            />
            <Badge
              label={formatFriendlyDate(transaction.transaction_date)}
              color={theme.textSecondary}
              size="md"
            />
          </View>
        </View>

        {/* Transaction Metadata Grid */}
        <View
          style={[
            styles.metaCard,
            { backgroundColor: theme.card, borderColor: theme.border },
          ]}
        >
          <View style={styles.metaRow}>
            <View style={styles.metaCol}>
              <Text style={[styles.metaLabel, { color: theme.textMuted }]}>
                Waktu Transaksi
              </Text>
              <Text style={[styles.metaValue, { color: theme.text }]}>
                {formatDateTime(transaction.transaction_date)}
              </Text>
            </View>

            <View style={styles.metaCol}>
              <Text style={[styles.metaLabel, { color: theme.textMuted }]}>
                Metode Pembayaran
              </Text>
              <Text style={[styles.metaValue, { color: theme.text }]}>
                {transaction.payment_method.toUpperCase()}
              </Text>
            </View>
          </View>
        </View>

        {/* Clickable Receipt Photo Card */}
        <View
          style={[
            styles.photoCard,
            { backgroundColor: theme.card, borderColor: theme.border },
          ]}
        >
          <View style={styles.photoHeaderRow}>
            <View style={styles.photoHeaderLeft}>
              <Ionicons name="image" size={20} color={Palette.primary} />
              <Text style={[styles.sectionHeaderTitle, { color: theme.text }]}>Foto Struk Belanja</Text>
            </View>

            {receiptUrl ? (
              <TouchableOpacity
                style={styles.openDriveBtn}
                onPress={handleOpenReceiptPhoto}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={isGoogleDrive ? 'logo-google' : 'open-outline'}
                  size={14}
                  color={Palette.primary}
                />
                <Text style={styles.openDriveBtnText}>
                  {isGoogleDrive ? 'Buka di Drive ↗' : 'Buka Foto ↗'}
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>

          {receiptUrl ? (
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={handleOpenReceiptPhoto}
              style={styles.imagePreviewContainer}
            >
              <Image
                source={{ uri: receiptUrl }}
                style={styles.receiptImage}
                resizeMode="cover"
              />
              <View style={styles.imageOverlayBanner}>
                <Ionicons name="eye-outline" size={16} color="#FFFFFF" />
                <Text style={styles.imageOverlayText}>
                  Klik untuk melihat foto struk resolusi penuh
                </Text>
              </View>
            </TouchableOpacity>
          ) : (
            <View style={styles.noPhotoBox}>
              <Ionicons name="image-outline" size={36} color={theme.textMuted} />
              <Text style={[styles.noPhotoText, { color: theme.textMuted }]}>
                Foto struk tidak terlampir pada transaksi ini.
              </Text>
            </View>
          )}
        </View>

        {/* Item Breakdown List */}
        <View
          style={[
            styles.itemsCard,
            { backgroundColor: theme.card, borderColor: theme.border },
          ]}
        >
          <Text style={[styles.sectionHeaderTitle, { color: theme.text }]}>
            Rincian Barang & Biaya ({items.length} Baris)
          </Text>

          {items.length === 0 ? (
            <Text style={[styles.noItemsText, { color: theme.textMuted }]}>
              Tidak ada rincian item terpisah untuk transaksi ini.
            </Text>
          ) : (
            items.map((item, idx) => (
              <View
                key={idx}
                style={[
                  styles.itemRow,
                  idx !== items.length - 1 && {
                    borderBottomWidth: 1,
                    borderBottomColor: theme.border,
                  },
                ]}
              >
                <View style={styles.itemLeft}>
                  <Text style={[styles.itemName, { color: theme.text }]}>{item.item_name}</Text>
                  <Text style={[styles.itemQtyPrice, { color: theme.textMuted }]}>
                    {item.quantity} x {formatRupiah(item.unit_price)}
                  </Text>
                </View>

                <Text style={[styles.itemTotalPrice, { color: theme.text }]}>
                  {formatRupiah(item.total_price)}
                </Text>
              </View>
            ))
          )}

          {/* Subtotal Calculation Breakdown */}
          <View style={[styles.calcSummaryBox, { borderTopColor: theme.border }]}>
            {transaction.subtotal ? (
              <View style={styles.calcRow}>
                <Text style={[styles.calcLabel, { color: theme.textSecondary }]}>Subtotal Item:</Text>
                <Text style={[styles.calcVal, { color: theme.text }]}>
                  {formatRupiah(transaction.subtotal)}
                </Text>
              </View>
            ) : null}

            {transaction.admin_fee && transaction.admin_fee > 0 ? (
              <View style={styles.calcRow}>
                <Text style={[styles.calcLabel, { color: theme.textSecondary }]}>
                  Biaya Layanan & Admin:
                </Text>
                <Text style={[styles.calcVal, { color: theme.text }]}>
                  {formatRupiah(transaction.admin_fee)}
                </Text>
              </View>
            ) : null}

            {transaction.shipping_fee && transaction.shipping_fee > 0 ? (
              <View style={styles.calcRow}>
                <Text style={[styles.calcLabel, { color: theme.textSecondary }]}>
                  Ongkos Kirim (Delivery):
                </Text>
                <Text style={[styles.calcVal, { color: theme.text }]}>
                  {formatRupiah(transaction.shipping_fee)}
                </Text>
              </View>
            ) : null}

            {transaction.tax_amount && transaction.tax_amount > 0 ? (
              <View style={styles.calcRow}>
                <Text style={[styles.calcLabel, { color: theme.textSecondary }]}>Pajak / PPN:</Text>
                <Text style={[styles.calcVal, { color: theme.text }]}>
                  {formatRupiah(transaction.tax_amount)}
                </Text>
              </View>
            ) : null}

            {transaction.discount_amount && transaction.discount_amount > 0 ? (
              <View style={styles.calcRow}>
                <Text style={[styles.calcLabel, { color: Palette.coral }]}>Voucher Diskon:</Text>
                <Text style={[styles.calcVal, { color: Palette.coral }]}>
                  -{formatRupiah(transaction.discount_amount)}
                </Text>
              </View>
            ) : null}

            <View style={[styles.calcRow, styles.calcTotalRow]}>
              <Text style={[styles.calcTotalLabel, { color: theme.text }]}>Total Belanja:</Text>
              <Text style={[styles.calcTotalVal, { color: Palette.primaryLight }]}>
                {formatRupiah(transaction.total_amount)}
              </Text>
            </View>
          </View>
        </View>

        {/* Notes Card */}
        {transaction.notes ? (
          <View
            style={[
              styles.notesCard,
              { backgroundColor: theme.card, borderColor: theme.border },
            ]}
          >
            <Text style={[styles.sectionHeaderTitle, { color: theme.text }]}>Catatan</Text>
            <Text style={[styles.notesBody, { color: theme.textSecondary }]}>
              {transaction.notes}
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  navbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  navBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  navTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  amountCard: {
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    marginBottom: 14,
  },
  categoryIconLarge: {
    width: 64,
    height: 64,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  merchantTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  categorySubtitle: {
    fontSize: 12,
    marginTop: 2,
    marginBottom: 10,
  },
  grandTotalText: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: 12,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  metaCard: {
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    marginBottom: 14,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metaCol: {
    flex: 1,
  },
  metaLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  metaValue: {
    fontSize: 13,
    fontWeight: '700',
  },
  photoCard: {
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    marginBottom: 14,
  },
  photoHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  photoHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  openDriveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(88, 101, 242, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  openDriveBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: Palette.primary,
  },
  imagePreviewContainer: {
    height: 180,
    borderRadius: 14,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
  },
  receiptImage: {
    width: '100%',
    height: '100%',
  },
  imageOverlayBanner: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  imageOverlayText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  noPhotoBox: {
    alignItems: 'center',
    paddingVertical: 20,
    gap: 6,
  },
  noPhotoText: {
    fontSize: 12,
  },
  itemsCard: {
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    marginBottom: 14,
  },
  sectionHeaderTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 10,
  },
  noItemsText: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  itemLeft: {
    flex: 1,
    paddingRight: 8,
  },
  itemName: {
    fontSize: 13,
    fontWeight: '600',
  },
  itemQtyPrice: {
    fontSize: 11,
    marginTop: 2,
  },
  itemTotalPrice: {
    fontSize: 13,
    fontWeight: '700',
  },
  calcSummaryBox: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
  },
  calcRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  calcLabel: {
    fontSize: 12,
  },
  calcVal: {
    fontSize: 12,
    fontWeight: '600',
  },
  calcTotalRow: {
    marginTop: 4,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 0,
  },
  calcTotalLabel: {
    fontSize: 14,
    fontWeight: '800',
  },
  calcTotalVal: {
    fontSize: 15,
    fontWeight: '800',
  },
  notesCard: {
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
  },
  notesBody: {
    fontSize: 12,
    lineHeight: 18,
  },
  notFoundContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  notFoundTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 12,
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
    fontSize: 13,
  },
});
