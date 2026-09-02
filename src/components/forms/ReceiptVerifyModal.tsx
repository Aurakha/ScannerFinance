import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { Palette } from '@/constants/theme';
import { Category, PaymentMethod, ReceiptScanResult, TransactionItem } from '@/types';
import { DEFAULT_CATEGORIES } from '@/constants/categories';
import { formatRupiah } from '@/utils/formatters';

interface ReceiptVerifyModalProps {
  visible: boolean;
  scanData: ReceiptScanResult | null;
  categories?: Category[];
  queueIndex?: number;
  queueTotal?: number;
  onClose: () => void;
  onConfirmSave: (verifiedData: {
    merchant_name: string;
    transaction_date: string;
    category_id: string;
    payment_method: PaymentMethod;
    subtotal: number;
    tax_amount: number;
    discount_amount: number;
    shipping_fee?: number;
    admin_fee?: number;
    total_amount: number;
    notes: string;
    items: TransactionItem[];
    receipt_image_uri?: string;
  }) => void;
}

const PAYMENT_METHODS: Array<{ label: string; value: PaymentMethod; icon: string }> = [
  { label: 'QRIS', value: 'qris', icon: 'qr-code-outline' },
  { label: 'Tunai', value: 'cash', icon: 'cash-outline' },
  { label: 'Debit', value: 'debit', icon: 'card-outline' },
  { label: 'Kredit', value: 'credit', icon: 'card-outline' },
  { label: 'E-Wallet', value: 'e-wallet', icon: 'wallet-outline' },
  { label: 'Transfer', value: 'transfer', icon: 'arrow-redo-outline' },
];

export const ReceiptVerifyModal: React.FC<ReceiptVerifyModalProps> = ({
  visible,
  scanData,
  categories = DEFAULT_CATEGORIES,
  queueIndex,
  queueTotal,
  onClose,
  onConfirmSave,
}) => {
  if (!scanData) return null;

  const initialDate = scanData.transaction_date
    ? new Date(scanData.transaction_date)
    : new Date();

  const [merchantName, setMerchantName] = useState(scanData.merchant_name || 'Toko Belanja');
  const [transactionDate, setTransactionDate] = useState(
    initialDate.toISOString().slice(0, 10)
  );
  const [transactionTime, setTransactionTime] = useState(
    initialDate.toTimeString().slice(0, 5)
  );
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>(() => {
    const sug = (scanData.suggested_category || '').toLowerCase();
    const found = categories.find(
      (c) =>
        c.name.toLowerCase() === sug ||
        c.id.toLowerCase() === sug ||
        sug.includes(c.name.toLowerCase()) ||
        c.name.toLowerCase().includes(sug)
    );
    return found ? found.id : categories[0]?.id || 'cat-operational';
  });
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(
    scanData.payment_method || 'e-wallet'
  );
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showPaymentPicker, setShowPaymentPicker] = useState(false);

  const currentCategory = categories.find((c) => c.id === selectedCategoryId) || categories[0];
  const currentPayment = PAYMENT_METHODS.find((p) => p.value === paymentMethod) || PAYMENT_METHODS[0];

  const [items, setItems] = useState<TransactionItem[]>(() => {
    return (scanData.items || []).map((it) => ({
      item_name: it.item_name,
      quantity: it.quantity || 1,
      unit_price: it.unit_price || 0,
      total_price: it.total_price || (it.quantity || 1) * (it.unit_price || 0),
    }));
  });

  // Biaya-biaya rincian otomatis dari AI
  const [adminFee, setAdminFee] = useState<string>(String(scanData.admin_fee || 0));
  const [shippingFee, setShippingFee] = useState<string>(String(scanData.shipping_fee || 0));
  const [taxAmount, setTaxAmount] = useState<string>(String(scanData.tax_amount || 0));
  const [discountAmount, setDiscountAmount] = useState<string>(String(scanData.discount_amount || 0));
  const [notes, setNotes] = useState<string>(scanData.notes || '');
  const [showExtraFees, setShowExtraFees] = useState(false);

  // Total Belanja: Selalu mengunci nilai TOTAL AKHIR yang tertera di struk
  const [totalAmount, setTotalAmount] = useState<string>(() => {
    return String(scanData.total_amount || scanData.subtotal || 0);
  });

  const [attachedPhotoUri, setAttachedPhotoUri] = useState<string | null>(
    scanData.receipt_image_uri || null
  );

  // Selalu sinkronkan ulang seluruh field formulir saat scanData berganti (misal saat giliran struk ke-2, 3, dst.)
  useEffect(() => {
    if (scanData) {
      setMerchantName(scanData.merchant_name || 'Toko Belanja');
      const d = scanData.transaction_date ? new Date(scanData.transaction_date) : new Date();
      setTransactionDate(d.toISOString().slice(0, 10));
      setTransactionTime(d.toTimeString().slice(0, 5));
      setPaymentMethod(scanData.payment_method || 'e-wallet');

      const sug = (scanData.suggested_category || '').toLowerCase();
      const found = categories.find(
        (c) =>
          c.name.toLowerCase() === sug ||
          c.id.toLowerCase() === sug ||
          sug.includes(c.name.toLowerCase()) ||
          c.name.toLowerCase().includes(sug)
      );
      setSelectedCategoryId(found ? found.id : categories[0]?.id || 'cat-operational');

      setItems((scanData.items || []).map((it) => ({
        item_name: it.item_name,
        quantity: it.quantity || 1,
        unit_price: it.unit_price || 0,
        total_price: it.total_price || (it.quantity || 1) * (it.unit_price || 0),
      })));
      setAdminFee(String(scanData.admin_fee || 0));
      setShippingFee(String(scanData.shipping_fee || 0));
      setTaxAmount(String(scanData.tax_amount || 0));
      setDiscountAmount(String(scanData.discount_amount || 0));
      setTotalAmount(String(scanData.total_amount || scanData.subtotal || 0));
      setNotes(scanData.notes || '');
      setAttachedPhotoUri(scanData.receipt_image_uri || null);
    }
  }, [scanData, categories]);

  const handlePickAttachment = async () => {
    if (Platform.OS === 'web') {
      try {
        const res = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          quality: 0.85,
        });
        if (!res.canceled && res.assets?.[0]?.uri) {
          setAttachedPhotoUri(res.assets[0].uri);
        }
      } catch (e: any) {
        Alert.alert('Gagal Memilih Foto', e.message || 'Tidak dapat membuka file.');
      }
      return;
    }

    Alert.alert('Lampirkan Foto Struk', 'Pilih sumber foto bukti transaksi:', [
      {
        text: 'Kamera',
        onPress: async () => {
          try {
            const perm = await ImagePicker.requestCameraPermissionsAsync();
            if (!perm.granted) {
              Alert.alert('Izin Kamera Ditolak', 'Mohon izinkan akses kamera pada pengaturan perangkat.');
              return;
            }
            const res = await ImagePicker.launchCameraAsync({ quality: 0.85 });
            if (!res.canceled && res.assets?.[0]?.uri) {
              setAttachedPhotoUri(res.assets[0].uri);
            }
          } catch (err: any) {
            Alert.alert('Error', err.message);
          }
        },
      },
      {
        text: 'Galeri Foto',
        onPress: async () => {
          try {
            const res = await ImagePicker.launchImageLibraryAsync({ quality: 0.85 });
            if (!res.canceled && res.assets?.[0]?.uri) {
              setAttachedPhotoUri(res.assets[0].uri);
            }
          } catch (err: any) {
            Alert.alert('Error', err.message);
          }
        },
      },
      { text: 'Batal', style: 'cancel' },
    ]);
  };

  // Hitung subtotal item
  const itemsSubtotal = items.reduce((sum, it) => sum + (Number(it.total_price) || 0), 0);

  const handleAddItem = () => {
    const newItem = { item_name: 'Item Baru', quantity: 1, unit_price: 10000, total_price: 10000 };
    const updated = [...items, newItem];
    setItems(updated);
  };

  const handleUpdateItem = (index: number, field: keyof TransactionItem, value: any) => {
    const updated = [...items];
    const item = { ...updated[index], [field]: value };
    if (field === 'quantity' || field === 'unit_price') {
      const q = field === 'quantity' ? Number(value) : item.quantity;
      const p = field === 'unit_price' ? Number(value) : item.unit_price;
      item.total_price = (q || 1) * (p || 0);
    }
    updated[index] = item;
    setItems(updated);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    if (!merchantName.trim()) {
      Alert.alert('Perhatian', 'Nama toko/merchant tidak boleh kosong.');
      return;
    }

    let finalIso = new Date().toISOString();
    try {
      finalIso = new Date(`${transactionDate}T${transactionTime}:00`).toISOString();
    } catch {
      finalIso = new Date().toISOString();
    }

    const finalTotal = Number(totalAmount) || Number(scanData.total_amount) || itemsSubtotal || 0;

    onConfirmSave({
      merchant_name: merchantName,
      transaction_date: finalIso,
      category_id: selectedCategoryId,
      payment_method: paymentMethod,
      subtotal: itemsSubtotal > 0 ? itemsSubtotal : finalTotal,
      shipping_fee: Number(shippingFee) || 0,
      admin_fee: Number(adminFee) || 0,
      tax_amount: Number(taxAmount) || 0,
      discount_amount: Number(discountAmount) || 0,
      total_amount: finalTotal,
      notes: notes,
      items: items,
      receipt_image_uri: attachedPhotoUri || scanData.receipt_image_uri || undefined,
    });
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.sheetContainer}>
          {/* Header Bar */}
          <View style={styles.header}>
            <View style={{ flex: 1, paddingRight: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <Text style={styles.title} numberOfLines={1}>
                  Konfirmasi Hasil Ekstraksi
                </Text>
                {queueTotal !== undefined && queueTotal > 1 && (
                  <View style={styles.queueBadge}>
                    <Text style={styles.queueBadgeText}>
                      Struk {((queueIndex || 0) + 1)} dari {queueTotal}
                    </Text>
                  </View>
                )}
              </View>
              <Text style={styles.subtitle} numberOfLines={1}>
                {queueTotal !== undefined && queueTotal > 1
                  ? `Memeriksa struk ke-${(queueIndex || 0) + 1}. Simpan untuk lanjut.`
                  : 'Verifikasi tanggal, jam, dan item transaksi'}
              </Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Ionicons name="close" size={20} color={Palette.darkTextSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.scrollArea}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Merchant Name Input */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Nama Toko / Merchant / Penjual</Text>
              <TextInput
                style={styles.input}
                value={merchantName}
                onChangeText={setMerchantName}
                placeholder="Misal: ShopeeFood, Indomaret, Superindo"
                placeholderTextColor={Palette.darkTextMuted}
              />
            </View>

            {/* Tanggal & Waktu Transaksi Grid */}
            <View style={styles.dateTimeRow}>
              <View style={[styles.fieldGroup, { flex: 1.1 }]}>
                <Text style={styles.fieldLabel}>Tanggal Transaksi</Text>
                <View style={styles.inputWithIcon}>
                  <Ionicons name="calendar-outline" size={15} color={Palette.primary} />
                  <TextInput
                    style={styles.innerInput}
                    value={transactionDate}
                    onChangeText={setTransactionDate}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={Palette.darkTextMuted}
                  />
                </View>
              </View>

              <View style={[styles.fieldGroup, { flex: 0.9 }]}>
                <Text style={styles.fieldLabel}>Waktu (Jam:Menit)</Text>
                <View style={styles.inputWithIcon}>
                  <Ionicons name="time-outline" size={15} color={Palette.primary} />
                  <TextInput
                    style={styles.innerInput}
                    value={transactionTime}
                    onChangeText={setTransactionTime}
                    placeholder="HH:mm"
                    placeholderTextColor={Palette.darkTextMuted}
                  />
                </View>
              </View>
            </View>

            {/* Category & Payment Method Dropdown Row */}
            <View style={styles.twoColRow}>
              {/* Category Dropdown Picker */}
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>Kategori Pengeluaran</Text>
                <TouchableOpacity
                  style={styles.pickerTriggerBtn}
                  onPress={() => setShowCategoryPicker(true)}
                  activeOpacity={0.8}
                >
                  <View style={styles.pickerTriggerLeft}>
                    <View
                      style={[
                        styles.pickerIconBadge,
                        { backgroundColor: `${currentCategory?.color || Palette.primary}25` },
                      ]}
                    >
                      <Ionicons
                        name={(currentCategory?.icon as any) || 'pricetag'}
                        size={15}
                        color={currentCategory?.color || Palette.primary}
                      />
                    </View>
                    <Text style={[styles.pickerTriggerText, { color: Palette.darkText }]} numberOfLines={1}>
                      {currentCategory?.name || 'Pilih Kategori'}
                    </Text>
                  </View>
                  <Ionicons name="chevron-down" size={16} color={Palette.darkTextSecondary} />
                </TouchableOpacity>
              </View>

              {/* Payment Method Dropdown Picker */}
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>Metode Pembayaran</Text>
                <TouchableOpacity
                  style={styles.pickerTriggerBtn}
                  onPress={() => setShowPaymentPicker(true)}
                  activeOpacity={0.8}
                >
                  <View style={styles.pickerTriggerLeft}>
                    <View
                      style={[
                        styles.pickerIconBadge,
                        { backgroundColor: 'rgba(88, 101, 242, 0.2)' },
                      ]}
                    >
                      <Ionicons
                        name={(currentPayment?.icon as any) || 'wallet-outline'}
                        size={15}
                        color={Palette.primary}
                      />
                    </View>
                    <Text style={[styles.pickerTriggerText, { color: Palette.darkText }]} numberOfLines={1}>
                      {currentPayment?.label || 'Pilih Metode'}
                    </Text>
                  </View>
                  <Ionicons name="chevron-down" size={16} color={Palette.darkTextSecondary} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Item Breakdown List */}
            <View style={styles.fieldGroup}>
              <View style={styles.itemHeaderRow}>
                <Text style={styles.fieldLabel}>
                  Daftar Menu / Barang ({items.length} Item)
                </Text>
                <TouchableOpacity style={styles.addItemBtn} onPress={handleAddItem}>
                  <Ionicons name="add-circle" size={15} color={Palette.primary} />
                  <Text style={styles.addItemText}>Tambah</Text>
                </TouchableOpacity>
              </View>

              {items.map((item, idx) => (
                <View key={idx} style={styles.itemCard}>
                  <View style={styles.itemTopRow}>
                    <TextInput
                      style={styles.itemNameInput}
                      value={item.item_name}
                      onChangeText={(val) => handleUpdateItem(idx, 'item_name', val)}
                      placeholder="Nama Menu / Barang"
                      placeholderTextColor={Palette.darkTextMuted}
                    />
                    <TouchableOpacity onPress={() => handleRemoveItem(idx)}>
                      <Ionicons name="trash-outline" size={17} color={Palette.coral} />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.itemBottomRow}>
                    <View style={styles.itemFieldSmall}>
                      <Text style={styles.itemFieldLabel}>Qty</Text>
                      <TextInput
                        style={styles.itemInputSmall}
                        value={String(item.quantity)}
                        onChangeText={(val) => handleUpdateItem(idx, 'quantity', val)}
                        keyboardType="numeric"
                      />
                    </View>

                    <View style={styles.itemFieldMed}>
                      <Text style={styles.itemFieldLabel}>Harga Satuan</Text>
                      <TextInput
                        style={styles.itemInputSmall}
                        value={String(item.unit_price)}
                        onChangeText={(val) => handleUpdateItem(idx, 'unit_price', val)}
                        keyboardType="numeric"
                      />
                    </View>

                    <View style={styles.itemTotalCol}>
                      <Text style={styles.itemFieldLabel}>Total</Text>
                      <Text style={styles.itemTotalValue}>{formatRupiah(item.total_price)}</Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>

            {/* Financial Summary & Breakdown Box */}
            <View style={styles.summaryCard}>
              <Text style={styles.summaryCardHeader}>Ringkasan Nominal Transaksi</Text>

              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Subtotal Menu/Item:</Text>
                <Text style={styles.summaryVal}>{formatRupiah(itemsSubtotal)}</Text>
              </View>

              {/* Biaya Layanan */}
              {(Number(adminFee) > 0 || showExtraFees) && (
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Biaya Layanan & Lain:</Text>
                  <TextInput
                    style={styles.summaryInput}
                    value={adminFee}
                    onChangeText={setAdminFee}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor={Palette.darkTextMuted}
                  />
                </View>
              )}

              {/* Ongkir */}
              {(Number(shippingFee) > 0 || showExtraFees) && (
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Ongkos Kirim:</Text>
                  <TextInput
                    style={styles.summaryInput}
                    value={shippingFee}
                    onChangeText={setShippingFee}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor={Palette.darkTextMuted}
                  />
                </View>
              )}

              {/* Pajak */}
              {(Number(taxAmount) > 0 || showExtraFees) && (
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Pajak / PPN:</Text>
                  <TextInput
                    style={styles.summaryInput}
                    value={taxAmount}
                    onChangeText={setTaxAmount}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor={Palette.darkTextMuted}
                  />
                </View>
              )}

              {/* Diskon */}
              {(Number(discountAmount) > 0 || showExtraFees) && (
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Voucher / Diskon:</Text>
                  <TextInput
                    style={[styles.summaryInput, { color: Palette.coral }]}
                    value={discountAmount}
                    onChangeText={setDiscountAmount}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor={Palette.darkTextMuted}
                  />
                </View>
              )}

              {/* Toggle Biaya Tambahan */}
              <TouchableOpacity
                style={{ paddingVertical: 4, alignItems: 'flex-start', marginVertical: 2 }}
                onPress={() => setShowExtraFees((prev) => !prev)}
              >
                <Text style={{ fontSize: 11, color: Palette.primary, fontWeight: '600' }}>
                  {showExtraFees ? '▴ Sembunyikan Opsi Biaya' : '+ Tambah Ongkir / Diskon / Biaya Lain'}
                </Text>
              </TouchableOpacity>

              <View style={[styles.summaryRow, styles.summaryTotalRow]}>
                <View style={{ flex: 1, paddingRight: 6 }}>
                  <Text style={styles.summaryTotalLabel}>Total Belanja:</Text>
                  <Text style={styles.summaryTotalHint}>*Sesuai total struk</Text>
                </View>
                <View style={styles.totalInputWrapper}>
                  <Text style={styles.rpPrefix}>Rp</Text>
                  <TextInput
                    style={styles.totalInputField}
                    value={totalAmount}
                    onChangeText={setTotalAmount}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor={Palette.darkTextMuted}
                  />
                </View>
              </View>
            </View>

            {/* Notes Input */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Catatan Tambahan (Opsional)</Text>
              <TextInput
                style={[styles.input, { height: 54 }]}
                value={notes}
                onChangeText={setNotes}
                placeholder="Misal: Nomor pesanan, catatan pedas, dll."
                placeholderTextColor={Palette.darkTextMuted}
                multiline
              />
            </View>

            {/* Lampiran Foto Struk / Bukti */}
            <View style={styles.fieldGroup}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <Text style={styles.fieldLabel}>Foto / Lampiran Struk</Text>
                <TouchableOpacity
                  style={styles.attachPhotoBtn}
                  onPress={handlePickAttachment}
                  activeOpacity={0.8}
                >
                  <Ionicons name="camera" size={13} color={Palette.primary} />
                  <Text style={styles.attachPhotoBtnText}>
                    {attachedPhotoUri ? 'Ganti Foto' : '+ Lampirkan Foto'}
                  </Text>
                </TouchableOpacity>
              </View>

              {attachedPhotoUri ? (
                <View style={styles.photoPreviewCard}>
                  <Image source={{ uri: attachedPhotoUri }} style={styles.photoThumb} resizeMode="cover" />
                  <View style={{ flex: 1, paddingHorizontal: 12 }}>
                    <Text style={styles.photoThumbTitle} numberOfLines={1}>
                      Foto Struk Terlampir
                    </Text>
                    <Text style={styles.photoThumbSub}>Tersimpan ke arsip Google Drive & transaksi</Text>
                  </View>
                  <TouchableOpacity onPress={() => setAttachedPhotoUri(null)} style={styles.removePhotoBtn}>
                    <Ionicons name="trash-outline" size={16} color={Palette.coral} />
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.emptyPhotoBox}
                  onPress={handlePickAttachment}
                  activeOpacity={0.7}
                >
                  <Ionicons name="image-outline" size={22} color={Palette.darkTextMuted} />
                  <Text style={styles.emptyPhotoText}>
                    Belum ada foto. Klik di sini untuk melampirkan foto struk fisik / bukti pembayaran
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </ScrollView>

          {/* Action Buttons */}
          <View style={styles.footer}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelBtnText}>Batal</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
              <Ionicons
                name={queueTotal && queueTotal > 1 && (queueIndex || 0) + 1 < queueTotal ? "arrow-forward-circle" : "checkmark-circle"}
                size={17}
                color="#FFFFFF"
              />
              <Text style={styles.saveBtnText}>
                {queueTotal && queueTotal > 1 && (queueIndex || 0) + 1 < queueTotal
                  ? `Simpan & Lanjut ke Struk ${(queueIndex || 0) + 2}`
                  : 'Simpan Transaksi'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* Pop-up Modal Pilih Kategori (Sama seperti Filter Kategori di Transaksi) */}
      <Modal visible={showCategoryPicker} transparent animationType="fade">
        <TouchableOpacity
          style={styles.popupOverlay}
          activeOpacity={1}
          onPress={() => setShowCategoryPicker(false)}
        >
          <View style={styles.popupCard}>
            <View style={styles.popupHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="funnel" size={18} color={Palette.primary} />
                <Text style={styles.popupTitle}>Pilih Kategori</Text>
              </View>
              <TouchableOpacity
                style={styles.popupCloseBtn}
                onPress={() => setShowCategoryPicker(false)}
              >
                <Ionicons name="close" size={16} color={Palette.darkTextSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
              {categories
                .filter((c) => c.type === 'expense')
                .map((cat) => {
                  const isSelected = selectedCategoryId === cat.id;
                  return (
                    <TouchableOpacity
                      key={cat.id}
                      style={[
                        styles.popupOptionItem,
                        isSelected && { backgroundColor: `${cat.color}20` },
                      ]}
                      onPress={() => {
                        setSelectedCategoryId(cat.id);
                        setShowCategoryPicker(false);
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                        <View
                          style={[
                            styles.popupIconBox,
                            { backgroundColor: isSelected ? cat.color : `${cat.color}25` },
                          ]}
                        >
                          <Ionicons
                            name={(cat.icon as any) || 'pricetag'}
                            size={16}
                            color={isSelected ? '#FFFFFF' : cat.color}
                          />
                        </View>
                        <Text
                          style={[
                            styles.popupOptionName,
                            {
                              color: isSelected ? cat.color : Palette.darkText,
                              fontWeight: isSelected ? '700' : '500',
                            },
                          ]}
                        >
                          {cat.name}
                        </Text>
                      </View>
                      {isSelected && (
                        <Ionicons name="checkmark-circle" size={20} color={cat.color} />
                      )}
                    </TouchableOpacity>
                  );
                })}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Pop-up Modal Pilih Metode Pembayaran */}
      <Modal visible={showPaymentPicker} transparent animationType="fade">
        <TouchableOpacity
          style={styles.popupOverlay}
          activeOpacity={1}
          onPress={() => setShowPaymentPicker(false)}
        >
          <View style={styles.popupCard}>
            <View style={styles.popupHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="wallet-outline" size={18} color={Palette.primary} />
                <Text style={styles.popupTitle}>Pilih Metode Pembayaran</Text>
              </View>
              <TouchableOpacity
                style={styles.popupCloseBtn}
                onPress={() => setShowPaymentPicker(false)}
              >
                <Ionicons name="close" size={16} color={Palette.darkTextSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
              {PAYMENT_METHODS.map((pm) => {
                const isSelected = paymentMethod === pm.value;
                return (
                  <TouchableOpacity
                    key={pm.value}
                    style={[
                      styles.popupOptionItem,
                      isSelected && { backgroundColor: 'rgba(88, 101, 242, 0.18)' },
                    ]}
                    onPress={() => {
                      setPaymentMethod(pm.value);
                      setShowPaymentPicker(false);
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                      <View
                        style={[
                          styles.popupIconBox,
                          {
                            backgroundColor: isSelected
                              ? Palette.primary
                              : 'rgba(88, 101, 242, 0.2)',
                          },
                        ]}
                      >
                        <Ionicons
                          name={pm.icon as any}
                          size={16}
                          color={isSelected ? '#FFFFFF' : Palette.primary}
                        />
                      </View>
                      <Text
                        style={[
                          styles.popupOptionName,
                          {
                            color: isSelected ? Palette.primary : Palette.darkText,
                            fontWeight: isSelected ? '700' : '500',
                          },
                        ]}
                      >
                        {pm.label}
                      </Text>
                    </View>
                    {isSelected && (
                      <Ionicons name="checkmark-circle" size={20} color={Palette.primary} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: Palette.darkCard,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '92%',
    paddingBottom: Platform.OS === 'ios' ? 24 : 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    color: Palette.darkText,
  },
  queueBadge: {
    backgroundColor: 'rgba(88, 101, 242, 0.25)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(88, 101, 242, 0.5)',
  },
  queueBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: Palette.primaryLight,
  },
  subtitle: {
    fontSize: 11,
    color: Palette.darkTextSecondary,
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollArea: {
    flexGrow: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 20,
  },
  fieldGroup: {
    marginBottom: 14,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Palette.darkTextSecondary,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: Palette.darkText,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  dateTimeRow: {
    flexDirection: 'row',
    gap: 10,
  },
  inputWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 10,
    paddingHorizontal: 10,
    height: 40,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  innerInput: {
    flex: 1,
    color: Palette.darkText,
    fontSize: 12,
  },
  chipRow: {
    flexDirection: 'row',
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginRight: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 5,
  },
  categoryChipText: {
    fontSize: 11,
    color: Palette.darkTextSecondary,
  },
  paymentGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  paymentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  paymentButtonText: {
    fontSize: 11,
    color: Palette.darkTextSecondary,
  },
  itemHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  addItemBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  addItemText: {
    fontSize: 11,
    fontWeight: '700',
    color: Palette.primary,
  },
  itemCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  itemTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  itemNameInput: {
    flex: 1,
    color: Palette.darkText,
    fontSize: 12,
    fontWeight: '600',
    marginRight: 6,
  },
  itemBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  itemFieldSmall: {
    width: 48,
  },
  itemFieldMed: {
    flex: 1,
    minWidth: 80,
  },
  itemFieldLabel: {
    fontSize: 9,
    color: Palette.darkTextMuted,
    marginBottom: 2,
  },
  itemInputSmall: {
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
    color: Palette.darkText,
    fontSize: 11,
  },
  itemTotalCol: {
    minWidth: 70,
    alignItems: 'flex-end',
  },
  itemTotalValue: {
    fontSize: 11,
    fontWeight: '700',
    color: Palette.darkText,
    marginTop: 2,
  },
  summaryCard: {
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    borderRadius: 14,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  summaryCardHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: Palette.darkText,
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
    paddingBottom: 4,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  summaryLabel: {
    fontSize: 12,
    color: Palette.darkTextSecondary,
  },
  summaryVal: {
    fontSize: 12,
    fontWeight: '600',
    color: Palette.darkText,
  },
  summaryInput: {
    width: 80,
    textAlign: 'right',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
    color: Palette.darkText,
    fontSize: 12,
    fontWeight: '600',
  },
  summaryTotalRow: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    paddingTop: 8,
    marginTop: 4,
    marginBottom: 0,
    gap: 6,
  },
  summaryTotalLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: Palette.darkText,
  },
  summaryTotalHint: {
    fontSize: 9,
    color: Palette.darkTextMuted,
    marginTop: 1,
  },
  totalInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(88, 101, 242, 0.15)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: 'rgba(88, 101, 242, 0.4)',
    maxWidth: '55%',
  },
  rpPrefix: {
    color: Palette.primaryLight,
    fontWeight: '800',
    fontSize: 12,
  },
  totalInputField: {
    color: Palette.primaryLight,
    fontSize: 14,
    fontWeight: '800',
    minWidth: 55,
    textAlign: 'right',
  },
  footer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
  },
  cancelBtnText: {
    color: Palette.darkTextSecondary,
    fontWeight: '700',
    fontSize: 13,
  },
  saveBtn: {
    flex: 2,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: Palette.primary,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  twoColRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  pickerTriggerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  pickerTriggerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    marginRight: 6,
  },
  pickerIconBadge: {
    width: 24,
    height: 24,
    borderRadius: 7,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerTriggerText: {
    fontSize: 13,
    fontWeight: '600',
  },
  popupOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  popupCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: Palette.darkCard,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  popupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  popupTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Palette.darkText,
  },
  popupCloseBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  popupOptionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 6,
  },
  popupIconBox: {
    width: 32,
    height: 32,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
  },
  popupOptionName: {
    fontSize: 13,
  },
  attachPhotoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(88, 101, 242, 0.12)',
  },
  attachPhotoBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: Palette.primary,
  },
  photoPreviewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    padding: 8,
  },
  photoThumb: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: '#000',
  },
  photoThumbTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: Palette.darkText,
  },
  photoThumbSub: {
    fontSize: 10,
    color: Palette.darkTextMuted,
    marginTop: 2,
  },
  removePhotoBtn: {
    padding: 8,
    borderRadius: 8,
  },
  emptyPhotoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(255, 255, 255, 0.15)',
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
  },
  emptyPhotoText: {
    flex: 1,
    fontSize: 11,
    color: Palette.darkTextMuted,
    lineHeight: 16,
  },
});
