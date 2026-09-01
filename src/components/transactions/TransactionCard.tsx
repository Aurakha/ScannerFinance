import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Palette } from '@/constants/theme';
import { Transaction } from '@/types';
import { formatFriendlyDate, formatRupiah } from '@/utils/formatters';
import { Badge } from '../common/Badge';

interface TransactionCardProps {
  transaction: Transaction;
  onPress?: () => void;
  onDelete?: () => void;
}

export const TransactionCard: React.FC<TransactionCardProps> = ({
  transaction,
  onPress,
  onDelete,
}) => {
  const category = transaction.category;
  const isIncome = category?.type === 'income';
  const categoryColor = category?.color || Palette.primary;
  const itemCount = transaction.items?.length || 0;

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      style={styles.container}
    >
      {/* Category Icon */}
      <View style={[styles.iconBox, { backgroundColor: `${categoryColor}18` }]}>
        <Ionicons
          name={(category?.icon as any) || 'receipt-outline'}
          size={22}
          color={categoryColor}
        />
      </View>

      {/* Main Info */}
      <View style={styles.mainInfo}>
        <View style={styles.titleRow}>
          <Text style={styles.merchantName} numberOfLines={1}>
            {transaction.merchant_name}
          </Text>
          <Text
            style={[
              styles.amountText,
              { color: isIncome ? Palette.primary : Palette.darkText },
            ]}
          >
            {isIncome ? '+' : '-'}{formatRupiah(transaction.total_amount)}
          </Text>
        </View>

        <View style={styles.subRow}>
          <Text style={styles.dateText}>
            {formatFriendlyDate(transaction.transaction_date)}
          </Text>

          <View style={styles.badgesRow}>
            {itemCount > 0 && (
              <Badge
                label={`${itemCount} item`}
                color={Palette.darkTextSecondary}
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
          <Text style={styles.notesText} numberOfLines={1}>
            💬 {transaction.notes}
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
    backgroundColor: Palette.darkCard,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  iconBox: {
    width: 46,
    height: 46,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
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
    fontSize: 14,
    fontWeight: '700',
    color: Palette.darkText,
    flex: 1,
    marginRight: 8,
  },
  amountText: {
    fontSize: 14,
    fontWeight: '800',
  },
  subRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dateText: {
    fontSize: 12,
    color: Palette.darkTextMuted,
  },
  badgesRow: {
    flexDirection: 'row',
    gap: 6,
  },
  notesText: {
    fontSize: 11,
    color: Palette.darkTextMuted,
    marginTop: 4,
    fontStyle: 'italic',
  },
});
