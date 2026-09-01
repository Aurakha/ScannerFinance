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
import { processReceiptImage } from '@/services/receiptService';
import { ReceiptScanResult } from '@/types';

export default function ScannerScreen() {
  const router = useRouter();
  const [isProcessing, setIsProcessing] = useState(false);
  const [scanResult, setScanResult] = useState<ReceiptScanResult | null>(null);
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [capturedImageUri, setCapturedImageUri] = useState<string | null>(null);

  const { addTransaction, categories } = useTransactionStore();
  const { geminiApiKey } = useAuthStore();
  const { theme, mode, toggleTheme } = useThemeStore();

  const handlePickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.85,
        base64: true,
      });

      if (!result.canceled && result.assets?.[0]?.uri) {
        processImage(result.assets[0].uri, result.assets[0].base64 || undefined);
      }
    } catch (err: any) {
      console.warn('Pick image error:', err);
      Alert.alert('Gagal Memilih Gambar', err.message || 'Tidak dapat membuka galeri file.');
    }
  };

  const processImage = async (imageUri: string, base64Data?: string) => {
    try {
      setCapturedImageUri(imageUri);
      setIsProcessing(true);
      const parsedData = await processReceiptImage(imageUri, geminiApiKey, base64Data);
      setIsProcessing(false);
      setScanResult(parsedData);
      setShowVerifyModal(true);
    } catch (err: any) {
      setIsProcessing(false);
      Alert.alert(
        'Pemberitahuan Ekstraksi AI',
        err.message || 'Terjadi kesalahan saat mengekstrak gambar.'
      );
    }
  };

  const handleSaveVerifiedTransaction = async (verifiedData: any) => {
    try {
      const cat = categories.find((c) => c.id === verifiedData.category_id);
      const finalReceiptUrl = scanResult?.receipt_image_uri || capturedImageUri || undefined;

      await addTransaction({
        user_id: 'active-user',
        category_id: verifiedData.category_id,
        category: cat,
        merchant_name: verifiedData.merchant_name,
        transaction_date: verifiedData.transaction_date,
        total_amount: verifiedData.total_amount,
        subtotal: verifiedData.subtotal,
        tax_amount: verifiedData.tax_amount,
        discount_amount: verifiedData.discount_amount,
        shipping_fee: verifiedData.shipping_fee,
        admin_fee: verifiedData.admin_fee,
        payment_method: verifiedData.payment_method,
        notes: verifiedData.notes,
        receipt_image_url: finalReceiptUrl,
        items: verifiedData.items,
      });

      setShowVerifyModal(false);
      setScanResult(null);
      setCapturedImageUri(null);

      Alert.alert('Berhasil Disimpan! 🎉', 'Transaksi dan foto struk belanja telah tersimpan rapi.', [
        {
          text: 'Lihat Riwayat & Spreadsheet',
          onPress: () => router.push('/(tabs)/transactions'),
        },
        {
          text: 'OK',
          onPress: () => router.push('/(tabs)'),
        },
      ]);
    } catch (err: any) {
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
          title="Unggah & Ekstrak Struk"
          subtitle="AI mengekstrak toko, item, ongkir, & biaya admin"
          rightAction={
            <TouchableOpacity
              style={[styles.themeToggleBtn, { backgroundColor: theme.cardHover }]}
              onPress={toggleTheme}
            >
              <Ionicons
                name={mode === 'dark' ? 'sunny' : 'moon'}
                size={18}
                color={mode === 'dark' ? Palette.amber : Palette.primary}
              />
            </TouchableOpacity>
          }
        />

        {/* Primary Drag & Dropzone Card */}
        <TouchableOpacity
          style={[
            styles.dropzoneCard,
            {
              backgroundColor: theme.card,
              borderColor: 'rgba(88, 101, 242, 0.4)',
            },
          ]}
          onPress={handlePickImage}
          activeOpacity={0.85}
        >
          <View style={styles.uploadGlowCircle}>
            <Ionicons name="cloud-upload" size={44} color="#FFFFFF" />
          </View>

          <Text style={[styles.dropzoneTitle, { color: theme.text }]}>Pilih Foto Struk / Nota</Text>
          <Text style={[styles.dropzoneSubtitle, { color: theme.textSecondary }]}>
            Klik di sini untuk mengunggah foto struk belanja dari galeri atau komputer Anda
          </Text>

          <View style={styles.selectButton}>
            <Ionicons name="image-outline" size={18} color="#FFFFFF" />
            <Text style={styles.selectButtonText}>Pilih Gambar</Text>
          </View>

          <Text style={[styles.formatHint, { color: theme.textMuted }]}>
            Format: JPG, PNG, WebP (Nota cetak kasir, tulisan tangan, atau bukti m-Banking)
          </Text>
        </TouchableOpacity>

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
              <Text style={[styles.guideTitle, { color: theme.text }]}>Cara Menggunakan Sistem</Text>
              <Text style={[styles.guideSub, { color: theme.textSecondary }]}>
                3 Langkah mudah merekap struk pengeluaran
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
                  <Text style={[styles.stepTitle, { color: theme.text }]}>Unggah Foto Struk / Nota</Text>
                </View>
                <Text style={[styles.stepDesc, { color: theme.textSecondary }]}>
                  Pilih foto struk belanja toko fisik (Indomaret, SPBU, resto), nota manual tulisan tangan, atau bukti pembayaran online.
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
                  <Text style={[styles.stepTitle, { color: theme.text }]}>AI Mengekstrak Otomatis</Text>
                </View>
                <Text style={[styles.stepDesc, { color: theme.textSecondary }]}>
                  AI Gemini 3.6 Flash membaca nama toko, tanggal & jam transaksi, daftar barang, ongkos kirim (GoSend/Grab), biaya admin, diskon, dan total biaya.
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
                  <Text style={[styles.stepTitle, { color: theme.text }]}>Verifikasi & Ekspor Spreadsheet</Text>
                </View>
                <Text style={[styles.stepDesc, { color: theme.textSecondary }]}>
                  Periksa rincian data pada formulir konfirmasi, simpan ke database, dan ekspor ke Google Spreadsheet kapan saja dengan 1 klik!
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
        categories={categories}
        onClose={() => {
          setShowVerifyModal(false);
          setScanResult(null);
        }}
        onConfirmSave={handleSaveVerifiedTransaction}
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
  selectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Palette.primary,
    paddingHorizontal: 20,
    paddingVertical: 11,
    borderRadius: 12,
    gap: 8,
    marginBottom: 12,
  },
  selectButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
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
