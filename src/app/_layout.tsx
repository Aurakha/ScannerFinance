import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useTransactionStore } from '@/store/transactionStore';
import { useThemeStore } from '@/store/themeStore';

export default function RootLayout() {
  const { initializeAuth, session, isLoading } = useAuthStore();
  const { loadData } = useTransactionStore();
  const { mode, theme, loadTheme } = useThemeStore();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    loadTheme();
    initializeAuth().then(() => {
      loadData();
    });
  }, []);

  useEffect(() => {
    if (isLoading) return;
    const inAllowedGroup = segments[0] === 'auth' || segments[0] === 'admin';
    const isUserLoggedIn = !!session;

    // Setiap kali user membuka aplikasi dan belum login serta bukan di halaman auth/admin, arahkan ke login
    if (!isUserLoggedIn && !inAllowedGroup) {
      router.replace('/auth/login');
    }
  }, [session, isLoading, segments]);

  return (
    <>
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
    </>
  );
}
