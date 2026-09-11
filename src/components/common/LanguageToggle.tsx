import React from 'react';
import { TouchableOpacity, Text, StyleSheet, Platform, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLanguageStore } from '@/store/languageStore';
import { useThemeStore } from '@/store/themeStore';
import { Palette } from '@/constants/theme';

interface LanguageToggleProps {
  style?: any;
  showText?: boolean;
}

export const LanguageToggle: React.FC<LanguageToggleProps> = ({ style, showText = true }) => {
  const { language, toggleLanguage } = useLanguageStore();
  const { theme } = useThemeStore();

  return (
    <TouchableOpacity
      style={[
        styles.container,
        {
          backgroundColor: theme.cardHover,
          borderColor: theme.border,
        },
        style,
      ]}
      onPress={toggleLanguage}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`Ganti bahasa. Saat ini: ${language.toUpperCase()}`}
      {...(Platform.OS === 'web'
        ? {
            title: language === 'id' ? 'Switch to English' : 'Ganti ke Bahasa Indonesia',
          }
        : {})}
    >
      <Ionicons
        name="globe-outline"
        size={16}
        color={Palette.primaryLight}
      />
      {showText && (
        <Text style={[styles.langText, { color: theme.text }]}>
          {language.toUpperCase()}
        </Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 38,
    paddingHorizontal: 10,
    borderRadius: 19,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    borderWidth: 1,
  },
  langText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
