import React, { useState, useEffect, useMemo } from 'react';
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
  useWindowDimensions,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { Palette } from '@/constants/theme';
import { Category, PaymentMethod, ReceiptScanResult, TransactionItem } from '@/types';
import { DEFAULT_CATEGORIES } from '@/constants/categories';
import { formatRupiah } from '@/utils/formatters';

export interface VerifiedReceiptDraft {
  merchant_name: string;
  transaction_date: string;
  transaction_time: string;
  category_id: string;
  payment_method: PaymentMethod;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  shipping_fee: number;
  admin_fee: number;
  total_amount: number;
  notes: string;
  items: TransactionItem[];
  receipt_image_uri?: string;
}

interface ReceiptVerifyModalProps {
  visible: boolean;
  scanData?: ReceiptScanResult | null;
  scanBatch?: ReceiptScanResult[];
  categories?: Category[];
  queueIndex?: number;
  queueTotal?: number;
  onClose: () => void;
  onConfirmSave?: (verifiedData: any) => void;
  onConfirmSaveBatch?: (batchData: VerifiedReceiptDraft[]) => void;
}

export function resolveDirectImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith('data:image') || url.startsWith('blob:') || url.startsWith('file:')) {
    return url;
  }
  const driveMatch = url.match(/\/d\/([a-zA-Z0-9_-]+)/) || url.match(/id=([a-zA-Z0-9_-]+)/);
  if (driveMatch && driveMatch[1]) {
    return `https://drive.google.com/thumbnail?id=${driveMatch[1]}&sz=w1000`;
  }
  return url;
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
  scanBatch,
  categories = DEFAULT_CATEGORIES,
  onClose,
  onConfirmSave,
  onConfirmSaveBatch,
}) => {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 860;
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showPaymentPicker, setShowPaymentPicker] = useState(false);
  const [showExtraFees, setShowExtraFees] = useState(false);

  // Kumpulkan list struk yang akan diverifikasi (mendukung multi-struk batch)
  const initialList = useMemo(() => {
    if (scanBatch && scanBatch.length > 0) return scanBatch;
    if (scanData) return [scanData];
    return [];
  }, [scanBatch, scanData]);

  const [drafts, setDrafts] = useState<VerifiedReceiptDraft[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);

  // Inisialisasi draft saat dialog dibuka atau batch berubah
  useEffect(() => {
    if (initialList.length > 0) {
      const formatted: VerifiedReceiptDraft[] = initialList.map((item) => {
        const d = item.transaction_date ? new Date(item.transaction_date) : new Date();
        const validDate = isNaN(d.getTime()) ? new Date() : d;
        const sug = (item.suggested_category || '').toLowerCase();
        const found = categories.find(
          (c) =>
            c.name.toLowerCase() === sug ||
            c.id.toLowerCase() === sug ||
            sug.includes(c.name.toLowerCase()) ||
            c.name.toLowerCase().includes(sug)
        );

        return {
          merchant_name: item.merchant_name || 'Toko Belanja',
          transaction_date: validDate.toISOString().slice(0, 10),
          transaction_time: validDate.toTimeString().slice(0, 5),
          category_id: found ? found.id : categories[0]?.id || 'cat-operational',
          payment_method: (item.payment_method as PaymentMethod) || 'e-wallet',
          items: (item.items || []).map((it) => ({
            item_name: it.item_name || 'Item',
            quantity: Number(it.quantity) || 1,
            unit_price: Number(it.unit_price) || 0,
            total_price: Number(it.total_price) || (Number(it.quantity) || 1) * (Number(it.unit_price) || 0),
          })),
          admin_fee: Number(item.admin_fee) || 0,
          shipping_fee: Number(item.shipping_fee) || 0,
          tax_amount: Number(item.tax_amount) || 0,
          discount_amount: Number(item.discount_amount) || 0,
          total_amount: Number(item.total_amount) || Number(item.subtotal) || 0,
          subtotal: Number(item.subtotal) || Number(item.total_amount) || 0,
          notes: item.notes || '',
          receipt_image_uri: item.receipt_image_uri || undefined,
        };
      });
      setDrafts(formatted);
      setActiveIndex(0);
    }
  }, [initialList, categories]);

  const currentDraft = drafts[activeIndex] || drafts[0];
  if (!currentDraft && (!scanData && (!scanBatch || scanBatch.length === 0))) return null;
  if (!currentDraft) return null;

  const currentCategory = categories.find((c) => c.id === currentDraft.category_id) || categories[0];
  const currentPayment = PAYMENT_METHODS.find((p) => p.value === currentDraft.payment_method) || PAYMENT_METHODS[0];
  const activeReceiptPhoto = resolveDirectImageUrl(currentDraft.receipt_image_uri);
  const itemsSubtotal = (currentDraft.items || []).reduce((sum, it) => sum + (Number(it.total_price) || 0), 0);

  // Update data struk yang sedang aktif di state batch (perubahan tersimpan otomatis)
  const updateCurrentDraft = (fields: Partial<VerifiedReceiptDraft>) => {
    setDrafts((prev) => {
      const copy = [...prev];
      if (!copy[activeIndex]) return prev;
      copy[activeIndex] = { ...copy[activeIndex], ...fields };
      return copy;
    });
  };

  const handlePickAttachment = async () => {
    if (Platform.OS === 'web') {
      try {
        const res = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          quality: 0.85,
        });
        if (!res.canceled && res.assets?.[0]?.uri) {
          updateCurrentDraft({ receipt_image_uri: res.assets[0].uri });
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
              updateCurrentDraft({ receipt_image_uri: res.assets[0].uri });
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
              updateCurrentDraft({ receipt_image_uri: res.assets[0].uri });
            }
          } catch (err: any) {
            Alert.alert('Error', err.message);
          }
        },
      },
      { text: 'Batal', style: 'cancel' },
    ]);
  };

  const handleAddItem = () => {
    const newItem: TransactionItem = {
      item_name: 'Item Baru',
      quantity: 1,
      unit_price: 10000,
      total_price: 10000,
    };
    const updated = [...(currentDraft.items || []), newItem];
    const newSubtotal = updated.reduce((s, i) => s + (i.total_price || 0), 0);
    updateCurrentDraft({ items: updated, subtotal: newSubtotal });
  };

  const handleUpdateItem = (index: number, field: keyof TransactionItem, value: any) => {
    const updated = [...(currentDraft.items || [])];
    const item = { ...updated[index], [field]: value };
    if (field === 'quantity' || field === 'unit_price') {
      const q = field === 'quantity' ? Number(value) : item.quantity;
      const p = field === 'unit_price' ? Number(value) : item.unit_price;
      item.total_price = (q || 1) * (p || 0);
    }
    updated[index] = item;
    const newSubtotal = updated.reduce((s, i) => s + (i.total_price || 0), 0);
    updateCurrentDraft({ items: updated, subtotal: newSubtotal });
  };

  const handleRemoveItem = (index: number) => {
    const updated = (currentDraft.items || []).filter((_, i) => i !== index);
    const newSubtotal = updated.reduce((s, i) => s + (i.total_price || 0), 0);
    updateCurrentDraft({ items: updated, subtotal: newSubtotal });
  };

  // Simpan seluruh data batch transaksi sekaligus
  const handleSaveBatchFinal = () => {
    for (let i = 0; i < drafts.length; i++) {
      if (!drafts[i].merchant_name.trim()) {
        setActiveIndex(i);
        Alert.alert('Perhatian', `Nama toko pada Struk ${i + 1} tidak boleh kosong.`);
        return;
      }
    }

    if (onConfirmSaveBatch) {
      onConfirmSaveBatch(drafts);
    } else if (onConfirmSave) {
      onConfirmSave(drafts[0]);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[styles.sheetContainer, isDesktop && styles.sheetContainerDesktop]}>
          {/* Header Bar */}
          <View style={styles.header}>
            <View style={{ flex: 1, paddingRight: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <Text style={styles.title}>
                  Konfirmasi Hasil Ekstraksi
                </Text>
                {drafts.length > 1 && (
                  <View style={styles.queueBadge}>
                    <Text style={styles.queueBadgeText}>
                      Struk {activeIndex + 1} dari {drafts.length}
                    </Text>
                  </View>
                )}
              </View>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              {/* Tombol Cepat Simpan Semua jika lebih dari 1 struk (Hanya tampil di Desktop agar tidak menutupi judul di Mobile) */}
              {isDesktop && drafts.length > 1 && (
                <TouchableOpacity
                  style={styles.headerSaveAllBtn}
                  onPress={handleSaveBatchFinal}
                  activeOpacity={0.8}
                >
                  <Ionicons name="checkmark-done" size={14} color="#FFFFFF" />
                  <Text style={styles.headerSaveAllBtnText}>Simpan Semua ({drafts.length})</Text>
                </TouchableOpacity>
              )}

              {isDesktop && activeReceiptPhoto && (
                <TouchableOpacity
                  style={styles.headerPreviewBtn}
                  onPress={() => setIsPreviewModalOpen(true)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="eye-outline" size={14} color={Palette.primary} />
                  <Text style={styles.headerPreviewBtnText}>Pratinjau Foto</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
                <Ionicons name="close" size={20} color={Palette.darkTextSecondary} />
              </TouchableOpacity>
            </View>
          </View>

          {/* TAB BAR NAVIGASI STRUK (Bisa bolak-balik struk 1 sampai terakhir kapan saja) */}
          {drafts.length > 1 && (
            <View style={styles.stepperBar}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.stepperScroll}
              >
                {drafts.map((d, idx) => {
                  const isCur = idx === activeIndex;
                  return (
                    <TouchableOpacity
                      key={idx}
                      style={[
                        styles.stepperPill,
                        isCur && styles.stepperPillActive,
                      ]}
                      onPress={() => setActiveIndex(idx)}
                      activeOpacity={0.8}
                    >
                      <View style={[styles.stepperNumber, isCur && styles.stepperNumberActive]}>
                        <Text style={[styles.stepperNumberText, isCur && styles.stepperNumberTextActive]}>
                          {idx + 1}
                        </Text>
                      </View>
                      <Text
                        style={[styles.stepperLabel, isCur && styles.stepperLabelActive]}
                        numberOfLines={1}
                      >
                        {d.merchant_name || `Struk ${idx + 1}`}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {/* Body Container: 2 Kolom Berdampingan di Desktop, 1 Kolom di HP */}
          <View style={[styles.bodyLayout, isDesktop && styles.bodyLayoutDesktop]}>
            {/* KOLOM KIRI: Tampilan Foto Struk di Layar Desktop */}
            {isDesktop && (
              <View style={styles.desktopPreviewPane}>
                <View style={styles.previewPaneHeader}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons name="receipt-outline" size={15} color={Palette.primary} />
                    <Text style={styles.previewPaneTitle}>Foto Bukti Struk</Text>
                    {drafts.length > 1 && (
                      <View style={styles.previewPaneBadge}>
                        <Text style={styles.previewPaneBadgeText}>Struk {activeIndex + 1}</Text>
                      </View>
                    )}
                  </View>
                  {activeReceiptPhoto && (
                    <TouchableOpacity
                      style={styles.expandPreviewBtn}
                      onPress={() => setIsPreviewModalOpen(true)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="scan-outline" size={13} color={Palette.primary} />
                      <Text style={styles.expandPreviewBtnText}>Layar Penuh</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {activeReceiptPhoto ? (
                  <TouchableOpacity
                    style={styles.desktopImageWrapper}
                    activeOpacity={0.9}
                    onPress={() => setIsPreviewModalOpen(true)}
                  >
                    <Image
                      source={{ uri: activeReceiptPhoto }}
                      style={styles.desktopImage}
                      resizeMode="contain"
                    />
                    <View style={styles.desktopImageHintBar}>
                      <Ionicons name="search" size={12} color="#FFFFFF" />
                      <Text style={styles.desktopImageHintText}>
                        Klik foto untuk memperbesar / layar penuh
                      </Text>
                    </View>
                  </TouchableOpacity>
                ) : (
                  <View style={styles.desktopNoImageContainer}>
                    <Ionicons name="image-outline" size={48} color={Palette.darkTextMuted} />
                    <Text style={styles.desktopNoImageTitle}>Belum Ada Foto Struk</Text>
                    <Text style={styles.desktopNoImageSub}>
                      Lampirkan foto struk fisik agar tersimpan sebagai bukti
                    </Text>
                    <TouchableOpacity
                      style={styles.desktopAttachBtn}
                      onPress={handlePickAttachment}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="camera" size={14} color="#FFFFFF" />
                      <Text style={styles.desktopAttachBtnText}>+ Lampirkan Foto</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}

            {/* KOLOM KANAN: Formulir Data & Tombol Aksi */}
            <View style={[styles.formPane, isDesktop && styles.formPaneDesktop]}>
              <ScrollView
                style={styles.scrollArea}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
              >
                {/* Banner Mobile Cepat Buka Foto */}
                {!isDesktop && activeReceiptPhoto && (
                  <TouchableOpacity
                    style={styles.mobilePreviewBanner}
                    onPress={() => setIsPreviewModalOpen(true)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="image" size={15} color={Palette.primary} />
                    <Text style={styles.mobilePreviewBannerText}>
                      Lihat Foto Struk Ini ({drafts.length > 1 ? `Struk ${activeIndex + 1}` : 'Bukti Belanja'})
                    </Text>
                    <Ionicons name="chevron-forward" size={15} color={Palette.primary} />
                  </TouchableOpacity>
                )}

                {/* Merchant Name Input */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Nama Toko / Merchant / Penjual</Text>
                  <TextInput
                    style={styles.input}
                    value={currentDraft.merchant_name}
                    onChangeText={(val) => updateCurrentDraft({ merchant_name: val })}
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
                        value={currentDraft.transaction_date}
                        onChangeText={(val) => updateCurrentDraft({ transaction_date: val })}
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
                        value={currentDraft.transaction_time}
                        onChangeText={(val) => updateCurrentDraft({ transaction_time: val })}
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
                      style={styles.dropdownBtn}
                      onPress={() => setShowCategoryPicker(true)}
                      activeOpacity={0.8}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                        <View style={[styles.categoryDot, { backgroundColor: currentCategory?.color || Palette.primary }]} />
                        <Text style={styles.dropdownBtnText} numberOfLines={1}>
                          {currentCategory?.name || 'Pilih Kategori'}
                        </Text>
                      </View>
                      <Ionicons name="chevron-down" size={15} color={Palette.darkTextSecondary} />
                    </TouchableOpacity>
                  </View>

                  {/* Payment Method Dropdown Picker */}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.fieldLabel}>Metode Pembayaran</Text>
                    <TouchableOpacity
                      style={styles.dropdownBtn}
                      onPress={() => setShowPaymentPicker(true)}
                      activeOpacity={0.8}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                        <Ionicons
                          name={(currentPayment?.icon as any) || 'wallet-outline'}
                          size={15}
                          color={Palette.primary}
                        />
                        <Text style={styles.dropdownBtnText} numberOfLines={1}>
                          {currentPayment?.label || 'E-Wallet'}
                        </Text>
                      </View>
                      <Ionicons name="chevron-down" size={15} color={Palette.darkTextSecondary} />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Daftar Menu / Barang Section */}
                <View style={styles.itemsSection}>
                  <View style={styles.itemsHeader}>
                    <Text style={styles.itemsTitle}>
                      DAFTAR MENU / BARANG ({currentDraft.items?.length || 0} ITEM)
                    </Text>
                    <TouchableOpacity style={styles.addItemBtn} onPress={handleAddItem}>
                      <Ionicons name="add-circle" size={14} color={Palette.primary} />
                      <Text style={styles.addItemBtnText}>Tambah</Text>
                    </TouchableOpacity>
                  </View>

                  {(currentDraft.items || []).map((item, index) => (
                    <View key={index} style={styles.itemCard}>
                      <View style={styles.itemCardHeader}>
                        <TextInput
                          style={styles.itemNameInput}
                          value={item.item_name}
                          onChangeText={(val) => handleUpdateItem(index, 'item_name', val)}
                          placeholder="Nama Barang / Menu"
                          placeholderTextColor={Palette.darkTextMuted}
                        />
                        <TouchableOpacity
                          style={styles.deleteItemBtn}
                          onPress={() => handleRemoveItem(index)}
                        >
                          <Ionicons name="trash-outline" size={16} color={Palette.coral} />
                        </TouchableOpacity>
                      </View>

                      <View style={styles.itemDetailsRow}>
                        <View style={styles.itemQtyCol}>
                          <Text style={styles.subFieldLabel}>Qty</Text>
                          <TextInput
                            style={styles.numberInput}
                            value={String(item.quantity || 1)}
                            onChangeText={(val) => handleUpdateItem(index, 'quantity', val)}
                            keyboardType="numeric"
                            placeholder="1"
                            placeholderTextColor={Palette.darkTextMuted}
                          />
                        </View>

                        <View style={styles.itemPriceCol}>
                          <Text style={styles.subFieldLabel}>Harga Satuan</Text>
                          <TextInput
                            style={styles.numberInput}
                            value={String(item.unit_price || 0)}
                            onChangeText={(val) => handleUpdateItem(index, 'unit_price', val)}
                            keyboardType="numeric"
                            placeholder="0"
                            placeholderTextColor={Palette.darkTextMuted}
                          />
                        </View>

                        <View style={styles.itemTotalCol}>
                          <Text style={styles.subFieldLabel}>Total</Text>
                          <Text style={styles.itemTotalVal}>
                            {formatRupiah(item.total_price || 0)}
                          </Text>
                        </View>
                      </View>
                    </View>
                  ))}
                </View>

                {/* Ringkasan Biaya Tambahan & Total Transaksi */}
                <View style={styles.summaryBox}>
                  <Text style={styles.summaryTitle}>Ringkasan Nominal Transaksi</Text>

                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Subtotal Menu/Item:</Text>
                    <Text style={styles.summaryValue}>{formatRupiah(itemsSubtotal)}</Text>
                  </View>

                  {/* Biaya Admin */}
                  {(Number(currentDraft.admin_fee) > 0 || showExtraFees) && (
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>Biaya Layanan / Admin:</Text>
                      <TextInput
                        style={styles.summaryInput}
                        value={String(currentDraft.admin_fee || 0)}
                        onChangeText={(val) => updateCurrentDraft({ admin_fee: Number(val.replace(/[^0-9]/g, '')) || 0 })}
                        keyboardType="numeric"
                        placeholder="0"
                        placeholderTextColor={Palette.darkTextMuted}
                      />
                    </View>
                  )}

                  {/* Ongkir */}
                  {(Number(currentDraft.shipping_fee) > 0 || showExtraFees) && (
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>Ongkos Kirim:</Text>
                      <TextInput
                        style={styles.summaryInput}
                        value={String(currentDraft.shipping_fee || 0)}
                        onChangeText={(val) => updateCurrentDraft({ shipping_fee: Number(val.replace(/[^0-9]/g, '')) || 0 })}
                        keyboardType="numeric"
                        placeholder="0"
                        placeholderTextColor={Palette.darkTextMuted}
                      />
                    </View>
                  )}

                  {/* Pajak */}
                  {(Number(currentDraft.tax_amount) > 0 || showExtraFees) && (
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>Pajak / PPN:</Text>
                      <TextInput
                        style={styles.summaryInput}
                        value={String(currentDraft.tax_amount || 0)}
                        onChangeText={(val) => updateCurrentDraft({ tax_amount: Number(val.replace(/[^0-9]/g, '')) || 0 })}
                        keyboardType="numeric"
                        placeholder="0"
                        placeholderTextColor={Palette.darkTextMuted}
                      />
                    </View>
                  )}

                  {/* Diskon */}
                  {(Number(currentDraft.discount_amount) > 0 || showExtraFees) && (
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>Voucher / Diskon:</Text>
                      <TextInput
                        style={[styles.summaryInput, { color: Palette.coral }]}
                        value={String(currentDraft.discount_amount || 0)}
                        onChangeText={(val) => updateCurrentDraft({ discount_amount: Number(val.replace(/[^0-9]/g, '')) || 0 })}
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
                        value={String(currentDraft.total_amount || 0)}
                        onChangeText={(val) => updateCurrentDraft({ total_amount: Number(val.replace(/[^0-9]/g, '')) || 0 })}
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
                    value={currentDraft.notes}
                    onChangeText={(val) => updateCurrentDraft({ notes: val })}
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
                        {activeReceiptPhoto ? 'Ganti Foto' : '+ Lampirkan Foto'}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {activeReceiptPhoto ? (
                    <TouchableOpacity
                      style={styles.photoPreviewCard}
                      onPress={() => setIsPreviewModalOpen(true)}
                      activeOpacity={0.85}
                    >
                      <Image source={{ uri: activeReceiptPhoto }} style={styles.photoThumb} resizeMode="cover" />
                      <View style={{ flex: 1, paddingHorizontal: 12 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={styles.photoThumbTitle} numberOfLines={1}>
                            Foto Struk Terlampir
                          </Text>
                          <View style={styles.previewTag}>
                            <Ionicons name="eye" size={10} color={Palette.primary} />
                            <Text style={styles.previewTagText}>Pratinjau</Text>
                          </View>
                        </View>
                        <Text style={styles.photoThumbSub}>Ketuk untuk melihat foto dalam ukuran penuh</Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => updateCurrentDraft({ receipt_image_uri: undefined })}
                        style={styles.removePhotoBtn}
                      >
                        <Ionicons name="trash-outline" size={16} color={Palette.coral} />
                      </TouchableOpacity>
                    </TouchableOpacity>
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

              {/* Action Buttons Footer */}
              <View style={styles.footer}>
                <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
                  <Text style={styles.cancelBtnText}>Batal</Text>
                </TouchableOpacity>

                {drafts.length > 1 ? (
                  <View style={styles.footerNavRow}>
                    {/* Tombol Kembali ke Struk Sebelumnya */}
                    {activeIndex > 0 ? (
                      <TouchableOpacity
                        style={styles.stepNavPrevBtn}
                        onPress={() => setActiveIndex((prev) => prev - 1)}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="chevron-back" size={15} color={Palette.darkText} />
                        <Text style={styles.stepNavPrevBtnText}>Struk {activeIndex}</Text>
                      </TouchableOpacity>
                    ) : null}

                    {/* Tombol Lanjut ke Struk Berikutnya ATAU Simpan Semua di Akhir */}
                    {activeIndex < drafts.length - 1 ? (
                      <TouchableOpacity
                        style={styles.stepNavNextBtn}
                        onPress={() => setActiveIndex((prev) => prev + 1)}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.stepNavNextBtnText}>
                          Lanjut ke Struk {activeIndex + 2}
                        </Text>
                        <Ionicons name="chevron-forward" size={15} color="#FFFFFF" />
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        style={styles.saveAllBtn}
                        onPress={handleSaveBatchFinal}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="cloud-upload" size={16} color="#FFFFFF" />
                        <Text style={styles.saveAllBtnText}>
                          Simpan Semua ({drafts.length} Struk)
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ) : (
                  <TouchableOpacity style={styles.saveBtn} onPress={handleSaveBatchFinal}>
                    <Ionicons name="checkmark-circle" size={17} color="#FFFFFF" />
                    <Text style={styles.saveBtnText}>Simpan Transaksi</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* MODAL FULL-SCREEN PREVIEW FOTO STRUK */}
      <Modal
        visible={isPreviewModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsPreviewModalOpen(false)}
      >
        <View style={styles.fullPreviewBackdrop}>
          <View style={styles.fullPreviewHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="receipt" size={18} color="#FFFFFF" />
              <Text style={styles.fullPreviewTitle}>
                Pratinjau Foto Struk {drafts.length > 1 ? `(${activeIndex + 1} dari ${drafts.length})` : ''}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.fullPreviewCloseBtn}
              onPress={() => setIsPreviewModalOpen(false)}
              activeOpacity={0.8}
            >
              <Ionicons name="close" size={22} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          <View style={styles.fullPreviewBody}>
            {activeReceiptPhoto ? (
              <Image
                source={{ uri: activeReceiptPhoto }}
                style={styles.fullPreviewImage}
                resizeMode="contain"
              />
            ) : (
              <Text style={{ color: '#FFFFFF' }}>Foto tidak tersedia</Text>
            )}
          </View>
        </View>
      </Modal>

      {/* Pop-up Modal Pilih Kategori */}
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

            <ScrollView style={{ maxHeight: 340 }} showsVerticalScrollIndicator={false}>
              {categories
                .filter((c) => c.type !== 'income')
                .map((cat) => {
                  const isSelected = currentDraft.category_id === cat.id;
                  return (
                    <TouchableOpacity
                      key={cat.id}
                      style={[
                        styles.popupOptionItem,
                        isSelected && { backgroundColor: `${cat.color}18` },
                      ]}
                      onPress={() => {
                        updateCurrentDraft({ category_id: cat.id });
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
                const isSelected = currentDraft.payment_method === pm.value;
                return (
                  <TouchableOpacity
                    key={pm.value}
                    style={[
                      styles.popupOptionItem,
                      isSelected && { backgroundColor: 'rgba(88, 101, 242, 0.18)' },
                    ]}
                    onPress={() => {
                      updateCurrentDraft({ payment_method: pm.value });
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
                          name={(pm.icon as any) || 'card-outline'}
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
    justifyContent: 'center',
    alignItems: 'center',
    padding: 12,
  },
  sheetContainer: {
    backgroundColor: Palette.darkCard,
    borderRadius: 22,
    maxHeight: '94%',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
    overflow: 'hidden',
  },
  sheetContainerDesktop: {
    maxWidth: 1100,
    width: '94%',
    height: '90%',
    maxHeight: 840,
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
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(88, 101, 242, 0.4)',
  },
  queueBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: Palette.primary,
  },
  subtitle: {
    fontSize: 12,
    color: Palette.darkTextSecondary,
    marginTop: 2,
  },
  headerSaveAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: Palette.primary,
  },
  headerSaveAllBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  headerPreviewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(88, 101, 242, 0.15)',
  },
  headerPreviewBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: Palette.primary,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  stepperBar: {
    backgroundColor: '#161922',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  stepperScroll: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 8,
  },
  stepperPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  stepperPillActive: {
    backgroundColor: 'rgba(88, 101, 242, 0.22)',
    borderColor: Palette.primary,
  },
  stepperNumber: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepperNumberActive: {
    backgroundColor: Palette.primary,
  },
  stepperNumberText: {
    fontSize: 11,
    fontWeight: '800',
    color: Palette.darkTextSecondary,
  },
  stepperNumberTextActive: {
    color: '#FFFFFF',
  },
  stepperLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Palette.darkTextMuted,
    maxWidth: 130,
  },
  stepperLabelActive: {
    color: Palette.primary,
    fontWeight: '700',
  },
  bodyLayout: {
    flex: 1,
  },
  bodyLayoutDesktop: {
    flexDirection: 'row',
  },
  desktopPreviewPane: {
    flex: 1,
    backgroundColor: '#0E1015',
    borderRightWidth: 1,
    borderRightColor: 'rgba(255, 255, 255, 0.08)',
    display: 'flex',
    flexDirection: 'column',
  },
  previewPaneHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
  },
  previewPaneTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Palette.darkText,
  },
  previewPaneBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: 'rgba(88, 101, 242, 0.2)',
  },
  previewPaneBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: Palette.primary,
  },
  expandPreviewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: 'rgba(88, 101, 242, 0.15)',
  },
  expandPreviewBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: Palette.primary,
  },
  desktopImageWrapper: {
    flex: 1,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#090A0E',
  },
  desktopImage: {
    width: '100%',
    height: '100%',
  },
  desktopImageHintBar: {
    position: 'absolute',
    bottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  desktopImageHintText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  desktopNoImageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    gap: 8,
    backgroundColor: '#090A0E',
  },
  desktopNoImageTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Palette.darkText,
  },
  desktopNoImageSub: {
    fontSize: 12,
    color: Palette.darkTextMuted,
    textAlign: 'center',
    maxWidth: 240,
    marginBottom: 8,
  },
  desktopAttachBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: Palette.primary,
  },
  desktopAttachBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  formPane: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
  },
  formPaneDesktop: {
    flex: 1.25,
  },
  mobilePreviewBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(88, 101, 242, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(88, 101, 242, 0.3)',
    marginBottom: 14,
  },
  mobilePreviewBannerText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    color: Palette.primary,
    marginLeft: 8,
  },
  previewTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: 'rgba(88, 101, 242, 0.18)',
  },
  previewTagText: {
    fontSize: 10,
    fontWeight: '700',
    color: Palette.primary,
  },
  fullPreviewBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    padding: 16,
  },
  fullPreviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  fullPreviewTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  fullPreviewCloseBtn: {
    padding: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  fullPreviewBody: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
  },
  fullPreviewImage: {
    width: '100%',
    height: '100%',
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 24,
  },
  fieldGroup: {
    marginBottom: 14,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Palette.darkTextSecondary,
    marginBottom: 6,
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: Palette.darkText,
  },
  dateTimeRow: {
    flexDirection: 'row',
    gap: 10,
  },
  inputWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    paddingHorizontal: 10,
    gap: 8,
  },
  innerInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 13,
    color: Palette.darkText,
  },
  twoColRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  dropdownBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  categoryDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  dropdownBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: Palette.darkText,
  },
  itemsSection: {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 14,
    padding: 12,
    marginBottom: 14,
  },
  itemsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  itemsTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: Palette.darkTextSecondary,
    letterSpacing: 0.5,
  },
  addItemBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(88, 101, 242, 0.12)',
  },
  addItemBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: Palette.primary,
  },
  itemCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  itemCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  itemNameInput: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: Palette.darkText,
    padding: 0,
  },
  deleteItemBtn: {
    padding: 4,
  },
  itemDetailsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  itemQtyCol: {
    width: 60,
  },
  itemPriceCol: {
    flex: 1,
  },
  itemTotalCol: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingBottom: 6,
    minWidth: 70,
  },
  subFieldLabel: {
    fontSize: 10,
    color: Palette.darkTextMuted,
    marginBottom: 4,
  },
  numberInput: {
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 5,
    fontSize: 12,
    color: Palette.darkText,
  },
  itemTotalVal: {
    fontSize: 12,
    fontWeight: '700',
    color: Palette.darkText,
  },
  summaryBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
  },
  summaryTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: Palette.darkText,
    marginBottom: 10,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 5,
  },
  summaryLabel: {
    fontSize: 12,
    color: Palette.darkTextSecondary,
  },
  summaryValue: {
    fontSize: 12,
    fontWeight: '700',
    color: Palette.darkText,
  },
  summaryInput: {
    width: 120,
    textAlign: 'right',
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 12,
    color: Palette.darkText,
  },
  summaryTotalRow: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    marginTop: 8,
    paddingTop: 10,
  },
  summaryTotalLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: Palette.darkText,
  },
  summaryTotalHint: {
    fontSize: 10,
    color: Palette.darkTextMuted,
  },
  totalInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(88, 101, 242, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(88, 101, 242, 0.3)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  rpPrefix: {
    fontSize: 13,
    fontWeight: '700',
    color: Palette.primary,
    marginRight: 4,
  },
  totalInputField: {
    fontSize: 15,
    fontWeight: '800',
    color: Palette.primaryLight,
    minWidth: 90,
    textAlign: 'right',
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
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    backgroundColor: 'rgba(0, 0, 0, 0.15)',
    gap: 10,
  },
  footerNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: Palette.darkTextSecondary,
  },
  stepNavPrevBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  stepNavPrevBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: Palette.darkText,
  },
  stepNavNextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: Palette.primary,
  },
  stepNavNextBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  saveAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: Palette.greenOnline,
  },
  saveAllBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: Palette.primary,
  },
  saveBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  popupOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  popupCard: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 18,
    backgroundColor: Palette.darkCard,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    overflow: 'hidden',
    padding: 16,
  },
  popupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 12,
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  popupTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Palette.darkText,
  },
  popupCloseBtn: {
    padding: 4,
  },
  popupOptionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    marginBottom: 4,
  },
  popupIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  popupOptionName: {
    fontSize: 13,
  },
});
