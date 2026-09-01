import { Tabs } from 'expo-router';
import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Palette } from '@/constants/theme';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#111214', // Discord Header & Tab Bar dark
          borderTopColor: 'rgba(255, 255, 255, 0.08)',
          borderTopWidth: 1,
          height: Platform.OS === 'ios' ? 88 : 68,
          paddingBottom: Platform.OS === 'ios' ? 28 : 10,
          paddingTop: 10,
        },
        tabBarActiveTintColor: Palette.primary,
        tabBarInactiveTintColor: '#949BA4',
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
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
          title: 'Scan Struk',
          tabBarIcon: ({ focused }) => (
            <View style={styles.scanButtonCenter}>
              <View style={styles.scanButtonInner}>
                <Ionicons name="scan" size={24} color="#FFFFFF" />
              </View>
            </View>
          ),
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: '700',
            color: Palette.primary,
            marginTop: 4,
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
  scanButtonCenter: {
    top: -14,
    justifyContent: 'center',
    alignItems: 'center',
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#111214',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    shadowColor: Palette.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
    elevation: 6,
  },
  scanButtonInner: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Palette.primary, // Discord Blurple
    justifyContent: 'center',
    alignItems: 'center',
  },
});
