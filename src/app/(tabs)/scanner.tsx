import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Platform,
  SafeAreaView,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { CameraGuideOverlay } from '@/components/scanner/CameraGuideOverlay';
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
  const cameraRef = useRef<any>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [torchOn, setTorchOn] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [scanResult, setScanResult] = useState<ReceiptScanResult | null>(null);
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [capturedImageUri, setCapturedImageUri] = useState<string | null>(null);

  const { addTransaction, categories } = useTransactionStore();
  const { geminiApiKey } = useAuthStore();

  const handleCapture = async () => {
    if (cameraRef.current && Platform.OS !== 'web') {
      try {
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.8,
          base64: true,
          skipProcessing: true,
        });
        if (photo?.uri) {
          processImage(photo.uri, photo.base64);
        }
      } catch (err) {
        console.warn('Capture error:', err);
        handleDemoScan(0);
      }
    } else {
      handlePickImage();
    }
  };

  const handlePickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets?.[0]?.uri) {
        processImage(result.assets[0].uri, result.assets[0].base64 || undefined);
      }
    } catch (err) {
      console.warn('Pick image error:', err);
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
        'Pemberitahuan Scan AI',
        err.message || 'Terjadi kesalahan saat memproses gambar.'
      );
    }
  };

  const handleDemoScan = async (demoIndex = 0) => {
    setIsProcessing(true);
    await new Promise((resolve) => setTimeout(resolve, 1500));
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

      Alert.alert('Berhasil! 🎉', 'Transaksi dan rincian struk belanja telah berhasil disimpan.', [
        {
          text: 'Lihat di Riwayat',
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

  const hasPermission = permission?.granted;

  return (
    <View style={styles.container}>
      {/* Native Camera View vs Web/Fallback View */}
      {Platform.OS !== 'web' && hasPermission ? (
        <CameraView
          ref={cameraRef}
          style={styles.cameraFill}
          facing="back"
          enableTorch={torchOn}
        />
      ) : (
        <View style={styles.mockCameraView}>
          <View style={styles.mockGridLine} />
          <View style={[styles.mockGridLine, { transform: [{ rotate: '90deg' }] }]} />

          {!hasPermission && Platform.OS !== 'web' ? (
            <View style={styles.permissionCard}>
              <Ionicons name="camera-outline" size={48} color={Palette.primary} />
              <Text style={styles.permissionTitle}>Izin Kamera Diperlukan</Text>
              <Text style={styles.permissionSubtitle}>
                ScanFinance membutuhkan akses kamera untuk memindai struk belanja fisik Anda.
              </Text>
              <TouchableOpacity
                style={styles.permissionButton}
                onPress={requestPermission}
              >
                <Text style={styles.permissionButtonText}>Izinkan Akses Kamera</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.webCameraNotice}>
              <Ionicons name="scan-circle-outline" size={64} color={Palette.primary} />
              <Text style={styles.webNoticeTitle}>Smart Receipt Scanner</Text>
              <Text style={styles.webNoticeSubtitle}>
                Klik tombol Galeri untuk mengunggah foto struk asli, atau tombol Demo AI untuk melihat simulasi
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Camera UI Overlay */}
      <CameraGuideOverlay
        torchOn={torchOn}
        onToggleTorch={() => setTorchOn(!torchOn)}
        onPickImage={handlePickImage}
        onCapture={handleCapture}
        onSelectDemo={() => handleDemoScan(0)}
      />

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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  cameraFill: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  mockCameraView: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: '#0A0F1D',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mockGridLine: {
    position: 'absolute',
    width: '100%',
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  permissionCard: {
    backgroundColor: Palette.darkCard,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    marginHorizontal: 30,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  permissionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Palette.darkText,
    marginTop: 12,
    marginBottom: 6,
  },
  permissionSubtitle: {
    fontSize: 13,
    color: Palette.darkTextSecondary,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
  },
  permissionButton: {
    backgroundColor: Palette.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 14,
  },
  permissionButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  webCameraNotice: {
    alignItems: 'center',
    paddingHorizontal: 30,
  },
  webNoticeTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: Palette.darkText,
    marginTop: 14,
    marginBottom: 6,
  },
  webNoticeSubtitle: {
    fontSize: 13,
    color: Palette.darkTextSecondary,
    textAlign: 'center',
    maxWidth: 280,
    lineHeight: 18,
  },
});
