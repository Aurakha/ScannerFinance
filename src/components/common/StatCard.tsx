import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Palette } from '@/constants/theme';
import { useThemeStore } from '@/store/themeStore';
import { useLanguageStore } from '@/store/languageStore';
import { formatRupiah } from '@/utils/formatters';

interface StatCardProps {
  title: string;
  amount: number;
  icon: keyof typeof Ionicons.glyphMap;
  color?: string;
  subtitle?: string;
  badgeText?: string;
  badgeType?: 'success' | 'warning' | 'danger' | 'info';
  onPress?: () => void;
  isCount?: boolean;
  unit?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  amount,
  icon,
  color = Palette.primary,
  subtitle,
  badgeText,
  badgeType = 'success',
  onPress,
  isCount,
  unit,
}) => {
  const { theme } = useThemeStore();
  const { language } = useLanguageStore();

  const getBadgeColor = () => {
    switch (badgeType) {
      case 'danger':
        return Palette.coral;
      case 'warning':
        return Palette.amber;
      case 'info':
        return Palette.indigo;
      default:
        return Palette.primary;
    }
  };

  const badgeColor = getBadgeColor();

  const isReceiptCount =
    isCount !== undefined
      ? isCount
      : title.toLowerCase().includes('struk') ||
        title.toLowerCase().includes('receipt');

  const defaultUnit = language === 'id' ? 'Struk' : amount === 1 ? 'Receipt' : 'Receipts';
  const displayAmount = isReceiptCount
    ? `${amount} ${unit || defaultUnit}`
    : formatRupiah(amount);

  return (
    <TouchableOpacity
      activeOpacity={onPress ? 0.8 : 1}
      onPress={onPress}
      style={[
        styles.card,
        {
          backgroundColor: theme.card,
          borderColor: theme.border,
        },
      ]}
    >
      <View style={styles.headerRow}>
        <View style={[styles.iconBox, { backgroundColor: `${color}18` }]}>
          <Ionicons name={icon} size={18} color={color} />
        </View>

        {badgeText && (
          <View style={[styles.badge, { backgroundColor: `${badgeColor}20` }]}>
            <Text style={[styles.badgeText, { color: badgeColor }]}>{badgeText}</Text>
          </View>
        )}
      </View>

      <Text style={[styles.title, { color: theme.textSecondary }]}>{title}</Text>
      <Text style={[styles.amount, { color: theme.text }]}>
        {displayAmount}
      </Text>

      {subtitle ? (
        <Text style={[styles.subtitle, { color: theme.textMuted }]}>{subtitle}</Text>
      ) : null}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 3,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  title: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  amount: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 11,
    marginTop: 4,
  },
});
