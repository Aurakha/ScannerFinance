import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { G, Circle } from 'react-native-svg';
import { Palette } from '@/constants/theme';
import { useThemeStore } from '@/store/themeStore';
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
  const { theme, mode } = useThemeStore();
  const size = 180;
  const radius = 70;
  const strokeWidth = 24;
  const center = size / 2;
  const circumference = 2 * Math.PI * radius;

  if (!data || data.length === 0 || totalAmount === 0) {
    return (
      <View
        style={[
          styles.emptyContainer,
          { backgroundColor: theme.card, borderColor: theme.border },
        ]}
      >
        <Text style={[styles.emptyText, { color: theme.textMuted }]}>
          Belum ada data pengeluaran aktif
        </Text>
      </View>
    );
  }

  let accumulatedPercent = 0;

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.card, borderColor: theme.border },
      ]}
    >
      <View style={styles.chartWrapper}>
        <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <G transform={`rotate(-90, ${center}, ${center})`}>
            {/* Background ring */}
            <Circle
              cx={center}
              cy={center}
              r={radius}
              stroke={mode === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.06)'}
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
          <Text style={[styles.centerSub, { color: theme.textMuted }]}>Total</Text>
          <Text style={[styles.centerAmount, { color: theme.text }]} numberOfLines={1}>
            {formatRupiah(totalAmount)}
          </Text>
        </View>
      </View>

      {/* Legend list */}
      <View style={[styles.legendContainer, { borderTopColor: theme.border }]}>
        {data.slice(0, 5).map((item) => (
          <View key={item.categoryId} style={styles.legendRow}>
            <View style={styles.legendLeft}>
              <View style={[styles.dot, { backgroundColor: item.categoryColor }]} />
              <Text style={[styles.legendName, { color: theme.text }]} numberOfLines={1}>
                {item.categoryName}
              </Text>
            </View>

            <View style={styles.legendRight}>
              <Text style={[styles.legendAmount, { color: theme.text }]}>
                {formatRupiah(item.amount)}
              </Text>
              <Text style={[styles.legendPercent, { color: theme.textSecondary }]}>
                {formatPercent(item.percentage)}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    marginHorizontal: 16,
  },
  emptyContainer: {
    padding: 26,
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: 1,
    marginHorizontal: 16,
  },
  emptyText: {
    fontSize: 13,
  },
  chartWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    position: 'relative',
  },
  centerLabel: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    width: 110,
  },
  centerSub: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  centerAmount: {
    fontSize: 13,
    fontWeight: '800',
    marginTop: 2,
  },
  legendContainer: {
    gap: 10,
    borderTopWidth: 1,
    paddingTop: 14,
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
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  legendName: {
    fontSize: 12,
    fontWeight: '600',
  },
  legendRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendAmount: {
    fontSize: 12,
    fontWeight: '700',
  },
  legendPercent: {
    fontSize: 11,
    fontWeight: '600',
    width: 36,
    textAlign: 'right',
  },
});
