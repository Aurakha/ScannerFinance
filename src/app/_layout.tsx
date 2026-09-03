import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useAuthStore } from '@/store/authStore';
import { useTransactionStore } from '@/store/transactionStore';
import { useThemeStore } from '@/store/themeStore';
import { useLanguageStore } from '@/store/languageStore';
import { Palette } from '@/constants/theme';

class GlobalErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  state = { hasError: false, error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: any) {
    console.error('App Uncaught Error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View
          style={{
            flex: 1,
            backgroundColor: Palette.darkBg,
            justifyContent: 'center',
            alignItems: 'center',
            padding: 24,
          }}
        >
          <Text style={{ fontSize: 20, fontWeight: '800', color: Palette.darkText, marginBottom: 8 }}>
            Terjadi Kendala Memuat Halaman
          </Text>
          <Text
            style={{
              fontSize: 13,
              color: Palette.darkTextMuted,
              textAlign: 'center',
              maxWidth: 360,
              marginBottom: 20,
              lineHeight: 18,
            }}
          >
            {this.state.error?.message || 'Data telah diperbarui atau halaman mengalami masalah teknis.'}
          </Text>
          <TouchableOpacity
            style={{
              paddingHorizontal: 20,
              paddingVertical: 12,
              borderRadius: 12,
              backgroundColor: Palette.primary,
            }}
            onPress={() => {
              this.setState({ hasError: false, error: null });
              if (typeof window !== 'undefined') {
                window.location.href = '/';
              }
            }}
          >
            <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 13 }}>
              Kembali ke Beranda
            </Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

export default function RootLayout() {
  const { initializeAuth, session, isLoading } = useAuthStore();
  const { loadData } = useTransactionStore();
  const { mode, theme, loadTheme } = useThemeStore();
  const { loadLanguage } = useLanguageStore();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    loadTheme();
    loadLanguage();
    initializeAuth().then(() => {
      loadData();
    });
  }, []);

  useEffect(() => {
    if (isLoading) return; // Tunggu auth selesai loading

    const inAuthGroup = segments[0] === 'auth';
    const { isDemoMode } = useAuthStore.getState();

    if (!session && !isDemoMode && !inAuthGroup) {
      // Belum login & bukan demo → arahkan ke login
      router.replace('/auth/login');
    }
  }, [session, isLoading, segments]);

  return (
    <GlobalErrorBoundary>
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.background },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="auth/login" options={{ headerShown: false }} />
        <Stack.Screen name="auth/register" options={{ headerShown: false }} />
        <Stack.Screen name="admin/index" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="transaction/[id]"
          options={{
            headerShown: false,
            presentation: 'card',
          }}
        />
      </Stack>
    </GlobalErrorBoundary>
  );
}
