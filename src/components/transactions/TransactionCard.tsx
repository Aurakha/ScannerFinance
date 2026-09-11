import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Palette } from '@/constants/theme';
import { Transaction } from '@/types';
import { useThemeStore } from '@/store/themeStore';
import { useLanguageStore } from '@/store/languageStore';
import { formatFriendlyDate, formatRupiah } from '@/utils/formatters';
import { Badge } from '../common/Badge';
import { DEFAULT_CATEGORIES } from '@/constants/categories';
import { categorizeColumn } from '@/utils/exportReport';

interface TransactionCardProps {
  transaction: Transaction;
  onPress?: () => void;
  onDelete?: () => void;
}

export const TransactionCard: React.FC<TransactionCardProps> = ({
  transaction,
  onPress,
}) => {
  const { theme } = useThemeStore();
  const { language, t } = useLanguageStore();
  const category =
    transaction.category ||
    DEFAULT_CATEGORIES.find((c) => c.id === transaction.category_id) ||
    DEFAULT_CATEGORIES.find((c) => {
      const catKey = categorizeColumn(transaction.merchant_name || '');
      return categorizeColumn(c.name) === catKey;
    }) ||
    DEFAULT_CATEGORIES[0];

  const isIncome = category?.type === 'income';
  const categoryColor = category?.color || Palette.primary;
  const itemCount = transaction.items?.length || 0;

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      style={[
        styles.container,
        {
          backgroundColor: theme.card,
          borderColor: theme.border,
        },
      ]}
    >
      {/* Category Icon */}
      <View style={[styles.iconBox, { backgroundColor: `${categoryColor}18` }]}>
        <Ionicons
          name={(category?.icon as any) || 'receipt-outline'}
          size={20}
          color={categoryColor}
        />
      </View>

      {/* Main Info */}
      <View style={styles.mainInfo}>
        <View style={styles.titleRow}>
          <Text style={[styles.merchantName, { color: theme.text }]} numberOfLines={1}>
            {transaction.merchant_name}
          </Text>
          <Text
            style={[
              styles.amountText,
              { color: isIncome ? Palette.primary : theme.text },
            ]}
          >
            {isIncome ? '+' : ''}{formatRupiah(transaction.total_amount)}
          </Text>
        </View>

        <View style={styles.subRow}>
          <Text style={[styles.dateText, { color: theme.textMuted }]}>
            {formatFriendlyDate(transaction.transaction_date, language)}
          </Text>

          <View style={styles.badgesRow}>
            {itemCount > 0 && (
              <Badge
                label={`${itemCount} ${itemCount > 1 ? t('common.items') : t('common.item')}`}
                color={theme.textSecondary}
                size="sm"
              />
            )}
            <Badge
              label={transaction.payment_method.toUpperCase()}
              color={categoryColor}
              size="sm"
            />
          </View>
        </View>

        {transaction.notes ? (
          <Text style={[styles.notesText, { color: theme.textMuted }]} numberOfLines={1}>
            {transaction.notes}
          </Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    marginHorizontal: 16,
  },
  iconBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  mainInfo: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  merchantName: {
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
    marginRight: 8,
  },
  amountText: {
    fontSize: 13,
    fontWeight: '800',
  },
  subRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dateText: {
    fontSize: 11,
  },
  badgesRow: {
    flexDirection: 'row',
    gap: 6,
  },
  notesText: {
    fontSize: 10,
    marginTop: 4,
    fontStyle: 'italic',
  },
});
