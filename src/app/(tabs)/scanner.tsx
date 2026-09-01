import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Platform,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
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
import {
  getSampleDemoReceipt,
  processReceiptImage,
} from '@/services/receiptService';
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

  const handleDemoScan = async (demoIndex = 0) => {
    setIsProcessing(true);
    await new Promise((resolve) => setTimeout(resolve, 1400));
    setIsProcessing(false);
    const demo = getSampleDemoReceipt(demoIndex);
    setScanResult(demo);
    setShowVerifyModal(true);
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

      Alert.alert('Berhasil Disimpan! 🎉', 'Transaksi dan rincian item belanja telah tercatat.', [
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
            Format didukung: JPG, PNG, WebP (Nota cetak, tulisan tangan, atau screenshot m-Banking)
          </Text>
        </TouchableOpacity>

        {/* AI Capabilities Cards */}
        <View style={styles.capabilitiesCard}>
          <Text style={styles.capTitle}>Kemampuan Ekstraksi AI Gemini 3.6</Text>
          
          <View style={styles.capGrid}>
            <View style={styles.capItem}>
              <View style={[styles.capIconBox, { backgroundColor: 'rgba(88, 101, 242, 0.15)' }]}>
                <Ionicons name="cart-outline" size={20} color={Palette.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.capItemTitle}>Barang & Kuantitas</Text>
                <Text style={styles.capItemDesc}>Mengekstrak nama item, jumlah unit, & harga</Text>
              </View>
            </View>

            <View style={styles.capItem}>
              <View style={[styles.capIconBox, { backgroundColor: 'rgba(35, 165, 90, 0.15)' }]}>
                <Ionicons name="bicycle-outline" size={20} color="#23A55A" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.capItemTitle}>Ongkos Kirim (Delivery)</Text>
                <Text style={styles.capItemDesc}>Mendeteksi biaya kurir GoSend, Grab, JNE</Text>
              </View>
            </View>

            <View style={styles.capItem}>
              <View style={[styles.capIconBox, { backgroundColor: 'rgba(240, 178, 50, 0.15)' }]}>
                <Ionicons name="card-outline" size={20} color="#F0B232" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.capItemTitle}>Biaya Admin & Layanan</Text>
                <Text style={styles.capItemDesc}>Biaya jasa aplikasi, parkir, & service charge</Text>
              </View>
            </View>

            <View style={styles.capItem}>
              <View style={[styles.capIconBox, { backgroundColor: 'rgba(242, 63, 67, 0.15)' }]}>
                <Ionicons name="pricetag-outline" size={20} color="#F23F43" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.capItemTitle}>Diskon & Pajak</Text>
                <Text style={styles.capItemDesc}>Voucher hemat & pajak PPN dihitung bersih</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Quick Demo Templates Section */}
        <View style={styles.demoSection}>
          <Text style={styles.demoSectionTitle}>Simulasi Contoh Transaksi</Text>
          <Text style={styles.demoSectionSub}>
            Uji coba alur verifikasi dengan template struk realistis
          </Text>

          <View style={styles.demoButtonsContainer}>
            <TouchableOpacity
              style={styles.demoButton}
              onPress={() => handleDemoScan(0)}
              activeOpacity={0.8}
            >
              <Ionicons name="cube-outline" size={18} color={Palette.primary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.demoBtnText}>Pantry Kantor + Ongkir GoSend</Text>
                <Text style={styles.demoBtnSub}>Kopi, Tisu, Gula + Delivery Fee</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={Palette.darkTextMuted} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.demoButton}
              onPress={() => handleDemoScan(1)}
              activeOpacity={0.8}
            >
              <Ionicons name="restaurant-outline" size={18} color="#23A55A" />
              <View style={{ flex: 1 }}>
                <Text style={styles.demoBtnText}>Restoran + Service Charge</Text>
                <Text style={styles.demoBtnSub}>Makan siang tim + Pajak PB1 & Layanan</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={Palette.darkTextMuted} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.demoButton}
              onPress={() => handleDemoScan(2)}
              activeOpacity={0.8}
            >
              <Ionicons name="document-text-outline" size={18} color="#F0B232" />
              <View style={{ flex: 1 }}>
                <Text style={styles.demoBtnText}>Nota Manual Toko ATK</Text>
                <Text style={styles.demoBtnSub}>Kertas HVS, Map, & Pulpen Kantor</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={Palette.darkTextMuted} />
            </TouchableOpacity>
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
  capabilitiesCard: {
    marginHorizontal: 20,
    backgroundColor: Palette.darkCard,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 20,
  },
  capTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Palette.darkText,
    marginBottom: 14,
  },
  capGrid: {
    gap: 12,
  },
  capItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  capIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  capItemTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: Palette.darkText,
  },
  capItemDesc: {
    fontSize: 11,
    color: Palette.darkTextSecondary,
    marginTop: 1,
  },
  demoSection: {
    marginHorizontal: 20,
  },
  demoSectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Palette.darkText,
    marginBottom: 4,
  },
  demoSectionSub: {
    fontSize: 12,
    color: Palette.darkTextSecondary,
    marginBottom: 12,
  },
  demoButtonsContainer: {
    gap: 10,
  },
  demoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Palette.darkCard,
    borderRadius: 16,
    padding: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  demoBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: Palette.darkText,
  },
  demoBtnSub: {
    fontSize: 11,
    color: Palette.darkTextSecondary,
    marginTop: 1,
  },
});
