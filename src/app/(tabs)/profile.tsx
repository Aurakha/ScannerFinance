import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Header } from '@/components/common/Header';
import { Palette } from '@/constants/theme';
import { useAuthStore } from '@/store/authStore';
import { useTransactionStore } from '@/store/transactionStore';
import { formatRupiah } from '@/utils/formatters';

export default function ProfileScreen() {
  const { user } = useAuthStore();
  const { budgetLimit, setBudgetLimit } = useTransactionStore();

  const [inputBudget, setInputBudget] = useState(String(budgetLimit));

  const handleSaveBudget = () => {
    const val = Number(inputBudget) || 5000000;
    setBudgetLimit(val);
    Alert.alert('Tersimpan', `Batas anggaran bulanan disetel ke ${formatRupiah(val)}.`);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <Header title="Profil & Setelan" subtitle="Kelola preferensi & akun Anda" />

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

            <View style={styles.statusBadge}>
              <View style={styles.onlineDot} />
              <Text style={styles.statusBadgeText}>Akun Aktif</Text>
            </View>
          </View>
        </View>

        {/* Cloud & AI Services Status Card */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionCardTitle}>Status Layanan Otomatis</Text>
          <Text style={styles.sectionCardSub}>
            Layanan AI, Database, dan Cloud Storage sudah terkonfigurasi otomatis
          </Text>

          <View style={styles.serviceRow}>
            <View style={styles.serviceLeft}>
              <View style={[styles.serviceIcon, { backgroundColor: 'rgba(88, 101, 242, 0.15)' }]}>
                <Ionicons name="sparkles" size={18} color={Palette.primary} />
              </View>
              <View>
                <Text style={styles.serviceName}>Google Gemini 3.6 Flash AI</Text>
                <Text style={styles.serviceDesc}>Pemindaian & Ekstraksi Struk Belanja</Text>
              </View>
            </View>
            <View style={styles.activePill}>
              <Ionicons name="checkmark-circle" size={14} color="#23A55A" />
              <Text style={styles.activePillText}>Aktif</Text>
            </View>
          </View>

          <View style={styles.serviceRow}>
            <View style={styles.serviceLeft}>
              <View style={[styles.serviceIcon, { backgroundColor: 'rgba(59, 130, 246, 0.15)' }]}>
                <Ionicons name="logo-google" size={18} color="#3B82F6" />
              </View>
              <View>
                <Text style={styles.serviceName}>Penyimpanan Google Drive</Text>
                <Text style={styles.serviceDesc}>Arsip Foto Struk Otomatis</Text>
              </View>
            </View>
            <View style={styles.activePill}>
              <Ionicons name="checkmark-circle" size={14} color="#23A55A" />
              <Text style={styles.activePillText}>Aktif</Text>
            </View>
          </View>

          <View style={[styles.serviceRow, { borderBottomWidth: 0 }]}>
            <View style={styles.serviceLeft}>
              <View style={[styles.serviceIcon, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
                <Ionicons name="server" size={18} color="#10B981" />
              </View>
              <View>
                <Text style={styles.serviceName}>Supabase PostgreSQL</Text>
                <Text style={styles.serviceDesc}>Database Transaksi & Row Level Security</Text>
              </View>
            </View>
            <View style={styles.activePill}>
              <Ionicons name="checkmark-circle" size={14} color="#23A55A" />
              <Text style={styles.activePillText}>Aktif</Text>
            </View>
          </View>
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

        {/* App Info & About */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionCardTitle}>Tentang ScanFinance</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Versi Aplikasi</Text>
            <Text style={styles.infoVal}>v1.0.0 (Expo SDK 57)</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Tema Desain</Text>
            <Text style={styles.infoVal}>Discord Dark & Blurple</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Penyimpanan Foto</Text>
            <Text style={styles.infoVal}>Google Drive</Text>
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
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(35, 165, 90, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  onlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#23A55A',
  },
  statusBadgeText: {
    fontSize: 11,
    color: '#23A55A',
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
    backgroundColor: 'rgba(88, 101, 242, 0.15)',
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
    marginBottom: 12,
  },
  serviceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  serviceLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  serviceIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  serviceName: {
    fontSize: 13,
    fontWeight: '600',
    color: Palette.darkText,
  },
  serviceDesc: {
    fontSize: 11,
    color: Palette.darkTextSecondary,
    marginTop: 1,
  },
  activePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(35, 165, 90, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  activePillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#23A55A',
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
  actionBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
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
