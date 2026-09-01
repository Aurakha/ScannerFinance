import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Palette } from '@/constants/theme';
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
}) => {
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

  return (
    <TouchableOpacity
      activeOpacity={onPress ? 0.8 : 1}
      onPress={onPress}
      style={[
        styles.card,
        {
          borderColor: 'rgba(255, 255, 255, 0.08)',
        },
      ]}
    >
      <View style={styles.headerRow}>
        <View style={[styles.iconBox, { backgroundColor: `${color}18` }]}>
          <Ionicons name={icon} size={20} color={color} />
        </View>

        {badgeText && (
          <View style={[styles.badge, { backgroundColor: `${badgeColor}20` }]}>
            <Text style={[styles.badgeText, { color: badgeColor }]}>{badgeText}</Text>
          </View>
        )}
      </View>

      <Text style={styles.title}>{title}</Text>
      <Text style={styles.amount}>{formatRupiah(amount)}</Text>

      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: Palette.darkCard,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 4,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  title: {
    fontSize: 13,
    color: Palette.darkTextSecondary,
    fontWeight: '500',
    marginBottom: 4,
  },
  amount: {
    fontSize: 22,
    fontWeight: '800',
    color: Palette.darkText,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 12,
    color: Palette.darkTextMuted,
    marginTop: 6,
  },
});
