import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Header } from '@/components/common/Header';
import { ScanProgressModal } from '@/components/scanner/ScanProgressModal';
import { ReceiptVerifyModal } from '@/components/forms/ReceiptVerifyModal';
import { Palette } from '@/constants/theme';
import { useTransactionStore } from '@/store/transactionStore';
import { useAuthStore } from '@/store/authStore';
import { useThemeStore } from '@/store/themeStore';
import { useLanguageStore } from '@/store/languageStore';
import { processReceiptImages } from '@/services/receiptService';
import { ReceiptScanResult } from '@/types';

export default function ScannerScreen() {
  const router = useRouter();
  const [isProcessing, setIsProcessing] = useState(false);
  const [scanResult, setScanResult] = useState<ReceiptScanResult | null>(null);
  const [receiptQueue, setReceiptQueue] = useState<ReceiptScanResult[]>([]);
  const [queueIndex, setQueueIndex] = useState(0);
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [capturedImageUri, setCapturedImageUri] = useState<string | null>(null);

  const { addTransaction, categories } = useTransactionStore();
  const { user, geminiApiKey } = useAuthStore();
  const { theme, mode, toggleTheme } = useThemeStore();
  const { t, language } = useLanguageStore();

  const handleTakePhoto = async () => {
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Izin Kamera Ditolak', 'Mohon izinkan akses kamera pada pengaturan perangkat Anda untuk mengambil foto struk.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.8,
        base64: false,
      });

      if (!result.canceled && result.assets?.[0]?.uri) {
        processImages([{ uri: result.assets[0].uri }]);
      }
    } catch (err: any) {
      console.warn('Take photo error:', err);
      Alert.alert('Gagal Mengambil Foto', err.message || 'Tidak dapat membuka kamera.');
    }
  };

  const handlePickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        selectionLimit: 5,
        quality: 0.8,
        base64: false,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const inputItems = result.assets.map((a) => ({
          uri: a.uri,
        }));
        processImages(inputItems);
      }
    } catch (err: any) {
      console.warn('Pick image error:', err);
      Alert.alert('Gagal Memilih Gambar', err.message || 'Tidak dapat membuka galeri file.');
    }
  };

  const handleSelectManualInput = () => {
    const blank: ReceiptScanResult = {
      merchant_name: '',
      transaction_date: new Date().toISOString(),
      suggested_category: 'Operational',
      payment_method: 'cash',
      subtotal: 0,
      shipping_fee: 0,
      admin_fee: 0,
      tax_amount: 0,
      discount_amount: 0,
      total_amount: 0,
      confidence_score: 1.0,
      notes: '',
      items: [],
      receipt_image_uri: undefined,
    };
    setReceiptQueue([]);
    setQueueIndex(0);
    setScanResult(blank);
    setCapturedImageUri(null);
    setShowVerifyModal(true);
  };

  const processImages = async (inputItems: Array<{ uri: string; base64?: string }>) => {
    try {
      setCapturedImageUri(inputItems[0].uri);
      setIsProcessing(true);
      const userName = user?.full_name || user?.email?.split('@')[0] || 'user';
      const results = await processReceiptImages(inputItems, geminiApiKey, userName);
      setIsProcessing(false);

      if (!results || results.length === 0) {
        throw new Error('AI tidak menemukan rincian transaksi dari foto yang diunggah.');
      }

      setReceiptQueue(results);
      setQueueIndex(0);
      setScanResult(results[0]);
      setShowVerifyModal(true);
    } catch (err: any) {
      setIsProcessing(false);
      Alert.alert(
        'Pemberitahuan Ekstraksi AI',
        err.message || 'Terjadi kesalahan saat mengekstrak gambar.'
      );
    }
  };

  const handleSaveBatchTransactions = async (batchData: any[]) => {
    try {
      setIsProcessing(true);
      for (const verifiedData of batchData) {
        const cat = categories.find((c) => c.id === verifiedData.category_id);
        const finalReceiptUrl = verifiedData.receipt_image_uri || capturedImageUri || undefined;

        let finalIso = new Date().toISOString();
        try {
          if (verifiedData.transaction_date && verifiedData.transaction_time) {
            finalIso = new Date(`${verifiedData.transaction_date}T${verifiedData.transaction_time}:00`).toISOString();
          } else if (verifiedData.transaction_date) {
            finalIso = new Date(verifiedData.transaction_date).toISOString();
          }
        } catch {
          finalIso = new Date().toISOString();
        }

        await addTransaction({
          user_id: 'active-user',
          category_id: verifiedData.category_id,
          category: cat,
          merchant_name: verifiedData.merchant_name,
          transaction_date: finalIso,
          total_amount: Number(verifiedData.total_amount) || 0,
          subtotal: Number(verifiedData.subtotal) || Number(verifiedData.total_amount) || 0,
          tax_amount: Number(verifiedData.tax_amount) || 0,
          discount_amount: Number(verifiedData.discount_amount) || 0,
          shipping_fee: Number(verifiedData.shipping_fee) || 0,
          admin_fee: Number(verifiedData.admin_fee) || 0,
          payment_method: verifiedData.payment_method || 'e-wallet',
          notes: verifiedData.notes || '',
          receipt_image_url: finalReceiptUrl,
          items: verifiedData.items || [],
        });
      }

      setIsProcessing(false);
      setShowVerifyModal(false);
      setScanResult(null);
      setReceiptQueue([]);
      setQueueIndex(0);
      setCapturedImageUri(null);

      const count = batchData.length;
      Alert.alert(
        'Berhasil Disimpan! 🎉',
        count > 1
          ? `Seluruh ${count} transaksi struk belanja telah berhasil disimpan rapi ke sistem.`
          : 'Transaksi dan bukti struk belanja telah berhasil disimpan.',
        [
          {
            text: 'Lihat Riwayat & Spreadsheet',
            onPress: () => router.push('/(tabs)/transactions'),
          },
          {
            text: 'OK',
            onPress: () => router.push('/(tabs)'),
          },
        ]
      );
    } catch (err: any) {
      setIsProcessing(false);
      Alert.alert('Gagal Menyimpan', err.message || 'Terjadi kesalahan saat menyimpan transaksi.');
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <Header
          title={t('scanner.title')}
          subtitle={t('scanner.subtitle')}
          rightAction={
            <TouchableOpacity
              style={[styles.themeToggleBtn, { backgroundColor: theme.cardHover }]}
              onPress={toggleTheme}
            >
              <Ionicons
                name={mode === 'dark' ? 'sunny' : 'moon'}
                size={18}
                color={mode === 'dark' ? '#FEE75C' : Palette.primary}
              />
            </TouchableOpacity>
          }
        />

        {/* Card Upload Area Utama */}
        <View
          style={[
            styles.dropzoneCard,
            {
              backgroundColor: theme.card,
              borderColor: 'rgba(88, 101, 242, 0.4)',
            },
          ]}
        >
          <View style={styles.uploadGlowCircle}>
            <Ionicons name="scan-circle" size={44} color="#FFFFFF" />
          </View>

          <Text style={[styles.dropzoneTitle, { color: theme.text }]}>
            {language === 'id' ? 'Ekstrak Struk Belanja Otomatis' : 'Automatic Receipt Extraction'}
          </Text>
          <Text style={[styles.dropzoneSubtitle, { color: theme.textSecondary }]}>
            {language === 'id'
              ? 'Foto langsung atau pilih hingga 5 foto struk dari galeri (mendukung struk panjang bersambung / multi-struk)'
              : 'Take a photo or choose up to 5 receipts from gallery (supports long continuous / multi-receipts)'}
          </Text>

          <View style={styles.buttonActionGroup}>
            <TouchableOpacity style={styles.cameraPrimaryBtn} onPress={handleTakePhoto} activeOpacity={0.85}>
              <Ionicons name="camera" size={18} color="#FFFFFF" />
              <Text style={styles.actionBtnText}>{t('scanner.openCamera')}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.gallerySecondaryBtn} onPress={handlePickImage} activeOpacity={0.85}>
              <Ionicons name="image-outline" size={18} color={Palette.primaryLight} />
              <Text style={[styles.actionBtnText, { color: Palette.primaryLight }]}>
                {t('scanner.chooseGallery')} (1-5 {language === 'id' ? 'Foto' : 'Photos'})
              </Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.demoTestBtn} onPress={handleSelectManualInput} activeOpacity={0.8}>
            <Ionicons name="create-outline" size={15} color="#F0B232" />
            <Text style={styles.demoTestText}>
              {language === 'id'
                ? 'Input Manual (Formulir Kosong / Struk Sulit Terbaca)'
                : 'Manual Input (Blank Form / Unclear Receipt)'}
            </Text>
          </TouchableOpacity>

          <Text style={[styles.formatHint, { color: theme.textMuted }]}>
            {language === 'id'
              ? 'Mendukung: Nota kasir toko, struk GoFood/ShopeeFood/Grab, nota bensin, tulisan tangan, & invoice PDF/JPG'
              : 'Supports: Cashier slips, GoFood/Grab food receipts, gas receipts, handwritten notes, & invoices'}
          </Text>
        </View>

        {/* Card Panduan Cara Menggunakan Sistem */}
        <View
          style={[
            styles.guideCard,
            { backgroundColor: theme.card, borderColor: theme.border },
          ]}
        >
          <View style={styles.guideHeader}>
            <View style={styles.guideIconBox}>
              <Ionicons name="book-outline" size={20} color={Palette.primary} />
            </View>
            <View>
              <Text style={[styles.guideTitle, { color: theme.text }]}>
                {language === 'id' ? 'Cara Menggunakan Sistem' : 'How to Use the System'}
              </Text>
              <Text style={[styles.guideSub, { color: theme.textSecondary }]}>
                {language === 'id'
                  ? '3 Langkah mudah merekap struk pengeluaran'
                  : '3 Simple steps to record your expense receipts'}
              </Text>
            </View>
          </View>

          <View style={styles.stepsContainer}>
            {/* Step 1 */}
            <View style={styles.stepRow}>
              <View style={styles.stepNumberBadge}>
                <Text style={styles.stepNumberText}>1</Text>
              </View>
              <View style={styles.stepContent}>
                <View style={styles.stepTitleRow}>
                  <Ionicons name="cloud-upload-outline" size={16} color={Palette.primary} />
                  <Text style={[styles.stepTitle, { color: theme.text }]}>
                    {language === 'id' ? 'Unggah Foto Struk / Nota' : 'Upload Receipt Photo'}
                  </Text>
                </View>
                <Text style={[styles.stepDesc, { color: theme.textSecondary }]}>
                  {language === 'id'
                    ? 'Pilih foto struk belanja toko fisik (Indomaret, SPBU, resto), nota manual tulisan tangan, atau bukti pembayaran online.'
                    : 'Select photos of physical store receipts, handwritten manual slips, or digital payment proofs.'}
                </Text>
              </View>
            </View>

            <View style={[styles.stepConnector, { backgroundColor: theme.border }]} />

            {/* Step 2 */}
            <View style={styles.stepRow}>
              <View style={[styles.stepNumberBadge, { backgroundColor: '#F0B232' }]}>
                <Text style={styles.stepNumberText}>2</Text>
              </View>
              <View style={styles.stepContent}>
                <View style={styles.stepTitleRow}>
                  <Ionicons name="sparkles-outline" size={16} color="#F0B232" />
                  <Text style={[styles.stepTitle, { color: theme.text }]}>
                    {language === 'id' ? 'AI Mengekstrak Otomatis' : 'Automatic AI Extraction'}
                  </Text>
                </View>
                <Text style={[styles.stepDesc, { color: theme.textSecondary }]}>
                  {language === 'id'
                    ? 'AI Vision membaca nama toko, tanggal & jam transaksi, daftar barang, ongkos kirim (GoSend/Grab), biaya admin, diskon, dan total biaya.'
                    : 'AI Vision extracts store name, transaction date & time, item details, delivery fees, admin fees, discounts, and grand totals.'}
                </Text>
              </View>
            </View>

            <View style={[styles.stepConnector, { backgroundColor: theme.border }]} />

            {/* Step 3 */}
            <View style={styles.stepRow}>
              <View style={[styles.stepNumberBadge, { backgroundColor: '#23A55A' }]}>
                <Text style={styles.stepNumberText}>3</Text>
              </View>
              <View style={styles.stepContent}>
                <View style={styles.stepTitleRow}>
                  <Ionicons name="document-text-outline" size={16} color="#23A55A" />
                  <Text style={[styles.stepTitle, { color: theme.text }]}>
                    {language === 'id' ? 'Verifikasi & Ekspor Excel' : 'Verify & Export to Excel'}
                  </Text>
                </View>
                <Text style={[styles.stepDesc, { color: theme.textSecondary }]}>
                  {language === 'id'
                    ? 'Periksa rincian data pada formulir konfirmasi, simpan ke database, dan ekspor ke Excel kapan saja dengan 1 klik!'
                    : 'Review line items in verification form, save to database, and preview or export to Excel anytime in 1 click!'}
                </Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* AI Processing Radar Modal */}
      <ScanProgressModal visible={isProcessing} />

      {/* Verification & Edit Modal */}
      <ReceiptVerifyModal
        visible={showVerifyModal}
        scanData={scanResult}
        scanBatch={receiptQueue.length > 0 ? receiptQueue : (scanResult ? [scanResult] : [])}
        categories={categories}
        onClose={() => {
          setShowVerifyModal(false);
          setScanResult(null);
          setReceiptQueue([]);
          setQueueIndex(0);
        }}
        onConfirmSave={(singleData) => handleSaveBatchTransactions([singleData])}
        onConfirmSaveBatch={handleSaveBatchTransactions}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 40,
  },
  themeToggleBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dropzoneCard: {
    marginHorizontal: 16,
    borderRadius: 22,
    padding: 24,
    alignItems: 'center',
    borderWidth: 2,
    borderStyle: 'dashed',
    shadowColor: Palette.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 4,
    marginBottom: 16,
  },
  uploadGlowCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: Palette.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: Palette.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 14,
    elevation: 8,
  },
  dropzoneTitle: {
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 6,
  },
  dropzoneSubtitle: {
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 18,
    paddingHorizontal: 12,
  },
  buttonActionGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    width: '100%',
    marginBottom: 12,
  },
  cameraPrimaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Palette.primary,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    gap: 6,
    shadowColor: Palette.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  gallerySecondaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(88, 101, 242, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(88, 101, 242, 0.4)',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    gap: 6,
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  demoTestBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(240, 178, 50, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(240, 178, 50, 0.3)',
    borderRadius: 10,
    paddingVertical: 7,
    paddingHorizontal: 12,
    gap: 6,
    marginBottom: 12,
  },
  demoTestText: {
    color: '#F0B232',
    fontSize: 11,
    fontWeight: '700',
  },
  formatHint: {
    fontSize: 10,
    textAlign: 'center',
  },
  guideCard: {
    marginHorizontal: 16,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    marginBottom: 20,
  },
  guideHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
    paddingBottom: 12,
  },
  guideIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: 'rgba(88, 101, 242, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  guideTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  guideSub: {
    fontSize: 11,
    marginTop: 2,
  },
  stepsContainer: {
    paddingLeft: 4,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  stepNumberBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Palette.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  stepNumberText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  stepContent: {
    flex: 1,
  },
  stepTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  stepTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  stepDesc: {
    fontSize: 11,
    lineHeight: 16,
  },
  stepConnector: {
    width: 2,
    height: 16,
    marginLeft: 11,
    marginVertical: 4,
  },
});
