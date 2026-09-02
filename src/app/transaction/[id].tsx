import React, { useState } from 'react';
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
  Modal,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Palette } from '@/constants/theme';
import { useTransactionStore } from '@/store/transactionStore';
import { useThemeStore } from '@/store/themeStore';
import { formatDateTime, formatFriendlyDate, formatRupiah } from '@/utils/formatters';
import { Badge } from '@/components/common/Badge';
import { DEFAULT_CATEGORIES } from '@/constants/categories';
import { categorizeColumn } from '@/utils/exportReport';
import { PaymentMethod } from '@/types';

export default function TransactionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { transactions, removeTransaction, updateTransaction } = useTransactionStore();
  const { theme, mode } = useThemeStore();

  const transaction = transactions.find((t) => t.id === id);

  // Edit Modal State
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [editMerchantName, setEditMerchantName] = useState('');
  const [editCategoryName, setEditCategoryName] = useState('Pantry');
  const [editTransactionDate, setEditTransactionDate] = useState('');
  const [editPaymentMethod, setEditPaymentMethod] = useState<PaymentMethod>('e-wallet');
  const [editItems, setEditItems] = useState<Array<{ item_name: string; quantity: number; unit_price: number; total_price: number }>>([]);
  const [editShippingFee, setEditShippingFee] = useState('0');
  const [editAdminFee, setEditAdminFee] = useState('0');
  const [editTaxAmount, setEditTaxAmount] = useState('0');
  const [editDiscountAmount, setEditDiscountAmount] = useState('0');
  const [editNotes, setEditNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);

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

  // Resolve category fallback
  const category =
    transaction.category ||
    DEFAULT_CATEGORIES.find((c) => c.id === transaction.category_id) ||
    DEFAULT_CATEGORIES.find((c) => {
      const catKey = categorizeColumn(transaction.merchant_name || '');
      return categorizeColumn(c.name) === catKey;
    }) ||
    DEFAULT_CATEGORIES[0];

  const categoryColor = category?.color || Palette.primary;
  const items = transaction.items || [];
  const receiptUrl = transaction.receipt_image_url;
  const isGoogleDrive = receiptUrl?.includes('drive.google.com');

  const openEditModal = () => {
    setEditMerchantName(transaction.merchant_name || '');
    setEditCategoryName(category?.name || 'Pantry');
    setEditTransactionDate(transaction.transaction_date || new Date().toISOString());
    setEditPaymentMethod(transaction.payment_method || 'e-wallet');
    setEditItems(
      (transaction.items && transaction.items.length > 0)
        ? transaction.items.map((it) => ({
            item_name: it.item_name,
            quantity: Number(it.quantity) || 1,
            unit_price: Number(it.unit_price) || 0,
            total_price: Number(it.total_price) || (Number(it.quantity) || 1) * (Number(it.unit_price) || 0),
          }))
        : []
    );
    setEditShippingFee(String(transaction.shipping_fee || 0));
    setEditAdminFee(String(transaction.admin_fee || 0));
    setEditTaxAmount(String(transaction.tax_amount || 0));
    setEditDiscountAmount(String(transaction.discount_amount || 0));
    setEditNotes(transaction.notes || '');
    setIsEditModalVisible(true);
  };

  const handleAddItem = () => {
    setEditItems((prev) => [
      ...prev,
      { item_name: '', quantity: 1, unit_price: 0, total_price: 0 },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    setEditItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleItemChange = (index: number, field: 'item_name' | 'quantity' | 'unit_price', value: string) => {
    setEditItems((prev) => {
      const updated = [...prev];
      if (field === 'item_name') {
        updated[index].item_name = value;
      } else if (field === 'quantity') {
        const qty = Number(value.replace(/[^0-9]/g, '')) || 0;
        updated[index].quantity = qty;
        updated[index].total_price = qty * updated[index].unit_price;
      } else if (field === 'unit_price') {
        const price = Number(value.replace(/[^0-9]/g, '')) || 0;
        updated[index].unit_price = price;
        updated[index].total_price = (updated[index].quantity || 1) * price;
      }
      return updated;
    });
  };

  // Hitung total belanja pada form edit secara real-time
  const computedItemsSubtotal = editItems.reduce((sum, it) => sum + (Number(it.total_price) || 0), 0);
  const parsedShipping = Number(editShippingFee.replace(/[^0-9]/g, '')) || 0;
  const parsedAdmin = Number(editAdminFee.replace(/[^0-9]/g, '')) || 0;
  const parsedTax = Number(editTaxAmount.replace(/[^0-9]/g, '')) || 0;
  const parsedDiscount = Number(editDiscountAmount.replace(/[^0-9]/g, '')) || 0;

  const computedGrandTotal =
    editItems.length > 0
      ? computedItemsSubtotal + parsedShipping + parsedAdmin + parsedTax - parsedDiscount
      : (Number(transaction.total_amount) || 0) + parsedShipping + parsedAdmin + parsedTax - parsedDiscount;

  const handleSaveEdit = async () => {
    if (!editMerchantName.trim()) {
      Alert.alert('Perhatian', 'Nama toko / merchant wajib diisi.');
      return;
    }

    setIsSaving(true);
    try {
      const matchedCat = DEFAULT_CATEGORIES.find(
        (c) => c.name.toLowerCase() === editCategoryName.toLowerCase()
      ) || DEFAULT_CATEGORIES[0];

      const updatedData: Partial<typeof transaction> = {
        merchant_name: editMerchantName.trim(),
        category_id: matchedCat.id,
        category: matchedCat,
        transaction_date: editTransactionDate,
        payment_method: editPaymentMethod,
        items: editItems.map((it) => ({
          item_name: it.item_name || 'Item',
          quantity: Number(it.quantity) || 1,
          unit_price: Number(it.unit_price) || 0,
          total_price: Number(it.total_price) || (Number(it.quantity) || 1) * (Number(it.unit_price) || 0),
        })),
        subtotal: editItems.length > 0 ? computedItemsSubtotal : computedGrandTotal,
        shipping_fee: parsedShipping,
        admin_fee: parsedAdmin,
        tax_amount: parsedTax,
        discount_amount: parsedDiscount,
        total_amount: Math.max(0, computedGrandTotal),
        notes: editNotes.trim(),
      };

      await updateTransaction(transaction.id, updatedData);
      setIsEditModalVisible(false);
      Alert.alert('Sukses', 'Data transaksi berhasil diperbarui!');
    } catch (err: any) {
      Alert.alert('Gagal Menyimpan', err?.message || 'Terjadi kesalahan saat menyimpan perubahan.');
    } finally {
      setIsSaving(false);
    }
  };

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

  const directImageUrl = React.useMemo(() => {
    if (!receiptUrl) return undefined;
    if (receiptUrl.startsWith('data:image') || receiptUrl.startsWith('blob:') || receiptUrl.startsWith('file:')) {
      return receiptUrl;
    }
    const driveMatch = receiptUrl.match(/\/d\/([a-zA-Z0-9_-]+)/) || receiptUrl.match(/id=([a-zA-Z0-9_-]+)/);
    if (driveMatch && driveMatch[1]) {
      const fileId = driveMatch[1];
      return `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`;
    }
    return receiptUrl;
  }, [receiptUrl]);

  const [imageLoadError, setImageLoadError] = React.useState(false);

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

        <View style={styles.navRightGroup}>
          <TouchableOpacity
            style={[styles.navBtn, { backgroundColor: `${Palette.primary}20` }]}
            onPress={openEditModal}
            activeOpacity={0.7}
          >
            <Ionicons name="pencil" size={16} color={Palette.primary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.navBtn, { backgroundColor: 'rgba(242, 63, 67, 0.12)' }]}
            onPress={handleDelete}
            activeOpacity={0.7}
          >
            <Ionicons name="trash-outline" size={18} color={Palette.coral} />
          </TouchableOpacity>
        </View>
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

          {/* Tombol Cepat Edit */}
          <TouchableOpacity
            style={[
              styles.quickEditBtn,
              { backgroundColor: `${Palette.primary}15`, borderColor: `${Palette.primary}35` },
            ]}
            onPress={openEditModal}
            activeOpacity={0.7}
          >
            <Ionicons name="create-outline" size={15} color={Palette.primary} />
            <Text style={[styles.quickEditBtnText, { color: Palette.primary }]}>
              Edit Transaksi & Rincian
            </Text>
          </TouchableOpacity>
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
              {!imageLoadError && directImageUrl ? (
                <Image
                  source={{ uri: directImageUrl }}
                  style={styles.receiptImage}
                  resizeMode="contain"
                  onError={() => setImageLoadError(true)}
                />
              ) : (
                <View style={styles.fallbackDriveBox}>
                  <Ionicons name={isGoogleDrive ? "cloud-done" : "document-attach"} size={42} color={Palette.primary} />
                  <Text style={[styles.fallbackDriveTitle, { color: theme.text }]}>
                    Foto Struk Tersimpan di Google Drive ☁️
                  </Text>
                  <Text style={[styles.fallbackDriveSub, { color: theme.textMuted }]}>
                    Klik di sini untuk membuka foto struk resolusi asli
                  </Text>
                </View>
              )}
              <View style={styles.imageOverlayBanner}>
                <Ionicons name="eye-outline" size={16} color="#FFFFFF" />
                <Text style={styles.imageOverlayText}>
                  Klik untuk melihat foto struk resolusi penuh ↗
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
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <Text style={[styles.sectionHeaderTitle, { color: theme.text, marginBottom: 0 }]}>
              Rincian Barang & Biaya ({items.length} Baris)
            </Text>
            <TouchableOpacity
              style={styles.inlineEditBtn}
              onPress={openEditModal}
              activeOpacity={0.7}
            >
              <Ionicons name="pencil" size={12} color={Palette.primary} />
              <Text style={[styles.inlineEditBtnText, { color: Palette.primary }]}>Edit</Text>
            </TouchableOpacity>
          </View>

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

      {/* MODAL EDIT TRANSAKSI LENGKAP */}
      <Modal visible={isEditModalVisible} animationType="slide" transparent>
        <SafeAreaView style={[styles.modalSafeArea, { backgroundColor: theme.background }]}>
          {/* Modal Header */}
          <View style={[styles.modalNav, { borderBottomColor: theme.border, backgroundColor: theme.card }]}>
            <TouchableOpacity
              onPress={() => setIsEditModalVisible(false)}
              style={[styles.navBtn, { backgroundColor: theme.cardHover }]}
            >
              <Ionicons name="close" size={20} color={theme.text} />
            </TouchableOpacity>

            <Text style={[styles.navTitle, { color: theme.text }]}>Edit Transaksi</Text>

            <TouchableOpacity
              onPress={handleSaveEdit}
              disabled={isSaving}
              style={[styles.saveHeaderBtn, { backgroundColor: Palette.primary }]}
            >
              {isSaving ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                  <Text style={styles.saveHeaderBtnText}>Simpan</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalScrollContent}>
            {/* Section 1: Informasi Utama */}
            <View style={[styles.formCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <Text style={[styles.formSectionTitle, { color: theme.text }]}>
                🏪 Informasi Toko & Waktu
              </Text>

              {/* Nama Toko */}
              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, { color: theme.textSecondary }]}>Nama Toko / Merchant *</Text>
                <TextInput
                  style={[styles.formInput, { color: theme.text, backgroundColor: theme.background, borderColor: theme.border }]}
                  value={editMerchantName}
                  onChangeText={setEditMerchantName}
                  placeholder="Contoh: ShopeeFood, Bakmi Jawa, dll."
                  placeholderTextColor={theme.textMuted}
                />
              </View>

              {/* Kategori Form SKA */}
              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, { color: theme.textSecondary }]}>Kategori Kolom Form SKA</Text>
                <View style={styles.categoryPillsRow}>
                  {DEFAULT_CATEGORIES.map((cat) => {
                    const isSelected = editCategoryName.toLowerCase() === cat.name.toLowerCase();
                    return (
                      <TouchableOpacity
                        key={cat.id}
                        style={[
                          styles.catPill,
                          {
                            backgroundColor: isSelected ? cat.color : theme.background,
                            borderColor: isSelected ? cat.color : theme.border,
                          },
                        ]}
                        onPress={() => setEditCategoryName(cat.name)}
                      >
                        <Ionicons
                          name={(cat.icon as any) || 'pricetag'}
                          size={14}
                          color={isSelected ? '#FFFFFF' : cat.color}
                        />
                        <Text
                          style={[
                            styles.catPillText,
                            { color: isSelected ? '#FFFFFF' : theme.text },
                            isSelected && { fontWeight: '700' },
                          ]}
                        >
                          {cat.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Tanggal & Waktu */}
              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, { color: theme.textSecondary }]}>Waktu Transaksi (ISO Format)</Text>
                <TextInput
                  style={[styles.formInput, { color: theme.text, backgroundColor: theme.background, borderColor: theme.border }]}
                  value={editTransactionDate}
                  onChangeText={setEditTransactionDate}
                  placeholder="YYYY-MM-DDTHH:mm:ss"
                  placeholderTextColor={theme.textMuted}
                />
              </View>

              {/* Metode Pembayaran */}
              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, { color: theme.textSecondary }]}>Metode Pembayaran</Text>
                <View style={styles.paymentMethodRow}>
                  {(['e-wallet', 'cash', 'qris', 'transfer', 'debit', 'credit'] as const).map((method) => {
                    const isSelected = editPaymentMethod === method;
                    return (
                      <TouchableOpacity
                        key={method}
                        style={[
                          styles.paymentPill,
                          {
                            backgroundColor: isSelected ? Palette.primary : theme.background,
                            borderColor: isSelected ? Palette.primary : theme.border,
                          },
                        ]}
                        onPress={() => setEditPaymentMethod(method)}
                      >
                        <Text
                          style={[
                            styles.paymentPillText,
                            { color: isSelected ? '#FFFFFF' : theme.textSecondary },
                            isSelected && { fontWeight: '700', color: '#FFFFFF' },
                          ]}
                        >
                          {method.toUpperCase()}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </View>

            {/* Section 2: Rincian Barang / Menu */}
            <View style={[styles.formCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <Text style={[styles.formSectionTitle, { color: theme.text, marginBottom: 0 }]}>
                  🛒 Rincian Barang / Menu ({editItems.length})
                </Text>
                <TouchableOpacity
                  style={[styles.addItemBtn, { backgroundColor: `${Palette.primary}20` }]}
                  onPress={handleAddItem}
                >
                  <Ionicons name="add" size={16} color={Palette.primary} />
                  <Text style={[styles.addItemBtnText, { color: Palette.primary }]}>Tambah Item</Text>
                </TouchableOpacity>
              </View>

              {editItems.map((item, idx) => (
                <View
                  key={idx}
                  style={[
                    styles.itemEditRowCard,
                    { backgroundColor: theme.background, borderColor: theme.border },
                  ]}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <Text style={[styles.itemIndexLabel, { color: theme.textMuted }]}>Item #{idx + 1}</Text>
                    <TouchableOpacity onPress={() => handleRemoveItem(idx)}>
                      <Ionicons name="trash-outline" size={16} color={Palette.coral} />
                    </TouchableOpacity>
                  </View>

                  {/* Nama Item */}
                  <TextInput
                    style={[styles.itemInput, { color: theme.text, borderColor: theme.border, marginBottom: 8 }]}
                    placeholder="Nama Barang / Menu"
                    placeholderTextColor={theme.textMuted}
                    value={item.item_name}
                    onChangeText={(val) => handleItemChange(idx, 'item_name', val)}
                  />

                  {/* Qty & Harga Satuan */}
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <View style={{ width: 80 }}>
                      <Text style={[styles.miniLabel, { color: theme.textMuted }]}>Qty</Text>
                      <TextInput
                        style={[styles.itemInput, { color: theme.text, borderColor: theme.border }]}
                        keyboardType="numeric"
                        value={String(item.quantity || '')}
                        onChangeText={(val) => handleItemChange(idx, 'quantity', val)}
                      />
                    </View>

                    <View style={{ flex: 1 }}>
                      <Text style={[styles.miniLabel, { color: theme.textMuted }]}>Harga Satuan (Rp)</Text>
                      <TextInput
                        style={[styles.itemInput, { color: theme.text, borderColor: theme.border }]}
                        keyboardType="numeric"
                        value={String(item.unit_price || '')}
                        onChangeText={(val) => handleItemChange(idx, 'unit_price', val)}
                      />
                    </View>

                    <View style={{ flex: 1, justifyContent: 'flex-end', paddingBottom: 6 }}>
                      <Text style={[styles.miniLabel, { color: theme.textMuted }]}>Subtotal</Text>
                      <Text style={[styles.itemSubtotalPreview, { color: Palette.primary }]}>
                        {formatRupiah(item.total_price)}
                      </Text>
                    </View>
                  </View>
                </View>
              ))}

              {editItems.length === 0 && (
                <TouchableOpacity
                  style={[styles.emptyItemsPrompt, { borderColor: theme.border }]}
                  onPress={handleAddItem}
                >
                  <Ionicons name="add-circle-outline" size={24} color={Palette.primary} />
                  <Text style={[styles.emptyItemsPromptText, { color: theme.textSecondary }]}>
                    Belum ada item rincian. Klik untuk menambah rincian barang.
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Section 3: Biaya Tambahan & Diskon */}
            <View style={[styles.formCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <Text style={[styles.formSectionTitle, { color: theme.text }]}>
                💰 Biaya Tambahan & Potongan Diskon
              </Text>

              <View style={styles.twoColRow}>
                {/* Ongkir */}
                <View style={styles.formCol}>
                  <Text style={[styles.formLabel, { color: theme.textSecondary }]}>Ongkos Kirim (Rp)</Text>
                  <TextInput
                    style={[styles.formInput, { color: theme.text, backgroundColor: theme.background, borderColor: theme.border }]}
                    keyboardType="numeric"
                    value={editShippingFee}
                    onChangeText={setEditShippingFee}
                  />
                </View>

                {/* Biaya Layanan / Admin */}
                <View style={styles.formCol}>
                  <Text style={[styles.formLabel, { color: theme.textSecondary }]}>Biaya Layanan/Admin (Rp)</Text>
                  <TextInput
                    style={[styles.formInput, { color: theme.text, backgroundColor: theme.background, borderColor: theme.border }]}
                    keyboardType="numeric"
                    value={editAdminFee}
                    onChangeText={setEditAdminFee}
                  />
                </View>
              </View>

              <View style={styles.twoColRow}>
                {/* Pajak / PPN */}
                <View style={styles.formCol}>
                  <Text style={[styles.formLabel, { color: theme.textSecondary }]}>Pajak / PPN (Rp)</Text>
                  <TextInput
                    style={[styles.formInput, { color: theme.text, backgroundColor: theme.background, borderColor: theme.border }]}
                    keyboardType="numeric"
                    value={editTaxAmount}
                    onChangeText={setEditTaxAmount}
                  />
                </View>

                {/* Diskon / Promo */}
                <View style={styles.formCol}>
                  <Text style={[styles.formLabel, { color: Palette.coral }]}>Diskon / Voucher Promo (Rp)</Text>
                  <TextInput
                    style={[styles.formInput, { color: Palette.coral, backgroundColor: theme.background, borderColor: Palette.coral }]}
                    keyboardType="numeric"
                    value={editDiscountAmount}
                    onChangeText={setEditDiscountAmount}
                  />
                </View>
              </View>
            </View>

            {/* Section 4: Catatan & Total Akhir */}
            <View style={[styles.formCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <Text style={[styles.formSectionTitle, { color: theme.text }]}>
                📝 Catatan & Ringkasan Total
              </Text>

              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, { color: theme.textSecondary }]}>Catatan / Nomor Pesanan</Text>
                <TextInput
                  style={[
                    styles.formInput,
                    { color: theme.text, backgroundColor: theme.background, borderColor: theme.border, minHeight: 60 },
                  ]}
                  multiline
                  value={editNotes}
                  onChangeText={setEditNotes}
                  placeholder="Catatan tambahan atau no pesanan struk..."
                  placeholderTextColor={theme.textMuted}
                />
              </View>

              {/* Total Belanja Hasil Perhitungan Real-Time */}
              <View style={[styles.totalResultBox, { backgroundColor: `${Palette.primary}12`, borderColor: `${Palette.primary}30` }]}>
                <Text style={[styles.totalResultLabel, { color: theme.textSecondary }]}>
                  Total Akhir Transaksi
                </Text>
                <Text style={[styles.totalResultVal, { color: Palette.primary }]}>
                  {formatRupiah(Math.max(0, computedGrandTotal))}
                </Text>
              </View>
            </View>

            {/* Tombol Simpan Bawah */}
            <TouchableOpacity
              style={[styles.saveBottomBtn, { backgroundColor: Palette.primary }]}
              onPress={handleSaveEdit}
              disabled={isSaving}
            >
              {isSaving ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <>
                  <Ionicons name="save-outline" size={18} color="#FFFFFF" />
                  <Text style={styles.saveBottomBtnText}>Simpan Perubahan Transaksi</Text>
                </>
              )}
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>
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
  navRightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
  quickEditBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 14,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
  },
  quickEditBtnText: {
    fontSize: 12,
    fontWeight: '700',
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
  fallbackDriveBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    gap: 6,
  },
  fallbackDriveTitle: {
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  fallbackDriveSub: {
    fontSize: 11,
    textAlign: 'center',
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
  },
  inlineEditBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: 'rgba(88, 101, 242, 0.12)',
  },
  inlineEditBtnText: {
    fontSize: 11,
    fontWeight: '700',
  },
  noItemsText: {
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 6,
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
  // Modal Edit Styles
  modalSafeArea: {
    flex: 1,
  },
  modalNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  saveHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  saveHeaderBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  modalScroll: {
    flex: 1,
  },
  modalScrollContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 14,
  },
  formCard: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
  },
  formSectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 12,
  },
  formGroup: {
    marginBottom: 12,
  },
  formLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  formInput: {
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 13,
  },
  categoryPillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  catPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
  },
  catPillText: {
    fontSize: 12,
  },
  paymentMethodRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  paymentPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  paymentPillText: {
    fontSize: 11,
    fontWeight: '600',
  },
  addItemBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  addItemBtnText: {
    fontSize: 11,
    fontWeight: '700',
  },
  itemEditRowCard: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
  },
  itemIndexLabel: {
    fontSize: 11,
    fontWeight: '700',
  },
  itemInput: {
    height: 38,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    fontSize: 12,
  },
  miniLabel: {
    fontSize: 10,
    fontWeight: '600',
    marginBottom: 3,
  },
  itemSubtotalPreview: {
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'right',
  },
  emptyItemsPrompt: {
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    gap: 6,
  },
  emptyItemsPromptText: {
    fontSize: 12,
    textAlign: 'center',
  },
  twoColRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 10,
  },
  formCol: {
    flex: 1,
  },
  totalResultBox: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    marginTop: 6,
  },
  totalResultLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  totalResultVal: {
    fontSize: 22,
    fontWeight: '800',
    marginTop: 2,
  },
  saveBottomBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    shadowColor: Palette.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  saveBottomBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },
});
