import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Palette } from '@/constants/theme';
import { useThemeStore } from '@/store/themeStore';
import { useLanguageStore } from '@/store/languageStore';
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
  const { theme, mode } = useThemeStore();
  const { t } = useLanguageStore();
  const calculatedMax = maxAmount || Math.max(...data.map((d) => d.amount), 50000);

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.card, borderColor: theme.border },
      ]}
    >
      <View style={styles.headerRow}>
        <Text style={[styles.title, { color: theme.text }]}>{t('analytics.spending7Days')}</Text>
      </View>

      <View style={styles.chartArea}>
        {data.map((item, idx) => {
          const barHeightPercentage = Math.min(100, Math.max(8, (item.amount / calculatedMax) * 100));
          return (
            <View key={idx} style={styles.barColumn}>
              <View
                style={[
                  styles.barTrack,
                  {
                    backgroundColor:
                      mode === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
                  },
                ]}
              >
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
                  { color: item.isToday ? Palette.primary : theme.textSecondary },
                  item.isToday && { fontWeight: '700' },
                ]}
              >
                {item.dayLabel}
              </Text>
              <Text style={[styles.dateLabel, { color: theme.textMuted }]}>{item.dateNumber}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
  },
  headerRow: {
    marginBottom: 16,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
  },
  chartArea: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 130,
    paddingTop: 8,
  },
  barColumn: {
    alignItems: 'center',
    flex: 1,
  },
  barTrack: {
    height: 86,
    width: 14,
    borderRadius: 7,
    justifyContent: 'flex-end',
    overflow: 'hidden',
    marginBottom: 6,
  },
  barFill: {
    width: '100%',
    borderRadius: 7,
  },
  dayLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
  dateLabel: {
    fontSize: 10,
    marginTop: 2,
  },
});
