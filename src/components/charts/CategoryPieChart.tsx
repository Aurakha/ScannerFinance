import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { G, Circle } from 'react-native-svg';
import { Palette } from '@/constants/theme';
import { formatPercent, formatRupiah } from '@/utils/formatters';

interface CategoryData {
  categoryId: string;
  categoryName: string;
  categoryColor: string;
  categoryIcon: string;
  amount: number;
  percentage: number;
  transactionCount: number;
}

interface CategoryPieChartProps {
  data: CategoryData[];
  totalAmount: number;
}

export const CategoryPieChart: React.FC<CategoryPieChartProps> = ({ data, totalAmount }) => {
  const size = 180;
  const radius = 70;
  const strokeWidth = 24;
  const center = size / 2;
  const circumference = 2 * Math.PI * radius;

  if (!data || data.length === 0 || totalAmount === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>Belum ada data pengeluaran bulan ini</Text>
      </View>
    );
  }

  let accumulatedPercent = 0;

  return (
    <View style={styles.container}>
      <View style={styles.chartWrapper}>
        <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <G transform={`rotate(-90, ${center}, ${center})`}>
            {/* Background ring */}
            <Circle
              cx={center}
              cy={center}
              r={radius}
              stroke="rgba(255, 255, 255, 0.05)"
              strokeWidth={strokeWidth}
              fill="transparent"
            />

            {/* Slices */}
            {data.map((item, index) => {
              const strokeDashoffset = circumference - (circumference * item.percentage) / 100;
              const rotationAngle = (accumulatedPercent / 100) * 360;
              accumulatedPercent += item.percentage;

              return (
                <Circle
                  key={item.categoryId || index}
                  cx={center}
                  cy={center}
                  r={radius}
                  stroke={item.categoryColor || Palette.primary}
                  strokeWidth={strokeWidth}
                  strokeDasharray={`${circumference} ${circumference}`}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                  fill="transparent"
                  transform={`rotate(${rotationAngle}, ${center}, ${center})`}
                />
              );
            })}
          </G>
        </Svg>

        {/* Center label */}
        <View style={styles.centerLabel}>
          <Text style={styles.centerSub}>Total</Text>
          <Text style={styles.centerAmount} numberOfLines={1}>
            {formatRupiah(totalAmount)}
          </Text>
        </View>
      </View>

      {/* Legend list */}
      <View style={styles.legendContainer}>
        {data.slice(0, 5).map((item) => (
          <View key={item.categoryId} style={styles.legendRow}>
            <View style={styles.legendLeft}>
              <View style={[styles.dot, { backgroundColor: item.categoryColor }]} />
              <Text style={styles.legendName} numberOfLines={1}>
                {item.categoryName}
              </Text>
            </View>

            <View style={styles.legendRight}>
              <Text style={styles.legendAmount}>{formatRupiah(item.amount)}</Text>
              <Text style={styles.legendPercent}>{formatPercent(item.percentage)}</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: Palette.darkCard,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  emptyContainer: {
    padding: 30,
    alignItems: 'center',
    backgroundColor: Palette.darkCard,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  emptyText: {
    color: Palette.darkTextMuted,
    fontSize: 14,
  },
  chartWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    position: 'relative',
  },
  centerLabel: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    width: 100,
  },
  centerSub: {
    fontSize: 11,
    color: Palette.darkTextMuted,
    fontWeight: '500',
    textTransform: 'uppercase',
  },
  centerAmount: {
    fontSize: 14,
    fontWeight: '800',
    color: Palette.darkText,
    marginTop: 2,
  },
  legendContainer: {
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
    paddingTop: 16,
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  legendLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 10,
  },
  legendName: {
    fontSize: 13,
    color: Palette.darkText,
    fontWeight: '500',
  },
  legendRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  legendAmount: {
    fontSize: 13,
    fontWeight: '700',
    color: Palette.darkText,
  },
  legendPercent: {
    fontSize: 12,
    fontWeight: '600',
    color: Palette.darkTextSecondary,
    width: 38,
    textAlign: 'right',
  },
});
