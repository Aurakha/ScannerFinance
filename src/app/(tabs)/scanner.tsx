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
        payment_method: verifiedData.payment_method,
        notes: verifiedData.notes,
        receipt_image_url: capturedImageUri || undefined,
        items: verifiedData.items,
      });

      setShowVerifyModal(false);
      setScanResult(null);
      setCapturedImageUri(null);

      Alert.alert('Berhasil Disimpan! 🎉', 'Transaksi dan rincian item belanja telah tersimpan rapi.', [
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
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <Header
          title="Unggah & Ekstrak Struk"
          subtitle="AI mengekstrak toko, item, ongkir, & biaya admin"
        />

        {/* Primary Drag & Dropzone Card */}
        <TouchableOpacity
          style={styles.dropzoneCard}
          onPress={handlePickImage}
          activeOpacity={0.85}
        >
          <View style={styles.uploadGlowCircle}>
            <Ionicons name="cloud-upload" size={44} color="#FFFFFF" />
          </View>

          <Text style={styles.dropzoneTitle}>Pilih Foto Struk / Nota</Text>
          <Text style={styles.dropzoneSubtitle}>
            Klik di sini untuk mengunggah foto struk belanja dari galeri atau komputer Anda
          </Text>

          <View style={styles.selectButton}>
            <Ionicons name="image-outline" size={18} color="#FFFFFF" />
            <Text style={styles.selectButtonText}>Pilih Gambar</Text>
          </View>

          <Text style={styles.formatHint}>
            Format: JPG, PNG, WebP (Nota cetak kasir, tulisan tangan, atau bukti m-Banking)
          </Text>
        </TouchableOpacity>

        {/* Card Panduan Cara Menggunakan Sistem */}
        <View style={styles.guideCard}>
          <View style={styles.guideHeader}>
            <View style={styles.guideIconBox}>
              <Ionicons name="book-outline" size={20} color={Palette.primary} />
            </View>
            <View>
              <Text style={styles.guideTitle}>Cara Menggunakan Sistem</Text>
              <Text style={styles.guideSub}>3 Langkah mudah merekap struk pengeluaran</Text>
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
                  <Text style={styles.stepTitle}>Unggah Foto Struk / Nota</Text>
                </View>
                <Text style={styles.stepDesc}>
                  Pilih foto struk belanja toko fisik (Indomaret, SPBU, resto), nota manual tulisan tangan, atau bukti pembayaran online.
                </Text>
              </View>
            </View>

            <View style={styles.stepConnector} />

            {/* Step 2 */}
            <View style={styles.stepRow}>
              <View style={[styles.stepNumberBadge, { backgroundColor: '#F0B232' }]}>
                <Text style={styles.stepNumberText}>2</Text>
              </View>
              <View style={styles.stepContent}>
                <View style={styles.stepTitleRow}>
                  <Ionicons name="sparkles-outline" size={16} color="#F0B232" />
                  <Text style={styles.stepTitle}>AI Mengekstrak Otomatis</Text>
                </View>
                <Text style={styles.stepDesc}>
                  AI Gemini 3.6 Flash membaca nama toko, tanggal & jam transaksi, daftar barang, ongkos kirim (GoSend/Grab), biaya admin, diskon, dan total biaya.
                </Text>
              </View>
            </View>

            <View style={styles.stepConnector} />

            {/* Step 3 */}
            <View style={styles.stepRow}>
              <View style={[styles.stepNumberBadge, { backgroundColor: '#23A55A' }]}>
                <Text style={styles.stepNumberText}>3</Text>
              </View>
              <View style={styles.stepContent}>
                <View style={styles.stepTitleRow}>
                  <Ionicons name="document-text-outline" size={16} color="#23A55A" />
                  <Text style={styles.stepTitle}>Verifikasi & Ekspor Spreadsheet</Text>
                </View>
                <Text style={styles.stepDesc}>
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
    backgroundColor: Palette.darkBg,
  },
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 40,
  },
  dropzoneCard: {
    marginHorizontal: 20,
    backgroundColor: Palette.darkCard,
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(88, 101, 242, 0.4)',
    borderStyle: 'dashed',
    marginBottom: 20,
    shadowColor: Palette.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 6,
  },
  uploadGlowCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Palette.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: Palette.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 8,
  },
  dropzoneTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Palette.darkText,
    marginBottom: 6,
  },
  dropzoneSubtitle: {
    fontSize: 13,
    color: Palette.darkTextSecondary,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 320,
    marginBottom: 20,
  },
  selectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Palette.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 14,
    marginBottom: 14,
  },
  selectButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  formatHint: {
    fontSize: 11,
    color: Palette.darkTextMuted,
    textAlign: 'center',
  },
  guideCard: {
    marginHorizontal: 20,
    backgroundColor: Palette.darkCard,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  guideHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
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
    fontWeight: '700',
    color: Palette.darkText,
  },
  guideSub: {
    fontSize: 12,
    color: Palette.darkTextSecondary,
    marginTop: 1,
  },
  stepsContainer: {
    paddingLeft: 4,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
  },
  stepNumberBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: Palette.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  stepNumberText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 12,
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
    color: Palette.darkText,
  },
  stepDesc: {
    fontSize: 12,
    color: Palette.darkTextSecondary,
    lineHeight: 18,
  },
  stepConnector: {
    width: 2,
    height: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginLeft: 12,
    marginVertical: 4,
  },
});
