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

  const [merchantName, setMerchantName] = useState(scanData.merchant_name || 'Toko Belanja');
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

    onConfirmSave({
      merchant_name: merchantName,
      transaction_date: scanData.transaction_date || new Date().toISOString(),
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
              <Text style={styles.title}>Konfirmasi Hasil Scan</Text>
              <Text style={styles.subtitle}>Verifikasi & sesuaikan data sebelum disimpan</Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Ionicons name="close" size={22} color={Palette.darkTextSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false}>
            {/* Merchant Name Input */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Nama Toko / Merchant</Text>
              <TextInput
                style={styles.input}
                value={merchantName}
                onChangeText={setMerchantName}
                placeholder="Misal: Indomaret, Kopi Kenangan"
                placeholderTextColor={Palette.darkTextMuted}
              />
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
                          backgroundColor: 'rgba(16, 185, 129, 0.12)',
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

            {/* Items Breakdown Table */}
            <View style={styles.fieldGroup}>
              <View style={styles.itemsHeaderRow}>
                <Text style={styles.fieldLabel}>Rincian Barang ({items.length})</Text>
                <TouchableOpacity style={styles.addItemBtn} onPress={handleAddItem}>
                  <Ionicons name="add-circle-outline" size={16} color={Palette.primary} />
                  <Text style={styles.addItemText}>Tambah Item</Text>
                </TouchableOpacity>
              </View>

              {items.map((it, idx) => (
                <View key={idx} style={styles.itemRow}>
                  <View style={styles.itemMainInfo}>
                    <TextInput
                      style={styles.itemNameInput}
                      value={it.item_name}
                      onChangeText={(val) => handleUpdateItem(idx, 'item_name', val)}
                      placeholder="Nama Barang"
                      placeholderTextColor={Palette.darkTextMuted}
                    />
                    <View style={styles.itemQtyPriceRow}>
                      <TextInput
                        style={styles.itemQtyInput}
                        value={String(it.quantity)}
                        keyboardType="numeric"
                        onChangeText={(val) =>
                          handleUpdateItem(idx, 'quantity', Number(val) || 1)
                        }
                        placeholder="1"
                        placeholderTextColor={Palette.darkTextMuted}
                      />
                      <Text style={styles.itemMultiplyText}>×</Text>
                      <TextInput
                        style={styles.itemPriceInput}
                        value={String(it.unit_price)}
                        keyboardType="numeric"
                        onChangeText={(val) =>
                          handleUpdateItem(idx, 'unit_price', Number(val) || 0)
                        }
                        placeholder="Harga"
                        placeholderTextColor={Palette.darkTextMuted}
                      />
                    </View>
                  </View>

                  <View style={styles.itemRightAction}>
                    <Text style={styles.itemTotalText}>{formatRupiah(it.total_price)}</Text>
                    <TouchableOpacity
                      onPress={() => handleRemoveItem(idx)}
                      style={styles.deleteItemBtn}
                    >
                      <Ionicons name="trash-outline" size={16} color={Palette.coral} />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>

            {/* Tax & Discount */}
            <View style={styles.taxDiscountRow}>
              <View style={[styles.fieldGroup, { flex: 1, marginRight: 8 }]}>
                <Text style={styles.fieldLabel}>Pajak (PPN/PB1)</Text>
                <TextInput
                  style={styles.input}
                  value={taxAmount}
                  keyboardType="numeric"
                  onChangeText={setTaxAmount}
                  placeholder="0"
                  placeholderTextColor={Palette.darkTextMuted}
                />
              </View>

              <View style={[styles.fieldGroup, { flex: 1, marginLeft: 8 }]}>
                <Text style={styles.fieldLabel}>Diskon / Hemat</Text>
                <TextInput
                  style={styles.input}
                  value={discountAmount}
                  keyboardType="numeric"
                  onChangeText={setDiscountAmount}
                  placeholder="0"
                  placeholderTextColor={Palette.darkTextMuted}
                />
              </View>
            </View>

            {/* Notes */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Catatan (Opsional)</Text>
              <TextInput
                style={[styles.input, { minHeight: 60, textAlignVertical: 'top' }]}
                value={notes}
                onChangeText={setNotes}
                multiline
                placeholder="Catatan belanja, nama kasir, nomor struk..."
                placeholderTextColor={Palette.darkTextMuted}
              />
            </View>

            {/* Total Calculation Card */}
            <View style={styles.totalCard}>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Subtotal Item:</Text>
                <Text style={styles.totalValue}>{formatRupiah(itemsSubtotal)}</Text>
              </View>
              {numericTax > 0 && (
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Pajak:</Text>
                  <Text style={styles.totalValue}>+{formatRupiah(numericTax)}</Text>
                </View>
              )}
              {numericDiscount > 0 && (
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Potongan Diskon:</Text>
                  <Text style={[styles.totalValue, { color: Palette.coral }]}>
                    -{formatRupiah(numericDiscount)}
                  </Text>
                </View>
              )}
              <View style={[styles.totalRow, styles.finalTotalRow]}>
                <Text style={styles.finalTotalLabel}>Total Belanja:</Text>
                <Text style={styles.finalTotalValue}>{formatRupiah(calculatedTotal)}</Text>
              </View>
            </View>
          </ScrollView>

          {/* Bottom Action Footer */}
          <View style={styles.footer}>
            <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelText}>Batal</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
              <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
              <Text style={styles.saveText}>Simpan Transaksi</Text>
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
    backgroundColor: 'rgba(9, 13, 22, 0.75)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: Palette.darkBg,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '92%',
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
    fontWeight: '600',
    color: Palette.darkTextSecondary,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: Palette.darkCard,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    color: Palette.darkText,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
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
    backgroundColor: Palette.darkCard,
    marginRight: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  categoryChipText: {
    fontSize: 12,
    color: Palette.darkText,
    fontWeight: '500',
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
    backgroundColor: Palette.darkCard,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  paymentButtonText: {
    fontSize: 12,
    color: Palette.darkText,
    fontWeight: '500',
  },
  itemsHeaderRow: {
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
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Palette.darkCard,
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  itemMainInfo: {
    flex: 1,
    marginRight: 10,
  },
  itemNameInput: {
    fontSize: 13,
    fontWeight: '600',
    color: Palette.darkText,
    marginBottom: 4,
    padding: 0,
  },
  itemQtyPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemQtyInput: {
    fontSize: 12,
    color: Palette.darkTextSecondary,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    minWidth: 28,
    textAlign: 'center',
  },
  itemMultiplyText: {
    marginHorizontal: 6,
    color: Palette.darkTextMuted,
    fontSize: 12,
  },
  itemPriceInput: {
    fontSize: 12,
    color: Palette.darkTextSecondary,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    minWidth: 70,
  },
  itemRightAction: {
    alignItems: 'flex-end',
    gap: 6,
  },
  itemTotalText: {
    fontSize: 13,
    fontWeight: '700',
    color: Palette.darkText,
  },
  deleteItemBtn: {
    padding: 4,
  },
  taxDiscountRow: {
    flexDirection: 'row',
  },
  totalCard: {
    backgroundColor: Palette.darkCard,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginTop: 8,
    marginBottom: 24,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  totalLabel: {
    fontSize: 13,
    color: Palette.darkTextSecondary,
  },
  totalValue: {
    fontSize: 13,
    fontWeight: '600',
    color: Palette.darkText,
  },
  finalTotalRow: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    paddingTop: 10,
    marginTop: 6,
    marginBottom: 0,
  },
  finalTotalLabel: {
    fontSize: 15,
    fontWeight: '800',
    color: Palette.darkText,
  },
  finalTotalValue: {
    fontSize: 18,
    fontWeight: '800',
    color: Palette.primary,
  },
  footer: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    backgroundColor: Palette.darkBg,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: Palette.darkTextSecondary,
  },
  saveButton: {
    flex: 2,
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: Palette.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Palette.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  saveText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
