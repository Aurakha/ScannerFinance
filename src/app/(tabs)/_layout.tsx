import { Tabs } from 'expo-router';
import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Palette } from '@/constants/theme';
import { useThemeStore } from '@/store/themeStore';

export default function TabLayout() {
  const { theme } = useThemeStore();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarLabelPosition: 'below-icon',
        tabBarStyle: {
          backgroundColor: theme.tabBar,
          borderTopColor: theme.tabBarBorder,
          borderTopWidth: 1,
          height: Platform.OS === 'ios' ? 88 : 74,
          paddingBottom: Platform.OS === 'ios' ? 26 : 10,
          paddingTop: 6,
        },
        tabBarActiveTintColor: Palette.primary,
        tabBarInactiveTintColor: theme.textMuted,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '700',
          marginTop: 2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Beranda',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'home' : 'home-outline'}
              size={22}
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="transactions"
        options={{
          title: 'Transaksi',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'receipt' : 'receipt-outline'}
              size={22}
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="scanner"
        options={{
          title: 'Unggah Struk',
          tabBarIcon: ({ focused }) => (
            <View style={styles.floatingContainer}>
              <View style={[styles.scanButtonCenter, { borderColor: theme.tabBar }]}>
                <Ionicons name="cloud-upload" size={20} color="#FFFFFF" />
              </View>
            </View>
          ),
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: '700',
            color: Palette.primaryLight,
            marginTop: 2,
          },
        }}
      />

      <Tabs.Screen
        name="analytics"
        options={{
          title: 'Analisis',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'pie-chart' : 'pie-chart-outline'}
              size={22}
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profil',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'person' : 'person-outline'}
              size={22}
              color={color}
            />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  floatingContainer: {
    position: 'absolute',
    top: -14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanButtonCenter: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Palette.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    shadowColor: Palette.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 8,
    elevation: 8,
  },
});
