import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  ScrollView,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Palette } from '@/constants/theme';
import { useAuthStore } from '@/store/authStore';
import { useThemeStore } from '@/store/themeStore';

export default function RegisterScreen() {
  const router = useRouter();
  const { signUp, isLoading } = useAuthStore();
  const { theme, mode, toggleTheme } = useThemeStore();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Modal Pop-Up Berhasil & Konfirmasi Email
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState('');

  const handleRegister = async () => {
    setErrorMessage('');
    if (!fullName.trim() || !email.trim() || !password.trim()) {
      setErrorMessage('Semua kolom wajib diisi.');
      return;
    }

    if (password.length < 6) {
      setErrorMessage('Kata sandi minimal 6 karakter.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Konfirmasi kata sandi tidak cocok.');
      return;
    }

    const { error } = await signUp(email.trim(), password, fullName.trim());
    if (error) {
      setErrorMessage(error);
    } else {
      setRegisteredEmail(email.trim());
      setShowSuccessModal(true);
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.topBar}>
            <TouchableOpacity
              style={[styles.backBtn, { backgroundColor: theme.cardHover }]}
              onPress={() => router.back()}
            >
              <Ionicons name="arrow-back" size={18} color={theme.text} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.themeToggle, { backgroundColor: theme.cardHover }]}
              onPress={toggleTheme}
            >
              <Ionicons
                name={mode === 'dark' ? 'sunny' : 'moon'}
                size={18}
                color={mode === 'dark' ? Palette.amber : Palette.primary}
              />
            </TouchableOpacity>
          </View>

          <View style={styles.content}>
            {/* Header */}
            <View style={styles.headerBox}>
              <Text style={[styles.appTitle, { color: theme.text }]}>Buat Akun Baru</Text>
              <Text style={[styles.appSubtitle, { color: theme.textSecondary }]}>
                Daftarkan akun Anda untuk mengelola pembukuan dan reimbursement terpisah
              </Text>
            </View>

            {/* Register Card */}
            <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
              {/* Inline Error Banner */}
              {errorMessage ? (
                <View style={styles.errorBanner}>
                  <Ionicons name="alert-circle" size={20} color={Palette.coral} />
                  <Text style={styles.errorBannerText}>{errorMessage}</Text>
                </View>
              ) : null}

              {/* Full Name */}
              <View style={styles.fieldGroup}>
                <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>
                  Nama Lengkap
                </Text>
                <View
                  style={[
                    styles.inputWrapper,
                    { backgroundColor: theme.background, borderColor: theme.border },
                  ]}
                >
                  <Ionicons name="person-outline" size={18} color={theme.textMuted} />
                  <TextInput
                    style={[styles.input, { color: theme.text }]}
                    value={fullName}
                    onChangeText={(val) => {
                      setFullName(val);
                      if (errorMessage) setErrorMessage('');
                    }}
                    placeholder="Contoh: User 1"
                    placeholderTextColor={theme.textMuted}
                  />
                </View>
              </View>

              {/* Email Field */}
              <View style={styles.fieldGroup}>
                <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Email</Text>
                <View
                  style={[
                    styles.inputWrapper,
                    { backgroundColor: theme.background, borderColor: theme.border },
                  ]}
                >
                  <Ionicons name="mail-outline" size={18} color={theme.textMuted} />
                  <TextInput
                    style={[styles.input, { color: theme.text }]}
                    value={email}
                    onChangeText={setEmail}
                    placeholder="nama@perusahaan.com"
                    placeholderTextColor={theme.textMuted}
                    autoCapitalize="none"
                    keyboardType="email-address"
                  />
                </View>
              </View>

              {/* Password Field */}
              <View style={styles.fieldGroup}>
                <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>
                  Kata Sandi (Min. 6 Karakter)
                </Text>
                <View
                  style={[
                    styles.inputWrapper,
                    { backgroundColor: theme.background, borderColor: theme.border },
                  ]}
                >
                  <Ionicons name="lock-closed-outline" size={18} color={theme.textMuted} />
                  <TextInput
                    style={[styles.input, { color: theme.text }]}
                    value={password}
                    onChangeText={setPassword}
                    placeholder="••••••••"
                    placeholderTextColor={theme.textMuted}
                    secureTextEntry={!showPassword}
                  />
                  <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                    <Ionicons
                      name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={18}
                      color={theme.textMuted}
                    />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Confirm Password */}
              <View style={styles.fieldGroup}>
                <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>
                  Ulangi Kata Sandi
                </Text>
                <View
                  style={[
                    styles.inputWrapper,
                    { backgroundColor: theme.background, borderColor: theme.border },
                  ]}
                >
                  <Ionicons name="shield-checkmark-outline" size={18} color={theme.textMuted} />
                  <TextInput
                    style={[styles.input, { color: theme.text }]}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    placeholder="••••••••"
                    placeholderTextColor={theme.textMuted}
                    secureTextEntry={!showPassword}
                  />
                </View>
              </View>

              {/* Submit Button */}
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={handleRegister}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.primaryButtonText}>Daftar Akun Baru</Text>
                )}
              </TouchableOpacity>
            </View>

            {/* Footer Login Link */}
            <View style={styles.footerLinkRow}>
              <Text style={[styles.footerText, { color: theme.textMuted }]}>
                Sudah memiliki akun?{' '}
              </Text>
              <TouchableOpacity onPress={() => router.push('/auth/login')}>
                <Text style={styles.loginLink}>Masuk di sini</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Pop-up Modal Pendaftaran Berhasil & Info Cek Email */}
      <Modal visible={showSuccessModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={styles.successIconCircle}>
              <Ionicons name="checkmark-circle" size={48} color={Palette.greenOnline} />
            </View>

            <Text style={[styles.modalSuccessTitle, { color: theme.text }]}>
              Pendaftaran Berhasil! 🎉
            </Text>
            
            <Text style={[styles.modalSuccessSubtitle, { color: theme.textSecondary }]}>
              Akun Anda telah berhasil didaftarkan di sistem.
            </Text>

            {/* Email Confirmation Notice Box */}
            <View style={styles.emailNoticeBox}>
              <View style={styles.emailNoticeHeader}>
                <Ionicons name="mail-unread-outline" size={20} color={Palette.primary} />
                <Text style={styles.emailNoticeTitle}>Cek & Konfirmasi Email Anda</Text>
              </View>
              <Text style={styles.emailNoticeText}>
                Tautan konfirmasi telah dikirim ke:
              </Text>
              <Text style={styles.emailHighlightText}>{registeredEmail}</Text>
              <Text style={[styles.emailNoticeText, { marginTop: 6, fontSize: 11 }]}>
                Silakan buka kotak masuk (*inbox* atau *spam*) email Anda dan klik tautan konfirmasi untuk mengaktifkan akun sebelum login.
              </Text>
            </View>

            {/* Action Buttons */}
            <TouchableOpacity
              style={[styles.primaryButton, styles.modalPrimaryBtn]}
              onPress={() => {
                setShowSuccessModal(false);
                router.replace('/auth/login');
              }}
            >
              <Ionicons name="log-in-outline" size={20} color="#FFFFFF" />
              <Text style={styles.primaryButtonText}>Menuju Halaman Masuk (Login)</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  scrollContent: {
    paddingBottom: 40,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 10,
    marginBottom: 10,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  themeToggle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    paddingHorizontal: 20,
    maxWidth: 440,
    width: '100%',
    alignSelf: 'center',
  },
  headerBox: {
    alignItems: 'center',
    marginBottom: 20,
  },
  appTitle: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  appSubtitle: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 6,
    paddingHorizontal: 10,
  },
  card: {
    borderRadius: 20,
    padding: 22,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(242, 63, 67, 0.12)',
    borderColor: 'rgba(242, 63, 67, 0.35)',
    borderWidth: 1,
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
    gap: 10,
  },
  errorBannerText: {
    flex: 1,
    color: Palette.coral,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 18,
  },
  fieldGroup: {
    marginBottom: 12,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    height: 44,
    gap: 10,
  },
  input: {
    flex: 1,
    fontSize: 13,
  },
  primaryButton: {
    width: '100%',
    backgroundColor: Palette.primary,
    borderRadius: 14,
    height: 48,
    paddingHorizontal: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 14,
  },
  modalPrimaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 16,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  footerLinkRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
  },
  footerText: {
    fontSize: 13,
  },
  loginLink: {
    fontSize: 13,
    fontWeight: '700',
    color: Palette.primaryLight,
  },
  // Modal Pop-Up Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    maxWidth: 440,
    width: '100%',
    alignSelf: 'center',
    alignItems: 'center',
  },
  successIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(35, 165, 90, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalSuccessTitle: {
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
  },
  modalSuccessSubtitle: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 16,
  },
  emailNoticeBox: {
    width: '100%',
    backgroundColor: 'rgba(88, 101, 242, 0.08)',
    borderColor: 'rgba(88, 101, 242, 0.3)',
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
  },
  emailNoticeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  emailNoticeTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Palette.primaryLight,
  },
  emailNoticeText: {
    fontSize: 12,
    color: '#94a3b8',
    lineHeight: 17,
  },
  emailHighlightText: {
    fontSize: 13,
    fontWeight: '800',
    color: Palette.primary,
    marginTop: 3,
  },
  secondaryModalBtn: {
    width: '100%',
    height: 46,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    marginTop: 10,
  },
  secondaryModalBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
