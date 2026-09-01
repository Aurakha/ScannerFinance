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

  const handleRegister = async () => {
    if (!fullName.trim() || !email.trim() || !password.trim()) {
      Alert.alert('Perhatian', 'Semua kolom wajib diisi.');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Perhatian', 'Kata sandi minimal 6 karakter.');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Perhatian', 'Konfirmasi kata sandi tidak cocok.');
      return;
    }

    const { error } = await signUp(email.trim(), password, fullName.trim());
    if (error) {
      Alert.alert('Pendaftaran Gagal', error);
    } else {
      Alert.alert(
        'Pendaftaran Berhasil! 🎉',
        'Akun Anda telah dibuat. Anda sekarang sudah masuk ke dashboard pribadi Anda.',
        [{ text: 'Buka Dashboard', onPress: () => router.replace('/(tabs)') }]
      );
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
                    onChangeText={setFullName}
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
    backgroundColor: Palette.primary,
    borderRadius: 12,
    height: 46,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 14,
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
});
