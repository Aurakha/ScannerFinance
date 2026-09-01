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
    return found ? found.id : categories[0]?.id || 'cat-belanja';
  });
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(
    scanData.payment_method || 'qris'
  );
  const [items, setItems] = useState<TransactionItem[]>(() => {
    return (scanData.items || []).map((it) => ({
      item_name: it.item_name,
      quantity: it.quantity || 1,
      unit_price: it.unit_price || 0,
      total_price: it.total_price || (it.quantity || 1) * (it.unit_price || 0),
    }));
  });
  const [taxAmount, setTaxAmount] = useState<string>(String(scanData.tax_amount || 0));
  const [discountAmount, setDiscountAmount] = useState<string>(String(scanData.discount_amount || 0));
  const [notes, setNotes] = useState<string>(scanData.notes || '');

  // Hitung ulang total otomatis jika items berubah
  const itemsSubtotal = items.reduce((sum, it) => sum + (Number(it.total_price) || 0), 0);
  const numericTax = Number(taxAmount) || 0;
  const numericDiscount = Number(discountAmount) || 0;
  const calculatedTotal = Math.max(0, itemsSubtotal + numericTax - numericDiscount);

  const handleAddItem = () => {
    setItems([
      ...items,
      { item_name: 'Item Baru', quantity: 1, unit_price: 10000, total_price: 10000 },
    ]);
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

    onConfirmSave({
      merchant_name: merchantName,
      transaction_date: finalIso,
      category_id: selectedCategoryId,
      payment_method: paymentMethod,
      subtotal: itemsSubtotal > 0 ? itemsSubtotal : scanData.subtotal || calculatedTotal,
      tax_amount: numericTax,
      discount_amount: numericDiscount,
      total_amount: calculatedTotal > 0 ? calculatedTotal : scanData.total_amount || 0,
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
            <View>
              <Text style={styles.title}>Konfirmasi Hasil Ekstraksi</Text>
              <Text style={styles.subtitle}>Verifikasi tanggal, jam, dan item sebelum disimpan</Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Ionicons name="close" size={22} color={Palette.darkTextSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false}>
            {/* Merchant Name Input */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Nama Toko / Merchant / Penjual</Text>
              <TextInput
                style={styles.input}
                value={merchantName}
                onChangeText={setMerchantName}
                placeholder="Misal: Indomaret, Superindo, Gojek"
                placeholderTextColor={Palette.darkTextMuted}
              />
            </View>

            {/* Tanggal & Waktu Transaksi Grid */}
            <View style={styles.dateTimeRow}>
              <View style={[styles.fieldGroup, { flex: 1.2 }]}>
                <Text style={styles.fieldLabel}>Tanggal Transaksi</Text>
                <View style={styles.inputWithIcon}>
                  <Ionicons name="calendar-outline" size={16} color={Palette.primary} />
                  <TextInput
                    style={styles.innerInput}
                    value={transactionDate}
                    onChangeText={setTransactionDate}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={Palette.darkTextMuted}
                  />
                </View>
              </View>

              <View style={[styles.fieldGroup, { flex: 0.8 }]}>
                <Text style={styles.fieldLabel}>Waktu (Jam:Menit)</Text>
                <View style={styles.inputWithIcon}>
                  <Ionicons name="time-outline" size={16} color={Palette.primary} />
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
                        size={16}
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
                  Rincian Barang & Biaya Jasa ({items.length} Baris)
                </Text>
                <TouchableOpacity style={styles.addItemBtn} onPress={handleAddItem}>
                  <Ionicons name="add-circle" size={16} color={Palette.primary} />
                  <Text style={styles.addItemText}>Tambah Item</Text>
                </TouchableOpacity>
              </View>

              {items.map((item, idx) => (
                <View key={idx} style={styles.itemCard}>
                  <View style={styles.itemTopRow}>
                    <TextInput
                      style={styles.itemNameInput}
                      value={item.item_name}
                      onChangeText={(val) => handleUpdateItem(idx, 'item_name', val)}
                      placeholder="Nama Barang / Ongkir / Admin"
                      placeholderTextColor={Palette.darkTextMuted}
                    />
                    <TouchableOpacity onPress={() => handleRemoveItem(idx)}>
                      <Ionicons name="trash-outline" size={18} color={Palette.coral} />
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

            {/* Financial Summary Box */}
            <View style={styles.summaryCard}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Subtotal Item:</Text>
                <Text style={styles.summaryVal}>{formatRupiah(itemsSubtotal)}</Text>
              </View>

              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Pajak (PPN/PB1):</Text>
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
                <Text style={styles.summaryLabel}>Diskon / Voucher:</Text>
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
                <Text style={styles.summaryTotalLabel}>Total Akhir:</Text>
                <Text style={styles.summaryTotalVal}>{formatRupiah(calculatedTotal)}</Text>
              </View>
            </View>

            {/* Notes Input */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Catatan Tambahan (Opsional)</Text>
              <TextInput
                style={[styles.input, { height: 60 }]}
                value={notes}
                onChangeText={setNotes}
                placeholder="Misal: Nomor kuitansi, nama kasir, atau keperluan kantor"
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
              <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
              <Text style={styles.saveBtnText}>Simpan Transaksi</Text>
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
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '92%',
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: Palette.darkText,
  },
  subtitle: {
    fontSize: 12,
    color: Palette.darkTextSecondary,
    marginTop: 2,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollArea: {
    padding: 20,
  },
  fieldGroup: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Palette.darkTextSecondary,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: Palette.darkText,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  dateTimeRow: {
    flexDirection: 'row',
    gap: 12,
  },
  inputWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  innerInput: {
    flex: 1,
    color: Palette.darkText,
    fontSize: 13,
  },
  chipRow: {
    flexDirection: 'row',
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginRight: 8,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  categoryChipText: {
    fontSize: 12,
    color: Palette.darkTextSecondary,
  },
  paymentGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  paymentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  paymentButtonText: {
    fontSize: 12,
    color: Palette.darkTextSecondary,
  },
  itemHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  addItemBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  addItemText: {
    fontSize: 12,
    fontWeight: '700',
    color: Palette.primary,
  },
  itemCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  itemTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  itemNameInput: {
    flex: 1,
    color: Palette.darkText,
    fontSize: 13,
    fontWeight: '600',
    marginRight: 8,
  },
  itemBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  itemFieldSmall: {
    width: 60,
  },
  itemFieldMed: {
    flex: 1,
  },
  itemFieldLabel: {
    fontSize: 10,
    color: Palette.darkTextMuted,
    marginBottom: 2,
  },
  itemInputSmall: {
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    color: Palette.darkText,
    fontSize: 12,
  },
  itemTotalCol: {
    width: 90,
    alignItems: 'flex-end',
  },
  itemTotalValue: {
    fontSize: 12,
    fontWeight: '700',
    color: Palette.darkText,
    marginTop: 4,
  },
  summaryCard: {
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 13,
    color: Palette.darkTextSecondary,
  },
  summaryVal: {
    fontSize: 13,
    fontWeight: '600',
    color: Palette.darkText,
  },
  summaryInput: {
    width: 100,
    textAlign: 'right',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    color: Palette.darkText,
    fontSize: 13,
    fontWeight: '600',
  },
  summaryTotalRow: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    paddingTop: 10,
    marginTop: 4,
    marginBottom: 0,
  },
  summaryTotalLabel: {
    fontSize: 15,
    fontWeight: '800',
    color: Palette.darkText,
  },
  summaryTotalVal: {
    fontSize: 17,
    fontWeight: '800',
    color: Palette.primaryLight,
  },
  footer: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
  },
  cancelBtnText: {
    color: Palette.darkTextSecondary,
    fontWeight: '700',
    fontSize: 14,
  },
  saveBtn: {
    flex: 2,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: Palette.primary,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
});
