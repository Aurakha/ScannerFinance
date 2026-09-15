import { LanguageToggle } from '@/components/common/LanguageToggle';
import { Palette } from '@/constants/theme';
import { supabase } from '@/services/supabase';
import { useAuthStore } from '@/store/authStore';
import { useThemeStore } from '@/store/themeStore';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as Linking from 'expo-linking';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

export default function ResetPasswordScreen() {
  const router = useRouter();
  const searchParams = useLocalSearchParams<{ code?: string; access_token?: string; refresh_token?: string }>();
  const { updatePassword, isLoading } = useAuthStore();
  const { theme, mode, toggleTheme } = useThemeStore();

  const [isReady, setIsReady] = useState(false);
  const [isVerifying, setIsVerifying] = useState(true);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const setupRecoverySession = async () => {
      try {
        // 1. Periksa apakah sudah ada sesi aktif dari Supabase (misal via PASSWORD_RECOVERY event)
        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData?.session) {
          if (isMounted) {
            setIsReady(true);
            setIsVerifying(false);
          }
          return;
        }

        // 2. Jika di Web, coba ambil token dari hash URL (#access_token=...&refresh_token=...)
        if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location.hash) {
          const hashParams = new URLSearchParams(window.location.hash.substring(1));
          const accessToken = hashParams.get('access_token');
          const refreshToken = hashParams.get('refresh_token');

          if (accessToken && refreshToken) {
            const { error: sessionError } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
            if (!sessionError) {
              if (isMounted) {
                setIsReady(true);
                setIsVerifying(false);
              }
              return;
            }
          }
        }

        // 3. Jika menggunakan PKCE code flow (?code=...)
        const code = searchParams.code;
        if (code && typeof code === 'string') {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (!exchangeError) {
            if (isMounted) {
              setIsReady(true);
              setIsVerifying(false);
            }
            return;
          }
        }

        // 4. Jika di Native mobile, parse deep link URL
        const initialUrl = await Linking.getInitialURL();
        if (initialUrl) {
          const parsed = Linking.parse(initialUrl);
          const hashPart = initialUrl.split('#')[1];
          if (hashPart) {
            const hashParams = new URLSearchParams(hashPart);
            const accessToken = hashParams.get('access_token');
            const refreshToken = hashParams.get('refresh_token');
            if (accessToken && refreshToken) {
              const { error } = await supabase.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken,
              });
              if (!error) {
                if (isMounted) {
                  setIsReady(true);
                  setIsVerifying(false);
                }
                return;
              }
            }
          }
        }

        // Jika setelah beberapa waktu belum ada sesi recovery
        if (isMounted) {
          // Tunggu sebentar untuk memberi kesempatan onAuthStateChange
          setTimeout(async () => {
            if (!isMounted) return;
            const { data: recheck } = await supabase.auth.getSession();
            if (recheck?.session) {
              setIsReady(true);
              setIsVerifying(false);
            } else {
              setIsVerifying(false);
              setVerifyError(
                'Tautan reset kata sandi tidak valid atau telah kedaluwarsa. Silakan minta tautan baru melalui halaman login.'
              );
            }
          }, 1500);
        }
      } catch (err: any) {
        if (isMounted) {
          setIsVerifying(false);
          setVerifyError(err.message || 'Gagal memverifikasi sesi reset kata sandi.');
        }
      }
    };

    // Listener Supabase Auth
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && session)) {
        if (isMounted) {
          setIsReady(true);
          setIsVerifying(false);
          setVerifyError(null);
        }
      }
    });

    setupRecoverySession();

    return () => {
      isMounted = false;
      authListener?.subscription.unsubscribe();
    };
  }, []);

  const handleUpdatePassword = async () => {
    setErrorMessage('');
    if (!password.trim()) {
      setErrorMessage('Kata sandi baru tidak boleh kosong.');
      return;
    }
    if (password.length < 6) {
      setErrorMessage('Kata sandi baru minimal 6 karakter.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage('Konfirmasi kata sandi tidak cocok.');
      return;
    }

    setIsSubmitting(true);
    const { error } = await updatePassword(password);
    setIsSubmitting(false);

    if (error) {
      setErrorMessage(error);
    } else {
      setIsSuccess(true);
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
          {/* Top Bar */}
          <View style={styles.topBar}>
            <TouchableOpacity
              style={[styles.backBtn, { backgroundColor: theme.cardHover }]}
              onPress={() => router.replace('/auth/login')}
            >
              <Ionicons name="arrow-back" size={18} color={theme.text} />
            </TouchableOpacity>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <LanguageToggle />
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
          </View>

          <View style={styles.content}>
            {/* Header / Logo */}
            <View style={styles.headerBox}>
              <Image
                source={require('../../../assets/images/icon.png')}
                style={styles.logoImage}
                contentFit="contain"
              />
              <Text style={[styles.appTitle, { color: theme.text }]}>ScanFinance</Text>
              <Text style={[styles.appSubtitle, { color: theme.textSecondary }]}>
                Atur ulang kata sandi akun Anda dengan aman
              </Text>
            </View>

            {/* Main Card */}
            <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
              {isSuccess ? (
                <View style={styles.successBox}>
                  <View style={styles.successIconWrapper}>
                    <Ionicons name="checkmark-circle" size={56} color={Palette.greenOnline} />
                  </View>
                  <Text style={[styles.cardTitle, { color: theme.text, textAlign: 'center' }]}>
                    Kata Sandi Berhasil Diperbarui!
                  </Text>
                  <Text
                    style={[
                      styles.cardSubtitle,
                      { color: theme.textSecondary, textAlign: 'center', marginTop: 8 },
                    ]}
                  >
                    Kata sandi akun Anda telah berhasil diubah. Silakan masuk kembali menggunakan kata sandi yang baru.
                  </Text>
                  <TouchableOpacity
                    style={[styles.primaryButton, { marginTop: 24 }]}
                    onPress={() => router.replace('/auth/login')}
                  >
                    <Text style={styles.primaryButtonText}>Masuk ke Akun</Text>
                    <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              ) : isVerifying ? (
                <View style={styles.loadingBox}>
                  <ActivityIndicator size="large" color={Palette.primary} />
                  <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
                    Memverifikasi tautan reset kata sandi...
                  </Text>
                </View>
              ) : verifyError && !isReady ? (
                <View style={styles.errorContainer}>
                  <View style={styles.warningIconWrapper}>
                    <Ionicons name="alert-circle" size={48} color={Palette.coral} />
                  </View>
                  <Text style={[styles.cardTitle, { color: theme.text, textAlign: 'center' }]}>
                    Tautan Tidak Berlaku
                  </Text>
                  <Text
                    style={[
                      styles.cardSubtitle,
                      { color: theme.textSecondary, textAlign: 'center', marginTop: 8 },
                    ]}
                  >
                    {verifyError}
                  </Text>
                  <TouchableOpacity
                    style={[styles.primaryButton, { marginTop: 24 }]}
                    onPress={() => router.replace('/auth/login')}
                  >
                    <Text style={styles.primaryButtonText}>Kembali ke Halaman Masuk</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <>
                  <Text style={[styles.cardTitle, { color: theme.text }]}>Buat Kata Sandi Baru</Text>
                  <Text style={[styles.cardSubtitle, { color: theme.textMuted }]}>
                    Masukkan kombinasi kata sandi baru untuk akun Anda
                  </Text>

                  {/* Inline Error Notification */}
                  {errorMessage ? (
                    <View style={styles.errorBanner}>
                      <Ionicons name="alert-circle" size={20} color={Palette.coral} />
                      <Text style={styles.errorBannerText}>{errorMessage}</Text>
                    </View>
                  ) : null}

                  {/* New Password */}
                  <View style={styles.fieldGroup}>
                    <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>
                      Kata Sandi Baru
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
                        placeholder="Minimal 6 karakter"
                        placeholderTextColor={theme.textMuted}
                        secureTextEntry={!showPassword}
                        value={password}
                        onChangeText={setPassword}
                        autoCapitalize="none"
                      />
                      <TouchableOpacity
                        onPress={() => setShowPassword(!showPassword)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Ionicons
                          name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                          size={18}
                          color={theme.textMuted}
                        />
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Confirm New Password */}
                  <View style={styles.fieldGroup}>
                    <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>
                      Konfirmasi Kata Sandi Baru
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
                        placeholder="Ketik ulang kata sandi baru"
                        placeholderTextColor={theme.textMuted}
                        secureTextEntry={!showConfirmPassword}
                        value={confirmPassword}
                        onChangeText={setConfirmPassword}
                        autoCapitalize="none"
                      />
                      <TouchableOpacity
                        onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Ionicons
                          name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'}
                          size={18}
                          color={theme.textMuted}
                        />
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Submit Button */}
                  <TouchableOpacity
                    style={[styles.primaryButton, (isSubmitting || isLoading) && styles.buttonDisabled]}
                    onPress={handleUpdatePassword}
                    disabled={isSubmitting || isLoading}
                  >
                    {isSubmitting || isLoading ? (
                      <ActivityIndicator color="#FFFFFF" size="small" />
                    ) : (
                      <>
                        <Text style={styles.primaryButtonText}>Simpan Kata Sandi</Text>
                        <Ionicons name="checkmark" size={18} color="#FFFFFF" />
                      </>
                    )}
                  </TouchableOpacity>
                </>
              )}
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
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
  themeToggle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  headerBox: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logoImage: {
    width: 64,
    height: 64,
    marginBottom: 12,
  },
  appTitle: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  appSubtitle: {
    fontSize: 13,
    marginTop: 4,
    textAlign: 'center',
    maxWidth: 280,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 20,
    borderWidth: 1,
    padding: 24,
    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  cardSubtitle: {
    fontSize: 12,
    marginTop: 4,
    marginBottom: 16,
  },
  fieldGroup: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    height: 48,
    gap: 8,
  },
  input: {
    flex: 1,
    fontSize: 14,
    height: '100%',
  },
  primaryButton: {
    backgroundColor: Palette.primary,
    borderRadius: 12,
    height: 48,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    marginBottom: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
  },
  errorBannerText: {
    color: Palette.coral,
    fontSize: 12,
    fontWeight: '500',
    flex: 1,
    lineHeight: 16,
  },
  loadingBox: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 12,
  },
  loadingText: {
    fontSize: 13,
    textAlign: 'center',
  },
  errorContainer: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  warningIconWrapper: {
    marginBottom: 12,
  },
  successBox: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  successIconWrapper: {
    marginBottom: 12,
  },
});
