import { Tabs } from 'expo-router';
import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Palette } from '@/constants/theme';
import { useThemeStore } from '@/store/themeStore';
import { useLanguageStore } from '@/store/languageStore';
import { CompanyInfoRequiredModal } from '@/components/modals/CompanyInfoRequiredModal';

export default function TabLayout() {
  const { theme } = useThemeStore();
  const { t, language } = useLanguageStore();

  return (
    <>
    <Tabs
      key={`tab-layout-${language}`}
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
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('tabs.home'),
          tabBarLabel: ({ color }) => (
            <Text style={[styles.tabLabelText, { color }]}>{t('tabs.home')}</Text>
          ),
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
          title: t('tabs.transactions'),
          tabBarLabel: ({ color }) => (
            <Text style={[styles.tabLabelText, { color }]}>{t('tabs.transactions')}</Text>
          ),
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
          title: t('tabs.scanner'),
          tabBarLabel: ({ color }) => (
            <Text style={[styles.tabLabelText, { color: Palette.primaryLight, marginTop: 4 }]}>
              {t('tabs.scanner')}
            </Text>
          ),
          tabBarIcon: ({ focused }) => (
            <View style={styles.floatingContainer}>
              <View style={[styles.scanButtonCenter, { borderColor: theme.tabBar }]}>
                <Ionicons name="cloud-upload" size={26} color="#FFFFFF" />
              </View>
            </View>
          ),
        }}
      />

      <Tabs.Screen
        name="analytics"
        options={{
          title: t('tabs.input') || 'Input',
          tabBarLabel: ({ color }) => (
            <Text style={[styles.tabLabelText, { color }]}>{t('tabs.input') || 'Input'}</Text>
          ),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'wallet' : 'wallet-outline'}
              size={22}
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: t('tabs.profile'),
          tabBarLabel: ({ color }) => (
            <Text style={[styles.tabLabelText, { color }]}>{t('tabs.profile')}</Text>
          ),
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
    <CompanyInfoRequiredModal />
    </>
  );
}

const styles = StyleSheet.create({
  tabLabelText: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
    textAlign: 'center',
  },
  floatingContainer: {
    position: 'absolute',
    top: -26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanButtonCenter: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: Palette.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3.5,
    shadowColor: Palette.primary,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 9,
  },
});
