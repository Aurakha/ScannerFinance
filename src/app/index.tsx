import { Redirect } from 'expo-router';
import { useAuthStore } from '@/store/authStore';

export default function Index() {
  const { session, isDemoMode } = useAuthStore();

  // Jika belum login dan bukan mode demo/guest, arahkan ke login page
  if (!session && !isDemoMode) {
    return <Redirect href="/auth/login" />;
  }

  return <Redirect href="/(tabs)" />;
}
