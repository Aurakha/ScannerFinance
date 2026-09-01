import React, { useState } from 'react';
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Palette } from '@/constants/theme';
import { Category, PaymentMethod, ReceiptScanResult, TransactionItem } from '@/types';
import { DEFAULT_CATEGORIES } from '@/constants/categories';
import { formatRupiah } from '@/utils/formatters';

interface ReceiptVerifyModalProps {
  visible: boolean;
  scanData: ReceiptScanResult | null;
  categories?: Category[];
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
    const found = categories.find((c) => c.name === scanData.suggested_category);
    return found ? found.id : categories[0]?.id || 'cat-makanan';
  });
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(
    scanData.payment_method || 'e-wallet'
  );
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

  // Total Belanja: Selalu mengunci nilai TOTAL AKHIR yang tertera di struk
  const [totalAmount, setTotalAmount] = useState<string>(() => {
    return String(scanData.total_amount || scanData.subtotal || 0);
  });

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
              <Text style={styles.title} numberOfLines={1}>
                Konfirmasi Hasil Ekstraksi
              </Text>
              <Text style={styles.subtitle} numberOfLines={1}>
                Verifikasi tanggal, jam, dan item
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

            {/* Category Selector */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Kategori Pengeluaran</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
                {categories
                  .filter((c) => c.type === 'expense')
                  .map((cat) => {
                    const isSelected = selectedCategoryId === cat.id;
                    return (
                      <TouchableOpacity
                        key={cat.id}
                        style={[
                          styles.categoryChip,
                          isSelected && {
                            backgroundColor: `${cat.color}25`,
                            borderColor: cat.color,
                          },
                        ]}
                        onPress={() => setSelectedCategoryId(cat.id)}
                      >
                        <View style={[styles.dot, { backgroundColor: cat.color }]} />
                        <Text
                          style={[
                            styles.categoryChipText,
                            isSelected && { color: cat.color, fontWeight: '700' },
                          ]}
                        >
                          {cat.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
              </ScrollView>
            </View>

            {/* Payment Method Selector */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Metode Pembayaran</Text>
              <View style={styles.paymentGrid}>
                {PAYMENT_METHODS.map((pm) => {
                  const isSelected = paymentMethod === pm.value;
                  return (
                    <TouchableOpacity
                      key={pm.value}
                      style={[
                        styles.paymentButton,
                        isSelected && {
                          borderColor: Palette.primary,
                          backgroundColor: 'rgba(88, 101, 242, 0.15)',
                        },
                      ]}
                      onPress={() => setPaymentMethod(pm.value)}
                    >
                      <Ionicons
                        name={pm.icon as any}
                        size={15}
                        color={isSelected ? Palette.primary : Palette.darkTextSecondary}
                      />
                      <Text
                        style={[
                          styles.paymentButtonText,
                          isSelected && { color: Palette.primary, fontWeight: '700' },
                        ]}
                      >
                        {pm.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
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
          </ScrollView>

          {/* Action Buttons */}
          <View style={styles.footer}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelBtnText}>Batal</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
              <Ionicons name="checkmark-circle" size={17} color="#FFFFFF" />
              <Text style={styles.saveBtnText}>Simpan</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
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
});
