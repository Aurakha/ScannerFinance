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
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Palette, Colors } from '@/constants/theme';
import { useAuthStore } from '@/store/authStore';
import { useThemeStore } from '@/store/themeStore';

export default function LoginScreen() {
  const router = useRouter();
  const { signIn, loginAsDemo, resetPasswordForEmail, isLoading } = useAuthStore();
  const { theme, mode, toggleTheme } = useThemeStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Forgot Password State
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotStatus, setForgotStatus] = useState<{ type: 'error' | 'success'; text: string } | null>(null);
  const [isSendingReset, setIsSendingReset] = useState(false);

  const handleLogin = async () => {
    setErrorMessage('');
    if (!email.trim() || !password.trim()) {
      setErrorMessage('Email dan password tidak boleh kosong.');
      return;
    }

    const { error } = await signIn(email.trim(), password);
    if (error) {
      setErrorMessage(error);
    } else {
      router.replace('/(tabs)');
    }
  };

  const handleSendResetPassword = async () => {
    setForgotStatus(null);
    if (!forgotEmail.trim()) {
      setForgotStatus({ type: 'error', text: 'Silakan masukkan alamat email Anda.' });
      return;
    }

    setIsSendingReset(true);
    const { error } = await resetPasswordForEmail(forgotEmail.trim());
    setIsSendingReset(false);

    if (error) {
      setForgotStatus({ type: 'error', text: error });
    } else {
      setForgotStatus({
        type: 'success',
        text: 'Link reset kata sandi telah dikirim ke email Anda! Silakan periksa inbox / spam Anda.',
      });
    }
  };

  const handleDemoMode = () => {
    loginAsDemo();
    router.replace('/(tabs)');
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.topBar}>
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
          {/* Logo & Header */}
          <View style={styles.headerBox}>
            <View style={styles.logoBadge}>
              <Ionicons name="scan" size={32} color="#FFFFFF" />
            </View>
            <Text style={[styles.appTitle, { color: theme.text }]}>ScanFinance</Text>
            <Text style={[styles.appSubtitle, { color: theme.textSecondary }]}>
              Kelola pembukuan, struk belanja, dan klaim reimbursement berbasis AI
            </Text>
          </View>

          {/* Login Card */}
          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.cardTitle, { color: theme.text }]}>Selamat Datang!</Text>
            <Text style={[styles.cardSubtitle, { color: theme.textMuted }]}>
              Masuk ke akun Anda untuk mengakses dashboard pribadi
            </Text>

            {/* Inline Error Notification Banner */}
            {errorMessage ? (
              <View style={styles.errorBanner}>
                <Ionicons name="alert-circle" size={20} color={Palette.coral} />
                <Text style={styles.errorBannerText}>{errorMessage}</Text>
              </View>
            ) : null}

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
                  onChangeText={(val) => {
                    setEmail(val);
                    if (errorMessage) setErrorMessage('');
                  }}
                  placeholder="nama@perusahaan.com"
                  placeholderTextColor={theme.textMuted}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
              </View>
            </View>

            {/* Password Field */}
            <View style={styles.fieldGroup}>
              <View style={styles.labelRow}>
                <Text style={[styles.fieldLabel, { color: theme.textSecondary, marginBottom: 0 }]}>Kata Sandi</Text>
                <TouchableOpacity onPress={() => {
                  setForgotEmail(email);
                  setForgotStatus(null);
                  setShowForgotModal(true);
                }}>
                  <Text style={styles.forgotPasswordText}>Lupa Kata Sandi?</Text>
                </TouchableOpacity>
              </View>
              <View
                style={[
                  styles.inputWrapper,
                  { backgroundColor: theme.background, borderColor: theme.border, marginTop: 6 },
                ]}
              >
                <Ionicons name="lock-closed-outline" size={18} color={theme.textMuted} />
                <TextInput
                  style={[styles.input, { color: theme.text }]}
                  value={password}
                  onChangeText={(val) => {
                    setPassword(val);
                    if (errorMessage) setErrorMessage('');
                  }}
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

            {/* Submit Button */}
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handleLogin}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryButtonText}>Masuk ke Akun</Text>
              )}
            </TouchableOpacity>

            {/* Demo Mode Button */}
            <TouchableOpacity
              style={[
                styles.secondaryButton,
                { backgroundColor: theme.cardHover, borderColor: theme.border },
              ]}
              onPress={handleDemoMode}
            >
              <Ionicons name="sparkles-outline" size={16} color={Palette.primary} />
              <Text style={[styles.secondaryButtonText, { color: theme.text }]}>
                Masuk Cepat Mode Tamu / Demo
              </Text>
            </TouchableOpacity>
          </View>

          {/* Footer Register Link */}
          <View style={styles.footerLinkRow}>
            <Text style={[styles.footerText, { color: theme.textMuted }]}>
              Belum punya akun?{' '}
            </Text>
            <TouchableOpacity onPress={() => router.push('/auth/register')}>
              <Text style={styles.registerLink}>Daftar Sekarang</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* Modal Lupa Kata Sandi */}
      <Modal visible={showForgotModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleRow}>
                <Ionicons name="key-outline" size={20} color={Palette.primary} />
                <Text style={[styles.modalTitle, { color: theme.text }]}>Reset Kata Sandi</Text>
              </View>
              <TouchableOpacity onPress={() => setShowForgotModal(false)}>
                <Ionicons name="close" size={22} color={theme.textMuted} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.modalSubtitle, { color: theme.textSecondary }]}>
              Masukkan alamat email akun Anda. Kami akan mengirimkan tautan reset kata sandi resmi dari Supabase.
            </Text>

            {forgotStatus ? (
              <View
                style={[
                  styles.modalStatusBanner,
                  forgotStatus.type === 'success'
                    ? { backgroundColor: 'rgba(35, 165, 90, 0.15)', borderColor: Palette.greenOnline }
                    : { backgroundColor: 'rgba(242, 63, 67, 0.15)', borderColor: Palette.coral },
                ]}
              >
                <Ionicons
                  name={forgotStatus.type === 'success' ? 'checkmark-circle' : 'alert-circle'}
                  size={18}
                  color={forgotStatus.type === 'success' ? Palette.greenOnline : Palette.coral}
                />
                <Text
                  style={[
                    styles.modalStatusText,
                    { color: forgotStatus.type === 'success' ? Palette.greenOnline : Palette.coral },
                  ]}
                >
                  {forgotStatus.text}
                </Text>
              </View>
            ) : null}

            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Alamat Email</Text>
              <View
                style={[
                  styles.inputWrapper,
                  { backgroundColor: theme.background, borderColor: theme.border },
                ]}
              >
                <Ionicons name="mail-outline" size={18} color={theme.textMuted} />
                <TextInput
                  style={[styles.input, { color: theme.text }]}
                  value={forgotEmail}
                  onChangeText={(val) => {
                    setForgotEmail(val);
                    if (forgotStatus) setForgotStatus(null);
                  }}
                  placeholder="nama@perusahaan.com"
                  placeholderTextColor={theme.textMuted}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
              </View>
            </View>

            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handleSendResetPassword}
              disabled={isSendingReset}
            >
              {isSendingReset ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryButtonText}>Kirim Link Reset Kata Sandi ✉️</Text>
              )}
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
  topBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  themeToggle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    maxWidth: 440,
    width: '100%',
    alignSelf: 'center',
  },
  headerBox: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logoBadge: {
    width: 60,
    height: 60,
    borderRadius: 20,
    backgroundColor: Palette.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: Palette.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
  },
  appTitle: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  appSubtitle: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 6,
    paddingHorizontal: 12,
  },
  card: {
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  cardSubtitle: {
    fontSize: 12,
    marginTop: 4,
    marginBottom: 16,
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
    marginBottom: 14,
  },
  fieldLabel: {
    fontSize: 12,
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
    height: 46,
    gap: 10,
  },
  input: {
    flex: 1,
    fontSize: 14,
  },
  primaryButton: {
    backgroundColor: Palette.primary,
    borderRadius: 12,
    height: 46,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  secondaryButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
    height: 44,
    marginTop: 10,
    borderWidth: 1,
    gap: 8,
  },
  secondaryButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  forgotPasswordText: {
    fontSize: 12,
    fontWeight: '700',
    color: Palette.primaryLight,
  },
  footerLinkRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
  },
  footerText: {
    fontSize: 13,
  },
  registerLink: {
    fontSize: 13,
    fontWeight: '700',
    color: Palette.primaryLight,
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    maxWidth: 440,
    width: '100%',
    alignSelf: 'center',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
  },
  modalSubtitle: {
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 16,
  },
  modalStatusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 14,
    gap: 8,
  },
  modalStatusText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 18,
  },
});
