import React, { useEffect, useState } from 'react';
import { TouchableOpacity, Text, StyleSheet, Platform, View, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Palette } from '@/constants/theme';
import { useThemeStore } from '@/store/themeStore';

export const PwaInstallButton: React.FC = () => {
  const { theme } = useThemeStore();
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showIosGuide, setShowIosGuide] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    // Deteksi jika aplikasi sudah dibuka dalam mode standalone (sudah terinstal)
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;

    if (isStandalone) {
      setIsInstalled(true);
      return;
    }

    const handleBeforeInstall = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  // Jika sudah terinstal, sembunyikan tombol
  if (isInstalled) return null;

  const handleInstallClick = async () => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    // Deteksi iOS Safari
    const isIOS =
      /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;

    if (isIOS) {
      setShowIosGuide(true);
      return;
    }

    if (deferredPrompt) {
      try {
        deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice && choice.outcome === 'accepted') {
          setIsInstalled(true);
        }
        setDeferredPrompt(null);
      } catch (err) {
        console.warn('Install prompt note:', err);
      }
    } else {
      window.alert(
        'Untuk menginstal ScanFinance:\n\n1. Klik ikon instal (💻/📱) di bilah alamat browser Anda, ATAU\n2. Buka menu titik tiga di browser lalu pilih "Instal ScanFinance".'
      );
    }
  };

  return (
    <>
      <TouchableOpacity
        style={[styles.installBtn, { backgroundColor: theme.primary, shadowColor: theme.primary }]}
        onPress={handleInstallClick}
        activeOpacity={0.8}
      >
        <Ionicons name="download-outline" size={14} color="#FFFFFF" />
        <Text style={styles.installBtnText}>Instal</Text>
      </TouchableOpacity>

      {/* Modal Petunjuk untuk Pengguna iOS */}
      <Modal visible={showIosGuide} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <Ionicons name="logo-apple" size={24} color="#FFFFFF" />
              <Text style={{ fontSize: 16, fontWeight: '800', color: '#FFFFFF' }}>
                Instal di iPhone / iPad
              </Text>
            </View>
            <Text style={{ fontSize: 13, color: '#D1D5DB', lineHeight: 22, marginBottom: 18 }}>
              1. Tekan tombol <Text style={{ fontWeight: '700', color: '#FFFFFF' }}>Bagikan (Share 📤)</Text> di bar bawah Safari.{'\n'}
              2. Gulir ke bawah lalu pilih <Text style={{ fontWeight: '700', color: Palette.primaryLight }}>"Tambahkan ke Layar Utama"</Text> (Add to Home Screen).{'\n'}
              3. Tekan <Text style={{ fontWeight: '700', color: '#FFFFFF' }}>Tambah (Add)</Text> di pojok kanan atas.
            </Text>
            <TouchableOpacity
              style={styles.closeModalBtn}
              onPress={() => setShowIosGuide(false)}
            >
              <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 13 }}>
                Mengerti
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  installBtn: {
    backgroundColor: Palette.primary,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    shadowColor: Palette.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 5,
    elevation: 3,
  },
  installBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#1E222D',
    borderRadius: 18,
    padding: 20,
    maxWidth: 380,
    width: '100%',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  closeModalBtn: {
    backgroundColor: Palette.primary,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
});
