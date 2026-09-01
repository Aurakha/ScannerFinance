import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Header } from '@/components/common/Header';
import { Palette } from '@/constants/theme';
import { useAuthStore } from '@/store/authStore';
import { useTransactionStore } from '@/store/transactionStore';
import { formatRupiah } from '@/utils/formatters';
import {
  getGoogleDriveSettings,
  saveGoogleDriveSettings,
  GoogleDriveSettings,
} from '@/services/googleDriveService';

export default function ProfileScreen() {
  const { user, geminiApiKey, setGeminiApiKey, isDemoMode } = useAuthStore();
  const { budgetLimit, setBudgetLimit } = useTransactionStore();

  const [inputKey, setInputKey] = useState(geminiApiKey);
  const [inputBudget, setInputBudget] = useState(String(budgetLimit));
  const [isSavingKey, setIsSavingKey] = useState(false);

  // Google Drive State
  const [gdriveConfig, setGdriveConfig] = useState<GoogleDriveSettings>({
    isEnabled: false,
    accessToken: '',
    folderId: '',
    folderName: 'ScanFinance Receipts',
  });
  const [isSavingGDrive, setIsSavingGDrive] = useState(false);

  useEffect(() => {
    getGoogleDriveSettings().then(setGdriveConfig);
  }, []);

  const handleSaveApiKey = async () => {
    setIsSavingKey(true);
    await setGeminiApiKey(inputKey.trim());
    setIsSavingKey(false);
    Alert.alert('Tersimpan', 'Kunci Gemini API Key berhasil disimpan.');
  };

  const handleSaveBudget = () => {
    const val = Number(inputBudget) || 5000000;
    setBudgetLimit(val);
    Alert.alert('Tersimpan', `Batas anggaran bulanan disetel ke ${formatRupiah(val)}.`);
  };

  const handleSaveGDrive = async () => {
    setIsSavingGDrive(true);
    await saveGoogleDriveSettings(gdriveConfig);
    setIsSavingGDrive(false);
    Alert.alert(
      'Pengaturan Tersimpan',
      gdriveConfig.isEnabled
        ? 'Integrasi Google Drive aktif! Foto struk baru akan otomatis diunggah ke Google Drive Anda.'
        : 'Integrasi Google Drive dinonaktifkan.'
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <Header title="Profil & Setelan" subtitle="Kelola preferensi, Google Drive & integrasi AI" />

        {/* User Card */}
        <View style={styles.userCard}>
          <View style={styles.avatarLarge}>
            <Text style={styles.avatarLargeText}>
              {user?.full_name?.charAt(0).toUpperCase() || 'U'}
            </Text>
          </View>

          <View style={styles.userInfo}>
            <Text style={styles.userName}>{user?.full_name || 'Pengguna Cerdas'}</Text>
            <Text style={styles.userEmail}>{user?.email || 'demo@scanfinance.app'}</Text>

            <View style={styles.demoBadge}>
              <Ionicons
                name={isDemoMode ? 'flash-outline' : 'shield-checkmark-outline'}
                size={12}
                color={Palette.primary}
              />
              <Text style={styles.demoBadgeText}>
                {isDemoMode ? 'Database Siap / Mode Lokal' : 'Tersambung ke Supabase'}
              </Text>
            </View>
          </View>
        </View>

        {/* Google Drive Integration Card */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <View style={[styles.sectionIconBox, { backgroundColor: 'rgba(59, 130, 246, 0.15)' }]}>
              <Ionicons name="logo-google" size={20} color="#3B82F6" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionCardTitle}>Penyimpanan Google Drive</Text>
              <Text style={styles.sectionCardSub}>
                Simpan dan arsipkan foto struk belanja langsung ke Google Drive pribadi Anda
              </Text>
            </View>
            <Switch
              value={gdriveConfig.isEnabled}
              onValueChange={(val) => setGdriveConfig({ ...gdriveConfig, isEnabled: val })}
              trackColor={{ false: 'rgba(255,255,255,0.1)', true: Palette.primary }}
              thumbColor="#FFFFFF"
            />
          </View>

          {gdriveConfig.isEnabled && (
            <View style={styles.gdriveInputsContainer}>
              <Text style={styles.fieldLabel}>Google OAuth Access Token</Text>
              <TextInput
                style={[styles.textInput, { fontSize: 12, marginBottom: 10 }]}
                value={gdriveConfig.accessToken}
                onChangeText={(val) => setGdriveConfig({ ...gdriveConfig, accessToken: val })}
                secureTextEntry
                placeholder="ya29.a0AfH6..."
                placeholderTextColor={Palette.darkTextMuted}
              />

              <Text style={styles.fieldLabel}>Folder ID Google Drive (Opsional)</Text>
              <TextInput
                style={[styles.textInput, { fontSize: 12, marginBottom: 12 }]}
                value={gdriveConfig.folderId}
                onChangeText={(val) => setGdriveConfig({ ...gdriveConfig, folderId: val })}
                placeholder="1B2M3K4..."
                placeholderTextColor={Palette.darkTextMuted}
              />

              <TouchableOpacity style={styles.actionBtnFull} onPress={handleSaveGDrive}>
                <Text style={styles.actionBtnText}>
                  {isSavingGDrive ? 'Menyimpan...' : 'Simpan Pengaturan Google Drive'}
                </Text>
              </TouchableOpacity>

              <Text style={styles.hintText}>
                💡 Foto struk akan otomatis diunggah ke Google Drive dan link preview struk akan tersimpan di database.
              </Text>
            </View>
          )}
        </View>

        {/* Monthly Budget Setting */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionIconBox}>
              <Ionicons name="wallet-outline" size={20} color={Palette.primary} />
            </View>
            <View>
              <Text style={styles.sectionCardTitle}>Batas Anggaran Bulanan</Text>
              <Text style={styles.sectionCardSub}>Target maksimal pengeluaran per bulan</Text>
            </View>
          </View>

          <View style={styles.inputRow}>
            <TextInput
              style={styles.textInput}
              value={inputBudget}
              onChangeText={setInputBudget}
              keyboardType="numeric"
              placeholder="5000000"
              placeholderTextColor={Palette.darkTextMuted}
            />
            <TouchableOpacity style={styles.actionBtn} onPress={handleSaveBudget}>
              <Text style={styles.actionBtnText}>Simpan</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Gemini API Key Configuration */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <View style={[styles.sectionIconBox, { backgroundColor: 'rgba(99, 102, 241, 0.15)' }]}>
              <Ionicons name="sparkles-outline" size={20} color={Palette.indigo} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionCardTitle}>Google Gemini API Key</Text>
              <Text style={styles.sectionCardSub}>
                Gunakan API Key sendiri untuk pemindaian struk tak terbatas
              </Text>
            </View>
          </View>

          <View style={styles.inputRow}>
            <TextInput
              style={[styles.textInput, { fontSize: 12 }]}
              value={inputKey}
              onChangeText={setInputKey}
              secureTextEntry
              placeholder="AIzaSy..."
              placeholderTextColor={Palette.darkTextMuted}
            />
            <TouchableOpacity style={styles.actionBtn} onPress={handleSaveApiKey}>
              <Text style={styles.actionBtnText}>
                {isSavingKey ? 'Menyimpan...' : 'Simpan'}
              </Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.hintText}>
            💡 Jika dikosongkan, aplikasi akan menggunakan Supabase Edge Function atau template struk demo.
          </Text>
        </View>

        {/* App Info & About */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionCardTitle}>Tentang ScanFinance</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Versi Aplikasi</Text>
            <Text style={styles.infoVal}>v1.0.0 (Expo SDK 57)</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Penyimpanan Foto</Text>
            <Text style={styles.infoVal}>
              {gdriveConfig.isEnabled ? 'Google Drive' : 'Supabase Storage / Lokal'}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Database</Text>
            <Text style={styles.infoVal}>Supabase PostgreSQL + RLS</Text>
          </View>
        </View>
      </ScrollView>
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
  userCard: {
    marginHorizontal: 20,
    backgroundColor: Palette.darkCard,
    borderRadius: 20,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 20,
  },
  avatarLarge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Palette.primaryDark,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Palette.primaryLight,
    marginRight: 16,
  },
  avatarLargeText: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '700',
    color: Palette.darkText,
  },
  userEmail: {
    fontSize: 13,
    color: Palette.darkTextSecondary,
    marginTop: 2,
    marginBottom: 6,
  },
  demoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  demoBadgeText: {
    fontSize: 11,
    color: Palette.primaryLight,
    fontWeight: '600',
  },
  sectionCard: {
    marginHorizontal: 20,
    backgroundColor: Palette.darkCard,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 16,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  sectionIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Palette.darkText,
  },
  sectionCardSub: {
    fontSize: 12,
    color: Palette.darkTextSecondary,
    marginTop: 2,
  },
  gdriveInputsContainer: {
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
    paddingTop: 14,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: Palette.darkTextSecondary,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  inputRow: {
    flexDirection: 'row',
    gap: 10,
  },
  textInput: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: Palette.darkText,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  actionBtn: {
    backgroundColor: Palette.primary,
    paddingHorizontal: 18,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionBtnFull: {
    backgroundColor: '#3B82F6',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  hintText: {
    fontSize: 11,
    color: Palette.darkTextMuted,
    marginTop: 10,
    lineHeight: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.04)',
  },
  infoLabel: {
    fontSize: 12,
    color: Palette.darkTextSecondary,
  },
  infoVal: {
    fontSize: 12,
    fontWeight: '600',
    color: Palette.darkText,
  },
});
