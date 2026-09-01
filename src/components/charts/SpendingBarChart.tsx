import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Palette } from '@/constants/theme';
import { formatRupiah } from '@/utils/formatters';

interface DailyExpense {
  dayLabel: string; // Sen, Sel, Rab, Kam, Jum, Sab, Min
  dateNumber: number;
  amount: number;
  isToday?: boolean;
}

interface SpendingBarChartProps {
  data: DailyExpense[];
  maxAmount?: number;
}

export const SpendingBarChart: React.FC<SpendingBarChartProps> = ({ data, maxAmount }) => {
  const calculatedMax = maxAmount || Math.max(...data.map((d) => d.amount), 50000);

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Tren Pengeluaran 7 Hari Terakhir</Text>
      </View>

      <View style={styles.chartArea}>
        {data.map((item, idx) => {
          const barHeightPercentage = Math.min(100, Math.max(8, (item.amount / calculatedMax) * 100));
          return (
            <View key={idx} style={styles.barColumn}>
              <View style={styles.barTrack}>
                <View
                  style={[
                    styles.barFill,
                    {
                      height: `${barHeightPercentage}%`,
                      backgroundColor: item.isToday ? Palette.primary : Palette.indigo,
                      opacity: item.isToday ? 1 : 0.75,
                    },
                  ]}
                />
              </View>

              <Text
                style={[
                  styles.dayLabel,
                  item.isToday && { color: Palette.primary, fontWeight: '700' },
                ]}
              >
                {item.dayLabel}
              </Text>
              <Text style={styles.dateLabel}>{item.dateNumber}</Text>
            </View>
          );
        })}
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
  headerRow: {
    marginBottom: 20,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: Palette.darkText,
  },
  chartArea: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 140,
    paddingTop: 10,
  },
  barColumn: {
    alignItems: 'center',
    flex: 1,
  },
  barTrack: {
    height: 90,
    width: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 7,
    justifyContent: 'flex-end',
    overflow: 'hidden',
    marginBottom: 8,
  },
  barFill: {
    width: '100%',
    borderRadius: 7,
  },
  dayLabel: {
    fontSize: 11,
    color: Palette.darkTextSecondary,
    fontWeight: '500',
  },
  dateLabel: {
    fontSize: 10,
    color: Palette.darkTextMuted,
    marginTop: 2,
  },
});
