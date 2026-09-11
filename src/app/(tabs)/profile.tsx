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
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Header } from '@/components/common/Header';
import { Palette } from '@/constants/theme';
import { useAuthStore } from '@/store/authStore';
import { useThemeStore } from '@/store/themeStore';
import { useLanguageStore } from '@/store/languageStore';
import { formatRupiah } from '@/utils/formatters';

export default function ProfileScreen() {
  const router = useRouter();
  const { user, session, updateProfile, signOut } = useAuthStore();
  const { theme, mode, toggleTheme } = useThemeStore();
  const { t, language } = useLanguageStore();

  const [fullName, setFullName] = useState(user?.full_name || 'Guest');
  const [companyName, setCompanyName] = useState(user?.company_name || '');
  const [department, setDepartment] = useState(user?.department || '');

  const [isSaving, setIsSaving] = useState(false);

  React.useEffect(() => {
    if (user) {
      setFullName(user.full_name || '');
      setCompanyName(user.company_name || '');
      setDepartment(user.department || '');
    }
  }, [user]);

  const handleSaveProfile = async () => {
    setIsSaving(true);
    try {
      await updateProfile({
        full_name: fullName,
        company_name: companyName,
        department,
      });

      if (Platform.OS === 'web') {
        window.alert(t('profile.profileUpdatedSuccess'));
      } else {
        Alert.alert(t('common.success'), t('profile.profileUpdatedSuccess'));
      }
    } catch (err: any) {
      if (Platform.OS === 'web') {
        window.alert(t('profile.profileUpdateFailed', { error: err.message }));
      } else {
        Alert.alert(t('common.failed'), t('profile.profileUpdateFailed', { error: err.message }));
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = async () => {
    if (Platform.OS === 'web') {
      const confirmed = window.confirm(t('profile.logoutConfirm'));
      if (confirmed) {
        await signOut();
        router.replace('/auth/login');
      }
      return;
    }

    Alert.alert(t('profile.logout'), t('profile.logoutConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('profile.logout'),
        style: 'destructive',
        onPress: async () => {
          await signOut();
          router.replace('/auth/login');
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <Header
          title={t('profile.title')}
          subtitle={t('profile.subtitle')}
          rightAction={
            <TouchableOpacity
              style={[styles.themeBtn, { backgroundColor: theme.cardHover }]}
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

        {/* User Account Card */}
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={styles.userHeaderRow}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarInitial}>
                {fullName ? fullName.charAt(0).toUpperCase() : 'G'}
              </Text>
            </View>
            <View style={styles.userInfoCol}>
              <Text style={[styles.userName, { color: theme.text }]}>{fullName || 'Guest'}</Text>
              <Text style={[styles.userEmail, { color: theme.textSecondary }]}>
                {user?.email || 'guest@scanfinance.com'}
              </Text>
              <View style={styles.badgeRow}>
                <View
                  style={[
                    styles.statusBadge,
                    { backgroundColor: session ? 'rgba(35, 165, 90, 0.15)' : 'rgba(240, 178, 50, 0.15)' },
                  ]}
                >
                  <View
                    style={[
                      styles.statusDot,
                      { backgroundColor: session ? Palette.greenOnline : Palette.amberIdle },
                    ]}
                  />
                  <Text
                    style={[
                      styles.statusText,
                      { color: session ? Palette.greenOnline : Palette.amberIdle },
                    ]}
                  >
                    {session
                      ? (language === 'id' ? 'Akun Supabase Aktif' : 'Supabase Account Active')
                      : (language === 'id' ? 'Mode Tamu / Demo' : 'Guest / Demo Mode')}
                  </Text>
                </View>

                {user?.role === 'admin' && (
                  <View
                    style={[
                      styles.statusBadge,
                      { backgroundColor: 'rgba(88, 101, 242, 0.15)', marginTop: 4 },
                    ]}
                  >
                    <Ionicons name="shield-checkmark" size={12} color={Palette.primary} />
                    <Text style={[styles.statusText, { color: Palette.primary }]}>
                      Role: Admin
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </View>

          <View style={styles.authBtnRow}>
            {!session ? (
              <TouchableOpacity
                style={styles.loginBtn}
                onPress={() => router.push('/auth/login')}
              >
                <Ionicons name="log-in-outline" size={16} color="#FFFFFF" />
                <Text style={styles.loginBtnText}>
                  {language === 'id' ? 'Masuk / Daftar Akun Pribadi' : 'Sign In / Register Account'}
                </Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
                <Ionicons name="log-out-outline" size={16} color={Palette.coral} />
                <Text style={styles.logoutBtnText}>{t('profile.logout')}</Text>
              </TouchableOpacity>
            )}

            {/* Tombol Panel Super Admin */}
            {user?.role === 'admin' && (
              <TouchableOpacity
                style={[
                  styles.adminPanelBtn,
                  {
                    backgroundColor: 'rgba(88, 101, 242, 0.12)',
                    borderColor: Palette.primary,
                    borderWidth: 1.5,
                  },
                ]}
                onPress={() => router.push('/admin' as any)}
              >
                <Ionicons name="shield-checkmark" size={18} color={Palette.primary} />
                <Text style={[styles.adminPanelBtnText, { color: Palette.primary, fontWeight: '700' }]}>
                  {language === 'id' ? 'Buka Panel Super Admin 🛡️' : 'Open Super Admin Panel 🛡️'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Company & Reimbursement Profile Form */}
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            {t('profile.companySectionTitle')}
          </Text>
          <Text style={[styles.sectionSubtitle, { color: theme.textMuted }]}>
            {t('profile.companySectionSubtitle')}
          </Text>

          {/* Form Fields Grid */}
          <View style={styles.formGrid}>
            <View style={styles.formField}>
              <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>
                {t('profile.companyName')}
              </Text>
              <TextInput
                style={[styles.textInput, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
                value={companyName}
                onChangeText={setCompanyName}
                placeholder="Misal: PT. San Kawan Abadi"
                placeholderTextColor={theme.textMuted}
              />
            </View>

            <View style={styles.formField}>
              <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>
                {t('profile.fullName')}
              </Text>
              <TextInput
                style={[styles.textInput, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
                value={fullName}
                onChangeText={setFullName}
                placeholder="Misal: Gabriel Rudra Renata"
                placeholderTextColor={theme.textMuted}
              />
            </View>

            <View style={styles.formField}>
              <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>
                {t('profile.department')}
              </Text>
              <TextInput
                style={[styles.textInput, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
                value={department}
                onChangeText={setDepartment}
                placeholder="Misal: Divisi Operasional & Lapangan"
                placeholderTextColor={theme.textMuted}
              />
            </View>

            {/* Banner Penjelasan Pemindahan Cash Advance ke Menu Input */}
            <View
              style={{
                backgroundColor: 'rgba(88, 101, 242, 0.08)',
                borderColor: 'rgba(88, 101, 242, 0.25)',
                borderWidth: 1,
                borderRadius: 14,
                padding: 16,
                marginTop: 8,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <Ionicons name="wallet-outline" size={20} color={Palette.primary} />
                <Text style={{ fontSize: 14, fontWeight: '700', color: theme.text }}>
                  {language === 'id' ? 'Kelola Proyek & Multi-Cash Advance' : 'Manage Projects & Multi-Cash Advance'}
                </Text>
              </View>
              <Text style={{ fontSize: 12, lineHeight: 18, color: theme.textSecondary, marginBottom: 12 }}>
                {language === 'id'
                  ? 'Pengaturan nama proyek, lokasi kota, nominal cash advance awal, pemeriksa, penyetuju, dan kolaborator kini dikelola secara dinamis (bisa lebih dari 1 cash advance) di menu Input.'
                  : 'Project name, city, initial cash advance, verifier, approver, and collaborators are now dynamically managed in the Input menu.'}
              </Text>
              <TouchableOpacity
                style={{
                  backgroundColor: Palette.primary,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingVertical: 10,
                  paddingHorizontal: 14,
                  borderRadius: 10,
                  gap: 6,
                }}
                onPress={() => router.push('/(tabs)/analytics')}
              >
                <Ionicons name="create-outline" size={16} color="#FFFFFF" />
                <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '700' }}>
                  {language === 'id' ? 'Buka Menu Input Cash Advance ➔' : 'Open Input Cash Advance ➔'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Save Button */}
          <TouchableOpacity
            style={styles.saveProfileBtn}
            onPress={handleSaveProfile}
            disabled={isSaving}
          >
            <Ionicons name="checkmark-circle-outline" size={18} color="#FFFFFF" />
            <Text style={styles.saveProfileBtnText}>
              {isSaving ? t('common.saving') : t('profile.saveProfileBtn')}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
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
    paddingHorizontal: 16,
    paddingBottom: 90,
  },
  themeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    borderRadius: 18,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
  },
  userHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  avatarCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Palette.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  userInfoCol: {
    flex: 1,
  },
  userName: {
    fontSize: 17,
    fontWeight: '800',
  },
  userEmail: {
    fontSize: 12,
    marginTop: 2,
  },
  badgeRow: {
    marginTop: 6,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    gap: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  authBtnRow: {
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    paddingTop: 14,
  },
  loginBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Palette.primary,
    paddingVertical: 10,
    borderRadius: 10,
    gap: 8,
  },
  loginBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(242, 63, 67, 0.1)',
    paddingVertical: 10,
    borderRadius: 10,
    gap: 8,
  },
  logoutBtnText: {
    color: Palette.coral,
    fontWeight: '700',
    fontSize: 13,
  },
  adminPanelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 8,
    gap: 8,
  },
  adminPanelBtnText: {
    fontWeight: '700',
    fontSize: 13,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  sectionSubtitle: {
    fontSize: 12,
    marginTop: 2,
    marginBottom: 14,
  },
  themeSelectorRow: {
    flexDirection: 'row',
    gap: 12,
  },
  themeOptionCard: {
    flex: 1,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
  },
  themeOptionActive: {
    borderColor: Palette.primary,
  },
  themeOptionTitle: {
    fontSize: 13,
    fontWeight: '800',
    marginTop: 6,
  },
  themeOptionDesc: {
    fontSize: 11,
    marginTop: 2,
  },
  formGrid: {
    gap: 10,
  },
  formField: {
    marginBottom: 4,
  },
  rowTwoCols: {
    flexDirection: 'row',
    gap: 10,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  textInput: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
  },
  saveProfileBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Palette.primary,
    borderRadius: 12,
    paddingVertical: 12,
    marginTop: 16,
    gap: 8,
  },
  saveProfileBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
});
